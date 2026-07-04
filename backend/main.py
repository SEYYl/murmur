import os, uuid, shutil, subprocess, json, time, mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from backend.models import init_db, get_db, Category, Post, User, UserFavorite, PlayHistory, SystemSetting, DEFAULT_SETTINGS, MEDIA_DIR, UPLOAD_DIR, ALLOWED_EXTS
from backend.auth import hash_password, verify_password, create_access_token, get_current_user, require_creator, require_admin, get_token

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
    is_favorited = False
    if user and db:
        is_favorited = db.query(UserFavorite).filter(
            UserFavorite.post_id == p.id, UserFavorite.user_id == user.id
        ).first() is not None
    return {
        "id": p.id, "title": p.title,
        "file_type": p.file_type, "duration": p.duration,
        "cover_image": p.cover_image, "views": p.views,
        "favorite_count": favorite_count, "is_favorited": is_favorited,
        "created_at": p.created_at.isoformat(),
        "category": {"id": p.category.id, "name": p.category.name, "icon": p.category.icon} if p.category else None,
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
for d in ["audio", "video", "covers"]:
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
    file_path = os.path.join(MEDIA_DIR, "audio", filename)
    if not os.path.exists(file_path):
        raise HTTPException(404)
    ct, _ = mimetypes.guess_type(file_path)
    return stream_file(file_path, request, ct or "audio/mpeg")


@app.get("/media/video/{filename}")
async def serve_video(filename: str, request: Request, user: User = Depends(get_current_user)):
    file_path = os.path.join(MEDIA_DIR, "video", filename)
    if not os.path.exists(file_path):
        raise HTTPException(404)
    ct, _ = mimetypes.guess_type(file_path)
    return stream_file(file_path, request, ct or "video/mp4")


@app.get("/media/covers/{filename}")
async def serve_cover(filename: str, request: Request):
    file_path = os.path.join(MEDIA_DIR, "covers", filename)
    if not os.path.exists(file_path):
        raise HTTPException(404)
    ct, _ = mimetypes.guess_type(file_path)
    return stream_file(file_path, request, ct or "image/jpeg")


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
    if sort == "popular":
        q = q.order_by(desc(Post.views))
    else:
        q = q.order_by(desc(Post.created_at))
    total = q.count()
    posts = q.offset((page - 1) * 20).limit(20).all()
    return {"items": [fmt_post(p, user=user, db=db) for p in posts], "total": total, "page": page,
            "total_pages": max(1, (total + 19) // 20)}


@app.get("/api/posts/{post_id}")
def get_post(post_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(optional_user)):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
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
    file: UploadFile = File(...), cover: UploadFile = File(None),
    user: User = Depends(require_creator), db: Session = Depends(get_db)
):
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

    with open(save_path, "wb") as f:
        f.write(content)

    info = get_media_info(save_path)
    subdir = "audio" if file_type == "audio" else "video"
    final_path = os.path.join(MEDIA_DIR, subdir, fname)
    shutil.move(save_path, final_path)

    # ─── Compress large media files ───
    compress_media(final_path, file_type)
    # Re-check file info after compression
    info = get_media_info(final_path)

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
    elif file_type == "video" and info["duration"] > 0:
        tf = f"{fid}_thumb.jpg"
        thumb_path = os.path.join(MEDIA_DIR, "covers", tf)
        if gen_thumb(final_path, thumb_path, info["duration"] * 0.3):
            cover_url = f"media/covers/{tf}"

    url = f"media/{subdir}/{fname}"

    post = Post(title=title.strip(), description=description.strip(),
                file_path=url, file_type=file_type, file_size=info["size"],
                duration=info["duration"], cover_image=cover_url,
                category_id=category_id, user_id=user.id)
    db.add(post)
    db.commit()
    db.refresh(post)
    return {"id": post.id, "title": post.title, "file_type": post.file_type}


@app.delete("/api/posts/{post_id}")
def delete_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404)
    if user.role != "admin" and p.user_id != user.id:
        raise HTTPException(403, "无权限删除此内容")
    abs_path = os.path.join(MEDIA_DIR, *p.file_path.split("/")[1:])
    if os.path.exists(abs_path):
        os.remove(abs_path)
    if p.cover_image:
        cp = os.path.join(MEDIA_DIR, "covers", os.path.basename(p.cover_image))
        if os.path.exists(cp):
            os.remove(cp)
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
    db.commit()
    return {"ok": True}


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
        old_cover = p.cover_image
        p.cover_image = f"media/covers/{cf}"
        if old_cover:
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
    for k, v in data.items():
        if k not in allowed:
            continue
        row = db.query(SystemSetting).filter(SystemSetting.key == k).first()
        if row:
            row.value = str(v)
            row.updated_by = admin.id
        else:
            db.add(SystemSetting(key=k, value=str(v), updated_by=admin.id))
    db.commit()
    invalidate_settings_cache()
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

    # 总播放次数 & 总播放时长（粗估，从 PlayHistory 累计）
    total_views = db.query(Post).count()  # 占位：实际需 PlaySession 表（PRD-021）
    total_play_time = db.query(PlayHistory).count()  # 占位：心跳条数作为代理指标

    # 总用户数 & 总内容数（不限时间范围）
    total_users = db.query(User).count()
    total_posts = db.query(Post).count()

    return {
        "range": range,
        "dau": dau,
        "new_users": new_users,
        "new_posts": new_posts,
        "total_views": total_views,
        "total_play_time": total_play_time,
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
    q = db.query(Post)
    if metric == "favorites":
        from sqlalchemy import func as _f
        q = q.outerjoin(UserFavorite).group_by(Post.id).order_by(
            _f.count(UserFavorite.id).desc(), Post.views.desc()
        )
    elif metric == "play_time":
        q = q.order_by(Post.views.desc())  # 占位，PRD-021 后再细化
    else:
        q = q.order_by(Post.views.desc())
    posts = q.limit(limit).all()
    items = []
    for p in posts:
        fav_count = db.query(UserFavorite).filter(UserFavorite.post_id == p.id).count()
        items.append({
            "id": p.id, "title": p.title, "views": p.views,
            "favorite_count": fav_count,
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


# ─── Frontend SPA ───
@app.get("/{full_path:path}")
def serve(full_path: str):
    ip = os.path.join(frontend_path, "index.html")
    return FileResponse(ip) if os.path.exists(ip) else JSONResponse({"error": "not found"}, 404)
