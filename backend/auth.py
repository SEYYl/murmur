from datetime import datetime, timedelta, timezone
import hashlib, secrets, os
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.models import User, Post, get_db

SECRET_KEY = os.getenv("ASMR_SECRET_KEY", "asmr-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${h}"


def verify_password(plain_password: str, hashed: str) -> bool:
    parts = hashed.split("$")
    if len(parts) != 2:
        return False
    salt, h = parts
    return hashlib.sha256((salt + plain_password).encode()).hexdigest() == h


def create_access_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="登录已过期")
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
