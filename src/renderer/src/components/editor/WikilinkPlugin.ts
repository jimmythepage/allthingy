import { CompletionContext, autocompletion } from '@codemirror/autocomplete'
import { Extension } from '@codemirror/state'

export interface NotebookOption {
  notebookId: string
  title: string
}

/**
 * Creates a CodeMirror extension that provides autocomplete for [[wikilinks]].
 * When the user types `[[`, it shows a list of available notebooks.
 */
export function wikilinkAutocomplete(getNotebooks: () => NotebookOption[]): Extension {
  return autocompletion({
    override: [
      (context: CompletionContext) => {
        // Look for [[ pattern before cursor
        const before = context.matchBefore(/\[\[[^\]]*/)
        if (!before) return null

        // The query is everything after [[
        const query = before.text.slice(2).toLowerCase()
        const notebooks = getNotebooks()

        const options = notebooks
          .filter((n) => {
            if (!query) return true
            return (
              n.title.toLowerCase().includes(query) ||
              n.notebookId.toLowerCase().includes(query)
            )
          })
          .map((n) => ({
            label: n.title,
            detail: n.notebookId,
            apply: `[[${n.notebookId}|${n.title}]]`,
            type: 'text' as const
          }))

        return {
          from: before.from,
          options,
          filter: false
        }
      }
    ]
  })
}
