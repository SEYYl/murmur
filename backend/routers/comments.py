"""Comment endpoints — list, create, delete."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.models import Comment, Post, User, get_db

router = APIRouter()


@router.get("/api/posts/{post_id}/comments")
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


@router.post("/api/posts/{post_id}/comments")
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


@router.delete("/api/comments/{comment_id}")
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
