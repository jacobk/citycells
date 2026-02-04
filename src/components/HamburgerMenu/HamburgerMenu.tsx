'use client';

import { useState, useRef, useEffect } from 'react';

// ============================================
// Types
// ============================================

interface HamburgerMenuProps {
  onOpenAreas: () => void;
  onOpenStats: () => void;
}

// ============================================
// Component
// ============================================

/**
 * HamburgerMenu Component
 * 
 * A floating hamburger menu button in the top-right corner that provides
 * app-wide navigation to Areas list and Stats dashboard.
 * 
 * See ADR 008 and PRD 001 Section 3.10 for requirements.
 * 
 * Features:
 * - 44x44px circular button with hamburger icon
 * - Dropdown menu with "Areas" and "Stats" options
 * - Semi-transparent background matching app theme
 * - Click outside to close
 */
export default function HamburgerMenu({ onOpenAreas, onOpenStats }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleAreasClick = () => {
    setIsOpen(false);
    onOpenAreas();
  };

  const handleStatsClick = () => {
    setIsOpen(false);
    onOpenStats();
  };

  return (
    <div 
      ref={menuRef}
      className="fixed top-4 right-4 z-[400]"
    >
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
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
        className={`absolute top-14 right-0 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-200 ${
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
        </div>
      </div>
    </div>
  );
}
