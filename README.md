# bbboard

Infinite canvas meets connected notebooks. A desktop app that combines Miro-style boards with Obsidian-style markdown notebooks, powered by GitHub for sync and collaboration.

## Features

- **Infinite Canvas** — Pan, zoom, draw, add shapes, sticky notes, and freehand drawings (powered by tldraw)
- **Markdown Notebooks** — Create notebook nodes on the canvas with full markdown editing (CodeMirror 6)
- **Wikilinks** — Link notebooks together with `[[wikilinks]]` syntax, with autocomplete and click-to-navigate
- **Graph View** — Visualize connections between notebooks in an Obsidian-style force-directed graph
- **Local-first** — Everything saves to your file system as `.md` and `.json` files
- **GitHub Sync** — One repo per workspace, push/pull with a click
- **Sharing** — Invite collaborators via GitHub, clone shared workspaces
- **Comments** — Board-level discussions powered by GitHub Issues
- **Search** — Full-text search across all notebooks (Cmd+P)
- **Dark/Light Theme** — Toggle in Settings

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+N | New notebook |
| Cmd+P | Search notebooks |
| Cmd+B | Toggle sidebar |
| Cmd+\\ | Toggle sidebar |

## GitHub Setup

1. Create a [GitHub OAuth App](https://github.com/settings/developers)
2. Set callback URL to `http://localhost`
3. Copy the Client ID
4. Open Settings in bbboard and paste the Client ID
5. Click "Connect GitHub Account" and follow the device flow

## Workspace Structure

Each workspace is a directory (and a git repo):

```
my-workspace/
  .bbboard/
    config.json
  boards/
    board-abc.json
  notebooks/
    note-123.md
    note-456.md
    assets/
```

Notebook `.md` files are standard markdown with YAML frontmatter — fully compatible with Obsidian, VS Code, or any text editor.

## Tech Stack

- **Electron** — Desktop shell
- **React + TypeScript** — Frontend
- **tldraw** — Infinite canvas engine
- **CodeMirror 6** — Markdown editor
- **Zustand** — State management
- **simple-git** — Git operations
- **Octokit** — GitHub API
- **d3-force** — Graph visualization
