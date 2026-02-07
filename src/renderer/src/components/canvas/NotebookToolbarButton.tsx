import { useEditor, useIsToolSelected } from 'tldraw'

export function NotebookToolbarButton(): JSX.Element {
  const editor = useEditor()
  const isSelected = useIsToolSelected(editor.getSelectedTool(), 'markdown-notebook')

  return (
    <button
      data-isactive={isSelected}
      onClick={() => editor.setCurrentTool('markdown-notebook')}
      title="Add Markdown Notebook"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 6,
        background: isSelected ? 'var(--accent)' : 'transparent',
        color: isSelected ? '#fff' : 'var(--text-secondary)',
        border: 'none',
        cursor: 'pointer',
        fontSize: 16,
        transition: 'all 150ms ease'
      }}
    >
      &#9776;
    </button>
  )
}
