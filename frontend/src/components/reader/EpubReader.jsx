import { useEffect, useRef, useState, useCallback } from 'react'
import Epub from 'epubjs'
import { booksApi, readingApi } from '../../services/api'
import TOCDrawer from './TOCDrawer'
import ReaderToolbar from './ReaderToolbar'
import ChunkProgressBar from './ChunkProgressBar'

const THEMES = {
  dark:  { background: '#1a1a1a', color: '#e8e6e3', link: '#7eb3e8' },
  light: { background: '#ffffff', color: '#222222', link: '#1a6ac8' },
  sepia: { background: '#f4ecd8', color: '#3b2f1e', link: '#8b4513' },
}

export default function EpubReader({ book, onClose, onProgress }) {
  const viewerRef = useRef(null)
  const renditionRef = useRef(null)
  const bookRef = useRef(null)
  const hammerRef = useRef(null)
  const chunkTimerRef = useRef(null)
  const chunkStartRef = useRef(Date.now())

  const [theme, setTheme] = useState(() => localStorage.getItem('ps_theme') || 'dark')
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('ps_fontsize') || '16'))
  const [columnWidth, setColumnWidth] = useState(() => parseInt(localStorage.getItem('ps_colwidth') || '680'))
  const [showTOC, setShowTOC] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [currentCfi, setCurrentCfi] = useState(null)
  const [chunkIndex, setChunkIndex] = useState(book.current_chunk_index || 0)
  const [totalChunks, setTotalChunks] = useState(book.total_chunks || 1)
  const [pagesReadToday, setPagesReadToday] = useState(0)
  const [targetHit, setTargetHit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── Boot epub.js ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewerRef.current) return
    let mounted = true

    const initReader = async () => {
      try {
        // Fetch file blob from backend (serve as arraybuffer)
        const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
        const response = await fetch(`${BASE}/books/${book.id}/file`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('ps_token')}` },
        })
        if (!response.ok) throw new Error('Failed to load book file')
        const arrayBuffer = await response.arrayBuffer()

        if (!mounted) return

        // Create epub book
        const epubBook = Epub(arrayBuffer)
        bookRef.current = epubBook

        // Create rendition — uses iframe, preserves original CSS/fonts
        const rendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
          manager: 'default',
        })
        renditionRef.current = rendition

        // Apply current theme and font size
        applyTheme(rendition, theme, fontSize)

        // Register themes
        Object.entries(THEMES).forEach(([name, styles]) => {
          rendition.themes.register(name, {
            body: {
              background: styles.background,
              color: styles.color,
              'font-size': `${fontSize}px`,
              'line-height': '1.6',
              'max-width': `${columnWidth}px`,
              margin: '0 auto',
              padding: '2rem',
            },
            a: { color: styles.link },
          })
        })
        rendition.themes.select(theme)

        // Track location changes → sync chunk index
        rendition.on('locationChanged', (loc) => {
          if (!mounted) return
          setCurrentCfi(loc.start.cfi)
          // Calculate approximate chunk from progress
          if (loc.start.percentage !== undefined) {
            const approxChunk = Math.floor(loc.start.percentage * totalChunks)
            updateChunk(approxChunk)
          }
        })

        // Display at saved position or start
        const savedCfi = localStorage.getItem(`ps_cfi_${book.id}`)
        if (savedCfi) {
          await rendition.display(savedCfi)
        } else {
          await rendition.display()
        }

        // Get total locations for chunk mapping
        await epubBook.locations.generate(1600) // ~200 words per location

        if (mounted) setLoading(false)

        // Keyboard navigation
        rendition.on('keyup', handleKeyUp)

        // Touch/swipe via Hammer.js on the viewer div
        setupSwipe()

      } catch (err) {
        console.error('EPUB load error:', err)
        if (mounted) setError(err.message)
      }
    }

    initReader()

    return () => {
      mounted = false
      if (renditionRef.current) renditionRef.current.destroy()
      if (bookRef.current) bookRef.current.destroy()
      if (hammerRef.current) hammerRef.current.destroy()
      clearInterval(chunkTimerRef.current)
    }
  }, [book.id])

  // ── Theme / font changes ──────────────────────────────────────────────────
  useEffect(() => {
    if (!renditionRef.current) return
    localStorage.setItem('ps_theme', theme)
    renditionRef.current.themes.select(theme)
  }, [theme])

  useEffect(() => {
    if (!renditionRef.current) return
    localStorage.setItem('ps_fontsize', fontSize)
    renditionRef.current.themes.font(`${fontSize}px`)
  }, [fontSize])

  useEffect(() => {
    if (!renditionRef.current) return
    localStorage.setItem('ps_colwidth', columnWidth)
    renditionRef.current.themes.override('max-width', `${columnWidth}px`)
  }, [columnWidth])

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = useCallback(async () => {
    if (!renditionRef.current) return
    const timeSpent = Math.floor((Date.now() - chunkStartRef.current) / 1000)
    chunkStartRef.current = Date.now()
    await renditionRef.current.next()
    recordProgress(timeSpent)
  }, [])

  const goPrev = useCallback(async () => {
    if (!renditionRef.current) return
    await renditionRef.current.prev()
  }, [])

  const jumpToCfi = useCallback(async (cfi) => {
    if (!renditionRef.current || !cfi) return
    await renditionRef.current.display(cfi)
    setShowTOC(false)
  }, [])

  const jumpToPage = useCallback(async (pageNum) => {
    if (!renditionRef.current || !bookRef.current) return
    const total = bookRef.current.locations.total
    if (!total) return
    const pct = (pageNum - 1) / book.total_pages
    const cfi = bookRef.current.locations.cfiFromPercentage(Math.min(pct, 0.999))
    await renditionRef.current.display(cfi)
  }, [book.total_pages])

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const handleKeyUp = useCallback((e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev()
    if (e.key === 'Escape') onClose()
  }, [goNext, goPrev, onClose])

  useEffect(() => {
    const handler = (e) => handleKeyUp(e)
    window.addEventListener('keyup', handler)
    return () => window.removeEventListener('keyup', handler)
  }, [handleKeyUp])

  // ── Swipe ─────────────────────────────────────────────────────────────────
  const setupSwipe = () => {
    if (!viewerRef.current || typeof window === 'undefined') return
    import('hammerjs').then(({ default: Hammer }) => {
      const mc = new Hammer(viewerRef.current)
      mc.on('swipeleft', goNext)
      mc.on('swiperight', goPrev)
      hammerRef.current = mc
    })
  }

  // ── Progress tracking ─────────────────────────────────────────────────────
  const updateChunk = useCallback((newIndex) => {
    const clamped = Math.max(0, Math.min(newIndex, totalChunks - 1))
    setChunkIndex(clamped)
    // Save CFI for resume
    if (renditionRef.current) {
      const loc = renditionRef.current.currentLocation()
      if (loc?.start?.cfi) {
        localStorage.setItem(`ps_cfi_${book.id}`, loc.start.cfi)
      }
    }
  }, [totalChunks, book.id])

  const recordProgress = useCallback(async (timeSpent = 0) => {
    try {
      const loc = renditionRef.current?.currentLocation()
      const pct = loc?.start?.percentage || 0
      const approxChunk = Math.floor(pct * totalChunks)
      const res = await readingApi.updateProgress(book.id, approxChunk, timeSpent)
      const data = res.data
      setPagesReadToday(data.pages_read_today)
      setTargetHit(data.target_hit)
      if (onProgress) onProgress(data)
    } catch (err) {
      console.error('Progress update failed:', err)
    }
  }, [book.id, totalChunks, onProgress])

  const applyTheme = (rendition, themeName, size) => {
    const t = THEMES[themeName]
    if (!t) return
    rendition.themes.override('background', t.background)
    rendition.themes.override('color', t.color)
    rendition.themes.override('font-size', `${size}px`)
  }

  const currentTheme = THEMES[theme]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: currentTheme.background,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Toolbar */}
      <ReaderToolbar
        book={book}
        chunkIndex={chunkIndex}
        totalChunks={totalChunks}
        pagesReadToday={pagesReadToday}
        targetHit={targetHit}
        theme={theme}
        onThemeChange={setTheme}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        columnWidth={columnWidth}
        onColumnWidthChange={setColumnWidth}
        onToggleTOC={() => setShowTOC(v => !v)}
        onClose={onClose}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(v => !v)}
      />

      {/* Progress bar */}
      <ChunkProgressBar
        current={chunkIndex}
        total={totalChunks}
        color={theme === 'dark' ? '#7eb3e8' : '#1a6ac8'}
        onJumpToPage={jumpToPage}
        totalPages={book.total_pages}
      />

      {/* Reader area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: currentTheme.color, fontSize: '1rem',
          }}>
            Loading book...
          </div>
        )}
        {error && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '1rem',
            color: '#e74c3c', fontSize: '1rem', padding: '2rem', textAlign: 'center',
          }}>
            <span>⚠️ {error}</span>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1.5rem', background: '#e74c3c',
                color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
              }}
            >
              Back to Library
            </button>
          </div>
        )}

        {/* epub.js renders into this div */}
        <div
          ref={viewerRef}
          style={{
            width: '100%', height: '100%',
            opacity: loading ? 0 : 1,
            transition: 'opacity 0.2s',
          }}
        />

        {/* Tap zones: left third = prev, right third = next */}
        {!loading && (
          <>
            <div
              onClick={goPrev}
              style={{
                position: 'absolute', left: 0, top: '10%',
                width: '15%', height: '80%', cursor: 'pointer', zIndex: 10,
              }}
            />
            <div
              onClick={goNext}
              style={{
                position: 'absolute', right: 0, top: '10%',
                width: '15%', height: '80%', cursor: 'pointer', zIndex: 10,
              }}
            />
          </>
        )}
      </div>

      {/* TOC Drawer */}
      {showTOC && (
        <TOCDrawer
          bookId={book.id}
          theme={theme}
          currentTheme={currentTheme}
          onNavigate={jumpToCfi}
          onClose={() => setShowTOC(false)}
        />
      )}
    </div>
  )
}
