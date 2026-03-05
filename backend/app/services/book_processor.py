"""
Book processing service.
Priority: EPUB layout/formatting > images > fonts > speed.

Key optimization: parse once, cache in memory.
_BOOK_CACHE keeps last 5 parsed books so chunk requests don't re-parse.
"""
import io
import re
import base64
import tempfile
import os
import hashlib
import logging
from collections import OrderedDict
from typing import Optional, Tuple, List, Dict, Any
from PIL import Image

import ebooklib
from ebooklib import epub
from pdfminer.high_level import extract_text as pdf_extract_text
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

WORDS_PER_CHUNK = 200
WORDS_PER_PAGE  = 400   # 2 chunks = 1 page
_CACHE_MAX      = 5     # max books held in memory

# LRU cache: book_id -> {"hash": str, "result": dict}
_BOOK_CACHE: OrderedDict = OrderedDict()


def _file_hash(file_bytes: bytes) -> str:
    """Quick hash using first 8KB — enough to detect file changes."""
    return hashlib.md5(file_bytes[:8192]).hexdigest()


def process_book_cached(book_id: int, file_bytes: bytes, file_type: str) -> Dict[str, Any]:
    """Return cached parse result or reparse if cache miss."""
    fh = _file_hash(file_bytes)
    entry = _BOOK_CACHE.get(book_id)
    if entry and entry["hash"] == fh:
        _BOOK_CACHE.move_to_end(book_id)   # refresh LRU order
        return entry["result"]

    result = process_book(file_bytes, file_type)

    if len(_BOOK_CACHE) >= _CACHE_MAX:
        _BOOK_CACHE.popitem(last=False)    # evict oldest
    _BOOK_CACHE[book_id] = {"hash": fh, "result": result}
    return result


def count_words(text: str) -> int:
    return len(re.findall(r'\b\w+\b', text))


def extract_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    return soup.get_text(separator=" ")


# ── EPUB ───────────────────────────────────────────────────────────────────────

def process_epub(file_bytes: bytes) -> Dict[str, Any]:
    # mkstemp + close fd before ebooklib reads (NamedTemporaryFile stays open on Linux)
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".epub")
    try:
        with os.fdopen(tmp_fd, "wb") as tmp:
            tmp.write(file_bytes)
        try:
            book = epub.read_epub(tmp_path)
        except Exception as e:
            raise ValueError(
                f"Failed to parse EPUB ({e}). "
                "The file may be DRM-protected, corrupted, or not a valid EPUB."
            )
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    spine_items: List[Dict] = []
    total_words = 0
    assets: Dict[str, Any] = {}

    # Assets (fonts, images, CSS) as base64
    for item in book.get_items():
        if item.get_type() in (ebooklib.ITEM_IMAGE, ebooklib.ITEM_FONT, ebooklib.ITEM_STYLE):
            try:
                b64 = base64.b64encode(item.get_content()).decode("utf-8")
                assets[item.get_name()] = {"data": b64, "media_type": item.media_type}
            except Exception:
                pass

    # Spine documents
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        try:
            html_content = item.get_content().decode("utf-8", errors="replace")
            plain_text   = extract_text_from_html(html_content)
            wc = count_words(plain_text)
            total_words += wc
            spine_items.append({"id": item.get_id(), "name": item.get_name(), "html": html_content, "word_count": wc})
        except Exception as e:
            logger.warning(f"Spine item {item.get_id()} failed: {e}")

    # TOC
    def parse_toc(items, level=0):
        out = []
        for item in items:
            if isinstance(item, epub.Link):
                out.append({"title": item.title, "href": item.href, "level": level})
            elif isinstance(item, tuple) and len(item) == 2:
                sec, children = item
                if hasattr(sec, "title"):
                    out.append({"title": sec.title, "href": getattr(sec, "href", ""), "level": level})
                out.extend(parse_toc(children, level + 1))
        return out

    toc = parse_toc(book.toc)

    # Cover
    cover_bytes = cover_mime = None
    try:
        cover_id = None
        for meta in book.metadata.get("http://www.idpf.org/2007/opf", {}).get("meta", []):
            if meta[1].get("name") == "cover":
                cover_id = meta[1].get("content")
                break
        if cover_id:
            ci = book.get_item_with_id(cover_id)
            if ci:
                cover_bytes, cover_mime = ci.get_content(), ci.media_type
        if not cover_bytes:
            for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
                cover_bytes, cover_mime = item.get_content(), item.media_type
                break
    except Exception as e:
        logger.warning(f"Cover extraction failed: {e}")

    chunks      = build_chunks_from_spine(spine_items)
    total_chunks = len(chunks)
    total_pages  = max(1, total_words // WORDS_PER_PAGE)

    return {
        "title":        str(book.title) if book.title else "Unknown Title",
        "author":       _get_author(book),
        "total_words":  total_words,
        "total_chunks": total_chunks,
        "total_pages":  total_pages,
        "cover_bytes":  cover_bytes,
        "cover_mime":   cover_mime,
        "chunks":       chunks,
        "toc":          toc,
        "assets":       assets,
        "spine_items":  [{"id": s["id"], "name": s["name"]} for s in spine_items],
    }


def build_chunks_from_spine(spine_items: List[Dict]) -> List[Dict]:
    all_blocks = []
    for item in spine_items:
        soup  = BeautifulSoup(item["html"], "lxml")
        body  = soup.find("body") or soup
        blocks = body.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li"])
        if not blocks:
            blocks = body.find_all(True)
        for block in blocks:
            text = block.get_text(separator=" ").strip()
            if text and len(text) > 10:
                all_blocks.append({"html": str(block), "word_count": count_words(text)})

    chunks = []
    parts, wc = [], 0
    for block in all_blocks:
        parts.append(block["html"])
        wc += block["word_count"]
        if wc >= WORDS_PER_CHUNK:
            chunks.append({"index": len(chunks), "html": "\n".join(parts), "word_count": wc})
            parts, wc = [], 0

    if parts:
        chunks.append({"index": len(chunks), "html": "\n".join(parts), "word_count": wc})

    if not chunks:
        chunks.append({"index": 0, "html": "<p>Could not extract text from this EPUB.</p>", "word_count": 0})

    return chunks


def _get_author(book: epub.EpubBook) -> Optional[str]:
    try:
        creators = book.metadata.get("http://purl.org/dc/elements/1.1/", {}).get("creator", [])
        if creators:
            return str(creators[0][0])
    except Exception:
        pass
    return None


# ── PDF ────────────────────────────────────────────────────────────────────────

def process_pdf(file_bytes: bytes) -> Dict[str, Any]:
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(tmp_fd, "wb") as tmp:
            tmp.write(file_bytes)
        text = pdf_extract_text(tmp_path)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    if not text or not text.strip():
        raise ValueError(
            "Could not extract text from PDF. "
            "File may be scanned/image-only or password protected."
        )

    total_words  = count_words(text)
    chunks       = _split_text_to_chunks(text)
    total_chunks = len(chunks)
    total_pages  = max(1, total_words // WORDS_PER_PAGE)

    return {
        "title":        "Untitled PDF",
        "author":       None,
        "total_words":  total_words,
        "total_chunks": total_chunks,
        "total_pages":  total_pages,
        "cover_bytes":  None,
        "cover_mime":   None,
        "chunks":       chunks,
        "toc":          [],
        "assets":       {},
        "spine_items":  [],
    }


def _split_text_to_chunks(text: str) -> List[Dict]:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks, sents, wc = [], [], 0
    for s in sentences:
        sents.append(s)
        wc += count_words(s)
        if wc >= WORDS_PER_CHUNK:
            # Wrap in readable paragraphs
            para = " ".join(sents).replace("\n\n", "</p><p>").replace("\n", " ")
            chunks.append({"index": len(chunks), "html": f"<p>{para}</p>", "word_count": wc})
            sents, wc = [], 0
    if sents:
        para = " ".join(sents).replace("\n\n", "</p><p>").replace("\n", " ")
        chunks.append({"index": len(chunks), "html": f"<p>{para}</p>", "word_count": wc})
    return chunks


# ── Unified ────────────────────────────────────────────────────────────────────

def process_book(file_bytes: bytes, file_type: str) -> Dict[str, Any]:
    if file_type == "epub":
        return process_epub(file_bytes)
    elif file_type == "pdf":
        return process_pdf(file_bytes)
    raise ValueError(f"Unsupported file type: {file_type}")


def resize_cover(cover_bytes: bytes, max_size: Tuple[int, int] = (400, 600)) -> bytes:
    try:
        img = Image.open(io.BytesIO(cover_bytes))
        img.thumbnail(max_size, Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=85)
        return out.getvalue()
    except Exception:
        return cover_bytes
