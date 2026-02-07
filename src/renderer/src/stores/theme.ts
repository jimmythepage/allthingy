import { create } from 'zustand'

type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const THEME_KEY = 'bbboard:theme'

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'light') {
    root.style.setProperty('--bg-primary', '#f5f5f5')
    root.style.setProperty('--bg-secondary', '#ffffff')
    root.style.setProperty('--bg-tertiary', '#eaeaea')
    root.style.setProperty('--bg-hover', '#e0e0e0')
    root.style.setProperty('--text-primary', '#1a1a1a')
    root.style.setProperty('--text-secondary', '#666')
    root.style.setProperty('--text-muted', '#999')
    root.style.setProperty('--border', '#ddd')
    root.style.setProperty('--border-light', '#ccc')
  } else {
    root.style.setProperty('--bg-primary', '#0f0f0f')
    root.style.setProperty('--bg-secondary', '#1a1a1a')
    root.style.setProperty('--bg-tertiary', '#242424')
    root.style.setProperty('--bg-hover', '#2a2a2a')
    root.style.setProperty('--text-primary', '#e8e8e8')
    root.style.setProperty('--text-secondary', '#999')
    root.style.setProperty('--text-muted', '#666')
    root.style.setProperty('--border', '#2a2a2a')
    root.style.setProperty('--border-light', '#333')
  }
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = loadTheme()
  // Apply on creation
  setTimeout(() => applyTheme(initial), 0)

  return {
    theme: initial,

    setTheme: (theme) => {
      localStorage.setItem(THEME_KEY, theme)
      applyTheme(theme)
      set({ theme })
    },

    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_KEY, next)
      applyTheme(next)
      set({ theme: next })
    }
  }
})
