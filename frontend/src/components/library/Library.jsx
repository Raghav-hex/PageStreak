import { useState, useEffect, useRef } from 'react'
import { booksApi } from '../../services/api'

export default function Library({ onOpenBook }) {
  const [books, setBooks] = useState([])
  const [completed, setCompleted] = useState([])
  const [view, setView] = useState(() => localStorage.getItem('ps_libview') || 'grid')
  const [tab, setTab] = useState('active')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const fileRef = useRef()

  const fetchBooks = async () => {
    const [activeRes, completedRes] = await Promise.all([
      booksApi.list('active'),
      booksApi.list('completed'),
    ])
    setBooks(activeRes.data)
    setCompleted(completedRes.data)
    setLoading(false)
  }

  useEffect(() => { fetchBooks() }, [])

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    setUploadProgress(0)
    try {
      await booksApi.upload(file, setUploadProgress)
      await fetchBooks()
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Upload failed. Please check the file.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const handleDelete = async (bookId) => {
    if (!confirm('Delete this book?')) return
    await booksApi.delete(bookId)
    await fetchBooks()
  }

  const handleComplete = async (bookId) => {
    await booksApi.markComplete(bookId)
    await fetchBooks()
  }

  const displayBooks = tab === 'active' ? books : completed
  const setViewAndStore = (v) => { setView(v); localStorage.setItem('ps_libview', v) }

  return (
    <div style={{ padding: '1.5rem', color: '#e8e6e3', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <TabBtn active={tab === 'active'} onClick={() => setTab('active')}>
            📚 Reading ({books.length})
          </TabBtn>
          <TabBtn active={tab === 'completed'} onClick={() => setTab('completed')}>
            ✅ Completed ({completed.length})
          </TabBtn>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <IconBtn active={view === 'grid'} onClick={() => setViewAndStore('grid')} title="Grid view">⊞</IconBtn>
          <IconBtn active={view === 'list'} onClick={() => setViewAndStore('list')} title="List view">☰</IconBtn>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              background: '#1a5276', color: '#fff', border: 'none',
              borderRadius: '6px', padding: '0.4rem 1rem',
              cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {uploading ? `Uploading ${uploadProgress}%` : '+ Upload Book'}
          </button>
          <input
            ref={fileRef} type="file" accept=".epub,.pdf"
            style={{ display: 'none' }}
            onChange={e => handleUpload(e.target.files[0])}
          />
        </div>
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div style={{ marginBottom: '1rem', height: '4px', background: '#333', borderRadius: '2px' }}>
          <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#7eb3e8', borderRadius: '2px', transition: 'width 0.2s' }} />
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div style={{
          background: '#2d1a1a', border: '1px solid #7b2d2d', borderRadius: '8px',
          padding: '0.75rem 1rem', marginBottom: '1rem', color: '#e57373',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>⚠️ {uploadError}</span>
          <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Drop zone */}
      {books.length === 0 && tab === 'active' && !loading && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed #333', borderRadius: '12px',
            padding: '3rem', textAlign: 'center', cursor: 'pointer',
            color: '#555', marginBottom: '1rem',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📖</div>
          <div>Drop an EPUB or PDF here, or click to upload your first book</div>
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ color: '#666', padding: '2rem', textAlign: 'center' }}>Loading library...</div>}

      {/* Books */}
      {!loading && (
        view === 'grid'
          ? <GridView books={displayBooks} onOpen={onOpenBook} onDelete={handleDelete} onComplete={handleComplete} />
          : <ListView books={displayBooks} onOpen={onOpenBook} onDelete={handleDelete} onComplete={handleComplete} />
      )}
    </div>
  )
}

// ── Grid View ─────────────────────────────────────────────────────────────────
function GridView({ books, onOpen, onDelete, onComplete }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
      {books.map(book => (
        <div key={book.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div
            onClick={() => onOpen(book)}
            style={{
              aspectRatio: '2/3', background: '#1e1e1e', borderRadius: '6px',
              overflow: 'hidden', cursor: 'pointer', position: 'relative',
              border: '1px solid #333',
            }}
          >
            {book.has_cover ? (
              <img src={booksApi.cover(book.id)} alt={book.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <PlaceholderCover title={book.title} />
            )}
            {/* Progress overlay */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '3px', background: '#111',
            }}>
              <div style={{
                height: '100%', width: `${book.progress_percent}%`,
                background: '#7eb3e8',
              }} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#ccc', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {book.title}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#666' }}>{book.progress_percent}%</div>
          <BookMenu book={book} onDelete={onDelete} onComplete={onComplete} />
        </div>
      ))}
    </div>
  )
}

// ── List View ─────────────────────────────────────────────────────────────────
function ListView({ books, onOpen, onDelete, onComplete }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {books.map(book => (
        <div key={book.id} style={{
          background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px',
          padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          {/* Mini cover */}
          <div onClick={() => onOpen(book)} style={{ cursor: 'pointer', flexShrink: 0 }}>
            {book.has_cover ? (
              <img src={booksApi.cover(book.id)} alt=""
                style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '3px' }} />
            ) : (
              <div style={{ width: '40px', height: '60px', background: '#2a2a2a', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📖</div>
            )}
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onOpen(book)}>
            <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</div>
            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>{book.author || 'Unknown author'}</div>
            <div style={{ marginTop: '0.4rem', height: '4px', background: '#2a2a2a', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: `${book.progress_percent}%`, background: '#7eb3e8', borderRadius: '2px' }} />
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', color: '#aaa' }}>{book.progress_percent}%</div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>{book.total_pages}p</div>
          </div>
          <BookMenu book={book} onDelete={onDelete} onComplete={onComplete} />
        </div>
      ))}
    </div>
  )
}

function PlaceholderCover({ title }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: '#2a2a3a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0.5rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>📖</div>
      <div style={{ fontSize: '0.65rem', color: '#aaa', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
        {title}
      </div>
    </div>
  )
}

function BookMenu({ book, onDelete, onComplete }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.1rem' }}>⋯</button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', zIndex: 20,
          background: '#222', border: '1px solid #333', borderRadius: '6px',
          minWidth: '130px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {book.status === 'active' && (
            <MenuItem onClick={() => { onComplete(book.id); setOpen(false) }}>✅ Mark Complete</MenuItem>
          )}
          <MenuItem onClick={() => { onDelete(book.id); setOpen(false) }} danger>🗑 Delete</MenuItem>
        </div>
      )}
    </div>
  )
}

function MenuItem({ children, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left',
      padding: '0.5rem 0.75rem', background: 'transparent', border: 'none',
      color: danger ? '#e57373' : '#ccc', cursor: 'pointer', fontSize: '0.85rem',
    }}
      onMouseOver={e => e.target.style.background = '#2a2a2a'}
      onMouseOut={e => e.target.style.background = 'transparent'}
    >{children}</button>
  )
}

function TabBtn({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? '#1a3a5c' : 'transparent',
      color: active ? '#7eb3e8' : '#666',
      border: `1px solid ${active ? '#1a5276' : '#333'}`,
      borderRadius: '6px', padding: '0.4rem 0.8rem',
      cursor: 'pointer', fontSize: '0.85rem',
    }}>{children}</button>
  )
}

function IconBtn({ active, children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: active ? '#1a3a5c' : 'transparent',
      color: active ? '#7eb3e8' : '#666',
      border: `1px solid ${active ? '#1a5276' : '#333'}`,
      borderRadius: '6px', padding: '0.4rem 0.6rem',
      cursor: 'pointer', fontSize: '0.9rem',
    }}>{children}</button>
  )
}
