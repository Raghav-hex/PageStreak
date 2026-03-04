from sqlalchemy import (
    Column, Integer, String, Text, LargeBinary,
    DateTime, Date, Float, Boolean, ForeignKey, Enum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class FileType(str, enum.Enum):
    epub = "epub"
    pdf = "pdf"


class BookStatus(str, enum.Enum):
    active = "active"
    completed = "completed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    daily_page_target = Column(Integer, default=10, nullable=False)
    token_invalidated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    books = relationship("Book", back_populates="user", cascade="all, delete-orphan")
    reading_states = relationship("ReadingState", back_populates="user", cascade="all, delete-orphan")
    reading_logs = relationship("ReadingLog", back_populates="user", cascade="all, delete-orphan")
    streak = relationship("Streak", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    author = Column(String(500), nullable=True)
    file_blob = Column(LargeBinary, nullable=False)
    file_type = Column(Enum(FileType), nullable=False)
    total_words = Column(Integer, default=0)
    total_pages = Column(Integer, default=0)   # total_words / 400
    total_chunks = Column(Integer, default=0)  # total_words / 200
    cover_image = Column(LargeBinary, nullable=True)
    cover_mime = Column(String(50), nullable=True)
    status = Column(Enum(BookStatus), default=BookStatus.active)
    uploaded_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="books")
    reading_state = relationship("ReadingState", back_populates="book", uselist=False, cascade="all, delete-orphan")
    reading_logs = relationship("ReadingLog", back_populates="book", cascade="all, delete-orphan")


class ReadingState(Base):
    __tablename__ = "reading_states"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, unique=True)
    current_chunk_index = Column(Integer, default=0)
    last_read_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="reading_states")
    book = relationship("Book", back_populates="reading_state")


class ReadingLog(Base):
    __tablename__ = "reading_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    pages_read = Column(Integer, default=0)
    chunks_read = Column(Integer, default=0)
    time_spent_seconds = Column(Integer, default=0)
    session_start = Column(DateTime, nullable=True)
    session_end = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="reading_logs")
    book = relationship("Book", back_populates="reading_logs")


class Streak(Base):
    __tablename__ = "streaks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_active_at = Column(DateTime, nullable=True)
    # Streak starts from first chunk read in session
    current_session_started_at = Column(DateTime, nullable=True)
    freeze_tokens_remaining = Column(Integer, default=1)
    freeze_used_this_week = Column(Boolean, default=False)
    week_reset_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="streak")
