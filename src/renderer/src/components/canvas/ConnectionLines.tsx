import { useEditor, useValue } from 'tldraw'
import { useMemo } from 'react'
import { buildConnectionMap } from '../../lib/wikilinks'
import { MARKDOWN_NOTEBOOK_TYPE, type MarkdownNotebookShape } from './MarkdownShape'

/**
 * Renders SVG lines between notebooks that are linked via [[wikilinks]].
 * Rendered via OnTheCanvas, which is already in tldraw's page coordinate space —
 * no camera transform needed.
 */
export function ConnectionLines(): JSX.Element | null {
  const editor = useEditor()

  // Track all notebook shapes reactively
  const shapes = useValue(
    'notebook-shapes',
    () => {
      return editor
        .getCurrentPageShapes()
        .filter(
          (s): s is MarkdownNotebookShape => s.type === MARKDOWN_NOTEBOOK_TYPE
        )
    },
    [editor]
  )

  const connections = useMemo(() => {
    const notebooks = shapes.map((s) => ({
      shapeId: s.id,
      notebookId: s.props.notebookId,
      title: s.props.title,
      markdown: s.props.markdown,
      x: s.x,
      y: s.y,
      w: s.props.w,
      h: s.props.h
    }))

    const links = buildConnectionMap(notebooks)

    return links
      .map(([sourceId, targetId]) => {
        const source = notebooks.find((n) => n.shapeId === sourceId)
        const target = notebooks.find((n) => n.shapeId === targetId)
        if (!source || !target) return null

        // Center of source
        const sx = source.x + source.w / 2
        const sy = source.y + source.h / 2
        // Center of target
        const tx = target.x + target.w / 2
        const ty = target.y + target.h / 2

        return { sx, sy, tx, ty, sourceId, targetId }
      })
      .filter(Boolean) as Array<{
      sx: number
      sy: number
      tx: number
      ty: number
      sourceId: string
      targetId: string
    }>
  }, [shapes])

  if (connections.length === 0) return null

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 0
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="rgba(167, 139, 250, 0.5)" />
        </marker>
      </defs>
      {connections.map((conn, i) => (
        <line
          key={`${conn.sourceId}-${conn.targetId}-${i}`}
          x1={conn.sx}
          y1={conn.sy}
          x2={conn.tx}
          y2={conn.ty}
          stroke="rgba(167, 139, 250, 0.35)"
          strokeWidth={2}
          strokeDasharray="6 4"
          markerEnd="url(#arrowhead)"
        />
      ))}
    </svg>
  )
}
