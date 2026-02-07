import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useGitHubStore } from '../stores/github'
import { useThemeStore } from '../stores/theme'

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
    gap: 16,
    flexShrink: 0
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
  body: {
    flex: 1,
    padding: 40,
    overflow: 'auto'
  },
  section: {
    marginBottom: 40,
    maxWidth: 600
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 16,
    letterSpacing: '-0.3px'
  },
  description: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 16,
    lineHeight: 1.5
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
  btnPrimary: {
    padding: '10px 20px',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'background var(--transition)'
  },
  btnDanger: {
    padding: '10px 20px',
    background: 'var(--danger)',
    color: '#fff',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity var(--transition)'
  },
  btnSecondary: {
    padding: '10px 20px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--border-light)',
    transition: 'background var(--transition)'
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    marginBottom: 16
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: '50%'
  },
  userName: {
    fontSize: 16,
    fontWeight: 600
  },
  userLogin: {
    fontSize: 13,
    color: 'var(--text-secondary)'
  },
  deviceCode: {
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: '4px',
    textAlign: 'center' as const,
    padding: '20px 0',
    color: 'var(--accent)',
    fontFamily: 'monospace'
  },
  deviceInstructions: {
    textAlign: 'center' as const,
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.6
  },
  error: {
    fontSize: 13,
    color: 'var(--danger)',
    marginBottom: 12,
    padding: '8px 12px',
    background: 'rgba(229, 80, 80, 0.1)',
    borderRadius: 'var(--radius-sm)'
  },
  actions: {
    display: 'flex',
    gap: 12,
    marginTop: 8
  }
}

export default function Settings(): JSX.Element {
  const navigate = useNavigate()
  const {
    token,
    user,
    isLoading,
    error,
    clientId,
    deviceFlow,
    setClientId,
    initialize,
    startDeviceFlow,
    logout
  } = useGitHubStore()

  const [editingClientId, setEditingClientId] = useState('')

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    setEditingClientId(clientId)
  }, [clientId])

  const handleSaveClientId = () => {
    if (editingClientId.trim()) {
      setClientId(editingClientId.trim())
    }
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
          Settings
        </span>
      </div>

      <div style={styles.body}>
        {/* GitHub Account Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>GitHub Account</h2>

          {error && <div style={styles.error}>{error}</div>}

          {/* Logged in state */}
          {user && token && (
            <>
              <div style={styles.userCard}>
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  style={styles.avatar}
                />
                <div>
                  <div style={styles.userName}>{user.name || user.login}</div>
                  <div style={styles.userLogin}>@{user.login}</div>
                </div>
              </div>
              <div style={styles.actions}>
                <button style={styles.btnDanger} onClick={logout}>
                  Log Out
                </button>
              </div>
            </>
          )}

          {/* Device flow in progress */}
          {!user && deviceFlow && (
            <div>
              <p style={styles.deviceInstructions}>
                Go to <strong>{deviceFlow.verificationUri}</strong> and enter the code:
              </p>
              <div style={styles.deviceCode}>{deviceFlow.userCode}</div>
              <p style={styles.deviceInstructions}>
                A browser window should have opened automatically.
                <br />
                Waiting for authorization...
              </p>
            </div>
          )}

          {/* Not logged in */}
          {!user && !deviceFlow && (
            <>
              <p style={styles.description}>
                Connect your GitHub account to sync workspaces, share boards, and collaborate with
                others. bbboard uses the GitHub Device Flow for authentication.
              </p>
              <div style={styles.actions}>
                <button
                  style={{
                    ...styles.btnPrimary,
                    opacity: isLoading ? 0.6 : 1
                  }}
                  onClick={startDeviceFlow}
                  disabled={isLoading}
                >
                  {isLoading ? 'Connecting...' : 'Connect GitHub Account'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* GitHub OAuth App Configuration */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>GitHub OAuth App</h2>
          <p style={styles.description}>
            To use GitHub features, you need to create a GitHub OAuth App and enter its Client ID
            here. Go to{' '}
            <a
              href="#"
              style={{ color: 'var(--accent)' }}
              onClick={(e) => {
                e.preventDefault()
                window.api.github.openVerificationUrl(
                  'https://github.com/settings/developers'
                )
              }}
            >
              GitHub Developer Settings
            </a>{' '}
            to create one. Set the callback URL to <code>http://localhost</code>.
          </p>

          <label style={styles.label}>Client ID</label>
          <input
            style={styles.input}
            placeholder="Ov23li..."
            value={editingClientId}
            onChange={(e) => setEditingClientId(e.target.value)}
          />

          <div style={styles.actions}>
            <button
              style={{
                ...styles.btnSecondary,
                opacity: editingClientId !== clientId ? 1 : 0.5
              }}
              onClick={handleSaveClientId}
              disabled={editingClientId === clientId}
            >
              Save Client ID
            </button>
          </div>
        </div>

        {/* Preferences */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Preferences</h2>

          <label
            style={{
              ...styles.label,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: '12px 0'
            }}
          >
            <span>Theme</span>
            <button
              style={{
                ...styles.btnSecondary,
                padding: '6px 14px',
                fontSize: 13
              }}
              onClick={() => useThemeStore.getState().toggleTheme()}
            >
              {useThemeStore.getState().theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            </button>
          </label>

          <p style={styles.description}>
            <strong>Keyboard Shortcuts:</strong>
            <br />
            Cmd+N: New notebook &nbsp; Cmd+P: Search &nbsp; Cmd+B: Toggle sidebar
            <br />
            Cmd+\\: Toggle sidebar
          </p>
        </div>
      </div>
    </div>
  )
}
