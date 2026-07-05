"""Category CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.models import Category, Post, User, get_db

router = APIRouter()


@router.get("/api/categories")
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.sort_order).all()
    return [{"id": c.id, "name": c.name, "icon": c.icon,
             "post_count": db.query(Post).filter(Post.category_id == c.id).count()} for c in cats]


@router.post("/api/categories")
def create_category(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = data.get("name", "").strip()
    icon = data.get("icon", "🎵").strip()
    if not name:
        raise HTTPException(400, "分类名不能为空")
    if db.query(Category).filter(Category.name == name).first():
        raise HTTPException(400, "分类已存在")
    mo = db.query(Category).order_by(Category.sort_order.desc()).first()
    cat = Category(name=name, icon=icon, sort_order=(mo.sort_order + 1 if mo else 1))
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "icon": cat.icon, "sort_order": cat.sort_order}


@router.put("/api/categories/{cid}")
def update_category(cid: int, data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cid).first()
    if not cat:
        raise HTTPException(404, "分类不存在")
    name = data.get("name", "").strip()
    icon = data.get("icon", "").strip()
    if name and name != cat.name:
        if db.query(Category).filter(Category.name == name).first():
            raise HTTPException(400, "分类名已存在")
        cat.name = name
    if icon:
        cat.icon = icon
    if "sort_order" in data:
        cat.sort_order = int(data["sort_order"])
    db.commit()
    return {"id": cat.id, "name": cat.name, "icon": cat.icon}


@router.delete("/api/categories/{cid}")
def delete_category(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cid).first()
    if not cat:
        raise HTTPException(404, "分类不存在")
    count = db.query(Post).filter(Post.category_id == cid).count()
    if count > 0:
        raise HTTPException(400, f"该分类下有 {count} 个内容，无法删除")
    db.delete(cat)
    db.commit()
    return {"ok": True}
