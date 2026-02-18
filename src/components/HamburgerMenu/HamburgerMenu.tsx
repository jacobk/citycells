'use client';

import Link from 'next/link';
import { useRef, useEffect } from 'react';
import type { Theme } from '@/hooks/useTheme';

// ============================================
// Types
// ============================================

interface HamburgerMenuProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAreas: () => void;
  onOpenStats: () => void;
  // WHY: Achievement browser per PRD Section 3.15 and TICKET-023
  onOpenAchievements: () => void;
  achievementCount?: { unlocked: number; total: number };
  // WHY: Route toggle controlled from page level per ADR 010 Section 3
  showRoutes: boolean;
  onShowRoutesChange: (show: boolean) => void;
  // WHY: Theme toggle per PRD Section 3.14 and TICKET-022
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
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
  onOpenAchievements,
  achievementCount,
  showRoutes,
  onShowRoutesChange,
  theme,
  onThemeChange,
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

  const handleAchievementsClick = () => {
    onOpenChange(false);
    onOpenAchievements();
  };

  return (
    <div 
      ref={menuRef}
      className="fixed top-4 left-4 z-[400]"
    >
      {/* Hamburger Button */}
      {/* WHY: Using design system tokens (bg-card, border-border) for dark mode support */}
      <button
        onClick={() => onOpenChange(!isOpen)}
        className="w-11 h-11 bg-card/95 backdrop-blur-sm rounded-full shadow-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors cursor-pointer"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        {/* WHY: Animated hamburger icon that transforms to X when open */}
        <div className="w-5 h-4 flex flex-col justify-between">
          <span 
            className={`block h-0.5 bg-foreground rounded-full transition-transform duration-200 ${
              isOpen ? 'rotate-45 translate-y-[7px]' : ''
            }`}
          />
          <span 
            className={`block h-0.5 bg-foreground rounded-full transition-opacity duration-200 ${
              isOpen ? 'opacity-0' : ''
            }`}
          />
          <span 
            className={`block h-0.5 bg-foreground rounded-full transition-transform duration-200 ${
              isOpen ? '-rotate-45 -translate-y-[7px]' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {/* WHY: Using design system tokens for dark mode support */}
      <div 
        className={`absolute top-14 left-0 z-[450] bg-card/95 backdrop-blur-sm rounded-xl shadow-lg border border-border overflow-hidden transition-all duration-200 ${
          isOpen 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="py-1 min-w-[180px]">
          <button
            onClick={handleAreasClick}
            className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-secondary flex items-center gap-3 cursor-pointer"
          >
            {/* Map/Grid icon for Areas */}
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>Areas</span>
          </button>
          
          <button
            onClick={handleStatsClick}
            className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-secondary flex items-center gap-3 cursor-pointer"
          >
            {/* Chart/Stats icon */}
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Stats</span>
          </button>
          
          {/* WHY: Achievements browser per PRD Section 3.15 and TICKET-023 */}
          <button
            onClick={handleAchievementsClick}
            className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-secondary flex items-center gap-3 cursor-pointer"
          >
            {/* Trophy icon */}
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span className="flex-1">Achievements</span>
            {/* Achievement count badge */}
            {achievementCount && (
              <span className="text-xs text-muted-foreground">
                {achievementCount.unlocked}/{achievementCount.total}
              </span>
            )}
          </button>
          
          {/* WHY: How Scoring Works per ADR 021 Section 7 - links to /docs/scoring */}
          <Link
            href="/docs/scoring"
            onClick={() => onOpenChange(false)}
            className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-secondary flex items-center gap-3"
          >
            {/* Question/Info icon */}
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>How Scoring Works</span>
          </Link>
          
          {/* WHY: Divider separates navigation items from settings toggles */}
          <div className="border-t border-border my-1" />
          
          {/* WHY: Route toggle per ADR 010 - routes hidden by default, toggle to show */}
          <button
            onClick={() => onShowRoutesChange(!showRoutes)}
            className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-secondary flex items-center gap-3 cursor-pointer"
            role="switch"
            aria-checked={showRoutes}
          >
            {/* Route/Path icon */}
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="flex-1">Show Routes</span>
            {/* WHY: Visual toggle indicator - uses primary brand color */}
            <div 
              className={`w-8 h-5 rounded-full transition-colors ${
                showRoutes ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <div 
                className={`w-4 h-4 mt-0.5 rounded-full bg-card shadow-sm transition-transform ${
                  showRoutes ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>

          {/* WHY: Theme toggle per PRD Section 3.14 - System/Light/Dark selector */}
          <div className="px-4 py-2.5">
            <div className="flex items-center gap-3 mb-2">
              {/* Theme icon (adjusts to current theme) */}
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {theme === 'dark' ? (
                  // Moon icon
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                ) : theme === 'light' ? (
                  // Sun icon
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                ) : (
                  // Monitor/System icon
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                )}
              </svg>
              <span className="text-sm text-foreground">Theme</span>
            </div>
            {/* WHY: Segmented control for three-way theme selection */}
            <div className="flex bg-muted rounded-lg p-0.5" role="radiogroup" aria-label="Theme selection">
              {/* Light option */}
              <button
                onClick={() => onThemeChange('light')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  theme === 'light' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                role="radio"
                aria-checked={theme === 'light'}
                aria-label="Light theme"
              >
                {/* Sun icon */}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="hidden sm:inline">Light</span>
              </button>
              
              {/* System option */}
              <button
                onClick={() => onThemeChange('system')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  theme === 'system' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                role="radio"
                aria-checked={theme === 'system'}
                aria-label="System theme"
              >
                {/* Monitor icon */}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">System</span>
              </button>
              
              {/* Dark option */}
              <button
                onClick={() => onThemeChange('dark')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  theme === 'dark' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                role="radio"
                aria-checked={theme === 'dark'}
                aria-label="Dark theme"
              >
                {/* Moon icon */}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span className="hidden sm:inline">Dark</span>
              </button>
            </div>
          </div>

          {/* WHY: Divider separates settings from legal links */}
          <div className="border-t border-border my-1" />

          {/* WHY: Privacy Policy link - required for Strava production access */}
          <a
            href="/privacy"
            onClick={() => onOpenChange(false)}
            className="w-full px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-secondary flex items-center gap-3 cursor-pointer"
          >
            {/* Shield/Privacy icon */}
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Privacy Policy</span>
          </a>
        </div>
      </div>
    </div>
  );
}
