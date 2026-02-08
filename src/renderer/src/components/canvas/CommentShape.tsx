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
import { useCallback, useRef, useEffect } from 'react'

// --- Shape type registration ---

export const COMMENT_SHAPE_TYPE = 'board-comment' as const

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'board-comment': {
      w: number
      h: number
      text: string
      author: string
    }
  }
}

export type CommentShape = TLShape<typeof COMMENT_SHAPE_TYPE>

// --- Shape Util ---

export class CommentShapeUtil extends ShapeUtil<CommentShape> {
  static override type = COMMENT_SHAPE_TYPE

  static override props: RecordProps<CommentShape> = {
    w: T.number,
    h: T.number,
    text: T.string,
    author: T.string
  }

  getDefaultProps(): CommentShape['props'] {
    return {
      w: 220,
      h: 120,
      text: '',
      author: 'You'
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      )
    }
  }, [isEditing])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      editor.updateShape<CommentShape>({
        id: shape.id,
        type: COMMENT_SHAPE_TYPE,
        props: {
          text: e.target.value
        }
      })
    },
    [editor, shape.id]
  )

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
        background: '#2d2418',
        border: '1px solid #5c4a2a',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        pointerEvents: 'all'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '6px 10px',
          fontSize: 11,
          color: '#c9a84c',
          background: '#362d1a',
          borderBottom: '1px solid #5c4a2a',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          userSelect: 'none'
        }}
      >
        <span style={{ fontWeight: 600 }}>{shape.props.author}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#8a7340' }}>
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
          <textarea
            ref={textareaRef}
            value={shape.props.text}
            onChange={handleChange}
            placeholder="Write a comment..."
            style={{
              width: '100%',
              height: '100%',
              padding: '8px 10px',
              fontSize: 12,
              lineHeight: 1.5,
              color: '#e0d6c0',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit'
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            style={{
              padding: '8px 10px',
              fontSize: 12,
              lineHeight: 1.5,
              color: '#e0d6c0',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}
          >
            {shape.props.text || (
              <span style={{ color: '#8a7340', fontStyle: 'italic' }}>
                Double-click to add a comment...
              </span>
            )}
          </div>
        )}
      </div>
    </HTMLContainer>
  )
}
