import { ipcMain, shell, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

// GitHub OAuth Device Flow client ID
// Users should create their own GitHub OAuth App and set this.
// For development, we use a placeholder that the user can configure.
const GITHUB_CLIENT_ID = 'Ov23liXXXXXXXXXXXXXX' // Replace with your OAuth App client ID

const TOKEN_FILE = 'github-token.enc'
const USER_FILE = 'github-user.json'

function getConfigDir(): string {
  const dir = join(app.getPath('userData'), 'config')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function saveToken(token: string): void {
  const encrypted = safeStorage.encryptString(token)
  writeFileSync(join(getConfigDir(), TOKEN_FILE), encrypted)
}

function loadToken(): string | null {
  const filePath = join(getConfigDir(), TOKEN_FILE)
  if (!existsSync(filePath)) return null
  try {
    const encrypted = readFileSync(filePath)
    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
}

function clearToken(): void {
  const filePath = join(getConfigDir(), TOKEN_FILE)
  if (existsSync(filePath)) {
    writeFileSync(filePath, '')
  }
}

function saveUserData(user: unknown): void {
  writeFileSync(join(getConfigDir(), USER_FILE), JSON.stringify(user, null, 2))
}

function loadUserData(): unknown {
  const filePath = join(getConfigDir(), USER_FILE)
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function clearUserData(): void {
  const filePath = join(getConfigDir(), USER_FILE)
  if (existsSync(filePath)) {
    writeFileSync(filePath, '{}')
  }
}

export function registerGitHubHandlers(): void {
  // Get stored GitHub client ID or use default
  ipcMain.handle('github:get-client-id', async () => {
    const configPath = join(getConfigDir(), 'github-config.json')
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'))
        return config.clientId || GITHUB_CLIENT_ID
      } catch {
        return GITHUB_CLIENT_ID
      }
    }
    return GITHUB_CLIENT_ID
  })

  // Save custom GitHub client ID
  ipcMain.handle('github:set-client-id', async (_event, clientId: string) => {
    const configPath = join(getConfigDir(), 'github-config.json')
    writeFileSync(configPath, JSON.stringify({ clientId }, null, 2))
    return true
  })

  // Step 1: Request device code from GitHub
  ipcMain.handle('github:request-device-code', async (_event, clientId: string) => {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'repo user'
      })
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    return await response.json()
  })

  // Step 2: Open browser for user to enter code
  ipcMain.handle('github:open-verification-url', async (_event, url: string) => {
    await shell.openExternal(url)
    return true
  })

  // Step 3: Poll for access token
  ipcMain.handle(
    'github:poll-for-token',
    async (_event, clientId: string, deviceCode: string, interval: number) => {
      // Wait the specified interval
      await new Promise((resolve) => setTimeout(resolve, interval * 1000))

      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      return await response.json()
    }
  )

  // Save token securely
  ipcMain.handle('github:save-token', async (_event, token: string) => {
    saveToken(token)
    return true
  })

  // Load stored token
  ipcMain.handle('github:load-token', async () => {
    return loadToken()
  })

  // Clear stored token (logout)
  ipcMain.handle('github:clear-token', async () => {
    clearToken()
    clearUserData()
    return true
  })

  // Save user data
  ipcMain.handle('github:save-user', async (_event, user: unknown) => {
    saveUserData(user)
    return true
  })

  // Load user data
  ipcMain.handle('github:load-user', async () => {
    return loadUserData()
  })

  // Get user profile from GitHub API
  ipcMain.handle('github:get-user', async (_event, token: string) => {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    return await response.json()
  })
}
