"""Playback endpoints — heartbeat, play-session, history CRUD, resume."""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.models import PlayHistory, PlaySession, Post, User, get_db
from backend.utils import fmt_post

router = APIRouter()


@router.post("/api/posts/{post_id}/heartbeat")
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


@router.post("/api/posts/{post_id}/play-session")
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
        ps.ended_at = datetime.now(UTC)
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


@router.get("/api/me/history")
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


@router.delete("/api/me/history/{post_id}")
def delete_history_item(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(PlayHistory).filter(
        PlayHistory.user_id == user.id, PlayHistory.post_id == post_id
    ).first()
    if h:
        db.delete(h)
        db.commit()
    return {"ok": True}


@router.delete("/api/me/history")
def clear_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(PlayHistory).filter(PlayHistory.user_id == user.id).delete()
    db.commit()
    return {"ok": True}


@router.get("/api/posts/{post_id}/resume")
def get_resume(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(PlayHistory).filter(
        PlayHistory.user_id == user.id, PlayHistory.post_id == post_id
    ).first()
    if not h or h.duration <= 0 or h.position < 15:
        return {"position": 0}
    if h.position / h.duration >= 0.95:
        return {"position": 0}
    return {"position": h.position, "duration": h.duration}
