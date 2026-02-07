import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Workspace operations
  workspace: {
    create: (path: string, name: string) => ipcRenderer.invoke('workspace:create', path, name),
    pickDirectory: () => ipcRenderer.invoke('workspace:pick-directory'),
    validate: (path: string) => ipcRenderer.invoke('workspace:validate', path),
    readConfig: (path: string) => ipcRenderer.invoke('workspace:read-config', path),
    listBoards: (path: string) => ipcRenderer.invoke('workspace:list-boards', path)
  },

  // Board operations
  board: {
    save: (workspacePath: string, boardId: string, data: unknown) =>
      ipcRenderer.invoke('board:save', workspacePath, boardId, data),
    load: (workspacePath: string, boardId: string) =>
      ipcRenderer.invoke('board:load', workspacePath, boardId)
  },

  // Notebook operations
  notebook: {
    save: (workspacePath: string, notebookId: string, content: string) =>
      ipcRenderer.invoke('notebook:save', workspacePath, notebookId, content),
    load: (workspacePath: string, notebookId: string) =>
      ipcRenderer.invoke('notebook:load', workspacePath, notebookId),
    list: (workspacePath: string) => ipcRenderer.invoke('notebook:list', workspacePath)
  },

  // GitHub operations
  github: {
    getClientId: () => ipcRenderer.invoke('github:get-client-id'),
    setClientId: (clientId: string) => ipcRenderer.invoke('github:set-client-id', clientId),
    requestDeviceCode: (clientId: string) =>
      ipcRenderer.invoke('github:request-device-code', clientId),
    openVerificationUrl: (url: string) =>
      ipcRenderer.invoke('github:open-verification-url', url),
    pollForToken: (clientId: string, deviceCode: string, interval: number) =>
      ipcRenderer.invoke('github:poll-for-token', clientId, deviceCode, interval),
    saveToken: (token: string) => ipcRenderer.invoke('github:save-token', token),
    loadToken: () => ipcRenderer.invoke('github:load-token'),
    clearToken: () => ipcRenderer.invoke('github:clear-token'),
    saveUser: (user: unknown) => ipcRenderer.invoke('github:save-user', user),
    loadUser: () => ipcRenderer.invoke('github:load-user'),
    getUser: (token: string) => ipcRenderer.invoke('github:get-user', token)
  },

  // Git operations
  git: {
    init: (workspacePath: string) => ipcRenderer.invoke('git:init', workspacePath),
    isRepo: (workspacePath: string) => ipcRenderer.invoke('git:is-repo', workspacePath),
    status: (workspacePath: string) => ipcRenderer.invoke('git:status', workspacePath),
    commit: (workspacePath: string, message: string) =>
      ipcRenderer.invoke('git:commit', workspacePath, message),
    setRemote: (workspacePath: string, url: string) =>
      ipcRenderer.invoke('git:set-remote', workspacePath, url),
    getRemote: (workspacePath: string) => ipcRenderer.invoke('git:get-remote', workspacePath),
    push: (workspacePath: string, token: string) =>
      ipcRenderer.invoke('git:push', workspacePath, token),
    pull: (workspacePath: string, token: string) =>
      ipcRenderer.invoke('git:pull', workspacePath, token),
    createGitHubRepo: (token: string, name: string, isPrivate: boolean) =>
      ipcRenderer.invoke('git:create-github-repo', token, name, isPrivate),
    clone: (repoUrl: string, targetPath: string, token: string) =>
      ipcRenderer.invoke('git:clone', repoUrl, targetPath, token),
    log: (workspacePath: string, maxCount: number) =>
      ipcRenderer.invoke('git:log', workspacePath, maxCount)
  },

  // Sharing operations
  sharing: {
    addCollaborator: (token: string, repoFullName: string, username: string) =>
      ipcRenderer.invoke('sharing:add-collaborator', token, repoFullName, username),
    listCollaborators: (token: string, repoFullName: string) =>
      ipcRenderer.invoke('sharing:list-collaborators', token, repoFullName),
    removeCollaborator: (token: string, repoFullName: string, username: string) =>
      ipcRenderer.invoke('sharing:remove-collaborator', token, repoFullName, username),
    getRepoInfo: (token: string, repoFullName: string) =>
      ipcRenderer.invoke('sharing:get-repo-info', token, repoFullName)
  },

  // Comments operations
  comments: {
    createIssue: (token: string, repoFullName: string, title: string, body: string) =>
      ipcRenderer.invoke('comments:create-issue', token, repoFullName, title, body),
    addComment: (token: string, repoFullName: string, issueNumber: number, body: string) =>
      ipcRenderer.invoke('comments:add-comment', token, repoFullName, issueNumber, body),
    listIssues: (token: string, repoFullName: string) =>
      ipcRenderer.invoke('comments:list-issues', token, repoFullName),
    getIssueComments: (token: string, repoFullName: string, issueNumber: number) =>
      ipcRenderer.invoke('comments:get-issue-comments', token, repoFullName, issueNumber)
  }
}

export type BbboardAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
