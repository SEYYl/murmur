import hashlib
import os
import secrets
import warnings
from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.models import Post, User, get_db

# ─── SECRET_KEY: prefer env var, generate random fallback ───
_env_key = os.getenv("ASMR_SECRET_KEY")
SECRET_KEY_IS_DEFAULT = not _env_key or _env_key == "asmr-secret-key-change-me"
if SECRET_KEY_IS_DEFAULT:
    SECRET_KEY = secrets.token_urlsafe(32)
    warnings.warn(
        "ASMR_SECRET_KEY 环境变量未设置或使用了默认值。已为本会话生成随机密钥，"
        "但重启后所有已签发的 JWT 将失效。请在环境变量中设置 ASMR_SECRET_KEY。",
        stacklevel=2,
    )
else:
    SECRET_KEY = _env_key

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

# Bcrypt cost factor — 12 is a good balance of security vs. latency (~250ms)
_BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    """Hash a password using bcrypt with adaptive cost factor."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(plain_password: str, hashed: str) -> bool:
    """Verify a password against a stored hash.

    Supports both bcrypt (current) and legacy SHA256 (salt$hex) formats.
    Legacy hashes are verified for backward compatibility — callers should
    check is_legacy_hash() and re-hash if verification succeeds.
    """
    # Bcrypt hashes start with $2 (e.g., $2b$12$...)
    if hashed.startswith("$2"):
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed.encode("utf-8"))
        except (ValueError, TypeError):
            return False
    # Legacy SHA256 format: salt$hexdigest
    parts = hashed.split("$")
    if len(parts) == 2:
        salt, h = parts
        return hashlib.sha256((salt + plain_password).encode()).hexdigest() == h
    return False


def is_legacy_hash(hashed: str) -> bool:
    """Return True if the hash uses the old SHA256 format (needs migration to bcrypt)."""
    return not hashed.startswith("$2")


def create_access_token(data: dict) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": str(data["sub"]), "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return ""


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = get_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="请先登录")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=401, detail="登录已过期")
        user_id = int(user_id_str)
    except (JWTError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=401, detail="登录已过期") from exc
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="用户不存在")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="账号已被封禁")
    return user


def require_creator(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("admin", "creator"):
        raise HTTPException(status_code=403, detail="需要创作者权限")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


def require_post_owner_or_admin(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="内容不存在")
    if user.role != "admin" and post.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权限操作此内容")
    return post, user
