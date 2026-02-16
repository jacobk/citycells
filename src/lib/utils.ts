/**
 * Utility functions for Shadcn/UI components
 * 
 * WHY: The cn() helper merges Tailwind classes intelligently,
 * handling conflicts and enabling conditional class application.
 * Required by Shadcn/UI components.
 * 
 * @see docs/ADR/018-branding-design-system.md
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with conflict resolution.
 * 
 * @example
 * cn('px-2 py-1', condition && 'bg-primary', 'px-4')
 * // Returns: 'py-1 bg-primary px-4' (px-4 overrides px-2)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
