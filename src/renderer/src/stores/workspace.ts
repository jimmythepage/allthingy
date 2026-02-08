import { create } from 'zustand'

export interface WorkspaceInfo {
  name: string
  path: string
  lastOpened: string
}

export interface BoardInfo {
  id: string
  name: string
  modified: string
}

interface WorkspaceState {
  // Recent workspaces
  recentWorkspaces: WorkspaceInfo[]
  addRecentWorkspace: (ws: WorkspaceInfo) => void
  removeRecentWorkspace: (path: string) => void

  // Current workspace
  currentWorkspace: WorkspaceInfo | null
  setCurrentWorkspace: (ws: WorkspaceInfo | null) => void

  // Boards in current workspace
  boards: BoardInfo[]
  setBoards: (boards: BoardInfo[]) => void

  // Current board
  currentBoardId: string | null
  setCurrentBoardId: (id: string | null) => void
}

const RECENT_WORKSPACES_KEY = 'allthingy:recent-workspaces'

function loadRecentWorkspaces(): WorkspaceInfo[] {
  try {
    const raw = localStorage.getItem(RECENT_WORKSPACES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentWorkspaces(workspaces: WorkspaceInfo[]): void {
  localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(workspaces))
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  recentWorkspaces: loadRecentWorkspaces(),

  addRecentWorkspace: (ws) => {
    const existing = get().recentWorkspaces.filter((w) => w.path !== ws.path)
    const updated = [ws, ...existing].slice(0, 20)
    saveRecentWorkspaces(updated)
    set({ recentWorkspaces: updated })
  },

  removeRecentWorkspace: (path) => {
    const updated = get().recentWorkspaces.filter((w) => w.path !== path)
    saveRecentWorkspaces(updated)
    set({ recentWorkspaces: updated })
  },

  currentWorkspace: null,
  setCurrentWorkspace: (ws) => set({ currentWorkspace: ws }),

  boards: [],
  setBoards: (boards) => set({ boards }),

  currentBoardId: null,
  setCurrentBoardId: (id) => set({ currentBoardId: id })
}))
