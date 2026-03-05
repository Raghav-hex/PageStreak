import { useEffect, useRef, useState, useCallback } from 'react'
import Epub from 'epubjs'
import { readingApi } from '../../services/api'
import TOCDrawer from './TOCDrawer'
import ReaderToolbar from './ReaderToolbar'
import ChunkProgressBar from './ChunkProgressBar'

const THEMES = {
  dark:  { background: '#1a1a1a', color: '#e8e6e3', link: '#7eb3e8' },
  light: { background: '#f8f8f2', color: '#222222', link: '#1a6ac8' },
  sepia: { background: '#f4ecd8', color: '#3b2f1e', link: '#8b4513' },
}

const _bufferCache = {}

export default function EpubReader({ book, onClose, onProgress }) {
  const viewerRef     = useRef(null)
  const renditionRef  = useRef(null)
  const bookRef       = useRef(null)
  const hammerRef     = useRef(null)
  const chunkStartRef = useRef(Date.now())
  // ⚑ KEY FIX: don't overwrite saved CFI during initial render
  const canSaveCfi    = useRef(false)

  const [theme, setTheme]         = useState(() => localStorage.getItem('ps_theme') || 'dark')
  const [fontSize, setFontSize]   = useState(() => parseInt(localStorage.getItem('ps_fontsize') || '16'))
  const [columnWidth, setColWidth] = useState(() => parseInt(localStorage.getItem('ps_colwidth') || '680'))
  const [showTOC, setShowTOC]     = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [chunkIndex, setChunkIndex]     = useState(book.current_chunk_index || 0)
  const totalChunks = book.total_chunks || 1
  const [pagesReadToday, setPRT]  = useState(0)
  const [dailyTarget, setDailyTarget] = useState(10)
  const [targetHit, setTargetHit] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [loadMsg, setLoadMsg]     = useState('Downloading...')
  const [error, setError]         = useState(null)

  // ── Fetch today's pages on mount (fix: don't start at 0) ─────────────────
  useEffect(() => {
    readingApi.dashboard().then(res => {
      setPRT(res.data.pages_today)
      setDailyTarget(res.data.daily_target)
      setTargetHit(res.data.target_hit)
    }).catch(() => {})
  }, [])

  // ── Init epub.js ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewerRef.current) return
    let alive = true
    canSaveCfi.current = false   // reset on re-mount

    ;(async () => {
      try {
        // 1. Download (or use cached) buffer
        let buf = _bufferCache[book.id]
        if (!buf) {
          setLoadMsg('Downloading book…')
          const BASE = import.meta.env.VITE_API_URL
            ? `${import.meta.env.VITE_API_URL}/api` : '/api'
          const resp = await fetch(`${BASE}/books/${book.id}/file`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('ps_token')}` },
          })
          if (!resp.ok) throw new Error('Failed to fetch book file')
          buf = await resp.arrayBuffer()
          _bufferCache[book.id] = buf
        }
        if (!alive) return
        setLoadMsg('Opening…')

        // 2. Create book — clone buffer so epub.js can consume it
        const epubBook = Epub(buf.slice(0))
        bookRef.current = epubBook

        // 3. Rendition — no allowScriptedContent (causes sandbox warning)
        const rendition = epubBook.renderTo(viewerRef.current, {
          width: '100%', height: '100%',
          spread: 'none', flow: 'paginated', manager: 'default',
        })
        renditionRef.current = rendition

        // 4. Register themes
        registerThemes(rendition, fontSize, columnWidth)
        rendition.themes.select(theme)

        // 5. locationChanged — only save CFI AFTER initial display resolves
        rendition.on('locationChanged', (loc) => {
          if (!alive || !loc?.start?.cfi) return

          // ⚑ Only persist once we've finished the initial display()
          if (canSaveCfi.current) {
            localStorage.setItem(`ps_cfi_${book.id}`, loc.start.cfi)
          }

          // Update progress indicator if percentage is available
          if (loc.start.percentage != null) {
            const approx = Math.floor(loc.start.percentage * totalChunks)
            setChunkIndex(Math.max(0, Math.min(approx, totalChunks - 1)))
          }
        })

        // 6. Display at saved CFI — read BEFORE display so event can't overwrite it
        const savedCfi = localStorage.getItem(`ps_cfi_${book.id}`)
        try {
          if (savedCfi) {
            await rendition.display(savedCfi)
          } else {
            await rendition.display()
          }
        } catch {
          // CFI is stale (book rebuilt?) — clear and start from beginning
          localStorage.removeItem(`ps_cfi_${book.id}`)
          await rendition.display()
        }

        // ⚑ From this point on, every locationChanged will persist the CFI
        canSaveCfi.current = true

        if (alive) setLoading(false)

        // 7. Background location generation — does NOT block rendering
        epubBook.locations.generate(1600).catch(() => {})

        // 8. Input handlers
        rendition.on('keyup', (e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
          if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev()
          if (e.key === 'Escape') onClose()
        })
        setupSwipe()

      } catch (err) {
        console.error('EpubReader init error:', err)
        if (alive) { setError(err.message); setLoading(false) }
      }
    })()

    return () => {
      alive = false
      try { renditionRef.current?.destroy() } catch {}
      try { bookRef.current?.destroy() } catch {}
      try { hammerRef.current?.destroy() } catch {}
    }
  }, [book.id])

  // ── Live theme / font updates ─────────────────────────────────────────────
  useEffect(() => {
    if (!renditionRef.current) return
    localStorage.setItem('ps_theme', theme)
    renditionRef.current.themes.select(theme)
  }, [theme])

  useEffect(() => {
    if (!renditionRef.current) return
    localStorage.setItem('ps_fontsize', fontSize)
    renditionRef.current.themes.fontSize(`${fontSize}px`)
  }, [fontSize])

  useEffect(() => {
    if (!renditionRef.current) return
    localStorage.setItem('ps_colwidth', columnWidth)
    renditionRef.current.themes.override('max-width', `${columnWidth}px`)
  }, [columnWidth])

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = useCallback(async () => {
    if (!renditionRef.current) return
    const spent = Math.floor((Date.now() - chunkStartRef.current) / 1000)
    chunkStartRef.current = Date.now()
    await renditionRef.current.next()
    recordProgress(spent)
  }, [])

  const goPrev = useCallback(async () => {
    if (!renditionRef.current) return
    await renditionRef.current.prev()
  }, [])

  const jumpToCfi = useCallback(async (cfi) => {
    if (!renditionRef.current || !cfi) return
    try { await renditionRef.current.display(cfi) } catch {}
    setShowTOC(false)
  }, [])

  const jumpToPage = useCallback(async (pageNum) => {
    if (!renditionRef.current || !bookRef.current) return
    const pct = Math.min((pageNum - 1) / Math.max(book.total_pages - 1, 1), 0.999)
    try {
      const locs = bookRef.current.locations
      if (locs?.total > 0) {
        await renditionRef.current.display(locs.cfiFromPercentage(pct))
      } else {
        const items = bookRef.current.spine?.items || []
        const item  = items[Math.floor(pct * items.length)]
        if (item?.href) await renditionRef.current.display(item.href)
      }
    } catch (e) { console.error('Jump failed:', e) }
  }, [book.total_pages])

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keyup', h)
    return () => window.removeEventListener('keyup', h)
  }, [goNext, goPrev, onClose])

  // ── Swipe ─────────────────────────────────────────────────────────────────
  const setupSwipe = () => {
    if (!viewerRef.current) return
    import('hammerjs').then(({ default: Hammer }) => {
      const mc = new Hammer(viewerRef.current)
      mc.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 10, velocity: 0.3 })
      mc.on('swipeleft',  () => goNext())
      mc.on('swiperight', () => goPrev())
      hammerRef.current = mc
    }).catch(() => {})
  }

  // ── Progress ──────────────────────────────────────────────────────────────
  const recordProgress = useCallback(async (timeSpent = 0) => {
    try {
      const loc   = renditionRef.current?.currentLocation()
      const pct   = loc?.start?.percentage || 0
      const approx = Math.floor(pct * totalChunks)
      const res   = await readingApi.updateProgress(book.id, approx, timeSpent)
      setPRT(res.data.pages_read_today)
      setTargetHit(res.data.target_hit)
      if (onProgress) onProgress(res.data)
    } catch {}
  }, [book.id, totalChunks, onProgress])

  const t = THEMES[theme]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: t.background, display: 'flex', flexDirection: 'column' }}>
      <ReaderToolbar
        book={book} chunkIndex={chunkIndex} totalChunks={totalChunks}
        pagesReadToday={pagesReadToday} dailyTarget={dailyTarget} targetHit={targetHit}
        theme={theme} onThemeChange={setTheme}
        fontSize={fontSize} onFontSizeChange={setFontSize}
        columnWidth={columnWidth} onColumnWidthChange={setColWidth}
        onToggleTOC={() => setShowTOC(v => !v)} onClose={onClose}
        showSettings={showSettings} onToggleSettings={() => setShowSettings(v => !v)}
      />
      <ChunkProgressBar
        current={chunkIndex} total={totalChunks}
        color={theme === 'light' ? '#1a6ac8' : '#7eb3e8'}
        onJumpToPage={jumpToPage} totalPages={book.total_pages}
      />

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: t.background, gap: '1rem' }}>
            <Spinner color={t.color} />
            <span style={{ color: t.color, opacity: 0.4, fontSize: '0.8rem' }}>{loadMsg}</span>
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: t.background, padding: '2rem', textAlign: 'center' }}>
            <span style={{ fontSize: '2.5rem' }}>⚠️</span>
            <span style={{ color: '#e57373', fontSize: '0.9rem' }}>{error}</span>
            <button onClick={onClose} style={{ padding: '0.5rem 1.5rem', background: '#1a3a5c', color: '#7eb3e8', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Back to Library</button>
          </div>
        )}
        <div ref={viewerRef} style={{ width: '100%', height: '100%', opacity: loading || error ? 0 : 1, transition: 'opacity 0.25s ease' }} />
        {!loading && !error && (
          <>
            <div onClick={goPrev} style={{ position: 'absolute', left: 0, top: '5%', width: '12%', height: '90%', cursor: 'pointer', zIndex: 10 }} />
            <div onClick={goNext} style={{ position: 'absolute', right: 0, top: '5%', width: '12%', height: '90%', cursor: 'pointer', zIndex: 10 }} />
          </>
        )}
      </div>

      {showTOC && (
        <TOCDrawer bookId={book.id} theme={theme} currentTheme={t} onNavigate={jumpToCfi} onClose={() => setShowTOC(false)} />
      )}
    </div>
  )
}

function registerThemes(rendition, fontSize, colWidth) {
  const themes = {
    dark:  { bg: '#1a1a1a', color: '#e8e6e3', link: '#7eb3e8' },
    light: { bg: '#f8f8f2', color: '#222',    link: '#1a6ac8' },
    sepia: { bg: '#f4ecd8', color: '#3b2f1e', link: '#8b4513' },
  }
  Object.entries(themes).forEach(([name, s]) => {
    rendition.themes.register(name, {
      body: {
        background: `${s.bg} !important`, color: `${s.color} !important`,
        'font-size': `${fontSize}px !important`, 'line-height': '1.75',
        'max-width': `${colWidth}px`, margin: '0 auto', padding: '2.5rem 2rem',
      },
      'p, div, span, li, h1, h2, h3, h4, h5, h6': { color: `${s.color} !important` },
      a: { color: `${s.link} !important` },
    })
  })
}

function Spinner({ color }) {
  return (
    <>
      <style>{`@keyframes ps-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `2px solid ${color}22`, borderTopColor: color, animation: 'ps-spin 0.75s linear infinite' }} />
    </>
  )
}
