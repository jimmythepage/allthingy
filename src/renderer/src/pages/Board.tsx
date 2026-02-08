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
import { CommentShapeUtil, COMMENT_SHAPE_TYPE } from '../components/canvas/CommentShape'
import { CommentTool } from '../components/canvas/CommentTool'
import { ConnectionLines } from '../components/canvas/ConnectionLines'
import NotebookSidebar from '../components/sidebar/NotebookSidebar'
import SyncStatus from '../components/github/SyncStatus'
import SearchPalette from '../components/sidebar/SearchPalette'
import { CollaboratorsProvider } from '../lib/collaborators-context'

const AUTOSAVE_DELAY = 2000

const customShapeUtils = [MarkdownNotebookUtil, CommentShapeUtil]
const customTools = [MarkdownNotebookTool, CommentTool]

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

function CanvasOverlay() {
  return <ConnectionLines />
}

const customComponents: TLComponents = {
  Toolbar: CustomToolbar,
  OnTheCanvas: CanvasOverlay
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

  // Use a ref that is always current — never stale in closures
  const editorRef = useRef<Editor | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoadingSnapshot = useRef(false)
  const workspacePathRef = useRef(workspacePath)
  workspacePathRef.current = workspacePath
  const boardIdRef = useRef(boardId)
  boardIdRef.current = boardId

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [initialSnapshot, setInitialSnapshot] = useState<unknown>(undefined)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  // This state is only used to force re-render when editor becomes available
  const [, setEditorReady] = useState(0)

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

  // Save function — uses refs to always have current values
  const saveBoard = useCallback(async () => {
    const editor = editorRef.current
    const wsPath = workspacePathRef.current
    const bId = boardIdRef.current
    if (!editor || !wsPath || !bId) return
    if (isLoadingSnapshot.current) return

    setSaveStatus('saving')
    try {
      const { document, session } = getSnapshot(editor.store)
      const boardData = {
        id: bId,
        name: bId,
        tldrawDocument: { document, session },
        notebookPlacements: {},
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      }
      await window.api.board.save(wsPath, bId, boardData)

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
            await window.api.notebook.save(wsPath, props.notebookId, content)
          }
        }
      }

      setSaveStatus('saved')
    } catch (err) {
      console.error('Failed to save board:', err)
      setSaveStatus('unsaved')
    }
  }, [])

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
    (mountedEditor: Editor) => {
      editorRef.current = mountedEditor
      setEditorReady((n) => n + 1)
      mountedEditor.user.updateUserPreferences({ colorScheme: 'dark' })

      // Load existing snapshot if available
      if (initialSnapshot) {
        isLoadingSnapshot.current = true
        try {
          loadSnapshot(mountedEditor.store, initialSnapshot as Parameters<typeof loadSnapshot>[1])
        } catch (err) {
          console.error('Failed to load snapshot into editor:', err)
        }
        isLoadingSnapshot.current = false
      }

      // Listen for changes to auto-save
      const unsubscribe = mountedEditor.store.listen(
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

  // Add notebook — reads from ref directly, no stale closure issues
  function addNotebook(): void {
    const ed = editorRef.current
    if (!ed) return

    const notebookId = `note-${Date.now()}`
    const viewportBounds = ed.getViewportPageBounds()
    const cx = viewportBounds.x + viewportBounds.w / 2
    const cy = viewportBounds.y + viewportBounds.h / 2

    ed.createShape({
      type: MARKDOWN_NOTEBOOK_TYPE,
      x: cx - 160,
      y: cy - 200,
      props: {
        w: 320,
        h: 400,
        notebookId,
        title: 'Untitled',
        markdown: '# Untitled\n\nStart writing...'
      }
    })
  }

  // Add comment shape (Miro-style sticky comment)
  function addComment(): void {
    const ed = editorRef.current
    if (!ed) return

    const viewportBounds = ed.getViewportPageBounds()
    const cx = viewportBounds.x + viewportBounds.w / 2
    const cy = viewportBounds.y + viewportBounds.h / 2

    ed.createShape({
      type: COMMENT_SHAPE_TYPE,
      x: cx - 110,
      y: cy - 60,
      props: {
        w: 220,
        h: 120,
        text: '',
        author: 'You'
      }
    })
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('.cm-editor')
      ) {
        return
      }

      const isMeta = e.metaKey || e.ctrlKey

      if (isMeta && e.key === 'p') {
        e.preventDefault()
        setShowSearch(true)
      } else if (isMeta && e.key === 'n') {
        e.preventDefault()
        addNotebook()
      } else if (isMeta && (e.key === 'b' || e.key === '\\')) {
        e.preventDefault()
        setSidebarOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
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
    <CollaboratorsProvider workspacePath={workspacePath}>
    <div style={styles.container}>
      <div style={styles.titlebar} className="titlebar-drag">
        <button
          style={styles.backBtn}
          className="titlebar-no-drag"
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            navigate('/')
          }}
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
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            addNotebook()
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
        >
          + Notebook
        </button>
        <button
          style={styles.toolBtn}
          className="titlebar-no-drag"
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            addComment()
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
        >
          + Comment
        </button>
        <button
          style={{
            ...styles.toolBtn,
            background: sidebarOpen ? 'var(--bg-hover)' : 'var(--bg-tertiary)'
          }}
          className="titlebar-no-drag"
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setSidebarOpen(!sidebarOpen)
          }}
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
        {sidebarOpen && (
          <NotebookSidebar
            editorRef={editorRef}
            workspacePath={workspacePath}
            boardId={boardId || ''}
          />
        )}
      </div>

      {/* Search Palette */}
      {showSearch && (
        <SearchPalette editor={editorRef.current} onClose={() => setShowSearch(false)} />
      )}
    </div>
    </CollaboratorsProvider>
  )
}
