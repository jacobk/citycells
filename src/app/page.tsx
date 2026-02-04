'use client';

import CityMap, { type AreaClickData, type ProgressInfo } from '@/components/Map';
import { useStrava } from '@/hooks/useStrava';
import { useState, useCallback } from 'react';
import { type AnalysisMetrics } from '@/lib/analysis';
import { ProgressDashboard } from '@/components/ProgressDashboard';
import { AreaDetailsPanel, type AreaDetails } from '@/components/AreaDetailsPanel';
import { ExemptionModal } from '@/components/ExemptionModal';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { SubAreaListPanel, type SortOption } from '@/components/SubAreaListPanel';
import { PanelBreadcrumbs } from '@/components/PanelBreadcrumbs';
import { ProfileCard } from '@/components/ProfileCard';
import type { ExemptionReason } from '@/lib/exemption-types';

// ============================================
// Types - Panel Navigation State (ADR 008)
// ============================================

type PanelView = 
  | { type: 'closed' }
  | { type: 'area-list'; sortBy: SortOption }
  | { type: 'area-detail'; areaId: number; fromList: boolean };

// ============================================
// Types - UI Overlay State (ADR 009)
// ============================================

// WHY: Mutual exclusivity - only one overlay (hamburger menu OR profile card) 
// can be open at a time. See ADR 009 for rationale.
type UIOverlayState = 
  | { type: 'none' }
  | { type: 'hamburger-menu' }
  | { type: 'profile-card' };

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
  
  // WHY: UI overlay state for mutual exclusivity (ADR 009)
  // Only one of hamburger menu or profile card can be open at a time
  const [overlayState, setOverlayState] = useState<UIOverlayState>({ type: 'none' });
  
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
    // Close any open overlay when opening a panel (ADR 009)
    setOverlayState({ type: 'none' });
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

  // ============================================
  // Hamburger Menu Handlers (ADR 009)
  // ============================================

  // WHY: Controlled open/close for mutual exclusivity
  const handleHamburgerOpenChange = useCallback((open: boolean) => {
    setOverlayState(open ? { type: 'hamburger-menu' } : { type: 'none' });
  }, []);

  const handleOpenAreas = useCallback(() => {
    setPanelView({ type: 'area-list', sortBy: 'circumference-asc' });
    // Close overlay when opening panel
    setOverlayState({ type: 'none' });
  }, []);

  const handleOpenStats = useCallback(() => {
    setIsDashboardOpen(true);
    // Close overlay when opening dashboard
    setOverlayState({ type: 'none' });
  }, []);

  // ============================================
  // Profile Card Handlers (ADR 009)
  // ============================================

  // WHY: Toggle profile card with mutual exclusivity
  const handleProfileToggle = useCallback(() => {
    setOverlayState(prev => 
      prev.type === 'profile-card' ? { type: 'none' } : { type: 'profile-card' }
    );
  }, []);

  // ============================================
  // Exemption Handlers
  // ============================================

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
      
      {/* Hamburger Menu - Top Left (ADR 009) */}
      <HamburgerMenu 
        isOpen={overlayState.type === 'hamburger-menu'}
        onOpenChange={handleHamburgerOpenChange}
        onOpenAreas={handleOpenAreas}
        onOpenStats={handleOpenStats}
      />
      
      {/* Profile Card - Top Right, Collapsible (ADR 009) */}
      <ProfileCard
        athlete={athlete}
        progress={progress}
        loading={loading}
        onLogin={login}
        onLogout={logout}
        isExpanded={overlayState.type === 'profile-card'}
        onToggle={handleProfileToggle}
        activitiesCount={activities.length}
      />

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
