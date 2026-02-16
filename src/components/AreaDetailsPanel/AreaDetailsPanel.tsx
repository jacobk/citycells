'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getTierColor, getTierDisplayName, type Tier, type AnalysisMetrics, SCORE_WEIGHTS } from '@/lib/analysis';
import type { DeviationWithExemption } from '@/lib/exemption-types';
import type { ReactNode } from 'react';
import type { ReAnalysisMode } from '@/lib/analysis-persistence';
// WHY: Dynamic import for Leaflet-based mini-map to avoid SSR issues (ADR 012)
import AreaMiniMap from '@/components/AreaMiniMap';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
// WHY: Panel state management and gesture handling (ADR 015)
import { useExpandablePanel } from '@/hooks/useExpandablePanel';
// WHY: Database hook for route data access (Ticket 011)
import { useDatabase } from '@/hooks/useDatabase';
// WHY: Route visualization for mini-map walk routes (Ticket 011)
import type { RouteSegment } from '@/lib/route-visualization';
import { prepareDeviationColoredRoute } from '@/lib/route-visualization';
import { getWalkStreams, getDatabase } from '@/lib/db';
import { formatDistance } from '@/lib/format-utils';
// WHY: Reuse shared perimeter/walk time formatting per ADR 012 and Ticket 015
import { formatCircumferenceWithTime } from '@/lib/geo-utils';
import mapboxPolyline from '@mapbox/polyline';
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';

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
  // WHY: Activities array for accessing summary_polyline from API (Ticket 011)
  activities?: Array<{ id: number; map?: { summary_polyline?: string } }>;
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
 * - Score breakdown table with weights
 * - Area & perimeter info
 * - Walk history list
 * - Deviations section with exemption controls
 */
export default function AreaDetailsPanel({
  details,
  isOpen,
  onClose,
  onExemptDeviation,
  onRemoveExemption,
  breadcrumbs,
  onReAnalyzeWalk,
  activities = [],
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
  // WHY: Database hook for route data access - matches main map pattern (Ticket 011)
  const { db, loading: dbLoading } = useDatabase();
  // WHY: Route visualization state for mini-map (Ticket 011)
  const [showRoute, setShowRoute] = useState(false);
  const [selectedWalkId, setSelectedWalkId] = useState<number | null>(null);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[] | null>(null);

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

  // WHY: Initialize selected walk when details.walks changes (Ticket 011)
  // Default to best walk, or first walk if only one exists
  useEffect(() => {
    if (!details || details.walks.length === 0) {
      setSelectedWalkId(null);
      setRouteSegments(null);
      setShowRoute(false); // Reset toggle when no walks
      return;
    }

    // Find best walk or use first walk if only one exists
    const bestWalk = details.walks.find(w => w.isBest);
    const walkToSelect = bestWalk || details.walks[0];
    setSelectedWalkId(walkToSelect.id);
  }, [details?.walks]);

  // WHY: Reset route toggle when panel closes (Ticket 011)
  useEffect(() => {
    if (!isOpen) {
      setShowRoute(false);
    }
  }, [isOpen]);

  // WHY: Load route data when selectedWalkId changes (Ticket 011)
  // Matches main map pattern: check db && !dbLoading before accessing streams
  useEffect(() => {
    if (!selectedWalkId || !details?.geometry) {
      setRouteSegments(null);
      return;
    }

    // WHY: Wait for database to be ready before accessing streams (matches main map pattern)
    const hasDb = Boolean(db && !dbLoading);
    if (!hasDb) {
      setRouteSegments(null);
      return;
    }

    try {
      // Try to get stream data first (preferred - full path without privacy zone truncation)
      // WHY: Stream data provides full path without privacy zone truncation (ADR 006)
      const cachedStreams = getWalkStreams(selectedWalkId);
      console.log(`[AreaDetailsPanel] getWalkStreams(${selectedWalkId}) returned:`, cachedStreams ? `streams with ${cachedStreams.latlng.length} points` : 'null');
      let coordinates: Position[] | null = null;

      if (cachedStreams && cachedStreams.latlng.length > 0) {
        // Convert from [lat, lng] to [lng, lat] for GeoJSON format
        coordinates = cachedStreams.latlng.map(([lat, lng]) => [lng, lat]);
        console.log(`[AreaDetailsPanel] Using stream data for walk ${selectedWalkId}: ${coordinates.length} points`);
      } else {
        // Fallback to summary_polyline - prefer from activities array (API), then WalkInfo, then database
        let polyline: string | null = null;
        
        // WHY: Prefer summary_polyline from activities array (matches main map pattern)
        // This is the most reliable source as it comes directly from Strava API
        const activity = activities.find(a => a.id === selectedWalkId);
        if (activity?.map?.summary_polyline) {
          polyline = activity.map.summary_polyline;
          console.log(`[AreaDetailsPanel] Using summary_polyline from activities array for walk ${selectedWalkId}`);
        } else {
          // Fallback to WalkInfo (may be populated during analysis)
          const walkInfo = details.walks.find(w => w.id === selectedWalkId);
          if (walkInfo?.summaryPolyline) {
            polyline = walkInfo.summaryPolyline;
            console.log(`[AreaDetailsPanel] Using summary_polyline from WalkInfo for walk ${selectedWalkId}`);
          } else {
            // Last resort: database polyline (may be truncated)
            const database = getDatabase();
            const result = database.exec(
              'SELECT polyline FROM walks WHERE strava_activity_id = ? LIMIT 1',
              [selectedWalkId]
            );

            if (result.length > 0 && result[0].values.length > 0) {
              polyline = result[0].values[0][0] as string | null;
              if (polyline) {
                console.log(`[AreaDetailsPanel] Using polyline from database for walk ${selectedWalkId}`);
              }
            }
          }
        }

        if (polyline) {
          // Decode polyline and convert from [lat, lng] to [lng, lat] for GeoJSON format
          const decoded = mapboxPolyline.decode(polyline);
          coordinates = decoded.map(pt => [pt[1], pt[0]]);
          console.log(`[AreaDetailsPanel] Using polyline fallback for walk ${selectedWalkId}: ${coordinates.length} points`);
        }
      }

      if (!coordinates || coordinates.length < 2) {
        setRouteSegments(null);
        return;
      }

      // Prepare route segments with deviation coloring
      // WHY: Convert geometry to Feature for prepareDeviationColoredRoute
      const boundaryFeature: Feature<Polygon | MultiPolygon> = {
        type: 'Feature',
        properties: {},
        geometry: details.geometry as Polygon | MultiPolygon,
      };

      const segments = prepareDeviationColoredRoute(coordinates, boundaryFeature);
      console.log(`[AreaDetailsPanel] Prepared ${segments.length} route segments from ${coordinates.length} coordinates`);
      const totalPoints = segments.reduce((sum, seg) => sum + seg.positions.length, 0);
      console.log(`[AreaDetailsPanel] Total points in segments: ${totalPoints}, first segment: ${segments[0]?.positions.length} points, last segment: ${segments[segments.length - 1]?.positions.length} points`);
      setRouteSegments(segments);
    } catch (e) {
      console.error('[AreaDetailsPanel] Failed to load route data:', e);
      setRouteSegments(null);
    }
  }, [selectedWalkId, details?.geometry, db, dbLoading]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

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
          } hover:bg-secondary active:opacity-70`}
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
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground -mr-2 -mt-1"
              aria-label="Close panel"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mini-Map Section (ADR 012, Ticket 015) - fills available viewport height above the fold */}
        {/* WHY: Moved outside scrollable content so it fills available space via flex-grow */}
        {details.geometry && (
          <section className="px-4 py-2 flex flex-col flex-grow min-h-0 shrink-0">
            {/* WHY: Route toggle control per Ticket 011 - routes hidden by default */}
            {details.walks.length > 0 && (
              <button
                onClick={() => setShowRoute(!showRoute)}
                className="w-full mb-2 px-3 py-2 text-left text-sm text-foreground hover:bg-secondary rounded-lg flex items-center gap-3 cursor-pointer transition-colors shrink-0"
                role="switch"
                aria-checked={showRoute}
              >
                {/* Route/Path icon */}
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className="flex-1">Show Walk Route</span>
                {/* WHY: Visual toggle indicator - uses primary brand color */}
                <div 
                  className={`w-8 h-5 rounded-full transition-colors ${
                    showRoute ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <div 
                    className={`w-4 h-4 mt-0.5 rounded-full bg-card shadow-sm transition-transform ${
                      showRoute ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </button>
            )}
            <AreaMiniMap
              geometry={details.geometry}
              tier={details.tier}
              panelState={panelState}
              routeSegments={showRoute ? routeSegments || undefined : undefined}
            />
          </section>
        )}

        {/* Start Walking Button (ADR 017) - fixed position above scrollable content */}
        {/* WHY: Primary brand color for CTA creates cohesive brand experience (ADR 018) */}
        {onStartWalking && details.geometry && (
          <div className="px-4 py-3 border-t border-border shrink-0">
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
          </div>
        )}

        {/* Area Stats Section (Ticket 015) - circumference with walk time, below mini-map */}
        {/* WHY: Shows same quick-reference stats from hover tooltip so users don't need to close panel to see them */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex items-center justify-center gap-2 text-sm">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-muted-foreground font-medium">
              {formatCircumferenceWithTime(details.totalPerimeterMeters)}
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 min-h-0">
          
          {/* Score Breakdown (if completed) */}
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
                    <tr className="border-b border-border">
                      <td className="py-2 px-3 text-foreground">
                        <Link
                          href="/docs/metrics/border-traced"
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Border Traced
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 dark:border-blue-700 text-[10px] text-blue-500 dark:text-blue-400">
                            i
                          </span>
                        </Link>
                      </td>
                      <td className="text-right py-2 px-3 text-foreground font-medium">
                        {(details.metrics.perimeterCoveragePercent * 100).toFixed(0)}%
                      </td>
                      <td className="text-right py-2 px-3 text-muted-foreground">
                        {(SCORE_WEIGHTS.perimeterCoverage * 100).toFixed(0)}%
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-2 px-3 text-foreground">
                        <Link
                          href="/docs/metrics/area-enclosed"
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
                        {(SCORE_WEIGHTS.areaCoverage * 100).toFixed(0)}%
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-2 px-3 text-foreground">
                        <Link
                          href="/docs/metrics/path-precision"
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Path Precision
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 dark:border-blue-700 text-[10px] text-blue-500 dark:text-blue-400">
                            i
                          </span>
                        </Link>
                      </td>
                      <td className="text-right py-2 px-3 text-foreground font-medium">
                        {details.metrics.rmseMeters.toFixed(1)}m
                      </td>
                      <td className="text-right py-2 px-3 text-muted-foreground">
                        {(SCORE_WEIGHTS.alignment * 100).toFixed(0)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-foreground">
                        <Link
                          href="/docs/metrics/route-efficiency"
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Route Efficiency
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 dark:border-blue-700 text-[10px] text-blue-500 dark:text-blue-400">
                            i
                          </span>
                        </Link>
                      </td>
                      <td className="text-right py-2 px-3 text-foreground font-medium">
                        {(details.metrics.efficiency * 100).toFixed(0)}%
                      </td>
                      <td className="text-right py-2 px-3 text-muted-foreground">
                        {(SCORE_WEIGHTS.efficiency * 100).toFixed(0)}%
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
                {details.walks.map(walk => {
                  const isSelected = selectedWalkId === walk.id;
                  return (
                  <div 
                    key={walk.id} 
                    onClick={() => setSelectedWalkId(walk.id)}
                    className={`bg-secondary rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted ${
                      walk.isBest ? 'ring-2 ring-orange-200 dark:ring-orange-700' : ''
                    } ${
                      isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
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
                          onClick={(e) => e.stopPropagation()}
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenWalkMenuId(openWalkMenuId === walk.id ? null : walk.id);
                                }}
                                className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
                                aria-label="Re-analyze walk"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </button>
                            )}
                            {openWalkMenuId === walk.id && (
                              <div 
                                className="absolute right-0 top-full mt-1 bg-card rounded-lg shadow-lg border border-border py-1 z-10 min-w-[140px]"
                                onClick={(e) => e.stopPropagation()}
                              >
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
                  );
                })}
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
    </>
  );
}
