'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ChevronRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface Job {
  id: string;
  name: string;
  stage: number;
  status: 'passed' | 'failed' | 'pending' | 'running';
  duration: number;
  tags: string[];
}

interface Stage {
  number: number;
  name: string;
  jobs: Job[];
}

interface Edge {
  source: string;
  target: string;
}

interface DAGNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  stage: number;
  status: Job['status'];
  duration: number;
  tags: string[];
  x?: number;
  y?: number;
}

interface DAGLink extends d3.SimulationLinkDatum<DAGNode> {
  source: DAGNode | string;
  target: DAGNode | string;
}

const mockStages: Stage[] = [
  {
    number: 1,
    name: 'Build',
    jobs: [
      { id: 'build-1', name: 'Build', stage: 1, status: 'passed', duration: 4, tags: ['Compute', 'Critical'] },
    ],
  },
  {
    number: 2,
    name: 'Risk Checks',
    jobs: [
      { id: 'tests-1', name: 'Unit Tests', stage: 2, status: 'passed', duration: 7, tags: ['Quality'] },
      { id: 'security-1', name: 'Security Scan', stage: 2, status: 'failed', duration: 9, tags: ['Security', 'Critical'] },
    ],
  },
  {
    number: 3,
    name: 'Deployment',
    jobs: [
      { id: 'staging-1', name: 'Deploy Staging', stage: 3, status: 'pending', duration: 5, tags: ['Infrastructure'] },
      { id: 'prod-1', name: 'Deploy Production', stage: 3, status: 'pending', duration: 8, tags: ['Infrastructure'] },
    ],
  },
];

const edges: Edge[] = [
  { source: 'build-1', target: 'tests-1' },
  { source: 'build-1', target: 'security-1' },
  { source: 'tests-1', target: 'staging-1' },
  { source: 'security-1', target: 'staging-1' },
  { source: 'staging-1', target: 'prod-1' },
];

const statusColors: Record<Job['status'], { fill: string; border: string; icon: React.ReactNode }> = {
  passed: { fill: '#10b981', border: '#059669', icon: <CheckCircle2 className="w-5 h-5" /> },
  failed: { fill: '#ef4444', border: '#dc2626', icon: <AlertCircle className="w-5 h-5" /> },
  pending: { fill: '#3b82f6', border: '#2563eb', icon: <Clock className="w-5 h-5" /> },
  running: { fill: '#f59e0b', border: '#d97706', icon: <Clock className="w-5 h-5" /> },
};

export function DAGVisualization() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = 600;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Create nodes
    const nodes: DAGNode[] = mockStages.flatMap((stage) =>
      stage.jobs.map((job) => ({
        id: job.id,
        name: job.name,
        stage: job.stage,
        status: job.status,
        duration: job.duration,
        tags: job.tags,
      }))
    );

    // Create links
    const links: DAGLink[] = edges.map((edge) => ({
      source: nodes.find((n) => n.id === edge.source) || edge.source,
      target: nodes.find((n) => n.id === edge.target) || edge.target,
    }));

    const svg = d3.select(svgRef.current).attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet');

    // Add background
    svg
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#0f172a')
      .attr('class', 'bg');

    // Create simulation with custom forces for DAG layout
    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(150).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('x', d3.forceX((d: any) => (d.stage - 1) * (width / 3) + 100).strength(0.8))
      .force('y', d3.forceY(height / 2).strength(0.1));

    // Draw links
    const linkGroup = svg.append('g').attr('class', 'links');
    const link = linkGroup
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'rgba(148, 163, 184, 0.2)')
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round');

    // Add arrowheads
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 25)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', 'rgba(148, 163, 184, 0.3)');

    link.attr('marker-end', 'url(#arrowhead)');

    // Draw nodes
    const nodeGroup = svg.append('g').attr('class', 'nodes');
    const node = nodeGroup
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .call(
        d3.drag<SVGGElement, DAGNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended)
      );

    // Add rectangles for nodes
    node
      .append('rect')
      .attr('x', -50)
      .attr('y', -35)
      .attr('width', 100)
      .attr('height', 70)
      .attr('rx', 8)
      .attr('fill', (d) => statusColors[d.status].fill)
      .attr('stroke', (d) => statusColors[d.status].border)
      .attr('stroke-width', 2)
      .attr('opacity', 0.9)
      .style('cursor', 'pointer')
      .style('filter', 'drop-shadow(0 10px 15px rgba(0, 0, 0, 0.3))')
      .on('click', (event, d) => {
        event.stopPropagation();
        const job = mockStages.flatMap((s) => s.jobs).find((j) => j.id === d.id);
        if (job) setSelectedJob(job);
      });

    // Add text
    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-10')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', 'white')
      .text((d) => d.name);

    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '8')
      .attr('font-size', '11px')
      .attr('fill', 'rgba(255, 255, 255, 0.7)')
      .text((d) => `${d.duration}m`);

    // Animation
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, DAGNode, DAGNode>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, DAGNode, DAGNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, DAGNode, DAGNode>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-[var(--foreground)]">Release Pipeline DAG</h2>
          <p className="text-sm text-[var(--foreground-secondary)]">Interactive workflow visualization with job dependencies</p>
        </div>

        <svg
          ref={svgRef}
          className="w-full rounded-lg border border-[var(--border)] bg-[#0f172a]"
          style={{ minHeight: '600px' }}
        />
      </div>

      {selectedJob && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[var(--foreground)]">{selectedJob.name}</h3>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[var(--foreground-secondary)]">Status</p>
                  <p className="mt-1 flex items-center gap-2 font-semibold text-[var(--status-success)]">
                    <CheckCircle2 className="w-4 h-4" />
                    {selectedJob.status.charAt(0).toUpperCase() + selectedJob.status.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--foreground-secondary)]">Duration</p>
                  <p className="mt-1 font-semibold text-[var(--foreground)]">{selectedJob.duration}m</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[var(--foreground-secondary)]">Tags</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedJob.tags.map((tag) => (
                      <span key={tag} className="inline-block rounded-full bg-[var(--status-pending)]/20 px-3 py-1 text-xs font-medium text-[var(--status-pending)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedJob(null)}
              className="text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
