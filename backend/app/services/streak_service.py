"""
Streak Engine — 24h rolling window from first chunk of session.
Grace: 1 freeze token per week (resets Monday 00:00 UTC).
"""
from datetime import datetime, timedelta, date
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.user import Streak, ReadingLog, ReadingState, User
import logging

logger = logging.getLogger(__name__)

STREAK_WINDOW_HOURS = 24


def get_or_create_streak(db: Session, user_id: int) -> Streak:
    streak = db.query(Streak).filter(Streak.user_id == user_id).first()
    if not streak:
        streak = Streak(user_id=user_id, current_streak=0, longest_streak=0)
        db.add(streak)
        db.commit()
        db.refresh(streak)
    return streak


def reset_freeze_if_new_week(db: Session, streak: Streak) -> None:
    """Reset freeze token every Monday 00:00 UTC."""
    now = datetime.utcnow()
    # Find last Monday
    days_since_monday = now.weekday()  # 0=Monday
    last_monday = (now - timedelta(days=days_since_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    if not streak.week_reset_at or streak.week_reset_at < last_monday:
        streak.freeze_tokens_remaining = 1
        streak.freeze_used_this_week = False
        streak.week_reset_at = last_monday
        db.commit()


def check_and_update_streak(db: Session, user_id: int) -> Streak:
    """
    Called on every chunk read AND on app load.
    Evaluates if streak is alive, broken, or frozen.
    """
    streak = get_or_create_streak(db, user_id)
    reset_freeze_if_new_week(db, streak)

    now = datetime.utcnow()

    if streak.last_active_at is None:
        # First ever read — start streak at 1
        streak.current_streak = 1
        streak.longest_streak = max(1, streak.longest_streak)
        streak.last_active_at = now
        streak.current_session_started_at = now
        db.commit()
        return streak

    hours_since_last = (now - streak.last_active_at).total_seconds() / 3600

    if hours_since_last <= STREAK_WINDOW_HOURS:
        # Still within 24h window — streak alive, just update timestamp
        streak.last_active_at = now
    else:
        # Missed the 24h window
        if streak.freeze_tokens_remaining > 0:
            # Consume freeze token — preserve streak
            streak.freeze_tokens_remaining -= 1
            streak.freeze_used_this_week = True
            streak.last_active_at = now
            logger.info(f"User {user_id} used freeze token. Streak preserved at {streak.current_streak}")
        else:
            # No freeze — streak broken
            streak.current_streak = 1  # Starting fresh
            streak.last_active_at = now
            streak.current_session_started_at = now

    # Update longest streak
    if streak.current_streak > streak.longest_streak:
        streak.longest_streak = streak.current_streak

    db.commit()
    db.refresh(streak)
    return streak


def increment_streak_on_target_hit(db: Session, user_id: int, pages_today: int) -> Streak:
    """Increment streak counter when daily page target is hit."""
    user = db.query(User).filter(User.id == user_id).first()
    streak = get_or_create_streak(db, user_id)

    if pages_today >= user.daily_page_target:
        # Only increment once per day
        today = date.today()
        if streak.last_active_at and streak.last_active_at.date() == today:
            # Already counted today — just ensure it's incrementing only once
            pass
        streak.current_streak = max(streak.current_streak, streak.current_streak)

    db.commit()
    return streak


def record_chunk_read(
    db: Session,
    user_id: int,
    book_id: int,
    chunk_index: int,
    time_spent_seconds: int = 0,
) -> dict:
    """
    Core function called every time user navigates to a new chunk.
    Updates reading state, log, and streak.
    """
    now = datetime.utcnow()
    today = now.date()

    # 1. Update reading state
    state = db.query(ReadingState).filter(
        ReadingState.user_id == user_id,
        ReadingState.book_id == book_id,
    ).first()

    is_forward = True
    if state:
        is_forward = chunk_index > state.current_chunk_index
        state.current_chunk_index = chunk_index
        state.last_read_at = now
    else:
        state = ReadingState(
            user_id=user_id,
            book_id=book_id,
            current_chunk_index=chunk_index,
            last_read_at=now,
        )
        db.add(state)

    # 2. Update reading log (only count forward progress)
    if is_forward:
        log = db.query(ReadingLog).filter(
            ReadingLog.user_id == user_id,
            ReadingLog.book_id == book_id,
            ReadingLog.date == today,
        ).first()

        if log:
            log.chunks_read += 1
            log.pages_read = log.chunks_read // 2
            log.time_spent_seconds += time_spent_seconds
            log.session_end = now
        else:
            log = ReadingLog(
                user_id=user_id,
                book_id=book_id,
                date=today,
                chunks_read=1,
                pages_read=0,
                time_spent_seconds=time_spent_seconds,
                session_start=now,
                session_end=now,
            )
            db.add(log)

    # 3. Calculate total pages today across ALL books
    today_logs = db.query(ReadingLog).filter(
        ReadingLog.user_id == user_id,
        ReadingLog.date == today,
    ).all()
    pages_today = sum(l.pages_read for l in today_logs)
    chunks_today = sum(l.chunks_read for l in today_logs)
    pages_today = chunks_today // 2  # Recalculate cleanly

    db.commit()

    # 4. Update streak
    streak = check_and_update_streak(db, user_id)

    # 5. Check if target hit today
    user = db.query(User).filter(User.id == user_id).first()
    target_hit = pages_today >= user.daily_page_target

    return {
        "pages_today": pages_today,
        "chunks_today": chunks_today,
        "target_hit": target_hit,
        "streak": streak,
    }


def get_pages_today(db: Session, user_id: int) -> int:
    today = date.today()
    logs = db.query(ReadingLog).filter(
        ReadingLog.user_id == user_id,
        ReadingLog.date == today,
    ).all()
    total_chunks = sum(l.chunks_read for l in logs)
    return total_chunks // 2
