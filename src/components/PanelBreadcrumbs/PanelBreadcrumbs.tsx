'use client';

// ============================================
// Types
// ============================================

interface PanelBreadcrumbsProps {
  /** The current area name being viewed */
  areaName: string;
  /** Callback when user clicks "Areas" to go back to list */
  onBackToList: () => void;
}

// ============================================
// Component
// ============================================

/**
 * PanelBreadcrumbs Component
 * 
 * Navigation breadcrumbs for the panel, showing the path from
 * Areas list to the current area detail view.
 * 
 * See ADR 008 and PRD 001 Section 3.10 for requirements.
 * 
 * Format: "Areas > Västra Hamnen"
 * - "Areas" is clickable and returns to list view
 * - Current area name is plain text (not clickable)
 */
export default function PanelBreadcrumbs({ areaName, onBackToList }: PanelBreadcrumbsProps) {
  return (
    <nav 
      className="px-4 py-2 bg-gray-50 border-b border-gray-100"
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center text-sm">
        <li>
          <button
            onClick={onBackToList}
            className="text-orange-600 hover:text-orange-700 hover:underline font-medium cursor-pointer"
          >
            Areas
          </button>
        </li>
        <li className="flex items-center">
          <svg 
            className="w-4 h-4 text-gray-400 mx-1" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-700 truncate max-w-[200px]" title={areaName}>
            {areaName}
          </span>
        </li>
      </ol>
    </nav>
  );
}
