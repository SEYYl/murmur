import os, uuid, shutil, subprocess, json, time, mimetypes, zipfile, io, hashlib, threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func

from backend.models import (
    init_db, get_db, engine, Category, Post, User, UserFavorite, PlayHistory,
    SystemSetting, DEFAULT_SETTINGS, Tag, PostTag, Playlist, PlaylistItem,
    Comment, Subtitle, Report, PlaySession, MEDIA_DIR, UPLOAD_DIR, ALLOWED_EXTS,
)
from backend.auth import hash_password, verify_password, create_access_token, get_current_user, require_creator, require_admin, get_token
from backend.storage import get_storage, reset_storage_cache, LocalStorage


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


def _serve_media(rel_path: str, request: Request, content_type: str):
    """Serve a media file from the active storage backend.

    - LocalStorage: stream from disk with Range support.
    - S3Storage: 302 redirect to a presigned URL (efficient, no proxying).
    """
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
    if not os.path.exists(full_path):
        raise HTTPException(404)
    return stream_file(full_path, request, content_type)

# ─── View count anti-spam ───
_view_history = {}  # {(post_id, ip): timestamp}

def should_count_view(post_id: int, ip: str) -> bool:
    key = (post_id, ip)
    last = _view_history.get(key, 0)
    now = time.time()
    if now - last < 300:  # 5 min cooldown per IP
        return False
    _view_history[key] = now
    return True


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


def optional_user(request: Request, db: Session = Depends(get_db)):
    from jose import JWTError, jwt
    from backend.auth import SECRET_KEY, ALGORITHM
    token = get_token(request)
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = int(payload.get("sub", 0))
        u = db.query(User).filter(User.id == uid, User.status == "active").first()
        return u
    except (JWTError, ValueError, TypeError):
        return None


# ─── PRD-018: Async Transcode Queue ───
_transcode_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="transcode")
# Track in-flight transcode start times for timeout monitoring
_transcode_starts: dict = {}
_transcode_lock = threading.Lock()
_TRANSCODE_TIMEOUT_SECONDS = 1800  # 30 minutes


def _update_post_status(post_id: int, status: str, file_size: Optional[int] = None):
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
        for attempt in range(3):
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
        # All 3 attempts failed
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


def _contains_sensitive_word(text: str, words: list) -> Optional[str]:
    if not text or not words:
        return None
    lower = text.lower()
    for w in words:
        if w and w.lower() in lower:
            return w
    return None


def _compute_content_hash(file_bytes: bytes) -> str:
    return hashlib.md5(file_bytes).hexdigest()


# ─── System Settings Cache (PRD-007) ───
_settings_cache = None
_settings_cache_at = 0


def get_settings(db: Session = None) -> dict:
    """读取系统配置（带内存缓存，5 秒过期）"""
    global _settings_cache, _settings_cache_at
    import time as _t
    now = _t.time()
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
    _settings_cache = result
    _settings_cache_at = now
    return result


def get_setting(key: str, default=None, db: Session = None) -> str:
    return get_settings(db).get(key, default)


def invalidate_settings_cache():
    global _settings_cache, _settings_cache_at
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


app = FastAPI(title="ASMR")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"], expose_headers=["*"])

os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
for d in ["audio", "video", "covers", "subtitles"]:
    os.makedirs(os.path.join(MEDIA_DIR, d), exist_ok=True)

frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")


# ─── Helpers ───

def get_media_info(fp):
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size",
                           "-of", "json", fp], capture_output=True, text=True, timeout=30)
        info = json.loads(r.stdout) if r.stdout else {}
        f = info.get("format", {})
        return {"duration": float(f.get("duration", 0)), "size": int(f.get("size", 0))}
    except:
        return {"duration": 0, "size": 0}


def gen_thumb(video_path, output_path, t=5):
    try:
        subprocess.run(["ffmpeg", "-ss", str(t), "-i", video_path, "-vframes", "1",
                       "-q:v", "2", output_path, "-y"], capture_output=True, timeout=30)
        return os.path.exists(output_path)
    except:
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
        except:
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
        except:
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
    else:
        headers["Content-Length"] = str(file_size)
        async def iter_full():
            with open(file_path, "rb") as f:
                while True:
                    data = f.read(8192 * 16)
                    if not data:
                        break
                    yield data
        return StreamingResponse(iter_full(), status_code=200, headers=headers)



@app.on_event("startup")
def startup():
    init_db()


# ─── Media serving with Range + Cache ───
@app.get("/media/audio/{filename}")
async def serve_audio(filename: str, request: Request):
    return _serve_media(f"audio/{filename}", request, "audio/mpeg")


@app.get("/media/video/{filename}")
async def serve_video(filename: str, request: Request, user: User = Depends(get_current_user)):
    return _serve_media(f"video/{filename}", request, "video/mp4")


@app.get("/media/covers/{filename}")
async def serve_cover(filename: str, request: Request):
    return _serve_media(f"covers/{filename}", request, "image/jpeg")


@app.get("/media/subtitles/{filename}")
async def serve_subtitle(filename: str, request: Request):
    return _serve_media(f"subtitles/{filename}", request, "text/vtt")


# ─── Auth ───

@app.post("/api/register")
def register(data: dict, db: Session = Depends(get_db)):
    if not setting_bool("registration_enabled", default=True, db=db):
        raise HTTPException(403, "注册已关闭")
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or len(username) < 2:
        raise HTTPException(400, "用户名至少2个字符")
    if len(password) < 4:
        raise HTTPException(400, "密码至少4个字符")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(400, "用户名已存在")
    default_role = get_setting("default_user_role", "user", db=db)
    if default_role not in ("user", "creator", "admin"):
        default_role = "user"
    user = User(username=username, password_hash=hash_password(password), role=default_role)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id})
    return {"token": token, "user": {"id": user.id, "username": user.username, "role": user.role}}


@app.post("/api/login")
def login(data: dict, db: Session = Depends(get_db)):
    username = data.get("username", "").strip()
    password = data.get("password", "")
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(401, "用户名或密码错误")
    if user.status == "banned":
        raise HTTPException(403, "账号已被封禁，请联系管理员")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    token = create_access_token({"sub": user.id})
    return {"token": token, "user": {"id": user.id, "username": user.username, "role": user.role, "status": user.status}}


@app.get("/api/me")
def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "role": user.role}


@app.post("/api/change-password")
def change_password(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    old_pw = data.get("old_password", "")
    new_pw = data.get("new_password", "")
    if not verify_password(old_pw, user.password_hash):
        raise HTTPException(400, "原密码错误")
    if len(new_pw) < 4:
        raise HTTPException(400, "新密码至少4个字符")
    user.password_hash = hash_password(new_pw)
    db.commit()
    return {"ok": True, "message": "密码已修改"}


# ─── Categories ───
@app.get("/api/categories")
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.sort_order).all()
    return [{"id": c.id, "name": c.name, "icon": c.icon,
             "post_count": db.query(Post).filter(Post.category_id == c.id).count()} for c in cats]


@app.post("/api/categories")
def create_category(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = data.get("name", "").strip()
    icon = data.get("icon", "🎵").strip()
    if not name: raise HTTPException(400, "分类名不能为空")
    if db.query(Category).filter(Category.name == name).first(): raise HTTPException(400, "分类已存在")
    mo = db.query(Category).order_by(Category.sort_order.desc()).first()
    cat = Category(name=name, icon=icon, sort_order=(mo.sort_order + 1 if mo else 1))
    db.add(cat); db.commit(); db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "icon": cat.icon, "sort_order": cat.sort_order}


@app.put("/api/categories/{cid}")
def update_category(cid: int, data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cid).first()
    if not cat: raise HTTPException(404, "分类不存在")
    name = data.get("name", "").strip()
    icon = data.get("icon", "").strip()
    if name and name != cat.name:
        if db.query(Category).filter(Category.name == name).first(): raise HTTPException(400, "分类名已存在")
        cat.name = name
    if icon: cat.icon = icon
    if "sort_order" in data: cat.sort_order = int(data["sort_order"])
    db.commit()
    return {"id": cat.id, "name": cat.name, "icon": cat.icon}


@app.delete("/api/categories/{cid}")
def delete_category(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cid).first()
    if not cat: raise HTTPException(404, "分类不存在")
    count = db.query(Post).filter(Post.category_id == cid).count()
    if count > 0: raise HTTPException(400, f"该分类下有 {count} 个内容，无法删除")
    db.delete(cat); db.commit()
    return {"ok": True}


# ─── Posts (list public, detail public but hides file_path) ───
@app.get("/api/posts")
def list_posts(
    category_id: int = Query(None), search: str = Query(None),
    sort: str = Query("latest"), page: int = Query(1, ge=1),
    db: Session = Depends(get_db), user: User = Depends(optional_user)
):
    q = db.query(Post)
    if category_id:
        q = q.filter(Post.category_id == category_id)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Post.title.ilike(like), Post.description.ilike(like)))
    # PRD-018: hide non-ready posts unless viewer is owner or admin
    if user is None:
        q = q.filter(Post.status == "ready")
    elif user.role == "admin":
        pass  # admin sees everything
    else:
        # logged-in non-admin: see ready posts OR their own posts
        q = q.filter(or_(Post.status == "ready", Post.user_id == user.id))

    if sort == "popular":
        # PRD-021: weighted score = views*0.4 + favorites*0.3 + completion_ratio*0.3
        # Compute via SQL subqueries so ordering is correct before pagination.
        fav_sub = db.query(func.count(UserFavorite.id)).filter(
            UserFavorite.post_id == Post.id
        ).scalar_subquery()
        comp_sub = db.query(func.avg(PlaySession.completion_ratio)).filter(
            PlaySession.post_id == Post.id
        ).scalar_subquery()
        score = (Post.views * 0.4 + func.coalesce(fav_sub, 0) * 0.3 + func.coalesce(comp_sub, 0) * 0.3)
        q = q.order_by(desc(score))
    else:
        q = q.order_by(desc(Post.created_at))
    total = q.count()
    posts = q.offset((page - 1) * 20).limit(20).all()
    return {"items": [fmt_post(p, user=user, db=db) for p in posts], "total": total, "page": page,
            "total_pages": max(1, (total + 19) // 20)}


@app.get("/api/posts/featured")
def featured_posts(limit: int = Query(10, ge=1, le=50),
                   db: Session = Depends(get_db), user: User = Depends(optional_user)):
    posts = db.query(Post).filter(Post.featured == True, Post.status == "ready").order_by(
        desc(Post.created_at)
    ).limit(limit).all()
    return {"items": [fmt_post(p, user, db) for p in posts]}


@app.get("/api/posts/{post_id}")
def get_post(post_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(optional_user)):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404)
    # PRD-018: processing/failed posts only visible to owner/admin
    if getattr(p, "status", "ready") != "ready":
        if user is None or (user.role != "admin" and p.user_id != user.id):
            raise HTTPException(404)
    if should_count_view(post_id, request.client.host):
        p.views += 1
        db.commit()
    d = fmt_post(p, user=user, db=db)
    d.update({
        "description": p.description,
        "file_path": p.file_path,
        "file_size": p.file_size,
    })
    return d


# ─── Upload / Delete (auth required) ───
@app.post("/api/posts")
async def create_post(
    title: str = Form(...), description: str = Form(""), category_id: int = Form(...),
    tags: str = Form(""),
    file: UploadFile = File(...), cover: UploadFile = File(None),
    user: User = Depends(require_creator), db: Session = Depends(get_db)
):
    title = title.strip()
    description = (description or "").strip()

    # PRD-020: sensitive word filter
    sensitive_words = _get_sensitive_words(db=db)
    bad = _contains_sensitive_word(title, sensitive_words) or _contains_sensitive_word(description, sensitive_words)
    if bad:
        raise HTTPException(400, f"内容包含敏感词：{bad}")

    ext = os.path.splitext(file.filename or "")[1].lower()
    file_type = next((ft for ft, exts in ALLOWED_EXTS.items() if ext in exts), None)
    if not file_type or file_type == "image":
        raise HTTPException(400, "不支持的文件格式")

    fid = uuid.uuid4().hex
    fname = f"{fid}{ext}"
    save_path = os.path.join(UPLOAD_DIR, fname)
    content = await file.read()

    # PRD-007: 检查上传大小限制
    max_size_mb = setting_int("max_upload_size_mb", default=500, db=db)
    if max_size_mb > 0 and len(content) > max_size_mb * 1024 * 1024:
        raise HTTPException(413, f"文件过大，最大允许 {max_size_mb}MB")

    # PRD-020: compute content hash and check for duplicates
    content_hash = _compute_content_hash(content)
    existing = db.query(Post).filter(Post.content_hash == content_hash).first()
    if existing:
        raise HTTPException(409, "内容已存在（文件哈希重复）")

    with open(save_path, "wb") as f:
        f.write(content)

    info = get_media_info(save_path)
    subdir = "audio" if file_type == "audio" else "video"
    final_path = os.path.join(MEDIA_DIR, subdir, fname)
    shutil.move(save_path, final_path)

    # PRD-018: cover/thumbnail generation runs on the original (uncompressed)
    # file before the async transcode task compresses it in-place.
    cover_url = ""
    if cover and cover.filename:
        ce = os.path.splitext(cover.filename)[1].lower()
        if ce in ALLOWED_EXTS['image']:
            cf = f"{fid}_cover{ce}"
            cover_path = os.path.join(MEDIA_DIR, "covers", cf)
            with open(cover_path, "wb") as f:
                f.write(await cover.read())
            # Compress cover image
            compress_image(cover_path)
            cover_url = f"media/covers/{cf}"
            # PRD-019: promote cover to S3
            _promote_to_storage(cover_path, f"covers/{cf}")
    elif file_type == "video" and info["duration"] > 0:
        tf = f"{fid}_thumb.jpg"
        thumb_path = os.path.join(MEDIA_DIR, "covers", tf)
        if gen_thumb(final_path, thumb_path, info["duration"] * 0.3):
            cover_url = f"media/covers/{tf}"
            # PRD-019: promote thumb to S3
            _promote_to_storage(thumb_path, f"covers/{tf}")

    url = f"media/{subdir}/{fname}"

    # PRD-018: create post with status=processing; transcode runs in background
    post = Post(title=title, description=description,
                file_path=url, file_type=file_type, file_size=info["size"],
                duration=info["duration"], cover_image=cover_url,
                category_id=category_id, user_id=user.id,
                status="processing", content_hash=content_hash)
    db.add(post)
    db.flush()
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    _set_post_tags(db, post.id, tag_list)
    db.commit()
    db.refresh(post)

    # Submit background transcode (compress_media + status update)
    _submit_transcode(post.id, final_path, file_type)

    return {"id": post.id, "title": post.title, "file_type": post.file_type, "status": post.status}


@app.delete("/api/posts/{post_id}")
def delete_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404)
    if user.role != "admin" and p.user_id != user.id:
        raise HTTPException(403, "无权限删除此内容")
    # PRD-019: delete from storage backend (works for both local & S3)
    if p.file_path:
        _delete_from_storage(_rel_from_url(p.file_path))
        # Also remove local file if present (for S3 mode, local may still exist)
        abs_path = os.path.join(MEDIA_DIR, *p.file_path.split("/")[1:])
        if os.path.exists(abs_path):
            try:
                os.remove(abs_path)
            except OSError:
                pass
    if p.cover_image:
        _delete_from_storage(_rel_from_url(p.cover_image))
        cp = os.path.join(MEDIA_DIR, "covers", os.path.basename(p.cover_image))
        if os.path.exists(cp):
            try:
                os.remove(cp)
            except OSError:
                pass
    db.delete(p)
    db.commit()
    return {"ok": True}


# ─── Favorites (PRD-001) ───
@app.post("/api/posts/{post_id}/favorite")
def toggle_favorite(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404, "内容不存在")
    fav = db.query(UserFavorite).filter(
        UserFavorite.post_id == post_id, UserFavorite.user_id == user.id
    ).first()
    if fav:
        db.delete(fav)
        favorited = False
    else:
        fav = UserFavorite(user_id=user.id, post_id=post_id)
        db.add(fav)
        favorited = True
    db.commit()
    count = db.query(UserFavorite).filter(UserFavorite.post_id == post_id).count()
    return {"favorited": favorited, "count": count}


@app.get("/api/me/favorites")
def my_favorites(
    category_id: int = Query(None), search: str = Query(None),
    sort: str = Query("time"), page: int = Query(1, ge=1),
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    q = db.query(Post).join(UserFavorite, UserFavorite.post_id == Post.id).filter(
        UserFavorite.user_id == user.id
    )
    if category_id:
        q = q.filter(Post.category_id == category_id)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Post.title.ilike(like), Post.description.ilike(like)))
    if sort == "popular":
        q = q.order_by(desc(Post.views))
    elif sort == "latest":
        q = q.order_by(desc(Post.created_at))
    else:
        q = q.order_by(desc(UserFavorite.created_at))
    total = q.count()
    posts = q.offset((page - 1) * 20).limit(20).all()
    return {"items": [fmt_post(p, user=user, db=db) for p in posts], "total": total, "page": page,
            "total_pages": max(1, (total + 19) // 20)}


# ─── Play History (PRD-002) ───
@app.post("/api/posts/{post_id}/heartbeat")
def play_heartbeat(
    post_id: int, data: dict,
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404, "内容不存在")
    position = float(data.get("position", 0))
    duration = float(data.get("duration", 0))
    rec = db.query(PlayHistory).filter(
        PlayHistory.user_id == user.id, PlayHistory.post_id == post_id
    ).first()
    if rec:
        rec.position = position
        rec.duration = duration
    else:
        rec = PlayHistory(user_id=user.id, post_id=post_id, position=position, duration=duration)
        db.add(rec)

    # PRD-021: track play session for completion ratio / play time
    session_id = data.get("session_id")
    if session_id:
        ps = db.query(PlaySession).filter(PlaySession.id == session_id).first()
        if ps and ps.post_id == post_id:
            ps.played_seconds = float(data.get("played_seconds", ps.played_seconds))
    db.commit()
    return {"ok": True}


@app.post("/api/posts/{post_id}/play-session")
def report_play_session(
    post_id: int, data: dict,
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """PRD-021: receive play session report (start/end/update)."""
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404, "内容不存在")
    action = (data.get("action") or "start").lower()
    session_id = data.get("session_id")

    if action == "start":
        ps = PlaySession(
            user_id=user.id, post_id=post_id,
            played_seconds=float(data.get("played_seconds", 0)),
        )
        db.add(ps)
        db.commit()
        db.refresh(ps)
        return {"ok": True, "session_id": ps.id}

    if session_id is None:
        raise HTTPException(400, "session_id is required for update/end actions")
    ps = db.query(PlaySession).filter(PlaySession.id == session_id).first()
    if not ps or ps.post_id != post_id:
        raise HTTPException(404, "播放会话不存在")

    played_seconds = float(data.get("played_seconds", ps.played_seconds))
    ps.played_seconds = played_seconds

    if action in ("end", "ended", "pause", "leave"):
        ps.ended_at = datetime.now(timezone.utc)
        duration = float(data.get("duration", 0)) or (p.duration or 0)
        if duration > 0:
            ps.completion_ratio = max(0.0, min(1.0, played_seconds / duration))
        # Accumulate play time onto the post
        p.total_play_time = float(p.total_play_time or 0) + played_seconds

    db.commit()
    return {
        "ok": True,
        "session_id": ps.id,
        "played_seconds": ps.played_seconds,
        "completion_ratio": ps.completion_ratio,
    }


@app.get("/api/me/history")
def my_history(
    page: int = Query(1, ge=1), category_id: int = Query(None),
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    q = db.query(Post).join(PlayHistory, PlayHistory.post_id == Post.id).filter(
        PlayHistory.user_id == user.id
    )
    if category_id:
        q = q.filter(Post.category_id == category_id)
    q = q.order_by(desc(PlayHistory.played_at))
    total = q.count()
    posts = q.offset((page - 1) * 20).limit(20).all()
    items = []
    for p in posts:
        d = fmt_post(p, user=user, db=db)
        h = db.query(PlayHistory).filter(
            PlayHistory.user_id == user.id, PlayHistory.post_id == p.id
        ).first()
        d["position"] = h.position if h else 0
        d["duration"] = h.duration if h and h.duration else p.duration
        d["played_at"] = h.played_at.isoformat() if h else None
        items.append(d)
    return {"items": items, "total": total, "page": page,
            "total_pages": max(1, (total + 19) // 20)}


@app.delete("/api/me/history/{post_id}")
def delete_history_item(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(PlayHistory).filter(
        PlayHistory.user_id == user.id, PlayHistory.post_id == post_id
    ).first()
    if h:
        db.delete(h)
        db.commit()
    return {"ok": True}


@app.delete("/api/me/history")
def clear_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(PlayHistory).filter(PlayHistory.user_id == user.id).delete()
    db.commit()
    return {"ok": True}


@app.get("/api/posts/{post_id}/resume")
def get_resume(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(PlayHistory).filter(
        PlayHistory.user_id == user.id, PlayHistory.post_id == post_id
    ).first()
    if not h or h.duration <= 0 or h.position < 15:
        return {"position": 0}
    if h.position / h.duration >= 0.95:
        return {"position": 0}
    return {"position": h.position, "duration": h.duration}


# ─── Edit Post (PRD-003) ───
@app.put("/api/posts/{post_id}")
async def update_post(
    post_id: int,
    title: str = Form(None), description: str = Form(None), category_id: int = Form(None),
    tags: str = Form(None),
    cover: UploadFile = File(None),
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404, "内容不存在")
    if user.role != "admin" and p.user_id != user.id:
        raise HTTPException(403, "无权限编辑此内容")
    if title is not None:
        title = title.strip()
        if not title:
            raise HTTPException(400, "标题不能为空")
        if len(title) > 200:
            raise HTTPException(400, "标题过长")
        p.title = title
    if description is not None:
        p.description = description.strip()
    if category_id is not None:
        cat = db.query(Category).filter(Category.id == category_id).first()
        if not cat:
            raise HTTPException(400, "分类不存在")
        p.category_id = category_id
    if tags is not None:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        _set_post_tags(db, post_id, tag_list)
    if cover and cover.filename:
        ce = os.path.splitext(cover.filename)[1].lower()
        if ce not in ALLOWED_EXTS['image']:
            raise HTTPException(400, "封面格式不支持")
        fid = uuid.uuid4().hex
        cf = f"{fid}_cover{ce}"
        cover_path = os.path.join(MEDIA_DIR, "covers", cf)
        with open(cover_path, "wb") as f:
            f.write(await cover.read())
        compress_image(cover_path)
        # PRD-019: promote new cover to S3
        _promote_to_storage(cover_path, f"covers/{cf}")
        old_cover = p.cover_image
        p.cover_image = f"media/covers/{cf}"
        if old_cover:
            _delete_from_storage(_rel_from_url(old_cover))
            cp = os.path.join(MEDIA_DIR, "covers", os.path.basename(old_cover))
            if os.path.exists(cp):
                try:
                    os.remove(cp)
                except:
                    pass
    p.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "title": p.title, "ok": True}


# ─── System Settings (PRD-007) ───
@app.get("/api/admin/settings")
def get_admin_settings(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(SystemSetting).all()
    result = dict(DEFAULT_SETTINGS)
    for r in rows:
        result[r.key] = r.value
    # 安全配置只读展示
    from backend.auth import SECRET_KEY
    result["_secret_key_is_default"] = "true" if SECRET_KEY == "asmr-secret-key-change-me" else "false"
    return result


@app.put("/api/admin/settings")
def update_admin_settings(data: dict, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    allowed = set(DEFAULT_SETTINGS.keys())
    storage_keys_touched = False
    for k, v in data.items():
        if k not in allowed:
            continue
        if k.startswith(("storage_backend", "s3_")):
            storage_keys_touched = True
        row = db.query(SystemSetting).filter(SystemSetting.key == k).first()
        if row:
            row.value = str(v)
            row.updated_by = admin.id
        else:
            db.add(SystemSetting(key=k, value=str(v), updated_by=admin.id))
    db.commit()
    invalidate_settings_cache()
    # PRD-019: reset cached storage backend so the new config takes effect
    if storage_keys_touched:
        try:
            from backend.storage import reset_storage_cache
            reset_storage_cache()
        except ImportError:
            pass
    return {"ok": True}


@app.get("/api/settings/public")
def get_public_settings(db: Session = Depends(get_db)):
    """前端公开配置（无需登录）"""
    return {
        "site_name": get_setting("site_name", "Murmur", db=db),
        "site_description": get_setting("site_description", "", db=db),
        "footer_text": get_setting("footer_text", "", db=db),
        "registration_enabled": setting_bool("registration_enabled", default=True, db=db),
    }


# ─── User Management (PRD-005) ───
def _fmt_user(u, db: Session = None):
    post_count = 0
    if db:
        post_count = db.query(Post).filter(Post.user_id == u.id).count()
    return {
        "id": u.id,
        "username": u.username,
        "role": u.role,
        "status": u.status,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "post_count": post_count,
    }


@app.get("/api/admin/users")
def list_users(
    page: int = Query(1, ge=1), search: str = Query(None),
    role: str = Query(None), status: str = Query(None),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    q = db.query(User)
    if search:
        like = f"%{search}%"
        q = q.filter(User.username.ilike(like))
    if role:
        q = q.filter(User.role == role)
    if status:
        q = q.filter(User.status == status)
    total = q.count()
    users = q.order_by(User.id.desc()).offset((page - 1) * 20).limit(20).all()
    return {"items": [_fmt_user(u, db) for u in users], "total": total, "page": page,
            "total_pages": max(1, (total + 19) // 20)}


@app.put("/api/admin/users/{user_id}/role")
def update_user_role(user_id: int, data: dict, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "用户不存在")
    new_role = data.get("role")
    if new_role not in ("admin", "creator", "user"):
        raise HTTPException(400, "无效的角色")
    if u.id == admin.id and new_role != "admin":
        raise HTTPException(400, "不能降级自己")
    u.role = new_role
    db.commit()
    return {"ok": True, "role": u.role}


@app.put("/api/admin/users/{user_id}/status")
def update_user_status(user_id: int, data: dict, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "用户不存在")
    new_status = data.get("status")
    if new_status not in ("active", "banned"):
        raise HTTPException(400, "无效的状态")
    if u.id == admin.id and new_status == "banned":
        raise HTTPException(400, "不能封禁自己")
    u.status = new_status
    db.commit()
    return {"ok": True, "status": u.status}


@app.post("/api/admin/users/{user_id}/reset-password")
def reset_user_password(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    import secrets as _s
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "用户不存在")
    new_pwd = _s.token_urlsafe(8)
    u.password_hash = hash_password(new_pwd)
    db.commit()
    return {"ok": True, "new_password": new_pwd}


# ─── Statistics Dashboard (PRD-006) ───
def _days_ago(days: int):
    from datetime import timedelta
    return (datetime.now(timezone.utc) - timedelta(days=days))


@app.get("/api/admin/stats")
def get_admin_stats(range: str = Query("7d"), admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    days_map = {"today": 1, "7d": 7, "30d": 30, "all": 9999}
    days = days_map.get(range, 7)
    since = _days_ago(days) if days < 9999 else None

    q_users = db.query(User)
    q_posts = db.query(Post)
    if since:
        q_users = q_users.filter(User.created_at >= since)
        q_posts = q_posts.filter(Post.created_at >= since)
    new_users = q_users.count()
    new_posts = q_posts.count()

    # DAU: 当天有播放心跳的用户数
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    dau = db.query(PlayHistory.user_id).filter(
        PlayHistory.played_at >= today_start
    ).distinct().count()

    # PRD-021: real play metrics from PlaySession / Post.total_play_time
    total_views = db.query(func.coalesce(func.sum(Post.views), 0)).scalar() or 0
    total_play_time = db.query(func.coalesce(func.sum(Post.total_play_time), 0)).scalar() or 0
    total_play_sessions = db.query(PlaySession).count()

    # 总用户数 & 总内容数（不限时间范围）
    total_users = db.query(User).count()
    total_posts = db.query(Post).count()

    return {
        "range": range,
        "dau": dau,
        "new_users": new_users,
        "new_posts": new_posts,
        "total_views": int(total_views),
        "total_play_time": float(total_play_time),
        "total_play_sessions": total_play_sessions,
        "total_users": total_users,
        "total_posts": total_posts,
    }


@app.get("/api/admin/stats/timeseries")
def get_stats_timeseries(
    metric: str = Query("new_posts"), days: int = Query(30, ge=1, le=365),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    from datetime import timedelta
    from collections import defaultdict
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days - 1)
    buckets = defaultdict(int)
    if metric == "new_posts":
        rows = db.query(Post.created_at).filter(Post.created_at >= _days_ago(days)).all()
        for (ts,) in rows:
            buckets[ts.date()] += 1
    elif metric == "new_users":
        rows = db.query(User.created_at).filter(User.created_at >= _days_ago(days)).all()
        for (ts,) in rows:
            buckets[ts.date()] += 1
    elif metric == "dau":
        rows = db.query(PlayHistory.user_id, PlayHistory.played_at).filter(
            PlayHistory.played_at >= _days_ago(days)
        ).all()
        seen = defaultdict(set)
        for uid, ts in rows:
            seen[ts.date()].add(uid)
        for d, s in seen.items():
            buckets[d] = len(s)
    else:
        raise HTTPException(400, "不支持的 metric")
    series = []
    cur = start
    while cur <= end:
        series.append({"date": cur.isoformat(), "value": buckets.get(cur, 0)})
        cur += timedelta(days=1)
    return {"metric": metric, "series": series}


@app.get("/api/admin/stats/top-posts")
def get_stats_top_posts(
    limit: int = Query(10, ge=1, le=50), metric: str = Query("views"),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    from sqlalchemy import func as _f
    q = db.query(Post)
    if metric == "favorites":
        q = q.outerjoin(UserFavorite).group_by(Post.id).order_by(
            _f.count(UserFavorite.id).desc(), Post.views.desc()
        )
    elif metric == "play_time":
        # PRD-021: order by accumulated play time
        q = q.order_by(desc(Post.total_play_time), desc(Post.views))
    elif metric == "completion":
        # PRD-021: order by average completion ratio
        avg_comp = db.query(_f.avg(PlaySession.completion_ratio)).filter(
            PlaySession.post_id == Post.id
        ).scalar_subquery()
        q = q.order_by(desc(_f.coalesce(avg_comp, 0)), desc(Post.views))
    else:
        q = q.order_by(Post.views.desc())
    posts = q.limit(limit).all()
    items = []
    for p in posts:
        fav_count = db.query(UserFavorite).filter(UserFavorite.post_id == p.id).count()
        avg_comp = db.query(_f.avg(PlaySession.completion_ratio)).filter(
            PlaySession.post_id == p.id
        ).scalar() or 0
        items.append({
            "id": p.id, "title": p.title, "views": p.views,
            "favorite_count": fav_count,
            "total_play_time": float(p.total_play_time or 0),
            "avg_completion_ratio": float(avg_comp),
            "category": {"name": p.category.name, "icon": p.category.icon} if p.category else None,
        })
    return {"metric": metric, "items": items}


@app.get("/api/admin/stats/category-distribution")
def get_stats_category_distribution(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from sqlalchemy import func as _f
    rows = db.query(
        Category.id, Category.name, Category.icon,
        _f.count(Post.id), _f.coalesce(_f.sum(Post.views), 0)
    ).outerjoin(Post).group_by(Category.id).all()
    items = []
    for cid, name, icon, post_count, view_sum in rows:
        items.append({
            "id": cid, "name": name, "icon": icon,
            "post_count": post_count, "view_sum": int(view_sum),
        })
    return {"items": items}


# ─── Tags (PRD-008) ───
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


@app.get("/api/tags")
def list_tags(q: str = Query(None), limit: int = Query(30, ge=1, le=100),
              sort: str = Query("popular"), db: Session = Depends(get_db)):
    query = db.query(Tag)
    if q:
        query = query.filter(Tag.name.ilike(f"%{q}%"))
    if sort == "popular":
        query = query.order_by(desc(Tag.use_count), Tag.name)
    else:
        query = query.order_by(Tag.name)
    tags = query.limit(limit).all()
    return [{"id": t.id, "name": t.name, "use_count": t.use_count} for t in tags]


@app.get("/api/tags/{tag_id}/posts")
def tag_posts(tag_id: int, page: int = Query(1, ge=1), sort: str = Query("latest"),
              db: Session = Depends(get_db), user: User = Depends(optional_user)):
    t = db.query(Tag).filter(Tag.id == tag_id).first()
    if not t:
        raise HTTPException(404, "标签不存在")
    q = db.query(Post).join(PostTag).filter(PostTag.tag_id == tag_id)
    # PRD-018: hide non-ready posts unless owner/admin
    if user is None:
        q = q.filter(Post.status == "ready")
    elif user.role == "admin":
        pass
    else:
        q = q.filter(or_(Post.status == "ready", Post.user_id == user.id))
    total = q.count()
    if sort == "popular":
        q = q.order_by(desc(Post.views))
    else:
        q = q.order_by(desc(Post.created_at))
    posts = q.offset((page - 1) * 24).limit(24).all()
    return {"tag": {"id": t.id, "name": t.name, "use_count": t.use_count},
            "items": [fmt_post(p, user, db) for p in posts],
            "total": total, "page": page, "total_pages": max(1, (total + 23) // 24)}


# ─── Playlists (PRD-009) ───
@app.get("/api/playlists")
def list_playlists(mine: bool = Query(False), user_id: int = Query(None),
                   page: int = Query(1, ge=1), db: Session = Depends(get_db),
                   user: User = Depends(optional_user)):
    q = db.query(Playlist)
    if mine and user:
        q = q.filter(Playlist.user_id == user.id)
    elif user_id:
        q = q.filter(Playlist.user_id == user_id, Playlist.is_public == True)
    else:
        q = q.filter(Playlist.is_public == True)
    total = q.count()
    pls = q.order_by(desc(Playlist.updated_at)).offset((page - 1) * 24).limit(24).all()
    items = []
    for pl in pls:
        items.append({
            "id": pl.id, "title": pl.title, "description": pl.description,
            "cover": pl.cover, "is_public": pl.is_public, "item_count": pl.item_count,
            "created_at": pl.created_at.isoformat(), "updated_at": pl.updated_at.isoformat(),
            "user": {"id": pl.user.id, "username": pl.user.username} if pl.user else None,
        })
    return {"items": items, "total": total, "page": page,
            "total_pages": max(1, (total + 23) // 24)}


@app.post("/api/playlists")
def create_playlist(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    title = (data.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "标题不能为空")
    pl = Playlist(user_id=user.id, title=title,
                  description=data.get("description", "") or "",
                  is_public=bool(data.get("is_public", False)))
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return {"id": pl.id, "title": pl.title, "description": pl.description,
            "cover": pl.cover, "is_public": pl.is_public, "item_count": 0,
            "created_at": pl.created_at.isoformat(), "updated_at": pl.updated_at.isoformat()}


@app.get("/api/playlists/{pl_id}")
def get_playlist(pl_id: int, db: Session = Depends(get_db),
                 user: User = Depends(optional_user)):
    pl = db.query(Playlist).filter(Playlist.id == pl_id).first()
    if not pl:
        raise HTTPException(404, "歌单不存在")
    if not pl.is_public and (not user or user.id != pl.user_id):
        raise HTTPException(403, "无权限查看")
    items = []
    for pi in pl.items:
        items.append(fmt_post(pi.post, user, db))
    return {
        "id": pl.id, "title": pl.title, "description": pl.description,
        "cover": pl.cover, "is_public": pl.is_public, "item_count": pl.item_count,
        "created_at": pl.created_at.isoformat(), "updated_at": pl.updated_at.isoformat(),
        "user": {"id": pl.user.id, "username": pl.user.username} if pl.user else None,
        "items": items,
    }


@app.put("/api/playlists/{pl_id}")
def update_playlist(pl_id: int, data: dict,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == pl_id).first()
    if not pl:
        raise HTTPException(404, "歌单不存在")
    if pl.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "无权限修改")
    if "title" in data and data["title"].strip():
        pl.title = data["title"].strip()
    if "description" in data:
        pl.description = data.get("description", "") or ""
    if "is_public" in data:
        pl.is_public = bool(data["is_public"])
    db.commit()
    db.refresh(pl)
    return {"ok": True, "id": pl.id, "title": pl.title, "is_public": pl.is_public}


@app.delete("/api/playlists/{pl_id}")
def delete_playlist(pl_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == pl_id).first()
    if not pl:
        raise HTTPException(404, "歌单不存在")
    if pl.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "无权限删除")
    db.delete(pl)
    db.commit()
    return {"ok": True}


@app.post("/api/playlists/{pl_id}/items/{post_id}")
def add_playlist_item(pl_id: int, post_id: int,
                      user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == pl_id).first()
    if not pl:
        raise HTTPException(404, "歌单不存在")
    if pl.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "无权限")
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(404, "内容不存在")
    existing = db.query(PlaylistItem).filter(
        PlaylistItem.playlist_id == pl_id, PlaylistItem.post_id == post_id
    ).first()
    if existing:
        return {"ok": True, "item_count": pl.item_count, "added": False}
    max_pos = db.query(func.max(PlaylistItem.position)).filter(
        PlaylistItem.playlist_id == pl_id
    ).scalar() or 0
    db.add(PlaylistItem(playlist_id=pl_id, post_id=post_id, position=max_pos + 1))
    pl.item_count += 1
    db.commit()
    return {"ok": True, "item_count": pl.item_count, "added": True}


@app.delete("/api/playlists/{pl_id}/items/{post_id}")
def remove_playlist_item(pl_id: int, post_id: int,
                         user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == pl_id).first()
    if not pl:
        raise HTTPException(404, "歌单不存在")
    if pl.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "无权限")
    item = db.query(PlaylistItem).filter(
        PlaylistItem.playlist_id == pl_id, PlaylistItem.post_id == post_id
    ).first()
    if not item:
        return {"ok": True, "item_count": pl.item_count}
    db.delete(item)
    pl.item_count = max(0, pl.item_count - 1)
    db.commit()
    return {"ok": True, "item_count": pl.item_count}


# ─── Related / Recommendations (PRD-010) ───
@app.get("/api/posts/{post_id}/related")
def related_posts(post_id: int, limit: int = Query(6, ge=1, le=20),
                  db: Session = Depends(get_db), user: User = Depends(optional_user)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(404, "内容不存在")
    # 基于同分类 + 共现标签的简单推荐
    tag_ids = [pt.tag_id for pt in db.query(PostTag).filter(PostTag.post_id == post_id).all()]
    q = db.query(Post).filter(Post.id != post_id, Post.status == "ready")
    if post.category_id:
        q = q.filter(Post.category_id == post.category_id)
    # 优先选标签共现多的
    if tag_ids:
        from sqlalchemy import func as _f
        q = q.outerjoin(PostTag).filter(PostTag.tag_id.in_(tag_ids)).group_by(Post.id)\
             .order_by(desc(_f.count(PostTag.id)), desc(Post.views))
    else:
        q = q.order_by(desc(Post.views))
    posts = q.limit(limit).all()
    if len(posts) < limit and post.category_id:
        # 如果不够，用同分类补
        have_ids = {p.id for p in posts}
        fill = db.query(Post).filter(
            Post.category_id == post.category_id, Post.id != post_id,
            Post.id.notin_(have_ids), Post.status == "ready"
        ).order_by(desc(Post.views)).limit(limit - len(posts)).all()
        posts.extend(fill)
    return {"items": [fmt_post(p, user, db) for p in posts[:limit]]}


# ─── Featured (PRD-011) ───
@app.put("/api/admin/posts/{post_id}/featured")
def set_featured(post_id: int, data: dict, admin: User = Depends(require_admin),
                 db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(404, "内容不存在")
    post.featured = bool(data.get("featured", True))
    db.commit()
    return {"ok": True, "featured": post.featured}


# ─── Comments (PRD-012) ───
@app.get("/api/posts/{post_id}/comments")
def list_comments(post_id: int, page: int = Query(1, ge=1),
                  db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(404, "内容不存在")
    q = db.query(Comment).filter(Comment.post_id == post_id)
    total = q.count()
    comments = q.order_by(desc(Comment.created_at)).offset((page - 1) * 20).limit(20).all()
    items = []
    for c in comments:
        items.append({
            "id": c.id, "content": c.content,
            "created_at": c.created_at.isoformat(),
            "user": {"id": c.user.id, "username": c.user.username} if c.user else None,
        })
    return {"items": items, "total": total, "page": page,
            "total_pages": max(1, (total + 19) // 20)}


@app.post("/api/posts/{post_id}/comments")
def create_comment(post_id: int, data: dict, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(404, "内容不存在")
    content = (data.get("content") or "").strip()
    if not content:
        raise HTTPException(400, "评论内容不能为空")
    if len(content) > 1000:
        raise HTTPException(400, "评论不能超过 1000 字")
    c = Comment(post_id=post_id, user_id=user.id, content=content)
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "content": c.content, "created_at": c.created_at.isoformat(),
            "user": {"id": user.id, "username": user.username}}


@app.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: int, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    c = db.query(Comment).filter(Comment.id == comment_id).first()
    if not c:
        raise HTTPException(404, "评论不存在")
    if c.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "无权限删除")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ─── Subtitles (PRD-015) ───
@app.post("/api/posts/{post_id}/subtitles")
async def upload_subtitle(
    post_id: int,
    language: str = Form("zh"),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404, "内容不存在")
    if user.role != "admin" and p.user_id != user.id:
        raise HTTPException(403, "无权限操作此内容")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".srt", ".vtt"):
        raise HTTPException(400, "仅支持 .srt 或 .vtt 字幕文件")
    fid = uuid.uuid4().hex
    fname = f"{fid}{ext}"
    sub_path = os.path.join(MEDIA_DIR, "subtitles", fname)
    content = await file.read()
    with open(sub_path, "wb") as f:
        f.write(content)
    # PRD-019: promote subtitle to S3
    _promote_to_storage(sub_path, f"subtitles/{fname}")
    sub = Subtitle(post_id=post_id, language=language.strip() or "zh",
                   file_path=f"media/subtitles/{fname}")
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "post_id": sub.post_id, "language": sub.language,
            "file_path": sub.file_path, "created_at": sub.created_at.isoformat()}


@app.get("/api/posts/{post_id}/subtitles")
def list_subtitles(post_id: int, db: Session = Depends(get_db)):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404, "内容不存在")
    subs = db.query(Subtitle).filter(Subtitle.post_id == post_id).order_by(
        desc(Subtitle.created_at)
    ).all()
    return {"items": [{
        "id": s.id, "post_id": s.post_id, "language": s.language,
        "file_path": s.file_path, "created_at": s.created_at.isoformat(),
    } for s in subs]}


@app.delete("/api/subtitles/{subtitle_id}")
def delete_subtitle(subtitle_id: int, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    sub = db.query(Subtitle).filter(Subtitle.id == subtitle_id).first()
    if not sub:
        raise HTTPException(404, "字幕不存在")
    post = db.query(Post).filter(Post.id == sub.post_id).first()
    if not post:
        raise HTTPException(404, "内容不存在")
    if user.role != "admin" and post.user_id != user.id:
        raise HTTPException(403, "无权限删除此字幕")
    # PRD-019: delete from storage backend
    _delete_from_storage(_rel_from_url(sub.file_path))
    abs_path = os.path.join(MEDIA_DIR, "subtitles", os.path.basename(sub.file_path))
    if os.path.exists(abs_path):
        try:
            os.remove(abs_path)
        except:
            pass
    db.delete(sub)
    db.commit()
    return {"ok": True}


# ─── Cover Frame (PRD-015) ───
@app.post("/api/posts/{post_id}/cover-frame")
def set_cover_frame(
    post_id: int, time: float = Query(0, ge=0),
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404, "内容不存在")
    if user.role != "admin" and p.user_id != user.id:
        raise HTTPException(403, "无权限操作此内容")
    if p.file_type != "video":
        raise HTTPException(400, "仅视频内容支持选帧封面")
    t = time
    video_rel = p.file_path
    # file_path 形如 "media/video/xxx.mp4"
    abs_video = os.path.join(MEDIA_DIR, *video_rel.split("/")[1:]) if video_rel.startswith("media/") else os.path.join(MEDIA_DIR, video_rel)
    if not os.path.exists(abs_video):
        raise HTTPException(404, "视频文件不存在")
    fid = uuid.uuid4().hex
    cf = f"{fid}_frame.jpg"
    cover_path = os.path.join(MEDIA_DIR, "covers", cf)
    if not gen_thumb(abs_video, cover_path, t):
        raise HTTPException(500, "封面截取失败")
    # PRD-019: promote cover frame to S3
    _promote_to_storage(cover_path, f"covers/{cf}")
    old_cover = p.cover_image
    p.cover_image = f"media/covers/{cf}"
    p.updated_at = datetime.now(timezone.utc)
    db.commit()
    if old_cover:
        _delete_from_storage(_rel_from_url(old_cover))
        cp = os.path.join(MEDIA_DIR, "covers", os.path.basename(old_cover))
        if os.path.exists(cp):
            try:
                os.remove(cp)
            except:
                pass
    return {"ok": True, "cover_image": p.cover_image}


# ─── Data Export (PRD-017) ───
@app.get("/api/me/export")
def export_my_data(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    base_url = ""
    # Posts
    posts = db.query(Post).filter(Post.user_id == user.id).order_by(desc(Post.created_at)).all()
    posts_data = []
    for p in posts:
        posts_data.append({
            "id": p.id, "title": p.title, "description": p.description,
            "file_type": p.file_type, "file_path": p.file_path,
            "duration": p.duration, "views": p.views,
            "cover_image": p.cover_image,
            "category": {"id": p.category.id, "name": p.category.name} if p.category else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    # Favorites
    fav_posts = db.query(Post).join(UserFavorite, UserFavorite.post_id == Post.id).filter(
        UserFavorite.user_id == user.id
    ).order_by(desc(UserFavorite.created_at)).all()
    favorites_data = []
    for p in fav_posts:
        favorites_data.append({
            "id": p.id, "title": p.title, "file_type": p.file_type,
            "cover_image": p.cover_image,
            "category": {"id": p.category.id, "name": p.category.name} if p.category else None,
        })
    # Playlists (with items)
    pls = db.query(Playlist).filter(Playlist.user_id == user.id).order_by(
        desc(Playlist.created_at)
    ).all()
    playlists_data = []
    for pl in pls:
        items = []
        for pi in pl.items:
            items.append({
                "post_id": pi.post_id, "title": pi.post.title if pi.post else None,
                "position": pi.position, "added_at": pi.added_at.isoformat() if pi.added_at else None,
            })
        playlists_data.append({
            "id": pl.id, "title": pl.title, "description": pl.description,
            "is_public": pl.is_public, "item_count": pl.item_count,
            "created_at": pl.created_at.isoformat() if pl.created_at else None,
            "items": items,
        })
    # History
    history_rows = db.query(PlayHistory, Post).join(Post, PlayHistory.post_id == Post.id).filter(
        PlayHistory.user_id == user.id
    ).order_by(desc(PlayHistory.played_at)).all()
    history_data = []
    for h, p in history_rows:
        history_data.append({
            "post_id": p.id, "title": p.title, "position": h.position,
            "duration": h.duration, "played_at": h.played_at.isoformat() if h.played_at else None,
        })

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("posts.json", json.dumps(posts_data, ensure_ascii=False, indent=2))
        zf.writestr("favorites.json", json.dumps(favorites_data, ensure_ascii=False, indent=2))
        zf.writestr("playlists.json", json.dumps(playlists_data, ensure_ascii=False, indent=2))
        zf.writestr("history.json", json.dumps(history_data, ensure_ascii=False, indent=2))
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="murmur-export-{user.id}.zip"'}
    )


# ─── RSS Feed (PRD-017) ───
_rss_cache = {"xml": None, "category_id": None, "at": 0}


@app.get("/api/rss.xml")
def rss_feed(request: Request, category_id: int = Query(None), db: Session = Depends(get_db)):
    if not setting_bool("rss_enabled", default=True, db=db):
        raise HTTPException(404, "RSS 已关闭")
    # 5 分钟内存缓存
    now = time.time()
    if (_rss_cache["xml"] is not None
            and _rss_cache["category_id"] == category_id
            and (now - _rss_cache["at"]) < 300):
        return Response(content=_rss_cache["xml"], media_type="application/rss+xml; charset=utf-8")

    q = db.query(Post)
    if category_id:
        q = q.filter(Post.category_id == category_id)
    posts = q.order_by(desc(Post.created_at)).limit(50).all()

    base_url = str(request.base_url).rstrip("/")
    site_name = get_setting("site_name", "Murmur", db=db)
    site_desc = get_setting("site_description", "自托管 ASMR 内容平台", db=db)

    from xml.sax.saxutils import escape
    items_xml = []
    for p in posts:
        title = escape(p.title or "")
        desc_text = escape(p.description or "")
        link = f"{base_url}/api/posts/{p.id}"
        pub_date = p.created_at.strftime("%a, %d %b %Y %H:%M:%S +0000") if p.created_at else ""
        category_str = ""
        if p.category:
            category_str = f"<category>{escape(p.category.name)}</category>"
        enclosure = ""
        if p.cover_image:
            cover_url = f"{base_url}/{p.cover_image}"
            enclosure = f"<enclosure url=\"{cover_url}\" type=\"image/jpeg\" />"
        items_xml.append(f"""
    <item>
      <title>{title}</title>
      <description>{desc_text}</description>
      <link>{link}</link>
      <guid>{link}</guid>
      <pubDate>{pub_date}</pubDate>
      {category_str}
      {enclosure}
    </item>""")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>{escape(site_name)}</title>
    <link>{base_url}</link>
    <description>{escape(site_desc)}</description>
    <language>zh-cn</language>
    <lastBuildDate>{datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")}</lastBuildDate>{''.join(items_xml)}
  </channel>
</rss>"""

    _rss_cache["xml"] = xml
    _rss_cache["category_id"] = category_id
    _rss_cache["at"] = now
    return Response(content=xml, media_type="application/rss+xml; charset=utf-8")


# ─── PRD-018: Admin Transcode Monitoring ───
@app.get("/api/admin/transcode/status")
def transcode_status(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Return counts of processing/failed posts for transcode monitoring."""
    _check_transcode_timeouts()
    processing = db.query(Post).filter(Post.status == "processing").count()
    failed = db.query(Post).filter(Post.status == "failed").count()
    ready = db.query(Post).filter(Post.status == "ready").count()
    in_flight = 0
    with _transcode_lock:
        in_flight = len(_transcode_starts)
    return {
        "processing": processing,
        "failed": failed,
        "ready": ready,
        "in_flight": in_flight,
    }


# ─── PRD-019: Storage Management ───
@app.get("/api/admin/storage/status")
def storage_status(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Return current storage backend info and file counts."""
    try:
        storage = get_storage(db=db)
        backend = storage.backend_name()
    except Exception as e:
        return {"backend": "error", "error": str(e)}
    # Count local files (always available)
    counts = {}
    for subdir in ["audio", "video", "covers", "subtitles"]:
        d = os.path.join(MEDIA_DIR, subdir)
        if os.path.isdir(d):
            counts[subdir] = len([f for f in os.listdir(d) if not f.startswith(".")])
        else:
            counts[subdir] = 0
    return {
        "backend": backend,
        "local_counts": counts,
        "s3_configured": bool(get_setting("s3_bucket", "", db=db)),
    }


@app.post("/api/admin/storage/migrate")
def storage_migrate(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Migrate existing local files to the active S3 backend.

    Walks all files under media/{audio,video,covers,subtitles}/ and uploads
    them to S3. Use this after switching from local to S3 to backfill
    pre-existing content. Idempotent — re-uploading the same key is safe.
    """
    try:
        storage = get_storage(db=db)
    except Exception as e:
        raise HTTPException(500, f"存储后端初始化失败: {e}")
    if storage.backend_name() != "s3":
        raise HTTPException(400, "当前存储后端不是 S3，无需迁移")
    migrated = 0
    failed = 0
    for subdir in ["audio", "video", "covers", "subtitles"]:
        d = os.path.join(MEDIA_DIR, subdir)
        if not os.path.isdir(d):
            continue
        for fname in os.listdir(d):
            if fname.startswith("."):
                continue
            abs_path = os.path.join(d, fname)
            if not os.path.isfile(abs_path):
                continue
            rel = f"{subdir}/{fname}"
            try:
                with open(abs_path, "rb") as f:
                    storage.save(rel, f.read())
                migrated += 1
            except Exception as e:
                print(f"[migrate] failed {rel}: {e}", flush=True)
                failed += 1
    return {"migrated": migrated, "failed": failed, "backend": "s3"}


@app.get("/api/admin/transcode/list")
def transcode_list(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """List posts that are processing or failed (optionally filtered)."""
    q = db.query(Post)
    if status in ("processing", "failed", "ready"):
        q = q.filter(Post.status == status)
    else:
        q = q.filter(Post.status.in_(("processing", "failed")))
    total = q.count()
    posts = q.order_by(desc(Post.created_at)).offset((page - 1) * 20).limit(20).all()
    return {
        "items": [fmt_post(p, user=admin, db=db) for p in posts],
        "total": total, "page": page,
        "total_pages": max(1, (total + 19) // 20),
    }


@app.post("/api/admin/transcode/{post_id}/retry")
def transcode_retry(post_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Re-trigger transcode for a failed/processing post."""
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404, "内容不存在")
    if p.status == "ready":
        raise HTTPException(400, "该内容已转码完成，无需重试")
    # Resolve the absolute file path on disk
    rel = p.file_path
    if rel.startswith("media/"):
        rel = rel[len("media/"):]
    abs_path = os.path.join(MEDIA_DIR, rel)
    if not os.path.exists(abs_path):
        raise HTTPException(404, "源文件不存在，无法重试转码")
    p.status = "processing"
    db.commit()
    _submit_transcode(p.id, abs_path, p.file_type)
    return {"ok": True, "status": "processing"}


# ─── PRD-020: Content Reports ───
@app.post("/api/reports")
def create_report(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Submit a report for a post or comment."""
    target_type = (data.get("target_type") or "").strip().lower()
    target_id = data.get("target_id")
    reason = (data.get("reason") or "").strip()
    if target_type not in ("post", "comment"):
        raise HTTPException(400, "target_type 必须为 post 或 comment")
    if not isinstance(target_id, int) or target_id <= 0:
        raise HTTPException(400, "target_id 无效")
    # Verify target exists
    if target_type == "post":
        if not db.query(Post).filter(Post.id == target_id).first():
            raise HTTPException(404, "被举报的内容不存在")
    else:
        if not db.query(Comment).filter(Comment.id == target_id).first():
            raise HTTPException(404, "被举报的评论不存在")
    if len(reason) > 1000:
        raise HTTPException(400, "举报理由不能超过 1000 字")
    rpt = Report(
        reporter_id=user.id, target_type=target_type, target_id=target_id,
        reason=reason, status="pending",
    )
    db.add(rpt)
    db.commit()
    db.refresh(rpt)
    return {
        "id": rpt.id, "target_type": rpt.target_type, "target_id": rpt.target_id,
        "reason": rpt.reason, "status": rpt.status,
        "created_at": rpt.created_at.isoformat(),
    }


@app.get("/api/admin/reports")
def list_reports(
    status: str = Query("pending"), page: int = Query(1, ge=1),
    target_type: str = Query(None),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """Admin: list reports filtered by status."""
    q = db.query(Report)
    if status in ("pending", "resolved", "dismissed"):
        q = q.filter(Report.status == status)
    if target_type in ("post", "comment"):
        q = q.filter(Report.target_type == target_type)
    total = q.count()
    reports = q.order_by(desc(Report.created_at)).offset((page - 1) * 20).limit(20).all()
    items = []
    for r in reports:
        item = {
            "id": r.id, "target_type": r.target_type, "target_id": r.target_id,
            "reason": r.reason, "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            "resolved_by": r.resolved_by,
            "reporter": {"id": r.reporter.id, "username": r.reporter.username} if r.reporter else None,
        }
        # Attach target snapshot
        if r.target_type == "post":
            tp = db.query(Post).filter(Post.id == r.target_id).first()
            item["target"] = {"id": tp.id, "title": tp.title, "status": tp.status} if tp else None
        else:
            tc = db.query(Comment).filter(Comment.id == r.target_id).first()
            item["target"] = {"id": tc.id, "content": (tc.content or "")[:200]} if tc else None
        items.append(item)
    return {"items": items, "total": total, "page": page,
            "total_pages": max(1, (total + 19) // 20)}


@app.put("/api/admin/reports/{report_id}")
def resolve_report(
    report_id: int, data: dict,
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """Admin: resolve or dismiss a report. Optionally delete the target content
    or ban the reported user."""
    rpt = db.query(Report).filter(Report.id == report_id).first()
    if not rpt:
        raise HTTPException(404, "举报记录不存在")
    new_status = (data.get("status") or "").strip().lower()
    if new_status not in ("resolved", "dismissed"):
        raise HTTPException(400, "status 必须为 resolved 或 dismissed")
    action = (data.get("action") or "").strip().lower()  # delete_content / ban_user / none

    if action == "delete_content":
        if rpt.target_type == "post":
            tp = db.query(Post).filter(Post.id == rpt.target_id).first()
            if tp:
                # PRD-019: delete from storage backend
                if tp.file_path:
                    _delete_from_storage(_rel_from_url(tp.file_path))
                    abs_path = os.path.join(MEDIA_DIR, *tp.file_path.split("/")[1:]) if tp.file_path else ""
                    if abs_path and os.path.exists(abs_path):
                        try:
                            os.remove(abs_path)
                        except OSError:
                            pass
                if tp.cover_image:
                    _delete_from_storage(_rel_from_url(tp.cover_image))
                    cp = os.path.join(MEDIA_DIR, "covers", os.path.basename(tp.cover_image))
                    if os.path.exists(cp):
                        try:
                            os.remove(cp)
                        except OSError:
                            pass
                db.delete(tp)
        elif rpt.target_type == "comment":
            tc = db.query(Comment).filter(Comment.id == rpt.target_id).first()
            if tc:
                db.delete(tc)
    elif action == "ban_user":
        # Ban the owner of the reported content
        if rpt.target_type == "post":
            tp = db.query(Post).filter(Post.id == rpt.target_id).first()
            if tp and tp.user_id:
                u = db.query(User).filter(User.id == tp.user_id).first()
                if u and u.role != "admin":
                    u.status = "banned"
        elif rpt.target_type == "comment":
            tc = db.query(Comment).filter(Comment.id == rpt.target_id).first()
            if tc:
                u = db.query(User).filter(User.id == tc.user_id).first()
                if u and u.role != "admin":
                    u.status = "banned"

    rpt.status = new_status
    rpt.resolved_at = datetime.now(timezone.utc)
    rpt.resolved_by = admin.id
    db.commit()
    return {"ok": True, "status": rpt.status, "action": action or "none"}


# ─── PRD-021: Completion & Play Time Analytics ───
@app.get("/api/admin/stats/top-completion")
def stats_top_completion(
    limit: int = Query(10, ge=1, le=50),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """Top N posts by average completion ratio."""
    from sqlalchemy import func as _f
    rows = db.query(
        PlaySession.post_id,
        _f.avg(PlaySession.completion_ratio).label("avg_comp"),
        _f.count(PlaySession.id).label("session_count"),
    ).group_by(PlaySession.post_id).order_by(desc("avg_comp")).limit(limit).all()
    items = []
    for post_id, avg_comp, session_count in rows:
        p = db.query(Post).filter(Post.id == post_id).first()
        if not p:
            continue
        items.append({
            "id": p.id, "title": p.title, "views": p.views,
            "total_play_time": float(p.total_play_time or 0),
            "avg_completion_ratio": float(avg_comp or 0),
            "session_count": int(session_count or 0),
            "category": {"name": p.category.name, "icon": p.category.icon} if p.category else None,
        })
    return {"metric": "completion", "items": items}


@app.get("/api/admin/stats/play-time-trend")
def stats_play_time_trend(
    days: int = Query(30, ge=1, le=365),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """Daily total play time trend based on PlaySession.started_at."""
    from datetime import timedelta
    from sqlalchemy import func as _f
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days - 1)
    rows = db.query(
        PlaySession.started_at, _f.sum(PlaySession.played_seconds)
    ).filter(PlaySession.started_at >= _days_ago(days)).group_by(
        _f.date(PlaySession.started_at)
    ).all()
    buckets = {}
    for ts, total in rows:
        d = ts.date() if hasattr(ts, "date") else ts
        buckets[d] = float(total or 0)
    series = []
    cur = start
    while cur <= end:
        series.append({"date": cur.isoformat(), "value": buckets.get(cur, 0.0)})
        cur += timedelta(days=1)
    return {"metric": "play_time", "series": series}


# ─── Frontend SPA ───
@app.get("/{full_path:path}")
def serve(full_path: str):
    ip = os.path.join(frontend_path, "index.html")
    return FileResponse(ip) if os.path.exists(ip) else JSONResponse({"error": "not found"}, 404)
