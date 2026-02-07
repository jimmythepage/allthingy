import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Editor } from 'tldraw'
import { MARKDOWN_NOTEBOOK_TYPE, type MarkdownNotebookShape } from '../canvas/MarkdownShape'

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 120,
    zIndex: 2000
  },
  container: {
    width: 500,
    maxHeight: 400,
    background: '#1e1e1e',
    borderRadius: 12,
    border: '1px solid #333',
    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const
  },
  input: {
    width: '100%',
    padding: '14px 18px',
    fontSize: 15,
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #333',
    color: '#e0e0e0',
    outline: 'none'
  },
  results: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0'
  },
  item: {
    padding: '10px 18px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    transition: 'background 100ms ease'
  },
  itemActive: {
    background: 'rgba(79, 143, 247, 0.15)'
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: '#e0e0e0'
  },
  itemSnippet: {
    fontSize: 12,
    color: '#888',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  empty: {
    padding: '24px 18px',
    fontSize: 13,
    color: '#666',
    textAlign: 'center' as const
  },
  hint: {
    padding: '8px 18px',
    fontSize: 11,
    color: '#555',
    borderTop: '1px solid #2a2a2a',
    display: 'flex',
    gap: 16
  },
  kbd: {
    background: '#2a2a2a',
    padding: '1px 5px',
    borderRadius: 3,
    fontSize: 10,
    color: '#888'
  }
}

interface SearchPaletteProps {
  editor: Editor | null
  onClose: () => void
}

interface SearchResult {
  shapeId: string
  title: string
  notebookId: string
  snippet: string
}

export default function SearchPalette({ editor, onClose }: SearchPaletteProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Build results
  const results: SearchResult[] = useMemo(() => {
    if (!editor || !query.trim()) return []
    const q = query.toLowerCase()

    const shapes = editor
      .getCurrentPageShapes()
      .filter(
        (s): s is MarkdownNotebookShape => s.type === MARKDOWN_NOTEBOOK_TYPE
      )

    return shapes
      .filter(
        (s) =>
          s.props.title.toLowerCase().includes(q) ||
          s.props.notebookId.toLowerCase().includes(q) ||
          s.props.markdown.toLowerCase().includes(q)
      )
      .map((s) => {
        // Find a matching line for snippet
        const lines = s.props.markdown.split('\n')
        const matchLine = lines.find((l) => l.toLowerCase().includes(q))
        return {
          shapeId: s.id,
          title: s.props.title,
          notebookId: s.props.notebookId,
          snippet: matchLine || lines[0] || ''
        }
      })
  }, [editor, query])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (!editor) return
      editor.select(result.shapeId as any)
      editor.zoomToSelection({ animation: { duration: 300 } })
      onClose()
    },
    [editor, onClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter' && results[activeIndex]) {
        handleSelect(results[activeIndex])
        return
      }
    },
    [results, activeIndex, handleSelect, onClose]
  )

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [results])

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.container} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          style={styles.input}
          placeholder="Search notebooks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div style={styles.results}>
          {query.trim() && results.length === 0 && (
            <div style={styles.empty}>No results found</div>
          )}
          {!query.trim() && (
            <div style={styles.empty}>Type to search across all notebooks</div>
          )}
          {results.map((r, i) => (
            <div
              key={r.shapeId}
              style={{
                ...styles.item,
                ...(i === activeIndex ? styles.itemActive : {})
              }}
              onClick={() => handleSelect(r)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span style={styles.itemTitle}>{r.title}</span>
              <span style={styles.itemSnippet}>{r.snippet}</span>
            </div>
          ))}
        </div>

        <div style={styles.hint}>
          <span>
            <span style={styles.kbd}>&#8593;&#8595;</span> navigate
          </span>
          <span>
            <span style={styles.kbd}>&#9166;</span> select
          </span>
          <span>
            <span style={styles.kbd}>esc</span> close
          </span>
        </div>
      </div>
    </div>
  )
}
