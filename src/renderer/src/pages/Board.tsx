import { useParams, useNavigate } from 'react-router-dom'
import {
  Tldraw,
  Editor,
  getSnapshot,
  loadSnapshot,
  TLStoreEventInfo,
  TLComponents,
  DefaultToolbar,
  DefaultToolbarContent,
  useTools
} from 'tldraw'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'tldraw/tldraw.css'
import {
  MarkdownNotebookUtil,
  MARKDOWN_NOTEBOOK_TYPE
} from '../components/canvas/MarkdownShape'
import { MarkdownNotebookTool } from '../components/canvas/MarkdownNotebookTool'
import NotebookSidebar from '../components/sidebar/NotebookSidebar'
import SyncStatus from '../components/github/SyncStatus'
import SearchPalette from '../components/sidebar/SearchPalette'
import { useKeyboardShortcuts } from '../lib/keyboard-shortcuts'

const AUTOSAVE_DELAY = 2000

const customShapeUtils = [MarkdownNotebookUtil]
const customTools = [MarkdownNotebookTool]

function CustomToolbar() {
  const tools = useTools()
  return (
    <DefaultToolbar>
      <DefaultToolbarContent />
      <button
        data-testid="markdown-notebook-tool"
        data-isactive={tools['markdown-notebook']?.isSelected}
        onClick={() => tools['markdown-notebook']?.onSelect('toolbar')}
        title="Markdown Notebook (drag to create)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          borderRadius: 4,
          background: tools['markdown-notebook']?.isSelected
            ? 'var(--color-primary)'
            : 'transparent',
          color: 'inherit',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13
        }}
      >
        <span style={{ fontSize: 16 }}>&#9783;</span>
        <span>Note</span>
      </button>
    </DefaultToolbar>
  )
}

const customComponents: TLComponents = {
  Toolbar: CustomToolbar
}

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const
  },
  titlebar: {
    height: 'var(--titlebar-height)',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 80,
    paddingRight: 20,
    borderBottom: '1px solid var(--border)',
    gap: 12,
    flexShrink: 0,
    zIndex: 100,
    background: 'var(--bg-primary)',
    position: 'relative' as const
  },
  backBtn: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    transition: 'background var(--transition)'
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '-0.3px'
  },
  toolBtn: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 12px',
    borderRadius: 'var(--radius-sm)',
    transition: 'background var(--transition)',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-tertiary)'
  },
  saveIndicator: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginLeft: 'auto'
  },
  bodyRow: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    position: 'relative' as const
  },
  canvasWrapper: {
    flex: 1,
    position: 'relative' as const
  }
}

export default function Board(): JSX.Element {
  const { boardId, workspacePath: encodedWorkspacePath } = useParams()
  const navigate = useNavigate()
  const workspacePath = encodedWorkspacePath ? decodeURIComponent(encodedWorkspacePath) : ''
  const editorRef = useRef<Editor | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [initialSnapshot, setInitialSnapshot] = useState<unknown>(undefined)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const isLoadingSnapshot = useRef(false)

  // Keyboard shortcuts
  useKeyboardShortcuts(
    useMemo(
      () => ({
        'meta+p': () => setShowSearch(true),
        'meta+n': () => {
          const editor = editorRef.current
          if (!editor) return
          const notebookId = `note-${Date.now()}`
          const { x, y } = editor.getViewportPageCenter()
          editor.createShape({
            type: MARKDOWN_NOTEBOOK_TYPE,
            x: x - 160,
            y: y - 200,
            props: {
              w: 320,
              h: 400,
              notebookId,
              title: 'Untitled',
              markdown: '# Untitled\n\nStart writing...'
            }
          })
        },
        'meta+b': () => setSidebarOpen((prev) => !prev),
        'meta+\\': () => setSidebarOpen((prev) => !prev)
      }),
      []
    )
  )

  // Load existing board data on mount
  useEffect(() => {
    if (!workspacePath || !boardId) return
    let cancelled = false

    async function loadBoard(): Promise<void> {
      try {
        const data = await window.api.board.load(workspacePath, boardId!)
        if (cancelled) return
        if (data?.tldrawDocument) {
          setInitialSnapshot(data.tldrawDocument)
        }
      } catch (err) {
        console.error('Failed to load board:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBoard()
    return () => {
      cancelled = true
    }
  }, [workspacePath, boardId])

  // Save function
  const saveBoard = useCallback(async () => {
    const editor = editorRef.current
    if (!editor || !workspacePath || !boardId) return
    if (isLoadingSnapshot.current) return

    setSaveStatus('saving')
    try {
      const { document, session } = getSnapshot(editor.store)
      const boardData = {
        id: boardId,
        name: boardId,
        tldrawDocument: { document, session },
        notebookPlacements: {},
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      }
      await window.api.board.save(workspacePath, boardId, boardData)

      // Also save each markdown notebook shape as a .md file
      const allShapes = editor.getCurrentPageShapes()
      for (const shape of allShapes) {
        if (shape.type === MARKDOWN_NOTEBOOK_TYPE) {
          const props = shape.props as {
            notebookId: string
            title: string
            markdown: string
          }
          if (props.notebookId) {
            const frontmatter = [
              '---',
              `id: ${props.notebookId}`,
              `title: "${props.title}"`,
              `modified: ${new Date().toISOString()}`,
              '---'
            ].join('\n')
            const content = `${frontmatter}\n${props.markdown}`
            await window.api.notebook.save(workspacePath, props.notebookId, content)
          }
        }
      }

      setSaveStatus('saved')
    } catch (err) {
      console.error('Failed to save board:', err)
      setSaveStatus('unsaved')
    }
  }, [workspacePath, boardId])

  // Debounced auto-save
  const scheduleSave = useCallback(() => {
    if (isLoadingSnapshot.current) return
    setSaveStatus('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveBoard, AUTOSAVE_DELAY)
  }, [saveBoard])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor
      editor.user.updateUserPreferences({ colorScheme: 'dark' })

      // Load existing snapshot if available
      if (initialSnapshot) {
        isLoadingSnapshot.current = true
        try {
          loadSnapshot(editor.store, initialSnapshot as Parameters<typeof loadSnapshot>[1])
        } catch (err) {
          console.error('Failed to load snapshot into editor:', err)
        }
        isLoadingSnapshot.current = false
      }

      // Listen for changes to auto-save
      const unsubscribe = editor.store.listen(
        (_info: TLStoreEventInfo) => {
          scheduleSave()
        },
        { scope: 'document', source: 'user' }
      )

      return () => {
        unsubscribe()
        saveBoard()
      }
    },
    [initialSnapshot, scheduleSave, saveBoard]
  )

  const handleAddNotebook = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const notebookId = `note-${Date.now()}`
    const { x, y } = editor.getViewportPageCenter()

    editor.createShape({
      type: MARKDOWN_NOTEBOOK_TYPE,
      x: x - 160,
      y: y - 200,
      props: {
        w: 320,
        h: 400,
        notebookId,
        title: 'Untitled',
        markdown: '# Untitled\n\nStart writing...'
      }
    })
  }, [])

  const tldrawKey = useMemo(() => {
    return `board-${boardId}-${initialSnapshot ? 'loaded' : 'new'}`
  }, [boardId, initialSnapshot])

  if (loading) {
    return (
      <div style={styles.container}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)'
          }}
        >
          Loading board...
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.titlebar} className="titlebar-drag">
        <button
          style={styles.backBtn}
          className="titlebar-no-drag"
          onClick={() => navigate('/')}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          &#8592; Home
        </button>
        <span style={styles.title} className="titlebar-no-drag">
          {boardId}
        </span>
        <button
          style={styles.toolBtn}
          className="titlebar-no-drag"
          onClick={handleAddNotebook}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
        >
          + Notebook
        </button>
        <button
          style={{
            ...styles.toolBtn,
            background: sidebarOpen ? 'var(--bg-hover)' : 'var(--bg-tertiary)'
          }}
          className="titlebar-no-drag"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = sidebarOpen
              ? 'var(--bg-hover)'
              : 'var(--bg-tertiary)')
          }
        >
          {sidebarOpen ? 'Hide' : 'Show'} Panel
        </button>
        <span style={styles.saveIndicator} className="titlebar-no-drag">
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'unsaved' && 'Unsaved changes'}
        </span>
        <div className="titlebar-no-drag">
          <SyncStatus workspacePath={workspacePath} />
        </div>
      </div>

      <div style={styles.bodyRow}>
        <div style={styles.canvasWrapper}>
          <Tldraw
            key={tldrawKey}
            shapeUtils={customShapeUtils}
            tools={customTools}
            components={customComponents}
            onMount={handleMount}
          />
        </div>
        {sidebarOpen && <NotebookSidebar editorRef={editorRef} />}
      </div>

      {/* Search Palette */}
      {showSearch && (
        <SearchPalette editor={editorRef.current} onClose={() => setShowSearch(false)} />
      )}
    </div>
  )
}
