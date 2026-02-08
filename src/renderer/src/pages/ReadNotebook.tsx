import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { renderMarkdown, parseFrontmatter } from '../lib/markdown'
import { resolveWikilink, type NotebookInfo } from '../lib/wikilinks'

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
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-primary)',
    flex: 1
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
  const workspacePath = encodedWorkspacePath ? decodeURIComponent(encodedWorkspacePath) : ''

  const [title, setTitle] = useState<string>('')
  const [bodyHtml, setBodyHtml] = useState<string>('')
  const [notebooks, setNotebooks] = useState<NotebookInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadNotebook = useCallback(async () => {
    if (!workspacePath || !boardId || !notebookId) {
      setError('Missing route params')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Load board to get list of notebooks (id + title) for wikilink resolution
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

      // Load current notebook content from disk
      const raw = await window.api.notebook.load(workspacePath, notebookId)
      if (raw == null) {
        setError('Notebook not found')
        setTitle('')
        setBodyHtml('')
        setLoading(false)
        return
      }

      const { frontmatter, body } = parseFrontmatter(raw)
      const docTitle = (frontmatter.title as string) || 'Untitled'
      setTitle(docTitle)

      const { html } = renderMarkdown(body)
      setBodyHtml(html)
    } catch (err) {
      setError(String(err))
      setTitle('')
      setBodyHtml('')
    } finally {
      setLoading(false)
    }
  }, [workspacePath, boardId, notebookId])

  useEffect(() => {
    loadNotebook()
  }, [loadNotebook])

  const handleBack = () => {
    navigate(`/board/${encodeURIComponent(workspacePath)}/${boardId}`)
  }

  const handleWikilinkClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest('.wikilink') as HTMLElement | null
      if (!target) return
      e.preventDefault()
      const targetKey = target.dataset.target
      if (!targetKey) return
      const resolved = resolveWikilink(targetKey, notebooks)
      if (resolved) {
        navigate(
          `/read/${encodeURIComponent(workspacePath)}/${boardId}/${resolved.notebookId}`,
          { replace: false }
        )
      }
    },
    [notebooks, workspacePath, boardId, navigate]
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
        >
          ← Back to board
        </button>
        <h1 style={styles.title}>{title}</h1>
      </div>
      <div style={styles.content}>
        <div
          style={styles.prose}
          className="markdown-preview read-mode-prose"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
          onClick={handleWikilinkClick}
        />
      </div>
    </div>
  )
}
