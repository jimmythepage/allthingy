import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { renderMarkdown, parseFrontmatter, buildNotebookContent } from '../lib/markdown'
import { resolveWikilink, type NotebookInfo } from '../lib/wikilinks'
import MarkdownEditor from '../components/editor/MarkdownEditor'

interface BreadcrumbItem {
  notebookId: string
  title: string
}

const styles = {
  container: {
    position: 'fixed' as const,
    inset: 0,
    background: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    zIndex: 100
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)'
  },
  backBtn: {
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'background var(--transition), color var(--transition)'
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: 'var(--text-secondary)'
  },
  breadcrumbLink: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis' as const,
    maxWidth: 160
  },
  breadcrumbSep: {
    opacity: 0.5,
    userSelect: 'none' as const
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-primary)',
    flex: 1,
    minWidth: 0
  },
  editBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'transparent',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'background var(--transition), color var(--transition)'
  },
  saveBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: '#fff',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer'
  },
  cancelBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer'
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '32px 24px 48px'
  },
  prose: {
    maxWidth: 720,
    margin: '0 auto',
    fontSize: 16,
    lineHeight: 1.7,
    color: 'var(--text-primary)'
  },
  editorWrap: {
    maxWidth: 720,
    margin: '0 auto',
    minHeight: 400
  },
  loading: {
    padding: 48,
    textAlign: 'center' as const,
    color: 'var(--text-muted)'
  },
  error: {
    padding: 48,
    color: 'var(--danger)'
  }
}

export default function ReadNotebook(): JSX.Element {
  const { encodedWorkspacePath, boardId, notebookId } = useParams<{
    encodedWorkspacePath: string
    boardId: string
    notebookId: string
  }>()
  const navigate = useNavigate()
  const location = useLocation()
  const workspacePath = encodedWorkspacePath ? decodeURIComponent(encodedWorkspacePath) : ''

  const [title, setTitle] = useState<string>('')
  const [rawContent, setRawContent] = useState<string>('')
  const [bodyHtml, setBodyHtml] = useState<string>('')
  const [notebooks, setNotebooks] = useState<NotebookInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editBody, setEditBody] = useState('')
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>(() =>
    (location.state as { breadcrumb?: BreadcrumbItem[] })?.breadcrumb ?? []
  )

  const loadNotebook = useCallback(async () => {
    if (!workspacePath || !boardId || !notebookId) {
      setError('Missing route params')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const boardData = await window.api.board.load(workspacePath, boardId)
      const notebookList: NotebookInfo[] = []
      if (boardData?.tldrawDocument?.document?.store) {
        const store = boardData.tldrawDocument.document.store as Record<string, Record<string, unknown>>
        for (const record of Object.values(store)) {
          if (record?.typeName === 'shape' && record?.type === 'markdown-notebook') {
            const props = record.props as { notebookId?: string; title?: string }
            if (props?.notebookId) {
              notebookList.push({
                shapeId: String(record.id),
                notebookId: props.notebookId,
                title: props.title ? String(props.title) : 'Untitled'
              })
            }
          }
        }
      }
      setNotebooks(notebookList)

      const raw = await window.api.notebook.load(workspacePath, notebookId)
      if (raw == null) {
        setError('Notebook not found')
        setTitle('')
        setRawContent('')
        setBodyHtml('')
        setLoading(false)
        return
      }

      setRawContent(raw)
      const { frontmatter, body } = parseFrontmatter(raw)
      const docTitle = (frontmatter.title as string) || 'Untitled'
      setTitle(docTitle)

      const { html } = renderMarkdown(body)
      setBodyHtml(html)

      // Update breadcrumb: if we came with state, use it; else set initial
      const stateBreadcrumb = (location.state as { breadcrumb?: BreadcrumbItem[] })?.breadcrumb
      if (stateBreadcrumb && stateBreadcrumb.length > 0) {
        setBreadcrumb(stateBreadcrumb)
      } else {
        const initial: BreadcrumbItem[] = [{ notebookId, title: docTitle }]
        setBreadcrumb(initial)
        navigate(
          `/read/${encodeURIComponent(workspacePath)}/${boardId}/${notebookId}`,
          { replace: true, state: { breadcrumb: initial } }
        )
      }
    } catch (err) {
      setError(String(err))
      setTitle('')
      setRawContent('')
      setBodyHtml('')
    } finally {
      setLoading(false)
    }
  }, [workspacePath, boardId, notebookId])

  useEffect(() => {
    loadNotebook()
  }, [loadNotebook])

  // Sync breadcrumb from location.state when navigating (e.g. back via breadcrumb)
  useEffect(() => {
    const stateBreadcrumb = (location.state as { breadcrumb?: BreadcrumbItem[] })?.breadcrumb
    if (stateBreadcrumb && stateBreadcrumb.length > 0) {
      setBreadcrumb(stateBreadcrumb)
    }
  }, [location.state, notebookId])

  const handleBack = useCallback(() => {
    navigate(`/board/${encodeURIComponent(workspacePath)}/${boardId}`)
  }, [navigate, workspacePath, boardId])

  // Esc: back to board or cancel edit
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (isEditing) {
        setIsEditing(false)
        setEditBody('')
      } else {
        handleBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEditing, handleBack])

  const handleStartEdit = useCallback(() => {
    const { body } = parseFrontmatter(rawContent)
    setEditBody(body)
    setIsEditing(true)
  }, [rawContent])

  const handleSaveEdit = useCallback(async () => {
    if (!workspacePath || !notebookId || !boardId) return
    const { frontmatter } = parseFrontmatter(rawContent)
    const meta = {
      ...frontmatter,
      id: notebookId,
      title: (frontmatter.title as string) || title,
      modified: new Date().toISOString()
    }
    const newTitle = (meta.title as string) || 'Untitled'
    const content = buildNotebookContent(meta, editBody)

    // 1. Save .md file
    await window.api.notebook.save(workspacePath, notebookId, content)

    // 2. Also update the board JSON so the shape has the new content
    //    This prevents the board auto-save from overwriting with stale data
    try {
      const boardData = await window.api.board.load(workspacePath, boardId)
      if (boardData?.tldrawDocument?.document?.store) {
        const store = boardData.tldrawDocument.document.store as Record<string, Record<string, unknown>>
        for (const record of Object.values(store)) {
          if (
            record?.typeName === 'shape' &&
            record?.type === 'markdown-notebook'
          ) {
            const props = record.props as { notebookId?: string }
            if (props?.notebookId === notebookId) {
              ;(record.props as Record<string, unknown>).markdown = editBody
              ;(record.props as Record<string, unknown>).title = newTitle
              break
            }
          }
        }
        await window.api.board.save(workspacePath, boardId, boardData)
      }
    } catch (err) {
      console.error('Failed to update board JSON:', err)
    }

    setRawContent(content)
    setTitle(newTitle)
    const { html } = renderMarkdown(editBody)
    setBodyHtml(html)
    setIsEditing(false)
    setEditBody('')
    // Update current breadcrumb title
    setBreadcrumb((prev) =>
      prev.map((p) =>
        p.notebookId === notebookId ? { ...p, title: newTitle } : p
      )
    )
  }, [workspacePath, boardId, notebookId, rawContent, editBody, title])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditBody('')
  }, [])

  const handleWikilinkClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest('.wikilink') as HTMLElement | null
      if (!target) return
      e.preventDefault()
      const targetKey = target.dataset.target
      if (!targetKey) return
      const resolved = resolveWikilink(targetKey, notebooks)
      if (resolved) {
        const nextBreadcrumb: BreadcrumbItem[] = [
          ...breadcrumb,
          { notebookId: resolved.notebookId, title: resolved.title }
        ]
        navigate(
          `/read/${encodeURIComponent(workspacePath)}/${boardId}/${resolved.notebookId}`,
          { state: { breadcrumb: nextBreadcrumb } }
        )
      }
    },
    [notebooks, workspacePath, boardId, navigate, breadcrumb]
  )

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      const item = breadcrumb[index]
      if (!item || item.notebookId === notebookId) return
      const nextBreadcrumb = breadcrumb.slice(0, index + 1)
      navigate(
        `/read/${encodeURIComponent(workspacePath)}/${boardId}/${item.notebookId}`,
        { state: { breadcrumb: nextBreadcrumb } }
      )
    },
    [breadcrumb, notebookId, workspacePath, boardId, navigate]
  )

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={handleBack} type="button">
            ← Back to board
          </button>
        </div>
        <div style={{ ...styles.loading, padding: 48 }}>Loading…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={handleBack} type="button">
            ← Back to board
          </button>
        </div>
        <div style={styles.error}>{error}</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          style={styles.backBtn}
          onClick={handleBack}
          type="button"
          className="titlebar-no-drag"
          title="Back to board (Esc)"
        >
          ← Back to board
        </button>
        <div style={styles.breadcrumb}>
          {breadcrumb.map((item, i) => (
            <span key={item.notebookId}>
              {i > 0 && <span style={styles.breadcrumbSep}> › </span>}
              {i === breadcrumb.length - 1 ? (
                <span style={{ ...styles.title, fontSize: 13 }}>{item.title}</span>
              ) : (
                <button
                  type="button"
                  style={styles.breadcrumbLink}
                  onClick={() => handleBreadcrumbClick(i)}
                >
                  {item.title}
                </button>
              )}
            </span>
          ))}
        </div>
        {!isEditing ? (
          <button
            style={styles.editBtn}
            type="button"
            onClick={handleStartEdit}
            className="titlebar-no-drag"
          >
            Edit
          </button>
        ) : (
          <>
            <button
              style={styles.cancelBtn}
              type="button"
              onClick={handleCancelEdit}
              className="titlebar-no-drag"
            >
              Cancel
            </button>
            <button
              style={styles.saveBtn}
              type="button"
              onClick={handleSaveEdit}
              className="titlebar-no-drag"
            >
              Save
            </button>
          </>
        )}
      </div>
      <div style={styles.content}>
        {isEditing ? (
          <div style={styles.editorWrap}>
            <MarkdownEditor
              initialValue={editBody}
              onChange={setEditBody}
              autoFocus
              extensions={[]}
            />
          </div>
        ) : (
          <div
            style={styles.prose}
            className="markdown-preview read-mode-prose"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            onClick={handleWikilinkClick}
          />
        )}
      </div>
    </div>
  )
}
