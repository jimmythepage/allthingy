import { useState, useEffect, useCallback, useMemo, type RefObject } from 'react'
import { Editor } from 'tldraw'
import { COMMENT_SHAPE_TYPE, type CommentShape } from '../canvas/CommentShape'
import { renderMarkdown } from '../../lib/markdown'
import { updateLinkedIssues } from '../../lib/mentions'
import { useRepoFullName } from '../../lib/collaborators-context'

type FilterMode = 'open' | 'closed' | 'all'

interface CommentsPanelProps {
  editorRef: RefObject<Editor | null>
}

interface CommentData {
  shapeId: string
  text: string
  author: string
  linkedIssueNumbers: string
  resolved: boolean
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%'
  },
  filterBar: {
    display: 'flex',
    gap: 4,
    padding: '8px 12px',
    borderBottom: '1px solid #2a2a2a'
  },
  filterBtn: {
    flex: 1,
    padding: '4px 0',
    fontSize: 11,
    fontWeight: 600,
    textAlign: 'center' as const,
    cursor: 'pointer',
    borderRadius: 4,
    border: 'none',
    transition: 'all 150ms ease'
  },
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0'
  },
  comment: {
    padding: '10px 12px',
    borderBottom: '1px solid #222',
    cursor: 'pointer',
    transition: 'background 150ms ease'
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  author: {
    fontSize: 12,
    fontWeight: 600,
    color: '#ccc'
  },
  statusBadge: {
    fontSize: 9,
    padding: '1px 5px',
    borderRadius: 3,
    fontWeight: 600
  },
  commentBody: {
    fontSize: 12,
    color: '#bbb',
    lineHeight: 1.5,
    overflow: 'hidden',
    maxHeight: 60
  },
  actions: {
    display: 'flex',
    gap: 6,
    marginTop: 6
  },
  actionBtn: {
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid #333',
    background: 'transparent',
    color: '#999',
    cursor: 'pointer'
  },
  empty: {
    padding: '20px 12px',
    fontSize: 13,
    color: '#555',
    textAlign: 'center' as const,
    lineHeight: 1.5
  }
}

export default function CommentsPanel({ editorRef }: CommentsPanelProps): JSX.Element {
  const [comments, setComments] = useState<CommentData[]>([])
  const [filter, setFilter] = useState<FilterMode>('open')
  const repoFullName = useRepoFullName()

  // Poll for comment shapes on the canvas
  useEffect(() => {
    function refresh(): void {
      const editor = editorRef.current
      if (!editor) return

      const shapes = editor
        .getCurrentPageShapes()
        .filter((s): s is CommentShape => s.type === COMMENT_SHAPE_TYPE)

      setComments(
        shapes.map((s) => ({
          shapeId: s.id,
          text: s.props.text,
          author: s.props.author,
          resolved: s.props.resolved,
          linkedIssueNumbers: s.props.linkedIssueNumbers || '[]'
        }))
      )
    }

    refresh()
    const interval = setInterval(refresh, 500)
    return () => clearInterval(interval)
  }, [editorRef])

  const filtered = useMemo(() => {
    if (filter === 'all') return comments
    if (filter === 'open') return comments.filter((c) => !c.resolved)
    return comments.filter((c) => c.resolved)
  }, [comments, filter])

  const counts = useMemo(() => {
    const open = comments.filter((c) => !c.resolved).length
    const closed = comments.filter((c) => c.resolved).length
    return { open, closed, all: comments.length }
  }, [comments])

  const handleClick = useCallback(
    (shapeId: string) => {
      const editor = editorRef.current
      if (!editor) return
      editor.select(shapeId as any)
      const shape = editor.getShape(shapeId as any)
      if (shape) {
        const bounds = editor.getShapePageBounds(shape)
        if (bounds) {
          editor.centerOnPoint(
            { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 },
            { animation: { duration: 300 } }
          )
        }
      }
    },
    [editorRef]
  )

  const toggleResolved = useCallback(
    (shapeId: string, currentResolved: boolean, linkedIssueNumbers: string) => {
      const editor = editorRef.current
      if (!editor) return
      const newResolved = !currentResolved
      editor.updateShape({
        id: shapeId as any,
        type: COMMENT_SHAPE_TYPE,
        props: { resolved: newResolved }
      })

      // Close or reopen linked GitHub issues
      try {
        const issueNums: number[] = JSON.parse(linkedIssueNumbers || '[]')
        if (issueNums.length > 0) {
          updateLinkedIssues(issueNums, newResolved ? 'closed' : 'open', repoFullName)
        }
      } catch {
        // ignore parse errors
      }
    },
    [editorRef, repoFullName]
  )

  const renderBody = (text: string): string => {
    if (!text) return ''
    const { html } = renderMarkdown(text)
    return html
  }

  return (
    <div style={styles.container}>
      {/* Filter bar */}
      <div style={styles.filterBar}>
        {(['open', 'closed', 'all'] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            style={{
              ...styles.filterBtn,
              background: filter === mode ? 'rgba(79, 143, 247, 0.15)' : 'transparent',
              color: filter === mode ? '#4f8ff7' : '#666'
            }}
            onClick={() => setFilter(mode)}
          >
            {mode === 'open' ? `Open (${counts.open})` : mode === 'closed' ? `Closed (${counts.closed})` : `All (${counts.all})`}
          </button>
        ))}
      </div>

      {/* Comment list */}
      <div style={styles.list}>
        {filtered.length === 0 && (
          <div style={styles.empty}>
            {comments.length === 0
              ? 'No comments on this board. Click "+ Comment" to add one.'
              : filter === 'open'
                ? 'No open comments.'
                : 'No closed comments.'}
          </div>
        )}

        {filtered.map((c) => (
          <div
            key={c.shapeId}
            style={styles.comment}
            onClick={() => handleClick(c.shapeId)}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={styles.commentHeader}>
              <span
                style={{
                  ...styles.author,
                  textDecoration: c.resolved ? 'line-through' : 'none',
                  color: c.resolved ? '#777' : '#ccc'
                }}
              >
                {c.author}
              </span>
              <span
                style={{
                  ...styles.statusBadge,
                  background: c.resolved ? 'rgba(74, 170, 74, 0.15)' : 'rgba(201, 168, 76, 0.15)',
                  color: c.resolved ? '#4a4' : '#c9a84c'
                }}
              >
                {c.resolved ? 'Resolved' : 'Open'}
              </span>
            </div>

            <div
              className="markdown-preview"
              style={{
                ...styles.commentBody,
                color: c.resolved ? '#777' : '#bbb'
              }}
              dangerouslySetInnerHTML={{
                __html: renderBody(c.text.slice(0, 200)) || '<em style="color:#555">Empty comment</em>'
              }}
            />

            <div style={styles.actions}>
              <button
                style={styles.actionBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleResolved(c.shapeId, c.resolved, c.linkedIssueNumbers)
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#666')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#333')}
              >
                {c.resolved ? 'Reopen' : 'Resolve'}
              </button>
              <button
                style={styles.actionBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  handleClick(c.shapeId)
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#666')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#333')}
              >
                Go to
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
