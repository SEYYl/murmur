"""Tests for security-critical functions in backend/utils.py.

Covers:
  - _validate_password: password strength rules
  - _verify_magic_bytes: file header validation
  - _safe_rel_path: directory traversal prevention
  - _check_rate_limit: brute-force protection

These tests protect the security fixes from regression.
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

# Ensure project root on path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.utils import (
    _validate_password,
    _verify_magic_bytes,
    _safe_rel_path,
    _check_rate_limit,
    _rate_limit_store,
    _rate_limit_lock,
)


# ─── _validate_password ───

class TestValidatePassword:
    def test_valid_password(self):
        """A password with 8+ chars, at least one letter and one digit should pass."""
        _validate_password("password1")  # should not raise
        _validate_password("Abcdefg1")
        _validate_password("12345678a")

    def test_too_short(self):
        with pytest.raises(HTTPException) as exc:
            _validate_password("abc1")
        assert exc.value.status_code == 400
        assert "8" in exc.value.detail

    def test_exactly_7_chars(self):
        with pytest.raises(HTTPException) as exc:
            _validate_password("abcdef1")  # 7 chars
        assert exc.value.status_code == 400

    def test_exactly_8_chars_passes(self):
        _validate_password("abcdef12")  # 8 chars, should pass

    def test_no_letters(self):
        with pytest.raises(HTTPException) as exc:
            _validate_password("12345678")
        assert exc.value.status_code == 400
        assert "字母" in exc.value.detail

    def test_no_digits(self):
        with pytest.raises(HTTPException) as exc:
            _validate_password("abcdefgh")
        assert exc.value.status_code == 400
        assert "数字" in exc.value.detail

    def test_empty_password(self):
        with pytest.raises(HTTPException):
            _validate_password("")

    def test_unicode_letters_accepted(self):
        """Chinese characters should count as letters (isalpha is True for CJK)."""
        _validate_password("测试密码abc1")  # 8 chars, should pass


# ─── _verify_magic_bytes ───

class TestVerifyMagicBytes:
    def test_mp3_with_id3_tag(self):
        data = b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 50
        assert _verify_magic_bytes(data, "audio") is True

    def test_mp3_frame_header(self):
        data = b"\xff\xfb\x90\x00" + b"\x00" * 100
        assert _verify_magic_bytes(data, "audio") is True

    def test_wav_header(self):
        data = b"RIFF\x00\x00\x00\x00WAVE" + b"\x00" * 50
        assert _verify_magic_bytes(data, "audio") is True

    def test_flac_header(self):
        data = b"fLaC\x00\x00\x00\x22" + b"\x00" * 50
        assert _verify_magic_bytes(data, "audio") is True

    def test_ogg_header(self):
        data = b"OggS\x00\x02\x00\x00" + b"\x00" * 50
        assert _verify_magic_bytes(data, "audio") is True

    def test_m4a_at_offset_4(self):
        data = b"\x00\x00\x00\x20ftypM4A " + b"\x00" * 50
        assert _verify_magic_bytes(data, "audio") is True

    def test_mp4_video(self):
        data = b"\x00\x00\x00\x20ftypmp42" + b"\x00" * 50
        assert _verify_magic_bytes(data, "video") is True

    def test_mkv_video(self):
        data = b"\x1a\x45\xdf\xa3\x01\x00\x00\x00" + b"\x00" * 50
        assert _verify_magic_bytes(data, "video") is True

    def test_avi_video(self):
        data = b"RIFF\x00\x00\x00\x00AVI " + b"\x00" * 50
        assert _verify_magic_bytes(data, "video") is True

    def test_jpeg_image(self):
        data = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 50
        assert _verify_magic_bytes(data, "image") is True

    def test_png_image(self):
        data = b"\x89PNG\r\n\x1a\n\x00\x00\x00" + b"\x00" * 50
        assert _verify_magic_bytes(data, "image") is True

    def test_gif_image(self):
        data = b"GIF89a\x01\x00\x01\x00" + b"\x00" * 50
        assert _verify_magic_bytes(data, "image") is True

    def test_exe_disguised_as_mp3(self):
        """A Windows EXE renamed to .mp3 should fail magic bytes check."""
        data = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 50
        assert _verify_magic_bytes(data, "audio") is False

    def test_too_short_data(self):
        assert _verify_magic_bytes(b"\xff", "audio") is False
        assert _verify_magic_bytes(b"\xff\xfb", "audio") is False
        assert _verify_magic_bytes(b"\xff\xfb\x90", "audio") is False

    def test_empty_data(self):
        assert _verify_magic_bytes(b"", "audio") is False
        assert _verify_magic_bytes(None, "audio") is False

    def test_unknown_file_type(self):
        data = b"\x00" * 100
        assert _verify_magic_bytes(data, "document") is False


# ─── _safe_rel_path ───

class TestSafeRelPath:
    def test_normal_path(self):
        assert _safe_rel_path("audio/test.mp3") == "audio/test.mp3"

    def test_nested_normal_path(self):
        assert _safe_rel_path("video/subfolder/test.mp4") == "video/subfolder/test.mp4"

    def test_empty_path_rejected(self):
        with pytest.raises(HTTPException) as exc:
            _safe_rel_path("")
        assert exc.value.status_code == 404

    def test_dotdot_traversal_rejected(self):
        with pytest.raises(HTTPException):
            _safe_rel_path("../etc/passwd")

    def test_dotdot_in_middle_rejected(self):
        with pytest.raises(HTTPException):
            _safe_rel_path("audio/../../etc/passwd")

    def test_dotdot_with_backslash_rejected(self):
        """Backslash-style traversal should also be blocked."""
        with pytest.raises(HTTPException):
            _safe_rel_path("audio\\..\\..\\etc\\passwd")

    def test_url_encoded_dotdot_passes(self):
        """URL-encoded .. (%2e%2e) is not decoded by this function — it's just a string check.
        The actual traversal protection happens at the realpath level in _serve_media."""
        # This is actually a valid rel_path from the function's perspective
        # (no literal ".." segment), but _serve_media will still verify via realpath.
        result = _safe_rel_path("audio/%2e%2e/test.mp3")
        assert result == "audio/%2e%2e/test.mp3"

    def test_single_dot_passes(self):
        """Single '.' is not a traversal attempt."""
        assert _safe_rel_path("audio/./test.mp3") == "audio/./test.mp3"


# ─── _check_rate_limit ───

class TestCheckRateLimit:
    """Test the in-memory rate limiter.

    Uses a fresh _rate_limit_store for each test by clearing it in setup.
    """

    def _make_request(self, ip="127.0.0.1"):
        req = MagicMock()
        req.client.host = ip
        return req

    def setup_method(self):
        _rate_limit_store.clear()

    def test_allows_under_limit(self):
        req = self._make_request()
        for _ in range(5):
            _check_rate_limit(req, "login", max_attempts=5, window=300)
        # 5 requests should be fine

    def test_blocks_over_limit(self):
        req = self._make_request()
        for _ in range(5):
            _check_rate_limit(req, "login", max_attempts=5, window=300)
        with pytest.raises(HTTPException) as exc:
            _check_rate_limit(req, "login", max_attempts=5, window=300)
        assert exc.value.status_code == 429
        assert "Retry-After" in exc.value.headers

    def test_different_actions_independent(self):
        req = self._make_request()
        # 3 register attempts (limit 3)
        for _ in range(3):
            _check_rate_limit(req, "register", max_attempts=3, window=300)
        # login should still work (different action scope)
        _check_rate_limit(req, "login", max_attempts=5, window=300)

    def test_different_ips_independent(self):
        req1 = self._make_request("10.0.0.1")
        req2 = self._make_request("10.0.0.2")
        for _ in range(5):
            _check_rate_limit(req1, "login", max_attempts=5, window=300)
        # IP 2 should still be allowed
        _check_rate_limit(req2, "login", max_attempts=5, window=300)

    def test_no_client_uses_unknown(self):
        req = MagicMock()
        req.client = None
        for _ in range(5):
            _check_rate_limit(req, "login", max_attempts=5, window=300)
        with pytest.raises(HTTPException):
            _check_rate_limit(req, "login", max_attempts=5, window=300)
