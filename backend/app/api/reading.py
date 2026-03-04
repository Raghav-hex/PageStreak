from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import date, timedelta, datetime
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import ReadingLog, ReadingState, Book, Streak
from app.schemas.schemas import ChunkUpdate, ChunkResponse, DashboardOut, BookStatsOut, DailyLogOut, StreakOut
from app.services.streak_service import record_chunk_read, get_or_create_streak, check_and_update_streak, get_pages_today

router = APIRouter(prefix="/reading", tags=["reading"])


@router.post("/progress", response_model=ChunkResponse)
def update_progress(
    data: ChunkUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Called every time the user navigates to a new chunk."""
    # Verify book belongs to user
    book = db.query(Book).filter(
        Book.id == data.book_id,
        Book.user_id == current_user.id,
    ).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if data.chunk_index < 0 or data.chunk_index >= book.total_chunks:
        raise HTTPException(status_code=400, detail="Invalid chunk index")

    result = record_chunk_read(
        db=db,
        user_id=current_user.id,
        book_id=data.book_id,
        chunk_index=data.chunk_index,
        time_spent_seconds=data.time_spent_seconds,
    )

    return ChunkResponse(
        chunk_index=data.chunk_index,
        total_chunks=book.total_chunks,
        pages_read_today=result["pages_today"],
        daily_target=current_user.daily_page_target,
        target_hit=result["target_hit"],
    )


@router.get("/dashboard", response_model=DashboardOut)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Check streak status on load
    streak = check_and_update_streak(db, current_user.id)
    pages_today = get_pages_today(db, current_user.id)
    target_hit = pages_today >= current_user.daily_page_target

    # Heatmap: last 365 days
    one_year_ago = date.today() - timedelta(days=365)
    logs = db.query(ReadingLog).filter(
        ReadingLog.user_id == current_user.id,
        ReadingLog.date >= one_year_ago,
    ).all()

    # Aggregate by date
    date_map: dict = {}
    for log in logs:
        key = log.date
        if key not in date_map:
            date_map[key] = DailyLogOut(
                date=key, pages_read=0, chunks_read=0, time_spent_seconds=0
            )
        date_map[key].pages_read += log.pages_read
        date_map[key].chunks_read += log.chunks_read
        date_map[key].time_spent_seconds += log.time_spent_seconds

    heatmap = sorted(date_map.values(), key=lambda x: x.date)

    return DashboardOut(
        streak=StreakOut.model_validate(streak),
        pages_today=pages_today,
        daily_target=current_user.daily_page_target,
        target_hit=target_hit,
        heatmap=heatmap,
    )


@router.get("/books/{book_id}/stats", response_model=BookStatsOut)
def get_book_stats(
    book_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    book = db.query(Book).filter(
        Book.id == book_id, Book.user_id == current_user.id
    ).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    state = db.query(ReadingState).filter(
        ReadingState.book_id == book_id
    ).first()
    current_chunk = state.current_chunk_index if state else 0
    current_page = current_chunk // 2
    progress = (current_chunk / book.total_chunks * 100) if book.total_chunks > 0 else 0.0

    # Logs for this book
    logs = db.query(ReadingLog).filter(
        ReadingLog.user_id == current_user.id,
        ReadingLog.book_id == book_id,
    ).order_by(ReadingLog.date).all()

    total_time = sum(l.time_spent_seconds for l in logs)
    date_started = logs[0].date if logs else None
    date_finished = book.completed_at.date() if book.completed_at else None

    # Average pages per session
    sessions_with_pages = [l for l in logs if l.pages_read > 0]
    avg_pages = (
        sum(l.pages_read for l in sessions_with_pages) / len(sessions_with_pages)
        if sessions_with_pages else 0.0
    )

    # Estimated finish date
    estimated_finish = None
    remaining_pages = book.total_pages - current_page
    if avg_pages > 0 and remaining_pages > 0:
        days_needed = int(remaining_pages / avg_pages) + 1
        estimated_finish = date.today() + timedelta(days=days_needed)

    per_day = [
        DailyLogOut(
            date=l.date,
            pages_read=l.pages_read,
            chunks_read=l.chunks_read,
            time_spent_seconds=l.time_spent_seconds,
        )
        for l in logs
    ]

    return BookStatsOut(
        book_id=book.id,
        title=book.title,
        total_pages=book.total_pages,
        current_page=current_page,
        progress_percent=round(progress, 1),
        estimated_finish_date=estimated_finish,
        date_started=date_started,
        date_finished=date_finished,
        avg_pages_per_session=round(avg_pages, 1),
        total_time_seconds=total_time,
        per_day_logs=per_day,
    )
