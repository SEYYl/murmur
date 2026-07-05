"""Shared test fixtures for the Murmur backend.

Uses an in-memory SQLite database (via a temp file for cross-thread safety)
so tests never touch the real asmr.db.
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.models import Base, User, Category, Post, UserFavorite, Comment, Subtitle, Tag, PostTag, PlaySession
from backend.auth import hash_password


@pytest.fixture(scope="session")
def test_engine():
    """Create a fresh file-based SQLite engine for the test session."""
    # Use a temp file so ThreadPoolExecutor (transcode) can access it too
    fd, db_path = tempfile.mkstemp(suffix=".db", prefix="murmur_test_")
    os.close(fd)
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()
    try:
        os.unlink(db_path)
    except OSError:
        pass


@pytest.fixture(scope="function")
def db(test_engine):
    """Provide a clean DB session for each test, with test data seeded."""
    # Clear all data from previous test
    with Session(bind=test_engine) as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
        conn.commit()

    session = Session(bind=test_engine)
    # Seed: 1 admin, 1 user, 2 categories, 5 posts
    admin = User(username="admin", password_hash=hash_password("admin123"), role="admin")
    user2 = User(username="alice", password_hash=hash_password("alice1234"), role="user")
    session.add_all([admin, user2])
    session.flush()

    cat1 = Category(name="耳语", icon="🤫", sort_order=1)
    cat2 = Category(name="触发音", icon="🎯", sort_order=2)
    session.add_all([cat1, cat2])
    session.flush()

    posts = []
    for i in range(5):
        p = Post(
            title=f"测试帖子 {i}",
            description=f"描述 {i}",
            file_path=f"audio/test_{i}.mp3",
            file_type="audio",
            file_size=1024 * (i + 1),
            duration=60.0 * (i + 1),
            cover_image="",
            category_id=cat1.id if i < 3 else cat2.id,
            user_id=admin.id,
            views=i * 10,
            featured=(i == 0),
            status="ready",
            total_play_time=float(i * 30),
        )
        session.add(p)
        posts.append(p)
    session.flush()

    # Seed: favorites, comments, tags, play sessions
    session.add(UserFavorite(user_id=user2.id, post_id=posts[0].id))
    session.add(UserFavorite(user_id=user2.id, post_id=posts[1].id))
    session.add(Comment(post_id=posts[0].id, user_id=user2.id, content="好听"))
    session.add(Comment(post_id=posts[0].id, user_id=admin.id, content="谢谢"))
    session.add(Subtitle(post_id=posts[0].id, language="zh", file_path="subtitles/test_0.srt"))

    tag1 = Tag(name="放松", use_count=2)
    tag2 = Tag(name="助眠", use_count=1)
    session.add_all([tag1, tag2])
    session.flush()
    session.add(PostTag(post_id=posts[0].id, tag_id=tag1.id))
    session.add(PostTag(post_id=posts[1].id, tag_id=tag1.id))
    session.add(PostTag(post_id=posts[2].id, tag_id=tag2.id))

    session.add(PlaySession(user_id=user2.id, post_id=posts[0].id, completion_ratio=0.8))
    session.add(PlaySession(user_id=admin.id, post_id=posts[0].id, completion_ratio=0.6))
    session.add(PlaySession(user_id=user2.id, post_id=posts[1].id, completion_ratio=0.4))

    session.commit()
    yield session
    session.close()
