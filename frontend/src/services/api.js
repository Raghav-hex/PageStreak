import axios from 'axios'

// On Render static sites, we need the full backend URL
// In dev, falls back to relative /api (via Vite proxy)
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Inject JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ps_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global 401 handler — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ps_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ───────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (email, password) => api.post('/auth/register', { email, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateMe: (data) => api.patch('/auth/me', data),
}

// ── Books ──────────────────────────────────────────────────────────────────────
export const booksApi = {
  upload: (file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/books/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
  },
  list: (status = 'active') => api.get('/books/', { params: { status } }),
  get: (id) => api.get(`/books/${id}`),
  cover: (id) => `${BASE_URL}/books/${id}/cover`,
  chunk: (bookId, chunkIndex) => api.get(`/books/${bookId}/chunks/${chunkIndex}`),
  toc: (bookId) => api.get(`/books/${bookId}/toc`),
  markComplete: (id) => api.post(`/books/${id}/complete`),
  delete: (id) => api.delete(`/books/${id}`),
}

// ── Reading ────────────────────────────────────────────────────────────────────
export const readingApi = {
  updateProgress: (bookId, chunkIndex, timeSpentSeconds = 0) =>
    api.post('/reading/progress', {
      book_id: bookId,
      chunk_index: chunkIndex,
      time_spent_seconds: timeSpentSeconds,
    }),
  dashboard: () => api.get('/reading/dashboard'),
  bookStats: (bookId) => api.get(`/reading/books/${bookId}/stats`),
}

export default api
