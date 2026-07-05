"""Shared FastAPI dependencies for the Murmur backend.

Provides `optional_user` (returns User or None) and re-exports common
auth/model dependencies for convenience.
"""
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from backend.auth import get_current_user, get_token, require_admin, require_creator
from backend.models import User, get_db

__all__ = [
    "optional_user",
    "get_db",
    "get_current_user",
    "require_admin",
    "require_creator",
]


def optional_user(request: Request, db: Session = Depends(get_db)):
    from jose import JWTError, jwt

    from backend.auth import ALGORITHM, SECRET_KEY
    token = get_token(request)
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = int(payload.get("sub", 0))
        return db.query(User).filter(User.id == uid, User.status == "active").first()
    except (JWTError, ValueError, TypeError):
        return None
