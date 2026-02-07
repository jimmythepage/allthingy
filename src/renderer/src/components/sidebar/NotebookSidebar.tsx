import { Editor } from 'tldraw'
import { useState, useEffect, useCallback, useMemo, type RefObject } from 'react'
import { MARKDOWN_NOTEBOOK_TYPE, type MarkdownNotebookShape } from '../canvas/MarkdownShape'
import { parseWikilinks, resolveWikilink, type NotebookInfo } from '../../lib/wikilinks'
import GraphView from './GraphView'

type TabId = 'notebooks' | 'graph'

const styles = {
  container: {
    width: 280,
    height: '100%',
    background: '#161616',
    borderLeft: '1px solid #2a2a2a',
    display: 'flex',
    flexDirection: 'column' as const,
    flexShrink: 0
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #2a2a2a'
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'center' as const,
    cursor: 'pointer',
    color: '#666',
    transition: 'all 150ms ease',
    borderBottom: '2px solid transparent',
    background: 'none',
    border: 'none'
  },
  activeTab: {
    color: '#ccc',
    borderBottomColor: 'var(--accent)'
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
  itemMeta: {
    fontSize: 11,
    color: '#666',
    display: 'flex',
    gap: 8
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
  },
  graphWrapper: {
    flex: 1,
    position: 'relative' as const
  }
}

interface NotebookSidebarProps {
  editorRef: RefObject<Editor | null>
}

interface NotebookData {
  shapeId: string
  notebookId: string
  title: string
  markdown: string
  linkCount: number
}

export default function NotebookSidebar({ editorRef }: NotebookSidebarProps): JSX.Element {
  const [notebooks, setNotebooks] = useState<NotebookData[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('notebooks')

  // Poll for changes
  useEffect(() => {
    function refresh(): void {
      const editor = editorRef.current
      if (!editor) return

      const shapes = editor
        .getCurrentPageShapes()
        .filter(
          (s): s is MarkdownNotebookShape => s.type === MARKDOWN_NOTEBOOK_TYPE
        )

      setNotebooks(
        shapes.map((s) => ({
          shapeId: s.id,
          notebookId: s.props.notebookId,
          title: s.props.title,
          markdown: s.props.markdown,
          linkCount: parseWikilinks(s.props.markdown).length
        }))
      )

      const selected = editor.getSelectedShapes()
      if (selected.length === 1 && selected[0].type === MARKDOWN_NOTEBOOK_TYPE) {
        setSelectedId(selected[0].id)
      } else {
        setSelectedId(null)
      }
    }

    refresh()
    const interval = setInterval(refresh, 500)
    return () => clearInterval(interval)
  }, [editorRef])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return notebooks
    const q = search.toLowerCase()
    return notebooks.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.notebookId.toLowerCase().includes(q) ||
        n.markdown.toLowerCase().includes(q)
    )
  }, [notebooks, search])

  // Backlinks
  const backlinks = useMemo(() => {
    if (!selectedId) return []
    const selected = notebooks.find((n) => n.shapeId === selectedId)
    if (!selected) return []

    const infoList: NotebookInfo[] = notebooks.map((n) => ({
      shapeId: n.shapeId,
      notebookId: n.notebookId,
      title: n.title
    }))

    return notebooks.filter((n) => {
      if (n.shapeId === selectedId) return false
      const links = parseWikilinks(n.markdown)
      return links.some((link) => {
        const resolved = resolveWikilink(link.target, infoList)
        return resolved?.shapeId === selectedId
      })
    })
  }, [notebooks, selectedId])

  const handleClick = useCallback(
    (shapeId: string) => {
      const editor = editorRef.current
      if (!editor) return
      editor.select(shapeId as any)
      editor.zoomToSelection({ animation: { duration: 300 } })
    },
    [editorRef]
  )

  return (
    <div style={styles.container}>
      {/* Tab bar */}
      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'notebooks' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('notebooks')}
        >
          Notebooks
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'graph' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('graph')}
        >
          Graph
        </button>
      </div>

      {/* Notebook list tab */}
      {activeTab === 'notebooks' && (
        <>
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
                  ? 'No notebooks yet. Click "+ Notebook" to create one.'
                  : 'No matching notebooks.'}
              </div>
            )}

            {filtered.length > 0 && <div style={styles.section}>All ({filtered.length})</div>}
            {filtered.map((n) => (
              <div
                key={n.shapeId}
                style={{
                  ...styles.item,
                  background:
                    n.shapeId === selectedId ? 'rgba(79, 143, 247, 0.1)' : 'transparent'
                }}
                onClick={() => handleClick(n.shapeId)}
                onMouseEnter={(e) => {
                  if (n.shapeId !== selectedId)
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={(e) => {
                  if (n.shapeId !== selectedId) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={styles.itemTitle}>{n.title}</span>
                <span style={styles.itemMeta}>
                  <span>{n.notebookId}</span>
                  {n.linkCount > 0 && (
                    <span style={{ color: '#a78bfa' }}>
                      {n.linkCount} link{n.linkCount > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
              </div>
            ))}

            {/* Backlinks */}
            {selectedId && backlinks.length > 0 && (
              <>
                <div style={{ ...styles.section, marginTop: 12 }}>
                  Backlinks ({backlinks.length})
                </div>
                {backlinks.map((n) => (
                  <div
                    key={n.shapeId}
                    style={styles.backlinkItem}
                    onClick={() => handleClick(n.shapeId)}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'rgba(167, 139, 250, 0.1)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    &#8592; {n.title}
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* Graph view tab */}
      {activeTab === 'graph' && (
        <div style={styles.graphWrapper}>
          {notebooks.length === 0 ? (
            <div style={styles.empty}>
              Add some notebooks to see the graph.
            </div>
          ) : (
            <GraphView
              notebooks={notebooks}
              onSelectNotebook={handleClick}
              selectedId={selectedId}
            />
          )}
        </div>
      )}
    </div>
  )
}
