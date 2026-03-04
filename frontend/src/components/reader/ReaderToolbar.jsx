export default function ReaderToolbar({
  book, chunkIndex, totalChunks, pagesReadToday, targetHit,
  theme, onThemeChange, fontSize, onFontSizeChange,
  columnWidth, onColumnWidthChange,
  onToggleTOC, onClose, showSettings, onToggleSettings,
}) {
  const themes = ['dark', 'light', 'sepia']
  const themeLabels = { dark: '🌙', light: '☀️', sepia: '📜' }
  const progress = totalChunks > 0 ? Math.round((chunkIndex / totalChunks) * 100) : 0

  const toolbarStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.5rem 1rem',
    background: theme === 'dark' ? '#111' : theme === 'sepia' ? '#e8dcc8' : '#f5f5f5',
    borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#ddd'}`,
    color: theme === 'dark' ? '#ccc' : '#333',
    fontSize: '0.85rem', gap: '0.5rem', flexWrap: 'wrap',
    zIndex: 20,
  }

  const btnStyle = (active = false) => ({
    background: active ? '#7eb3e8' : 'transparent',
    color: active ? '#fff' : theme === 'dark' ? '#ccc' : '#555',
    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
    borderRadius: '4px', padding: '0.25rem 0.6rem',
    cursor: 'pointer', fontSize: '0.8rem',
  })

  return (
    <div style={toolbarStyle}>
      {/* Left: back + TOC */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button onClick={onClose} style={btnStyle()}>← Back</button>
        <button onClick={onToggleTOC} style={btnStyle()}>☰ TOC</button>
        <span style={{ opacity: 0.6, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {book.title}
        </span>
      </div>

      {/* Center: progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', opacity: 0.8 }}>
        <span>{progress}%</span>
        <span style={{ color: targetHit ? '#4caf50' : 'inherit' }}>
          📖 {pagesReadToday}p today
          {targetHit && ' ✅'}
        </span>
      </div>

      {/* Right: settings */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button onClick={onToggleSettings} style={btnStyle(showSettings)}>⚙️</button>
        {showSettings && (
          <div style={{
            position: 'absolute', top: '2.5rem', right: '1rem', zIndex: 100,
            background: theme === 'dark' ? '#222' : '#fff',
            border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
            borderRadius: '8px', padding: '1rem', display: 'flex',
            flexDirection: 'column', gap: '0.8rem', minWidth: '220px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>
            {/* Theme */}
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.4rem' }}>THEME</div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {themes.map(t => (
                  <button key={t} onClick={() => onThemeChange(t)} style={btnStyle(theme === t)}>
                    {themeLabels[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Font size */}
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.4rem' }}>
                FONT SIZE: {fontSize}px
              </div>
              <input
                type="range" min={12} max={28} step={1}
                value={fontSize}
                onChange={e => onFontSizeChange(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Column width */}
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.4rem' }}>
                COLUMN WIDTH: {columnWidth}px
              </div>
              <input
                type="range" min={400} max={900} step={20}
                value={columnWidth}
                onChange={e => onColumnWidthChange(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
