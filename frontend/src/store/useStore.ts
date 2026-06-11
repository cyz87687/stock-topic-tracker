import { create } from 'zustand'

interface AppState {
  currentDate: string
  currentTab: 'home' | 'board' | 'analysis' | 'rotation' | 'personal'
  favorites: string[]
  setDate: (date: string) => void
  setTab: (tab: AppState['currentTab']) => void
  toggleFavorite: (name: string) => void
}

function loadFavorites(): string[] {
  try {
    const saved = localStorage.getItem('stock-favorites')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveFavorites(favorites: string[]) {
  localStorage.setItem('stock-favorites', JSON.stringify(favorites))
}

function getToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const useStore = create<AppState>((set, get) => ({
  currentDate: getToday(),
  currentTab: 'home',
  favorites: loadFavorites(),
  setDate: (date) => set({ currentDate: date }),
  setTab: (tab) => set({ currentTab: tab }),
  toggleFavorite: (name) => {
    const { favorites } = get()
    const next = favorites.includes(name)
      ? favorites.filter((f) => f !== name)
      : [...favorites, name]
    saveFavorites(next)
    set({ favorites: next })
  },
}))
