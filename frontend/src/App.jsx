import { useEffect, useState } from 'react'
import useAuthStore from './store/authStore'
import AuthPage from './components/auth/AuthPage'
import Library from './components/library/Library'
import Dashboard from './components/dashboard/Dashboard'
import EpubReader from './components/reader/EpubReader'
import Onboarding from './components/common/Onboarding'

const NAV_ITEMS = [
  { id: 'library', label: '📚 Library' },
  { id: 'dashboard', label: '🔥 Streak' },
]

export default function App() {
  const { user, loading, init, logout } = useAuthStore()
  const [tab, setTab] = useState('library')
  const [readingBook, setReadingBook] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => { init() }, [])

  // Show onboarding for brand new users
  useEffect(() => {
    if (user) {
      const seen = localStorage.getItem('ps_onboarded')
      if (!seen) setShowOnboarding(true)
    }
  }, [user])

  const handleDoneOnboarding = () => {
    localStorage.setItem('ps_onboarded', '1')
    setShowOnboarding(false)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#111',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#666', fontSize: '1rem',
      }}>
        Loading...
      </div>
    )
  }

  if (!user) return <AuthPage />

  // Full-screen reader mode
  if (readingBook) {
    return (
      <EpubReader
        book={readingBook}
        onClose={() => setReadingBook(null)}
        onProgress={() => {}}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <nav style={{
        background: '#0d0d0d', borderBottom: '1px solid #222',
        padding: '0 1rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '48px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <span style={{ color: '#e8e6e3', fontWeight: '700', marginRight: '1rem', fontSize: '1rem' }}>
            📚🔥
          </span>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{
              background: tab === item.id ? '#1a2a3a' : 'transparent',
              color: tab === item.id ? '#7eb3e8' : '#666',
              border: 'none', borderRadius: '6px',
              padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
            }}>
              {item.label}
            </button>
          ))}
        </div>

        {/* User menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#555' }}>{user.email}</span>
          <button
            onClick={logout}
            style={{
              background: 'transparent', color: '#555', border: '1px solid #2a2a2a',
              borderRadius: '6px', padding: '0.25rem 0.6rem',
              cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'library' && (
          <Library onOpenBook={(book) => setReadingBook(book)} />
        )}
        {tab === 'dashboard' && <Dashboard />}
      </main>

      {/* Onboarding overlay */}
      {showOnboarding && <Onboarding onDone={handleDoneOnboarding} />}
    </div>
  )
}
