import { ipcMain } from 'electron'
import simpleGit, { SimpleGit, StatusResult } from 'simple-git'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

const DEFAULT_GITIGNORE = `.DS_Store
*.log
node_modules/
.allthingy/local/
`

function getGit(workspacePath: string): SimpleGit {
  return simpleGit(workspacePath)
}

export function registerGitHandlers(): void {
  // Initialize git repo in workspace
  ipcMain.handle('git:init', async (_event, workspacePath: string) => {
    const git = getGit(workspacePath)
    const isRepo = existsSync(join(workspacePath, '.git'))

    if (!isRepo) {
      await git.init()
    }

    // Ensure .gitignore
    const gitignorePath = join(workspacePath, '.gitignore')
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, DEFAULT_GITIGNORE)
    }

    return { initialized: !isRepo, alreadyRepo: isRepo }
  })

  // Check if workspace is a git repo
  ipcMain.handle('git:is-repo', async (_event, workspacePath: string) => {
    return existsSync(join(workspacePath, '.git'))
  })

  // Get git status
  ipcMain.handle('git:status', async (_event, workspacePath: string) => {
    const git = getGit(workspacePath)
    try {
      const status: StatusResult = await git.status()
      return {
        isClean: status.isClean(),
        modified: status.modified,
        created: status.created,
        deleted: status.deleted,
        not_added: status.not_added,
        ahead: status.ahead,
        behind: status.behind,
        current: status.current,
        tracking: status.tracking
      }
    } catch {
      return null
    }
  })

  // Add and commit all changes
  ipcMain.handle(
    'git:commit',
    async (_event, workspacePath: string, message: string) => {
      const git = getGit(workspacePath)
      await git.add('.')
      const result = await git.commit(message)
      return {
        commit: result.commit,
        summary: {
          changes: result.summary.changes,
          insertions: result.summary.insertions,
          deletions: result.summary.deletions
        }
      }
    }
  )

  // Set remote origin
  ipcMain.handle(
    'git:set-remote',
    async (_event, workspacePath: string, url: string) => {
      const git = getGit(workspacePath)
      try {
        await git.addRemote('origin', url)
      } catch {
        // Remote might already exist, update it
        await git.remote(['set-url', 'origin', url])
      }
      return true
    }
  )

  // Get remote URL
  ipcMain.handle('git:get-remote', async (_event, workspacePath: string) => {
    const git = getGit(workspacePath)
    try {
      const remotes = await git.getRemotes(true)
      const origin = remotes.find((r) => r.name === 'origin')
      return origin?.refs?.push || origin?.refs?.fetch || null
    } catch {
      return null
    }
  })

  // Push changes
  ipcMain.handle(
    'git:push',
    async (_event, workspacePath: string, token: string) => {
      const git = getGit(workspacePath)

      // Get current branch
      const branch = await git.revparse(['--abbrev-ref', 'HEAD'])
      const branchName = branch.trim() || 'main'

      // Get remote URL and inject token
      const remotes = await git.getRemotes(true)
      const origin = remotes.find((r) => r.name === 'origin')
      if (!origin) throw new Error('No remote origin configured')

      const remoteUrl = origin.refs.push || origin.refs.fetch
      const authedUrl = injectTokenInUrl(remoteUrl, token)

      try {
        await git.push(authedUrl, branchName, ['--set-upstream'])
        return { success: true }
      } catch (err: unknown) {
        return { success: false, error: String(err) }
      }
    }
  )

  // Pull changes
  ipcMain.handle(
    'git:pull',
    async (_event, workspacePath: string, token: string) => {
      const git = getGit(workspacePath)

      // Abort any stuck rebase from a previous failed pull
      if (existsSync(join(workspacePath, '.git', 'rebase-merge')) ||
          existsSync(join(workspacePath, '.git', 'rebase-apply'))) {
        try {
          await git.rebase(['--abort'])
        } catch {
          // ignore — may already be clean
        }
      }

      const remotes = await git.getRemotes(true)
      const origin = remotes.find((r) => r.name === 'origin')
      if (!origin) throw new Error('No remote origin configured')

      const remoteUrl = origin.refs.fetch || origin.refs.push
      const authedUrl = injectTokenInUrl(remoteUrl, token)
      const branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim() || 'main'

      try {
        await git.pull(authedUrl, branch, ['--no-rebase'])
        return { success: true }
      } catch (err: unknown) {
        return { success: false, error: String(err) }
      }
    }
  )

  // Create GitHub repo via API
  ipcMain.handle(
    'git:create-github-repo',
    async (_event, token: string, name: string, isPrivate: boolean) => {
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          private: isPrivate,
          description: `AllThingy workspace: ${name}`,
          auto_init: false
        })
      })

      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.message || `GitHub API error: ${response.status}`)
      }

      const repo = await response.json()
      return {
        full_name: repo.full_name,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url
      }
    }
  )

  // Clone a repo
  ipcMain.handle(
    'git:clone',
    async (_event, repoUrl: string, targetPath: string, token: string) => {
      const authedUrl = injectTokenInUrl(repoUrl, token)
      const git = simpleGit()
      await git.clone(authedUrl, targetPath)
      return true
    }
  )

  // Get log
  ipcMain.handle('git:log', async (_event, workspacePath: string, maxCount: number) => {
    const git = getGit(workspacePath)
    try {
      const log = await git.log({ maxCount })
      return log.all.map((entry) => ({
        hash: entry.hash,
        date: entry.date,
        message: entry.message,
        author: entry.author_name
      }))
    } catch {
      return []
    }
  })
}

function injectTokenInUrl(url: string, token: string): string {
  // Convert https://github.com/user/repo.git to https://x-access-token:TOKEN@github.com/user/repo.git
  if (url.startsWith('https://github.com/')) {
    return url.replace('https://github.com/', `https://x-access-token:${token}@github.com/`)
  }
  // Convert git@github.com:user/repo.git to HTTPS with token
  if (url.startsWith('git@github.com:')) {
    const path = url.replace('git@github.com:', '')
    return `https://x-access-token:${token}@github.com/${path}`
  }
  return url
}
