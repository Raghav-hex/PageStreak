import { useState } from 'react'

export default function ChunkProgressBar({ current, total, color, onJumpToPage, totalPages }) {
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
