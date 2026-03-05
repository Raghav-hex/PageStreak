import { useState, useEffect, useRef } from 'react'

const THEME_META = {
  dark:  { bg: '#111',     border: '#1e1e1e', text: '#aaa', panel: '#181818', icon: '🌙', label: 'Dark'  },
  light: { bg: '#f0f0ec',  border: '#ddd',    text: '#666', panel: '#fff',    icon: '☀️', label: 'Light' },
  sepia: { bg: '#ede0c4',  border: '#d5c9a8', text: '#7a6244', panel: '#f4ecd8', icon: '📜', label: 'Sepia' },
}

export default function ReaderToolbar({
  book, chunkIndex, totalChunks,
  pagesReadToday, dailyTarget = 10, targetHit,
  theme, onThemeChange,
  fontSize, onFontSizeChange,
  columnWidth, onColumnWidthChange,
  onToggleTOC, onClose,
  showSettings, onToggleSettings,
}) {
  const m   = THEME_META[theme]
  const pct = totalChunks > 0 ? Math.round((chunkIndex / totalChunks) * 100) : 0
  const ringPct = Math.min((pagesReadToday / Math.max(dailyTarget, 1)) * 100, 100)

  return (
    <div style={{
      background: m.bg, borderBottom: `1px solid ${m.border}`,
      padding: '0 1rem', height: '52px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '0.75rem', flexShrink: 0, position: 'relative', zIndex: 20,
      userSelect: 'none',
    }}>

      {/* ── Left ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        <Btn onClick={onClose} theme={theme} title="Back to library">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Btn>

        <Btn onClick={onToggleTOC} theme={theme} title="Table of contents">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </Btn>

        {/* Title */}
        <span style={{
          fontSize: '0.8rem', color: m.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '180px', display: 'none',
        }}
          className="toolbar-title"
        >
          {book.title}
        </span>
      </div>

      {/* ── Center ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, justifyContent: 'center' }}>
        {/* Progress pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: theme === 'light' ? '#e0e0dc' : '#1e1e1e',
          borderRadius: '20px', padding: '0.3rem 0.75rem',
          border: `1px solid ${m.border}`,
        }}>
          <div style={{
            width: '90px', height: '5px',
            background: theme === 'light' ? '#ccc' : '#2a2a2a',
            borderRadius: '3px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: theme === 'sepia' ? '#8b4513' : '#7eb3e8',
              borderRadius: '3px', transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: '0.72rem', color: m.text, fontVariantNumeric: 'tabular-nums', minWidth: '28px' }}>
            {pct}%
          </span>
        </div>

        {/* Daily pages ring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title={`${pagesReadToday} / ${dailyTarget} pages today`}>
          <ProgressRing pct={ringPct} done={targetHit} theme={theme} />
          <span style={{
            fontSize: '0.75rem',
            color: targetHit ? '#4caf50' : m.text,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: targetHit ? 600 : 400,
          }}>
            {targetHit ? '🎯' : '📖'} {pagesReadToday}<span style={{ opacity: 0.5 }}>/{dailyTarget}</span>
          </span>
        </div>
      </div>

      {/* ── Right ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
        <Btn onClick={onToggleSettings} theme={theme} active={showSettings} title="Display settings">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </Btn>

        {/* Settings panel */}
        {showSettings && (
          <SettingsPanel
            theme={theme} onThemeChange={onThemeChange}
            fontSize={fontSize} onFontSizeChange={onFontSizeChange}
            columnWidth={columnWidth} onColumnWidthChange={onColumnWidthChange}
            onClose={onToggleSettings}
          />
        )}
      </div>
    </div>
  )
}

// ── Settings Panel ────────────────────────────────────────────────────────────
function SettingsPanel({ theme, onThemeChange, fontSize, onFontSizeChange, columnWidth, onColumnWidthChange, onClose }) {
  const m = THEME_META[theme]
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    setTimeout(() => window.addEventListener('mousedown', h), 0)
    return () => window.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '58px', right: '0.75rem', zIndex: 200,
      background: m.panel, border: `1px solid ${m.border}`,
      borderRadius: '14px', padding: '1.25rem', width: '260px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
      display: 'flex', flexDirection: 'column', gap: '1.25rem',
    }}>
      {/* Theme picker */}
      <div>
        <Label text="THEME" theme={theme} />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          {Object.entries(THEME_META).map(([name, meta]) => (
            <button
              key={name}
              onClick={() => onThemeChange(name)}
              title={meta.label}
              style={{
                flex: 1, padding: '0.5rem 0', borderRadius: '8px', cursor: 'pointer',
                border: theme === name
                  ? `2px solid ${name === 'light' ? '#1a6ac8' : '#7eb3e8'}`
                  : `1px solid ${m.border}`,
                background: meta.bg, fontSize: '1rem',
                transition: 'transform 0.1s',
                transform: theme === name ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              {meta.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label text="FONT SIZE" theme={theme} />
          <span style={{ fontSize: '0.8rem', color: m.text, fontVariantNumeric: 'tabular-nums' }}>{fontSize}px</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem' }}>
          <StepBtn onClick={() => onFontSizeChange(Math.max(12, fontSize - 1))} theme={theme}>A−</StepBtn>
          <input
            type="range" min={12} max={28} step={1} value={fontSize}
            onChange={e => onFontSizeChange(parseInt(e.target.value))}
            style={{ flex: 1 }}
          />
          <StepBtn onClick={() => onFontSizeChange(Math.min(28, fontSize + 1))} theme={theme}>A+</StepBtn>
        </div>
      </div>

      {/* Column width */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label text="LINE WIDTH" theme={theme} />
          <span style={{ fontSize: '0.8rem', color: m.text, fontVariantNumeric: 'tabular-nums' }}>{columnWidth}px</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem' }}>
          <StepBtn onClick={() => onColumnWidthChange(Math.max(400, columnWidth - 40))} theme={theme}>⟵</StepBtn>
          <input
            type="range" min={400} max={900} step={20} value={columnWidth}
            onChange={e => onColumnWidthChange(parseInt(e.target.value))}
            style={{ flex: 1 }}
          />
          <StepBtn onClick={() => onColumnWidthChange(Math.min(900, columnWidth + 40))} theme={theme}>⟶</StepBtn>
        </div>
      </div>

      {/* Reading font preview */}
      <div style={{
        padding: '0.75rem', borderRadius: '8px',
        background: theme === 'dark' ? '#111' : theme === 'sepia' ? '#ede0c4' : '#f5f5f0',
        border: `1px solid ${m.border}`,
        fontSize: `${Math.min(fontSize, 16)}px`,
        color: theme === 'dark' ? '#e8e6e3' : theme === 'sepia' ? '#3b2f1e' : '#222',
        lineHeight: 1.7,
        fontFamily: 'Georgia, serif',
      }}>
        The quick brown fox jumps over the lazy dog.
      </div>
    </div>
  )
}

// ── Reusable ──────────────────────────────────────────────────────────────────
function Btn({ onClick, children, theme, active, title }) {
  const m = THEME_META[theme]
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? (theme === 'light' ? '#d0d8e8' : '#1e2d3d') : 'transparent',
        color: active ? (theme === 'light' ? '#1a6ac8' : '#7eb3e8') : m.text,
        border: `1px solid ${active ? (theme === 'light' ? '#a0b8d8' : '#2a4a6a') : m.border}`,
        borderRadius: '8px', padding: '0.4rem 0.55rem',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        lineHeight: 1,
      }}
      onMouseOver={e => !active && (e.currentTarget.style.background = theme === 'light' ? '#e0e0dc' : '#1e1e1e')}
      onMouseOut={e  => !active && (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

function StepBtn({ onClick, children, theme }) {
  const m = THEME_META[theme]
  return (
    <button onClick={onClick} style={{
      background: 'transparent', color: m.text,
      border: `1px solid ${m.border}`, borderRadius: '6px',
      padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.72rem',
      flexShrink: 0,
    }}>{children}</button>
  )
}

function Label({ text, theme }) {
  return (
    <div style={{
      fontSize: '0.65rem', letterSpacing: '0.08em',
      color: THEME_META[theme].text, opacity: 0.7, fontWeight: 600,
    }}>{text}</div>
  )
}

function ProgressRing({ pct, done, theme }) {
  const r = 9, circ = 2 * Math.PI * r
  const stroke = done ? '#4caf50' : theme === 'sepia' ? '#8b4513' : '#7eb3e8'
  const trackColor = theme === 'light' ? '#ddd' : '#2a2a2a'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx="12" cy="12" r={r} fill="none" stroke={trackColor} strokeWidth="2.5" />
      <circle
        cx="12" cy="12" r={r} fill="none" stroke={stroke} strokeWidth="2.5"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s' }}
      />
    </svg>
  )
}
