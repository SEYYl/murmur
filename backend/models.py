import os
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import Session, declarative_base, relationship

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'data', 'asmr.db')}"
MEDIA_DIR = os.path.join(BASE_DIR, "media")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

ALLOWED_EXTS = {
    'audio': ['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a'],
    'video': ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
    'image': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
}

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    last_login_at = Column(DateTime, nullable=True)
    posts = relationship("Post", back_populates="user")
    favorites = relationship("UserFavorite", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    icon = Column(String(10), default="🎵")
    sort_order = Column(Integer, default=0)
    posts = relationship("Post", back_populates="category")


class Post(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    file_path = Column(String(255), nullable=False)
    file_type = Column(String(10), nullable=False)
    file_size = Column(Integer, default=0)
    duration = Column(Float, default=0)
    cover_image = Column(String(255), default="")
    category_id = Column(Integer, ForeignKey("categories.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    views = Column(Integer, default=0)
    featured = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    # PRD-018: async transcode status (processing / ready / failed)
    status = Column(String(20), default="ready")
    # PRD-020: content hash for duplicate detection
    content_hash = Column(String(64), nullable=True, index=True)
    # PRD-021: total accumulated play time in seconds
    total_play_time = Column(Float, default=0)
    category = relationship("Category", back_populates="posts")
    user = relationship("User", back_populates="posts")
    favorites = relationship("UserFavorite", back_populates="post", cascade="all, delete-orphan")
    tags = relationship("PostTag", back_populates="post", cascade="all, delete-orphan")
    play_sessions = relationship("PlaySession", back_populates="post", cascade="all, delete-orphan")


class UserFavorite(Base):
    __tablename__ = "user_favorites"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    user = relationship("User", back_populates="favorites")
    post = relationship("Post", back_populates="favorites")
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_user_post_fav"),)


class PlayHistory(Base):
    __tablename__ = "play_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    position = Column(Float, default=0)
    duration = Column(Float, default=0)
    played_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_user_post_history"),
        Index("ix_history_user_played", "user_id", "played_at"),
    )


class SystemSetting(Base):
    __tablename__ = "system_settings"
    key = Column(String(64), primary_key=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    updated_by = Column(Integer, nullable=True)


class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), unique=True, nullable=False, index=True)
    use_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))


class PostTag(Base):
    __tablename__ = "post_tags"
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False)
    post = relationship("Post", back_populates="tags")
    tag = relationship("Tag")
    __table_args__ = (UniqueConstraint("post_id", "tag_id", name="uq_post_tag"),)


class Playlist(Base):
    __tablename__ = "playlists"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="playlists")
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    cover = Column(String(500), default="")
    is_public = Column(Boolean, default=False)
    item_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class PlaylistItem(Base):
    __tablename__ = "playlist_items"
    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id"), nullable=False, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    position = Column(Integer, default=0)
    added_at = Column(DateTime, default=lambda: datetime.now(UTC))
    playlist = relationship("Playlist", back_populates="items")
    post = relationship("Post")


Playlist.items = relationship("PlaylistItem", back_populates="playlist", order_by="PlaylistItem.position", cascade="all, delete-orphan")
User.playlists = relationship("Playlist", back_populates="user", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User")
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))


class Subtitle(Base):
    __tablename__ = "subtitles"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    language = Column(String(10), default="zh")
    file_path = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))


class Report(Base):
    """PRD-020: content moderation reports."""
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_type = Column(String(20), nullable=False)  # post / comment
    target_id = Column(Integer, nullable=False)
    reason = Column(Text, default="")
    status = Column(String(20), default="pending")  # pending / resolved / dismissed
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(Integer, nullable=True)
    reporter = relationship("User")


class PlaySession(Base):
    """PRD-021: play session tracking for completion rate."""
    __tablename__ = "play_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    started_at = Column(DateTime, default=lambda: datetime.now(UTC))
    ended_at = Column(DateTime, nullable=True)
    played_seconds = Column(Float, default=0)
    completion_ratio = Column(Float, default=0)
    post = relationship("Post", back_populates="play_sessions")


DEFAULT_SETTINGS = {
    "registration_enabled": "true",
    "max_upload_size_mb": "500",
    "allowed_video_exts": "mp4,webm,mov,mkv",
    "allowed_audio_exts": "mp3,wav,flac,m4a,aac,ogg",
    "site_name": "Murmur",
    "site_description": "自托管 ASMR 内容平台",
    "footer_text": "Murmur · Self-hosted ASMR Platform",
    "default_user_role": "user",
    "rss_enabled": "true",
    # PRD-019: multi storage backend
    "storage_backend": "local",
    "storage_provider": "custom",
    "s3_endpoint": "",
    "s3_bucket": "",
    "s3_access_key": "",
    "s3_secret_key": "",
    "s3_region": "",
    # PRD-020: sensitive words (comma separated)
    "sensitive_words": "",
}


def _migrate_db():
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    with engine.connect() as conn:
        existing_tables = insp.get_table_names()

        if "posts" in existing_tables:
            cols = [c["name"] for c in insp.get_columns("posts")]
            if "featured" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN featured BOOLEAN DEFAULT 0"))
                conn.commit()
            # PRD-018: transcode status (old posts default to "ready")
            if "status" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN status VARCHAR(20) DEFAULT 'ready'"))
                conn.commit()
            # PRD-020: content hash for duplicate detection
            if "content_hash" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN content_hash VARCHAR(64)"))
                conn.commit()
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_posts_content_hash ON posts (content_hash)"))
                conn.commit()
            # PRD-021: total accumulated play time
            if "total_play_time" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN total_play_time FLOAT DEFAULT 0"))
                conn.commit()

        new_tables = ["tags", "post_tags", "playlists", "playlist_items", "comments"]
        for t in new_tables:
            if t not in existing_tables:
                pass

        if "playlists" in existing_tables:
            cols = [c["name"] for c in insp.get_columns("playlists")]
            if "is_public" not in cols:
                conn.execute(text("ALTER TABLE playlists ADD COLUMN is_public BOOLEAN DEFAULT 0"))
                conn.commit()
            if "item_count" not in cols:
                conn.execute(text("ALTER TABLE playlists ADD COLUMN item_count INTEGER DEFAULT 0"))
                conn.commit()
            if "cover" not in cols:
                conn.execute(text("ALTER TABLE playlists ADD COLUMN cover VARCHAR(500) DEFAULT ''"))
                conn.commit()


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_db()
    # Ensure media subdirectories exist
    os.makedirs(os.path.join(MEDIA_DIR, "audio"), exist_ok=True)
    os.makedirs(os.path.join(MEDIA_DIR, "video"), exist_ok=True)
    os.makedirs(os.path.join(MEDIA_DIR, "covers"), exist_ok=True)
    os.makedirs(os.path.join(MEDIA_DIR, "subtitles"), exist_ok=True)
    session = Session(bind=engine)
    if session.query(Category).count() == 0:
        for name, icon, order in [
            ('耳语', '🤫', 1), ('触发音', '🎯', 2),
            ('角色扮演', '🎭', 3), ('白噪音', '🌧️', 4),
            ('咀嚼音', '🍽️', 5), ('冥想', '🧘', 6),
            ('纯音乐', '🎵', 7), ('综合', '📦', 8),
        ]:
            session.add(Category(name=name, icon=icon, sort_order=order))
        session.commit()
    admin_user = session.query(User).filter(User.username == "admin").first()
    if not admin_user:
        from backend.auth import hash_password
        session.add(User(username="admin", password_hash=hash_password("admin123"), role="admin"))
        session.commit()
    else:
        if admin_user.role != "admin":
            admin_user.role = "admin"
            session.commit()
    if session.query(Post).filter(Post.user_id.is_(None)).first() is not None:
        aid = session.query(User).filter(User.username == "admin").first().id
        session.query(Post).filter(Post.user_id.is_(None)).update({"user_id": aid})
        session.commit()
    for k, v in DEFAULT_SETTINGS.items():
        if not session.query(SystemSetting).filter(SystemSetting.key == k).first():
            session.add(SystemSetting(key=k, value=v))
    session.commit()
    session.close()


def get_db():
    session = Session(bind=engine)
    try:
        yield session
    finally:
        session.close()
