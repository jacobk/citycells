'use client';

import { useEffect, useMemo } from 'react';
import SubAreaListItem, { type SubAreaListItemData } from './SubAreaListItem';
import type { AreaClickData } from '@/components/Map';

// ============================================
// Types
// ============================================

export type SortOption = 
  | 'circumference-asc' 
  | 'circumference-desc'
  | 'name-asc'
  | 'status-walked'
  | 'status-unwalked';

interface SubAreaListPanelProps {
  isOpen: boolean;
  onClose: () => void;
  areas: Map<number, AreaClickData>;
  sortBy: SortOption;
  onSortChange: (sortBy: SortOption) => void;
  onSelectArea: (areaId: number) => void;
}

// ============================================
// Helper Functions
// ============================================

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'circumference-asc', label: 'Circumference (shortest)' },
  { value: 'circumference-desc', label: 'Circumference (longest)' },
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'status-walked', label: 'Walked first' },
  { value: 'status-unwalked', label: 'Unwalked first' },
];

function sortAreas(areas: SubAreaListItemData[], sortBy: SortOption): SubAreaListItemData[] {
  const sorted = [...areas];
  
  switch (sortBy) {
    case 'circumference-asc':
      return sorted.sort((a, b) => a.perimeterMeters - b.perimeterMeters);
    case 'circumference-desc':
      return sorted.sort((a, b) => b.perimeterMeters - a.perimeterMeters);
    case 'name-asc':
      return sorted.sort((a, b) => a.areaName.localeCompare(b.areaName, 'sv'));
    case 'status-walked':
      return sorted.sort((a, b) => {
        // Walked areas first, then by circumference
        if (a.tier && !b.tier) return -1;
        if (!a.tier && b.tier) return 1;
        return a.perimeterMeters - b.perimeterMeters;
      });
    case 'status-unwalked':
      return sorted.sort((a, b) => {
        // Unwalked areas first, then by circumference
        if (!a.tier && b.tier) return -1;
        if (a.tier && !b.tier) return 1;
        return a.perimeterMeters - b.perimeterMeters;
      });
    default:
      return sorted;
  }
}

// ============================================
// Component
// ============================================

/**
 * SubAreaListPanel Component
 * 
 * A slide-up bottom sheet showing a sortable list of all sub-areas.
 * Users can browse areas, see completion status, and drill into details.
 * 
 * See ADR 008 and PRD 001 Section 3.10 for requirements.
 * 
 * Features:
 * - Sortable list by circumference, name, or status
 * - Shows tier badges for completed areas
 * - Tap to navigate to area details
 */
export default function SubAreaListPanel({
  isOpen,
  onClose,
  areas,
  sortBy,
  onSortChange,
  onSelectArea,
}: SubAreaListPanelProps) {
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

  // Transform Map to sorted array
  const sortedAreas = useMemo(() => {
    const areaList: SubAreaListItemData[] = [];
    
    areas.forEach((data, areaId) => {
      areaList.push({
        areaId,
        areaName: data.areaName,
        perimeterMeters: data.totalPerimeterMeters,
        tier: data.tier,
        walkCount: data.walks.length,
      });
    });

    return sortAreas(areaList, sortBy);
  }, [areas, sortBy]);

  // Calculate stats
  const completedCount = sortedAreas.filter(a => a.tier !== null).length;
  const totalCount = sortedAreas.length;

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
      {/* WHY: Using design system tokens for dark mode support */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-[501] transform transition-transform duration-300 ease-out max-h-[85vh] overflow-hidden flex flex-col ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-2 cursor-grab" onClick={onClose}>
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Sub-Areas</h2>
              <p className="text-sm text-muted-foreground">
                {completedCount} of {totalCount} completed
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground -mr-2"
              aria-label="Close panel"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="mt-3">
            <label htmlFor="sort-select" className="sr-only">Sort by</label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto">
          {sortedAreas.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <p>Loading areas...</p>
            </div>
          ) : (
            <div>
              {sortedAreas.map(area => (
                <SubAreaListItem
                  key={area.areaId}
                  data={area}
                  onClick={onSelectArea}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
