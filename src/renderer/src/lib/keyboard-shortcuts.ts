import { useEffect } from 'react'

type ShortcutHandler = () => void

interface Shortcuts {
  [key: string]: ShortcutHandler
}

/**
 * Hook to register global keyboard shortcuts.
 *
 * Key format: modifier+key (e.g., "meta+s", "meta+n", "meta+p", "meta+shift+g")
 * Modifiers: meta (Cmd on Mac), ctrl, shift, alt
 */
export function useKeyboardShortcuts(shortcuts: Shortcuts): void {
  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      // Don't intercept shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('.cm-editor')
      ) {
        return
      }

      const parts: string[] = []
      if (e.metaKey || e.ctrlKey) parts.push('meta')
      if (e.shiftKey) parts.push('shift')
      if (e.altKey) parts.push('alt')
      parts.push(e.key.toLowerCase())

      const combo = parts.join('+')

      if (shortcuts[combo]) {
        e.preventDefault()
        e.stopPropagation()
        shortcuts[combo]()
      }
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [shortcuts])
}
