import { useState, useEffect, useCallback } from 'react'
import { useGitHubStore } from '../../stores/github'

interface CollaboratorPanelProps {
  repoFullName: string | null
}

interface Collaborator {
  login: string
  avatar_url: string
  html_url: string
  permissions: Record<string, boolean>
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%'
  },
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0'
  },
  item: {
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderBottom: '1px solid #222'
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    flexShrink: 0
  },
  login: {
    fontSize: 13,
    fontWeight: 500,
    color: '#ccc',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  ownerBadge: {
    fontSize: 10,
    color: '#a78bfa',
    background: 'rgba(167, 139, 250, 0.15)',
    padding: '1px 6px',
    borderRadius: 8
  },
  removeBtn: {
    fontSize: 11,
    color: '#e55050',
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid rgba(229, 80, 80, 0.3)',
    background: 'transparent',
    transition: 'background 150ms ease'
  },
  inputArea: {
    padding: 12,
    borderTop: '1px solid #2a2a2a',
    display: 'flex',
    gap: 8
  },
  input: {
    flex: 1,
    padding: '6px 10px',
    fontSize: 12,
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#e0e0e0',
    outline: 'none'
  },
  addBtn: {
    padding: '6px 12px',
    fontSize: 12,
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const
  },
  empty: {
    padding: '20px 12px',
    fontSize: 13,
    color: '#555',
    textAlign: 'center' as const,
    lineHeight: 1.5
  },
  error: {
    padding: '6px 12px',
    fontSize: 12,
    color: '#e55050',
    textAlign: 'center' as const
  }
}

export default function CollaboratorPanel({
  repoFullName
}: CollaboratorPanelProps): JSX.Element {
  const { token, user } = useGitHubStore()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchCollaborators = useCallback(async () => {
    if (!token || !repoFullName) return
    try {
      const result = await window.api.sharing.listCollaborators(token, repoFullName)
      setCollaborators(result)
    } catch (err) {
      console.error('Failed to fetch collaborators:', err)
    }
  }, [token, repoFullName])

  useEffect(() => {
    fetchCollaborators()
  }, [fetchCollaborators])

  const handleAdd = useCallback(async () => {
    if (!token || !repoFullName || !username.trim()) return
    setLoading(true)
    setError('')

    try {
      await window.api.sharing.addCollaborator(token, repoFullName, username.trim())
      setUsername('')
      await fetchCollaborators()
    } catch (err) {
      setError(String(err).replace('Error: ', ''))
    } finally {
      setLoading(false)
    }
  }, [token, repoFullName, username, fetchCollaborators])

  const handleRemove = useCallback(
    async (login: string) => {
      if (!token || !repoFullName) return
      try {
        await window.api.sharing.removeCollaborator(token, repoFullName, login)
        await fetchCollaborators()
      } catch (err) {
        console.error('Failed to remove collaborator:', err)
      }
    },
    [token, repoFullName, fetchCollaborators]
  )

  if (!token || !user) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>Connect GitHub in Settings to manage collaborators.</div>
      </div>
    )
  }

  if (!repoFullName) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>Set up GitHub Sync to invite collaborators.</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.list}>
        {collaborators.length === 0 && (
          <div style={styles.empty}>No collaborators yet. Add someone below.</div>
        )}
        {collaborators.map((c) => (
          <div key={c.login} style={styles.item}>
            <img src={c.avatar_url} style={styles.avatar} alt={c.login} />
            <span style={styles.login}>{c.login}</span>
            {c.permissions?.admin && <span style={styles.ownerBadge}>owner</span>}
            {c.login !== user.login && !c.permissions?.admin && (
              <button
                style={styles.removeBtn}
                onClick={() => handleRemove(c.login)}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(229, 80, 80, 0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.inputArea}>
        <input
          style={styles.input}
          placeholder="GitHub username..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
        />
        <button
          style={{ ...styles.addBtn, opacity: username.trim() && !loading ? 1 : 0.5 }}
          onClick={handleAdd}
          disabled={!username.trim() || loading}
        >
          {loading ? '...' : 'Invite'}
        </button>
      </div>
    </div>
  )
}
