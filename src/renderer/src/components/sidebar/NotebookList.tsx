import { useEditor, useValue } from 'tldraw'
import { useMemo, useState } from 'react'
import { MARKDOWN_NOTEBOOK_TYPE, type MarkdownNotebookShape } from '../canvas/MarkdownShape'
import { parseWikilinks, resolveWikilink, type NotebookInfo } from '../../lib/wikilinks'

const styles = {
  container: {
    width: 260,
    height: '100%',
    background: '#161616',
    borderLeft: '1px solid #2a2a2a',
    display: 'flex',
    flexDirection: 'column' as const,
    flexShrink: 0
  },
  header: {
    padding: '12px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#aaa',
    borderBottom: '1px solid #2a2a2a'
  },
  search: {
    margin: '8px 12px',
    padding: '6px 10px',
    fontSize: 12,
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#e0e0e0',
    outline: 'none',
    width: 'calc(100% - 24px)'
  },
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0'
  },
  item: {
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 13,
    color: '#ccc',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    transition: 'background 150ms ease'
  },
  itemTitle: {
    fontWeight: 500
  },
  itemId: {
    fontSize: 11,
    color: '#666'
  },
  section: {
    padding: '10px 16px 4px',
    fontSize: 11,
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  backlinkItem: {
    padding: '6px 16px',
    cursor: 'pointer',
    fontSize: 12,
    color: '#a78bfa',
    transition: 'background 150ms ease'
  },
  empty: {
    padding: '20px 16px',
    fontSize: 13,
    color: '#555',
    textAlign: 'center' as const
  }
}

interface NotebookListProps {
  selectedShapeId?: string | null
}

export default function NotebookList({ selectedShapeId }: NotebookListProps): JSX.Element {
  const editor = useEditor()
  const [search, setSearch] = useState('')

  // Get all notebook shapes reactively
  const notebooks = useValue(
    'notebooks-for-sidebar',
    () =>
      editor
        .getCurrentPageShapes()
        .filter(
          (s): s is MarkdownNotebookShape => s.type === MARKDOWN_NOTEBOOK_TYPE
        ),
    [editor]
  )

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return notebooks
    const q = search.toLowerCase()
    return notebooks.filter(
      (n) =>
        n.props.title.toLowerCase().includes(q) ||
        n.props.notebookId.toLowerCase().includes(q) ||
        n.props.markdown.toLowerCase().includes(q)
    )
  }, [notebooks, search])

  // Compute backlinks for selected notebook
  const backlinks = useMemo(() => {
    if (!selectedShapeId) return []
    const selected = notebooks.find((n) => n.id === selectedShapeId)
    if (!selected) return []

    const infoList: NotebookInfo[] = notebooks.map((n) => ({
      shapeId: n.id,
      notebookId: n.props.notebookId,
      title: n.props.title
    }))

    return notebooks.filter((n) => {
      if (n.id === selectedShapeId) return false
      const links = parseWikilinks(n.props.markdown)
      return links.some((link) => {
        const resolved = resolveWikilink(link.target, infoList)
        return resolved?.shapeId === selectedShapeId
      })
    })
  }, [notebooks, selectedShapeId])

  const handleClick = (shapeId: string) => {
    editor.select(shapeId as any)
    editor.zoomToSelection({ animation: { duration: 300 } })
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Notebooks</div>

      <input
        style={styles.search}
        placeholder="Search notebooks..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={styles.list}>
        {filtered.length === 0 && (
          <div style={styles.empty}>
            {notebooks.length === 0
              ? 'No notebooks yet. Click "Add Notebook" to create one.'
              : 'No matching notebooks.'}
          </div>
        )}

        {filtered.map((n) => (
          <div
            key={n.id}
            style={{
              ...styles.item,
              background: n.id === selectedShapeId ? 'rgba(79, 143, 247, 0.1)' : 'transparent'
            }}
            onClick={() => handleClick(n.id)}
            onMouseEnter={(e) => {
              if (n.id !== selectedShapeId)
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            }}
            onMouseLeave={(e) => {
              if (n.id !== selectedShapeId)
                e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={styles.itemTitle}>{n.props.title}</span>
            <span style={styles.itemId}>{n.props.notebookId}</span>
          </div>
        ))}

        {/* Backlinks section */}
        {selectedShapeId && backlinks.length > 0 && (
          <>
            <div style={styles.section}>Backlinks ({backlinks.length})</div>
            {backlinks.map((n) => (
              <div
                key={n.id}
                style={styles.backlinkItem}
                onClick={() => handleClick(n.id)}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(167, 139, 250, 0.1)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                &#8592; {n.props.title}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
