'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 220;

const AREA_POLYGON: [number, number][] = [
  [60, 40],
  [250, 55],
  [280, 140],
  [210, 185],
  [90, 175],
  [50, 90],
];

const CLOSED_LOOP: [number, number][] = [
  [90, 60],
  [230, 70],
  [250, 135],
  [190, 170],
  [110, 150],
  [80, 95],
];

const INTERSECTION_POLYGON: [number, number][] = [
  [100, 70],
  [220, 80],
  [235, 130],
  [180, 155],
  [115, 135],
  [90, 100],
];

const OPEN_PATH: [number, number][] = [
  [90, 60],
  [230, 70],
  [250, 135],
  [190, 170],
];

export default function AreaEnclosedVisualization() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [variant, setVariant] = useState<'closed' | 'open'>('closed');

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`);

    const polygonLine = d3.line<[number, number]>().curve(d3.curveLinearClosed);
    const pathLine = d3.line<[number, number]>().curve(d3.curveBasis);

    svg
      .append('path')
      .attr('d', polygonLine(AREA_POLYGON) ?? '')
      .attr('fill', '#bfdbfe')
      .attr('opacity', 0.6)
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2);

    if (variant === 'closed') {
      svg
        .append('path')
        .attr('d', polygonLine(CLOSED_LOOP) ?? '')
        .attr('fill', '#bbf7d0')
        .attr('opacity', 0.5)
        .attr('stroke', '#22c55e')
        .attr('stroke-width', 2);

      svg
        .append('path')
        .attr('d', polygonLine(INTERSECTION_POLYGON) ?? '')
        .attr('fill', '#4ade80')
        .attr('opacity', 0.6);
    } else {
      svg
        .append('path')
        .attr('d', pathLine(OPEN_PATH) ?? '')
        .attr('fill', 'none')
        .attr('stroke', '#f97316')
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round');
    }
  }, [variant]);

  const enclosed = variant === 'closed' ? '72%' : '0%';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Loop closure required (within 100m)</span>
        <span className="font-semibold text-gray-700">Enclosed: {enclosed}</span>
      </div>
      <svg ref={svgRef} className="h-52 w-full" role="img" aria-label="Area enclosed example" />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setVariant('closed')}
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
            variant === 'closed'
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-200 text-gray-600'
          }`}
        >
          Closed loop
        </button>
        <button
          type="button"
          onClick={() => setVariant('open')}
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
            variant === 'open'
              ? 'border-orange-400 bg-orange-50 text-orange-700'
              : 'border-gray-200 text-gray-600'
          }`}
        >
          Open path
        </button>
      </div>
    </div>
  );
}
