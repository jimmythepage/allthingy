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
import { mentionCompletionSource } from '../editor/MentionPlugin'
import { useCollaborators, useRepoFullName } from '../../lib/collaborators-context'
import { renderMarkdown } from '../../lib/markdown'
import { notifyMentions, updateLinkedIssues } from '../../lib/mentions'
import MarkdownEditor from '../editor/MarkdownEditor'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import ConnectionHandles from './ConnectionHandles'

// --- Shape type registration ---

export const COMMENT_SHAPE_TYPE = 'board-comment' as const

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'board-comment': {
      w: number
      h: number
      text: string
      author: string
      resolved: boolean
      linkedIssueNumbers: string
    }
  }
}

export type CommentShape = TLShape<typeof COMMENT_SHAPE_TYPE>

// Helper to parse/serialize the issue numbers (stored as JSON string for tldraw compat)
function parseIssueNumbers(s: string): number[] {
  try {
    const arr = JSON.parse(s || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function serializeIssueNumbers(nums: number[]): string {
  return JSON.stringify(nums)
}

// --- Shape Util ---

export class CommentShapeUtil extends ShapeUtil<CommentShape> {
  static override type = COMMENT_SHAPE_TYPE

  static override props: RecordProps<CommentShape> = {
    w: T.number,
    h: T.number,
    text: T.string,
    author: T.string,
    resolved: T.boolean,
    linkedIssueNumbers: T.string
  }

  getDefaultProps(): CommentShape['props'] {
    return {
      w: 220,
      h: 120,
      text: '',
      author: 'You',
      resolved: false,
      linkedIssueNumbers: '[]'
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

  getGeometry(shape: CommentShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true
    })
  }

  override onResize(shape: CommentShape, info: TLResizeInfo<CommentShape>) {
    return resizeBox(shape, info)
  }

  component(shape: CommentShape) {
    return <CommentComponent shape={shape} />
  }

  indicator(shape: CommentShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={6} ry={6} />
  }
}

// --- Component ---

function CommentComponent({ shape }: { shape: CommentShape }): JSX.Element {
  const isEditing = useIsEditing(shape.id)
  const editor = useEditor()
  const resolved = shape.props.resolved

  // Mention autocomplete from context
  const collaborators = useCollaborators()
  const repoFullName = useRepoFullName()
  const getCollaborators = useCallback(() => collaborators, [collaborators])
  const autocompleteExt = useMemo(() => {
    return autocompletion({
      override: [mentionCompletionSource(getCollaborators)]
    })
  }, [getCollaborators])

  // Track the text snapshot from when editing started
  const textOnEditStartRef = useRef(shape.props.text)
  const wasEditingRef = useRef(false)

  const handleChange = useCallback(
    (value: string) => {
      editor.updateShape<CommentShape>({
        id: shape.id,
        type: COMMENT_SHAPE_TYPE,
        props: { text: value }
      })
    },
    [editor, shape.id]
  )

  // When user finishes editing (isEditing goes from true → false),
  // check for new @mentions and create GitHub issue notifications
  useEffect(() => {
    if (isEditing) {
      // Entering edit mode — snapshot the current text
      textOnEditStartRef.current = shape.props.text
      wasEditingRef.current = true
    } else if (wasEditingRef.current) {
      // Just exited edit mode — diff and notify
      wasEditingRef.current = false
      const prevText = textOnEditStartRef.current
      const currentText = shape.props.text

      if (prevText !== currentText) {
        ;(async () => {
          const newIssueNumbers = await notifyMentions(
            currentText,
            prevText,
            `board comment by ${shape.props.author}`,
            repoFullName
          )
          if (newIssueNumbers.length > 0) {
            const existing = parseIssueNumbers(shape.props.linkedIssueNumbers)
            const merged = [...existing, ...newIssueNumbers]
            editor.updateShape<CommentShape>({
              id: shape.id,
              type: COMMENT_SHAPE_TYPE,
              props: { linkedIssueNumbers: serializeIssueNumbers(merged) }
            })
          }
        })()
      }
    }
  }, [isEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleResolved = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const newResolved = !resolved
      editor.updateShape<CommentShape>({
        id: shape.id,
        type: COMMENT_SHAPE_TYPE,
        props: { resolved: newResolved }
      })

      // Close or reopen linked GitHub issues
      const issueNums = parseIssueNumbers(shape.props.linkedIssueNumbers)
      if (issueNums.length > 0) {
        updateLinkedIssues(issueNums, newResolved ? 'closed' : 'open', repoFullName)
      }
    },
    [editor, shape.id, resolved, shape.props.linkedIssueNumbers, repoFullName]
  )

  const rendered = useMemo(() => {
    if (isEditing || !shape.props.text) return null
    return renderMarkdown(shape.props.text)
  }, [shape.props.text, isEditing])

  const timestamp = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  })

  return (
    <HTMLContainer
      style={{
        width: shape.props.w,
        height: shape.props.h,
        borderRadius: 6,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: resolved ? '#1e1e1e' : '#2d2418',
        border: `1px solid ${resolved ? '#333' : '#5c4a2a'}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        pointerEvents: 'all',
        opacity: resolved ? 0.6 : 1
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '6px 10px',
          fontSize: 11,
          color: resolved ? '#666' : '#c9a84c',
          background: resolved ? '#1a1a1a' : '#362d1a',
          borderBottom: `1px solid ${resolved ? '#333' : '#5c4a2a'}`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          userSelect: 'none'
        }}
      >
        {/* Resolve toggle */}
        <span
          onPointerDown={toggleResolved}
          style={{
            cursor: 'pointer',
            fontSize: 13,
            lineHeight: 1,
            opacity: resolved ? 1 : 0.5
          }}
          title={resolved ? 'Reopen comment' : 'Resolve comment'}
        >
          {resolved ? '\u2611' : '\u2610'}
        </span>
        <span
          style={{
            fontWeight: 600,
            textDecoration: resolved ? 'line-through' : 'none'
          }}
        >
          {shape.props.author}
        </span>
        {resolved && (
          <span style={{ fontSize: 9, color: '#4a4', fontWeight: 500 }}>Resolved</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: resolved ? '#555' : '#8a7340' }}>
          {timestamp}
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative'
        }}
      >
        {isEditing ? (
          <MarkdownEditor
            initialValue={shape.props.text}
            onChange={handleChange}
            autoFocus
            placeholder="Write a comment..."
            extensions={[autocompleteExt]}
          />
        ) : (
          <div
            className="markdown-preview"
            style={{
              padding: '8px 10px',
              fontSize: 12,
              lineHeight: 1.5,
              color: resolved ? '#888' : '#e0d6c0',
              textDecoration: resolved ? 'line-through' : 'none',
              wordWrap: 'break-word'
            }}
          >
            {rendered ? (
              <span dangerouslySetInnerHTML={{ __html: rendered.html }} />
            ) : (
              <span style={{ color: '#8a7340', fontStyle: 'italic' }}>
                Double-click to add a comment...
              </span>
            )}
          </div>
        )}
      </div>
      <ConnectionHandles shapeId={shape.id} width={shape.props.w} height={shape.props.h} />
    </HTMLContainer>
  )
}
