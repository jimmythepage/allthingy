import { ipcMain } from 'electron'

export function registerSharingHandlers(): void {
  // Add collaborator to repo
  ipcMain.handle(
    'sharing:add-collaborator',
    async (_event, token: string, repoFullName: string, username: string) => {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/collaborators/${username}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
          },
          body: JSON.stringify({ permission: 'push' })
        }
      )

      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.message || `Failed to add collaborator: ${response.status}`)
      }

      return { success: true, status: response.status }
    }
  )

  // List collaborators
  ipcMain.handle(
    'sharing:list-collaborators',
    async (_event, token: string, repoFullName: string) => {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/collaborators`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
          }
        }
      )

      if (!response.ok) return []

      const collaborators = await response.json()
      return collaborators.map((c: Record<string, unknown>) => ({
        login: c.login,
        avatar_url: c.avatar_url,
        html_url: c.html_url,
        permissions: c.permissions
      }))
    }
  )

  // Remove collaborator
  ipcMain.handle(
    'sharing:remove-collaborator',
    async (_event, token: string, repoFullName: string, username: string) => {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/collaborators/${username}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
          }
        }
      )

      return { success: response.ok }
    }
  )

  // Create comment (as GitHub Issue comment)
  ipcMain.handle(
    'comments:create-issue',
    async (_event, token: string, repoFullName: string, title: string, body: string) => {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title,
            body,
            labels: ['allthingy-comment']
          })
        }
      )

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || `Failed to create issue: ${response.status}`)
      }

      return await response.json()
    }
  )

  // Add comment to an existing issue
  ipcMain.handle(
    'comments:add-comment',
    async (_event, token: string, repoFullName: string, issueNumber: number, body: string) => {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ body })
        }
      )

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || `Failed to add comment: ${response.status}`)
      }

      return await response.json()
    }
  )

  // List issues (comments) for a repo
  ipcMain.handle(
    'comments:list-issues',
    async (_event, token: string, repoFullName: string) => {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/issues?labels=allthingy-comment&state=open&sort=updated&direction=desc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
          }
        }
      )

      if (!response.ok) return []

      const issues = await response.json()
      return issues.map((issue: Record<string, unknown>) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        user: {
          login: (issue.user as Record<string, unknown>)?.login,
          avatar_url: (issue.user as Record<string, unknown>)?.avatar_url
        },
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        comments: issue.comments
      }))
    }
  )

  // Get comments for an issue
  ipcMain.handle(
    'comments:get-issue-comments',
    async (_event, token: string, repoFullName: string, issueNumber: number) => {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/comments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
          }
        }
      )

      if (!response.ok) return []

      const comments = await response.json()
      return comments.map((c: Record<string, unknown>) => ({
        id: c.id,
        body: c.body,
        user: {
          login: (c.user as Record<string, unknown>)?.login,
          avatar_url: (c.user as Record<string, unknown>)?.avatar_url
        },
        created_at: c.created_at
      }))
    }
  )

  // Close or reopen an issue
  ipcMain.handle(
    'comments:update-issue-state',
    async (
      _event,
      token: string,
      repoFullName: string,
      issueNumber: number,
      state: 'open' | 'closed'
    ) => {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ state })
        }
      )

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || `Failed to update issue: ${response.status}`)
      }

      return await response.json()
    }
  )

  // Get repo info (to extract full_name from remote URL)
  ipcMain.handle(
    'sharing:get-repo-info',
    async (_event, token: string, repoFullName: string) => {
      const response = await fetch(`https://api.github.com/repos/${repoFullName}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json'
        }
      })

      if (!response.ok) return null

      const repo = await response.json()
      return {
        full_name: repo.full_name,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        private: repo.private,
        description: repo.description
      }
    }
  )
}
