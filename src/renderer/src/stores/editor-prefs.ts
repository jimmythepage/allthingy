import { create } from 'zustand'

const STORAGE_KEY = 'bbboard:editor-prefs'

interface EditorPrefs {
  colorScheme: 'dark' | 'light' | 'system'
  isGridMode: boolean
}

interface EditorPrefsState extends EditorPrefs {
  update: (prefs: Partial<EditorPrefs>) => void
}

function loadFromStorage(): EditorPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        colorScheme: parsed.colorScheme ?? 'dark',
        isGridMode: parsed.isGridMode ?? false
      }
    }
  } catch {
    // ignore parse errors
  }
  return {
    colorScheme: 'dark',
    isGridMode: false
  }
}

function saveToStorage(prefs: EditorPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore storage errors
  }
}

export const useEditorPrefsStore = create<EditorPrefsState>((set, get) => {
  const initial = loadFromStorage()
  return {
    ...initial,
    update: (prefs) => {
      const current = get()
      const merged = {
        colorScheme: prefs.colorScheme ?? current.colorScheme,
        isGridMode: prefs.isGridMode ?? current.isGridMode
      }
      saveToStorage(merged)
      set(merged)
    }
  }
})
