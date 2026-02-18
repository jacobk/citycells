'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';
import {
  DISTANCE_TIER_THRESHOLDS,
  TIER_POINTS,
  assignDistanceTier,
  type DistanceTier,
} from '@/lib/distance-tiers';

/**
 * Precision Tiers Documentation Page
 *
 * WHY: Interactive D3 visualization showing how distance from boundary
 * affects tier assignment and points. Uses slider for user interaction.
 *
 * @see docs/ADR/021-tiered-distance-scoring.md - Section 1 (Distance Tiers)
 */

const VIEWBOX_WIDTH = 360;
const VIEWBOX_HEIGHT = 200;
const MARGIN = { top: 30, right: 20, bottom: 40, left: 20 };
const CHART_WIDTH = VIEWBOX_WIDTH - MARGIN.left - MARGIN.right;
const CHART_HEIGHT = VIEWBOX_HEIGHT - MARGIN.top - MARGIN.bottom;

// WHY: Max distance shown in visualization (70m to include "missed" zone)
const MAX_DISTANCE = 70;

// Tier data for the table
const TIER_TABLE_DATA: {
  tier: DistanceTier;
  label: string;
  maxDistance: string;
  points: number;
  description: string;
}[] = [
  {
    tier: 'platinum',
    label: 'Platinum',
    maxDistance: `0-${DISTANCE_TIER_THRESHOLDS.platinum}m`,
    points: TIER_POINTS.platinum,
    description: 'GPS-perfect tracking',
  },
  {
    tier: 'gold',
    label: 'Gold',
    maxDistance: `${DISTANCE_TIER_THRESHOLDS.platinum + 1}-${DISTANCE_TIER_THRESHOLDS.gold}m`,
    points: TIER_POINTS.gold,
    description: 'Excellent precision',
  },
  {
    tier: 'silver',
    label: 'Silver',
    maxDistance: `${DISTANCE_TIER_THRESHOLDS.gold + 1}-${DISTANCE_TIER_THRESHOLDS.silver}m`,
    points: TIER_POINTS.silver,
    description: 'Good precision',
  },
  {
    tier: 'bronze',
    label: 'Bronze',
    maxDistance: `${DISTANCE_TIER_THRESHOLDS.silver + 1}-${DISTANCE_TIER_THRESHOLDS.bronze}m`,
    points: TIER_POINTS.bronze,
    description: 'Acceptable',
  },
  {
    tier: 'potato',
    label: 'Potato',
    maxDistance: `${DISTANCE_TIER_THRESHOLDS.bronze + 1}-${DISTANCE_TIER_THRESHOLDS.potato}m`,
    points: TIER_POINTS.potato,
    description: 'Minimal credit',
  },
  {
    tier: 'missed',
    label: 'Missed',
    maxDistance: `>${DISTANCE_TIER_THRESHOLDS.potato}m`,
    points: TIER_POINTS.missed,
    description: 'Too far to count',
  },
];

// Tier band boundaries for visualization
const TIER_BANDS: { tier: DistanceTier; start: number; end: number }[] = [
  { tier: 'platinum', start: 0, end: DISTANCE_TIER_THRESHOLDS.platinum },
  { tier: 'gold', start: DISTANCE_TIER_THRESHOLDS.platinum, end: DISTANCE_TIER_THRESHOLDS.gold },
  {
    tier: 'silver',
    start: DISTANCE_TIER_THRESHOLDS.gold,
    end: DISTANCE_TIER_THRESHOLDS.silver,
  },
  {
    tier: 'bronze',
    start: DISTANCE_TIER_THRESHOLDS.silver,
    end: DISTANCE_TIER_THRESHOLDS.bronze,
  },
  {
    tier: 'potato',
    start: DISTANCE_TIER_THRESHOLDS.bronze,
    end: DISTANCE_TIER_THRESHOLDS.potato,
  },
  { tier: 'missed', start: DISTANCE_TIER_THRESHOLDS.potato, end: MAX_DISTANCE },
];

export default function PrecisionTiersPage() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [distance, setDistance] = useState(15);

  // Calculate current tier based on distance
  const { tier: currentTier, points: currentPoints } = assignDistanceTier(distance);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // X scale: distance in meters
    const xScale = d3.scaleLinear().domain([0, MAX_DISTANCE]).range([0, CHART_WIDTH]);

    // Draw tier bands
    TIER_BANDS.forEach(({ tier, start, end }) => {
      g.append('rect')
        .attr('x', xScale(start))
        .attr('y', 0)
        .attr('width', xScale(end) - xScale(start))
        .attr('height', CHART_HEIGHT)
        .attr('fill', DISTANCE_TIER_COLORS[tier])
        .attr('opacity', 0.6);
    });

    // Draw boundary line marker at x=0
    g.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 0)
      .attr('y2', CHART_HEIGHT)
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 3);

    g.append('text')
      .attr('x', 0)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1f2937')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text('Boundary');

    // Draw X axis
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues([0, 10, 20, 30, 40, 50, 60, 70])
      .tickFormat((d) => `${d}m`);

    g.append('g')
      .attr('transform', `translate(0,${CHART_HEIGHT})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', '9px');

    // X axis label
    g.append('text')
      .attr('x', CHART_WIDTH / 2)
      .attr('y', CHART_HEIGHT + 30)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6b7280')
      .attr('font-size', '10px')
      .text('Distance from boundary');

    // Draw current distance indicator
    const indicatorX = xScale(distance);

    // Vertical line for indicator
    g.append('line')
      .attr('x1', indicatorX)
      .attr('y1', 0)
      .attr('x2', indicatorX)
      .attr('y2', CHART_HEIGHT)
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,2');

    // Circle indicator
    g.append('circle')
      .attr('cx', indicatorX)
      .attr('cy', CHART_HEIGHT / 2)
      .attr('r', 10)
      .attr('fill', '#ffffff')
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 2);

    // Walking person icon (simple representation)
    g.append('text')
      .attr('x', indicatorX)
      .attr('y', CHART_HEIGHT / 2 + 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .text('\u{1F6B6}'); // Walking emoji
  }, [distance]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <Link href="/docs/scoring" className="text-xs font-medium text-blue-600 hover:underline">
          Back to scoring overview
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">Precision Tiers</h1>
          <p className="text-sm text-gray-600">
            How close you walk to the boundary determines your tier. Closer = more points!
          </p>
        </div>
      </header>

      {/* Interactive Visualization */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Interactive Distance Diagram</h2>
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          {/* Current status display */}
          <div className="mb-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: DISTANCE_TIER_COLORS[currentTier] }}
              />
              <span className="font-medium text-gray-900">
                {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Tier
              </span>
            </div>
            <div className="text-right">
              <span className="text-gray-500">Distance: </span>
              <span className="font-semibold text-gray-900">{distance}m</span>
              <span className="mx-2 text-gray-300">|</span>
              <span className="text-gray-500">Points: </span>
              <span className="font-semibold text-gray-900">
                {currentPoints === 1 ? '100%' : `${Math.round(currentPoints * 100)}%`}
              </span>
            </div>
          </div>

          {/* SVG Visualization */}
          <svg
            ref={svgRef}
            className="h-48 w-full"
            role="img"
            aria-label="Distance tier visualization"
          />

          {/* Slider */}
          <div className="mt-4 space-y-2">
            <label htmlFor="distance-slider" className="block text-xs font-medium text-gray-600">
              Adjust distance from boundary
            </label>
            <input
              id="distance-slider"
              type="range"
              min="0"
              max="70"
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>0m (on boundary)</span>
              <span>70m (far away)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tier Table */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">All 6 Tiers</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Tier</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                  Distance
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Points</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {TIER_TABLE_DATA.map(({ tier, label, maxDistance, points, description }) => (
                <tr
                  key={tier}
                  className={currentTier === tier ? 'bg-blue-50' : 'bg-white'}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: DISTANCE_TIER_COLORS[tier] }}
                      />
                      <span className="font-medium text-gray-900">{label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{maxDistance}</td>
                  <td className="px-3 py-2 font-semibold text-gray-900">
                    {points === 0 ? '0%' : points === 1 ? '100%' : `${Math.round(points * 100)}%`}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* GPS Accuracy Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">GPS Accuracy Considerations</h2>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
            <li>
              <strong>Typical GPS accuracy:</strong> Consumer GPS has 5-15 meter accuracy under good
              conditions.
            </li>
            <li>
              <strong>Urban canyons:</strong> Tall buildings can degrade GPS to 20-30 meter
              accuracy.
            </li>
            <li>
              <strong>Platinum is achievable:</strong> The 10m Platinum threshold accounts for GPS
              drift - you don&apos;t need survey-grade equipment.
            </li>
            <li>
              <strong>Sidewalk offset:</strong> Walking on a sidewalk 3-5m from the property line is
              perfectly fine for high scores.
            </li>
            <li>
              <strong>Tree cover:</strong> Dense foliage can reduce GPS accuracy temporarily - the
              tiered system is forgiving of occasional drift.
            </li>
          </ul>
        </div>
      </section>

      {/* Point Distribution Rationale */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Why These Point Values?</h2>
        <p className="text-sm text-gray-600">
          The point distribution creates an S-curve that rewards precision while not over-penalizing
          typical GPS drift:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>
            <strong>Platinum to Gold (-20%):</strong> Small penalty; both are excellent.
          </li>
          <li>
            <strong>Gold to Silver (-25%):</strong> Moderate; crossing the excellence threshold.
          </li>
          <li>
            <strong>Silver to Bronze (-25%):</strong> Moderate; from good to marginal.
          </li>
          <li>
            <strong>Bronze to Potato (-20%):</strong> Small; both are marginal.
          </li>
          <li>
            <strong>Potato to Missed (-10%):</strong> Full elimination for being too far.
          </li>
        </ul>
      </section>
    </div>
  );
}
