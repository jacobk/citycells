'use client';

import { cn } from '@/lib/utils';

/**
 * Brand Component
 * 
 * Single source of truth for CityCells logo rendering.
 * Uses inline SVG for CSS theming support (colors adapt to light/dark mode).
 * 
 * @see docs/ADR/018-branding-design-system.md
 * @see public/branding/ for source assets
 */

interface BrandProps {
  /** 'full' shows logo + text, 'isotype' shows icon only */
  variant?: 'full' | 'isotype';
  /** Use inverted colors (for dark backgrounds) */
  inverted?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
}

// WHY: Size presets ensure consistent sizing across the app
const SIZE_CLASSES = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-12',
} as const;

const ISOTYPE_ASPECT = 'aspect-square';
const FULL_ASPECT = 'aspect-[240/64]';

/**
 * Hexagonal cell cluster SVG - represents the CityCells concept
 * WHY: Inline SVG allows CSS variable theming for light/dark mode support
 */
function IsotypeSvg({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 64 64" 
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          {/* WHY: Using currentColor allows CSS to control the gradient stops */}
          <stop offset="0%" className="[stop-color:var(--primary)]" />
          <stop offset="100%" className="[stop-color:var(--accent)]" />
        </linearGradient>
      </defs>
      {/* Center hex */}
      <path d="M32 12 L44 20 L44 36 L32 44 L20 36 L20 20 Z" fill="url(#brandGrad)" />
      {/* Top-right hex */}
      <path d="M44 4 L56 12 L56 28 L44 36 L32 28 L32 12 Z" fill="url(#brandGrad)" opacity="0.7" />
      {/* Bottom-right hex */}
      <path d="M44 36 L56 44 L56 60 L44 68 L32 60 L32 44 Z" fill="url(#brandGrad)" opacity="0.5" />
      {/* Left hex */}
      <path d="M20 20 L32 28 L32 44 L20 52 L8 44 L8 28 Z" fill="url(#brandGrad)" opacity="0.6" />
    </svg>
  );
}

/**
 * Full logo SVG with text
 */
function FullLogoSvg({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 240 64" 
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brandGradFull" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="[stop-color:var(--primary)]" />
          <stop offset="100%" className="[stop-color:var(--accent)]" />
        </linearGradient>
      </defs>
      {/* Isotype: Hexagonal cell cluster */}
      {/* Center hex */}
      <path d="M32 12 L44 20 L44 36 L32 44 L20 36 L20 20 Z" fill="url(#brandGradFull)" />
      {/* Top-right hex */}
      <path d="M44 4 L56 12 L56 28 L44 36 L32 28 L32 12 Z" fill="url(#brandGradFull)" opacity="0.7" />
      {/* Bottom-right hex */}
      <path d="M44 36 L56 44 L56 60 L44 68 L32 60 L32 44 Z" fill="url(#brandGradFull)" opacity="0.5" />
      {/* Left hex */}
      <path d="M20 20 L32 28 L32 44 L20 52 L8 44 L8 28 Z" fill="url(#brandGradFull)" opacity="0.6" />
      {/* Text: CityCells */}
      <text 
        x="72" 
        y="42" 
        fontFamily="var(--font-geist-sans), system-ui, sans-serif" 
        fontSize="28" 
        fontWeight="600"
        className={inverted ? 'fill-white' : 'fill-foreground'}
      >
        City
        <tspan fill="url(#brandGradFull)">Cells</tspan>
      </text>
    </svg>
  );
}

/**
 * Brand component - renders the CityCells logo
 * 
 * @example
 * // Icon only, medium size
 * <Brand variant="isotype" size="md" />
 * 
 * @example
 * // Full logo with text
 * <Brand variant="full" size="lg" />
 * 
 * @example
 * // For dark backgrounds
 * <Brand variant="full" inverted />
 */
export default function Brand({ 
  variant = 'full', 
  inverted = false, 
  className,
  size = 'md',
}: BrandProps) {
  const sizeClass = SIZE_CLASSES[size];
  const aspectClass = variant === 'isotype' ? ISOTYPE_ASPECT : FULL_ASPECT;
  
  return (
    <div 
      className={cn(
        'inline-flex items-center',
        sizeClass,
        aspectClass,
        className
      )}
      role="img"
      aria-label="CityCells logo"
    >
      {variant === 'isotype' ? (
        <IsotypeSvg className="h-full w-auto" />
      ) : (
        <FullLogoSvg className="h-full w-auto" inverted={inverted} />
      )}
    </div>
  );
}
