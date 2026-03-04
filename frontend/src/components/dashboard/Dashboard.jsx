import { useEffect, useState } from 'react'
import { readingApi, authApi } from '../../services/api'
import { format, eachDayOfInterval, subDays, startOfDay } from 'date-fns'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')

  useEffect(() => {
    readingApi.dashboard().then(res => {
      setData(res.data)
      setTargetInput(res.data.daily_target)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSaveTarget = async () => {
    const val = parseInt(targetInput)
    if (isNaN(val) || val < 1) return
    await authApi.updateMe({ daily_page_target: val })
    setData(d => ({ ...d, daily_target: val }))
    setEditingTarget(false)
  }

  if (loading) return <div style={styles.loading}>Loading dashboard...</div>
  if (!data) return null

  const { streak, pages_today, daily_target, heatmap } = data
  const targetHit = pages_today >= daily_target

  return (
    <div style={styles.container}>
      {/* Streak section */}
      <div style={styles.streakRow}>
        <div style={styles.streakCard}>
          <div style={styles.streakFlame}>🔥</div>
          <div style={styles.streakNumber}>{streak.current_streak}</div>
          <div style={styles.streakLabel}>day streak</div>
          {streak.freeze_tokens_remaining > 0 && (
            <div style={styles.freezeTag}>🧊 1 freeze left</div>
          )}
        </div>

        <div style={styles.statsCard}>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Longest streak</span>
            <span style={styles.statValue}>{streak.longest_streak} days</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Pages today</span>
            <span style={{ ...styles.statValue, color: targetHit ? '#4caf50' : '#e8e6e3' }}>
              {pages_today} / {daily_target} {targetHit ? '✅' : ''}
            </span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Daily target</span>
            {editingTarget ? (
              <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="number" value={targetInput} min={1}
                  onChange={e => setTargetInput(e.target.value)}
                  style={styles.targetInput}
                  onKeyDown={e => e.key === 'Enter' && handleSaveTarget()}
                  autoFocus
                />
                <button onClick={handleSaveTarget} style={styles.saveBtn}>✓</button>
                <button onClick={() => setEditingTarget(false)} style={styles.cancelBtn}>✕</button>
              </span>
            ) : (
              <span
                style={{ ...styles.statValue, cursor: 'pointer', textDecoration: 'underline dotted' }}
                onClick={() => setEditingTarget(true)}
                title="Click to edit"
              >
                {daily_target} pages
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Daily progress ring */}
      <ProgressRing pages={pages_today} target={daily_target} />

      {/* Heatmap */}
      <div style={styles.heatmapSection}>
        <h3 style={styles.sectionTitle}>Reading Activity</h3>
        <Heatmap logs={heatmap} target={daily_target} />
      </div>
    </div>
  )
}

// ── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ pages, target }) {
  const pct = Math.min(100, (pages / target) * 100)
  const r = 40
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const done = pages >= target

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0' }}>
      <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="#2a2a2a" strokeWidth={8} />
        <circle
          cx={50} cy={50} r={r} fill="none"
          stroke={done ? '#4caf50' : '#7eb3e8'}
          strokeWidth={8}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s' }}
        />
      </svg>
      <div style={{ marginTop: '-0.5rem', fontSize: '0.8rem', color: '#aaa' }}>
        {Math.round(pct)}% of daily goal
      </div>
    </div>
  )
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function Heatmap({ logs, target }) {
  const logMap = {}
  logs.forEach(l => { logMap[l.date] = l.pages_read })

  // Last 52 weeks
  const today = startOfDay(new Date())
  const start = subDays(today, 364)
  const days = eachDayOfInterval({ start, end: today })

  const maxPages = Math.max(...Object.values(logMap), target, 1)

  const getColor = (date) => {
    const key = format(date, 'yyyy-MM-dd')
    const pages = logMap[key] || 0
    if (pages === 0) return '#1a1a1a'
    const intensity = Math.min(1, pages / maxPages)
    // Blue shades for pages
    const alpha = Math.round(intensity * 255).toString(16).padStart(2, '0')
    return `#1a5276${alpha.substring(0, 2)}` + (intensity > 0.5 ? 'ff' : '99')
  }

  const getIntensityColor = (pages) => {
    if (pages === 0) return '#1a1a1a'
    if (pages >= target) return '#4caf50'
    if (pages >= target * 0.7) return '#2e7d32'
    if (pages >= target * 0.3) return '#1565c0'
    return '#0d47a1'
  }

  // Group by week
  const weeks = []
  let week = []
  days.forEach((day, i) => {
    const dow = day.getDay()
    if (i === 0) {
      // Fill leading empty days
      for (let d = 0; d < dow; d++) week.push(null)
    }
    week.push(day)
    if (dow === 6 || i === days.length - 1) {
      weeks.push(week)
      week = []
    }
  })

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-start' }}>
        {weeks.map((w, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {(w.length < 7 ? [...w, ...Array(7 - w.length).fill(null)] : w).map((day, di) => {
              if (!day) return <div key={di} style={{ width: 11, height: 11 }} />
              const key = format(day, 'yyyy-MM-dd')
              const pages = logMap[key] || 0
              return (
                <div
                  key={di}
                  title={`${key}: ${pages} pages`}
                  style={{
                    width: 11, height: 11, borderRadius: 2,
                    background: getIntensityColor(pages),
                    cursor: 'default',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
        <span>Less</span>
        {[0, 0.3, 0.6, 1].map((v, i) => (
          <div key={i} style={{ width: 11, height: 11, borderRadius: 2, background: v === 0 ? '#1a1a1a' : v < 0.5 ? '#0d47a1' : v < 0.8 ? '#1565c0' : '#4caf50' }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '1.5rem',
    maxWidth: '700px',
    margin: '0 auto',
    color: '#e8e6e3',
  },
  loading: { padding: '2rem', color: '#aaa', textAlign: 'center' },
  streakRow: { display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' },
  streakCard: {
    background: '#1e1e1e', border: '1px solid #333', borderRadius: '12px',
    padding: '1.5rem', display: 'flex', flexDirection: 'column',
    alignItems: 'center', minWidth: '120px', flex: '0 0 auto',
  },
  streakFlame: { fontSize: '2rem' },
  streakNumber: { fontSize: '2.5rem', fontWeight: 'bold', lineHeight: 1 },
  streakLabel: { fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' },
  freezeTag: {
    marginTop: '0.5rem', fontSize: '0.7rem', color: '#7eb3e8',
    background: '#1a2a3a', padding: '0.2rem 0.5rem', borderRadius: '4px',
  },
  statsCard: {
    background: '#1e1e1e', border: '1px solid #333', borderRadius: '12px',
    padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem',
  },
  statRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: '0.85rem', color: '#888' },
  statValue: { fontSize: '0.9rem', fontWeight: '500', color: '#e8e6e3' },
  targetInput: {
    width: '50px', background: '#2a2a2a', color: '#eee',
    border: '1px solid #555', borderRadius: '4px',
    padding: '0.2rem 0.4rem', fontSize: '0.85rem',
  },
  saveBtn: { background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' },
  cancelBtn: { background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '0.9rem' },
  heatmapSection: { marginTop: '1.5rem' },
  sectionTitle: { fontSize: '0.9rem', color: '#888', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
}
