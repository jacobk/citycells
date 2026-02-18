'use client';

import Link from 'next/link';

import { TIERED_SCORE_WEIGHTS } from '@/lib/analysis';
import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';
import { DISTANCE_TIER_THRESHOLDS, TIER_POINTS } from '@/lib/distance-tiers';

/**
 * Scoring Documentation Index Page
 *
 * WHY: Provides an overview of the tiered scoring system per ADR 021.
 * Links to individual metric and precision tier documentation pages.
 *
 * @see docs/ADR/021-tiered-distance-scoring.md - Section 7 (Documentation Structure)
 */

interface MetricInfo {
  slug: string;
  name: string;
  weight: number;
  description: string;
}

const METRICS: MetricInfo[] = [
  {
    slug: 'boundary-coverage',
    name: 'Boundary Coverage',
    weight: TIERED_SCORE_WEIGHTS.tieredBorder,
    description: 'How much of the edge did you walk, and how close?',
  },
  {
    slug: 'area-enclosed',
    name: 'Area Enclosed',
    weight: TIERED_SCORE_WEIGHTS.areaCoverage,
    description: 'Did your walk form a closed loop around the area?',
  },
  {
    slug: 'walk-focus',
    name: 'Walk Focus',
    weight: TIERED_SCORE_WEIGHTS.walkFocus,
    description: 'What percentage of your walk was on the boundary?',
  },
];

// WHY: Only show the main tiers with color swatches (not missed)
const TIER_PREVIEW = [
  { tier: 'platinum', label: 'Platinum', threshold: DISTANCE_TIER_THRESHOLDS.platinum },
  { tier: 'gold', label: 'Gold', threshold: DISTANCE_TIER_THRESHOLDS.gold },
  { tier: 'silver', label: 'Silver', threshold: DISTANCE_TIER_THRESHOLDS.silver },
  { tier: 'bronze', label: 'Bronze', threshold: DISTANCE_TIER_THRESHOLDS.bronze },
  { tier: 'potato', label: 'Potato', threshold: DISTANCE_TIER_THRESHOLDS.potato },
] as const;

export default function ScoringIndexPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <Link href="/" className="text-xs font-medium text-blue-600 hover:underline">
          Back to map
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">How Scoring Works</h1>
          <p className="text-sm text-gray-600">
            Your walk quality is calculated from three metrics, each measuring a different aspect of
            how well you traced the area boundary.
          </p>
        </div>
      </header>

      {/* The Formula Section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">The Formula</h2>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="space-y-3">
            {METRICS.map((metric) => (
              <Link
                key={metric.slug}
                href={`/docs/scoring/${metric.slug}`}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3 transition hover:border-blue-200 hover:shadow-sm"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{metric.name}</span>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
                      {Math.round(metric.weight * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{metric.description}</p>
                </div>
                <span className="text-xs text-blue-600">Learn more</span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">
            Final Score = {Math.round(TIERED_SCORE_WEIGHTS.tieredBorder * 100)}% Boundary +{' '}
            {Math.round(TIERED_SCORE_WEIGHTS.areaCoverage * 100)}% Area +{' '}
            {Math.round(TIERED_SCORE_WEIGHTS.walkFocus * 100)}% Focus
          </p>
        </div>
      </section>

      {/* Precision Tiers Preview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Precision Tiers</h2>
          <Link
            href="/docs/scoring/precision-tiers"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            See details
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          Boundary Coverage uses a 6-tier system based on how close you walk to the edge. Closer =
          more points!
        </p>
        <div className="grid grid-cols-5 gap-2">
          {TIER_PREVIEW.map(({ tier, label, threshold }) => (
            <div key={tier} className="flex flex-col items-center gap-1">
              <div
                className="h-8 w-8 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: DISTANCE_TIER_COLORS[tier] }}
                title={`${label}: within ${threshold}m`}
              />
              <span className="text-xs font-medium text-gray-700">{label}</span>
              <span className="text-xs text-gray-500">
                {TIER_POINTS[tier] === 1 ? '100%' : `${Math.round(TIER_POINTS[tier] * 100)}%`}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Tips Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Tips for Higher Scores</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
          <li>
            <strong>Walk close to the edge:</strong> Stay within 10-20 meters of the boundary for
            Platinum and Gold tier credits.
          </li>
          <li>
            <strong>Complete the loop:</strong> Return to your starting point to maximize Area
            Enclosed.
          </li>
          <li>
            <strong>Avoid detours:</strong> Long side trips away from the boundary lower your Walk
            Focus score.
          </li>
          <li>
            <strong>Follow corners carefully:</strong> Slow down at turns to capture all segments of
            the boundary.
          </li>
        </ul>
      </section>

      {/* GPS Note */}
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-sm font-semibold text-amber-800">GPS Accuracy Note</h3>
        <p className="mt-1 text-xs text-amber-700">
          GPS typically has 5-15 meter accuracy. Platinum tier (within 10m) accounts for this - you
          don&apos;t need to walk on the exact boundary line. Just stay on the sidewalk or path
          closest to the edge.
        </p>
      </section>
    </div>
  );
}
