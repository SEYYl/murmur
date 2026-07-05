"""Settings endpoints — admin settings get/put + public settings."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth import require_admin
from backend.models import DEFAULT_SETTINGS, SystemSetting, User, get_db
from backend.utils import get_setting, invalidate_settings_cache, setting_bool

router = APIRouter()


@router.get("/api/admin/settings")
def get_admin_settings(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(SystemSetting).all()
    result = dict(DEFAULT_SETTINGS)
    for r in rows:
        result[r.key] = r.value
    # 安全配置只读展示
    from backend.auth import SECRET_KEY_IS_DEFAULT
    result["_secret_key_is_default"] = "true" if SECRET_KEY_IS_DEFAULT else "false"
    return result


@router.put("/api/admin/settings")
def update_admin_settings(data: dict, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    allowed = set(DEFAULT_SETTINGS.keys())
    storage_keys_touched = False
    for k, v in data.items():
        if k not in allowed:
            continue
        if k.startswith(("storage_", "s3_")):
            storage_keys_touched = True
        row = db.query(SystemSetting).filter(SystemSetting.key == k).first()
        if row:
            row.value = str(v)
            row.updated_by = admin.id
        else:
            db.add(SystemSetting(key=k, value=str(v), updated_by=admin.id))
    db.commit()
    invalidate_settings_cache()
    # PRD-019: reset cached storage backend so the new config takes effect
    if storage_keys_touched:
        try:
            from backend.storage import reset_storage_cache
            reset_storage_cache()
        except ImportError:
            pass
    return {"ok": True}


@router.get("/api/settings/public")
def get_public_settings(db: Session = Depends(get_db)):
    """前端公开配置（无需登录）"""
    return {
        "site_name": get_setting("site_name", "Murmur", db=db),
        "site_description": get_setting("site_description", "", db=db),
        "footer_text": get_setting("footer_text", "", db=db),
        "registration_enabled": setting_bool("registration_enabled", default=True, db=db),
    }
