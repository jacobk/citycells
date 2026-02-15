'use client';

/**
 * useWakeLock Hook
 * 
 * Manages Screen Wake Lock API to keep the display on during active walking.
 * Handles browser support detection, visibility changes, and graceful degradation.
 * 
 * WHY: Browser apps lose location tracking when the screen turns off. Wake Lock
 * keeps the screen on so users can follow boundaries without manually preventing
 * screen timeout.
 * 
 * LIMITATIONS:
 * - iOS Safari does not support Screen Wake Lock API
 * - Wake Lock is released when document becomes hidden (user switches apps)
 * - Must be requested in response to user interaction on some browsers
 * 
 * @see docs/ADR/017-live-walking-mode.md
 * @see docs/tickets/017-live-walking-mode.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

// WHY: Use existing TypeScript types for Screen Wake Lock API
// Modern TypeScript includes WakeLock types, but we access via navigator safely

export interface UseWakeLockReturn {
  /** Whether Screen Wake Lock API is supported in this browser */
  isSupported: boolean;
  /** Whether wake lock is currently active */
  isActive: boolean;
  /** Request wake lock (keeps screen on) */
  request: () => Promise<void>;
  /** Release wake lock */
  release: () => Promise<void>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if Screen Wake Lock API is supported.
 */
function isWakeLockSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'wakeLock' in navigator;
}

/**
 * Detect if running on iOS Safari (no Wake Lock support).
 * WHY: Show iOS-specific tip about screen timeout settings.
 */
export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebKit = /WebKit/.test(ua);
  const isChrome = /CriOS/.test(ua);
  const isFirefox = /FxiOS/.test(ua);
  // iOS Safari is iOS + WebKit but not Chrome/Firefox
  return isIOS && isWebKit && !isChrome && !isFirefox;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useWakeLock(): UseWakeLockReturn {
  const [isSupported] = useState(() => isWakeLockSupported());
  const [isActive, setIsActive] = useState(false);
  
  // WHY: Store wake lock sentinel in ref to release on unmount
  // WakeLockSentinel is the built-in TypeScript type from lib.dom.d.ts
  const wakeLockRef = useRef<globalThis.WakeLockSentinel | null>(null);
  // WHY: Track if we should re-acquire when visibility changes
  const shouldReacquireRef = useRef(false);
  
  /**
   * Request wake lock to keep screen on.
   */
  const request = useCallback(async () => {
    if (!isSupported) {
      console.warn('[useWakeLock] Screen Wake Lock not supported');
      return;
    }
    
    try {
      // WHY: TypeScript's WakeLock type is available in modern lib.dom.d.ts
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setIsActive(true);
      shouldReacquireRef.current = true;
      
      // WHY: Handle wake lock being released (e.g., low battery)
      sentinel.addEventListener('release', () => {
        setIsActive(false);
        wakeLockRef.current = null;
      });
      
      console.log('[useWakeLock] Wake lock acquired');
    } catch (err) {
      // WHY: Wake Lock can fail due to low battery, tab not visible, etc.
      console.warn('[useWakeLock] Failed to acquire wake lock:', err);
      setIsActive(false);
    }
  }, [isSupported]);
  
  /**
   * Release wake lock.
   */
  const release = useCallback(async () => {
    shouldReacquireRef.current = false;
    
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      try {
        await wakeLockRef.current.release();
        console.log('[useWakeLock] Wake lock released');
      } catch (err) {
        console.warn('[useWakeLock] Failed to release wake lock:', err);
      }
    }
    
    wakeLockRef.current = null;
    setIsActive(false);
  }, []);
  
  // WHY: Re-acquire wake lock when page becomes visible again
  // Wake lock is automatically released when document becomes hidden
  useEffect(() => {
    if (!isSupported) return;
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && shouldReacquireRef.current) {
        // Re-acquire wake lock when tab becomes visible
        console.log('[useWakeLock] Re-acquiring wake lock after visibility change');
        await request();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupported, request]);
  
  // WHY: Release wake lock on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        wakeLockRef.current.release().catch(() => {
          // Ignore errors during cleanup
        });
      }
    };
  }, []);
  
  return {
    isSupported,
    isActive,
    request,
    release,
  };
}
