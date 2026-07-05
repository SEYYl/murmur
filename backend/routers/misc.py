"""Misc endpoints — reports POST, data export, RSS feed."""
import io
import json
import time
import zipfile
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.models import (
    Comment,
    PlayHistory,
    Playlist,
    Post,
    Report,
    User,
    UserFavorite,
    get_db,
)
from backend.utils import get_setting, setting_bool

router = APIRouter()


# ─── PRD-020: Content Reports ───
@router.post("/api/reports")
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


# ─── Data Export (PRD-017) ───
@router.get("/api/me/export")
def export_my_data(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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


@router.get("/api/rss.xml")
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
    <lastBuildDate>{datetime.now(UTC).strftime("%a, %d %b %Y %H:%M:%S +0000")}</lastBuildDate>{''.join(items_xml)}
  </channel>
</rss>"""

    _rss_cache["xml"] = xml
    _rss_cache["category_id"] = category_id
    _rss_cache["at"] = now
    return Response(content=xml, media_type="application/rss+xml; charset=utf-8")
