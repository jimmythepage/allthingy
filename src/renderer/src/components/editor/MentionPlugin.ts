import { CompletionContext, type CompletionResult } from '@codemirror/autocomplete'

export interface MentionOption {
  login: string
  avatar_url?: string
}

/**
 * Returns a raw completion source function for @mentions.
 * To be combined with other sources in a single autocompletion() call.
 */
export function mentionCompletionSource(getCollaborators: () => MentionOption[]) {
  return (context: CompletionContext): CompletionResult | null => {
    // Look for @ pattern before cursor (but not inside emails like foo@bar)
    const before = context.matchBefore(/(^|[\s\[(])@[a-zA-Z0-9_-]*/)
    if (!before) return null

    // Find where the @ starts
    const atIdx = before.text.lastIndexOf('@')
    if (atIdx === -1) return null

    const query = before.text.slice(atIdx + 1).toLowerCase()
    const from = before.from + atIdx

    const collaborators = getCollaborators()

    const options = collaborators
      .filter((c) => {
        if (!query) return true
        return c.login.toLowerCase().includes(query)
      })
      .map((c) => ({
        label: `@${c.login}`,
        detail: 'collaborator',
        apply: `@${c.login}`,
        type: 'text' as const
      }))

    if (options.length === 0) return null

    return {
      from,
      options,
      filter: false
    }
  }
}
