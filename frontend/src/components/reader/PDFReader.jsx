import { useEffect, useRef, useState, useCallback } from 'react'
import { booksApi, readingApi } from '../../services/api'
import ReaderToolbar from './ReaderToolbar'
import ChunkProgressBar from './ChunkProgressBar'

const THEMES = {
  dark:  { background: '#1a1a1a', color: '#e8e6e3', link: '#7eb3e8', surface: '#242424' },
  light: { background: '#f8f8f2', color: '#222222', link: '#1a6ac8', surface: '#eeeeee' },
  sepia: { background: '#f4ecd8', color: '#3b2f1e', link: '#8b4513', surface: '#ede0c4' },
}

// Session-level chunk cache — avoids re-fetching when flipping pages
const _chunkCache = {}

export default function PDFReader({ book, onClose, onProgress }) {
  const chunkStartRef = useRef(Date.now())
  const containerRef = useRef(null)

  const [theme, setTheme]     = useState(() => localStorage.getItem('ps_theme') || 'dark')
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('ps_fontsize') || '18'))
  const [chunkIndex, setChunkIndex] = useState(() => {
    const saved = localStorage.getItem(`ps_chunk_${book.id}`)
    return saved ? parseInt(saved, 10) : (book.current_chunk_index || 0)
  })
  const totalChunks = book.total_chunks || 1
  const [html, setHtml]               = useState('')
  const [loading, setLoading]         = useState(true)
  const [pagesReadToday, setPRT]      = useState(0)
  const [targetHit, setTargetHit]     = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Fetch chunk (with cache)
  const fetchChunk = useCallback(async (idx) => {
    const key = `${book.id}:${idx}`
    if (_chunkCache[key]) return _chunkCache[key]
    const res = await booksApi.chunk(book.id, idx)
    _chunkCache[key] = res.data.html
    return res.data.html
  }, [book.id])

  // Load chunk whenever index changes
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchChunk(chunkIndex)
      .then(chunkHtml => {
        if (!alive) return
        setHtml(chunkHtml)
        setLoading(false)
        containerRef.current?.scrollTo({ top: 0, behavior: 'instant' })
        localStorage.setItem(`ps_chunk_${book.id}`, chunkIndex)
      })
      .catch(() => alive && setLoading(false))
    return () => { alive = false }
  }, [chunkIndex, fetchChunk, book.id])

  // Prefetch next chunk silently
  useEffect(() => {
    if (chunkIndex + 1 < totalChunks) fetchChunk(chunkIndex + 1).catch(() => {})
  }, [chunkIndex, totalChunks, fetchChunk])

  const goNext = useCallback(async () => {
    if (chunkIndex >= totalChunks - 1) return
    const timeSpent = Math.floor((Date.now() - chunkStartRef.current) / 1000)
    chunkStartRef.current = Date.now()
    const next = chunkIndex + 1
    setChunkIndex(next)
    try {
      const res = await readingApi.updateProgress(book.id, next, timeSpent)
      setPRT(res.data.pages_read_today)
      setTargetHit(res.data.target_hit)
      if (onProgress) onProgress(res.data)
    } catch (e) { console.error(e) }
  }, [chunkIndex, totalChunks, book.id, onProgress])

  const goPrev = useCallback(() => {
    if (chunkIndex <= 0) return
    setChunkIndex(i => i - 1)
  }, [chunkIndex])

  const jumpToPage = useCallback((pageNum) => {
    const chunk = Math.max(0, Math.min(Math.round((pageNum - 1) * 2), totalChunks - 1))
    setChunkIndex(chunk)
  }, [totalChunks])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keyup', handler)
    return () => window.removeEventListener('keyup', handler)
  }, [goNext, goPrev, onClose])

  const t = THEMES[theme]
  const progress = Math.round((chunkIndex / Math.max(totalChunks - 1, 1)) * 100)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: t.background, display: 'flex', flexDirection: 'column' }}>
      <ReaderToolbar
        book={book}
        chunkIndex={chunkIndex} totalChunks={totalChunks}
        pagesReadToday={pagesReadToday} targetHit={targetHit}
        theme={theme} onThemeChange={v => { setTheme(v); localStorage.setItem('ps_theme', v) }}
        fontSize={fontSize} onFontSizeChange={v => { setFontSize(v); localStorage.setItem('ps_fontsize', v) }}
        columnWidth={680} onColumnWidthChange={() => {}}
        onToggleTOC={() => {}}
        onClose={onClose}
        showSettings={showSettings} onToggleSettings={() => setShowSettings(v => !v)}
      />
      <ChunkProgressBar
        current={chunkIndex} total={totalChunks}
        color={theme === 'light' ? '#1a6ac8' : '#7eb3e8'}
        onJumpToPage={jumpToPage} totalPages={book.total_pages}
      />

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Tap zones */}
        <div onClick={goPrev} style={{ position: 'absolute', left: 0, top: 0, width: '12%', height: '100%', zIndex: 10, cursor: 'w-resize' }} />
        <div onClick={goNext} style={{ position: 'absolute', right: 0, top: 0, width: '12%', height: '100%', zIndex: 10, cursor: 'e-resize' }} />

        <div ref={containerRef} style={{ height: '100%', overflowY: 'auto', padding: '3rem 2rem', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '680px' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
                <Spinner color={t.color} />
              </div>
            ) : (
              <>
                <div
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.85, color: t.color, fontFamily: 'Georgia, "Times New Roman", serif', opacity: loading ? 0 : 1, transition: 'opacity 0.15s' }}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3rem', paddingTop: '1.5rem', borderTop: `1px solid ${t.surface}` }}>
                  <NavBtn onClick={goPrev} disabled={chunkIndex === 0} theme={theme}>← Prev</NavBtn>
                  <span style={{ color: t.color, opacity: 0.35, fontSize: '0.8rem' }}>{progress}%</span>
                  <NavBtn onClick={goNext} disabled={chunkIndex >= totalChunks - 1} theme={theme}>Next →</NavBtn>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function NavBtn({ onClick, disabled, children, theme }) {
  const accent = theme === 'light' ? '#1a6ac8' : '#7eb3e8'
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: 'transparent', border: `1px solid ${disabled ? 'transparent' : accent}`,
      color: disabled ? 'transparent' : accent, borderRadius: '6px',
      padding: '0.45rem 1.2rem', cursor: disabled ? 'default' : 'pointer', fontSize: '0.85rem',
      transition: 'opacity 0.15s', opacity: disabled ? 0 : 1,
    }}>{children}</button>
  )
}

function Spinner({ color }) {
  return (
    <>
      <style>{`@keyframes ps-spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `2px solid ${color}22`, borderTopColor: color, animation: 'ps-spin 0.7s linear infinite' }} />
    </>
  )
}
