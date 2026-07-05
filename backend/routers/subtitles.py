"""Subtitle endpoints — create, list, delete."""
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.models import MEDIA_DIR, Post, Subtitle, User, get_db
from backend.utils import _delete_from_storage, _promote_to_storage, _rel_from_url

router = APIRouter()


@router.post("/api/posts/{post_id}/subtitles")
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


@router.get("/api/posts/{post_id}/subtitles")
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


@router.delete("/api/subtitles/{subtitle_id}")
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
        except OSError:
            pass
    db.delete(sub)
    db.commit()
    return {"ok": True}
