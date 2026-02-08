import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true
})

// Custom rule: transform [[wikilinks]] into clickable links
md.inline.ruler.push('wikilink', (state) => {
  const src = state.src
  const pos = state.pos

  if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) {
    return false
  }

  const closePos = src.indexOf(']]', pos + 2)
  if (closePos === -1) return false

  const content = src.slice(pos + 2, closePos)
  const parts = content.split('|')
  const target = parts[0].trim()
  const label = (parts[1] || parts[0]).trim()

  if (!state.env.wikilinks) {
    state.env.wikilinks = []
  }
  state.env.wikilinks.push(target)

  const token = state.push('wikilink', '', 0)
  token.content = label
  token.meta = { target }
  state.pos = closePos + 2

  return true
})

md.renderer.rules.wikilink = (tokens, idx) => {
  const token = tokens[idx]
  const target = token.meta.target
  const label = token.content
  return `<a class="wikilink" data-target="${target}" href="#">${label}</a>`
}

// Custom rule: transform @mentions into styled spans
md.inline.ruler.push('mention', (state) => {
  const src = state.src
  const pos = state.pos

  // Must start with @ and be preceded by start-of-line or whitespace
  if (src.charCodeAt(pos) !== 0x40) return false // @
  if (pos > 0) {
    const prev = src.charCodeAt(pos - 1)
    // Must be preceded by whitespace, newline, or start of string
    if (prev !== 0x20 && prev !== 0x0a && prev !== 0x0d && prev !== 0x28 && prev !== 0x5b) {
      return false
    }
  }

  // Match username pattern: @[a-zA-Z0-9_-]+
  const match = src.slice(pos).match(/^@([a-zA-Z0-9_-]+)/)
  if (!match) return false

  const username = match[1]

  const token = state.push('mention', '', 0)
  token.content = username
  state.pos = pos + match[0].length

  return true
})

md.renderer.rules.mention = (tokens, idx) => {
  const username = tokens[idx].content
  return `<span class="mention" data-username="${username}">@${username}</span>`
}

export function renderMarkdown(content: string): { html: string; wikilinks: string[] } {
  const env: { wikilinks?: string[] } = {}
  const html = md.render(content, env)
  return { html, wikilinks: env.wikilinks || [] }
}

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const rawFrontmatter = match[1]
  const body = match[2]

  // Simple YAML-like parser for frontmatter
  const frontmatter: Record<string, unknown> = {}
  for (const line of rawFrontmatter.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let value: unknown = line.slice(colonIdx + 1).trim()

    // Parse arrays
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
    }
    // Unquote strings
    if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }

    frontmatter[key] = value
  }

  return { frontmatter, body }
}

export function buildFrontmatter(meta: Record<string, unknown>): string {
  const lines = ['---']
  for (const [key, value] of Object.entries(meta)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(', ')}]`)
    } else if (typeof value === 'string' && (value.includes(':') || value.includes('"'))) {
      lines.push(`${key}: "${value}"`)
    } else {
      lines.push(`${key}: ${value}`)
    }
  }
  lines.push('---')
  return lines.join('\n')
}

export function buildNotebookContent(
  meta: Record<string, unknown>,
  body: string
): string {
  return `${buildFrontmatter(meta)}\n${body}`
}
