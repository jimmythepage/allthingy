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
 * Only fires when GitHub token + repo are available.
 *
 * @param newText - The current text content
 * @param previousText - The previous text content (for diffing)
 * @param context - Description of where the mention happened (e.g. "notebook: My Notes")
 * @param repoFullName - The GitHub repo (e.g. "owner/repo")
 */
export async function notifyMentions(
  newText: string,
  previousText: string,
  context: string,
  repoFullName: string | null
): Promise<void> {
  const { token, user } = useGitHubStore.getState()
  if (!token || !repoFullName) return

  const newMentions = findNewMentions(newText, previousText)
  if (newMentions.length === 0) return

  // Don't notify yourself
  const mentionsToNotify = user
    ? newMentions.filter((m) => m.toLowerCase() !== user.login.toLowerCase())
    : newMentions

  // Extract a short snippet of the text around the mention for context
  const snippet = newText.length > 200 ? newText.slice(0, 200) + '...' : newText

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

      await window.api.comments.createIssue(token, repoFullName, title, body)
    } catch (err) {
      console.error(`Failed to notify @${username}:`, err)
    }
  }
}
