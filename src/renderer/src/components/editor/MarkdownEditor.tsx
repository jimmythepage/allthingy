import { useEffect, useRef, useCallback } from 'react'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { oneDark } from '@codemirror/theme-one-dark'

interface MarkdownEditorProps {
  initialValue: string
  onChange: (value: string) => void
  onBlur?: () => void
  autoFocus?: boolean
  placeholder?: string
  extensions?: Extension[]
}

export default function MarkdownEditor({
  initialValue,
  onChange,
  onBlur,
  autoFocus = true,
  placeholder = 'Start writing...',
  extensions: extraExtensions = []
}: MarkdownEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Stop propagation so tldraw doesn't intercept keyboard events
    e.stopPropagation()
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        markdown(),
        history(),
        oneDark,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        cmPlaceholder(placeholder),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': {
            fontSize: '13px',
            height: '100%'
          },
          '.cm-content': {
            padding: '12px',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            caretColor: '#4f8ff7'
          },
          '.cm-scroller': {
            overflow: 'auto'
          },
          '.cm-focused': {
            outline: 'none'
          },
          '.cm-tooltip-autocomplete': {
            background: '#1e1e1e',
            border: '1px solid #333',
            borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
          },
          '.cm-completionLabel': {
            color: '#e0e0e0'
          },
          '.cm-completionDetail': {
            color: '#888',
            fontStyle: 'normal'
          }
        }),
        EditorView.domEventHandlers({
          blur: () => {
            if (onBlur) onBlur()
          }
        }),
        ...extraExtensions
      ]
    })

    const view = new EditorView({
      state,
      parent: containerRef.current
    })

    viewRef.current = view

    if (autoFocus) {
      requestAnimationFrame(() => {
        view.focus()
      })
    }

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ height: '100%', width: '100%' }}
    />
  )
}
