"""Authentication endpoints — register, login, me, change-password."""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    is_legacy_hash,
    verify_password,
)
from backend.models import User, get_db
from backend.utils import _check_rate_limit, _validate_password, get_setting, setting_bool

router = APIRouter()


@router.post("/api/register")
def register(data: dict, request: Request, db: Session = Depends(get_db)):
    _check_rate_limit(request, "register", max_attempts=3, window=3600)
    if not setting_bool("registration_enabled", default=True, db=db):
        raise HTTPException(403, "注册已关闭")
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or len(username) < 2:
        raise HTTPException(400, "用户名至少2个字符")
    _validate_password(password)
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(400, "用户名已存在")
    default_role = get_setting("default_user_role", "user", db=db)
    if default_role not in ("user", "creator", "admin"):
        default_role = "user"
    user = User(username=username, password_hash=hash_password(password), role=default_role)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id})
    return {"token": token, "user": {"id": user.id, "username": user.username, "role": user.role}}


@router.post("/api/login")
def login(data: dict, request: Request, db: Session = Depends(get_db)):
    _check_rate_limit(request, "login", max_attempts=5, window=300)
    username = data.get("username", "").strip()
    password = data.get("password", "")
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(401, "用户名或密码错误")
    if user.status == "banned":
        raise HTTPException(403, "账号已被封禁，请联系管理员")
    user.last_login_at = datetime.now(UTC)
    # Migrate legacy SHA256 hash to bcrypt on successful login
    if is_legacy_hash(user.password_hash):
        user.password_hash = hash_password(password)
    db.commit()
    token = create_access_token({"sub": user.id})
    return {"token": token, "user": {"id": user.id, "username": user.username, "role": user.role, "status": user.status}}


@router.get("/api/me")
def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "role": user.role}


@router.post("/api/change-password")
def change_password(data: dict, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_rate_limit(request, "change_password", max_attempts=3, window=300)
    old_pw = data.get("old_password", "")
    new_pw = data.get("new_password", "")
    if not verify_password(old_pw, user.password_hash):
        raise HTTPException(400, "原密码错误")
    _validate_password(new_pw)
    user.password_hash = hash_password(new_pw)
    db.commit()
    return {"ok": True, "message": "密码已修改"}
