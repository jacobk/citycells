'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerRegistration Component
 * 
 * Registers the Service Worker for offline support.
 * WHY: Per ADR 014 and TICKET-006, enables the app to work offline by
 * precaching the app shell and caching map tiles on use.
 * 
 * This component renders nothing; it only registers the SW on mount.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // WHY: Only register in browser and if SW is supported.
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // WHY: Register after page load to not block initial render.
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          // WHY: Always check for SW updates, don't use cached SW script.
          updateViaCache: 'none',
        });

        console.log('[App] Service Worker registered with scope:', registration.scope);

        // WHY: Check for updates periodically (every hour).
        // This ensures users get bug fixes without manual refresh.
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

      } catch (error) {
        console.error('[App] Service Worker registration failed:', error);
      }
    };

    // WHY: Delay registration slightly to prioritize initial page load.
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
      return () => window.removeEventListener('load', registerSW);
    }
  }, []);

  // WHY: This component only handles SW registration; renders nothing.
  return null;
}
