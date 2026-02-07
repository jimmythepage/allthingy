import { useState, useEffect, useCallback } from 'react'
import { useGitHubStore } from '../../stores/github'
import { renderMarkdown } from '../../lib/markdown'

interface CommentsPanelProps {
  workspacePath: string
  boardId: string
  repoFullName: string | null
}

interface IssueComment {
  id: number
  body: string
  user: { login: string; avatar_url: string }
  created_at: string
}

interface Issue {
  number: number
  title: string
  body: string
  user: { login: string; avatar_url: string }
  created_at: string
  updated_at: string
  comments: number
}

const styles = {
  container: {
    width: 300,
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
    borderBottom: '1px solid #2a2a2a',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 0'
  },
  comment: {
    padding: '10px 16px',
    borderBottom: '1px solid #222'
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: '50%'
  },
  author: {
    fontSize: 12,
    fontWeight: 600,
    color: '#ccc'
  },
  date: {
    fontSize: 11,
    color: '#666',
    marginLeft: 'auto'
  },
  commentBody: {
    fontSize: 13,
    color: '#bbb',
    lineHeight: 1.5
  },
  inputArea: {
    padding: 12,
    borderTop: '1px solid #2a2a2a',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8
  },
  textarea: {
    width: '100%',
    minHeight: 60,
    padding: 8,
    fontSize: 13,
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#e0e0e0',
    outline: 'none',
    resize: 'vertical' as const,
    fontFamily: 'inherit'
  },
  sendBtn: {
    alignSelf: 'flex-end' as const,
    padding: '6px 14px',
    fontSize: 12,
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer'
  },
  empty: {
    padding: '24px 16px',
    fontSize: 13,
    color: '#555',
    textAlign: 'center' as const,
    lineHeight: 1.5
  },
  noAuth: {
    padding: '24px 16px',
    fontSize: 13,
    color: '#666',
    textAlign: 'center' as const
  }
}

export default function CommentsPanel({
  workspacePath,
  boardId,
  repoFullName
}: CommentsPanelProps): JSX.Element {
  const { token, user } = useGitHubStore()
  const [issues, setIssues] = useState<Issue[]>([])
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [comments, setComments] = useState<IssueComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch issues
  useEffect(() => {
    if (!token || !repoFullName) return

    async function fetchIssues(): Promise<void> {
      try {
        const result = await window.api.comments.listIssues(token!, repoFullName!)
        setIssues(result)
      } catch (err) {
        console.error('Failed to fetch issues:', err)
      }
    }

    fetchIssues()
    const interval = setInterval(fetchIssues, 30000)
    return () => clearInterval(interval)
  }, [token, repoFullName])

  // Fetch comments when issue is selected
  useEffect(() => {
    if (!token || !repoFullName || !selectedIssue) return

    async function fetchComments(): Promise<void> {
      try {
        const result = await window.api.comments.getIssueComments(
          token!,
          repoFullName!,
          selectedIssue!.number
        )
        setComments(result)
      } catch (err) {
        console.error('Failed to fetch comments:', err)
      }
    }

    fetchComments()
  }, [token, repoFullName, selectedIssue])

  const handleCreateComment = useCallback(async () => {
    if (!token || !repoFullName || !newComment.trim()) return

    setLoading(true)
    try {
      if (selectedIssue) {
        // Add comment to existing issue
        await window.api.comments.addComment(
          token,
          repoFullName,
          selectedIssue.number,
          newComment.trim()
        )
        // Refresh comments
        const result = await window.api.comments.getIssueComments(
          token,
          repoFullName,
          selectedIssue.number
        )
        setComments(result)
      } else {
        // Create new issue
        const title = `Comment on ${boardId}`
        await window.api.comments.createIssue(token, repoFullName, title, newComment.trim())
        // Refresh issues
        const result = await window.api.comments.listIssues(token, repoFullName)
        setIssues(result)
      }
      setNewComment('')
    } catch (err) {
      console.error('Failed to create comment:', err)
    } finally {
      setLoading(false)
    }
  }, [token, repoFullName, newComment, selectedIssue, boardId])

  if (!token || !user) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Comments</div>
        <div style={styles.noAuth}>Connect GitHub in Settings to use comments.</div>
      </div>
    )
  }

  if (!repoFullName) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Comments</div>
        <div style={styles.noAuth}>Set up GitHub Sync to enable comments.</div>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>
          {selectedIssue ? (
            <button
              style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13 }}
              onClick={() => {
                setSelectedIssue(null)
                setComments([])
              }}
            >
              &#8592; Comments
            </button>
          ) : (
            'Comments'
          )}
        </span>
        <span style={{ fontSize: 11, color: '#666' }}>{issues.length} threads</span>
      </div>

      <div style={styles.list}>
        {!selectedIssue && issues.length === 0 && (
          <div style={styles.empty}>
            No comments yet. Start a discussion about this board.
          </div>
        )}

        {/* Issue list view */}
        {!selectedIssue &&
          issues.map((issue) => (
            <div
              key={issue.number}
              style={{
                ...styles.comment,
                cursor: 'pointer'
              }}
              onClick={() => setSelectedIssue(issue)}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={styles.commentHeader}>
                <img src={issue.user.avatar_url} style={styles.avatar} />
                <span style={styles.author}>{issue.user.login}</span>
                <span style={styles.date}>{formatDate(issue.created_at)}</span>
              </div>
              <div style={styles.commentBody}>
                {issue.body?.slice(0, 120)}
                {(issue.body?.length || 0) > 120 ? '...' : ''}
              </div>
              {issue.comments > 0 && (
                <span style={{ fontSize: 11, color: '#666', marginTop: 4, display: 'block' }}>
                  {issue.comments} replies
                </span>
              )}
            </div>
          ))}

        {/* Issue detail view */}
        {selectedIssue && (
          <>
            <div style={styles.comment}>
              <div style={styles.commentHeader}>
                <img src={selectedIssue.user.avatar_url} style={styles.avatar} />
                <span style={styles.author}>{selectedIssue.user.login}</span>
                <span style={styles.date}>{formatDate(selectedIssue.created_at)}</span>
              </div>
              <div style={styles.commentBody}>{selectedIssue.body}</div>
            </div>

            {comments.map((c) => (
              <div key={c.id} style={styles.comment}>
                <div style={styles.commentHeader}>
                  <img src={c.user.avatar_url} style={styles.avatar} />
                  <span style={styles.author}>{c.user.login}</span>
                  <span style={styles.date}>{formatDate(c.created_at)}</span>
                </div>
                <div style={styles.commentBody}>{c.body}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Input area */}
      <div style={styles.inputArea}>
        <textarea
          style={styles.textarea}
          placeholder={selectedIssue ? 'Reply...' : 'Start a new discussion...'}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) handleCreateComment()
          }}
        />
        <button
          style={{ ...styles.sendBtn, opacity: newComment.trim() && !loading ? 1 : 0.5 }}
          onClick={handleCreateComment}
          disabled={!newComment.trim() || loading}
        >
          {loading ? 'Sending...' : selectedIssue ? 'Reply' : 'Post'}
        </button>
      </div>
    </div>
  )
}
