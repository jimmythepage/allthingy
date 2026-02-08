import { CompletionContext, autocompletion } from '@codemirror/autocomplete'
import { Extension } from '@codemirror/state'

export interface MentionOption {
  login: string
  avatar_url?: string
}

/**
 * Creates a CodeMirror extension that provides autocomplete for @mentions.
 * When the user types `@`, it shows a list of collaborators.
 */
export function mentionAutocomplete(getCollaborators: () => MentionOption[]): Extension {
  return autocompletion({
    override: [
      (context: CompletionContext) => {
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
    ]
  })
}
