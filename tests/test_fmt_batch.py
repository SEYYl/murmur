"""Tests for fmt_posts_batch — the N+1 query optimization.

Verifies that:
  1. Batch formatting produces the same output as fmt_post
  2. All data fields are correctly populated
  3. The function handles edge cases (empty list, missing relations)
"""
import sys
from pathlib import Path

import pytest
from sqlalchemy import event
from sqlalchemy.orm import Session

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.utils import fmt_post, fmt_posts_batch
from backend.models import User, Post


class TestFmtPostsBatch:
    def test_empty_list(self):
        result = fmt_posts_batch([], user=None, db=None)
        assert result == []

    def test_output_matches_fmt_post(self, db):
        """fmt_posts_batch should produce identical output to fmt_post for each post."""
        posts = db.query(Post).all()
        user = db.query(User).filter(User.username == "alice").first()

        # Individual formatting
        individual = [fmt_post(p, user=user, db=db) for p in posts]
        # Batch formatting
        batch = fmt_posts_batch(posts, user=user, db=db)

        assert len(individual) == len(batch)
        for ind, bat in zip(individual, batch):
            # Compare key fields
            assert ind["id"] == bat["id"]
            assert ind["title"] == bat["title"]
            assert ind["favorite_count"] == bat["favorite_count"]
            assert ind["comment_count"] == bat["comment_count"]
            assert ind["subtitle_count"] == bat["subtitle_count"]
            assert ind["is_favorited"] == bat["is_favorited"]
            assert ind["avg_completion_ratio"] == bat["avg_completion_ratio"]
            assert ind["views"] == bat["views"]
            assert ind["featured"] == bat["featured"]
            assert ind["status"] == bat["status"]
            assert ind["total_play_time"] == bat["total_play_time"]

    def test_favorite_counts_correct(self, db):
        posts = db.query(Post).all()
        user = db.query(User).filter(User.username == "alice").first()
        batch = fmt_posts_batch(posts, user=user, db=db)

        # Alice favorited posts 0 and 1 (seeded in conftest)
        favorited = {item["id"] for item in batch if item["is_favorited"]}
        assert posts[0].id in favorited
        assert posts[1].id in favorited
        assert posts[2].id not in favorited

    def test_comment_counts_correct(self, db):
        posts = db.query(Post).all()
        batch = fmt_posts_batch(posts, user=None, db=db)

        # Post 0 has 2 comments, others have 0
        post0 = next(item for item in batch if item["id"] == posts[0].id)
        assert post0["comment_count"] == 2

        post2 = next(item for item in batch if item["id"] == posts[2].id)
        assert post2["comment_count"] == 0

    def test_subtitle_counts_correct(self, db):
        posts = db.query(Post).all()
        batch = fmt_posts_batch(posts, user=None, db=db)

        post0 = next(item for item in batch if item["id"] == posts[0].id)
        assert post0["subtitle_count"] == 1

        post1 = next(item for item in batch if item["id"] == posts[1].id)
        assert post1["subtitle_count"] == 0

    def test_tags_correct(self, db):
        posts = db.query(Post).all()
        batch = fmt_posts_batch(posts, user=None, db=db)

        post0 = next(item for item in batch if item["id"] == posts[0].id)
        assert len(post0["tags"]) == 1
        assert post0["tags"][0]["name"] == "放松"

        post3 = next(item for item in batch if item["id"] == posts[3].id)
        assert len(post3["tags"]) == 0

    def test_completion_ratio_correct(self, db):
        posts = db.query(Post).all()
        batch = fmt_posts_batch(posts, user=None, db=db)

        # Post 0: avg of 0.8 and 0.6 = 0.7
        post0 = next(item for item in batch if item["id"] == posts[0].id)
        assert abs(post0["avg_completion_ratio"] - 0.7) < 0.01

        # Post 1: only 0.4
        post1 = next(item for item in batch if item["id"] == posts[1].id)
        assert abs(post1["avg_completion_ratio"] - 0.4) < 0.01

        # Post 2: no play sessions
        post2 = next(item for item in batch if item["id"] == posts[2].id)
        assert post2["avg_completion_ratio"] == 0

    def test_author_and_category_populated(self, db):
        posts = db.query(Post).all()
        batch = fmt_posts_batch(posts, user=None, db=db)

        for item in batch:
            assert item["user"] is not None
            assert "id" in item["user"]
            assert "username" in item["user"]
            assert item["category"] is not None
            assert "id" in item["category"]
            assert "name" in item["category"]
            assert "icon" in item["category"]

    def test_no_user_context(self, db):
        """When user is None, is_favorited should always be False."""
        posts = db.query(Post).all()
        batch = fmt_posts_batch(posts, user=None, db=db)

        for item in batch:
            assert item["is_favorited"] is False

    def test_query_count_is_constant(self, db):
        """fmt_posts_batch should fire a fixed number of queries regardless of post count.

        With 5 posts, batch should fire ~8 queries total.
        With the old fmt_post, it would fire 8 * 5 = 40 queries.
        """
        query_count = [0]

        @event.listens_for(db.bind, "before_cursor_execute")
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            query_count[0] += 1

        posts = db.query(Post).all()
        _ = fmt_posts_batch(posts, user=None, db=db)

        event.remove(db.bind, "before_cursor_execute", before_cursor_execute)

        # 8 queries: fav_counts, comment_counts, subtitle_counts,
        # favorited_ids (skipped when no user), tags, completion_ratio,
        # authors, categories = 7 when no user
        # Should be well under 40 (the old N+1 count for 5 posts)
        assert query_count[0] <= 10, f"Expected <=10 queries, got {query_count[0]}"
