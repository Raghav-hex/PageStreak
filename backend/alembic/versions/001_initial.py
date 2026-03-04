"""Initial tables

Revision ID: 001_initial
Revises:
Create Date: 2024-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("daily_page_target", sa.Integer(), default=10, nullable=False),
        sa.Column("token_invalidated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("author", sa.String(500), nullable=True),
        sa.Column("file_blob", sa.LargeBinary(), nullable=False),
        sa.Column("file_type", sa.Enum("epub", "pdf", name="filetype"), nullable=False),
        sa.Column("total_words", sa.Integer(), default=0),
        sa.Column("total_pages", sa.Integer(), default=0),
        sa.Column("total_chunks", sa.Integer(), default=0),
        sa.Column("cover_image", sa.LargeBinary(), nullable=True),
        sa.Column("cover_mime", sa.String(50), nullable=True),
        sa.Column("status", sa.Enum("active", "completed", name="bookstatus"), default="active"),
        sa.Column("uploaded_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "reading_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("current_chunk_index", sa.Integer(), default=0),
        sa.Column("last_read_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "reading_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("pages_read", sa.Integer(), default=0),
        sa.Column("chunks_read", sa.Integer(), default=0),
        sa.Column("time_spent_seconds", sa.Integer(), default=0),
        sa.Column("session_start", sa.DateTime(), nullable=True),
        sa.Column("session_end", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "streaks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("current_streak", sa.Integer(), default=0),
        sa.Column("longest_streak", sa.Integer(), default=0),
        sa.Column("last_active_at", sa.DateTime(), nullable=True),
        sa.Column("current_session_started_at", sa.DateTime(), nullable=True),
        sa.Column("freeze_tokens_remaining", sa.Integer(), default=1),
        sa.Column("freeze_used_this_week", sa.Boolean(), default=False),
        sa.Column("week_reset_at", sa.DateTime(), nullable=True),
    )

    # Indexes
    op.create_index("ix_reading_logs_user_date", "reading_logs", ["user_id", "date"])
    op.create_index("ix_books_user_status", "books", ["user_id", "status"])


def downgrade():
    op.drop_table("streaks")
    op.drop_table("reading_logs")
    op.drop_table("reading_states")
    op.drop_table("books")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS filetype")
    op.execute("DROP TYPE IF EXISTS bookstatus")
