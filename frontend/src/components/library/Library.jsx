import { useState, useEffect, useRef } from 'react'
import { booksApi } from '../../services/api'

export default function Library({ onOpenBook }) {
  const [books,     setBooks]     = useState([])
  const [completed, setCompleted] = useState([])
  const [view,      setView]      = useState(() => localStorage.getItem('ps_libview') || 'grid')
  const [tab,       setTab]       = useState('active')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError,    setUploadError]    = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [dragOver,  setDragOver]  = useState(false)
  const fileRef = useRef()

  const fetchBooks = async () => {
    try {
      const [aRes, cRes] = await Promise.all([booksApi.list('active'), booksApi.list('completed')])
      setBooks(aRes.data)
      setCompleted(cRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchBooks() }, [])

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true); setUploadError(null); setUploadProgress(0)
    try {
      await booksApi.upload(file, setUploadProgress)
      await fetchBooks()
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Upload failed. Please check the file.')
    } finally { setUploading(false); setUploadProgress(0) }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const handleDelete   = async (id) => { if (confirm('Delete this book?')) { await booksApi.delete(id); fetchBooks() } }
  const handleComplete = async (id) => { await booksApi.markComplete(id); fetchBooks() }

  const displayBooks = tab === 'active' ? books : completed
  const setViewAndStore = (v) => { setView(v); localStorage.setItem('ps_libview', v) }

  return (
    <div style={{ padding: '1.5rem', color: '#e8e6e3', maxWidth: '960px', margin: '0 auto' }}>

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <TabBtn active={tab === 'active'}    onClick={() => setTab('active')}>📚 Reading ({books.length})</TabBtn>
          <TabBtn active={tab === 'completed'} onClick={() => setTab('completed')}>✅ Done ({completed.length})</TabBtn>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <IconBtn active={view === 'grid'} onClick={() => setViewAndStore('grid')} title="Grid">⊞</IconBtn>
          <IconBtn active={view === 'list'} onClick={() => setViewAndStore('list')} title="List">☰</IconBtn>
          <UploadBtn uploading={uploading} progress={uploadProgress} onClick={() => fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept=".epub,.pdf" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
        </div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div style={{ height: '3px', background: '#1e1e1e', borderRadius: '2px', marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#7eb3e8', transition: 'width 0.2s', borderRadius: '2px' }} />
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <div style={{ background: '#1e1010', border: '1px solid #4a1a1a', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#e57373', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
          <span>⚠️ {uploadError}</span>
          <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', padding: '0 0.25rem' }}>✕</button>
        </div>
      )}

      {/* Empty / Drop zone */}
      {!loading && displayBooks.length === 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#7eb3e8' : '#2a2a2a'}`,
            borderRadius: '16px', padding: '4rem 2rem',
            textAlign: 'center', cursor: 'pointer',
            background: dragOver ? '#0d1a2a' : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>
            {tab === 'completed' ? '🏆' : '📖'}
          </div>
          <div style={{ color: '#555', fontSize: '0.95rem' }}>
            {tab === 'completed'
              ? 'No completed books yet — keep reading!'
              : 'Drop an EPUB or PDF here, or click to upload'}
          </div>
          {tab === 'active' && <div style={{ color: '#444', fontSize: '0.8rem', marginTop: '0.5rem' }}>Supports .epub and .pdf</div>}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner />
        </div>
      )}

      {/* Books */}
      {!loading && displayBooks.length > 0 && (
        view === 'grid'
          ? <GridView books={displayBooks} onOpen={onOpenBook} onDelete={handleDelete} onComplete={handleComplete} />
          : <ListView books={displayBooks} onOpen={onOpenBook} onDelete={handleDelete} onComplete={handleComplete} />
      )}
    </div>
  )
}

// ── Grid ──────────────────────────────────────────────────────────────────────
function GridView({ books, onOpen, onDelete, onComplete }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '1.25rem' }}>
      {books.map(book => (
        <div key={book.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Cover */}
          <div
            onClick={() => onOpen(book)}
            style={{
              aspectRatio: '2/3', borderRadius: '8px', overflow: 'hidden',
              cursor: 'pointer', position: 'relative',
              border: '1px solid #2a2a2a', background: '#181818',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.5)' }}
            onMouseOut={e  => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)' }}
          >
            {book.has_cover
              ? <img src={booksApi.cover(book.id)} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <PlaceholderCover title={book.title} fileType={book.file_type} />
            }
            {/* Progress bar at bottom */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'rgba(0,0,0,0.5)' }}>
              <div style={{ height: '100%', width: `${book.progress_percent}%`, background: '#7eb3e8', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Title */}
          <div style={{ fontSize: '0.78rem', color: '#ccc', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', cursor: 'pointer' }} onClick={() => onOpen(book)}>
            {book.title}
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#555' }}>{book.progress_percent}%</span>
            <BookMenu book={book} onDelete={onDelete} onComplete={onComplete} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── List ──────────────────────────────────────────────────────────────────────
function ListView({ books, onOpen, onDelete, onComplete }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {books.map(book => (
        <div key={book.id} style={{
          background: '#161616', border: '1px solid #222', borderRadius: '10px',
          padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem',
          cursor: 'pointer', transition: 'background 0.15s',
        }}
          onMouseOver={e => e.currentTarget.style.background = '#1c1c1c'}
          onMouseOut={e  => e.currentTarget.style.background = '#161616'}
        >
          {/* Cover thumbnail */}
          <div onClick={() => onOpen(book)} style={{ flexShrink: 0, borderRadius: '4px', overflow: 'hidden', width: '42px', height: '62px', border: '1px solid #2a2a2a' }}>
            {book.has_cover
              ? <img src={booksApi.cover(book.id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <PlaceholderCover title="" fileType={book.file_type} small />
            }
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }} onClick={() => onOpen(book)}>
            <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.92rem' }}>{book.title}</div>
            <div style={{ fontSize: '0.78rem', color: '#666', marginTop: '0.15rem' }}>{book.author || 'Unknown author'}</div>
            <div style={{ marginTop: '0.5rem', height: '3px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${book.progress_percent}%`, background: '#7eb3e8', borderRadius: '2px' }} />
            </div>
          </div>

          {/* Stats */}
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontSize: '0.82rem', color: '#aaa' }}>{book.progress_percent}%</div>
            <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '0.2rem' }}>{book.total_pages}p</div>
          </div>

          <BookMenu book={book} onDelete={onDelete} onComplete={onComplete} />
        </div>
      ))}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function PlaceholderCover({ title, fileType, small }) {
  const isPdf = (fileType?.value ?? fileType) === 'pdf'
  return (
    <div style={{ width: '100%', height: '100%', background: isPdf ? '#1a1020' : '#101828', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.4rem', textAlign: 'center' }}>
      <div style={{ fontSize: small ? '1rem' : '1.8rem', marginBottom: '0.3rem' }}>{isPdf ? '📄' : '📖'}</div>
      {!small && <div style={{ fontSize: '0.6rem', color: '#666', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{title}</div>}
    </div>
  )
}

function BookMenu({ book, onDelete, onComplete }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const h = () => setOpen(false)
    setTimeout(() => window.addEventListener('click', h), 0)
    return () => window.removeEventListener('click', h)
  }, [open])

  return (
    <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(v => !v)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.25rem', lineHeight: 1 }}>⋯</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 30, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', minWidth: '140px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
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
    <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.55rem 0.9rem', background: 'transparent', border: 'none', color: danger ? '#e57373' : '#ccc', cursor: 'pointer', fontSize: '0.83rem' }}
      onMouseOver={e => e.target.style.background = '#252525'}
      onMouseOut={e  => e.target.style.background = 'transparent'}
    >{children}</button>
  )
}

function TabBtn({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{ background: active ? '#1a3a5c' : 'transparent', color: active ? '#7eb3e8' : '#555', border: `1px solid ${active ? '#1a4a6c' : '#222'}`, borderRadius: '6px', padding: '0.38rem 0.85rem', cursor: 'pointer', fontSize: '0.83rem', transition: 'all 0.15s' }}>{children}</button>
  )
}

function IconBtn({ active, children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{ background: active ? '#1a3a5c' : 'transparent', color: active ? '#7eb3e8' : '#555', border: `1px solid ${active ? '#1a4a6c' : '#222'}`, borderRadius: '6px', padding: '0.38rem 0.65rem', cursor: 'pointer', fontSize: '0.9rem' }}>{children}</button>
  )
}

function UploadBtn({ uploading, progress, onClick }) {
  return (
    <button onClick={onClick} disabled={uploading} style={{
      background: uploading ? '#0d1e2e' : '#1a5276',
      color: '#7eb3e8', border: '1px solid #1a4a6c',
      borderRadius: '6px', padding: '0.38rem 1rem',
      cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.83rem',
      transition: 'background 0.15s', minWidth: '120px',
    }}>
      {uploading ? `${progress}% uploading…` : '+ Upload Book'}
    </button>
  )
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes ps-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #222', borderTopColor: '#7eb3e8', animation: 'ps-spin 0.75s linear infinite' }} />
    </>
  )
}
