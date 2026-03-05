import { useEffect, useState } from 'react'
import useAuthStore from './store/authStore'
import AuthPage from './components/auth/AuthPage'
import Library from './components/library/Library'
import Dashboard from './components/dashboard/Dashboard'
import EpubReader from './components/reader/EpubReader'
import PDFReader from './components/reader/PDFReader'
import Onboarding from './components/common/Onboarding'

const NAV_ITEMS = [
  { id: 'library',   label: '📚 Library' },
  { id: 'dashboard', label: '🔥 Streak'  },
]

export default function App() {
  const { user, loading, init, logout } = useAuthStore()
  const [tab, setTab]               = useState('library')
  const [readingBook, setReadingBook] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => { init() }, [])

  useEffect(() => {
    if (user && !localStorage.getItem('ps_onboarded')) setShowOnboarding(true)
  }, [user])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
  }

  if (!user) return <AuthPage />

  // ── Full-screen reader — route by file type ───────────────────────────────
  if (readingBook) {
    const fileType = readingBook.file_type?.value ?? readingBook.file_type ?? 'epub'
    const ReaderComponent = fileType === 'pdf' ? PDFReader : EpubReader
    return (
      <ReaderComponent
        book={readingBook}
        onClose={() => setReadingBook(null)}
        onProgress={() => {}}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{
        background: '#0d0d0d', borderBottom: '1px solid #1e1e1e',
        padding: '0 1.25rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '50px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', marginRight: '1rem', letterSpacing: '-0.5px', color: '#e8e6e3' }}>
            PageStreak
          </span>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{
              background: tab === item.id ? '#1a2a3a' : 'transparent',
              color: tab === item.id ? '#7eb3e8' : '#555',
              border: 'none', borderRadius: '6px',
              padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem',
              transition: 'all 0.15s',
            }}>{item.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#444' }}>{user.email}</span>
          <button onClick={logout} style={{
            background: 'transparent', color: '#444', border: '1px solid #222',
            borderRadius: '6px', padding: '0.25rem 0.65rem',
            cursor: 'pointer', fontSize: '0.78rem',
          }}>Sign out</button>
        </div>
      </nav>

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'library'   && <Library onOpenBook={setReadingBook} />}
        {tab === 'dashboard' && <Dashboard />}
      </main>

      {showOnboarding && (
        <Onboarding onDone={() => {
          localStorage.setItem('ps_onboarded', '1')
          setShowOnboarding(false)
        }} />
      )}
    </div>
  )
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes ps-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid #222', borderTopColor: '#7eb3e8', animation: 'ps-spin 0.75s linear infinite' }} />
    </>
  )
}
