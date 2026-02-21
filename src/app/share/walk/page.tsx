'use client';

/**
 * Shared Walk Viewer Page
 * 
 * Public page for viewing shared walk achievements.
 * Decodes walk data from URL parameter and renders an interactive map with stats.
 * No authentication required - anyone with the link can view.
 * 
 * WHY: Self-contained viewer that doesn't rely on database state.
 * All data comes from the URL, making it resilient and shareable anywhere.
 * 
 * @see docs/ADR/023-share-walk-feature.md - Technical decisions
 * @see docs/tickets/029-share-walk.md - Implementation requirements
 */

import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import polyline from '@mapbox/polyline';
import {
  decodeWalkData,
  expandTierSegments,
  UnsupportedVersionError,
  InvalidShareDataError,
  type ShareableWalkData,
} from '@/lib/share';
import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';
import { DISTANCE_TIER_THRESHOLDS, type DistanceTier } from '@/lib/distance-tiers';
import { getTierColor, getTierDisplayName, type Tier } from '@/lib/analysis';
import { formatDistance } from '@/lib/format-utils';
import { formatCircumferenceWithTime } from '@/lib/geo-utils';
import Link from 'next/link';

// WHY: Dynamic import to avoid SSR issues with Leaflet
const SharedWalkMap = dynamic(() => import('./SharedWalkMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
      <span className="text-muted-foreground">Loading map...</span>
    </div>
  ),
});

// =============================================================================
// Loading State
// =============================================================================

function LoadingState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading shared walk...</p>
      </div>
    </div>
  );
}

// =============================================================================
// Error State
// =============================================================================

function ErrorState({ 
  title, 
  message, 
  showHomeLink = true 
}: { 
  title: string; 
  message: string; 
  showHomeLink?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-6 text-center">
        {/* Error icon */}
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground mb-6">{message}</p>
        {showHomeLink && (
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to CityCells
          </Link>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Stats Display Component
// =============================================================================

function StatsCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="bg-secondary rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium text-foreground">{value}</div>
      {subValue && <div className="text-xs text-muted-foreground mt-0.5">{subValue}</div>}
    </div>
  );
}

// =============================================================================
// Tier Distribution Bar
// =============================================================================

function TierDistributionBar({ distribution }: { distribution: ShareableWalkData['tierDistribution'] }) {
  const tiers: DistanceTier[] = ['platinum', 'gold', 'silver', 'bronze', 'potato', 'missed'];
  
  return (
    <div className="space-y-1.5">
      {tiers.map((tier) => {
        const percentage = (distribution[tier] || 0) * 100;
        const thresholdLabel = tier === 'missed' 
          ? '>50m' 
          : `≤${DISTANCE_TIER_THRESHOLDS[tier]}m`;
        
        return (
          <div key={tier} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: DISTANCE_TIER_COLORS[tier] }}
            />
            <div className="flex items-center gap-1 min-w-[90px] shrink-0">
              <span className="text-xs font-medium text-foreground capitalize">{tier}</span>
              <span className="text-[10px] text-muted-foreground">({thresholdLabel})</span>
            </div>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: DISTANCE_TIER_COLORS[tier],
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
              {percentage.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Main Content Component
// =============================================================================

function SharedWalkContent() {
  const searchParams = useSearchParams();
  const [walkData, setWalkData] = useState<ShareableWalkData | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Decode walk data from URL parameter
  useEffect(() => {
    const encoded = searchParams.get('d');
    
    if (!encoded) {
      setError({
        title: 'Missing Data',
        message: 'This share link is incomplete. Please check the URL and try again.',
      });
      setIsLoading(false);
      return;
    }

    try {
      const data = decodeWalkData(encoded);
      setWalkData(data);
      setError(null);
    } catch (e) {
      console.error('[SharedWalkPage] Decode error:', e);
      
      if (e instanceof UnsupportedVersionError) {
        setError({
          title: 'Newer Version Required',
          message: e.message,
        });
      } else if (e instanceof InvalidShareDataError) {
        setError({
          title: 'Invalid Link',
          message: e.message,
        });
      } else {
        setError({
          title: 'Unable to Load',
          message: 'Something went wrong while loading this shared walk.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  // Decode geometry from polylines
  const geometry = useMemo(() => {
    if (!walkData) return null;
    
    try {
      const boundaryCoords = polyline.decode(walkData.boundary);
      const walkCoords = polyline.decode(walkData.walkPath);
      
      // Convert to GeoJSON [lng, lat] format (polyline returns [lat, lng])
      const boundaryGeoJson = boundaryCoords.map(([lat, lng]) => [lng, lat]);
      const walkGeoJson = walkCoords.map(([lat, lng]) => [lng, lat]);
      
      return {
        boundary: boundaryGeoJson,
        walkPath: walkGeoJson,
      };
    } catch (e) {
      console.error('[SharedWalkPage] Geometry decode error:', e);
      return null;
    }
  }, [walkData]);

  // Expand tier segments for visualization
  const tieredSegments = useMemo(() => {
    if (!walkData) return [];
    return expandTierSegments(walkData.tierSegments);
  }, [walkData]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState title={error.title} message={error.message} />;
  }

  if (!walkData || !geometry) {
    return <ErrorState title="No Data" message="Unable to load walk data from this link." />;
  }

  const tier = walkData.scores.tier as Tier;
  const tierColor = getTierColor(tier);
  const tierName = getTierDisplayName(tier);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
              {/* CityCells logo/icon */}
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span className="font-semibold">CityCells</span>
            </Link>
            <span className="text-sm text-muted-foreground">Shared Walk</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Area Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{walkData.areaName}</h1>
          <div className="flex items-center justify-center gap-3">
            <span 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: tierColor }}
            >
              {tierName}
            </span>
            <span className="text-muted-foreground">
              {(walkData.scores.qualityScore * 100).toFixed(1)}% Quality Score
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            Walked on {walkData.walkDate}
          </div>
        </div>

        {/* Map */}
        <section className="bg-card rounded-xl overflow-hidden shadow-lg">
          <div className="h-72 sm:h-96">
            <SharedWalkMap
              boundaryCoords={geometry.boundary}
              walkCoords={geometry.walkPath}
              tierSegments={tieredSegments}
              tier={tier}
            />
          </div>
        </section>

        {/* Quick Stats */}
        <section className="flex items-center justify-center gap-2 text-sm py-2 bg-card rounded-lg border border-border">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span className="text-muted-foreground font-medium">
            {formatCircumferenceWithTime(walkData.stats.circumference)}
          </span>
        </section>

        {/* Score Breakdown */}
        <section className="bg-card rounded-xl p-4 shadow-sm border border-border">
          <h2 className="text-sm font-semibold text-foreground mb-3">Score Breakdown</h2>
          <div className="bg-secondary rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Metric</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-2 px-3 text-foreground">Boundary Coverage</td>
                  <td className="text-right py-2 px-3 text-foreground font-medium">
                    {(walkData.scores.tieredBorderScore * 100).toFixed(0)}%
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 px-3 text-foreground">Area Enclosed</td>
                  <td className="text-right py-2 px-3 text-foreground font-medium">
                    {(walkData.scores.areaCoverage * 100).toFixed(0)}%
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-foreground">Walk Focus</td>
                  <td className="text-right py-2 px-3 text-foreground font-medium">
                    {(walkData.scores.walkFocus * 100).toFixed(0)}%
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-muted">
                  <td className="py-2 px-3 font-semibold text-foreground">Quality Score</td>
                  <td className="text-right py-2 px-3 font-bold text-foreground">
                    {(walkData.scores.qualityScore * 100).toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Precision Breakdown */}
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">Precision Breakdown</h3>
            <TierDistributionBar distribution={walkData.tierDistribution} />
          </div>
        </section>

        {/* Stats Grid */}
        <section className="bg-card rounded-xl p-4 shadow-sm border border-border">
          <h2 className="text-sm font-semibold text-foreground mb-3">Walk Statistics</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatsCard 
              label="Sub-area Circumference" 
              value={formatDistance(walkData.stats.circumference)} 
            />
            <StatsCard 
              label="Total Walk Distance" 
              value={formatDistance(walkData.stats.walkDistance)} 
            />
            <StatsCard 
              label="Perimeter Walked" 
              value={formatDistance(walkData.stats.perimeterWalked)} 
            />
            <StatsCard 
              label="Sub-area Size" 
              value={walkData.stats.area > 1_000_000 
                ? `${(walkData.stats.area / 1_000_000).toFixed(2)} km²`
                : `${Math.round(walkData.stats.area).toLocaleString()} m²`
              } 
            />
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center py-4">
          <p className="text-muted-foreground mb-4">
            Want to explore Malmö and track your own walks?
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Try CityCells
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8 py-6">
        <div className="max-w-2xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            CityCells - Gamify your walks around Malmö&apos;s 136 sub-areas
          </p>
        </div>
      </footer>
    </div>
  );
}

// =============================================================================
// Page Export with Suspense
// =============================================================================

export default function SharedWalkPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SharedWalkContent />
    </Suspense>
  );
}
