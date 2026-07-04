"""PRD-019: Multi storage backend abstraction.

Provides a uniform interface for reading/writing media files across different
storage backends (local filesystem, S3-compatible object storage).
"""
import os
from abc import ABC, abstractmethod
from typing import Optional

from backend.models import MEDIA_DIR


class StorageBackend(ABC):
    """Abstract storage backend interface."""

    @abstractmethod
    def save(self, path: str, file_bytes: bytes) -> str:
        """Save bytes under the given relative path. Returns the stored path."""

    @abstractmethod
    def read(self, path: str) -> bytes:
        """Read the full content of the given relative path."""

    @abstractmethod
    def delete(self, path: str) -> bool:
        """Delete the file at the given relative path. Returns True on success."""

    @abstractmethod
    def exists(self, path: str) -> bool:
        """Return True if a file exists at the given relative path."""

    @abstractmethod
    def url(self, path: str) -> str:
        """Return a URL that can be used to access the file."""

    @abstractmethod
    def stream_range(self, path: str, start: int, end: int):
        """Yield bytes for the given [start, end] range (inclusive)."""

    @abstractmethod
    def size(self, path: str) -> int:
        """Return the size of the file in bytes."""

    @abstractmethod
    def abs_path(self, path: str) -> str:
        """Return the absolute local path if available (for ffmpeg/ffprobe)."""

    @abstractmethod
    def presigned_url(self, path: str, expires: int = 3600) -> str:
        """Return a URL that grants temporary read access to the file."""

    @abstractmethod
    def backend_name(self) -> str:
        """Return backend identifier: 'local' or 's3'."""


class LocalStorage(StorageBackend):
    """Local filesystem storage backend.

    Wraps the existing file operations based on the project MEDIA_DIR.
    `path` arguments are relative to MEDIA_DIR (e.g. "audio/abc.mp3").
    """

    def _full(self, path: str) -> str:
        # Support both "media/audio/x.mp3" and "audio/x.mp3" style paths.
        if path.startswith("media/"):
            path = path[len("media/"):]
        return os.path.join(MEDIA_DIR, path)

    def save(self, path: str, file_bytes: bytes) -> str:
        full = self._full(path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as f:
            f.write(file_bytes)
        return path

    def read(self, path: str) -> bytes:
        with open(self._full(path), "rb") as f:
            return f.read()

    def delete(self, path: str) -> bool:
        full = self._full(path)
        if os.path.exists(full):
            try:
                os.remove(full)
                return True
            except OSError:
                return False
        return False

    def exists(self, path: str) -> bool:
        return os.path.exists(self._full(path))

    def url(self, path: str) -> str:
        if not path.startswith("media/"):
            path = f"media/{path}"
        return path

    def stream_range(self, path: str, start: int, end: int):
        full = self._full(path)
        remaining = end - start + 1
        with open(full, "rb") as f:
            f.seek(start)
            while remaining > 0:
                chunk_size = min(8192 * 16, remaining)
                data = f.read(chunk_size)
                if not data:
                    break
                remaining -= len(data)
                yield data

    def size(self, path: str) -> int:
        return os.path.getsize(self._full(path))

    def abs_path(self, path: str) -> str:
        return self._full(path)

    def presigned_url(self, path: str, expires: int = 3600) -> str:
        # Local backend serves directly via /media/* routes; no presigning needed.
        if not path.startswith("media/"):
            path = f"media/{path}"
        return path

    def backend_name(self) -> str:
        return "local"


class S3Storage(StorageBackend):
    """S3-compatible object storage backend.

    Requires `boto3`. If boto3 is not installed, instantiation raises a
    clear ImportError so callers can fall back to LocalStorage.
    """

    def __init__(self, endpoint: str, bucket: str, access_key: str, secret_key: str, region: str = ""):
        try:
            import boto3  # type: ignore
        except ImportError as e:
            raise ImportError(
                "S3Storage requires boto3. Install with: pip install boto3"
            ) from e
        self._bucket = bucket
        self._endpoint = endpoint
        client_kwargs = {
            "endpoint_url": endpoint or None,
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
        }
        if region:
            client_kwargs["region_name"] = region
        self._s3 = boto3.client("s3", **client_kwargs)

    def _key(self, path: str) -> str:
        if path.startswith("media/"):
            path = path[len("media/"):]
        return path

    def save(self, path: str, file_bytes: bytes) -> str:
        from io import BytesIO
        self._s3.upload_fileobj(BytesIO(file_bytes), self._bucket, self._key(path))
        return path

    def read(self, path: str) -> bytes:
        from io import BytesIO
        buf = BytesIO()
        self._s3.download_fileobj(self._bucket, self._key(path), buf)
        return buf.getvalue()

    def delete(self, path: str) -> bool:
        try:
            self._s3.delete_object(Bucket=self._bucket, Key=self._key(path))
            return True
        except Exception:
            return False

    def exists(self, path: str) -> bool:
        try:
            self._s3.head_object(Bucket=self._bucket, Key=self._key(path))
            return True
        except Exception:
            return False

    def url(self, path: str) -> str:
        key = self._key(path)
        if self._endpoint:
            return f"{self._endpoint.rstrip('/')}/{self._bucket}/{key}"
        return f"https://{self._bucket}.s3.amazonaws.com/{key}"

    def stream_range(self, path: str, start: int, end: int):
        obj = self._s3.get_object(
            Bucket=self._bucket,
            Key=self._key(path),
            Range=f"bytes={start}-{end}",
        )
        for chunk in obj["Body"].iter_chunks(chunk_size=8192 * 16):
            yield chunk

    def size(self, path: str) -> int:
        resp = self._s3.head_object(Bucket=self._bucket, Key=self._key(path))
        return int(resp.get("ContentLength", 0))

    def abs_path(self, path: str) -> str:
        # S3 has no local absolute path; ffmpeg operations would need a local
        # download. Callers using ffmpeg should fall back to LocalStorage.
        raise NotImplementedError("S3 backend does not expose a local absolute path")

    def presigned_url(self, path: str, expires: int = 3600) -> str:
        """Generate a presigned GET URL valid for `expires` seconds."""
        return self._s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": self._key(path)},
            ExpiresIn=expires,
        )

    def backend_name(self) -> str:
        return "s3"


_storage_instance: Optional[StorageBackend] = None
_storage_backend_name: Optional[str] = None


def get_storage(db=None) -> StorageBackend:
    """Return the configured storage backend instance (cached).

    Reads `storage_backend` from system settings. Falls back to LocalStorage
    if S3 is requested but boto3 is not installed or misconfigured.
    """
    global _storage_instance, _storage_backend_name

    from backend.main import get_setting  # local import to avoid cycle
    backend_name = (get_setting("storage_backend", "local", db=db) or "local").lower()

    if _storage_instance is not None and _storage_backend_name == backend_name:
        return _storage_instance

    if backend_name == "s3":
        endpoint = get_setting("s3_endpoint", "", db=db)
        bucket = get_setting("s3_bucket", "", db=db)
        access_key = get_setting("s3_access_key", "", db=db)
        secret_key = get_setting("s3_secret_key", "", db=db)
        if not bucket:
            # Misconfigured; fall back to local
            _storage_instance = LocalStorage()
            _storage_backend_name = "local"
            return _storage_instance
        try:
            _storage_instance = S3Storage(endpoint, bucket, access_key, secret_key)
            _storage_backend_name = "s3"
            return _storage_instance
        except ImportError:
            # boto3 not installed; fall back to local
            _storage_instance = LocalStorage()
            _storage_backend_name = "local"
            return _storage_instance

    _storage_instance = LocalStorage()
    _storage_backend_name = "local"
    return _storage_instance


def reset_storage_cache():
    """Reset the cached storage instance (used when settings change)."""
    global _storage_instance, _storage_backend_name
    _storage_instance = None
    _storage_backend_name = None
