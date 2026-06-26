"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { releaseEdges, releaseNodes, type Status } from "@/lib/graphflow";

interface ReleaseGraphD3Props {
  statuses: Record<string, Status>;
}

const statusColors: Record<Status, string> = {
  pending: "#6b7280",
  running: "#3b82f6",
  success: "#10b981",
  failed: "#ef4444",
  blocked: "#f59e0b",
  waiting: "#8b5cf6",
};

const statusBgColors: Record<Status, string> = {
  pending: "rgba(107, 114, 128, 0.1)",
  running: "rgba(59, 130, 246, 0.1)",
  success: "rgba(16, 185, 129, 0.1)",
  failed: "rgba(239, 68, 68, 0.1)",
  blocked: "rgba(245, 158, 11, 0.1)",
  waiting: "rgba(139, 92, 246, 0.1)",
};

export function ReleaseGraphD3({ statuses }: ReleaseGraphD3Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create groups for edges and nodes
    const g = svg.append("g");
    const edgesGroup = g.append("g").attr("class", "edges");
    const nodesGroup = g.append("g").attr("class", "nodes");

    // Scale nodes to percentage positions
    const nodes = releaseNodes.map(n => ({
      ...n,
      x: (n.x / 100) * width,
      y: (n.y / 100) * height,
    }));

    // Draw edges
    edgesGroup.selectAll("line")
      .data(releaseEdges)
      .enter()
      .append("line")
      .attr("x1", d => {
        const node = nodes.find(n => n.id === d.from);
        return node ? node.x + 20 : 0;
      })
      .attr("y1", d => {
        const node = nodes.find(n => n.id === d.from);
        return node ? node.y + 8 : 0;
      })
      .attr("x2", d => {
        const node = nodes.find(n => n.id === d.to);
        return node ? node.x : 0;
      })
      .attr("y2", d => {
        const node = nodes.find(n => n.id === d.to);
        return node ? node.y + 8 : 0;
      })
      .attr("stroke", d => {
        const fromNode = releaseNodes.find(n => n.id === d.from);
        const fromStatus = fromNode ? statuses[fromNode.id] : "pending";
        return fromStatus === "success" || statuses[d.to] !== "pending" 
          ? "#10b981" 
          : "#4b5563";
      })
      .attr("stroke-width", 2)
      .attr("marker-end", d => {
        const fromNode = releaseNodes.find(n => n.id === d.from);
        const fromStatus = fromNode ? statuses[fromNode.id] : "pending";
        const isActive = fromStatus === "success" || statuses[d.to] !== "pending";
        return isActive ? "url(#arrowgreen)" : "url(#arrowgray)";
      });

    // Define arrow markers
    svg.append("defs").selectAll("marker")
      .data([
        { id: "arrowgreen", color: "#10b981" },
        { id: "arrowgray", color: "#4b5563" },
      ])
      .enter()
      .append("marker")
      .attr("id", d => d.id)
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("refX", 9)
      .attr("refY", 3)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M0,0 L0,6 L9,3 z")
      .attr("fill", d => d.color);

    // Draw nodes
    const nodeGroups = nodesGroup.selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("transform", d => `translate(${d.x - 50}, ${d.y - 30})`);

    nodeGroups.append("rect")
      .attr("width", 100)
      .attr("height", 60)
      .attr("rx", 6)
      .attr("fill", d => statusBgColors[statuses[d.id]])
      .attr("stroke", d => statusColors[statuses[d.id]])
      .attr("stroke-width", 2)
      .style("cursor", "pointer");

    nodeGroups.append("text")
      .attr("x", 50)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#f2f2f2")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .text(d => d.label);

    nodeGroups.append("text")
      .attr("x", 50)
      .attr("y", 37)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", statusColors[nodes[0].id as unknown as Status])
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .text(d => `${d.duration}m`);

    nodeGroups.append("text")
      .attr("x", 50)
      .attr("y", 52)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", statusColors[statuses[nodes[0].id]])
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("text-transform", "uppercase")
      .text(d => {
        const status = statuses[d.id];
        return status === "pending" ? "Pending" :
               status === "running" ? "Running" :
               status === "success" ? "Success" :
               status === "failed" ? "Failed" :
               status === "blocked" ? "Blocked" : "Waiting";
      });

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
  }, [statuses]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-[#1f1f1f] rounded-md border border-[var(--border-color)]"
    />
  );
}
