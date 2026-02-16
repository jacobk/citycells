'use client';

import { useRef, useEffect, useState } from 'react';
import { getTierColor } from '@/lib/analysis';
import type { ProgressInfo } from '@/components/Map';
import type { ReAnalysisMode, ReAnalysisProgress } from '@/lib/analysis-persistence';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

// ============================================
// Types
// ============================================

interface ProfileCardProps {
  athlete: { firstname: string; lastname: string; profile: string } | null;
  progress: ProgressInfo;
  loading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  isExpanded: boolean;
  onToggle: () => void;
  activitiesCount: number;
  // WHY: Re-analysis callback for triggering re-analysis from profile card (ADR 011)
  onReAnalyze?: (mode: ReAnalysisMode) => Promise<void>;
  // WHY: Track re-analysis state for UI feedback
  reAnalysisProgress?: ReAnalysisProgress | null;
  // WHY: Clear all data callback for database reset (TICKET-016)
  onClearData?: () => Promise<void>;
  // WHY: Force refresh callback for incremental sync override (TICKET-016)
  onForceRefresh?: () => Promise<void>;
}

// ============================================
// Component
// ============================================

/**
 * ProfileCard Component
 * 
 * A collapsible profile card in the top-right corner showing athlete info,
 * progress bar, and logout button.
 * 
 * See ADR 009 and PRD 001 Section 3.10 for requirements.
 * 
 * Features:
 * - Collapsed state: 48x48px circular avatar button only
 * - Expanded state: Full card with name, progress bar, tier legend, logout
 * - Smooth expand/collapse animation (200-300ms)
 * - Click outside to collapse
 */
export default function ProfileCard({
  athlete,
  progress,
  loading,
  onLogin,
  onLogout,
  isExpanded,
  onToggle,
  activitiesCount,
  onReAnalyze,
  reAnalysisProgress,
  onClearData,
  onForceRefresh,
}: ProfileCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // WHY: Track local loading state for re-analyze buttons (ADR 011)
  const [isReAnalyzing, setIsReAnalyzing] = useState(false);
  const [reAnalyzeError, setReAnalyzeError] = useState<string | null>(null);
  // WHY: Disable re-analyze when offline per ADR 014 and TICKET-006
  const { isOnline } = useOnlineStatus();
  // WHY: Track state for clear data confirmation dialog (TICKET-016)
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  // WHY: Track state for force refresh (TICKET-016)
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle re-analyze button click
  const handleReAnalyze = async (mode: ReAnalysisMode) => {
    if (!onReAnalyze || isReAnalyzing) return;

    setIsReAnalyzing(true);
    setReAnalyzeError(null);

    try {
      await onReAnalyze(mode);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Re-analysis failed';
      setReAnalyzeError(errorMessage);
    } finally {
      setIsReAnalyzing(false);
    }
  };

  // Handle clear all data with confirmation (TICKET-016)
  const handleClearData = async () => {
    if (!onClearData || isClearing) return;

    setIsClearing(true);
    try {
      await onClearData();
      // WHY: Close confirmation dialog after successful clear
      setShowClearConfirm(false);
    } catch (e) {
      console.error('[ProfileCard] Failed to clear data:', e);
    } finally {
      setIsClearing(false);
    }
  };

  // Handle force refresh (TICKET-016)
  const handleForceRefresh = async () => {
    if (!onForceRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onForceRefresh();
    } catch (e) {
      console.error('[ProfileCard] Force refresh failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Close card when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        if (isExpanded) {
          onToggle();
        }
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded, onToggle]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        onToggle();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isExpanded, onToggle]);

  return (
    <div 
      ref={cardRef}
      className="fixed top-4 right-4 z-[400]"
    >
      {/* Collapsed state: avatar button */}
      <button
        onClick={onToggle}
        className={`w-12 h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-all duration-200 cursor-pointer overflow-hidden ${
          isExpanded ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
        aria-label={isExpanded ? 'Close profile' : 'Open profile'}
        aria-expanded={isExpanded}
      >
        {athlete ? (
          <img 
            src={athlete.profile} 
            alt="Profile" 
            className="w-full h-full rounded-full object-cover"
          />
        ) : loading ? (
          <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse" />
        ) : (
          // User icon for logged out state
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </button>

      {/* Expanded state: full card */}
      <div 
        className={`absolute top-0 right-0 z-[450] bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-lg w-72 border border-gray-100 transition-all duration-300 origin-top-right ${
          isExpanded 
            ? 'opacity-100 scale-100 pointer-events-auto' 
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {/* Close button */}
        <button
          onClick={onToggle}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          aria-label="Close profile"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h1 className="font-bold text-xl text-gray-800 mb-1 pr-6">CityCells: Malmö</h1>
        
        {loading ? (
          <div className="text-sm text-gray-500 animate-pulse">Checking Strava...</div>
        ) : athlete ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img src={athlete.profile} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{athlete.firstname} {athlete.lastname}</p>
                <p className="text-xs text-green-600 font-medium">{activitiesCount} Walks Found</p>
              </div>
            </div>
            
            {/* Progress Section */}
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1 flex justify-between">
                <span>Progress</span>
                <span>{progress.completedCount} / {progress.totalAreas > 0 ? progress.totalAreas : '...'}</span>
              </div>
              
              {/* WHY: Multi-segment progress bar showing tier breakdown */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden flex">
                {progress.tierCounts.platinum > 0 && (
                  <div 
                    className="h-2 transition-all duration-1000"
                    style={{ 
                      width: `${(progress.tierCounts.platinum / progress.totalAreas) * 100}%`,
                      backgroundColor: getTierColor('platinum')
                    }}
                  />
                )}
                {progress.tierCounts.gold > 0 && (
                  <div 
                    className="h-2 transition-all duration-1000"
                    style={{ 
                      width: `${(progress.tierCounts.gold / progress.totalAreas) * 100}%`,
                      backgroundColor: getTierColor('gold')
                    }}
                  />
                )}
                {progress.tierCounts.silver > 0 && (
                  <div 
                    className="h-2 transition-all duration-1000"
                    style={{ 
                      width: `${(progress.tierCounts.silver / progress.totalAreas) * 100}%`,
                      backgroundColor: getTierColor('silver')
                    }}
                  />
                )}
                {progress.tierCounts.bronze > 0 && (
                  <div 
                    className="h-2 transition-all duration-1000"
                    style={{ 
                      width: `${(progress.tierCounts.bronze / progress.totalAreas) * 100}%`,
                      backgroundColor: getTierColor('bronze')
                    }}
                  />
                )}
                {progress.tierCounts.potato > 0 && (
                  <div 
                    className="h-2 transition-all duration-1000"
                    style={{ 
                      width: `${(progress.tierCounts.potato / progress.totalAreas) * 100}%`,
                      backgroundColor: getTierColor('potato')
                    }}
                  />
                )}
              </div>

              {/* Tier Legend */}
              {progress.completedCount > 0 && (
                <div className="flex gap-3 mt-2 text-[10px]">
                  {progress.tierCounts.platinum > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getTierColor('platinum') }} />
                      <span className="text-gray-600">{progress.tierCounts.platinum}</span>
                    </div>
                  )}
                  {progress.tierCounts.gold > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getTierColor('gold') }} />
                      <span className="text-gray-600">{progress.tierCounts.gold}</span>
                    </div>
                  )}
                  {progress.tierCounts.silver > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getTierColor('silver') }} />
                      <span className="text-gray-600">{progress.tierCounts.silver}</span>
                    </div>
                  )}
                  {progress.tierCounts.bronze > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getTierColor('bronze') }} />
                      <span className="text-gray-600">{progress.tierCounts.bronze}</span>
                    </div>
                  )}
                  {progress.tierCounts.potato > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getTierColor('potato') }} />
                      <span className="text-gray-600">{progress.tierCounts.potato}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* WHY: Re-analyze section per ADR 011 and PRD 3.10
                Two modes: re-score (fast, uses cached GPS) and full (re-fetches from Strava) */}
            {onReAnalyze && progress.completedCount > 0 && (
              <div className="mb-4 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <span>Re-analyze Walks</span>
                  <span 
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-300 text-[9px] text-gray-400 cursor-help"
                    title="Re-score: Fast, uses cached GPS data. Use after app updates.&#10;Full: Re-fetches GPS from Strava. Use if you edited activities."
                  >
                    ?
                  </span>
                </div>

                {/* Re-analysis progress indicator */}
                {isReAnalyzing && reAnalysisProgress && (
                  <div className="bg-blue-50 rounded-lg p-2 mb-2 text-xs">
                    <div className="flex items-center gap-2 text-blue-700">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>
                        Re-analyzing {reAnalysisProgress.current} of {reAnalysisProgress.total}...
                      </span>
                    </div>
                    {reAnalysisProgress.currentWalkName && (
                      <div className="text-blue-600 truncate mt-1 pl-6">
                        {reAnalysisProgress.currentWalkName}
                      </div>
                    )}
                  </div>
                )}

                {/* Error message */}
                {reAnalyzeError && (
                  <div className="bg-red-50 text-red-700 rounded-lg p-2 mb-2 text-xs">
                    {reAnalyzeError}
                  </div>
                )}

                {/* Re-analyze buttons */}
                {/* WHY: Disable when offline per ADR 014 - re-analyze requires network */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReAnalyze('rescore')}
                    disabled={isReAnalyzing || !isOnline}
                    title={!isOnline ? 'Requires internet' : undefined}
                    className="flex-1 bg-primary/10 text-primary py-1.5 px-3 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Re-score All
                  </button>
                  <button
                    onClick={() => handleReAnalyze('full')}
                    disabled={isReAnalyzing || !isOnline}
                    title={!isOnline ? 'Requires internet' : undefined}
                    className="flex-1 bg-primary/10 text-primary py-1.5 px-3 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Full Re-fetch
                  </button>
                </div>
                <div className="text-[10px] text-gray-400 mt-1.5 leading-tight">
                  {!isOnline ? (
                    <span className="text-amber-600">Offline — re-analysis unavailable</span>
                  ) : (
                    'Re-score: Fast, uses cached GPS. Full: Re-fetches from Strava.'
                  )}
                </div>
              </div>
            )}

            {/* WHY: Data management section - force refresh and clear data (TICKET-016) */}
            {onForceRefresh && (
              <div className="mb-4 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2">Sync Activities</div>
                <button
                  onClick={handleForceRefresh}
                  disabled={isRefreshing || !isOnline}
                  title={!isOnline ? 'Requires internet' : 'Re-fetch all activities from Strava'}
                  className="w-full bg-blue-100 text-blue-700 py-1.5 px-3 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isRefreshing ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Refreshing...
                    </>
                  ) : (
                    'Force Refresh All Activities'
                  )}
                </button>
                <div className="text-[10px] text-gray-400 mt-1.5 leading-tight">
                  {!isOnline ? (
                    <span className="text-amber-600">Offline — sync unavailable</span>
                  ) : (
                    'Re-fetch all activities from Strava (ignores incremental sync)'
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button 
                onClick={onLogout}
                className="flex-1 bg-gray-100 text-gray-600 py-2 px-4 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>

            {/* WHY: Clear all data button with confirmation (TICKET-016) 
                Destructive action - requires confirmation to prevent accidental data loss */}
            {onClearData && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                {!showClearConfirm ? (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="w-full text-red-600 text-xs hover:text-red-700 transition-colors cursor-pointer py-1"
                  >
                    Clear All Data
                  </button>
                ) : (
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs text-red-800 font-medium mb-2">
                      Delete all your walks and analysis data?
                    </p>
                    <p className="text-[10px] text-red-600 mb-3">
                      This will remove all synced activities, scores, and progress. 
                      Your Strava connection will be preserved.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        disabled={isClearing}
                        className="flex-1 bg-white text-gray-600 py-1.5 px-3 rounded text-xs font-medium hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClearData}
                        disabled={isClearing}
                        className="flex-1 bg-red-600 text-white py-1.5 px-3 rounded text-xs font-medium hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {isClearing ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Clearing...
                          </>
                        ) : (
                          'Yes, Delete All'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
              Track your mission to walk around every sub-area of Malmö.
            </p>
            <button 
              onClick={onLogin}
              className="w-full cursor-pointer transition-opacity hover:opacity-90 flex items-center justify-center"
              aria-label="Connect with Strava"
            >
              {/* WHY: Use official Strava "Connect with Strava" button per Strava API Brand Guidelines
                  Button height: 48px @1x, 96px @2x per guidelines */}
              <img
                src="/strava/btn_strava_connect_with_orange.svg"
                alt="Connect with Strava"
                className="h-12 w-auto"
                style={{ maxWidth: '100%' }}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
