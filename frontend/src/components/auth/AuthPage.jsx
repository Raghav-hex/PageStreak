import { useState } from 'react'
import useAuthStore from '../../store/authStore'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuthStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#111', color: '#e8e6e3',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px', padding: '2rem',
        background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem' }}>📚🔥</div>
          <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: '700' }}>PageStreak</h1>
          <p style={{ margin: '0.3rem 0 0', color: '#666', fontSize: '0.85rem' }}>
            Read more. Streak harder.
          </p>
        </div>

        {/* Tab */}
        <div style={{ display: 'flex', marginBottom: '1.5rem', gap: '0.5rem' }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '0.5rem',
              background: mode === m ? '#1a3a5c' : 'transparent',
              color: mode === m ? '#7eb3e8' : '#666',
              border: `1px solid ${mode === m ? '#1a5276' : '#333'}`,
              borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', textTransform: 'capitalize',
            }}>{m}</button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required
            style={inputStyle}
          />
          <input
            type="password" placeholder="Password (min 6 chars)" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6}
            style={inputStyle}
          />

          {error && (
            <div style={{ color: '#e57373', fontSize: '0.85rem', padding: '0.5rem', background: '#2d1a1a', borderRadius: '6px' }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: '0.75rem', background: '#1a5276', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1rem', fontWeight: '500', marginTop: '0.5rem',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '0.75rem', background: '#111',
  color: '#e8e6e3', border: '1px solid #333', borderRadius: '8px',
  fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none',
}
