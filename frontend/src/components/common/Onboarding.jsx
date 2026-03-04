import { useState } from 'react'

const STEPS = [
  {
    icon: '📚',
    title: 'Upload Your Book',
    desc: 'Click "+ Upload Book" to add an EPUB or PDF. Your library holds up to 5 active books.',
  },
  {
    icon: '📖',
    title: 'Read in Chunks',
    desc: 'Books are split into ~200-word chunks (2 chunks = 1 page). Navigate with arrow keys on desktop or swipe on mobile.',
  },
  {
    icon: '🔥',
    title: 'Build Your Streak',
    desc: 'Read at least your daily page target every 24 hours to keep your streak alive. You get 1 freeze token per week for emergencies.',
  },
  {
    icon: '🎯',
    title: 'Set Your Target',
    desc: 'Click your daily target on the dashboard to change it. The heatmap tracks your reading intensity over the past year.',
  },
]

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #333', borderRadius: '16px',
        padding: '2.5rem', maxWidth: '380px', width: '90%',
        textAlign: 'center', color: '#e8e6e3',
      }}>
        {/* Icon */}
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>{current.icon}</div>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '1.5rem' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 8, height: 8,
              borderRadius: 4,
              background: i === step ? '#7eb3e8' : '#333',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>

        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.3rem' }}>{current.title}</h2>
        <p style={{ margin: '0 0 2rem', color: '#888', lineHeight: 1.6, fontSize: '0.95rem' }}>{current.desc}</p>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onDone} style={{
            flex: 1, padding: '0.6rem', background: 'transparent',
            color: '#666', border: '1px solid #333', borderRadius: '8px',
            cursor: 'pointer', fontSize: '0.9rem',
          }}>
            Skip
          </button>
          <button
            onClick={() => isLast ? onDone() : setStep(s => s + 1)}
            style={{
              flex: 2, padding: '0.6rem', background: '#1a5276',
              color: '#7eb3e8', border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500',
            }}
          >
            {isLast ? "Let's go! 🚀" : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
