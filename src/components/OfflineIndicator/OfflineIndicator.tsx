'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * OfflineIndicator Component
 * 
 * Displays a banner when the app is offline.
 * WHY: Per ADR 014 and TICKET-006, users need a clear indication when offline
 * to understand why sync and external links are unavailable.
 * 
 * Positioned at the top of the viewport, below the header area.
 * Does not block core navigation per PRD 3.11.
 */
export default function OfflineIndicator() {
  const { isOnline } = useOnlineStatus();

  // WHY: Only render when offline; don't take up space when online.
  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[500] bg-amber-500 text-white text-center py-1.5 px-4 text-sm font-medium shadow-md"
    >
      <span className="inline-flex items-center gap-2">
        {/* WHY: Icon for visual clarity; cloud with slash indicates offline. */}
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 9v2m0 4h.01"
          />
        </svg>
        You&apos;re offline — viewing cached data
      </span>
    </div>
  );
}
