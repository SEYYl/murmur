"""Playlist endpoints — CRUD + items."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.deps import optional_user
from backend.models import Playlist, PlaylistItem, Post, User, get_db
from backend.utils import fmt_posts_batch

router = APIRouter()


@router.get("/api/playlists")
def list_playlists(mine: bool = Query(False), user_id: int = Query(None),
                   page: int = Query(1, ge=1), db: Session = Depends(get_db),
                   user: User = Depends(optional_user)):
    q = db.query(Playlist)
    if mine and user:
        q = q.filter(Playlist.user_id == user.id)
    elif user_id:
        q = q.filter(Playlist.user_id == user_id, Playlist.is_public == True)  # noqa: E712 - SQLAlchemy requires == True
    else:
        q = q.filter(Playlist.is_public == True)  # noqa: E712 - SQLAlchemy requires == True
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


@router.post("/api/playlists")
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


@router.get("/api/playlists/{pl_id}")
def get_playlist(pl_id: int, db: Session = Depends(get_db),
                 user: User = Depends(optional_user)):
    pl = db.query(Playlist).filter(Playlist.id == pl_id).first()
    if not pl:
        raise HTTPException(404, "歌单不存在")
    if not pl.is_public and (not user or user.id != pl.user_id):
        raise HTTPException(403, "无权限查看")
    playlist_posts = [pi.post for pi in pl.items]
    items = fmt_posts_batch(playlist_posts, user, db)
    return {
        "id": pl.id, "title": pl.title, "description": pl.description,
        "cover": pl.cover, "is_public": pl.is_public, "item_count": pl.item_count,
        "created_at": pl.created_at.isoformat(), "updated_at": pl.updated_at.isoformat(),
        "user": {"id": pl.user.id, "username": pl.user.username} if pl.user else None,
        "items": items,
    }


@router.put("/api/playlists/{pl_id}")
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


@router.delete("/api/playlists/{pl_id}")
def delete_playlist(pl_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == pl_id).first()
    if not pl:
        raise HTTPException(404, "歌单不存在")
    if pl.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "无权限删除")
    db.delete(pl)
    db.commit()
    return {"ok": True}


@router.post("/api/playlists/{pl_id}/items/{post_id}")
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


@router.delete("/api/playlists/{pl_id}/items/{post_id}")
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
