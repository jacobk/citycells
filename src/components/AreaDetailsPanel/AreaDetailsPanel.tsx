'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getTierColor, getTierDisplayName, type Tier, type AnalysisMetrics, SCORE_WEIGHTS } from '@/lib/analysis';
import type { DeviationWithExemption } from '@/lib/exemption-types';
import type { ReactNode } from 'react';
import type { ReAnalysisMode } from '@/lib/analysis-persistence';
// WHY: Dynamic import for Leaflet-based mini-map to avoid SSR issues (ADR 012)
import AreaMiniMap from '@/components/AreaMiniMap';

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
}: AreaDetailsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // WHY: Track which walk's menu is open (ADR 011)
  const [openWalkMenuId, setOpenWalkMenuId] = useState<number | null>(null);
  // WHY: Track loading state for per-walk re-analyze
  const [reAnalyzingWalkId, setReAnalyzingWalkId] = useState<number | null>(null);

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

  // Format distance for display
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-[500] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[501] transform transition-transform duration-300 ease-out max-h-[85vh] overflow-hidden flex flex-col ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-2 cursor-grab" onClick={onClose}>
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Breadcrumbs (ADR 008) - shown when navigated from list */}
        {breadcrumbs}

        {/* Header */}
        <div className="px-4 pb-3 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{details.areaName}</h2>
              {details.tier ? (
                <div className="flex items-center gap-2 mt-1">
                  <span 
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: tierColor }}
                  >
                    {tierName}
                  </span>
                  <span className="text-sm text-gray-600 font-medium">
                    {(details.qualityScore * 100).toFixed(1)}% Quality Score
                  </span>
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic mt-1">Not yet walked</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 -mr-2 -mt-1"
              aria-label="Close panel"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

          {/* Mini-Map (ADR 012) - shows subarea boundary for route planning */}
          {details.geometry && (
            <section>
              <AreaMiniMap
                geometry={details.geometry}
                tier={details.tier}
              />
            </section>
          )}
          
          {/* Score Breakdown (if completed) */}
          {details.tier && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Score Breakdown</h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Metric</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Value</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-800">
                        <Link
                          href="/docs/metrics/border-traced"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          Border Traced
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 text-[10px] text-blue-500">
                            i
                          </span>
                        </Link>
                      </td>
                      <td className="text-right py-2 px-3 text-gray-900 font-medium">
                        {(details.metrics.perimeterCoveragePercent * 100).toFixed(0)}%
                      </td>
                      <td className="text-right py-2 px-3 text-gray-500">
                        {(SCORE_WEIGHTS.perimeterCoverage * 100).toFixed(0)}%
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-800">
                        <Link
                          href="/docs/metrics/area-enclosed"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          Area Enclosed
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 text-[10px] text-blue-500">
                            i
                          </span>
                        </Link>
                      </td>
                      <td className="text-right py-2 px-3 text-gray-900 font-medium">
                        {(details.metrics.areaCoveragePercent * 100).toFixed(0)}%
                      </td>
                      <td className="text-right py-2 px-3 text-gray-500">
                        {(SCORE_WEIGHTS.areaCoverage * 100).toFixed(0)}%
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-800">
                        <Link
                          href="/docs/metrics/path-precision"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          Path Precision
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 text-[10px] text-blue-500">
                            i
                          </span>
                        </Link>
                      </td>
                      <td className="text-right py-2 px-3 text-gray-900 font-medium">
                        {details.metrics.rmseMeters.toFixed(1)}m
                      </td>
                      <td className="text-right py-2 px-3 text-gray-500">
                        {(SCORE_WEIGHTS.alignment * 100).toFixed(0)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-gray-800">
                        <Link
                          href="/docs/metrics/route-efficiency"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          Route Efficiency
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 text-[10px] text-blue-500">
                            i
                          </span>
                        </Link>
                      </td>
                      <td className="text-right py-2 px-3 text-gray-900 font-medium">
                        {(details.metrics.efficiency * 100).toFixed(0)}%
                      </td>
                      <td className="text-right py-2 px-3 text-gray-500">
                        {(SCORE_WEIGHTS.efficiency * 100).toFixed(0)}%
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100">
                      <td className="py-2 px-3 font-semibold text-gray-900">Quality Score</td>
                      <td className="text-right py-2 px-3 font-bold text-gray-900" colSpan={2}>
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
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Area Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Total Area</div>
                <div className="text-sm font-medium text-gray-900">{formatArea(details.totalAreaSqm)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Sub-area Circumference</div>
                <div className="text-sm font-medium text-gray-900">{formatDistance(details.totalPerimeterMeters)}</div>
              </div>
              {details.tier && (
                <>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Enclosed Area</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatArea(details.metrics.enclosedAreaSqm)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Total Walk Length</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatDistance(details.metrics.totalWalkLengthMeters)}
                    </div>
                  </div>
                  
                  {/* WHY: Show perimeter walked vs circumference to help understand coverage */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Perimeter Walked</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatDistance(details.metrics.coveredDistanceMeters)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Walk vs Circumference</div>
                    {(() => {
                      const diff = details.metrics.totalWalkLengthMeters - details.totalPerimeterMeters;
                      const isOver = diff > 0;
                      return (
                        <div className={`text-sm font-medium ${isOver ? 'text-amber-600' : 'text-green-600'}`}>
                          {isOver ? '+' : ''}{formatDistance(Math.abs(diff))}
                          <span className="text-xs text-gray-500 ml-1">
                            {isOver ? '(detours)' : '(efficient)'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className="col-span-2 bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Loop Status</div>
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      {details.metrics.isClosedLoop ? (
                        <>
                          <span className="text-green-600">✓</span> Closed Loop
                        </>
                      ) : (
                        <>
                          <span className="text-amber-600">⚠</span> Open ({formatDistance(details.metrics.loopGapMeters)} gap)
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
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Walk History ({details.walks.length})
              </h3>
              <div className="space-y-2">
                {details.walks.map(walk => (
                  <div 
                    key={walk.id} 
                    className={`bg-gray-50 rounded-lg p-3 ${walk.isBest ? 'ring-2 ring-orange-200' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <a
                          href={`https://www.strava.com/activities/${walk.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline"
                        >
                          {walk.name}
                        </a>
                        {walk.date && (
                          <div className="text-xs text-gray-500 mt-0.5">{walk.date}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {walk.isBest && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                            Best
                          </span>
                        )}
                        {/* WHY: Per-walk re-analyze menu (ADR 011) */}
                        {onReAnalyzeWalk && (
                          <div className="relative" data-walk-menu>
                            {reAnalyzingWalkId === walk.id ? (
                              <div className="w-6 h-6 flex items-center justify-center">
                                <svg className="w-4 h-4 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              </div>
                            ) : (
                              <button
                                onClick={() => setOpenWalkMenuId(openWalkMenuId === walk.id ? null : walk.id)}
                                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                aria-label="Re-analyze walk"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </button>
                            )}
                            {openWalkMenuId === walk.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[140px]">
                                <button
                                  onClick={() => handleReAnalyzeWalk(walk.id, 'rescore')}
                                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                                >
                                  Re-score
                                </button>
                                <button
                                  onClick={() => handleReAnalyzeWalk(walk.id, 'full')}
                                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                                >
                                  Full re-fetch
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-gray-600">
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
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Detected Deviations ({details.deviations.length})
              </h3>
              <div className="space-y-2">
                {details.deviations.map(deviation => (
                  <div key={deviation.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-gray-800 capitalize">
                          {deviation.classification.replace('_', ' ')}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatDistance(deviation.borderGapMeters)} of border skipped
                        </div>
                      </div>
                      {deviation.isExempt ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <span>✓</span> Exempt
                        </span>
                      ) : null}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        <span className="text-gray-500">Detour: </span>
                        <span className="text-gray-700">{formatDistance(deviation.detourDistanceMeters)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Max deviation: </span>
                        <span className="text-gray-700">{formatDistance(deviation.maxDeviationMeters)}</span>
                      </div>
                    </div>

                    {deviation.isExempt ? (
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          Reason: {deviation.exemptionReason}
                        </div>
                        {onRemoveExemption && (
                          <button
                            onClick={() => onRemoveExemption(deviation.id)}
                            className="text-xs text-red-600 hover:text-red-700 hover:underline"
                          >
                            Remove Exemption
                          </button>
                        )}
                      </div>
                    ) : (
                      onExemptDeviation && (
                        <button
                          onClick={() => onExemptDeviation(deviation.id)}
                          className="w-full text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 py-1.5 rounded font-medium transition-colors"
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
