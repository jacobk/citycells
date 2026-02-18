'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

import { TIERED_SCORE_WEIGHTS } from '@/lib/analysis';

/**
 * Area Enclosed Documentation Page
 *
 * WHY: Explains the area coverage metric - how much of the sub-area
 * falls inside the walker's closed loop.
 *
 * @see docs/ADR/003-multi-metric-completion-scoring.md - Area Coverage section
 */

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 240;

// Example polygon (sub-area boundary)
const AREA_POLYGON: [number, number][] = [
  [60, 40],
  [260, 50],
  [280, 140],
  [200, 200],
  [80, 180],
  [40, 100],
];

// Walk paths
const PATHS: Record<'closed' | 'open' | 'partial', { points: [number, number][]; enclosed: string }> =
  {
    closed: {
      points: [
        [55, 45],
        [265, 55],
        [282, 145],
        [200, 205],
        [75, 185],
        [35, 100],
        [55, 45],
      ],
      enclosed: '98%',
    },
    partial: {
      points: [
        [70, 55],
        [240, 65],
        [255, 130],
        [180, 175],
        [100, 160],
        [70, 120],
        [70, 55],
      ],
      enclosed: '62%',
    },
    open: {
      points: [
        [55, 45],
        [265, 55],
        [282, 145],
        [200, 205],
      ],
      enclosed: '0%',
    },
  };

type Variant = 'closed' | 'open' | 'partial';

export default function AreaEnclosedPage() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [variant, setVariant] = useState<Variant>('closed');

  const weightPercent = Math.round(TIERED_SCORE_WEIGHTS.areaCoverage * 100);
  const isClosed = variant !== 'open';

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`);

    const areaLine = d3.line<[number, number]>().curve(d3.curveLinearClosed);
    const pathLine = d3.line<[number, number]>().curve(d3.curveBasis);

    // Draw area polygon fill (light)
    svg
      .append('path')
      .attr('d', areaLine(AREA_POLYGON) ?? '')
      .attr('fill', '#e5e7eb')
      .attr('stroke', 'none');

    // For closed paths, show intersection area
    const pathData = PATHS[variant];
    if (isClosed) {
      // Draw the enclosed area with green fill
      const walkLine = d3.line<[number, number]>().curve(d3.curveBasis);
      svg
        .append('path')
        .attr('d', walkLine(pathData.points) ?? '')
        .attr('fill', '#bbf7d0')
        .attr('fill-opacity', 0.7)
        .attr('stroke', 'none');
    }

    // Draw area boundary
    svg
      .append('path')
      .attr('d', areaLine(AREA_POLYGON) ?? '')
      .attr('fill', 'none')
      .attr('stroke', '#374151')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,2');

    // Draw walk path
    svg
      .append('path')
      .attr('d', pathLine(pathData.points) ?? '')
      .attr('fill', 'none')
      .attr('stroke', isClosed ? '#22c55e' : '#f97316')
      .attr('stroke-width', 4)
      .attr('stroke-linecap', 'round');

    // Start point
    svg
      .append('circle')
      .attr('cx', pathData.points[0][0])
      .attr('cy', pathData.points[0][1])
      .attr('r', 6)
      .attr('fill', '#22c55e')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // End point (different color if not closed)
    const lastPoint = pathData.points[pathData.points.length - 1];
    if (!isClosed) {
      svg
        .append('circle')
        .attr('cx', lastPoint[0])
        .attr('cy', lastPoint[1])
        .attr('r', 6)
        .attr('fill', '#ef4444')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2);
    }

    // Add labels
    svg
      .append('text')
      .attr('x', 160)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6b7280')
      .attr('font-size', '10px')
      .text('Sub-area boundary (dashed)');
  }, [variant, isClosed]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <Link href="/docs/scoring" className="text-xs font-medium text-blue-600 hover:underline">
          Back to scoring overview
        </Link>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">Area Enclosed</h1>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {weightPercent}% of score
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Measures how much of the sub-area falls inside your walking loop.
          </p>
        </div>
      </header>

      {/* What It Measures */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">What It Measures</h2>
        <p className="text-sm text-gray-600">
          Area Enclosed rewards walks that form a complete circuit around the sub-area. It answers
          the question: <em>&ldquo;Did you actually wrap around this area?&rdquo;</em>
        </p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            <strong>Important:</strong> If your walk doesn&apos;t form a closed loop (start and end
            within 100m), this metric scores <strong>0%</strong> regardless of how much boundary you
            traced.
          </p>
        </div>
      </section>

      {/* Interactive Visualization */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Example Walk Paths</h2>
          <span className="text-xs text-gray-500">Green area = enclosed</span>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Loop Status:</span>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  isClosed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {isClosed ? 'Closed' : 'Open'}
              </span>
            </div>
            <span className="font-semibold text-gray-900">
              Enclosed: {PATHS[variant].enclosed}
            </span>
          </div>
          <svg
            ref={svgRef}
            className="h-56 w-full"
            role="img"
            aria-label="Area enclosed example"
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setVariant('closed')}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
                variant === 'closed'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Full Loop (98%)
            </button>
            <button
              type="button"
              onClick={() => setVariant('partial')}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
                variant === 'partial'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Partial (62%)
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
              Open Path (0%)
            </button>
          </div>
        </div>
      </section>

      {/* How It's Calculated */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">How It&apos;s Calculated</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>
            <strong>Check loop closure:</strong> Your start and end points must be within 100 meters
            of each other.
          </li>
          <li>
            <strong>Build walk polygon:</strong> If closed, connect your GPS points into a polygon
            shape.
          </li>
          <li>
            <strong>Calculate intersection:</strong> Find the overlap between your walk polygon and
            the sub-area polygon.
          </li>
          <li>
            <strong>Compute percentage:</strong> Divide the intersection area by the total sub-area
            size.
          </li>
        </ol>
      </section>

      {/* Convex Hull Concept */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">The Convex Hull Concept</h2>
        <p className="text-sm text-gray-600">
          Your walk creates a polygon shape - imagine stretching a rubber band around all your GPS
          points. The &ldquo;enclosed area&rdquo; is the intersection between this rubber-band shape
          and the sub-area boundary.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>
            <strong>Wide loops</strong> that wrap around the entire sub-area score high (close to
            100%).
          </li>
          <li>
            <strong>Narrow loops</strong> that cut through the middle score lower (perhaps 40-60%).
          </li>
          <li>
            <strong>Open paths</strong> with no loop score 0% - you must return to your starting
            point.
          </li>
        </ul>
      </section>

      {/* Tips to Improve */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Tips to Improve</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
          <li>
            <strong>Close the loop:</strong> End your walk within 100m of where you started.
          </li>
          <li>
            <strong>Walk wide:</strong> Follow the outer edges rather than cutting across the
            middle.
          </li>
          <li>
            <strong>Minimize shortcuts:</strong> Avoid taking diagonal paths through the sub-area.
          </li>
          <li>
            <strong>Check your GPS:</strong> Make sure tracking was on for the entire walk,
            especially at the end.
          </li>
        </ul>
      </section>

      {/* Loop Closure Info */}
      <section className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-700">About Loop Closure</h3>
        <p className="mt-1 text-sm text-gray-600">
          The 100-meter threshold for &ldquo;closing&rdquo; a loop accounts for GPS inaccuracy at
          the start and end of activities. You don&apos;t need to end at the exact same spot - just
          get reasonably close.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Note: Strava sometimes truncates GPS data at start/end due to privacy zones. CityCells
          uses Strava&apos;s actual start/end coordinates when available for more accurate loop
          detection.
        </p>
      </section>
    </div>
  );
}
