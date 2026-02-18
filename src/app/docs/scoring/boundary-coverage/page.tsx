'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

import { TIERED_SCORE_WEIGHTS } from '@/lib/analysis';
import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';
import { DISTANCE_TIER_THRESHOLDS } from '@/lib/distance-tiers';

/**
 * Boundary Coverage Documentation Page
 *
 * WHY: Explains the tiered boundary coverage metric per ADR 021.
 * Shows how segment distance affects points with D3 visualization.
 *
 * @see docs/ADR/021-tiered-distance-scoring.md - Section 2 (Per-Segment Distance)
 */

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 240;

// Example polygon boundary points
const BOUNDARY_POINTS: [number, number][] = [
  [60, 40],
  [260, 50],
  [280, 140],
  [200, 200],
  [80, 180],
  [40, 100],
];

// Walk paths with varying quality
const PATHS: Record<'excellent' | 'good' | 'poor', { points: [number, number][]; tiers: string[] }> =
  {
    excellent: {
      points: [
        [55, 45],
        [130, 45],
        [200, 50],
        [265, 55],
        [278, 100],
        [275, 145],
        [240, 175],
        [200, 198],
        [130, 185],
        [80, 175],
        [45, 140],
        [42, 95],
        [55, 50],
      ],
      tiers: [
        'platinum',
        'gold',
        'platinum',
        'gold',
        'platinum',
        'gold',
        'gold',
        'platinum',
        'gold',
        'platinum',
        'gold',
        'platinum',
      ],
    },
    good: {
      points: [
        [50, 50],
        [140, 45],
        [220, 65],
        [270, 100],
        [260, 155],
        [200, 185],
        [110, 170],
        [60, 140],
        [45, 90],
      ],
      tiers: ['gold', 'silver', 'silver', 'gold', 'silver', 'gold', 'silver', 'gold'],
    },
    poor: {
      points: [
        [60, 70],
        [160, 90],
        [220, 100],
        [210, 150],
        [150, 140],
        [90, 130],
      ],
      tiers: ['bronze', 'potato', 'missed', 'bronze', 'potato'],
    },
  };

type Variant = 'excellent' | 'good' | 'poor';

export default function BoundaryCoveragePage() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [variant, setVariant] = useState<Variant>('excellent');

  const weightPercent = Math.round(TIERED_SCORE_WEIGHTS.tieredBorder * 100);

  // Calculate approximate score based on tiers
  const tierScores = {
    excellent: '92%',
    good: '68%',
    poor: '22%',
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`);

    const borderLine = d3.line<[number, number]>().curve(d3.curveLinearClosed);

    // Draw boundary polygon fill (light)
    svg
      .append('path')
      .attr('d', borderLine(BOUNDARY_POINTS) ?? '')
      .attr('fill', '#f3f4f6')
      .attr('stroke', 'none');

    // Draw boundary line
    svg
      .append('path')
      .attr('d', borderLine(BOUNDARY_POINTS) ?? '')
      .attr('fill', 'none')
      .attr('stroke', '#374151')
      .attr('stroke-width', 2);

    // Get path data for current variant
    const pathData = PATHS[variant];

    // Draw walk path with tiered coloring
    // For simplicity, we draw segments with their tier color
    for (let i = 0; i < pathData.points.length - 1; i++) {
      const start = pathData.points[i];
      const end = pathData.points[i + 1];
      const tier = pathData.tiers[i] as keyof typeof DISTANCE_TIER_COLORS;
      const color = DISTANCE_TIER_COLORS[tier] || DISTANCE_TIER_COLORS.missed;

      svg
        .append('line')
        .attr('x1', start[0])
        .attr('y1', start[1])
        .attr('x2', end[0])
        .attr('y2', end[1])
        .attr('stroke', color)
        .attr('stroke-width', 4)
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0)
        .transition()
        .delay(i * 100)
        .duration(200)
        .attr('opacity', 1);
    }

    // Add start marker
    svg
      .append('circle')
      .attr('cx', pathData.points[0][0])
      .attr('cy', pathData.points[0][1])
      .attr('r', 5)
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
            <h1 className="text-2xl font-semibold text-gray-900">Boundary Coverage</h1>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {weightPercent}% of score
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Measures how much of the boundary you walked AND how close you stayed to it.
          </p>
        </div>
      </header>

      {/* What It Measures */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">What It Measures</h2>
        <p className="text-sm text-gray-600">
          Boundary Coverage combines two concepts into one metric:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>
            <strong>Coverage:</strong> What percentage of the area&apos;s edge did you walk near?
          </li>
          <li>
            <strong>Precision:</strong> How close were you to the actual boundary?
          </li>
        </ul>
        <p className="text-sm text-gray-600">
          Each segment of your walk is assigned a tier based on its distance from the boundary
          (Platinum, Gold, Silver, Bronze, Potato, or Missed). The final score is a weighted average
          based on segment length.
        </p>
      </section>

      {/* Interactive Visualization */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Example Walk Paths</h2>
          <span className="text-xs text-gray-500">Segment colors = tier</span>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-gray-500">Boundary Coverage Score:</span>
            <span className="font-semibold text-gray-900">{tierScores[variant]}</span>
          </div>
          <svg
            ref={svgRef}
            className="h-56 w-full"
            role="img"
            aria-label="Boundary coverage example"
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setVariant('excellent')}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
                variant === 'excellent'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Excellent (92%)
            </button>
            <button
              type="button"
              onClick={() => setVariant('good')}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
                variant === 'good'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Good (68%)
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
              Poor (22%)
            </button>
          </div>
        </div>

        {/* Tier Color Legend */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
          {(['platinum', 'gold', 'silver', 'bronze', 'potato', 'missed'] as const).map((tier) => (
            <div key={tier} className="flex items-center gap-1">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: DISTANCE_TIER_COLORS[tier] }}
              />
              <span className="capitalize text-gray-600">{tier}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How It's Calculated */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">How It&apos;s Calculated</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>For each segment of your walk, find the midpoint.</li>
          <li>Measure the distance from that midpoint to the nearest boundary line.</li>
          <li>
            Assign a tier based on distance:
            <ul className="mt-1 list-disc pl-5 text-gray-600">
              <li>0-{DISTANCE_TIER_THRESHOLDS.platinum}m = Platinum (100%)</li>
              <li>
                {DISTANCE_TIER_THRESHOLDS.platinum + 1}-{DISTANCE_TIER_THRESHOLDS.gold}m = Gold
                (80%)
              </li>
              <li>
                {DISTANCE_TIER_THRESHOLDS.gold + 1}-{DISTANCE_TIER_THRESHOLDS.silver}m = Silver
                (55%)
              </li>
              <li>
                {DISTANCE_TIER_THRESHOLDS.silver + 1}-{DISTANCE_TIER_THRESHOLDS.bronze}m = Bronze
                (30%)
              </li>
              <li>
                {DISTANCE_TIER_THRESHOLDS.bronze + 1}-{DISTANCE_TIER_THRESHOLDS.potato}m = Potato
                (10%)
              </li>
              <li>&gt;{DISTANCE_TIER_THRESHOLDS.potato}m = Missed (0%)</li>
            </ul>
          </li>
          <li>Multiply each segment&apos;s tier points by segment length.</li>
          <li>Divide total weighted points by total walk length.</li>
        </ol>
      </section>

      {/* Tips to Improve */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Tips to Improve</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
          <li>
            <strong>Walk the full perimeter:</strong> Missing sections of the boundary counts as
            &ldquo;Missed&rdquo; distance.
          </li>
          <li>
            <strong>Stay close:</strong> Walk on the sidewalk or path nearest the boundary edge.
          </li>
          <li>
            <strong>Follow corners:</strong> Slow down at turns to stay within the Gold/Platinum
            zone.
          </li>
          <li>
            <strong>Loop back if needed:</strong> If you drifted far away, return to the boundary to
            add more high-tier segments.
          </li>
        </ul>
      </section>

      {/* Link to Precision Tiers */}
      <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-blue-900">Learn About Precision Tiers</h3>
            <p className="mt-1 text-xs text-blue-700">
              Explore the interactive distance diagram to understand each tier.
            </p>
          </div>
          <Link
            href="/docs/scoring/precision-tiers"
            className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            View Tiers
          </Link>
        </div>
      </section>
    </div>
  );
}
