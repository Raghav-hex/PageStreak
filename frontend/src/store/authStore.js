import { create } from 'zustand'
import { authApi } from '../services/api'

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('ps_token'),
  loading: true,

  init: async () => {
    const token = localStorage.getItem('ps_token')
    if (!token) { set({ loading: false }); return }
    try {
      const res = await authApi.me()
      set({ user: res.data, loading: false })
    } catch {
      localStorage.removeItem('ps_token')
      set({ user: null, token: null, loading: false })
    }
  },

  login: async (email, password) => {
    const res = await authApi.login(email, password)
    localStorage.setItem('ps_token', res.data.access_token)
    set({ user: res.data.user, token: res.data.access_token })
    return res.data.user
  },

  register: async (email, password) => {
    const res = await authApi.register(email, password)
    localStorage.setItem('ps_token', res.data.access_token)
    set({ user: res.data.user, token: res.data.access_token })
    return res.data.user
  },

  logout: async () => {
    try { await authApi.logout() } catch {}
    localStorage.removeItem('ps_token')
    set({ user: null, token: null })
  },

  updateUser: (updates) => set((s) => ({ user: { ...s.user, ...updates } })),
}))

export default useAuthStore
