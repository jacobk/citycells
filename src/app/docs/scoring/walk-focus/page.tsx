'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

import { TIERED_SCORE_WEIGHTS } from '@/lib/analysis';

/**
 * Walk Focus Documentation Page
 *
 * WHY: Explains the walk focus (efficiency) metric - what percentage
 * of the walk was actually along the boundary vs detours.
 *
 * @see docs/ADR/021-tiered-distance-scoring.md - Section 5 (Metric Renaming)
 */

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 240;

// Example polygon boundary
const BOUNDARY_POINTS: [number, number][] = [
  [60, 40],
  [260, 50],
  [280, 140],
  [200, 200],
  [80, 180],
  [40, 100],
];

// Walk paths with varying focus
const PATHS: Record<
  'focused' | 'moderate' | 'unfocused',
  { boundary: [number, number][]; detours: [number, number][][]; focus: string; details: string }
> = {
  focused: {
    boundary: [
      [55, 45],
      [265, 55],
      [282, 145],
      [200, 205],
      [75, 185],
      [35, 100],
      [55, 45],
    ],
    detours: [],
    focus: '94%',
    details: '1.2km on boundary / 1.28km total',
  },
  moderate: {
    boundary: [
      [55, 45],
      [160, 48],
      [265, 55],
      [282, 145],
      [200, 205],
      [75, 185],
      [35, 100],
      [55, 45],
    ],
    detours: [
      // One detour in the middle
      [
        [160, 48],
        [170, 90],
        [140, 120],
        [120, 90],
        [160, 48],
      ],
    ],
    focus: '72%',
    details: '1.2km on boundary / 1.67km total',
  },
  unfocused: {
    boundary: [
      [55, 45],
      [265, 55],
      [282, 145],
      [200, 205],
    ],
    detours: [
      // Multiple detours
      [
        [100, 60],
        [130, 100],
        [100, 130],
        [160, 120],
        [180, 80],
        [220, 110],
      ],
      [
        [282, 145],
        [240, 130],
        [220, 160],
        [250, 180],
        [200, 205],
      ],
    ],
    focus: '41%',
    details: '0.8km on boundary / 1.95km total',
  },
};

type Variant = 'focused' | 'moderate' | 'unfocused';

export default function WalkFocusPage() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [variant, setVariant] = useState<Variant>('focused');

  const weightPercent = Math.round(TIERED_SCORE_WEIGHTS.walkFocus * 100);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`);

    const areaLine = d3.line<[number, number]>().curve(d3.curveLinearClosed);
    const pathLine = d3.line<[number, number]>().curve(d3.curveBasis);

    // Draw boundary buffer zone (light blue)
    svg
      .append('path')
      .attr('d', areaLine(BOUNDARY_POINTS) ?? '')
      .attr('fill', 'none')
      .attr('stroke', '#93c5fd')
      .attr('stroke-width', 30)
      .attr('stroke-opacity', 0.3);

    // Draw area polygon fill (very light)
    svg
      .append('path')
      .attr('d', areaLine(BOUNDARY_POINTS) ?? '')
      .attr('fill', '#f9fafb')
      .attr('stroke', 'none');

    // Draw boundary line
    svg
      .append('path')
      .attr('d', areaLine(BOUNDARY_POINTS) ?? '')
      .attr('fill', 'none')
      .attr('stroke', '#374151')
      .attr('stroke-width', 2);

    const pathData = PATHS[variant];

    // Draw detours (red/orange)
    pathData.detours.forEach((detour) => {
      svg
        .append('path')
        .attr('d', pathLine(detour) ?? '')
        .attr('fill', 'none')
        .attr('stroke', '#f97316')
        .attr('stroke-width', 4)
        .attr('stroke-linecap', 'round')
        .attr('stroke-dasharray', '6,3');
    });

    // Draw boundary-following path (green)
    svg
      .append('path')
      .attr('d', pathLine(pathData.boundary) ?? '')
      .attr('fill', 'none')
      .attr('stroke', '#22c55e')
      .attr('stroke-width', 4)
      .attr('stroke-linecap', 'round');

    // Start marker
    svg
      .append('circle')
      .attr('cx', pathData.boundary[0][0])
      .attr('cy', pathData.boundary[0][1])
      .attr('r', 6)
      .attr('fill', '#22c55e')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);
  }, [variant]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <Link href="/docs/scoring" className="text-xs font-medium text-blue-600 hover:underline">
          Back to scoring overview
        </Link>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">Walk Focus</h1>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {weightPercent}% of score
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Measures what percentage of your walk was actually along the boundary.
          </p>
        </div>
      </header>

      {/* What It Measures */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">What It Measures</h2>
        <p className="text-sm text-gray-600">
          Walk Focus (previously called &ldquo;Route Efficiency&rdquo;) answers the question:{' '}
          <em>&ldquo;Of all the distance you walked, how much was productive?&rdquo;</em>
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-center">
            <span className="text-sm text-gray-600">Walk Focus = </span>
            <span className="font-mono text-sm font-semibold text-gray-900">
              Boundary Distance / Total Walk Distance
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          A high Walk Focus means you stayed on task - tracing the boundary without unnecessary
          detours. A low Walk Focus indicates you spent significant time away from the boundary.
        </p>
      </section>

      {/* Interactive Visualization */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Example Walk Paths</h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-4 rounded bg-green-500" />
              <span className="text-gray-500">On boundary</span>
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-4 rounded bg-orange-400"
                style={{ backgroundImage: 'repeating-linear-gradient(90deg, #f97316 0, #f97316 3px, transparent 3px, transparent 6px)' }}
              />
              <span className="text-gray-500">Detour</span>
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-xs text-gray-500">{PATHS[variant].details}</span>
            <span className="font-semibold text-gray-900">Focus: {PATHS[variant].focus}</span>
          </div>
          <svg
            ref={svgRef}
            className="h-56 w-full"
            role="img"
            aria-label="Walk focus example"
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setVariant('focused')}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
                variant === 'focused'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Focused (94%)
            </button>
            <button
              type="button"
              onClick={() => setVariant('moderate')}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
                variant === 'moderate'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Moderate (72%)
            </button>
            <button
              type="button"
              onClick={() => setVariant('unfocused')}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
                variant === 'unfocused'
                  ? 'border-orange-400 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Unfocused (41%)
            </button>
          </div>
        </div>
      </section>

      {/* How It's Calculated */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">How It&apos;s Calculated</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>Create a 25-meter buffer zone around the boundary.</li>
          <li>For each segment of your walk, check if its midpoint falls within the buffer.</li>
          <li>Sum the length of all segments within the buffer = &ldquo;Boundary Distance&rdquo;.</li>
          <li>Divide by your total walk distance to get the percentage.</li>
        </ol>
      </section>

      {/* Why It Matters */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Why It Matters</h2>
        <p className="text-sm text-gray-600">
          Walk Focus prevents &ldquo;gaming&rdquo; the system by walking far from the boundary and
          then returning. Without this metric, you could trace a small part of the boundary, wander
          off for a long detour, and still score reasonably well on other metrics.
        </p>
        <p className="text-sm text-gray-600">
          With Walk Focus weighted at <strong>{weightPercent}%</strong>, significant detours will
          meaningfully impact your overall score.
        </p>
      </section>

      {/* Common Detour Types */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Common Detour Types</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
          <li>
            <strong>Obstacle avoidance:</strong> Going around a construction site or private
            property. These are unavoidable and the system is forgiving.
          </li>
          <li>
            <strong>Shortcuts:</strong> Cutting across the area instead of following the perimeter.
            These hurt your Walk Focus score.
          </li>
          <li>
            <strong>Exploration drift:</strong> Wandering off to look at something interesting. Nice
            for you, but lowers your score!
          </li>
        </ul>
      </section>

      {/* Tips to Improve */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Tips to Improve</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
          <li>
            <strong>Stay on the edge:</strong> Resist the temptation to cut through the middle.
          </li>
          <li>
            <strong>Plan your route:</strong> Before starting, look at the map and identify the
            perimeter path.
          </li>
          <li>
            <strong>Rejoin quickly:</strong> If you must detour, get back to the boundary as soon as
            possible.
          </li>
          <li>
            <strong>Avoid backtracking:</strong> Walking the same boundary section twice adds to
            total distance without adding value.
          </li>
        </ul>
      </section>

      {/* Comparison with Boundary Coverage */}
      <section className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Walk Focus vs Boundary Coverage
        </h3>
        <p className="mt-2 text-sm text-gray-600">These metrics measure different perspectives:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>
            <strong>Boundary Coverage:</strong> &ldquo;Did you walk near the boundary?&rdquo;
            (boundary-centric)
          </li>
          <li>
            <strong>Walk Focus:</strong> &ldquo;Was your walk near the boundary?&rdquo;
            (walk-centric)
          </li>
        </ul>
        <p className="mt-2 text-sm text-gray-600">
          You could have high Boundary Coverage (traced most of the edge) but low Walk Focus (lots
          of extra wandering). Both matter for a complete assessment.
        </p>
      </section>
    </div>
  );
}
