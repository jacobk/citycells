'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 220;

const BORDER_LINE: [number, number][] = [
  [40, 180],
  [90, 80],
  [160, 60],
  [230, 90],
  [280, 40],
];

const BASE_OFFSETS = [4, 6, 10, 8, 12, 5, 7, 9, 6, 11];

function calculateRmse(distances: number[]) {
  const sumSq = distances.reduce((sum, value) => sum + value * value, 0);
  return Math.sqrt(sumSq / distances.length);
}

export default function PathPrecisionVisualization() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [deviationScale, setDeviationScale] = useState(1);

  const distances = useMemo(
    () => BASE_OFFSETS.map((value) => value * deviationScale * 2),
    [deviationScale]
  );
  const rmse = useMemo(() => calculateRmse(distances), [distances]);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`);

    const borderLine = d3.line<[number, number]>().curve(d3.curveBasis);

    svg
      .append('path')
      .attr('d', borderLine(BORDER_LINE) ?? '')
      .attr('fill', 'none')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 4);

    const points: [number, number][] = d3
      .scaleLinear()
      .domain([0, distances.length - 1])
      .range([0, BORDER_LINE.length - 1])
      .ticks(distances.length)
      .map((index, i) => {
        const base = BORDER_LINE[Math.floor(index)] ?? BORDER_LINE[0];
        const next = BORDER_LINE[Math.min(Math.floor(index) + 1, BORDER_LINE.length - 1)];
        const t = index - Math.floor(index);
        const x = base[0] + (next[0] - base[0]) * t;
        const y = base[1] + (next[1] - base[1]) * t;
        return [x, y + distances[i]] as [number, number];
      });

    const colorScale = d3
      .scaleLinear<string>()
      .domain([0, 10, 20, 30])
      .range(['#22c55e', '#facc15', '#f97316', '#ef4444']);

    svg
      .append('path')
      .attr('d', borderLine(points) ?? '')
      .attr('fill', 'none')
      .attr('stroke', '#2563eb')
      .attr('stroke-width', 2)
      .attr('opacity', 0.4);

    svg
      .selectAll('circle')
      .data(points)
      .enter()
      .append('circle')
      .attr('cx', (d) => d[0])
      .attr('cy', (d) => d[1])
      .attr('r', 4)
      .attr('fill', (_, i) => colorScale(distances[i]));
  }, [distances]);

  const normalizedScore = Math.max(0, 1 - rmse / 50);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Deviation heat map</span>
        <span className="font-semibold text-gray-700">
          RMSE: {rmse.toFixed(1)}m (score {normalizedScore.toFixed(2)})
        </span>
      </div>
      <svg ref={svgRef} className="h-52 w-full" role="img" aria-label="Path precision example" />
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600" htmlFor="precision-scale">
          Increase deviation
        </label>
        <input
          id="precision-scale"
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={deviationScale}
          onChange={(event) => setDeviationScale(Number(event.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
}
