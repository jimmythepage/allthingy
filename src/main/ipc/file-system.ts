import { ipcMain, dialog } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'

export interface WorkspaceInfo {
  name: string
  path: string
  lastOpened: string
}

const WORKSPACE_MARKER = '.allthingy'

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function registerIpcHandlers(): void {
  // Create a new workspace directory
  ipcMain.handle('workspace:create', async (_event, workspacePath: string, name: string) => {
    ensureDir(workspacePath)
    ensureDir(join(workspacePath, WORKSPACE_MARKER))
    ensureDir(join(workspacePath, 'boards'))
    ensureDir(join(workspacePath, 'notebooks'))
    ensureDir(join(workspacePath, 'notebooks', 'assets'))

    const config = {
      name,
      created: new Date().toISOString(),
      version: '0.1.0'
    }
    writeFileSync(
      join(workspacePath, WORKSPACE_MARKER, 'config.json'),
      JSON.stringify(config, null, 2)
    )
    return config
  })

  // Open workspace directory picker
  ipcMain.handle('workspace:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose workspace location'
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // Check if a directory is a valid workspace
  ipcMain.handle('workspace:validate', async (_event, workspacePath: string) => {
    return existsSync(join(workspacePath, WORKSPACE_MARKER, 'config.json'))
  })

  // Read workspace config
  ipcMain.handle('workspace:read-config', async (_event, workspacePath: string) => {
    const configPath = join(workspacePath, WORKSPACE_MARKER, 'config.json')
    if (!existsSync(configPath)) return null
    return JSON.parse(readFileSync(configPath, 'utf-8'))
  })

  // List boards in a workspace
  ipcMain.handle('workspace:list-boards', async (_event, workspacePath: string) => {
    const boardsDir = join(workspacePath, 'boards')
    if (!existsSync(boardsDir)) return []
    return readdirSync(boardsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const content = JSON.parse(readFileSync(join(boardsDir, f), 'utf-8'))
        return {
          id: content.id || basename(f, '.json'),
          name: content.name || basename(f, '.json'),
          modified: content.metadata?.modified || statSync(join(boardsDir, f)).mtime.toISOString()
        }
      })
  })

  // Save a board
  ipcMain.handle(
    'board:save',
    async (_event, workspacePath: string, boardId: string, data: unknown) => {
      const boardsDir = join(workspacePath, 'boards')
      ensureDir(boardsDir)
      writeFileSync(join(boardsDir, `${boardId}.json`), JSON.stringify(data, null, 2))
      return true
    }
  )

  // Load a board
  ipcMain.handle('board:load', async (_event, workspacePath: string, boardId: string) => {
    const boardPath = join(workspacePath, 'boards', `${boardId}.json`)
    if (!existsSync(boardPath)) return null
    return JSON.parse(readFileSync(boardPath, 'utf-8'))
  })

  // Save a notebook (.md file)
  ipcMain.handle(
    'notebook:save',
    async (_event, workspacePath: string, notebookId: string, content: string) => {
      const notebooksDir = join(workspacePath, 'notebooks')
      ensureDir(notebooksDir)
      writeFileSync(join(notebooksDir, `${notebookId}.md`), content)
      return true
    }
  )

  // Load a notebook
  ipcMain.handle('notebook:load', async (_event, workspacePath: string, notebookId: string) => {
    const notebookPath = join(workspacePath, 'notebooks', `${notebookId}.md`)
    if (!existsSync(notebookPath)) return null
    return readFileSync(notebookPath, 'utf-8')
  })

  // List notebooks in a workspace
  ipcMain.handle('notebook:list', async (_event, workspacePath: string) => {
    const notebooksDir = join(workspacePath, 'notebooks')
    if (!existsSync(notebooksDir)) return []
    return readdirSync(notebooksDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({
        id: basename(f, '.md'),
        filename: f
      }))
  })
}
