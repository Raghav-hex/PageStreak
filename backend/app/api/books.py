import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import Book, ReadingState, FileType, BookStatus
from app.schemas.schemas import BookOut, BookWithProgress
from app.services.book_processor import process_book, resize_cover

router = APIRouter(prefix="/books", tags=["books"])

ALLOWED_TYPES = {
    "application/epub+zip": "epub",
    "application/epub": "epub",
    "application/pdf": "pdf",
    "application/x-pdf": "pdf",
}


@router.post("/upload", response_model=BookOut, status_code=201)
async def upload_book(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Check active book count
    active_count = db.query(Book).filter(
        Book.user_id == current_user.id,
        Book.status == BookStatus.active,
    ).count()
    if active_count >= 5:
        raise HTTPException(
            status_code=400,
            detail="Maximum 5 active books allowed. Complete or remove a book first.",
        )

    # Detect file type
    content_type = file.content_type or ""
    file_ext = (file.filename or "").lower().rsplit(".", 1)[-1]

    if content_type in ALLOWED_TYPES:
        file_type = ALLOWED_TYPES[content_type]
    elif file_ext == "epub":
        file_type = "epub"
    elif file_ext == "pdf":
        file_type = "pdf"
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload an EPUB or PDF file.",
        )

    # Size check
    file_bytes = await file.read()
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f}MB). Maximum is {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )

    # Process book
    try:
        result = process_book(file_bytes, file_type)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to process file: {str(e)}. Please check the file is valid.",
        )

    # Resize cover if present
    cover_bytes = None
    cover_mime = None
    if result.get("cover_bytes"):
        cover_bytes = resize_cover(result["cover_bytes"])
        cover_mime = "image/jpeg"

    # Save to DB
    book = Book(
        user_id=current_user.id,
        title=result["title"],
        author=result.get("author"),
        file_blob=file_bytes,
        file_type=FileType(file_type),
        total_words=result["total_words"],
        total_pages=result["total_pages"],
        total_chunks=result["total_chunks"],
        cover_image=cover_bytes,
        cover_mime=cover_mime,
        status=BookStatus.active,
    )
    db.add(book)
    db.flush()

    # Create initial reading state
    state = ReadingState(user_id=current_user.id, book_id=book.id, current_chunk_index=0)
    db.add(state)
    db.commit()
    db.refresh(book)

    return _book_to_out(book)


@router.get("/", response_model=List[BookWithProgress])
def list_books(
    status: str = "active",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Book).filter(Book.user_id == current_user.id)
    if status == "completed":
        query = query.filter(Book.status == BookStatus.completed)
    else:
        query = query.filter(Book.status == BookStatus.active)

    books = query.order_by(Book.uploaded_at.desc()).all()
    return [_book_with_progress(b, db) for b in books]


@router.get("/{book_id}", response_model=BookWithProgress)
def get_book(book_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    book = _get_user_book(book_id, current_user.id, db)
    return _book_with_progress(book, db)


@router.get("/{book_id}/cover")
def get_cover(book_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    book = _get_user_book(book_id, current_user.id, db)
    if not book.cover_image:
        raise HTTPException(status_code=404, detail="No cover image")
    return Response(content=book.cover_image, media_type=book.cover_mime or "image/jpeg")


@router.get("/{book_id}/chunks/{chunk_index}")
def get_chunk(
    book_id: int,
    chunk_index: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return a specific chunk's HTML content + surrounding assets."""
    book = _get_user_book(book_id, current_user.id, db)

    try:
        result = process_book(book.file_blob, book.file_type.value)
        chunks = result["chunks"]
        assets = result.get("assets", {})
        toc = result.get("toc", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load book: {e}")

    if chunk_index < 0 or chunk_index >= len(chunks):
        raise HTTPException(status_code=404, detail="Chunk index out of range")

    chunk = chunks[chunk_index]

    return {
        "chunk_index": chunk_index,
        "total_chunks": len(chunks),
        "html": chunk["html"],
        "word_count": chunk["word_count"],
        "toc": toc,
        "assets": assets,
        "book_title": book.title,
        "book_author": book.author,
    }


@router.get("/{book_id}/toc")
def get_toc(book_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    book = _get_user_book(book_id, current_user.id, db)
    try:
        result = process_book(book.file_blob, book.file_type.value)
        return {"toc": result.get("toc", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{book_id}/file")
def get_file(book_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Serve raw book file for epub.js / pdf.js rendering."""
    book = _get_user_book(book_id, current_user.id, db)
    media_type = "application/epub+zip" if book.file_type.value == "epub" else "application/pdf"
    return Response(
        content=book.file_blob,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{book.title}.{book.file_type.value}"'},
    )


@router.post("/{book_id}/complete")
def mark_complete(
    book_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    book = _get_user_book(book_id, current_user.id, db)
    book.status = BookStatus.completed
    book.completed_at = datetime.utcnow()
    db.commit()
    return {"message": "Book marked as completed"}


@router.delete("/{book_id}")
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    book = _get_user_book(book_id, current_user.id, db)
    db.delete(book)
    db.commit()
    return {"message": "Book deleted"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_user_book(book_id: int, user_id: int, db: Session) -> Book:
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


def _book_to_out(book: Book) -> dict:
    return BookOut(
        id=book.id,
        title=book.title,
        author=book.author,
        file_type=book.file_type,
        total_words=book.total_words,
        total_pages=book.total_pages,
        total_chunks=book.total_chunks,
        status=book.status,
        uploaded_at=book.uploaded_at,
        completed_at=book.completed_at,
        has_cover=book.cover_image is not None,
    )


def _book_with_progress(book: Book, db: Session) -> BookWithProgress:
    state = db.query(ReadingState).filter(
        ReadingState.book_id == book.id
    ).first()

    current_chunk = state.current_chunk_index if state else 0
    last_read = state.last_read_at if state else None
    progress = (current_chunk / book.total_chunks * 100) if book.total_chunks > 0 else 0.0

    return BookWithProgress(
        id=book.id,
        title=book.title,
        author=book.author,
        file_type=book.file_type,
        total_words=book.total_words,
        total_pages=book.total_pages,
        total_chunks=book.total_chunks,
        status=book.status,
        uploaded_at=book.uploaded_at,
        completed_at=book.completed_at,
        has_cover=book.cover_image is not None,
        current_chunk_index=current_chunk,
        progress_percent=round(progress, 1),
        last_read_at=last_read,
    )
