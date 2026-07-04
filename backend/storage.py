"""PRD-019: Multi storage backend abstraction.

Provides a uniform interface for reading/writing media files across different
storage backends (local filesystem, S3-compatible object storage).

Supported S3-compatible providers:
  - aws       : Amazon S3 (virtual-hosted style)
  - aliyun    : 阿里云 OSS (virtual-hosted style)
  - minio     : MinIO (path style)
  - custom    : 自定义 S3 兼容服务
"""
import os
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

from backend.models import MEDIA_DIR


# Provider presets: auto-fill endpoint/region/path_style for common S3-compatible services.
# "endpoint_tpl" uses {region} and {bucket} placeholders for per-region services.
S3_PROVIDER_PRESETS: Dict[str, Dict[str, Any]] = {
    "aws": {
        "label": "AWS S3",
        "endpoint_tpl": "https://s3.{region}.amazonaws.com",
        "region_required": True,
        "path_style": False,
    },
    "aliyun": {
        "label": "阿里云 OSS",
        "endpoint_tpl": "https://oss-{region}.aliyuncs.com",
        "region_required": True,
        "region_hint": "例如 oss-cn-hangzhou",
        "path_style": False,
    },
    "cloudflare": {
        "label": "Cloudflare R2",
        "endpoint_tpl": "https://{account_id}.r2.cloudflarestorage.com",
        "region_required": False,
        "region_hint": "R2 使用 auto 作为区域，无需手动填写",
        "path_style": True,
    },
    "minio": {
        "label": "MinIO",
        "endpoint_tpl": "",  # user provides full endpoint (e.g. http://minio:9000)
        "region_required": False,
        "path_style": True,
    },
    "custom": {
        "label": "自定义 S3 兼容",
        "endpoint_tpl": "",  # user provides full endpoint
        "region_required": False,
        "path_style": True,  # most self-hosted S3 services use path style
    },
}


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

    @abstractmethod
    def provider(self) -> str:
        """Return provider identifier: 'local', 'aws', 'aliyun', 'minio', 'custom'."""

    def test_connection(self) -> dict:
        """Test if the storage backend is reachable. Returns {ok, error, details}."""
        return {"ok": False, "error": "not implemented", "details": {}}

    def list_files(self, prefix: str = "", max_keys: int = 100, delimiter: str = "/") -> dict:
        """List files in the storage backend. Not supported by LocalStorage."""
        return {"files": [], "dirs": [], "is_truncated": False}


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

    def provider(self) -> str:
        return "local"

    def test_connection(self) -> dict:
        try:
            total_bytes = 0
            for root, _, files in os.walk(MEDIA_DIR):
                for f in files:
                    fp = os.path.join(root, f)
                    if os.path.isfile(fp):
                        total_bytes += os.path.getsize(fp)
            return {"ok": True, "details": {
                "media_dir": MEDIA_DIR,
                "total_bytes": total_bytes,
            }}
        except Exception as e:
            return {"ok": False, "error": str(e), "details": {}}


class S3Storage(StorageBackend):
    """S3-compatible object storage backend.

    Requires `boto3`. If boto3 is not installed, instantiation raises a
    clear ImportError so callers can fall back to LocalStorage.
    """

    def __init__(self, endpoint: str, bucket: str, access_key: str, secret_key: str,
                 region: str = "", provider: str = "custom", use_path_style: bool = False):
        try:
            import boto3  # type: ignore
        except ImportError as e:
            raise ImportError(
                "S3Storage requires boto3. Install with: pip install boto3"
            ) from e
        self._bucket = bucket
        self._endpoint = endpoint
        self._region = region
        self._provider = provider if provider in S3_PROVIDER_PRESETS else "custom"
        self._path_style = use_path_style
        client_kwargs = {
            "endpoint_url": endpoint or None,
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
            "config": None,
        }
        if region:
            client_kwargs["region_name"] = region
        # Build boto3 config with path style if needed (MinIO etc.)
        if use_path_style:
            from botocore.config import Config  # type: ignore
            client_kwargs["config"] = Config(s3={"addressing_style": "path"})
        self._s3 = boto3.client("s3", **{k: v for k, v in client_kwargs.items() if v is not None})

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

    def provider(self) -> str:
        return self._provider

    def test_connection(self) -> dict:
        """Test S3 connectivity by listing objects in the bucket."""
        try:
            resp = self._s3.list_objects_v2(Bucket=self._bucket, MaxKeys=1)
            keys = resp.get("KeyCount", 0)
            location = ""
            try:
                loc_resp = self._s3.get_bucket_location(Bucket=self._bucket)
                location = loc_resp.get("LocationConstraint", "") or ""
            except Exception:
                pass
            return {
                "ok": True,
                "details": {
                    "bucket": self._bucket,
                    "endpoint": self._endpoint,
                    "provider": self._provider,
                    "path_style": self._path_style,
                    "region": self._region or location,
                    "object_count_sample": keys,
                },
            }
        except Exception as e:
            return {"ok": False, "error": str(e), "details": {
                "bucket": self._bucket,
                "endpoint": self._endpoint,
                "provider": self._provider,
                "path_style": self._path_style,
            }}

    def list_files(self, prefix: str = "", max_keys: int = 100, delimiter: str = "/") -> dict:
        """List files and directories in the S3 bucket under the given prefix.

        Returns a dict with:
          - files: list of {key, size, last_modified}
          - dirs: list of common prefixes (subdirectories)
          - is_truncated: bool
          - next_token: str (for pagination)
        """
        try:
            kwargs = {
                "Bucket": self._bucket,
                "Prefix": prefix,
                "MaxKeys": max_keys,
            }
            if delimiter:
                kwargs["Delimiter"] = delimiter
            resp = self._s3.list_objects_v2(**kwargs)
            files = []
            for obj in resp.get("Contents", []):
                key = obj["Key"]
                if key == prefix:
                    continue  # skip the directory marker itself
                files.append({
                    "key": key,
                    "size": obj.get("Size", 0),
                    "last_modified": obj.get("LastModified", "").isoformat() if obj.get("LastModified") else "",
                    "url": self.url(key),
                })
            dirs = [p.get("Prefix", "") for p in resp.get("CommonPrefixes", [])]
            return {
                "files": files,
                "dirs": dirs,
                "is_truncated": resp.get("IsTruncated", False),
                "next_token": resp.get("NextContinuationToken", ""),
            }
        except Exception as e:
            return {"error": str(e), "files": [], "dirs": [], "is_truncated": False}


_storage_instance: Optional[StorageBackend] = None
_storage_cache_key: Optional[str] = None


def _build_s3_endpoint(provider: str, region: str, endpoint: str) -> str:
    """Build the S3 endpoint URL based on provider preset.

    For aws/aliyun the endpoint is derived from region via the template.
    For cloudflare R2 the region field doubles as the account ID.
    For minio/custom the user-provided endpoint is used as-is.
    """
    preset = S3_PROVIDER_PRESETS.get(provider, S3_PROVIDER_PRESETS["custom"])
    tpl = preset.get("endpoint_tpl", "")
    if tpl and region:
        if provider == "cloudflare":
            return tpl.format(account_id=region)
        return tpl.format(region=region)
    return endpoint or ""


def _s3_env(key: str, default: str = "") -> str:
    """Get an S3 config from env var, or fall back to the empty string.

    Environment variables take precedence over database settings so that
    Render / Fly.io users can configure R2 without a persistent Disk.
    """
    env_map = {
        "s3_region": "MURMUR_S3_REGION",
        "s3_bucket": "MURMUR_S3_BUCKET",
        "s3_access_key": "MURMUR_S3_ACCESS_KEY",
        "s3_secret_key": "MURMUR_S3_SECRET_KEY",
        "s3_endpoint": "MURMUR_S3_ENDPOINT",
        "storage_backend": "MURMUR_STORAGE_BACKEND",
        "storage_provider": "MURMUR_STORAGE_PROVIDER",
    }
    env_name = env_map.get(key)
    if env_name:
        val = os.environ.get(env_name)
        if val:
            return val
    return default


def get_storage(db=None) -> StorageBackend:
    """Return the configured storage backend instance (cached).

    Reads storage_backend and storage_provider from system settings.
    Falls back to LocalStorage if S3 is requested but boto3 is not installed
    or configuration is incomplete.

    *Environment variables take precedence over database settings.*
    This lets Render free-tier users skip the paid Disk — just set
    MURMUR_S3_BUCKET, MURMUR_S3_ACCESS_KEY, etc. in the Render dashboard.
    """
    global _storage_instance, _storage_cache_key

    from backend.main import get_setting  # local import to avoid cycle

    _raw = _s3_env("storage_backend") or get_setting("storage_backend", "local", db=db)
    backend_name = (_raw or "local").lower()
    _raw = _s3_env("storage_provider") or get_setting("storage_provider", "custom", db=db)
    provider = (_raw or "custom").lower()

    # Cache key includes both backend and provider (and relevant S3 config) so
    # that changing settings causes a fresh instance on next call.
    cache_key = f"{backend_name}:{provider}"
    if backend_name == "s3":
        # Include enough config to detect meaningful changes.
        region = _s3_env("s3_region") or get_setting("s3_region", "", db=db)
        bucket = _s3_env("s3_bucket") or get_setting("s3_bucket", "", db=db)
        cache_key = f"{backend_name}:{provider}:{region}:{bucket}"

    if _storage_instance is not None and _storage_cache_key == cache_key:
        return _storage_instance

    if backend_name == "s3":
        endpoint = _s3_env("s3_endpoint") or get_setting("s3_endpoint", "", db=db)
        bucket = _s3_env("s3_bucket") or get_setting("s3_bucket", "", db=db)
        access_key = _s3_env("s3_access_key") or get_setting("s3_access_key", "", db=db)
        secret_key = _s3_env("s3_secret_key") or get_setting("s3_secret_key", "", db=db)
        region = _s3_env("s3_region") or get_setting("s3_region", "", db=db)
        if not bucket:
            # Misconfigured; fall back to local
            _storage_instance = LocalStorage()
            _storage_cache_key = "local"
            return _storage_instance
        # Resolve endpoint from provider preset
        effective_endpoint = _build_s3_endpoint(provider, region, endpoint)
        # Determine path style from preset
        preset = S3_PROVIDER_PRESETS.get(provider, S3_PROVIDER_PRESETS["custom"])
        use_path_style = bool(preset.get("path_style", False))
        # Cloudflare R2 uses "auto" as the boto3 region_name
        s3_region = "auto" if provider == "cloudflare" else region
        try:
            _storage_instance = S3Storage(
                endpoint=effective_endpoint,
                bucket=bucket,
                access_key=access_key,
                secret_key=secret_key,
                region=s3_region,
                provider=provider,
                use_path_style=use_path_style,
            )
            _storage_cache_key = cache_key
            return _storage_instance
        except ImportError:
            # boto3 not installed; fall back to local
            _storage_instance = LocalStorage()
            _storage_cache_key = "local"
            return _storage_instance

    _storage_instance = LocalStorage()
    _storage_cache_key = "local"
    return _storage_instance


def reset_storage_cache():
    """Reset the cached storage instance (used when settings change)."""
    global _storage_instance, _storage_cache_key
    _storage_instance = None
    _storage_cache_key = None


def get_provider_presets() -> dict:
    """Return S3 provider preset metadata for the frontend settings form."""
    result = {}
    for key, preset in S3_PROVIDER_PRESETS.items():
        result[key] = {
            "label": preset.get("label", key),
            "region_required": preset.get("region_required", False),
            "region_hint": preset.get("region_hint", ""),
            "path_style": preset.get("path_style", False),
            "endpoint_tpl": preset.get("endpoint_tpl", ""),
        }
    return result
