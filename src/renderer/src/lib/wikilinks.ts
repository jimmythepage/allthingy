/**
 * Parse all [[wikilinks]] from a markdown string.
 * Returns an array of { target, label, start, end } objects.
 */
export interface WikilinkMatch {
  target: string
  label: string
  start: number
  end: number
}

export function parseWikilinks(text: string): WikilinkMatch[] {
  const results: WikilinkMatch[] = []
  const regex = /\[\[([^\]]+)\]\]/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const content = match[1]
    const parts = content.split('|')
    const target = parts[0].trim()
    const label = (parts[1] || parts[0]).trim()
    results.push({
      target,
      label,
      start: match.index,
      end: match.index + match[0].length
    })
  }

  return results
}

/**
 * Given a map of notebookId -> shape info, resolve wikilinks to shape IDs.
 * Wikilink targets can match by notebookId or title.
 */
export interface NotebookInfo {
  shapeId: string
  notebookId: string
  title: string
}

export function resolveWikilink(
  target: string,
  notebooks: NotebookInfo[]
): NotebookInfo | undefined {
  // First try exact ID match
  const byId = notebooks.find((n) => n.notebookId === target)
  if (byId) return byId

  // Then try title match (case-insensitive)
  const lowerTarget = target.toLowerCase()
  const byTitle = notebooks.find((n) => n.title.toLowerCase() === lowerTarget)
  if (byTitle) return byTitle

  return undefined
}

/**
 * Build a map of connections between notebooks based on wikilinks.
 * Returns pairs of [sourceShapeId, targetShapeId].
 */
export function buildConnectionMap(
  notebooks: Array<{
    shapeId: string
    notebookId: string
    title: string
    markdown: string
  }>
): Array<[string, string]> {
  const connections: Array<[string, string]> = []
  const infoList: NotebookInfo[] = notebooks.map((n) => ({
    shapeId: n.shapeId,
    notebookId: n.notebookId,
    title: n.title
  }))

  for (const notebook of notebooks) {
    const links = parseWikilinks(notebook.markdown)
    for (const link of links) {
      const resolved = resolveWikilink(link.target, infoList)
      if (resolved && resolved.shapeId !== notebook.shapeId) {
        connections.push([notebook.shapeId, resolved.shapeId])
      }
    }
  }

  return connections
}
