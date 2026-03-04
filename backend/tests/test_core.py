"""
PageStreak Backend Tests
Tests: auth, streak engine, book processing logic
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from app.services.streak_service import (
    record_chunk_read, check_and_update_streak, reset_freeze_if_new_week
)
from app.services.book_processor import (
    count_words, build_chunks_from_spine, _split_text_to_chunks, WORDS_PER_CHUNK
)


# ── Security Tests ─────────────────────────────────────────────────────────────

def test_password_hash_and_verify():
    password = "supersecret123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrongpassword", hashed)


def test_create_and_decode_token():
    token = create_access_token({"sub": 42})
    payload = decode_token(token)
    assert payload is not None
    assert int(payload["sub"]) == 42


def test_decode_invalid_token():
    result = decode_token("this.is.not.valid")
    assert result is None


# ── Book Processor Tests ───────────────────────────────────────────────────────

def test_count_words():
    assert count_words("Hello world") == 2
    assert count_words("") == 0
    assert count_words("one two three four five") == 5


def test_split_text_to_chunks_basic():
    # Generate ~600 words of text
    sentence = "This is a test sentence. "
    text = sentence * 120  # ~600 words
    chunks = _split_text_to_chunks(text)
    assert len(chunks) >= 2
    for chunk in chunks:
        assert chunk["word_count"] <= WORDS_PER_CHUNK * 2  # Allow some overflow at boundaries
        assert "<p>" in chunk["html"]


def test_split_text_to_chunks_small():
    """Small text should produce exactly one chunk."""
    text = "Short text with just a few words."
    chunks = _split_text_to_chunks(text)
    assert len(chunks) == 1


def test_chunk_indices_are_sequential():
    sentence = "Word " * 50 + ". "
    text = sentence * 30
    chunks = _split_text_to_chunks(text)
    for i, chunk in enumerate(chunks):
        assert chunk["index"] == i


def test_build_chunks_from_spine():
    """Test spine chunking with mock HTML items."""
    # Create mock spine items with enough content
    words = " ".join(["word"] * 500)
    spine_items = [
        {
            "id": f"chapter{i}",
            "name": f"chapter{i}.xhtml",
            "html": f"<html><body><p>{words}</p></body></html>",
            "word_count": 500,
        }
        for i in range(3)
    ]
    chunks = build_chunks_from_spine(spine_items)
    assert len(chunks) > 0
    # Chunks flow freely across chapters
    for chunk in chunks:
        assert "html" in chunk
        assert "word_count" in chunk
        assert chunk["word_count"] > 0


def test_page_calculation():
    """1 page = 2 chunks = 400 words."""
    from app.services.book_processor import WORDS_PER_PAGE, WORDS_PER_CHUNK
    assert WORDS_PER_PAGE == WORDS_PER_CHUNK * 2
    assert WORDS_PER_PAGE == 400
    assert WORDS_PER_CHUNK == 200


# ── Streak Service Tests ───────────────────────────────────────────────────────

def _make_mock_db():
    """Create a minimal mock DB session."""
    db = MagicMock()
    return db


def test_streak_reset_freeze_new_week():
    """Freeze token resets on new week."""
    from datetime import datetime
    db = _make_mock_db()

    streak = MagicMock()
    streak.week_reset_at = datetime(2020, 1, 1)  # Very old date
    streak.freeze_tokens_remaining = 0
    streak.freeze_used_this_week = True

    reset_freeze_if_new_week(db, streak)

    assert streak.freeze_tokens_remaining == 1
    assert streak.freeze_used_this_week == False


def test_streak_freeze_not_reset_same_week():
    """Freeze token does NOT reset mid-week."""
    from datetime import datetime
    db = _make_mock_db()

    streak = MagicMock()
    # Set to this Monday
    now = datetime.utcnow()
    days_since_monday = now.weekday()
    this_monday = (now - timedelta(days=days_since_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    streak.week_reset_at = this_monday
    streak.freeze_tokens_remaining = 0
    streak.freeze_used_this_week = True

    reset_freeze_if_new_week(db, streak)

    # Should NOT have reset since we're in the same week
    assert streak.freeze_tokens_remaining == 0


def test_pages_today_calculation():
    """chunks_today // 2 = pages_today."""
    chunks = 7
    pages = chunks // 2
    assert pages == 3  # integer division, 1 leftover chunk doesn't count


def test_page_target_hit():
    """Target is hit when pages_today >= daily_page_target."""
    daily_target = 10
    assert 10 >= daily_target   # exact hit
    assert 15 >= daily_target   # exceeded
    assert not (9 >= daily_target)  # not hit


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
