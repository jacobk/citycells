'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getTierColor, getTierDisplayName, type Tier } from '@/lib/analysis';
import { formatCircumferenceWithTime } from '@/lib/geo-utils';

// WHY: 500ms long-press threshold per PRD 001 section 3.5
const LONG_PRESS_DURATION_MS = 500;

export interface TooltipData {
  areaId: number;
  areaName: string;
  // WHY: Circumference shown for all areas (completed and not) per ADR 012
  circumferenceMeters?: number;
  tier: Tier;
  qualityScore: number;
  walkCount: number;
  bestWalkId?: number;
  bestWalkName?: string;
  bestWalkDate?: string;
}

interface AreaTooltipProps {
  data: TooltipData | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

/**
 * AreaTooltip Component
 * 
 * Displays a floating tooltip with area information on hover (desktop)
 * or long-press (mobile). See PRD 001 section 3.5.
 * 
 * Features:
 * - Area name
 * - Tier badge with color
 * - Quality score
 * - Walk count
 * - Link to best walk on Strava
 */
export default function AreaTooltip({ data, position, onClose }: AreaTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Adjust position to keep tooltip within viewport
  useEffect(() => {
    if (!position || !tooltipRef.current) {
      // WHY: Initialize state when position changes - necessary for initial render
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdjustedPosition(position);
      return;
    }

    const rect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // WHY: Offset tooltip from cursor/touch point for better UX
    const OFFSET = 16;
    x += OFFSET;
    y += OFFSET;

    // Keep within viewport bounds
    if (x + rect.width > viewportWidth - 16) {
      x = position.x - rect.width - OFFSET;
    }
    if (y + rect.height > viewportHeight - 16) {
      y = position.y - rect.height - OFFSET;
    }
    if (x < 16) x = 16;
    if (y < 16) y = 16;

    setAdjustedPosition({ x, y });
  }, [position]);

  // Close on click outside
  useEffect(() => {
    if (!data) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // WHY: Small delay to prevent immediate close on mobile
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [data, onClose]);

  if (!data || !adjustedPosition) return null;

  const tierColor = getTierColor(data.tier);
  const tierName = getTierDisplayName(data.tier);
  const scorePercent = (data.qualityScore * 100).toFixed(1);

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[1000] bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[200px] max-w-[280px] animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header: Area Name */}
      <div className="font-bold text-gray-900 text-sm mb-1 pr-6">
        {data.areaName}
      </div>

      {/* WHY: Circumference with walk time shown for all areas per ADR 012 / PRD 3.5 */}
      {data.circumferenceMeters != null && (
        <div className="text-xs text-gray-500 mb-2">
          {formatCircumferenceWithTime(data.circumferenceMeters)}
        </div>
      )}

      {/* Close button (mobile) */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1"
        aria-label="Close tooltip"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Tier Badge and Score */}
      {data.tier ? (
        <div className="flex items-center gap-2 mb-2">
          <span 
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: tierColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
            {tierName}
          </span>
          <span className="text-sm text-gray-600 font-medium">
            {scorePercent}%
          </span>
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic mb-2">
          Not yet completed
        </div>
      )}

      {/* Walk Count */}
      {data.walkCount > 0 && (
        <div className="text-xs text-gray-500 mb-2">
          {data.walkCount} {data.walkCount === 1 ? 'walk' : 'walks'} matched
        </div>
      )}

      {/* Best Walk Link */}
      {data.bestWalkId && (
        <div className="border-t border-gray-100 pt-2 mt-2">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Best Walk</div>
          <a
            href={`https://www.strava.com/activities/${data.bestWalkId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            {data.bestWalkName || 'View on Strava'}
          </a>
          {data.bestWalkDate && (
            <div className="text-[10px] text-gray-400 mt-0.5">
              {data.bestWalkDate}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Hook for managing tooltip state
// ============================================

interface UseAreaTooltipReturn {
  tooltipData: TooltipData | null;
  tooltipPosition: { x: number; y: number } | null;
  showTooltip: (data: TooltipData, position: { x: number; y: number }) => void;
  hideTooltip: () => void;
  // Handlers to attach to map layers
  handleMouseEnter: (data: TooltipData, e: L.LeafletMouseEvent) => void;
  handleMouseLeave: () => void;
  handleTouchStart: (data: TooltipData, e: L.LeafletMouseEvent) => void;
  handleTouchEnd: () => void;
}

// Import Leaflet type for event handling
import type * as L from 'leaflet';

export function useAreaTooltip(): UseAreaTooltipReturn {
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchDataRef = useRef<{ data: TooltipData; position: { x: number; y: number } } | null>(null);

  const showTooltip = useCallback((data: TooltipData, position: { x: number; y: number }) => {
    setTooltipData(data);
    setTooltipPosition(position);
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltipData(null);
    setTooltipPosition(null);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Desktop: Show on mouse enter
  const handleMouseEnter = useCallback((data: TooltipData, e: L.LeafletMouseEvent) => {
    const { clientX, clientY } = e.originalEvent as MouseEvent;
    showTooltip(data, { x: clientX, y: clientY });
  }, [showTooltip]);

  // Desktop: Hide on mouse leave
  const handleMouseLeave = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  // Mobile: Start long-press timer
  const handleTouchStart = useCallback((data: TooltipData, e: L.LeafletMouseEvent) => {
    // WHY: Cast to unknown first to satisfy TypeScript when dealing with Leaflet events
    // Leaflet wraps touch events in LeafletMouseEvent but the originalEvent is a TouchEvent
    const originalEvent = e.originalEvent as unknown;
    if (!originalEvent || typeof originalEvent !== 'object') return;
    
    const touchEvent = originalEvent as TouchEvent;
    if (!touchEvent.touches || touchEvent.touches.length === 0) return;
    
    const touch = touchEvent.touches[0];

    touchDataRef.current = {
      data,
      position: { x: touch.clientX, y: touch.clientY }
    };

    // WHY: 500ms long-press threshold per PRD 001 section 3.5
    longPressTimerRef.current = setTimeout(() => {
      if (touchDataRef.current) {
        showTooltip(touchDataRef.current.data, touchDataRef.current.position);
      }
    }, LONG_PRESS_DURATION_MS);
  }, [showTooltip]);

  // Mobile: Cancel long-press timer on touch end
  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchDataRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  return {
    tooltipData,
    tooltipPosition,
    showTooltip,
    hideTooltip,
    handleMouseEnter,
    handleMouseLeave,
    handleTouchStart,
    handleTouchEnd,
  };
}
