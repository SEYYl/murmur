"""Favorite endpoints — toggle favorite + favorites list."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.models import Post, User, UserFavorite, get_db
from backend.utils import fmt_posts_batch

router = APIRouter()


@router.post("/api/posts/{post_id}/favorite")
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


@router.get("/api/me/favorites")
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
    return {"items": fmt_posts_batch(posts, user=user, db=db), "total": total, "page": page,
            "total_pages": max(1, (total + 19) // 20)}
