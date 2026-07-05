"""Tag endpoints — tag list + tag posts."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from backend.deps import optional_user
from backend.models import Post, PostTag, Tag, User, get_db
from backend.utils import fmt_posts_batch

router = APIRouter()


@router.get("/api/tags")
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


@router.get("/api/tags/{tag_id}/posts")
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
            "items": fmt_posts_batch(posts, user, db),
            "total": total, "page": page, "total_pages": max(1, (total + 23) // 24)}
