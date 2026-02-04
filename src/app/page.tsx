'use client';

import CityMap, { type AreaClickData, type ProgressInfo } from '@/components/Map';
import { useStrava } from '@/hooks/useStrava';
import { useState, useCallback } from 'react';
import { getTierColor, type AnalysisMetrics } from '@/lib/analysis';
import { ProgressDashboard } from '@/components/ProgressDashboard';
import { AreaDetailsPanel, type AreaDetails } from '@/components/AreaDetailsPanel';
import { ExemptionModal } from '@/components/ExemptionModal';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { SubAreaListPanel, type SortOption } from '@/components/SubAreaListPanel';
import { PanelBreadcrumbs } from '@/components/PanelBreadcrumbs';
import type { ExemptionReason } from '@/lib/exemption-types';

// ============================================
// Types - Panel Navigation State (ADR 008)
// ============================================

type PanelView = 
  | { type: 'closed' }
  | { type: 'area-list'; sortBy: SortOption }
  | { type: 'area-detail'; areaId: number; fromList: boolean };

const EMPTY_METRICS: AnalysisMetrics = {
  perimeterCoveragePercent: 0,
  coveredDistanceMeters: 0,
  areaCoveragePercent: 0,
  enclosedAreaSqm: 0,
  isClosedLoop: false,
  loopGapMeters: 0,
  rmseMeters: 0,
  maxDeviationMeters: 0,
  p90DeviationMeters: 0,
  alignmentScore: 0,
  efficiency: 0,
  borderAlignedLengthMeters: 0,
  totalWalkLengthMeters: 0,
  rawQualityScore: 0,
  tier: null,
};

export default function Home() {
  const { athlete, activities, loading, login, logout } = useStrava();
  const [progress, setProgress] = useState<ProgressInfo>({ 
    completedCount: 0, 
    totalAreas: 0,
    tierCounts: { platinum: 0, gold: 0, silver: 0, bronze: 0 }
  });
  
  // WHY: State for all areas data from Map (ADR 008)
  const [allAreas, setAllAreas] = useState<Map<number, AreaClickData>>(new Map());
  
  // WHY: Unified panel navigation state (ADR 008)
  const [panelView, setPanelView] = useState<PanelView>({ type: 'closed' });
  
  // WHY: Separate state for ProgressDashboard since it's a right drawer, not bottom sheet
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  
  // WHY: State for exemption modal
  const [exemptionDeviationId, setExemptionDeviationId] = useState<number | null>(null);
  const [exemptionDeviationInfo, setExemptionDeviationInfo] = useState<{
    classification: string;
    borderGapMeters: number;
    detourDistanceMeters: number;
  } | null>(null);

  const handleProgress = useCallback((progressInfo: ProgressInfo) => {
    setProgress(progressInfo);
  }, []);

  // WHY: Handler for when Map loads all area data (ADR 008)
  const handleAreasLoaded = useCallback((areas: Map<number, AreaClickData>) => {
    setAllAreas(areas);
  }, []);

  // WHY: Compute current area details based on panelView state
  const selectedAreaDetails: AreaDetails | null = (() => {
    if (panelView.type !== 'area-detail') return null;
    const data = allAreas.get(panelView.areaId);
    if (!data) return null;
    return {
      areaId: data.areaId,
      areaName: data.areaName,
      tier: data.tier,
      qualityScore: data.qualityScore,
      metrics: data.metrics ?? EMPTY_METRICS,
      totalAreaSqm: data.totalAreaSqm,
      totalPerimeterMeters: data.totalPerimeterMeters,
      walks: data.walks,
      deviations: data.deviations,
    };
  })();

  // WHY: Handler to close any bottom panel
  const handleClosePanel = useCallback(() => {
    setPanelView({ type: 'closed' });
  }, []);

  // WHY: Handler when clicking an area on the map (not from list)
  const handleAreaClick = useCallback((data: AreaClickData) => {
    setPanelView({ type: 'area-detail', areaId: data.areaId, fromList: false });
  }, []);

  // WHY: Handler when selecting an area from the list (ADR 008)
  const handleSelectAreaFromList = useCallback((areaId: number) => {
    setPanelView({ type: 'area-detail', areaId, fromList: true });
  }, []);

  // WHY: Handler to go back to list from area detail (ADR 008)
  const handleBackToList = useCallback(() => {
    // Preserve the sort option when going back
    setPanelView(prev => {
      if (prev.type === 'area-detail') {
        return { type: 'area-list', sortBy: 'circumference-asc' };
      }
      return prev;
    });
  }, []);

  // WHY: Handler for sort change in list panel
  const handleSortChange = useCallback((sortBy: SortOption) => {
    setPanelView(prev => {
      if (prev.type === 'area-list') {
        return { ...prev, sortBy };
      }
      return prev;
    });
  }, []);

  // WHY: Hamburger menu handlers (ADR 008)
  const handleOpenAreas = useCallback(() => {
    setPanelView({ type: 'area-list', sortBy: 'circumference-asc' });
  }, []);

  const handleOpenStats = useCallback(() => {
    setIsDashboardOpen(true);
  }, []);

  // WHY: Handler to open exemption modal from details panel
  const handleExemptDeviation = useCallback((deviationId: number) => {
    // Find the deviation in the selected area details
    const deviation = selectedAreaDetails?.deviations.find(d => d.id === deviationId);
    if (deviation) {
      setExemptionDeviationId(deviationId);
      setExemptionDeviationInfo({
        classification: deviation.classification,
        borderGapMeters: deviation.borderGapMeters,
        detourDistanceMeters: deviation.detourDistanceMeters,
      });
    }
  }, [selectedAreaDetails]);

  // WHY: Handler to confirm exemption from modal
  // Dynamic import to avoid bundling sql.js at build time
  const handleConfirmExemption = useCallback(async (reason: ExemptionReason, customReason?: string) => {
    if (exemptionDeviationId !== null) {
      try {
        const { addExemption } = await import('@/lib/exemptions');
        await addExemption(exemptionDeviationId, reason, customReason);
        // Close modal and refresh data
        setExemptionDeviationId(null);
        setExemptionDeviationInfo(null);
        // TODO: Refresh area details to show updated score
      } catch (error) {
        console.error('Failed to add exemption:', error);
      }
    }
  }, [exemptionDeviationId]);

  // WHY: Handler to remove exemption from details panel
  // Dynamic import to avoid bundling sql.js at build time
  const handleRemoveExemption = useCallback(async (deviationId: number) => {
    try {
      const { removeExemption } = await import('@/lib/exemptions');
      await removeExemption(deviationId);
      // TODO: Refresh area details to show updated score
    } catch (error) {
      console.error('Failed to remove exemption:', error);
    }
  }, []);

  return (
    <main className="min-h-screen relative overflow-hidden">
      <CityMap
        activities={activities}
        athleteId={athlete?.id}
        onProgressChange={handleProgress}
        onAreaClick={handleAreaClick}
        onAreasLoaded={handleAreasLoaded}
      />
      
      {/* Hamburger Menu (ADR 008) */}
      <HamburgerMenu 
        onOpenAreas={handleOpenAreas}
        onOpenStats={handleOpenStats}
      />
      
      {/* Overlay UI - Status Card */}
      <div className="absolute top-4 left-4 z-[400] bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-lg w-72 border border-gray-100">
        <h1 className="font-bold text-xl text-gray-800 mb-1">CityCells: Malmö</h1>
        
        {loading ? (
          <div className="text-sm text-gray-500 animate-pulse">Checking Strava...</div>
        ) : athlete ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img src={athlete.profile} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{athlete.firstname} {athlete.lastname}</p>
                <p className="text-xs text-green-600 font-medium">{activities.length} Walks Found</p>
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
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={logout}
                className="flex-1 bg-gray-100 text-gray-600 py-2 px-4 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
              Track your mission to walk around every sub-area of Malmö.
            </p>
            <button 
              onClick={login}
              className="w-full bg-[#fc4c02] text-white py-2.5 px-4 rounded-lg font-bold text-sm hover:bg-[#e34402] transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              Connect with Strava
            </button>
          </div>
        )}
      </div>

      {/* Progress Dashboard Drawer */}
      <ProgressDashboard
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        completedCount={progress.completedCount}
        totalAreas={progress.totalAreas}
        tierCounts={progress.tierCounts}
        athleteName={athlete ? `${athlete.firstname} ${athlete.lastname}` : undefined}
        athleteProfile={athlete?.profile}
      />

      {/* Sub-Area List Panel (ADR 008) */}
      <SubAreaListPanel
        isOpen={panelView.type === 'area-list'}
        onClose={handleClosePanel}
        areas={allAreas}
        sortBy={panelView.type === 'area-list' ? panelView.sortBy : 'circumference-asc'}
        onSortChange={handleSortChange}
        onSelectArea={handleSelectAreaFromList}
      />

      {/* Area Details Bottom Sheet */}
      <AreaDetailsPanel
        details={selectedAreaDetails}
        isOpen={panelView.type === 'area-detail'}
        onClose={handleClosePanel}
        onExemptDeviation={handleExemptDeviation}
        onRemoveExemption={handleRemoveExemption}
        // WHY: Show breadcrumbs only when navigated from list (ADR 008)
        breadcrumbs={
          panelView.type === 'area-detail' && panelView.fromList && selectedAreaDetails ? (
            <PanelBreadcrumbs
              areaName={selectedAreaDetails.areaName}
              onBackToList={handleBackToList}
            />
          ) : undefined
        }
      />

      {/* Exemption Modal */}
      <ExemptionModal
        isOpen={exemptionDeviationId !== null}
        onClose={() => {
          setExemptionDeviationId(null);
          setExemptionDeviationInfo(null);
        }}
        onConfirm={handleConfirmExemption}
        deviationInfo={exemptionDeviationInfo ?? undefined}
      />
    </main>
  );
}
