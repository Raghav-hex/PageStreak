"""
Book processing service.
Priority: EPUB layout/formatting > images > fonts > speed.
Uses ebooklib for EPUB extraction preserving original HTML/CSS.
Uses pdfminer for PDF text extraction (treated like EPUB chunks).
"""
import io
import re
import base64
import zipfile
import logging
from typing import Optional, Tuple, List, Dict, Any
from PIL import Image

import ebooklib
from ebooklib import epub
from pdfminer.high_level import extract_text as pdf_extract_text
from pdfminer.high_level import extract_pages
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

WORDS_PER_CHUNK = 200
WORDS_PER_PAGE = 400   # 2 chunks = 1 page


def count_words(text: str) -> int:
    """Count words in a string."""
    return len(re.findall(r'\b\w+\b', text))


def extract_text_from_html(html: str) -> str:
    """Extract plain text from HTML for word counting."""
    soup = BeautifulSoup(html, "lxml")
    return soup.get_text(separator=" ")


# ── EPUB Processing ────────────────────────────────────────────────────────────

def process_epub(file_bytes: bytes) -> Dict[str, Any]:
    """
    Process an EPUB file and extract:
    - Spine items (chapters) as raw HTML — preserving original formatting
    - Embedded assets (fonts, images, CSS) as base64
    - Cover image
    - Table of contents
    - Total word count → pages/chunks
    """
    book = epub.read_epub(io.BytesIO(file_bytes))

    spine_items: List[Dict] = []
    total_words = 0
    toc = []
    assets: Dict[str, str] = {}  # href → base64

    # Extract all non-spine items (fonts, images, CSS) as assets
    for item in book.get_items():
        if item.get_type() in (
            ebooklib.ITEM_IMAGE,
            ebooklib.ITEM_FONT,
            ebooklib.ITEM_STYLE,
        ):
            try:
                b64 = base64.b64encode(item.get_content()).decode("utf-8")
                assets[item.get_name()] = {
                    "data": b64,
                    "media_type": item.media_type,
                }
            except Exception:
                pass

    # Extract spine (reading order) — preserve original HTML
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        try:
            html_content = item.get_content().decode("utf-8", errors="replace")
            plain_text = extract_text_from_html(html_content)
            word_count = count_words(plain_text)
            total_words += word_count

            spine_items.append({
                "id": item.get_id(),
                "name": item.get_name(),
                "html": html_content,
                "word_count": word_count,
            })
        except Exception as e:
            logger.warning(f"Failed to process spine item {item.get_id()}: {e}")

    # Extract TOC
    def parse_toc(toc_items, level=0):
        result = []
        for item in toc_items:
            if isinstance(item, epub.Link):
                result.append({
                    "title": item.title,
                    "href": item.href,
                    "level": level,
                })
            elif isinstance(item, tuple) and len(item) == 2:
                section, children = item
                if hasattr(section, "title"):
                    result.append({
                        "title": section.title,
                        "href": getattr(section, "href", ""),
                        "level": level,
                    })
                result.extend(parse_toc(children, level + 1))
        return result

    toc = parse_toc(book.toc)

    # Extract cover image
    cover_bytes = None
    cover_mime = None
    try:
        # Try metadata cover
        cover_id = None
        for meta in book.metadata.get("http://www.idpf.org/2007/opf", {}).get("meta", []):
            if meta[1].get("name") == "cover":
                cover_id = meta[1].get("content")
                break

        if cover_id:
            cover_item = book.get_item_with_id(cover_id)
            if cover_item:
                cover_bytes = cover_item.get_content()
                cover_mime = cover_item.media_type

        if not cover_bytes:
            # Fallback: first image in book
            for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
                cover_bytes = item.get_content()
                cover_mime = item.media_type
                break
    except Exception as e:
        logger.warning(f"Cover extraction failed: {e}")

    # Build chunks across the entire spine — flows freely across chapters
    chunks = build_chunks_from_spine(spine_items)

    total_chunks = len(chunks)
    total_pages = max(1, total_words // WORDS_PER_PAGE)

    return {
        "title": str(book.title) if book.title else "Unknown Title",
        "author": _get_author(book),
        "total_words": total_words,
        "total_chunks": total_chunks,
        "total_pages": total_pages,
        "cover_bytes": cover_bytes,
        "cover_mime": cover_mime,
        "chunks": chunks,         # List of {index, html, word_count}
        "toc": toc,
        "assets": assets,         # All fonts/images/css keyed by href
        "spine_items": [{"id": s["id"], "name": s["name"]} for s in spine_items],
    }


def build_chunks_from_spine(spine_items: List[Dict]) -> List[Dict]:
    """
    Split spine items into ~200-word HTML chunks.
    Chunks flow freely across chapter boundaries for consistent size.
    Splitting is done at sentence boundaries where possible.
    """
    chunks = []
    chunk_index = 0

    # Collect all paragraphs/blocks across the spine
    all_blocks = []
    for item in spine_items:
        soup = BeautifulSoup(item["html"], "lxml")
        # Get body content
        body = soup.find("body") or soup
        blocks = body.find_all(
            ["p", "h1", "h2", "h3", "h4", "h5", "h6", "div", "section", "blockquote", "li"],
            recursive=False
        )
        if not blocks:
            # Fallback: use all text-containing tags
            blocks = body.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6"])

        for block in blocks:
            text = block.get_text(separator=" ").strip()
            if text:
                all_blocks.append({
                    "html": str(block),
                    "text": text,
                    "word_count": count_words(text),
                })

    # Group blocks into ~200-word chunks
    current_html_parts = []
    current_word_count = 0

    for block in all_blocks:
        current_html_parts.append(block["html"])
        current_word_count += block["word_count"]

        if current_word_count >= WORDS_PER_CHUNK:
            chunks.append({
                "index": chunk_index,
                "html": "\n".join(current_html_parts),
                "word_count": current_word_count,
            })
            chunk_index += 1
            current_html_parts = []
            current_word_count = 0

    # Don't lose the last partial chunk
    if current_html_parts:
        chunks.append({
            "index": chunk_index,
            "html": "\n".join(current_html_parts),
            "word_count": current_word_count,
        })

    return chunks


def _get_author(book: epub.EpubBook) -> Optional[str]:
    try:
        creators = book.metadata.get("http://purl.org/dc/elements/1.1/", {}).get("creator", [])
        if creators:
            return str(creators[0][0])
    except Exception:
        pass
    return None


# ── PDF Processing ─────────────────────────────────────────────────────────────

def process_pdf(file_bytes: bytes) -> Dict[str, Any]:
    """
    Extract text from PDF and build chunks identical to EPUB flow.
    PDFs are rendered as text chunks — no original layout preservation.
    """
    text = pdf_extract_text(io.BytesIO(file_bytes))
    if not text:
        raise ValueError("Could not extract text from PDF. File may be scanned/image-only.")

    total_words = count_words(text)
    chunks = _split_text_to_chunks(text)
    total_chunks = len(chunks)
    total_pages = max(1, total_words // WORDS_PER_PAGE)

    return {
        "title": "Untitled PDF",
        "author": None,
        "total_words": total_words,
        "total_chunks": total_chunks,
        "total_pages": total_pages,
        "cover_bytes": None,
        "cover_mime": None,
        "chunks": chunks,
        "toc": [],
        "assets": {},
        "spine_items": [],
    }


def _split_text_to_chunks(text: str) -> List[Dict]:
    """Split plain text into ~200-word HTML chunks at sentence boundaries."""
    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    chunk_index = 0
    current_sentences = []
    current_words = 0

    for sentence in sentences:
        word_count = count_words(sentence)
        current_sentences.append(sentence)
        current_words += word_count

        if current_words >= WORDS_PER_CHUNK:
            chunk_text = " ".join(current_sentences)
            chunks.append({
                "index": chunk_index,
                "html": f"<p>{chunk_text}</p>",
                "word_count": current_words,
            })
            chunk_index += 1
            current_sentences = []
            current_words = 0

    if current_sentences:
        chunk_text = " ".join(current_sentences)
        chunks.append({
            "index": chunk_index,
            "html": f"<p>{chunk_text}</p>",
            "word_count": current_words,
        })

    return chunks


# ── Unified entry point ────────────────────────────────────────────────────────

def process_book(file_bytes: bytes, file_type: str) -> Dict[str, Any]:
    """Process EPUB or PDF and return unified result dict."""
    if file_type == "epub":
        return process_epub(file_bytes)
    elif file_type == "pdf":
        return process_pdf(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def resize_cover(cover_bytes: bytes, max_size: Tuple[int, int] = (400, 600)) -> bytes:
    """Resize cover image to reasonable dimensions."""
    try:
        img = Image.open(io.BytesIO(cover_bytes))
        img.thumbnail(max_size, Image.LANCZOS)
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=85)
        return output.getvalue()
    except Exception:
        return cover_bytes
