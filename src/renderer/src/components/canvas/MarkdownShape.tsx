import {
  Geometry2d,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  ShapeUtil,
  T,
  TLResizeInfo,
  TLShape,
  resizeBox,
  useIsEditing,
  useEditor
} from 'tldraw'
import { autocompletion } from '@codemirror/autocomplete'
import { renderMarkdown } from '../../lib/markdown'
import MarkdownEditor from '../editor/MarkdownEditor'
import { wikilinkCompletionSource } from '../editor/WikilinkPlugin'
import { mentionCompletionSource } from '../editor/MentionPlugin'
import { resolveWikilink, parseWikilinks, type NotebookInfo } from '../../lib/wikilinks'
import { useCollaborators, useRepoFullName } from '../../lib/collaborators-context'
import { notifyMentions } from '../../lib/mentions'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import ConnectionHandles from './ConnectionHandles'

// --- Shape type registration ---

export const MARKDOWN_NOTEBOOK_TYPE = 'markdown-notebook' as const

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'markdown-notebook': {
      w: number
      h: number
      notebookId: string
      title: string
      markdown: string
    }
  }
}

export type MarkdownNotebookShape = TLShape<typeof MARKDOWN_NOTEBOOK_TYPE>

// --- Shape Util ---

export class MarkdownNotebookUtil extends ShapeUtil<MarkdownNotebookShape> {
  static override type = MARKDOWN_NOTEBOOK_TYPE

  static override props: RecordProps<MarkdownNotebookShape> = {
    w: T.number,
    h: T.number,
    notebookId: T.string,
    title: T.string,
    markdown: T.string
  }

  getDefaultProps(): MarkdownNotebookShape['props'] {
    return {
      w: 320,
      h: 400,
      notebookId: '',
      title: 'Untitled',
      markdown: '# Untitled\n\nStart writing...'
    }
  }

  override canEdit(): boolean {
    return true
  }

  override canResize(): boolean {
    return true
  }

  override isAspectRatioLocked(): boolean {
    return false
  }

  getGeometry(shape: MarkdownNotebookShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true
    })
  }

  override onResize(shape: MarkdownNotebookShape, info: TLResizeInfo<MarkdownNotebookShape>) {
    return resizeBox(shape, info)
  }

  component(shape: MarkdownNotebookShape) {
    return <MarkdownNotebookComponent shape={shape} />
  }

  indicator(shape: MarkdownNotebookShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />
  }
}

// --- Component ---

function MarkdownNotebookComponent({ shape }: { shape: MarkdownNotebookShape }): JSX.Element {
  const isEditing = useIsEditing(shape.id)
  const editor = useEditor()

  const rendered = useMemo(() => {
    if (isEditing) return null
    return renderMarkdown(shape.props.markdown)
  }, [shape.props.markdown, isEditing])

  // Get all notebooks for wikilink autocomplete
  const getNotebooks = useCallback(() => {
    const allShapes = editor.getCurrentPageShapes()
    return allShapes
      .filter(
        (s): s is MarkdownNotebookShape =>
          s.type === MARKDOWN_NOTEBOOK_TYPE && s.id !== shape.id
      )
      .map((s) => ({
        notebookId: s.props.notebookId,
        title: s.props.title
      }))
  }, [editor, shape.id])

  // Mention autocomplete: read collaborators from context (set at Board level)
  const collaborators = useCollaborators()
  const repoFullName = useRepoFullName()
  const getCollaborators = useCallback(() => collaborators, [collaborators])

  // Single combined autocompletion extension with both wikilink and mention sources
  const autocompleteExt = useMemo(() => {
    return autocompletion({
      override: [
        wikilinkCompletionSource(getNotebooks),
        mentionCompletionSource(getCollaborators)
      ]
    })
  }, [getNotebooks, getCollaborators])

  // Track the text snapshot from when editing started
  const textOnEditStartRef = useRef(shape.props.markdown)
  const wasEditingRef = useRef(false)

  const handleChange = useCallback(
    (value: string) => {
      editor.updateShape<MarkdownNotebookShape>({
        id: shape.id,
        type: MARKDOWN_NOTEBOOK_TYPE,
        props: {
          markdown: value,
          title: extractTitle(value)
        }
      })
    },
    [editor, shape.id]
  )

  // When user finishes editing (isEditing goes from true → false),
  // check for new @mentions and create GitHub issue notifications
  useEffect(() => {
    if (isEditing) {
      textOnEditStartRef.current = shape.props.markdown
      wasEditingRef.current = true
    } else if (wasEditingRef.current) {
      wasEditingRef.current = false
      const prevText = textOnEditStartRef.current
      const currentText = shape.props.markdown

      if (prevText !== currentText) {
        notifyMentions(
          currentText,
          prevText,
          `notebook: ${extractTitle(currentText)}`,
          repoFullName
        )
      }
    }
  }, [isEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle wikilink click in preview mode (use pointerdown to avoid tldraw intercepting clicks)
  const handleWikilinkPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = (e.target as HTMLElement).closest('.wikilink') as HTMLElement | null
      if (!target) return

      e.preventDefault()
      e.stopPropagation()

      const wikilinkTarget = target.dataset.target
      if (!wikilinkTarget) return

      // Find the target notebook shape
      const allShapes = editor.getCurrentPageShapes()
      const notebooks: NotebookInfo[] = allShapes
        .filter(
          (s): s is MarkdownNotebookShape => s.type === MARKDOWN_NOTEBOOK_TYPE
        )
        .map((s) => ({
          shapeId: s.id,
          notebookId: s.props.notebookId,
          title: s.props.title
        }))

      const resolved = resolveWikilink(wikilinkTarget, notebooks)
      if (resolved) {
        editor.select(resolved.shapeId as any)
        const targetShape = editor.getShape(resolved.shapeId as any)
        if (targetShape) {
          const bounds = editor.getShapePageBounds(targetShape)
          if (bounds) {
            editor.centerOnPoint(
              { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 },
              { animation: { duration: 300 } }
            )
          }
        }
      }
    },
    [editor]
  )

  // Count outgoing wikilinks for the badge
  const linkCount = useMemo(() => {
    return parseWikilinks(shape.props.markdown).length
  }, [shape.props.markdown])

  return (
    <HTMLContainer
      style={{
        width: shape.props.w,
        height: shape.props.h,
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#1e1e1e',
        border: '1px solid #333',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        pointerEvents: 'all'
      }}
    >
      {/* Title bar */}
      <div
        style={{
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          color: '#aaa',
          background: '#252525',
          borderBottom: '1px solid #333',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          userSelect: 'none'
        }}
      >
        <span style={{ opacity: 0.5 }}>&#9783;</span>
        <span style={{ flex: 1 }}>{shape.props.title || 'Untitled'}</span>
        {linkCount > 0 && (
          <span
            style={{
              fontSize: 10,
              color: '#a78bfa',
              background: 'rgba(167, 139, 250, 0.15)',
              padding: '1px 6px',
              borderRadius: 8
            }}
          >
            {linkCount} link{linkCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative'
        }}
      >
        {isEditing ? (
          <MarkdownEditor
            initialValue={shape.props.markdown}
            onChange={handleChange}
            autoFocus
            extensions={[autocompleteExt]}
          />
        ) : (
          <div
            className="markdown-preview"
            style={{
              padding: 12,
              fontSize: 13,
              lineHeight: 1.6,
              color: '#e0e0e0',
              wordWrap: 'break-word'
            }}
            onPointerDown={handleWikilinkPointerDown}
            dangerouslySetInnerHTML={{ __html: rendered?.html || '' }}
          />
        )}
      </div>
      <ConnectionHandles shapeId={shape.id} width={shape.props.w} height={shape.props.h} />
    </HTMLContainer>
  )
}

function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : 'Untitled'
}
