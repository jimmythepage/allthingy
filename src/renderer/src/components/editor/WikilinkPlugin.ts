import { CompletionContext, type CompletionResult } from '@codemirror/autocomplete'

export interface NotebookOption {
  notebookId: string
  title: string
}

/**
 * Returns a raw completion source function for [[wikilinks]].
 * To be combined with other sources in a single autocompletion() call.
 */
export function wikilinkCompletionSource(getNotebooks: () => NotebookOption[]) {
  return (context: CompletionContext): CompletionResult | null => {
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
}
