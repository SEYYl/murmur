"""Post endpoints — list, featured, detail, create, delete, update, related, stats, cover-frame."""
import hashlib
import os
import shutil
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_creator
from backend.deps import optional_user
from backend.models import (
    ALLOWED_EXTS,
    MEDIA_DIR,
    UPLOAD_DIR,
    Category,
    PlaySession,
    Post,
    PostTag,
    User,
    UserFavorite,
    get_db,
)
from backend.utils import (
    _contains_sensitive_word,
    _delete_from_storage,
    _get_sensitive_words,
    _promote_to_storage,
    _rel_from_url,
    _set_post_tags,
    _submit_transcode,
    _verify_magic_bytes,
    compress_image,
    fmt_post,
    fmt_posts_batch,
    gen_thumb,
    get_media_info,
    setting_int,
    should_count_view,
)

router = APIRouter()


@router.get("/api/posts")
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
    return {"items": fmt_posts_batch(posts, user=user, db=db), "total": total, "page": page,
            "total_pages": max(1, (total + 19) // 20)}


@router.get("/api/posts/featured")
def featured_posts(limit: int = Query(10, ge=1, le=50),
                   db: Session = Depends(get_db), user: User = Depends(optional_user)):
    posts = db.query(Post).filter(Post.featured == True, Post.status == "ready").order_by(  # noqa: E712 - SQLAlchemy requires == True
        desc(Post.created_at)
    ).limit(limit).all()
    return {"items": fmt_posts_batch(posts, user, db)}


@router.get("/api/posts/{post_id}")
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
@router.post("/api/posts")
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

    # Stream upload to disk in 1MB chunks — avoids loading entire file into memory (OOM prevention)
    max_size_mb = setting_int("max_upload_size_mb", default=500, db=db)
    max_bytes = max_size_mb * 1024 * 1024 if max_size_mb > 0 else 0
    hasher = hashlib.md5()  # noqa: S324 - content dedup, not security
    total_size = 0
    magic_verified = False
    try:
        with open(save_path, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                total_size += len(chunk)
                if max_bytes > 0 and total_size > max_bytes:
                    raise HTTPException(413, f"文件过大，最大允许 {max_size_mb}MB")
                # Verify magic bytes on first chunk (prevent disguised file uploads)
                if not magic_verified:
                    if not _verify_magic_bytes(chunk, file_type):
                        raise HTTPException(400, "文件内容与声明类型不匹配（magic bytes 校验失败）")
                    magic_verified = True
                hasher.update(chunk)
                f.write(chunk)
    except HTTPException:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise
    except Exception as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(500, f"文件上传失败: {e}") from e

    if total_size == 0:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(400, "文件为空")

    # PRD-020: check content hash for duplicates
    content_hash = hasher.hexdigest()
    existing = db.query(Post).filter(Post.content_hash == content_hash).first()
    if existing:
        os.remove(save_path)
        raise HTTPException(409, "内容已存在（文件哈希重复）")

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
            cover_data = await cover.read()
            if not _verify_magic_bytes(cover_data, 'image'):
                raise HTTPException(400, "封面图片内容与扩展名不匹配")
            cf = f"{fid}_cover{ce}"
            cover_path = os.path.join(MEDIA_DIR, "covers", cf)
            with open(cover_path, "wb") as f:
                f.write(cover_data)
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


@router.delete("/api/posts/{post_id}")
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


# ─── Edit Post (PRD-003) ───
@router.put("/api/posts/{post_id}")
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
        cover_data = await cover.read()
        if not _verify_magic_bytes(cover_data, 'image'):
            raise HTTPException(400, "封面图片内容与扩展名不匹配")
        fid = uuid.uuid4().hex
        cf = f"{fid}_cover{ce}"
        cover_path = os.path.join(MEDIA_DIR, "covers", cf)
        with open(cover_path, "wb") as f:
            f.write(cover_data)
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
                except OSError:
                    pass
    p.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "title": p.title, "ok": True}


# ─── Related / Recommendations (PRD-010) ───
@router.get("/api/posts/{post_id}/related")
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
    return {"items": fmt_posts_batch(posts[:limit], user, db)}


# ─── Post Stats (PRD-021) ───
@router.get("/api/posts/{post_id}/stats")
def post_stats(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(404, "内容不存在")
    sessions = db.query(PlaySession).filter(PlaySession.post_id == post_id).all()
    session_count = len(sessions)
    total_play_seconds = sum(s.played_seconds for s in sessions) if sessions else 0
    avg_completion = (
        sum(s.completion_ratio for s in sessions) / session_count
        if session_count > 0 else 0
    )
    return {
        "session_count": session_count,
        "total_play_time": total_play_seconds,
        "total_play_seconds": total_play_seconds,
        "avg_completion": avg_completion,
        "completion_rate": avg_completion,
        "play_count": post.views,
    }


# ─── Cover Frame (PRD-015) ───
@router.post("/api/posts/{post_id}/cover-frame")
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
    p.updated_at = datetime.now(UTC)
    db.commit()
    if old_cover:
        _delete_from_storage(_rel_from_url(old_cover))
        cp = os.path.join(MEDIA_DIR, "covers", os.path.basename(old_cover))
        if os.path.exists(cp):
            try:
                os.remove(cp)
            except OSError:
                pass
    return {"ok": True, "cover_image": p.cover_image}
