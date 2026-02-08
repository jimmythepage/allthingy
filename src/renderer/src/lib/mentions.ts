import { useGitHubStore } from '../stores/github'

/**
 * Extract all @mentions from a text string.
 * Returns an array of unique usernames (without the @ prefix).
 */
export function extractMentions(text: string): string[] {
  const regex = /(^|[\s\[(])@([a-zA-Z0-9_-]+)/g
  const mentions = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    mentions.add(match[2])
  }

  return Array.from(mentions)
}

/**
 * Find newly added @mentions by comparing new text with previous text.
 */
export function findNewMentions(newText: string, previousText: string): string[] {
  const oldMentions = new Set(extractMentions(previousText))
  const newMentions = extractMentions(newText)
  return newMentions.filter((m) => !oldMentions.has(m))
}

/**
 * Try to resolve the repoFullName from the git remote.
 * This is a fallback in case the context value is stale/null.
 */
async function resolveRepoFullName(hint: string | null): Promise<string | null> {
  if (hint) return hint
  try {
    // Try all known workspace paths by checking common locations
    const remote = await window.api.git.getRemote('')
    if (remote) {
      const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/)
      if (match) return match[1]
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Notify mentioned users by creating GitHub issues.
 * Returns the issue numbers that were created.
 * Self-sufficient: reads token from store and resolves repo name.
 */
export async function notifyMentions(
  newText: string,
  previousText: string,
  context: string,
  repoFullNameHint: string | null
): Promise<number[]> {
  const { token, user } = useGitHubStore.getState()

  console.log('[bbboard] notifyMentions called', {
    hasToken: !!token,
    repoFullNameHint,
    newTextLen: newText.length,
    prevTextLen: previousText.length
  })

  if (!token) {
    console.log('[bbboard] No GitHub token, skipping mention notifications')
    return []
  }

  const repoFullName = await resolveRepoFullName(repoFullNameHint)
  if (!repoFullName) {
    console.log('[bbboard] No repoFullName resolved, skipping mention notifications')
    return []
  }

  const newMentions = findNewMentions(newText, previousText)
  console.log('[bbboard] New mentions found:', newMentions)

  if (newMentions.length === 0) return []

  const mentionsToNotify = newMentions

  console.log('[bbboard] Mentions to notify:', mentionsToNotify)

  if (mentionsToNotify.length === 0) return []

  const snippet = newText.length > 200 ? newText.slice(0, 200) + '...' : newText
  const createdIssueNumbers: number[] = []

  for (const username of mentionsToNotify) {
    try {
      const title = `@${username} mentioned in: ${context}`
      const body = [
        `**${user?.login || 'Someone'}** mentioned you in **${context}**.`,
        '',
        '> ' + snippet.split('\n').join('\n> '),
        '',
        '*This notification was created automatically by bbboard.*'
      ].join('\n')

      console.log('[bbboard] Creating issue for @' + username, { title, repoFullName })
      const result = await window.api.comments.createIssue(token, repoFullName, title, body)
      console.log('[bbboard] Issue created:', result?.number)
      if (result?.number) {
        createdIssueNumbers.push(result.number)
      }
    } catch (err) {
      console.error(`[bbboard] Failed to notify @${username}:`, err)
    }
  }

  return createdIssueNumbers
}

/**
 * Update the state of linked GitHub issues (close or reopen).
 */
export async function updateLinkedIssues(
  issueNumbers: number[],
  state: 'open' | 'closed',
  repoFullName: string | null
): Promise<void> {
  const { token } = useGitHubStore.getState()
  if (!token || !repoFullName || issueNumbers.length === 0) return

  for (const issueNumber of issueNumbers) {
    try {
      await window.api.comments.updateIssueState(token, repoFullName, issueNumber, state)
    } catch (err) {
      console.error(`Failed to ${state} issue #${issueNumber}:`, err)
    }
  }
}
