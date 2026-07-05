"""Shared utility functions for the Murmur backend.

Contains storage helpers, security utilities, formatting, settings cache,
view tracking, transcode queue, media helpers, and tag helpers used across
multiple router modules.
"""
import hashlib
import json
import os
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from fastapi import HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models import (
    DEFAULT_SETTINGS,
    MEDIA_DIR,
    Category,
    Comment,
    PlaySession,
    Post,
    PostTag,
    Subtitle,
    SystemSetting,
    Tag,
    User,
    UserFavorite,
    engine,
)
from backend.storage import LocalStorage, get_storage


# ─── Storage helpers (PRD-019) ───
def _storage_is_s3() -> bool:
    """Return True if the active storage backend is S3."""
    try:
        return get_storage().backend_name() == "s3"
    except Exception:
        return False


def _rel_from_url(url: str) -> str:
    """Convert a stored file_path like 'media/audio/abc.mp3' to 'audio/abc.mp3'."""
    if url and url.startswith("media/"):
        return url[len("media/"):]
    return url or ""


def _promote_to_storage(local_abs_path: str, rel_path: str):
    """Upload a local file to the storage backend if it's S3.

    For LocalStorage this is a no-op (file is already in place).
    For S3Storage this reads the local file and uploads it.
    """
    try:
        storage = get_storage()
    except Exception:
        return
    if storage.backend_name() != "s3":
        return
    if not os.path.exists(local_abs_path):
        return
    try:
        with open(local_abs_path, "rb") as f:
            storage.save(rel_path, f.read())
    except Exception as e:
        print(f"[storage] promote to S3 failed for {rel_path}: {e}", flush=True)


def _delete_from_storage(rel_path: str):
    """Delete a file from the storage backend. No-op if file missing."""
    try:
        storage = get_storage()
        storage.delete(rel_path)
    except Exception as e:
        print(f"[storage] delete failed for {rel_path}: {e}", flush=True)


def _safe_rel_path(rel_path: str) -> str:
    """Sanitize a relative media path to prevent directory traversal.

    Rejects paths containing '..' segments and ensures the resolved
    absolute path stays within MEDIA_DIR for local storage.
    """
    if not rel_path:
        raise HTTPException(404)
    # Block obvious traversal attempts early
    parts = rel_path.replace("\\", "/").split("/")
    if any(p == ".." for p in parts):
        raise HTTPException(404)
    return rel_path


def _serve_media(rel_path: str, request: Request, content_type: str):
    """Serve a media file from the active storage backend.

    - LocalStorage: stream from disk with Range support.
    - S3Storage: 302 redirect to a presigned URL (efficient, no proxying).
    """
    rel_path = _safe_rel_path(rel_path)

    try:
        storage = get_storage()
    except Exception:
        storage = LocalStorage()

    if storage.backend_name() == "s3":
        # Presigned URL redirect — S3 serves bytes directly.
        url = storage.presigned_url(rel_path, expires=3600)
        return Response(status_code=302, headers={"Location": url, "Cache-Control": "private, max-age=300"})

    # Local: stream with Range support.
    full_path = storage.abs_path(rel_path)
    # Defense-in-depth: verify resolved path stays within MEDIA_DIR
    real_media = os.path.realpath(MEDIA_DIR)
    real_full = os.path.realpath(full_path)
    if not real_full.startswith(real_media + os.sep) and real_full != real_media:
        raise HTTPException(404)
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(404)
    return stream_file(full_path, request, content_type)

# ─── View count anti-spam ───
_view_history = {}  # {(post_id, ip): timestamp}
_view_lock = threading.Lock()


def should_count_view(post_id: int, ip: str) -> bool:
    key = (post_id, ip)
    now = time.time()
    with _view_lock:
        last = _view_history.get(key, 0)
        if now - last < 300:  # 5 min cooldown per IP
            return False
        _view_history[key] = now
    return True


# ─── Rate limiting (brute-force protection) ───
_rate_limit_store: dict = {}  # {(ip, action): [timestamps...]}
_rate_limit_lock = threading.Lock()

def _check_rate_limit(request: Request, action: str, max_attempts: int = 5, window: int = 300):
    """Simple in-memory rate limiter.

    Raises 429 if `max_attempts` requests are made within `window` seconds.
    `action` is a logical label (e.g. 'login', 'register') to scope limits.
    Thread-safe via _rate_limit_lock.
    """
    ip = request.client.host if request.client else "unknown"
    key = (ip, action)
    now = time.time()
    with _rate_limit_lock:
        # Prune old entries
        timestamps = [t for t in _rate_limit_store.get(key, []) if now - t < window]
        if len(timestamps) >= max_attempts:
            retry_after = int(window - (now - timestamps[0]))
            raise HTTPException(
                429,
                f"请求过于频繁，请在 {max(retry_after, 1)} 秒后重试",
                headers={"Retry-After": str(max(retry_after, 1))},
            )
        timestamps.append(now)
        _rate_limit_store[key] = timestamps


def _validate_password(password: str) -> None:
    """Validate password strength. Raises HTTPException(400) on failure.

    Rules:
      - At least 8 characters
      - Must contain at least one letter and one digit
    """
    if len(password) < 8:
        raise HTTPException(400, "密码至少8个字符")
    if not any(c.isalpha() for c in password):
        raise HTTPException(400, "密码必须包含至少一个字母")
    if not any(c.isdigit() for c in password):
        raise HTTPException(400, "密码必须包含至少一个数字")


def fmt_post(p, user=None, db=None):
    favorite_count = db.query(UserFavorite).filter(UserFavorite.post_id == p.id).count() if db else 0
    comment_count = db.query(Comment).filter(Comment.post_id == p.id).count() if db else 0
    subtitle_count = db.query(Subtitle).filter(Subtitle.post_id == p.id).count() if db else 0
    is_favorited = False
    if user and db:
        is_favorited = db.query(UserFavorite).filter(
            UserFavorite.post_id == p.id, UserFavorite.user_id == user.id
        ).first() is not None
    tags = []
    if db:
        pt_rows = db.query(Tag).join(PostTag).filter(PostTag.post_id == p.id).order_by(Tag.name).all()
        tags = [{"id": t.id, "name": t.name, "use_count": t.use_count} for t in pt_rows]
    author = None
    if p.user:
        author = {"id": p.user.id, "username": p.user.username}
    # PRD-021: avg completion ratio across play sessions
    avg_completion_ratio = 0
    if db:
        avg_completion_ratio = float(
            db.query(func.avg(PlaySession.completion_ratio)).filter(PlaySession.post_id == p.id).scalar() or 0
        )
    return {
        "id": p.id, "title": p.title,
        "description": p.description if hasattr(p, 'description') else "",
        "file_type": p.file_type, "duration": p.duration,
        "cover_image": p.cover_image, "views": p.views,
        "favorite_count": favorite_count, "is_favorited": is_favorited,
        "comment_count": comment_count,
        "subtitle_count": subtitle_count,
        "featured": bool(p.featured),
        "status": getattr(p, "status", "ready") or "ready",
        "total_play_time": float(getattr(p, "total_play_time", 0) or 0),
        "avg_completion_ratio": avg_completion_ratio,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "category": {"id": p.category.id, "name": p.category.name, "icon": p.category.icon} if p.category else None,
        "tags": tags,
        "user": author,
    }


def fmt_posts_batch(posts: list, user=None, db=None) -> list:
    """Batch-format a list of posts, avoiding N+1 queries.

    Instead of 8 queries per post (160+ for a 20-item page),
    fires 8 fixed queries total regardless of post count:
      1. favorite counts (GROUP BY)
      2. comment counts  (GROUP BY)
      3. subtitle counts (GROUP BY)
      4. user's favorited post IDs (IN)
      5. tags for all posts (JOIN + IN)
      6. avg completion ratio (GROUP BY)
      7. authors (IN on User)
      8. categories (IN on Category)
    """
    if not posts:
        return []

    post_ids = [p.id for p in posts]

    # 1. Favorite counts
    fav_counts: dict = {}
    if db:
        for pid, cnt in (db.query(UserFavorite.post_id, func.count(UserFavorite.id))
                         .filter(UserFavorite.post_id.in_(post_ids))
                         .group_by(UserFavorite.post_id).all()):
            fav_counts[pid] = cnt

    # 2. Comment counts
    comment_counts: dict = {}
    if db:
        for pid, cnt in (db.query(Comment.post_id, func.count(Comment.id))
                         .filter(Comment.post_id.in_(post_ids))
                         .group_by(Comment.post_id).all()):
            comment_counts[pid] = cnt

    # 3. Subtitle counts
    subtitle_counts: dict = {}
    if db:
        for pid, cnt in (db.query(Subtitle.post_id, func.count(Subtitle.id))
                         .filter(Subtitle.post_id.in_(post_ids))
                         .group_by(Subtitle.post_id).all()):
            subtitle_counts[pid] = cnt

    # 4. User's favorites for these posts
    favorited_ids: set = set()
    if user and db:
        for (pid,) in (db.query(UserFavorite.post_id)
                       .filter(UserFavorite.user_id == user.id,
                               UserFavorite.post_id.in_(post_ids)).all()):
            favorited_ids.add(pid)

    # 5. Tags: batch via JOIN
    tags_map: dict = {pid: [] for pid in post_ids}
    if db:
        rows = (db.query(PostTag.post_id, Tag.id, Tag.name, Tag.use_count)
                .join(Tag, PostTag.tag_id == Tag.id)
                .filter(PostTag.post_id.in_(post_ids))
                .order_by(PostTag.post_id, Tag.name).all())
        for pid, tid, tname, tcount in rows:
            tags_map.setdefault(pid, []).append(
                {"id": tid, "name": tname, "use_count": tcount})

    # 6. Avg completion ratio
    completion_map: dict = {}
    if db:
        for pid, ratio in (db.query(PlaySession.post_id,
                                    func.avg(PlaySession.completion_ratio))
                           .filter(PlaySession.post_id.in_(post_ids))
                           .group_by(PlaySession.post_id).all()):
            completion_map[pid] = float(ratio) if ratio else 0

    # 7. Authors: batch fetch
    author_map: dict = {}
    user_ids = {p.user_id for p in posts if p.user_id}
    if user_ids and db:
        for u in db.query(User).filter(User.id.in_(user_ids)).all():
            author_map[u.id] = {"id": u.id, "username": u.username}

    # 8. Categories: batch fetch
    cat_map: dict = {}
    cat_ids = {p.category_id for p in posts if p.category_id}
    if cat_ids and db:
        for c in db.query(Category).filter(Category.id.in_(cat_ids)).all():
            cat_map[c.id] = {"id": c.id, "name": c.name, "icon": c.icon}

    # Assemble results — zero additional queries from here on
    results = []
    for p in posts:
        results.append({
            "id": p.id,
            "title": p.title,
            "description": p.description if hasattr(p, "description") else "",
            "file_type": p.file_type,
            "duration": p.duration,
            "cover_image": p.cover_image,
            "views": p.views,
            "favorite_count": fav_counts.get(p.id, 0),
            "is_favorited": p.id in favorited_ids,
            "comment_count": comment_counts.get(p.id, 0),
            "subtitle_count": subtitle_counts.get(p.id, 0),
            "featured": bool(p.featured),
            "status": getattr(p, "status", "ready") or "ready",
            "total_play_time": float(getattr(p, "total_play_time", 0) or 0),
            "avg_completion_ratio": completion_map.get(p.id, 0),
            "created_at": p.created_at.isoformat(),
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            "category": cat_map.get(p.category_id) if p.category_id else None,
            "tags": tags_map.get(p.id, []),
            "user": author_map.get(p.user_id) if p.user_id else None,
        })
    return results


# ─── PRD-018: Async Transcode Queue ───
_transcode_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="transcode")
# Track in-flight transcode start times for timeout monitoring
_transcode_starts: dict = {}
_transcode_lock = threading.Lock()
_TRANSCODE_TIMEOUT_SECONDS = 1800  # 30 minutes


def _update_post_status(post_id: int, status: str, file_size: int | None = None):
    """Update a post's status (and optionally file_size) in a fresh session."""
    db_session = Session(bind=engine)
    try:
        p = db_session.query(Post).filter(Post.id == post_id).first()
        if p:
            p.status = status
            if file_size is not None:
                p.file_size = file_size
            db_session.commit()
    finally:
        db_session.close()


def transcode_task(post_id: int, file_path: str, file_type: str):
    """Background transcode task with 3 retries and 30-min overall timeout.

    Runs `compress_media` on the saved file, then marks the post as ready.
    On repeated failure or timeout, marks the post as failed.
    After successful transcode, promotes the file to S3 if that backend is active.
    """
    deadline = time.time() + _TRANSCODE_TIMEOUT_SECONDS
    with _transcode_lock:
        _transcode_starts[post_id] = time.time()
    last_err = None
    try:
        for _attempt in range(3):
            # Check overall timeout before each attempt
            if time.time() > deadline:
                _update_post_status(post_id, "failed")
                return
            try:
                compress_media(file_path, file_type)
                # Success: refresh file info and mark ready
                info = get_media_info(file_path)
                _update_post_status(post_id, "ready", file_size=info.get("size"))
                # PRD-019: promote to S3 if that backend is active
                rel = _rel_from_url(f"media/{'audio' if file_type == 'audio' else 'video'}/{os.path.basename(file_path)}")
                _promote_to_storage(file_path, rel)
                return
            except Exception as e:
                last_err = e
                continue  # retry
        # All 3 attempts failed — log last error for debugging
        if last_err:
            print(f"[transcode] post {post_id} failed after 3 retries: {last_err}")
        _update_post_status(post_id, "failed")
    finally:
        with _transcode_lock:
            _transcode_starts.pop(post_id, None)


def _submit_transcode(post_id: int, file_path: str, file_type: str):
    """Submit a transcode job to the background executor."""
    _transcode_executor.submit(transcode_task, post_id, file_path, file_type)


def _check_transcode_timeouts():
    """Mark any transcode job exceeding the timeout as failed.

    Called opportunistically from the admin status endpoint; this is a safety
    net since `compress_media` already enforces a per-call subprocess timeout.
    """
    now = time.time()
    stale_ids = []
    with _transcode_lock:
        for pid, started in list(_transcode_starts.items()):
            if now - started > _TRANSCODE_TIMEOUT_SECONDS:
                stale_ids.append(pid)
    for pid in stale_ids:
        _update_post_status(pid, "failed")


# ─── PRD-020: Sensitive word filter ───
def _get_sensitive_words(db: Session = None) -> list:
    raw = get_setting("sensitive_words", "", db=db) or ""
    return [w.strip() for w in raw.split(",") if w.strip()]


def _contains_sensitive_word(text: str, words: list) -> str | None:
    if not text or not words:
        return None
    lower = text.lower()
    for w in words:
        if w and w.lower() in lower:
            return w
    return None


def _compute_content_hash(file_bytes: bytes) -> str:
    return hashlib.md5(file_bytes).hexdigest()  # noqa: S324 - content dedup, not security


# ─── Magic bytes validation (prevent disguised file uploads) ───
# Maps declared file_type → list of (signature_bytes, optional_offset)
_MAGIC_SIGNATURES = {
    'audio': [
        (b'\xff\xfb', 0),   # MP3 (MPEG-1 Layer III)
        (b'\xff\xf3', 0),   # MP3 (MPEG-2 Layer III)
        (b'\xff\xf2', 0),   # MP3 (MPEG-2.5 Layer III)
        (b'ID3', 0),         # MP3 with ID3 tag
        (b'RIFF', 0),        # WAV
        (b'fLaC', 0),        # FLAC
        (b'OggS', 0),        # OGG
        (b'\xff\xf1', 0),    # AAC (ADTS)
        (b'ftypM4A', 4),    # M4A (ftyp at offset 4)
        (b'ftypisom', 4),   # M4A variant
    ],
    'video': [
        (b'\x1a\x45\xdf\xa3', 0),  # MKV/WebM (EBML)
        (b'ftyp', 4),                # MP4/MOV (ftyp box at offset 4)
        (b'RIFF', 0),                # AVI
    ],
    'image': [
        (b'\xff\xd8\xff', 0),   # JPEG
        (b'\x89PNG', 0),         # PNG
        (b'GIF8', 0),            # GIF
        (b'RIFF', 0),            # WEBP (RIFF....WEBP)
    ],
}


def _verify_magic_bytes(data: bytes, file_type: str) -> bool:
    """Check if the file's first bytes match a known magic signature for the declared type.

    Prevents uploading malicious files with spoofed extensions (e.g., a .exe renamed to .mp3).
    """
    if not data or len(data) < 4:
        return False
    sigs = _MAGIC_SIGNATURES.get(file_type, [])
    for sig, offset in sigs:
        end = offset + len(sig)
        if len(data) >= end and data[offset:end] == sig:
            return True
    return False


# ─── System Settings Cache (PRD-007) ───
_settings_cache = None
_settings_cache_at = 0
_settings_lock = threading.Lock()


def get_settings(db: Session = None) -> dict:
    """读取系统配置（带内存缓存，5 秒过期）。线程安全。"""
    global _settings_cache, _settings_cache_at
    import time as _t
    now = _t.time()
    # Fast path: read cache without holding the lock for DB I/O
    with _settings_lock:
        if _settings_cache is not None and (now - _settings_cache_at) < 5:
            return _settings_cache
    own_session = False
    if db is None:
        db = Session(bind=engine)
        own_session = True
    try:
        rows = db.query(SystemSetting).all()
        result = dict(DEFAULT_SETTINGS)
        for r in rows:
            result[r.key] = r.value
    finally:
        if own_session:
            db.close()
    with _settings_lock:
        _settings_cache = result
        _settings_cache_at = now
    return result


def get_setting(key: str, default=None, db: Session = None) -> str:
    return get_settings(db).get(key, default)


def invalidate_settings_cache():
    global _settings_cache, _settings_cache_at
    with _settings_lock:
        _settings_cache = None
        _settings_cache_at = 0


def setting_bool(key: str, default=False, db: Session = None) -> bool:
    v = get_setting(key, "false" if not default else "true", db)
    return str(v).lower() in ("true", "1", "yes", "on")


def setting_int(key: str, default=0, db: Session = None) -> int:
    try:
        return int(get_setting(key, str(default), db))
    except (ValueError, TypeError):
        return default


# ─── Media helpers ───

def get_media_info(fp):
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size",
                           "-of", "json", fp], capture_output=True, text=True, timeout=30)
        info = json.loads(r.stdout) if r.stdout else {}
        f = info.get("format", {})
        return {"duration": float(f.get("duration", 0)), "size": int(f.get("size", 0))}
    except (subprocess.SubprocessError, OSError, ValueError, KeyError, json.JSONDecodeError):
        return {"duration": 0, "size": 0}


def gen_thumb(video_path, output_path, t=5):
    try:
        subprocess.run(["ffmpeg", "-ss", str(t), "-i", video_path, "-vframes", "1",
                       "-q:v", "2", output_path, "-y"], capture_output=True, timeout=30)
        return os.path.exists(output_path)
    except (subprocess.SubprocessError, OSError, FileNotFoundError):
        return False


def compress_media(input_path: str, file_type: str) -> str:
    """Compress media file in-place using ffmpeg. Returns the final path."""
    ext = os.path.splitext(input_path)[1].lower()
    compressed = input_path.replace(ext, f"_comp{ext}")

    if file_type == "audio":
        # Compress audio: ~128k AAC for big files (>10MB)
        if os.path.getsize(input_path) > 10 * 1024 * 1024:
            subprocess.run(["ffmpeg", "-y", "-i", input_path, "-c:a", "aac",
                           "-b:a", "128k", "-movflags", "+faststart",
                           compressed], capture_output=True, timeout=300)
            if os.path.exists(compressed) and os.path.getsize(compressed) > 0:
                os.replace(compressed, input_path)
                return input_path
    elif file_type == "video":
        # Compress video: h264 with CRF 23 for big files (>20MB)
        if os.path.getsize(input_path) > 20 * 1024 * 1024:
            subprocess.run(["ffmpeg", "-y", "-i", input_path, "-c:v", "libx264",
                           "-crf", "23", "-preset", "medium", "-c:a", "aac",
                           "-b:a", "128k", "-movflags", "+faststart",
                           compressed], capture_output=True, timeout=600)
            if os.path.exists(compressed) and os.path.getsize(compressed) > 0:
                os.replace(compressed, input_path)
    # Cleanup temp file if it exists
    if os.path.exists(compressed):
        try:
            os.remove(compressed)
        except OSError:
            pass
    return input_path


def compress_image(input_path: str, max_size=800):
    """Compress/thumbnail an image in-place using ffmpeg."""
    ext = os.path.splitext(input_path)[1].lower()
    compressed = input_path.replace(ext, f"_comp{ext}")
    subprocess.run(["ffmpeg", "-y", "-i", input_path,
                   "-vf", f"scale='min({max_size},iw)':'min({max_size},ih)':force_original_aspect_ratio=decrease",
                   "-q:v", "3", compressed], capture_output=True, timeout=30)
    if os.path.exists(compressed) and os.path.getsize(compressed) > 0:
        os.replace(compressed, input_path)
    if os.path.exists(compressed):
        try:
            os.remove(compressed)
        except OSError:
            pass
    return input_path


def stream_file(file_path: str, request: Request, content_type: str):
    """Stream a file with Range header support for large files."""
    file_size = os.path.getsize(file_path)
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
        "Content-Type": content_type,
    }

    range_header = request.headers.get("range")
    if range_header:
        start, end = 0, file_size - 1
        range_match = range_header.replace("bytes=", "").split("-")
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if len(range_match) > 1 and range_match[1] else file_size - 1
        if start >= file_size:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})
        end = min(end, file_size - 1)

        content_length = end - start + 1
        headers.update({
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(content_length),
        })

        async def iter_range():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk_size = min(8192 * 16, remaining)
                    data = f.read(chunk_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(iter_range(), status_code=206, headers=headers)
    headers["Content-Length"] = str(file_size)
    async def iter_full():
        with open(file_path, "rb") as f:
            while True:
                data = f.read(8192 * 16)
                if not data:
                    break
                yield data
    return StreamingResponse(iter_full(), status_code=200, headers=headers)


# ─── Tag helpers (used by posts + admin routers) ───

def _get_or_create_tag(db: Session, name: str) -> Tag:
    name = name.strip()
    if not name:
        return None
    t = db.query(Tag).filter(Tag.name == name).first()
    if not t:
        t = Tag(name=name)
        db.add(t)
        db.flush()
    return t


def _set_post_tags(db: Session, post_id: int, tag_names: list):
    db.query(PostTag).filter(PostTag.post_id == post_id).delete(synchronize_session=False)
    seen = set()
    for name in (tag_names or []):
        n = str(name).strip()
        if not n or n in seen:
            continue
        seen.add(n)
        t = _get_or_create_tag(db, n)
        db.add(PostTag(post_id=post_id, tag_id=t.id))
    # 更新所有涉及标签的 use_count
    all_tags = db.query(Tag).all()
    for t in all_tags:
        t.use_count = db.query(PostTag).filter(PostTag.tag_id == t.id).count()
    db.flush()
