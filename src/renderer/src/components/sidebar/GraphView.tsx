import { useRef, useEffect, useMemo, useCallback } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum
} from 'd3-force'
import { parseWikilinks, resolveWikilink, type NotebookInfo } from '../../lib/wikilinks'

interface GraphNode extends SimulationNodeDatum {
  id: string
  notebookId: string
  title: string
  linkCount: number
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string
  target: string
}

interface NotebookData {
  shapeId: string
  notebookId: string
  title: string
  markdown: string
}

interface GraphViewProps {
  notebooks: NotebookData[]
  onSelectNotebook: (shapeId: string) => void
  selectedId?: string | null
}

export default function GraphView({
  notebooks,
  onSelectNotebook,
  selectedId
}: GraphViewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const linksRef = useRef<GraphLink[]>([])
  const animFrameRef = useRef<number>(0)
  const hoveredRef = useRef<string | null>(null)

  // Build graph data
  const { nodes, links } = useMemo(() => {
    const infoList: NotebookInfo[] = notebooks.map((n) => ({
      shapeId: n.shapeId,
      notebookId: n.notebookId,
      title: n.title
    }))

    const graphNodes: GraphNode[] = notebooks.map((n) => ({
      id: n.shapeId,
      notebookId: n.notebookId,
      title: n.title,
      linkCount: parseWikilinks(n.markdown).length
    }))

    const graphLinks: GraphLink[] = []
    for (const notebook of notebooks) {
      const wikilinks = parseWikilinks(notebook.markdown)
      for (const link of wikilinks) {
        const resolved = resolveWikilink(link.target, infoList)
        if (resolved && resolved.shapeId !== notebook.shapeId) {
          graphLinks.push({
            source: notebook.shapeId,
            target: resolved.shapeId
          })
        }
      }
    }

    return { nodes: graphNodes, links: graphLinks }
  }, [notebooks])

  // Run simulation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const width = canvas.offsetWidth
    const height = canvas.offsetHeight
    canvas.width = width * 2
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(2, 2)

    // Copy nodes so d3 can mutate them
    const simNodes = nodes.map((n) => ({ ...n }))
    const simLinks = links.map((l) => ({ ...l }))
    nodesRef.current = simNodes
    linksRef.current = simLinks

    const simulation = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
      )
      .force('charge', forceManyBody().strength(-150))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide(25))

    function draw(): void {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)

      // Draw links
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.25)'
      ctx.lineWidth = 1
      for (const link of simLinks) {
        const source = link.source as GraphNode
        const target = link.target as GraphNode
        if (source.x == null || source.y == null || target.x == null || target.y == null) continue
        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.stroke()
      }

      // Draw nodes
      for (const node of simNodes) {
        if (node.x == null || node.y == null) continue
        const isSelected = node.id === selectedId
        const isHovered = node.id === hoveredRef.current
        const radius = 6 + Math.min(node.linkCount * 2, 10)

        ctx.beginPath()
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = isSelected
          ? '#4f8ff7'
          : isHovered
            ? '#a78bfa'
            : '#555'
        ctx.fill()

        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? '#4f8ff7' : '#a78bfa'
          ctx.lineWidth = 2
          ctx.stroke()
        }

        // Label
        ctx.fillStyle = isSelected || isHovered ? '#e0e0e0' : '#888'
        ctx.font = '11px -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(
          node.title.length > 20 ? node.title.slice(0, 18) + '...' : node.title,
          node.x,
          node.y + radius + 14
        )
      }
    }

    simulation.on('tick', () => {
      draw()
    })

    // Also do an initial draw after simulation settles
    setTimeout(() => draw(), 100)

    // Mouse interaction
    function getNodeAt(mx: number, my: number): GraphNode | null {
      const rect = canvas!.getBoundingClientRect()
      const x = mx - rect.left
      const y = my - rect.top

      for (const node of simNodes) {
        if (node.x == null || node.y == null) continue
        const radius = 6 + Math.min(node.linkCount * 2, 10)
        const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2)
        if (dist <= radius + 4) return node
      }
      return null
    }

    function handleMouseMove(e: MouseEvent): void {
      const node = getNodeAt(e.clientX, e.clientY)
      hoveredRef.current = node?.id || null
      canvas!.style.cursor = node ? 'pointer' : 'default'
      draw()
    }

    function handleClick(e: MouseEvent): void {
      const node = getNodeAt(e.clientX, e.clientY)
      if (node) {
        onSelectNotebook(node.id)
      }
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('click', handleClick)

    return () => {
      simulation.stop()
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('click', handleClick)
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [nodes, links, selectedId, onSelectNotebook])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  )
}
