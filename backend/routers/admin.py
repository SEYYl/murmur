"""Admin endpoints — users, stats, transcode, storage, reports, manual post, featured."""
import os
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Form, HTTPException, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from backend.auth import hash_password, require_admin
from backend.models import (
    MEDIA_DIR,
    Category,
    Comment,
    PlayHistory,
    PlaySession,
    Post,
    Report,
    User,
    UserFavorite,
    get_db,
)
from backend.storage import get_provider_presets, get_storage
from backend.utils import (
    _check_transcode_timeouts,
    _contains_sensitive_word,
    _delete_from_storage,
    _get_sensitive_words,
    _rel_from_url,
    _set_post_tags,
    _submit_transcode,
    _transcode_lock,
    _transcode_starts,
    fmt_posts_batch,
    get_setting,
)

router = APIRouter()


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


@router.get("/api/admin/users")
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


@router.put("/api/admin/users/{user_id}/role")
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


@router.put("/api/admin/users/{user_id}/status")
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


@router.post("/api/admin/users/{user_id}/reset-password")
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
    return (datetime.now(UTC) - timedelta(days=days))


@router.get("/api/admin/stats")
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
    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
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


@router.get("/api/admin/stats/timeseries")
def get_stats_timeseries(
    metric: str = Query("new_posts"), days: int = Query(30, ge=1, le=365),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    from collections import defaultdict
    from datetime import timedelta
    end = datetime.now(UTC).date()
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


@router.get("/api/admin/stats/top-posts")
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


@router.get("/api/admin/stats/category-distribution")
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


# ─── Featured (PRD-011) ───
@router.put("/api/admin/posts/{post_id}/featured")
def set_featured(post_id: int, data: dict, admin: User = Depends(require_admin),
                 db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(404, "内容不存在")
    post.featured = bool(data.get("featured", True))
    db.commit()
    return {"ok": True, "featured": post.featured}


# ─── PRD-018: Admin Transcode Monitoring ───
@router.get("/api/admin/transcode/status")
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


@router.get("/api/admin/transcode/list")
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
        "items": fmt_posts_batch(posts, user=admin, db=db),
        "total": total, "page": page,
        "total_pages": max(1, (total + 19) // 20),
    }


@router.post("/api/admin/transcode/{post_id}/retry")
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


# ─── PRD-019: Storage Management ───
@router.get("/api/admin/storage/status")
def storage_status(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Return current storage backend info, provider, and file counts."""
    try:
        storage = get_storage(db=db)
        backend = storage.backend_name()
        provider = storage.provider()
    except Exception as e:
        return {"backend": "error", "provider": "", "error": str(e)}
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
        "provider": provider,
        "local_counts": counts,
        "s3_configured": bool(get_setting("s3_bucket", "", db=db)),
        "presets": get_provider_presets(),
        "provider_value": get_setting("storage_provider", "custom", db=db),
    }


@router.post("/api/admin/storage/test")
def storage_test(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Test the configured storage backend connectivity."""
    try:
        storage = get_storage(db=db)
        return storage.test_connection()
    except ImportError as e:
        return {"ok": False, "error": str(e), "details": {}}
    except Exception as e:
        return {"ok": False, "error": str(e), "details": {}}


@router.get("/api/admin/storage/list")
def storage_list(
    prefix: str = Query(""),
    max_keys: int = Query(100, ge=1, le=1000),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """List files and directories in the active S3/R2 storage backend.

    Uses delimiter="/" so directories like "audio/", "video/" are grouped.
    Set prefix to navigate into a directory (e.g. "audio/" to list audio files).
    """
    try:
        storage = get_storage(db=db)
    except Exception as e:
        raise HTTPException(500, f"存储后端初始化失败: {e}") from e
    if storage.backend_name() != "s3":
        return {"ok": True, "files": [], "dirs": ["audio/", "video/", "covers/", "subtitles/"], "is_truncated": False, "hint": "当前是本地存储，这些是建议的目录结构"}
    result = storage.list_files(prefix=prefix, max_keys=max_keys)
    if "error" in result:
        raise HTTPException(500, f"列举文件失败: {result['error']}")
    return result


@router.post("/api/admin/storage/migrate")
def storage_migrate(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Migrate existing local files to the active S3 backend.

    Walks all files under media/{audio,video,covers,subtitles}/ and uploads
    them to S3. Use this after switching from local to S3 to backfill
    pre-existing content. Idempotent — re-uploading the same key is safe.
    """
    try:
        storage = get_storage(db=db)
    except Exception as e:
        raise HTTPException(500, f"存储后端初始化失败: {e}") from e
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


@router.post("/api/admin/posts/manual")
def create_post_manual(
    title: str = Form(...), description: str = Form(""),
    category_id: int = Form(...), tags: str = Form(""),
    file_type: str = Form(...), r2_key: str = Form(...),
    cover_key: str = Form(""),
    duration: float = Form(0), file_size: int = Form(0),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """Manually create a post pointing to an existing file in R2/S3.

    Used for large files uploaded directly to R2 via the Cloudflare dashboard,
    bypassing the server upload + transcode bottleneck.
    """
    title = title.strip()
    description = (description or "").strip()
    r2_key = r2_key.strip().lstrip("/")

    if file_type not in ("audio", "video"):
        raise HTTPException(400, "file_type 必须是 audio 或 video")
    if not title:
        raise HTTPException(400, "标题不能为空")
    if not r2_key:
        raise HTTPException(400, "R2 文件路径不能为空")

    # Sensitive word filter
    sensitive_words = _get_sensitive_words(db=db)
    bad = _contains_sensitive_word(title, sensitive_words) or _contains_sensitive_word(description, sensitive_words)
    if bad:
        raise HTTPException(400, f"内容包含敏感词：{bad}")

    # Verify category exists
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(400, "分类不存在")

    # Verify the file exists in storage backend
    _s = get_storage(db=db)
    if _s.backend_name() == "s3":
        try:
            if not _s.exists(r2_key):
                raise HTTPException(400, f"在存储后端中未找到文件: {r2_key}")
        except NotImplementedError:
            pass

    file_path = f"media/{r2_key}"

    # Cover
    cover_url = ""
    if cover_key:
        cover_key = cover_key.strip().lstrip("/")
        cover_url = f"media/{cover_key}"

    post = Post(
        title=title, description=description,
        file_path=file_path, file_type=file_type,
        file_size=file_size, duration=duration,
        cover_image=cover_url,
        category_id=category_id, user_id=admin.id,
        status="ready", content_hash="",
    )
    db.add(post)
    db.flush()
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    _set_post_tags(db, post.id, tag_list)
    db.commit()
    db.refresh(post)

    return {"id": post.id, "title": post.title, "file_type": post.file_type, "status": post.status}


# ─── PRD-020: Content Reports ───
@router.get("/api/admin/reports")
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


@router.put("/api/admin/reports/{report_id}")
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
    rpt.resolved_at = datetime.now(UTC)
    rpt.resolved_by = admin.id
    db.commit()
    return {"ok": True, "status": rpt.status, "action": action or "none"}


# ─── PRD-021: Completion & Play Time Analytics ───
@router.get("/api/admin/stats/top-completion")
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


@router.get("/api/admin/stats/play-time-trend")
def stats_play_time_trend(
    days: int = Query(30, ge=1, le=365),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """Daily total play time trend based on PlaySession.started_at."""
    from datetime import timedelta

    from sqlalchemy import func as _f
    end = datetime.now(UTC).date()
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
