'use client'

import React, { useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { WorkflowNode, NodeStatus } from '@/lib/types'

interface ReleaseGraphProps {
  nodes: WorkflowNode[]
  selectedNodeId?: string
  onNodeSelect?: (nodeId: string) => void
}

export function ReleaseGraph({
  nodes,
  selectedNodeId,
  onNodeSelect,
}: ReleaseGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const nodeStatusColors = {
    success: 'oklch(0.65 0.20 142)',
    failed: 'oklch(0.62 0.22 27)',
    running: 'oklch(0.60 0.20 264)',
    pending: 'oklch(0.40 0.05 0)',
    blocked: 'oklch(0.62 0.22 27)',
    waiting: 'oklch(0.70 0.20 48)',
  } as Record<NodeStatus, string>

  const links = useMemo(() => {
    const linkArray: Array<{ source: string; target: string }> = []
    nodes.forEach((node) => {
      node.dependencies.forEach((dep) => {
        linkArray.push({ source: dep, target: node.id })
      })
    })
    return linkArray
  }, [nodes])

  useEffect(() => {
    if (!svgRef.current) return

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove()

    // Create simulation
    const simulation = d3
      .forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(50))

    // Create SVG
    const svg = d3.select(svgRef.current)

    // Add arrow markers for links
    svg
      .append('defs')
      .selectAll('marker')
      .data(['arrowhead'])
      .enter()
      .append('marker')
      .attr('id', (d) => d)
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 28)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', 'oklch(1 0 0 / 20%)')

    // Create group for links
    const linkGroup = svg.append('g').attr('class', 'links')

    const link = linkGroup
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', 'oklch(1 0 0 / 20%)')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)')

    // Create group for nodes
    const nodeGroup = svg.append('g').attr('class', 'nodes')

    const node = nodeGroup
      .selectAll('g')
      .data(nodes as any)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(drag(simulation) as any)

    // Add circles for nodes
    node
      .append('circle')
      .attr('r', 28)
      .attr('fill', (d: WorkflowNode) => nodeStatusColors[d.status])
      .attr('stroke', (d: WorkflowNode) =>
        d.id === selectedNodeId ? 'oklch(0.95 0 0)' : 'oklch(1 0 0 / 30%)'
      )
      .attr('stroke-width', (d: WorkflowNode) => (d.id === selectedNodeId ? 3 : 2))
      .style('cursor', 'pointer')
      .on('click', (_, d: WorkflowNode) => onNodeSelect?.(d.id))

    // Add status badge
    node
      .append('text')
      .attr('class', 'status-badge')
      .attr('text-anchor', 'middle')
      .attr('dy', '.3em')
      .attr('fill', (d: WorkflowNode) => {
        if (d.status === 'success') return 'oklch(0.12 0 0)'
        if (d.status === 'failed' || d.status === 'blocked') return 'oklch(0.95 0 0)'
        return 'oklch(0.95 0 0)'
      })
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text((d: WorkflowNode) => {
        const statusMap = {
          success: '✓',
          failed: '✕',
          running: '◆',
          pending: '○',
          blocked: '✕',
          waiting: '⏸',
        }
        return statusMap[d.status]
      })

    // Add labels
    node
      .append('text')
      .attr('class', 'label')
      .attr('text-anchor', 'middle')
      .attr('dy', '2.8em')
      .attr('fill', 'oklch(0.95 0 0)')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text((d: WorkflowNode) => d.label)

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [nodes, links, selectedNodeId, onNodeSelect])

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-card rounded-lg border border-border"
      style={{ minHeight: '400px' }}
    />
  )
}

function drag(simulation: any) {
  function dragstarted(event: any) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    event.subject.fx = event.subject.x
    event.subject.fy = event.subject.y
  }

  function dragged(event: any) {
    event.subject.fx = event.x
    event.subject.fy = event.y
  }

  function dragended(event: any) {
    if (!event.active) simulation.alphaTarget(0)
    event.subject.fx = null
    event.subject.fy = null
  }

  return d3
    .drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended)
}
