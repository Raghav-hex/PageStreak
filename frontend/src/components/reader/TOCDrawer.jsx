import { useEffect, useState } from 'react'
import { booksApi } from '../../services/api'

export function TOCDrawer({ bookId, theme, currentTheme, onNavigate, onClose }) {
  const [toc, setToc] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    booksApi.toc(bookId).then(res => {
      setToc(res.data.toc || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [bookId])

  const drawerStyle = {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: '300px', maxWidth: '80vw',
    background: theme === 'dark' ? '#1e1e1e' : theme === 'sepia' ? '#f0e6d0' : '#fff',
    borderRight: `1px solid ${theme === 'dark' ? '#333' : '#ddd'}`,
    zIndex: 50, display: 'flex', flexDirection: 'column',
    boxShadow: '4px 0 20px rgba(0,0,0,0.3)',
  }

  return (
    <div style={drawerStyle}>
      <div style={{
        padding: '1rem', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: currentTheme.color,
      }}>
        <strong>Table of Contents</strong>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none',
          color: currentTheme.color, cursor: 'pointer', fontSize: '1.2rem',
        }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {loading && <div style={{ padding: '1rem', opacity: 0.6, color: currentTheme.color }}>Loading...</div>}
        {!loading && toc.length === 0 && (
          <div style={{ padding: '1rem', opacity: 0.6, color: currentTheme.color }}>No table of contents available.</div>
        )}
        {toc.map((item, i) => (
          <button
            key={i}
            onClick={() => onNavigate(item.href)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: `0.5rem 0.5rem 0.5rem ${(item.level || 0) * 1 + 0.5}rem`,
              background: 'transparent',
              border: 'none', borderBottom: `1px solid ${theme === 'dark' ? '#2a2a2a' : '#f0f0f0'}`,
              color: currentTheme.color, cursor: 'pointer', fontSize: '0.9rem',
            }}
            onMouseOver={e => e.target.style.opacity = '0.7'}
            onMouseOut={e => e.target.style.opacity = '1'}
          >
            {item.title || 'Untitled'}
          </button>
        ))}
      </div>
    </div>
  )
}

export default TOCDrawer


export function ChunkProgressBar({ current, total, color, onJumpToPage, totalPages }) {
  const [showJump, setShowJump] = useState(false)
  const [jumpInput, setJumpInput] = useState('')
  const pct = total > 0 ? (current / total) * 100 : 0

  const handleJump = () => {
    const page = parseInt(jumpInput)
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onJumpToPage(page)
      setShowJump(false)
      setJumpInput('')
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Progress bar */}
      <div
        style={{ height: '3px', background: '#333', cursor: 'pointer' }}
        onClick={() => setShowJump(v => !v)}
        title="Click to jump to page"
      >
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color, transition: 'width 0.3s',
        }} />
      </div>

      {/* Jump to page popup */}
      {showJump && (
        <div style={{
          position: 'absolute', top: '4px', left: '50%', transform: 'translateX(-50%)',
          background: '#222', border: '1px solid #444', borderRadius: '6px',
          padding: '0.4rem 0.6rem', display: 'flex', gap: '0.4rem',
          alignItems: 'center', zIndex: 30, boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        }}>
          <span style={{ color: '#aaa', fontSize: '0.75rem' }}>Page</span>
          <input
            type="number" value={jumpInput}
            onChange={e => setJumpInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJump()}
            min={1} max={totalPages}
            autoFocus
            style={{
              width: '60px', background: '#333', color: '#eee',
              border: '1px solid #555', borderRadius: '4px',
              padding: '0.2rem 0.4rem', fontSize: '0.8rem',
            }}
          />
          <span style={{ color: '#666', fontSize: '0.75rem' }}>/ {totalPages}</span>
          <button onClick={handleJump} style={{
            background: '#7eb3e8', color: '#fff', border: 'none',
            borderRadius: '4px', padding: '0.2rem 0.5rem',
            cursor: 'pointer', fontSize: '0.75rem',
          }}>Go</button>
          <button onClick={() => setShowJump(false)} style={{
            background: 'transparent', color: '#aaa', border: 'none',
            cursor: 'pointer', fontSize: '0.9rem',
          }}>✕</button>
        </div>
      )}
    </div>
  )
}
