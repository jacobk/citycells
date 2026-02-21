'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getTierColor, getTierDisplayName, type Tier, type AnalysisMetrics, TIERED_SCORE_WEIGHTS } from '@/lib/analysis';
import { DISTANCE_TIER_THRESHOLDS, type DistanceTier } from '@/lib/distance-tiers';
import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';
import type { DeviationWithExemption } from '@/lib/exemption-types';
import type { ReactNode } from 'react';
import type { ReAnalysisMode } from '@/lib/analysis-persistence';
// WHY: Dynamic import for Leaflet-based mini-map to avoid SSR issues (ADR 012)
import AreaMiniMap from '@/components/AreaMiniMap';
// WHY: Dynamic import for maximized map modal (ADR 022)
import MaximizedMapModal from '@/components/MaximizedMapModal';
import type { WalkData } from '@/components/MaximizedMapModal';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
// WHY: Panel state management and gesture handling (ADR 015)
import { useExpandablePanel } from '@/hooks/useExpandablePanel';
import { formatDistance } from '@/lib/format-utils';
// WHY: Reuse shared perimeter/walk time formatting per ADR 012 and Ticket 015
import { formatCircumferenceWithTime } from '@/lib/geo-utils';
// WHY: Share modal for sharing walk achievements (ADR 023)
import { ShareModal } from '@/components/ShareModal';
import { buildShareableWalkData, type ShareableWalkData } from '@/lib/share';
// WHY: Encode geometry to polyline for sharing
import polyline from '@mapbox/polyline';

// ============================================
// Types
// ============================================

export interface WalkInfo {
  id: number;
  name: string;
  date?: string;
  distanceMeters?: number;
  qualityScore?: number;
  isBest?: boolean;
  // WHY: summary_polyline from Strava API for route visualization fallback (Ticket 011)
  summaryPolyline?: string;
}

export interface AreaDetails {
  areaId: number;
  areaName: string;
  tier: Tier;
  qualityScore: number;
  metrics: AnalysisMetrics;
  
  // Area geometry info
  totalAreaSqm: number;
  totalPerimeterMeters: number;
  // WHY: Geometry needed for mini-map display (ADR 012)
  geometry?: GeoJSON.Geometry;
  
  // Walk info
  walks: WalkInfo[];
  
  // Deviations (for exemption management)
  deviations: DeviationWithExemption[];
}

interface AreaDetailsPanelProps {
  details: AreaDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onExemptDeviation?: (deviationId: number) => void;
  onRemoveExemption?: (deviationId: number) => void;
  // WHY: Optional breadcrumbs slot for navigation when accessed from list (ADR 008)
  breadcrumbs?: ReactNode;
  // WHY: Per-walk re-analyze callback (ADR 011)
  onReAnalyzeWalk?: (walkId: number, mode: ReAnalysisMode) => Promise<void>;

  // WHY: Callback to start live walking mode for this area (ADR 017)
  onStartWalking?: (areaId: number) => void;
}

// ============================================
// Component
// ============================================

/**
 * AreaDetailsPanel Component
 * 
 * A slide-up bottom sheet showing detailed information about an area.
 * See PRD 001 section 3.6 for requirements.
 * 
 * Features:
 * - Header with area name, tier badge, score
 * - Compact scrollable mini-map with maximize button (ADR 022)
 * - Score breakdown table with weights
 * - Area & perimeter info
 * - Walk history list
 * - Deviations section with exemption controls
 * 
 * @see docs/ADR/022-scrollable-minimap-with-maximize.md
 */
export default function AreaDetailsPanel({
  details,
  isOpen,
  onClose,
  onExemptDeviation,
  onRemoveExemption,
  breadcrumbs,
  onReAnalyzeWalk,
  onStartWalking,
}: AreaDetailsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // WHY: Track which walk's menu is open (ADR 011)
  const [openWalkMenuId, setOpenWalkMenuId] = useState<number | null>(null);
  // WHY: Track loading state for per-walk re-analyze
  const [reAnalyzingWalkId, setReAnalyzingWalkId] = useState<number | null>(null);
  // WHY: Disable per-walk re-analyze when offline per ADR 014
  const { isOnline } = useOnlineStatus();
  // WHY: Panel state management and gesture handling (ADR 015)
  const { state: panelState, height: panelHeight, handlers, isDragging } = useExpandablePanel({
    isOpen,
    onClose,
  });
  // WHY: Track maximized map modal state (ADR 022)
  const [isMaximizedMapOpen, setIsMaximizedMapOpen] = useState(false);
  // WHY: Track share modal state (ADR 023)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Handle per-walk re-analyze
  const handleReAnalyzeWalk = async (walkId: number, mode: ReAnalysisMode) => {
    if (!onReAnalyzeWalk) return;
    
    setReAnalyzingWalkId(walkId);
    setOpenWalkMenuId(null);
    
    try {
      await onReAnalyzeWalk(walkId, mode);
    } catch (e) {
      console.error('[AreaDetailsPanel] Re-analyze walk failed:', e);
    } finally {
      setReAnalyzingWalkId(null);
    }
  };

  // WHY: Reset maximized map state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setIsMaximizedMapOpen(false);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isMaximizedMapOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isMaximizedMapOpen, onClose]);

  // WHY: Close walk menu when clicking outside (ADR 011)
  useEffect(() => {
    if (openWalkMenuId === null) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Close if clicking outside the menu
      const target = e.target as HTMLElement;
      if (!target.closest('[data-walk-menu]')) {
        setOpenWalkMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openWalkMenuId]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!details) return null;

  const tierColor = getTierColor(details.tier);
  const tierName = getTierDisplayName(details.tier);

  // Format area for display
  const formatArea = (sqm: number): string => {
    if (sqm > 1_000_000) {
      return `${(sqm / 1_000_000).toFixed(2)} km²`;
    }
    return `${Math.round(sqm).toLocaleString()} m²`;
  };

  // WHY: Convert WalkInfo to WalkData for MaximizedMapModal
  const walksForModal: WalkData[] = details.walks.map(walk => ({
    id: walk.id,
    name: walk.name,
    date: walk.date,
    isBest: walk.isBest,
    summaryPolyline: walk.summaryPolyline,
  }));

  // WHY: Build shareable walk data for share modal (ADR 023)
  // Only compute when there are walks to share
  const shareableData: ShareableWalkData | null = (() => {
    if (details.walks.length === 0 || !details.geometry) return null;
    
    // Get the best walk (or first if no best)
    const bestWalk = details.walks.find(w => w.isBest) || details.walks[0];
    if (!bestWalk.summaryPolyline) return null;
    
    try {
      // Encode boundary geometry to polyline
      // WHY: Extract coordinates from geometry for polyline encoding
      let boundaryCoords: number[][] = [];
      if (details.geometry.type === 'Polygon') {
        boundaryCoords = details.geometry.coordinates[0] as number[][];
      } else if (details.geometry.type === 'MultiPolygon') {
        // Use first polygon for simplicity
        boundaryCoords = details.geometry.coordinates[0][0] as number[][];
      }
      
      // Convert from [lng, lat] to [lat, lng] for polyline encoding
      const boundaryLatLng = boundaryCoords.map(([lng, lat]) => [lat, lng]);
      const boundaryPolyline = polyline.encode(boundaryLatLng as [number, number][]);
      
      return buildShareableWalkData({
        areaId: details.areaId,
        areaName: details.areaName,
        walkDate: bestWalk.date || new Date().toISOString().split('T')[0],
        stravaActivityId: bestWalk.id,
        boundaryPolyline,
        walkPathPolyline: bestWalk.summaryPolyline,
        metrics: details.metrics,
        tier: details.tier,
        circumferenceMeters: details.totalPerimeterMeters,
        areaSqm: details.totalAreaSqm,
      });
    } catch (e) {
      console.error('[AreaDetailsPanel] Failed to build shareable data:', e);
      return null;
    }
  })();

  // WHY: Calculate backdrop opacity based on panel state (more opaque when expanded)
  const backdropOpacity = panelState === 'fullscreen' ? 'bg-black/40' : 
                          panelState === 'expanded' ? 'bg-black/30' : 
                          'bg-black/20';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 ${backdropOpacity} z-[500] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      {/* WHY: Using design system tokens for dark mode support */}
      <div
        ref={panelRef}
        className={`fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-[501] transform transition-[transform,height] duration-300 ease-out overflow-hidden flex flex-col ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: isOpen ? panelHeight : '0' }}
      >
        {/* Drag Handle */}
        {/* WHY: 48px touch target for easy dragging (ADR 015) */}
        <div 
          className={`flex justify-center py-6 transition-opacity duration-150 ${
            isDragging ? 'cursor-grabbing opacity-70' : 'cursor-grab opacity-100'
          } hover:bg-secondary active:opacity-70 shrink-0`}
          {...handlers}
        >
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Breadcrumbs (ADR 008) - shown when navigated from list */}
        {breadcrumbs}

        {/* Header */}
        <div className="px-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">{details.areaName}</h2>
              {details.tier ? (
                <div className="flex items-center gap-2 mt-1">
                  <span 
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: tierColor }}
                  >
                    {tierName}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">
                    {(details.qualityScore * 100).toFixed(1)}% Quality Score
                  </span>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic mt-1">Not yet walked</div>
              )}
            </div>
            <div className="flex items-center gap-1 -mr-2 -mt-1">
              {/* WHY: Share button per ADR 023 - only show when shareableData is available
                  This ensures summaryPolyline exists for the best walk, not just that walks exist */}
              {shareableData && (
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                  aria-label="Share walk"
                  title="Share walk"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-muted-foreground hover:text-foreground"
                aria-label="Close panel"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content - ADR 022 changed layout to fully scrollable */}
        {/* WHY: Mini-map is now inside scrollable content, not fixed above it */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          
          {/* Mini-Map Section (ADR 022) - compact scrollable with maximize button */}
          {details.geometry && (
            <section>
              <AreaMiniMap
                geometry={details.geometry}
                tier={details.tier}
                onMaximize={() => setIsMaximizedMapOpen(true)}
              />
            </section>
          )}

          {/* Start Walking Button (ADR 017) */}
          {/* WHY: Primary brand color for CTA creates cohesive brand experience (ADR 018) */}
          {onStartWalking && details.geometry && (
            <button
              onClick={() => onStartWalking(details.areaId)}
              className="w-full bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {/* Walking person icon */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start Walking
            </button>
          )}

          {/* Area Stats Section (Ticket 015) - circumference with walk time */}
          {/* WHY: Shows same quick-reference stats from hover tooltip so users don't need to close panel to see them */}
          <div className="flex items-center justify-center gap-2 text-sm py-2 border-y border-border">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-muted-foreground font-medium">
              {formatCircumferenceWithTime(details.totalPerimeterMeters)}
            </span>
          </div>
          
          {/* Score Breakdown (if completed) */}
          {/* WHY: Updated from 4 metrics to 3 per ADR 021 - tiered border score absorbs alignment */}
          {details.tier && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">Score Breakdown</h3>
              <div className="bg-secondary rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Metric</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Value</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* WHY: Boundary Coverage (tieredBorderScore) replaces Border Traced per ADR 021 Section 5 */}
                    <tr className="border-b border-border">
                      <td className="py-2 px-3 text-foreground">
                        <Link
                          href="/docs/scoring/boundary-coverage"
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Boundary Coverage
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 dark:border-blue-700 text-[10px] text-blue-500 dark:text-blue-400">
                            i
                          </span>
                        </Link>
                      </td>
                      <td className="text-right py-2 px-3 text-foreground font-medium">
                        {(details.metrics.tieredBorderScore * 100).toFixed(0)}%
                      </td>
                      <td className="text-right py-2 px-3 text-muted-foreground">
                        {(TIERED_SCORE_WEIGHTS.tieredBorder * 100).toFixed(0)}%
                      </td>
                    </tr>
                    {/* Area Enclosed - unchanged per ADR 021 */}
                    <tr className="border-b border-border">
                      <td className="py-2 px-3 text-foreground">
                        <Link
                          href="/docs/scoring/area-enclosed"
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Area Enclosed
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 dark:border-blue-700 text-[10px] text-blue-500 dark:text-blue-400">
                            i
                          </span>
                        </Link>
                      </td>
                      <td className="text-right py-2 px-3 text-foreground font-medium">
                        {(details.metrics.areaCoveragePercent * 100).toFixed(0)}%
                      </td>
                      <td className="text-right py-2 px-3 text-muted-foreground">
                        {(TIERED_SCORE_WEIGHTS.areaCoverage * 100).toFixed(0)}%
                      </td>
                    </tr>
                    {/* WHY: Walk Focus replaces Route Efficiency per ADR 021 Section 5 - clearer name */}
                    <tr>
                      <td className="py-2 px-3 text-foreground">
                        <Link
                          href="/docs/scoring/walk-focus"
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Walk Focus
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 dark:border-blue-700 text-[10px] text-blue-500 dark:text-blue-400">
                            i
                          </span>
                        </Link>
                      </td>
                      <td className="text-right py-2 px-3 text-foreground font-medium">
                        {(details.metrics.walkFocus * 100).toFixed(0)}%
                      </td>
                      <td className="text-right py-2 px-3 text-muted-foreground">
                        {(TIERED_SCORE_WEIGHTS.walkFocus * 100).toFixed(0)}%
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted">
                      <td className="py-2 px-3 font-semibold text-foreground">Quality Score</td>
                      <td className="text-right py-2 px-3 font-bold text-foreground" colSpan={2}>
                        {(details.qualityScore * 100).toFixed(1)}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* WHY: Tier distribution shows exactly where quality was gained/lost per ADR 021 Section 8 */}
              {details.metrics.tierDistribution && (
                <section className="mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                    Precision Breakdown
                  </h4>
                  <div className="space-y-1.5">
                    {(['platinum', 'gold', 'silver', 'bronze', 'potato', 'missed'] as DistanceTier[]).map((tier) => {
                      const percentage = (details.metrics.tierDistribution[tier] || 0) * 100;
                      // WHY: Get threshold label - missed is >50m, others use DISTANCE_TIER_THRESHOLDS
                      const thresholdLabel = tier === 'missed' 
                        ? '>50m' 
                        : `≤${DISTANCE_TIER_THRESHOLDS[tier]}m`;
                      return (
                        <div key={tier} className="flex items-center gap-2">
                          {/* Color swatch */}
                          <div 
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: DISTANCE_TIER_COLORS[tier] }}
                          />
                          {/* Tier name and threshold */}
                          <div className="flex items-center gap-1 min-w-[90px] shrink-0">
                            <span className="text-xs font-medium text-foreground capitalize">{tier}</span>
                            <span className="text-[10px] text-muted-foreground">({thresholdLabel})</span>
                          </div>
                          {/* Progress bar */}
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-300"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: DISTANCE_TIER_COLORS[tier],
                              }}
                            />
                          </div>
                          {/* Percentage */}
                          <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </section>
          )}

          {/* Area & Perimeter Info */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">Area Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Total Area</div>
                <div className="text-sm font-medium text-foreground">{formatArea(details.totalAreaSqm)}</div>
              </div>
              <div className="bg-secondary rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Sub-area Circumference</div>
                <div className="text-sm font-medium text-foreground">{formatDistance(details.totalPerimeterMeters)}</div>
              </div>
              {details.tier && (
                <>
                  <div className="bg-secondary rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Enclosed Area</div>
                    <div className="text-sm font-medium text-foreground">
                      {formatArea(details.metrics.enclosedAreaSqm)}
                    </div>
                  </div>
                  <div className="bg-secondary rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Total Walk Length</div>
                    <div className="text-sm font-medium text-foreground">
                      {formatDistance(details.metrics.totalWalkLengthMeters)}
                    </div>
                  </div>
                  
                  {/* WHY: Show perimeter walked vs circumference to help understand coverage */}
                  <div className="bg-secondary rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Perimeter Walked</div>
                    <div className="text-sm font-medium text-foreground">
                      {formatDistance(details.metrics.coveredDistanceMeters)}
                    </div>
                  </div>
                  <div className="bg-secondary rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Walk vs Circumference</div>
                    {(() => {
                      const diff = details.metrics.totalWalkLengthMeters - details.totalPerimeterMeters;
                      const isOver = diff > 0;
                      return (
                        <div className={`text-sm font-medium ${isOver ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                          {isOver ? '+' : ''}{formatDistance(Math.abs(diff))}
                          <span className="text-xs text-muted-foreground ml-1">
                            {isOver ? '(detours)' : '(efficient)'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className="col-span-2 bg-secondary rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Loop Status</div>
                    <div className="text-sm font-medium text-foreground flex items-center gap-2">
                      {details.metrics.isClosedLoop ? (
                        <>
                          <span className="text-green-600 dark:text-green-400">✓</span> Closed Loop
                        </>
                      ) : (
                        <>
                          <span className="text-amber-600 dark:text-amber-400">⚠</span> Open ({formatDistance(details.metrics.loopGapMeters)} gap)
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Walk History */}
          {details.walks.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Walk History ({details.walks.length})
              </h3>
              <div className="space-y-2">
                {details.walks.map(walk => (
                  <div 
                    key={walk.id} 
                    className={`bg-secondary rounded-lg p-3 ${
                      walk.isBest ? 'ring-2 ring-orange-200 dark:ring-orange-700' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {walk.name && (
                          <div className="text-sm font-medium text-foreground mb-1">{walk.name}</div>
                        )}
                        {/* WHY: Use "View on Strava" text format with exact Strava orange (#FC5200) per Strava API Brand Guidelines */}
                        <a
                          href={`https://www.strava.com/activities/${walk.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:underline"
                          style={{ color: '#FC5200' }}
                        >
                          View on Strava
                        </a>
                        {walk.date && (
                          <div className="text-xs text-muted-foreground mt-0.5">{walk.date}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {walk.isBest && (
                          <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">
                            Best
                          </span>
                        )}
                        {/* WHY: Per-walk re-analyze menu (ADR 011)
                            Hidden when offline per ADR 014 - re-analyze requires network */}
                        {onReAnalyzeWalk && isOnline && (
                          <div className="relative" data-walk-menu>
                            {reAnalyzingWalkId === walk.id ? (
                              <div className="w-6 h-6 flex items-center justify-center">
                                <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              </div>
                            ) : (
                              <button
                                onClick={() => setOpenWalkMenuId(openWalkMenuId === walk.id ? null : walk.id)}
                                className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
                                aria-label="Re-analyze walk"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </button>
                            )}
                            {openWalkMenuId === walk.id && (
                              <div className="absolute right-0 top-full mt-1 bg-card rounded-lg shadow-lg border border-border py-1 z-10 min-w-[140px]">
                                <button
                                  onClick={() => handleReAnalyzeWalk(walk.id, 'rescore')}
                                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
                                >
                                  Re-score
                                </button>
                                <button
                                  onClick={() => handleReAnalyzeWalk(walk.id, 'full')}
                                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
                                >
                                  Full re-fetch
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      {walk.distanceMeters && (
                        <span>{formatDistance(walk.distanceMeters)}</span>
                      )}
                      {walk.qualityScore !== undefined && (
                        <span>{(walk.qualityScore * 100).toFixed(0)}% score</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Deviations */}
          {details.deviations.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Detected Deviations ({details.deviations.length})
              </h3>
              <div className="space-y-2">
                {details.deviations.map(deviation => (
                  <div key={deviation.id} className="bg-secondary rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-foreground capitalize">
                          {deviation.classification.replace('_', ' ')}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDistance(deviation.borderGapMeters)} of border skipped
                        </div>
                      </div>
                      {deviation.isExempt ? (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <span>✓</span> Exempt
                        </span>
                      ) : null}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        <span className="text-muted-foreground">Detour: </span>
                        <span className="text-foreground">{formatDistance(deviation.detourDistanceMeters)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Max deviation: </span>
                        <span className="text-foreground">{formatDistance(deviation.maxDeviationMeters)}</span>
                      </div>
                    </div>

                    {deviation.isExempt ? (
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          Reason: {deviation.exemptionReason}
                        </div>
                        {onRemoveExemption && (
                          <button
                            onClick={() => onRemoveExemption(deviation.id)}
                            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline"
                          >
                            Remove Exemption
                          </button>
                        )}
                      </div>
                    ) : (
                      onExemptDeviation && (
                        <button
                          onClick={() => onExemptDeviation(deviation.id)}
                          className="w-full text-xs bg-muted hover:bg-muted/80 text-foreground py-1.5 rounded font-medium transition-colors"
                        >
                          Mark as Exempt
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>

      {/* Maximized Map Modal (ADR 022) */}
      {details.geometry && (
        <MaximizedMapModal
          isOpen={isMaximizedMapOpen}
          onClose={() => setIsMaximizedMapOpen(false)}
          geometry={details.geometry}
          tier={details.tier}
          walks={walksForModal}
          areaName={details.areaName}
        />
      )}

      {/* Share Modal (ADR 023) */}
      {shareableData && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          data={shareableData}
        />
      )}
    </>
  );
}
