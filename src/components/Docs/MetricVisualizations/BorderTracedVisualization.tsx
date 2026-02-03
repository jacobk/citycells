'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 220;

const BORDER_POINTS: [number, number][] = [
  [60, 40],
  [260, 50],
  [290, 140],
  [200, 190],
  [80, 170],
  [40, 90],
];

const GOOD_PATH: [number, number][] = [
  [60, 40],
  [260, 50],
  [285, 120],
  [200, 190],
  [80, 170],
  [45, 100],
];

const POOR_PATH: [number, number][] = [
  [60, 40],
  [180, 60],
  [250, 120],
  [200, 190],
];

export default function BorderTracedVisualization() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [variant, setVariant] = useState<'good' | 'poor'>('good');

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`);

    const borderLine = d3.line<[number, number]>().curve(d3.curveLinearClosed);
    const pathLine = d3.line<[number, number]>().curve(d3.curveBasis);

    svg
      .append('path')
      .attr('d', borderLine(BORDER_POINTS) ?? '')
      .attr('fill', 'none')
      .attr('stroke', '#93c5fd')
      .attr('stroke-width', 18)
      .attr('opacity', 0.3);

    svg
      .append('path')
      .attr('d', borderLine(BORDER_POINTS) ?? '')
      .attr('fill', 'none')
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 2);

    const walkPoints = variant === 'good' ? GOOD_PATH : POOR_PATH;
    const walkPath = svg
      .append('path')
      .attr('d', pathLine(walkPoints) ?? '')
      .attr('fill', 'none')
      .attr('stroke', variant === 'good' ? '#22c55e' : '#f97316')
      .attr('stroke-width', 4)
      .attr('stroke-linecap', 'round');

    const length = walkPath.node()?.getTotalLength() ?? 0;
    walkPath
      .attr('stroke-dasharray', `${length} ${length}`)
      .attr('stroke-dashoffset', length)
      .transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);
  }, [variant]);

  const coverage = variant === 'good' ? '92%' : '58%';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Border buffer (25m)</span>
        <span className="font-semibold text-gray-700">Coverage: {coverage}</span>
      </div>
      <svg ref={svgRef} className="h-52 w-full" role="img" aria-label="Border traced example" />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setVariant('good')}
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
            variant === 'good'
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-200 text-gray-600'
          }`}
        >
          Strong coverage
        </button>
        <button
          type="button"
          onClick={() => setVariant('poor')}
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
            variant === 'poor'
              ? 'border-orange-400 bg-orange-50 text-orange-700'
              : 'border-gray-200 text-gray-600'
          }`}
        >
          Weak coverage
        </button>
      </div>
    </div>
  );
}
