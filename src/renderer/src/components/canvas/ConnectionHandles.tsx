import { useEditor, useValue, TLShapeId, TLArrowShape } from 'tldraw'
import { useCallback, useRef, useState } from 'react'

interface ConnectionHandlesProps {
  shapeId: TLShapeId
  width: number
  height: number
}

const HANDLE_SIZE = 10
const HANDLE_COLOR = '#4dabf7'
const HANDLE_HOVER_COLOR = '#228be6'

interface HandlePosition {
  cx: number
  cy: number
  anchorX: number // normalized 0–1
  anchorY: number // normalized 0–1
}

function getHandlePositions(w: number, h: number): HandlePosition[] {
  return [
    { cx: w / 2, cy: -1, anchorX: 0.5, anchorY: 0 },       // top
    { cx: w + 1, cy: h / 2, anchorX: 1, anchorY: 0.5 },     // right
    { cx: w / 2, cy: h + 1, anchorX: 0.5, anchorY: 1 },     // bottom
    { cx: -1, cy: h / 2, anchorX: 0, anchorY: 0.5 }          // left
  ]
}

export default function ConnectionHandles({
  shapeId,
  width,
  height
}: ConnectionHandlesProps): JSX.Element | null {
  const editor = useEditor()
  const [hoveredHandle, setHoveredHandle] = useState<number | null>(null)
  const arrowIdRef = useRef<TLShapeId | null>(null)
  const isDraggingRef = useRef(false)

  // Only show handles when this shape is hovered or selected (not when editing)
  const isSelected = useValue(
    'isSelected',
    () => editor.getSelectedShapeIds().includes(shapeId),
    [editor, shapeId]
  )
  const isHovered = useValue(
    'isHovered',
    () => editor.getHoveredShapeId() === shapeId,
    [editor, shapeId]
  )
  const isEditing = useValue(
    'isEditing',
    () => editor.getEditingShapeId() === shapeId,
    [editor, shapeId]
  )

  const showHandles = (isSelected || isHovered || isDraggingRef.current) && !isEditing

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, anchorX: number, anchorY: number) => {
      e.stopPropagation()
      e.preventDefault()

      const sourcePageBounds = editor.getShapePageBounds(shapeId)
      if (!sourcePageBounds) return

      // Calculate the starting point in page space
      const startX = sourcePageBounds.x + anchorX * sourcePageBounds.w
      const startY = sourcePageBounds.y + anchorY * sourcePageBounds.h

      // Create an arrow shape at the handle position
      const arrowId = `shape:arrow_${Date.now()}` as TLShapeId
      arrowIdRef.current = arrowId
      isDraggingRef.current = true

      editor.createShape<TLArrowShape>({
        id: arrowId,
        type: 'arrow',
        x: startX,
        y: startY,
        props: {
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 }
        }
      })

      // Bind the start terminal to the source shape
      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: shapeId,
        props: {
          terminal: 'start',
          normalizedAnchor: { x: anchorX, y: anchorY },
          isExact: false,
          isPrecise: true,
          snap: 'edge-point'
        }
      })

      // Capture the pointer for drag tracking
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [editor, shapeId]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current || !arrowIdRef.current) return

      // Convert screen coordinates to page coordinates
      const point = editor.screenToPage({ x: e.clientX, y: e.clientY })
      const arrowShape = editor.getShape<TLArrowShape>(arrowIdRef.current)
      if (!arrowShape) return

      // Update the arrow's end point relative to its origin
      const dx = point.x - arrowShape.x
      const dy = point.y - arrowShape.y

      editor.updateShape<TLArrowShape>({
        id: arrowIdRef.current,
        type: 'arrow',
        props: {
          end: { x: dx, y: dy }
        }
      })
    },
    [editor]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current || !arrowIdRef.current) return

      isDraggingRef.current = false
      const arrowId = arrowIdRef.current
      arrowIdRef.current = null

      // Check if the pointer is over a shape we can bind to
      const point = editor.screenToPage({ x: e.clientX, y: e.clientY })
      const shapesAtPoint = editor.getShapesAtPoint(point, { hitInside: true, margin: 0 })
      const targetShape = shapesAtPoint.find(
        (s) => s.id !== shapeId && s.type !== 'arrow'
      )

      if (targetShape) {
        // Bind the end terminal to the target shape
        const targetBounds = editor.getShapePageBounds(targetShape.id)
        if (targetBounds) {
          const normX = (point.x - targetBounds.x) / targetBounds.w
          const normY = (point.y - targetBounds.y) / targetBounds.h
          editor.createBinding({
            type: 'arrow',
            fromId: arrowId,
            toId: targetShape.id,
            props: {
              terminal: 'end',
              normalizedAnchor: { x: Math.max(0, Math.min(1, normX)), y: Math.max(0, Math.min(1, normY)) },
              isExact: false,
              isPrecise: false,
              snap: 'edge-point'
            }
          })
        }
      } else {
        // No target shape — delete the arrow (don't leave dangling arrows)
        editor.deleteShape(arrowId)
      }

      // Switch back to select tool
      editor.setCurrentTool('select')
    },
    [editor, shapeId]
  )

  if (!showHandles) return null

  const handles = getHandlePositions(width, height)

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none'
      }}
    >
      {handles.map((handle, i) => (
        <div
          key={i}
          onPointerDown={(e) => handlePointerDown(e, handle.anchorX, handle.anchorY)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerEnter={() => setHoveredHandle(i)}
          onPointerLeave={() => { if (!isDraggingRef.current) setHoveredHandle(null) }}
          style={{
            position: 'absolute',
            left: handle.cx - HANDLE_SIZE / 2,
            top: handle.cy - HANDLE_SIZE / 2,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            borderRadius: '50%',
            background: hoveredHandle === i ? HANDLE_HOVER_COLOR : HANDLE_COLOR,
            border: '2px solid white',
            cursor: 'crosshair',
            pointerEvents: 'all',
            opacity: hoveredHandle === i ? 1 : 0.7,
            transition: 'opacity 0.15s, background 0.15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            zIndex: 100
          }}
        />
      ))}
    </div>
  )
}
