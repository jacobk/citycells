'use client';

import { useSyncExternalStore } from 'react';

/**
 * Hook to track online/offline status.
 * WHY: Per ADR 014 and TICKET-006, the app needs to detect offline state
 * to show an indicator and disable network-dependent features.
 * 
 * Uses useSyncExternalStore for proper SSR hydration handling.
 * 
 * @returns Object with isOnline boolean
 */
export function useOnlineStatus(): { isOnline: boolean } {
  // WHY: useSyncExternalStore handles SSR correctly by using getServerSnapshot
  // on the server and getSnapshot on the client after hydration.
  const isOnline = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return { isOnline };
}

/**
 * Subscribe to online/offline events.
 */
function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/**
 * Get current online status (client-side).
 */
function getSnapshot(): boolean {
  return navigator.onLine;
}

/**
 * Get online status for server-side rendering.
 * WHY: Assume online during SSR to avoid hydration mismatch.
 */
function getServerSnapshot(): boolean {
  return true;
}
