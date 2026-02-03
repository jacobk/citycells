'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 220;

const PANEL_PADDING = 20;
const PANEL_WIDTH = 130;
const PANEL_HEIGHT = 150;

const BORDER_SHAPE: [number, number][] = [
  [20, 20],
  [110, 25],
  [115, 110],
  [80, 140],
  [30, 120],
];

const EFFICIENT_PATH: [number, number][] = [
  [20, 20],
  [110, 25],
  [115, 110],
  [80, 140],
  [30, 120],
];

const INEFFICIENT_PATH: [number, number][] = [
  [20, 20],
  [60, 60],
  [110, 25],
  [70, 90],
  [115, 110],
  [60, 130],
  [30, 120],
];

export default function RouteEfficiencyVisualization() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`);

    const line = d3.line<[number, number]>().curve(d3.curveLinearClosed);
    const pathLine = d3.line<[number, number]>().curve(d3.curveBasis);

    const panels = [
      { x: PANEL_PADDING, label: 'Efficient', color: '#22c55e', path: EFFICIENT_PATH },
      { x: VIEWBOX_WIDTH / 2 + 10, label: 'Detours', color: '#f97316', path: INEFFICIENT_PATH },
    ];

    panels.forEach((panel) => {
      const group = svg.append('g').attr('transform', `translate(${panel.x}, 30)`);

      group
        .append('rect')
        .attr('width', PANEL_WIDTH)
        .attr('height', PANEL_HEIGHT)
        .attr('rx', 10)
        .attr('fill', '#f9fafb')
        .attr('stroke', '#e5e7eb');

      group
        .append('path')
        .attr('d', line(BORDER_SHAPE) ?? '')
        .attr('fill', 'none')
        .attr('stroke', '#9ca3af')
        .attr('stroke-width', 2)
        .attr('transform', 'translate(5, 5)');

      group
        .append('path')
        .attr('d', pathLine(panel.path) ?? '')
        .attr('fill', 'none')
        .attr('stroke', panel.color)
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .attr('transform', 'translate(5, 5)');

      group
        .append('text')
        .attr('x', PANEL_WIDTH / 2)
        .attr('y', PANEL_HEIGHT + 18)
        .attr('text-anchor', 'middle')
        .attr('font-size', 10)
        .attr('fill', '#6b7280')
        .text(panel.label);
    });
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Border-aligned distance / total distance</span>
        <span className="font-semibold text-gray-700">88% vs 54%</span>
      </div>
      <svg ref={svgRef} className="h-52 w-full" role="img" aria-label="Route efficiency comparison" />
    </div>
  );
}
