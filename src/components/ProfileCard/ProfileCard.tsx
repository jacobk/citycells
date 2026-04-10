'use client';

import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { getTierColor } from '@/lib/analysis';
import type { ProgressInfo } from '@/components/Map';
import type { ReAnalysisMode, ReAnalysisProgress } from '@/lib/analysis-persistence';


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
      {/* WHY: Using design system tokens (bg-card, border-border) for dark mode support */}
      <button
        onClick={onToggle}
        className={`w-12 h-12 bg-card/95 backdrop-blur-sm rounded-full shadow-lg border border-border flex items-center justify-center hover:bg-secondary transition-all duration-200 cursor-pointer overflow-hidden ${
          isExpanded ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
        aria-label={isExpanded ? 'Close profile' : 'Open profile'}
        aria-expanded={isExpanded}
      >
        {athlete ? (
          <Image 
            src={athlete.profile} 
            alt="Profile" 
            width={48}
            height={48}
            className="w-full h-full rounded-full object-cover"
          />
        ) : loading ? (
          <div className="w-6 h-6 bg-muted rounded-full animate-pulse" />
        ) : (
          // User icon for logged out state
          <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </button>

      {/* Expanded state: full card */}
      {/* WHY: Using design system tokens for dark mode support */}
      <div 
        className={`absolute top-0 right-0 z-[450] bg-card/95 backdrop-blur-sm p-4 rounded-xl shadow-lg w-72 border border-border transition-all duration-300 origin-top-right ${
          isExpanded 
            ? 'opacity-100 scale-100 pointer-events-auto' 
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {/* Close button */}
        <button
          onClick={onToggle}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Close profile"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h1 className="font-bold text-xl text-foreground mb-1 pr-6">CityCells: Malmö</h1>
        
        {loading ? (
          <div className="text-sm text-muted-foreground animate-pulse">Checking Strava...</div>
        ) : athlete ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Image src={athlete.profile} alt="Profile" width={40} height={40} className="w-10 h-10 rounded-full border border-border" />
              <div>
                <p className="text-sm font-semibold text-foreground">{athlete.firstname} {athlete.lastname}</p>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">{activitiesCount} Walks Found</p>
              </div>
            </div>
            
            {/* Progress Section */}
            <div className="mb-4">
              <div className="text-xs text-muted-foreground mb-1 flex justify-between">
                <span>Progress</span>
                <span>{progress.completedCount} / {progress.totalAreas > 0 ? progress.totalAreas : '...'}</span>
              </div>
              
              {/* WHY: Multi-segment progress bar showing tier breakdown */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
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
                      <span className="text-muted-foreground">{progress.tierCounts.platinum}</span>
                    </div>
                  )}
                  {progress.tierCounts.gold > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getTierColor('gold') }} />
                      <span className="text-muted-foreground">{progress.tierCounts.gold}</span>
                    </div>
                  )}
                  {progress.tierCounts.silver > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getTierColor('silver') }} />
                      <span className="text-muted-foreground">{progress.tierCounts.silver}</span>
                    </div>
                  )}
                  {progress.tierCounts.bronze > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getTierColor('bronze') }} />
                      <span className="text-muted-foreground">{progress.tierCounts.bronze}</span>
                    </div>
                  )}
                  {progress.tierCounts.potato > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getTierColor('potato') }} />
                      <span className="text-muted-foreground">{progress.tierCounts.potato}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* WHY: Re-analyze section per ADR 011 and PRD 3.10
                Two modes: re-score (fast, uses cached GPS) and full (re-fetches from Strava) */}
            {onReAnalyze && progress.completedCount > 0 && (
              <div className="mb-4 pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <span>Re-analyze Walks</span>
                  <span 
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-border text-[9px] text-muted-foreground cursor-help"
                    title="Re-score: Fast, uses cached GPS data. Use after app updates.&#10;Full: Re-fetches GPS from Strava. Use if you edited activities."
                  >
                    ?
                  </span>
                </div>

                {/* Re-analysis progress indicator */}
                {isReAnalyzing && reAnalysisProgress && (
                  <div className="bg-blue-500/10 dark:bg-blue-500/20 rounded-lg p-2 mb-2 text-xs">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>
                        Re-analyzing {reAnalysisProgress.current} of {reAnalysisProgress.total}...
                      </span>
                    </div>
                    {reAnalysisProgress.currentWalkName && (
                      <div className="text-blue-600 dark:text-blue-400 truncate mt-1 pl-6">
                        {reAnalysisProgress.currentWalkName}
                      </div>
                    )}
                  </div>
                )}

                {/* Error message */}
                {reAnalyzeError && (
                  <div className="bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded-lg p-2 mb-2 text-xs">
                    {reAnalyzeError}
                  </div>
                )}

                {/* Re-analyze buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReAnalyze('rescore')}
                    disabled={isReAnalyzing}
                    className="flex-1 bg-primary/10 text-primary py-1.5 px-3 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Re-score All
                  </button>
                  <button
                    onClick={() => handleReAnalyze('full')}
                    disabled={isReAnalyzing}
                    className="flex-1 bg-primary/10 text-primary py-1.5 px-3 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Full Re-fetch
                  </button>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
                  Re-score: Fast, uses cached GPS. Full: Re-fetches from Strava.
                </div>
              </div>
            )}

            {/* WHY: Data management section - force refresh and clear data (TICKET-016) */}
            {onForceRefresh && (
              <div className="mb-4 pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground mb-2">Sync Activities</div>
                <button
                  onClick={handleForceRefresh}
                  disabled={isRefreshing}
                  title="Re-fetch all activities from Strava"
                  className="w-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 py-1.5 px-3 rounded-lg text-xs font-medium hover:bg-blue-500/20 dark:hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
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
                <div className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
                  Re-fetch all activities from Strava (ignores incremental sync)
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button 
                onClick={onLogout}
                className="flex-1 bg-secondary text-secondary-foreground py-2 px-4 rounded-lg font-medium text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>

            {/* WHY: Clear all data button with confirmation (TICKET-016) 
                Destructive action - requires confirmation to prevent accidental data loss */}
            {onClearData && (
              <div className="mt-3 pt-3 border-t border-border">
                {!showClearConfirm ? (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="w-full text-red-600 dark:text-red-400 text-xs hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer py-1"
                  >
                    Clear All Data
                  </button>
                ) : (
                  <div className="bg-red-500/10 dark:bg-red-500/20 rounded-lg p-3">
                    <p className="text-xs text-red-800 dark:text-red-300 font-medium mb-2">
                      Delete all your walks and analysis data?
                    </p>
                    <p className="text-[10px] text-red-600 dark:text-red-400 mb-3">
                      This will remove all synced activities, scores, and progress. 
                      Your Strava connection will be preserved.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        disabled={isClearing}
                        className="flex-1 bg-card text-muted-foreground py-1.5 px-3 rounded text-xs font-medium hover:bg-secondary transition-colors border border-border cursor-pointer disabled:opacity-50"
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
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
              Track your mission to walk around every sub-area of Malmö.
            </p>
            <button 
              onClick={onLogin}
              className="w-full cursor-pointer transition-opacity hover:opacity-90 flex items-center justify-center"
              aria-label="Connect with Strava"
            >
              {/* WHY: Use official Strava "Connect with Strava" button per Strava API Brand Guidelines
                  Button height: 48px @1x, 96px @2x per guidelines */}
              <Image
                src="/strava/btn_strava_connect_with_orange.svg"
                alt="Connect with Strava"
                width={193}
                height={48}
                className="h-12 w-auto"
                priority
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
