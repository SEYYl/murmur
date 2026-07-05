"""Tests for password hashing, legacy migration, and JWT tokens.

Protects the bcrypt migration from regression.
"""
import hashlib
import time

import pytest
from fastapi import HTTPException

from backend.auth import (
    hash_password,
    verify_password,
    is_legacy_hash,
    create_access_token,
    SECRET_KEY,
    ALGORITHM,
)
from jose import jwt


# ─── hash_password ───

class TestHashPassword:
    def test_returns_bcrypt_hash(self):
        h = hash_password("test1234")
        assert h.startswith("$2b$")
        assert len(h) > 50

    def test_different_salts_each_call(self):
        h1 = hash_password("samepass1")
        h2 = hash_password("samepass1")
        assert h1 != h2  # different salt → different hash

    def test_cost_factor_12(self):
        """bcrypt cost factor should be 12 (balanced security vs latency)."""
        h = hash_password("test1234")
        # $2b$12$... — the number after $2b$ is the cost
        parts = h.split("$")
        assert parts[1] == "2b"
        assert int(parts[2]) == 12


# ─── verify_password ───

class TestVerifyPassword:
    def test_correct_bcrypt_password(self):
        h = hash_password("mypassword1")
        assert verify_password("mypassword1", h) is True

    def test_wrong_bcrypt_password(self):
        h = hash_password("mypassword1")
        assert verify_password("wrongpassword1", h) is False

    def test_empty_password(self):
        h = hash_password("test1234")
        assert verify_password("", h) is False

    def test_legacy_sha256_correct(self):
        """Legacy SHA256 hashes (salt$hexdigest) should still verify."""
        salt = "abc123"
        plain = "oldpassword1"
        h = hashlib.sha256((salt + plain).encode()).hexdigest()
        legacy_hash = f"{salt}${h}"
        assert verify_password(plain, legacy_hash) is True

    def test_legacy_sha256_wrong(self):
        salt = "abc123"
        h = hashlib.sha256((salt + "correct1").encode()).hexdigest()
        legacy_hash = f"{salt}${h}"
        assert verify_password("wrong1", legacy_hash) is False

    def test_garbage_hash_returns_false(self):
        assert verify_password("test1234", "not-a-real-hash") is False

    def test_bcrypt_malformed_hash_returns_false(self):
        """A string starting with $2 but not a valid bcrypt hash should not crash."""
        assert verify_password("test1234", "$2b$notvalid") is False


# ─── is_legacy_hash ───

class TestIsLegacyHash:
    def test_bcrypt_is_not_legacy(self):
        h = hash_password("test1234")
        assert is_legacy_hash(h) is False

    def test_sha256_is_legacy(self):
        legacy = "abc123$" + hashlib.sha256(b"test").hexdigest()
        assert is_legacy_hash(legacy) is True

    def test_empty_string_is_legacy(self):
        # Empty string doesn't start with $2
        assert is_legacy_hash("") is True


# ─── create_access_token ───

class TestCreateAccessToken:
    def test_token_contains_sub(self):
        token = create_access_token({"sub": 42})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "42"
        assert "exp" in payload

    def test_token_expiry_30_days(self):
        """Token should expire in 30 days (2592000 minutes)."""
        token = create_access_token({"sub": 1})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # exp is a Unix timestamp
        now = int(time.time())
        # Should be roughly 30 days from now (allow 60s tolerance)
        expected_exp = now + 60 * 24 * 30 * 60
        assert abs(payload["exp"] - expected_exp) < 120

    def test_invalid_token_rejected(self):
        """A token signed with a different key should be rejected."""
        from jose import jwt as jose_jwt
        bad_token = jose_jwt.encode({"sub": "1"}, "wrong-secret", algorithm=ALGORITHM)
        with pytest.raises(Exception):
            jose_jwt.decode(bad_token, SECRET_KEY, algorithms=[ALGORITHM])
