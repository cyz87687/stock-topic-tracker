import { create } from 'zustand'

interface AppState {
  currentTab: 'home' | 'board' | 'analysis' | 'rotation' | 'personal'
  favorites: string[]
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

export const useStore = create<AppState>((set, get) => ({
  currentTab: 'home',
  favorites: loadFavorites(),
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

export function getTodayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
