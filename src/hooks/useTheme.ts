'use client';

import { useSyncExternalStore, useCallback } from 'react';

// ============================================
// Types
// ============================================

export type Theme = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface UseThemeReturn {
  /** Current theme preference (system, light, or dark) */
  theme: Theme;
  /** Actual applied theme after resolving system preference */
  resolvedTheme: ResolvedTheme;
  /** Update theme preference */
  setTheme: (theme: Theme) => void;
}

// ============================================
// Constants
// ============================================

/**
 * localStorage key for persisting theme preference.
 * WHY: Unique key prefix prevents conflicts with other apps on same domain.
 */
const STORAGE_KEY = 'citycells-theme';

/**
 * Default theme when no preference is stored.
 * WHY: 'system' respects user's OS preference, which is the most accessible default.
 */
const DEFAULT_THEME: Theme = 'system';

// ============================================
// Theme Store (External Store Pattern)
// ============================================

/**
 * WHY: Using a simple external store pattern with useSyncExternalStore
 * for proper SSR hydration handling. This matches the pattern used in
 * useOnlineStatus.ts in this codebase.
 */

let currentTheme: Theme = DEFAULT_THEME;
const listeners: Set<() => void> = new Set();

/**
 * Initialize theme from localStorage (client-side only).
 * Called once when the module loads in browser.
 */
function initializeTheme(): void {
  if (typeof window === 'undefined') return;
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    currentTheme = stored;
  }
}

/**
 * Get the resolved theme (light or dark) based on preference and system setting.
 */
function getResolvedTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Apply the theme by toggling .dark class on <html> element.
 * WHY: The .dark class is already defined in globals.css with all CSS variables.
 */
function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  
  const resolved = getResolvedTheme(theme);
  const html = document.documentElement;
  
  if (resolved === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

/**
 * Update the theme preference, persist to localStorage, and notify listeners.
 */
function setThemeInternal(theme: Theme): void {
  currentTheme = theme;
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  }
  
  // Notify all subscribers
  listeners.forEach(listener => listener());
}

/**
 * Subscribe to theme changes.
 */
function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Get current theme snapshot (client-side).
 */
function getSnapshot(): Theme {
  return currentTheme;
}

/**
 * Get theme for server-side rendering.
 * WHY: Return 'system' during SSR; the inline script in layout.tsx
 * will apply the correct theme before hydration.
 */
function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

// ============================================
// System Preference Listener
// ============================================

/**
 * Listen for OS preference changes when in 'system' mode.
 * WHY: User might change their OS dark mode setting while the app is open.
 */
function setupSystemPreferenceListener(): void {
  if (typeof window === 'undefined') return;
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = () => {
    // Only react if we're in system mode
    if (currentTheme === 'system') {
      applyTheme('system');
      // Notify listeners so resolvedTheme updates
      listeners.forEach(listener => listener());
    }
  };
  
  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
  } else {
    // Fallback for older Safari
    mediaQuery.addListener(handleChange);
  }
}

// ============================================
// Initialization
// ============================================

// Initialize on module load (client-side only)
if (typeof window !== 'undefined') {
  initializeTheme();
  applyTheme(currentTheme);
  setupSystemPreferenceListener();
}

// ============================================
// Hook
// ============================================

/**
 * Hook to manage theme state with persistence and system preference support.
 * 
 * WHY: Centralized theme management enables consistent dark mode across the app.
 * Uses useSyncExternalStore for proper SSR handling (no hydration mismatch).
 * 
 * @see docs/tickets/022-dark-mode-toggle.md
 * @see docs/PRD/001-mvp-mobile-walker.md Section 3.14
 * 
 * @example
 * ```tsx
 * const { theme, resolvedTheme, setTheme } = useTheme();
 * 
 * // theme: 'system' | 'light' | 'dark' (user preference)
 * // resolvedTheme: 'light' | 'dark' (actual applied theme)
 * 
 * <button onClick={() => setTheme('dark')}>Dark Mode</button>
 * ```
 */
export function useTheme(): UseThemeReturn {
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeInternal(newTheme);
  }, []);
  
  const resolvedTheme = getResolvedTheme(theme);
  
  return { theme, resolvedTheme, setTheme };
}
