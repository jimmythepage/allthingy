import { create } from 'zustand'

export interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
  email: string | null
  html_url: string
  public_repos: number
}

interface DeviceFlowState {
  userCode: string
  verificationUri: string
  expiresIn: number
}

interface GitHubState {
  // Auth state
  token: string | null
  user: GitHubUser | null
  isLoading: boolean
  error: string | null
  clientId: string

  // Device flow
  deviceFlow: DeviceFlowState | null

  // Actions
  setClientId: (id: string) => void
  initialize: () => Promise<void>
  startDeviceFlow: () => Promise<void>
  pollForToken: (deviceCode: string, interval: number) => Promise<boolean>
  logout: () => Promise<void>
  fetchUser: () => Promise<void>
}

export const useGitHubStore = create<GitHubState>((set, get) => ({
  token: null,
  user: null,
  isLoading: false,
  error: null,
  clientId: '',
  deviceFlow: null,

  setClientId: (id) => {
    set({ clientId: id })
    window.api.github.setClientId(id)
  },

  initialize: async () => {
    set({ isLoading: true, error: null })
    try {
      const clientId = await window.api.github.getClientId()
      const token = await window.api.github.loadToken()
      const user = await window.api.github.loadUser()

      set({
        clientId,
        token,
        user: user as GitHubUser | null,
        isLoading: false
      })

      // Verify token is still valid
      if (token) {
        try {
          const freshUser = await window.api.github.getUser(token)
          await window.api.github.saveUser(freshUser)
          set({ user: freshUser as GitHubUser })
        } catch {
          // Token might be expired
          set({ token: null, user: null })
          await window.api.github.clearToken()
        }
      }
    } catch (err) {
      set({ isLoading: false, error: String(err) })
    }
  },

  startDeviceFlow: async () => {
    const { clientId } = get()
    if (!clientId || clientId.startsWith('Ov23liXXXX')) {
      set({ error: 'Please set a valid GitHub OAuth App Client ID in Settings.' })
      return
    }

    set({ isLoading: true, error: null, deviceFlow: null })
    try {
      const result = await window.api.github.requestDeviceCode(clientId)
      set({
        deviceFlow: {
          userCode: result.user_code,
          verificationUri: result.verification_uri,
          expiresIn: result.expires_in
        },
        isLoading: false
      })

      // Open browser
      await window.api.github.openVerificationUrl(result.verification_uri)

      // Start polling
      const success = await get().pollForToken(result.device_code, result.interval || 5)
      if (!success) {
        set({ error: 'Authentication timed out. Please try again.', deviceFlow: null })
      }
    } catch (err) {
      set({ isLoading: false, error: String(err), deviceFlow: null })
    }
  },

  pollForToken: async (deviceCode, interval) => {
    const { clientId } = get()
    const maxAttempts = 60 // 5 minutes at 5s intervals

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await window.api.github.pollForToken(clientId, deviceCode, interval)

        if (result.access_token) {
          await window.api.github.saveToken(result.access_token)
          set({ token: result.access_token, deviceFlow: null })
          await get().fetchUser()
          return true
        }

        if (result.error === 'authorization_pending') {
          continue
        }

        if (result.error === 'slow_down') {
          interval = (result.interval || interval) + 1
          continue
        }

        if (result.error === 'expired_token' || result.error === 'access_denied') {
          set({ error: `Auth failed: ${result.error}`, deviceFlow: null, isLoading: false })
          return false
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }

    set({ deviceFlow: null, isLoading: false })
    return false
  },

  logout: async () => {
    await window.api.github.clearToken()
    set({ token: null, user: null, deviceFlow: null, error: null })
  },

  fetchUser: async () => {
    const { token } = get()
    if (!token) return

    try {
      const user = await window.api.github.getUser(token)
      await window.api.github.saveUser(user)
      set({ user: user as GitHubUser })
    } catch (err) {
      set({ error: `Failed to fetch user: ${err}` })
    }
  }
}))
