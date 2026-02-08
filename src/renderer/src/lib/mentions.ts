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
 * Notify mentioned users by creating GitHub issues.
 * Returns the issue numbers that were created.
 * Only fires when GitHub token + repo are available.
 */
export async function notifyMentions(
  newText: string,
  previousText: string,
  context: string,
  repoFullName: string | null
): Promise<number[]> {
  const { token, user } = useGitHubStore.getState()
  if (!token || !repoFullName) return []

  const newMentions = findNewMentions(newText, previousText)
  if (newMentions.length === 0) return []

  // Don't notify yourself
  const mentionsToNotify = user
    ? newMentions.filter((m) => m.toLowerCase() !== user.login.toLowerCase())
    : newMentions

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

      const result = await window.api.comments.createIssue(token, repoFullName, title, body)
      if (result?.number) {
        createdIssueNumbers.push(result.number)
      }
    } catch (err) {
      console.error(`Failed to notify @${username}:`, err)
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
