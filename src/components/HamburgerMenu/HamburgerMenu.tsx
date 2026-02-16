'use client';

import { useRef, useEffect } from 'react';

// ============================================
// Types
// ============================================

interface HamburgerMenuProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAreas: () => void;
  onOpenStats: () => void;
  // WHY: Route toggle controlled from page level per ADR 010 Section 3
  showRoutes: boolean;
  onShowRoutesChange: (show: boolean) => void;
}

// ============================================
// Component
// ============================================

/**
 * HamburgerMenu Component
 * 
 * A floating hamburger menu button in the top-left corner that provides
 * app-wide navigation to Areas list and Stats dashboard.
 * 
 * See ADR 009 and PRD 001 Section 3.10 for requirements.
 * 
 * Features:
 * - 44x44px circular button with hamburger icon
 * - Dropdown menu with "Areas" and "Stats" options
 * - Semi-transparent background matching app theme
 * - Controlled component (state managed by parent for mutual exclusivity)
 * - Click outside to close
 */
export default function HamburgerMenu({ 
  isOpen, 
  onOpenChange, 
  onOpenAreas, 
  onOpenStats,
  showRoutes,
  onShowRoutesChange,
}: HamburgerMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onOpenChange]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onOpenChange]);

  const handleAreasClick = () => {
    onOpenChange(false);
    onOpenAreas();
  };

  const handleStatsClick = () => {
    onOpenChange(false);
    onOpenStats();
  };

  return (
    <div 
      ref={menuRef}
      className="fixed top-4 left-4 z-[400]"
    >
      {/* Hamburger Button */}
      <button
        onClick={() => onOpenChange(!isOpen)}
        className="w-11 h-11 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        {/* WHY: Animated hamburger icon that transforms to X when open */}
        <div className="w-5 h-4 flex flex-col justify-between">
          <span 
            className={`block h-0.5 bg-gray-700 rounded-full transition-transform duration-200 ${
              isOpen ? 'rotate-45 translate-y-[7px]' : ''
            }`}
          />
          <span 
            className={`block h-0.5 bg-gray-700 rounded-full transition-opacity duration-200 ${
              isOpen ? 'opacity-0' : ''
            }`}
          />
          <span 
            className={`block h-0.5 bg-gray-700 rounded-full transition-transform duration-200 ${
              isOpen ? '-rotate-45 -translate-y-[7px]' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      <div 
        className={`absolute top-14 left-0 z-[450] bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-200 ${
          isOpen 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="py-1 min-w-[140px]">
          <button
            onClick={handleAreasClick}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
          >
            {/* Map/Grid icon for Areas */}
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>Areas</span>
          </button>
          
          <button
            onClick={handleStatsClick}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
          >
            {/* Chart/Stats icon */}
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Stats</span>
          </button>
          
          {/* WHY: Divider separates navigation items from settings toggles */}
          <div className="border-t border-gray-100 my-1" />
          
          {/* WHY: Route toggle per ADR 010 - routes hidden by default, toggle to show */}
          <button
            onClick={() => onShowRoutesChange(!showRoutes)}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
            role="switch"
            aria-checked={showRoutes}
          >
            {/* Route/Path icon */}
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="flex-1">Show Routes</span>
            {/* WHY: Visual toggle indicator - uses primary brand color */}
            <div 
              className={`w-8 h-5 rounded-full transition-colors ${
                showRoutes ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <div 
                className={`w-4 h-4 mt-0.5 rounded-full bg-white shadow-sm transition-transform ${
                  showRoutes ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>

          {/* WHY: Divider separates settings from legal links */}
          <div className="border-t border-gray-100 my-1" />

          {/* WHY: Privacy Policy link - required for Strava production access */}
          <a
            href="/privacy"
            onClick={() => onOpenChange(false)}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
          >
            {/* Shield/Privacy icon */}
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Privacy Policy</span>
          </a>
        </div>
      </div>
    </div>
  );
}
