import { useState, useEffect, useCallback } from 'react'
import { useGitHubStore } from '../../stores/github'

interface SyncStatusProps {
  workspacePath: string
}

type SyncState = 'idle' | 'syncing' | 'error' | 'no-remote' | 'no-auth' | 'ahead' | 'behind'

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  syncBtn: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '3px 10px',
    borderRadius: 'var(--radius-sm)',
    transition: 'all var(--transition)',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    gap: 4
  },
  setupBtn: {
    fontSize: 12,
    color: 'var(--accent)',
    cursor: 'pointer',
    padding: '3px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--accent)',
    background: 'transparent'
  },
  status: {
    fontSize: 11,
    color: 'var(--text-muted)'
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    display: 'inline-block'
  },
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    padding: 28,
    width: 420,
    border: '1px solid var(--border-light)',
    boxShadow: 'var(--shadow-md)'
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 600,
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    display: 'block',
    marginBottom: 6
  },
  input: {
    width: '100%',
    marginBottom: 16,
    padding: '8px 12px',
    fontSize: 14,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    outline: 'none'
  },
  modalActions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 12
  },
  btnPrimary: {
    padding: '8px 16px',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none'
  },
  btnSecondary: {
    padding: '8px 16px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--border-light)'
  },
  error: {
    fontSize: 12,
    color: 'var(--danger)',
    marginBottom: 8
  },
  description: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 16,
    lineHeight: 1.5
  }
}

export default function SyncStatus({ workspacePath }: SyncStatusProps): JSX.Element {
  const { token, user } = useGitHubStore()
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [repoName, setRepoName] = useState('')
  const [setupError, setSetupError] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)

  // Check git status on mount
  useEffect(() => {
    if (!workspacePath) return

    async function check(): Promise<void> {
      try {
        const isRepo = await window.api.git.isRepo(workspacePath)
        if (!isRepo) {
          await window.api.git.init(workspacePath)
        }

        const remote = await window.api.git.getRemote(workspacePath)
        setRemoteUrl(remote)

        if (!remote) {
          setSyncState('no-remote')
          return
        }

        if (!token) {
          setSyncState('no-auth')
          return
        }

        const status = await window.api.git.status(workspacePath)
        if (status) {
          if (status.ahead > 0) setSyncState('ahead')
          else if (status.behind > 0) setSyncState('behind')
          else setSyncState('idle')
        }
      } catch (err) {
        console.error('Git status check failed:', err)
      }
    }

    check()
    const interval = setInterval(check, 15000) // Check every 15 seconds
    return () => clearInterval(interval)
  }, [workspacePath, token])

  const handleSync = useCallback(async () => {
    if (!token || !workspacePath) return

    setSyncState('syncing')
    try {
      // Commit any pending changes
      const status = await window.api.git.status(workspacePath)
      if (status && !status.isClean) {
        await window.api.git.commit(workspacePath, `AllThingy auto-save ${new Date().toISOString()}`)
      }

      // Pull first, then push
      const pullResult = await window.api.git.pull(workspacePath, token)
      if (!pullResult.success) {
        console.warn('Pull warning:', pullResult.error)
      }

      const pushResult = await window.api.git.push(workspacePath, token)
      if (pushResult.success) {
        setSyncState('idle')
      } else {
        setSyncState('error')
        console.error('Push failed:', pushResult.error)
      }
    } catch (err) {
      setSyncState('error')
      console.error('Sync failed:', err)
    }
  }, [workspacePath, token])

  const handleSetup = useCallback(async () => {
    if (!token || !repoName.trim()) return
    setSetupError('')

    try {
      // Create GitHub repo
      const repo = await window.api.git.createGitHubRepo(token, repoName.trim(), isPrivate)

      // Init git if needed
      await window.api.git.init(workspacePath)

      // Set remote
      await window.api.git.setRemote(workspacePath, repo.clone_url)
      setRemoteUrl(repo.clone_url)

      // Initial commit and push
      await window.api.git.commit(workspacePath, 'Initial AllThingy workspace')
      await window.api.git.push(workspacePath, token)

      setShowSetup(false)
      setSyncState('idle')
    } catch (err: unknown) {
      setSetupError(String(err))
    }
  }, [token, repoName, isPrivate, workspacePath])

  // No auth
  if (!token || !user) {
    return (
      <div style={styles.container}>
        <span style={{ ...styles.dot, background: 'var(--text-muted)' }} />
        <span style={styles.status}>Not connected</span>
      </div>
    )
  }

  // No remote set up
  if (syncState === 'no-remote') {
    return (
      <div style={styles.container}>
        <button
          style={styles.setupBtn}
          className="titlebar-no-drag"
          onClick={() => {
            const workspaceName = workspacePath.split('/').pop() || 'allthingy-workspace'
            setRepoName(workspaceName)
            setShowSetup(true)
          }}
        >
          Setup GitHub Sync
        </button>

        {showSetup && (
          <div style={styles.overlay} onClick={() => setShowSetup(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 style={styles.modalTitle}>Setup GitHub Sync</h2>
              <p style={styles.description}>
                Create a GitHub repository for this workspace. Your boards and notebooks will be
                synced to this repo.
              </p>

              {setupError && <div style={styles.error}>{setupError}</div>}

              <label style={styles.label}>Repository Name</label>
              <input
                style={styles.input}
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="my-workspace"
              />

              <label
                style={{
                  ...styles.label,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                Private repository
              </label>

              <div style={styles.modalActions}>
                <button style={styles.btnSecondary} onClick={() => setShowSetup(false)}>
                  Cancel
                </button>
                <button style={styles.btnPrimary} onClick={handleSetup}>
                  Create & Sync
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Synced state
  const dotColor =
    syncState === 'idle'
      ? 'var(--success)'
      : syncState === 'syncing'
        ? 'var(--warning)'
        : syncState === 'error'
          ? 'var(--danger)'
          : 'var(--accent)'

  const statusText =
    syncState === 'idle'
      ? 'Synced'
      : syncState === 'syncing'
        ? 'Syncing...'
        : syncState === 'error'
          ? 'Sync error'
          : syncState === 'ahead'
            ? 'Changes to push'
            : syncState === 'behind'
              ? 'Updates available'
              : ''

  return (
    <div style={styles.container}>
      <span style={{ ...styles.dot, background: dotColor }} />
      <span style={styles.status}>{statusText}</span>
      <button
        style={{
          ...styles.syncBtn,
          opacity: syncState === 'syncing' ? 0.6 : 1
        }}
        className="titlebar-no-drag"
        onClick={handleSync}
        disabled={syncState === 'syncing'}
      >
        &#8635; Sync
      </button>
    </div>
  )
}
