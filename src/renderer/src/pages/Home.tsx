import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspaceStore, type WorkspaceInfo } from '../stores/workspace'
import { useGitHubStore } from '../stores/github'

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
    flexShrink: 0
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px'
  },
  body: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 60,
    overflow: 'auto'
  },
  content: {
    maxWidth: 640,
    width: '100%'
  },
  heading: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 8,
    letterSpacing: '-0.5px'
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 40
  },
  actions: {
    display: 'flex',
    gap: 12,
    marginBottom: 48
  },
  btnPrimary: {
    padding: '10px 20px',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    fontWeight: 500,
    transition: 'background var(--transition)'
  },
  btnSecondary: {
    padding: '10px 20px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    fontWeight: 500,
    border: '1px solid var(--border-light)',
    transition: 'background var(--transition)'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 16
  },
  workspaceList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6
  },
  workspaceItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'background var(--transition)',
    border: '1px solid transparent'
  },
  workspaceName: {
    fontSize: 14,
    fontWeight: 500
  },
  workspacePath: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 2
  },
  workspaceDate: {
    fontSize: 12,
    color: 'var(--text-muted)',
    flexShrink: 0
  },
  empty: {
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    fontSize: 14,
    padding: 40
  },
  // Modal styles
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
    width: 400,
    border: '1px solid var(--border-light)',
    boxShadow: 'var(--shadow-md)'
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 600,
    marginBottom: 20
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
    marginBottom: 16
  },
  pathDisplay: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: 16,
    wordBreak: 'break-all' as const
  },
  modalActions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 8
  }
}

export default function Home(): JSX.Element {
  const navigate = useNavigate()
  const { recentWorkspaces, addRecentWorkspace } = useWorkspaceStore()
  const { token, initialize: initGitHub } = useGitHubStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [cloneUrl, setCloneUrl] = useState('')
  const [cloneDir, setCloneDir] = useState<string | null>(null)
  const [cloneError, setCloneError] = useState('')
  const [cloning, setCloning] = useState(false)

  useEffect(() => {
    initGitHub()
  }, [initGitHub])

  const openWorkspace = useCallback(
    async (ws: WorkspaceInfo) => {
      addRecentWorkspace({ ...ws, lastOpened: new Date().toISOString() })
      // Navigate to the workspace — for now we'll list boards first
      const boards = await window.api.workspace.listBoards(ws.path)
      if (boards.length > 0) {
        navigate(`/board/${encodeURIComponent(ws.path)}/${boards[0].id}`)
      } else {
        // Create a default board
        const boardId = `board-${Date.now()}`
        const boardData = {
          id: boardId,
          name: 'Untitled Board',
          tldrawDocument: null,
          notebookPlacements: {},
          metadata: {
            created: new Date().toISOString(),
            modified: new Date().toISOString()
          }
        }
        await window.api.board.save(ws.path, boardId, boardData)
        navigate(`/board/${encodeURIComponent(ws.path)}/${boardId}`)
      }
    },
    [navigate, addRecentWorkspace]
  )

  const handlePickDirectory = useCallback(async () => {
    const dir = await window.api.workspace.pickDirectory()
    if (dir) setSelectedPath(dir)
  }, [])

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !selectedPath) return
    const fullPath = `${selectedPath}/${newName.trim().replace(/\s+/g, '-').toLowerCase()}`
    await window.api.workspace.create(fullPath, newName.trim())
    const ws: WorkspaceInfo = {
      name: newName.trim(),
      path: fullPath,
      lastOpened: new Date().toISOString()
    }
    setShowCreateModal(false)
    setNewName('')
    setSelectedPath(null)
    openWorkspace(ws)
  }, [newName, selectedPath, openWorkspace])

  const handleOpenExisting = useCallback(async () => {
    const dir = await window.api.workspace.pickDirectory()
    if (!dir) return
    const isValid = await window.api.workspace.validate(dir)
    if (isValid) {
      const config = await window.api.workspace.readConfig(dir)
      openWorkspace({
        name: config?.name || dir.split('/').pop() || 'Workspace',
        path: dir,
        lastOpened: new Date().toISOString()
      })
    } else {
      // Not a workspace yet — initialize it
      const name = dir.split('/').pop() || 'Workspace'
      await window.api.workspace.create(dir, name)
      openWorkspace({
        name,
        path: dir,
        lastOpened: new Date().toISOString()
      })
    }
  }, [openWorkspace])

  const handleClone = useCallback(async () => {
    if (!token || !cloneUrl.trim() || !cloneDir) return
    setCloneError('')
    setCloning(true)

    try {
      // Extract repo name from URL
      const repoName = cloneUrl
        .replace(/\.git$/, '')
        .split('/')
        .pop() || 'cloned-workspace'
      const targetPath = `${cloneDir}/${repoName}`

      await window.api.git.clone(cloneUrl.trim(), targetPath, token)

      setShowCloneModal(false)
      setCloneUrl('')
      setCloneDir(null)

      openWorkspace({
        name: repoName,
        path: targetPath,
        lastOpened: new Date().toISOString()
      })
    } catch (err: unknown) {
      setCloneError(String(err))
    } finally {
      setCloning(false)
    }
  }, [token, cloneUrl, cloneDir, openWorkspace])

  return (
    <div style={styles.container}>
      <div style={styles.titlebar} className="titlebar-drag">
        <span style={styles.title} className="titlebar-no-drag">
          AllThingy
        </span>
      </div>

      <div style={styles.body}>
        <div style={styles.content}>
          <h1 style={styles.heading}>Welcome to AllThingy</h1>
          <p style={styles.subtitle}>
            Infinite canvas meets connected notebooks. Create or open a workspace to get started.
          </p>

          <div style={styles.actions}>
            <button
              style={styles.btnPrimary}
              onClick={() => setShowCreateModal(true)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--accent-hover)')
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
            >
              New Workspace
            </button>
            <button
              style={styles.btnSecondary}
              onClick={handleOpenExisting}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--bg-hover)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'var(--bg-tertiary)')
              }
            >
              Open Existing
            </button>
            <button
              style={styles.btnSecondary}
              onClick={() => navigate('/settings')}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--bg-hover)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'var(--bg-tertiary)')
              }
            >
              Settings
            </button>
            {token && (
              <button
                style={styles.btnSecondary}
                onClick={() => setShowCloneModal(true)}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--bg-hover)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'var(--bg-tertiary)')
                }
              >
                Clone from GitHub
              </button>
            )}
          </div>

          {recentWorkspaces.length > 0 && (
            <>
              <div style={styles.sectionTitle}>Recent Workspaces</div>
              <div style={styles.workspaceList}>
                {recentWorkspaces.map((ws) => (
                  <div
                    key={ws.path}
                    style={styles.workspaceItem}
                    onClick={() => openWorkspace(ws)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)'
                      e.currentTarget.style.borderColor = 'var(--border-light)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = 'transparent'
                    }}
                  >
                    <div>
                      <div style={styles.workspaceName}>{ws.name}</div>
                      <div style={styles.workspacePath}>{ws.path}</div>
                    </div>
                    <div style={styles.workspaceDate}>
                      {new Date(ws.lastOpened).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {recentWorkspaces.length === 0 && (
            <div style={styles.empty}>
              No recent workspaces. Create one to get started.
            </div>
          )}
        </div>
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div style={styles.overlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>New Workspace</h2>

            <label style={styles.label}>Workspace Name</label>
            <input
              style={styles.input}
              placeholder="My Project"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />

            <label style={styles.label}>Location</label>
            {selectedPath ? (
              <div style={styles.pathDisplay}>{selectedPath}</div>
            ) : (
              <button
                style={{ ...styles.btnSecondary, marginBottom: 16, width: '100%' }}
                onClick={handlePickDirectory}
              >
                Choose Folder...
              </button>
            )}

            <div style={styles.modalActions}>
              <button style={styles.btnSecondary} onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button
                style={{
                  ...styles.btnPrimary,
                  opacity: newName.trim() && selectedPath ? 1 : 0.5
                }}
                onClick={handleCreate}
                disabled={!newName.trim() || !selectedPath}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone from GitHub Modal */}
      {showCloneModal && (
        <div style={styles.overlay} onClick={() => setShowCloneModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Clone from GitHub</h2>

            {cloneError && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--danger)',
                  marginBottom: 12,
                  padding: '8px 12px',
                  background: 'rgba(229, 80, 80, 0.1)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                {cloneError}
              </div>
            )}

            <label style={styles.label}>Repository URL</label>
            <input
              style={styles.input}
              placeholder="https://github.com/user/repo.git"
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              autoFocus
            />

            <label style={styles.label}>Clone to</label>
            {cloneDir ? (
              <div style={styles.pathDisplay}>{cloneDir}</div>
            ) : (
              <button
                style={{ ...styles.btnSecondary, marginBottom: 16, width: '100%' }}
                onClick={async () => {
                  const dir = await window.api.workspace.pickDirectory()
                  if (dir) setCloneDir(dir)
                }}
              >
                Choose Folder...
              </button>
            )}

            <div style={styles.modalActions}>
              <button style={styles.btnSecondary} onClick={() => setShowCloneModal(false)}>
                Cancel
              </button>
              <button
                style={{
                  ...styles.btnPrimary,
                  opacity: cloneUrl.trim() && cloneDir && !cloning ? 1 : 0.5
                }}
                onClick={handleClone}
                disabled={!cloneUrl.trim() || !cloneDir || cloning}
              >
                {cloning ? 'Cloning...' : 'Clone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
