from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime, date
from app.models.user import FileType, BookStatus


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    daily_page_target: Optional[int] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if v and len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("daily_page_target")
    @classmethod
    def target_positive(cls, v):
        if v and v < 1:
            raise ValueError("Daily page target must be at least 1")
        return v


class UserOut(BaseModel):
    id: int
    email: str
    daily_page_target: int
    created_at: datetime

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Books ─────────────────────────────────────────────────────────────────────

class BookOut(BaseModel):
    id: int
    title: str
    author: Optional[str]
    file_type: FileType
    total_words: int
    total_pages: int
    total_chunks: int
    status: BookStatus
    uploaded_at: datetime
    completed_at: Optional[datetime]
    has_cover: bool

    class Config:
        from_attributes = True


class BookWithProgress(BookOut):
    current_chunk_index: int = 0
    progress_percent: float = 0.0
    last_read_at: Optional[datetime] = None


# ── Reading ───────────────────────────────────────────────────────────────────

class ChunkUpdate(BaseModel):
    book_id: int
    chunk_index: int
    time_spent_seconds: int = 0


class ChunkResponse(BaseModel):
    chunk_index: int
    total_chunks: int
    pages_read_today: int
    daily_target: int
    target_hit: bool


# ── Stats ─────────────────────────────────────────────────────────────────────

class StreakOut(BaseModel):
    current_streak: int
    longest_streak: int
    last_active_at: Optional[datetime]
    freeze_tokens_remaining: int
    freeze_used_this_week: bool

    class Config:
        from_attributes = True


class DailyLogOut(BaseModel):
    date: date
    pages_read: int
    chunks_read: int
    time_spent_seconds: int

    class Config:
        from_attributes = True


class BookStatsOut(BaseModel):
    book_id: int
    title: str
    total_pages: int
    current_page: int
    progress_percent: float
    estimated_finish_date: Optional[date]
    date_started: Optional[date]
    date_finished: Optional[date]
    avg_pages_per_session: float
    total_time_seconds: int
    per_day_logs: List[DailyLogOut]


class DashboardOut(BaseModel):
    streak: StreakOut
    pages_today: int
    daily_target: int
    target_hit: bool
    heatmap: List[DailyLogOut]   # last 365 days
