'use client';

/**
 * MapStyleToggle Component
 *
 * Floating button that opens a popover menu to select map style:
 * Grayscale (default), Color, or Satellite.
 *
 * Also exports MapStyleClass — a react-leaflet child component that imperatively
 * syncs the CSS class on the Leaflet container (MapContainer className is immutable
 * after mount in react-leaflet v4).
 *
 * @see docs/ADR/025-satellite-map-toggle.md
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import { useMapTileLayer } from '@/hooks/useMapTileLayer';
import type { MapStyle } from '@/hooks/useMapTileLayer';

// ============================================
// MapStyleClass (leaflet container sync)
// ============================================

const STYLE_CLASSES: Record<MapStyle, string | null> = {
  street: 'grayscale-tiles',
  color: null,
  satellite: 'satellite-tiles',
};

/**
 * Place inside every <MapContainer> to keep the container's CSS class
 * in sync with the current map style. Needed because MapContainer's
 * className prop is immutable after mount in react-leaflet v4.
 */
export function MapStyleClass({ mapStyle }: { mapStyle: MapStyle }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    Object.values(STYLE_CLASSES).forEach(cls => {
      if (cls) container.classList.remove(cls);
    });
    const cls = STYLE_CLASSES[mapStyle];
    if (cls) container.classList.add(cls);
  }, [map, mapStyle]);

  return null;
}

// ============================================
// Menu options
// ============================================

interface StyleOption {
  value: MapStyle;
  label: string;
  icon: React.ReactNode;
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const ICON_SIZE = 'w-4 h-4';

const OPTIONS: StyleOption[] = [
  { value: 'street', label: 'Grayscale', icon: <MapIcon className={ICON_SIZE} /> },
  { value: 'color', label: 'Color', icon: <PaletteIcon className={ICON_SIZE} /> },
  { value: 'satellite', label: 'Satellite', icon: <GlobeIcon className={ICON_SIZE} /> },
];

// ============================================
// Active style icon (for the trigger button)
// ============================================

function ActiveIcon({ mapStyle, className }: { mapStyle: MapStyle; className?: string }) {
  if (mapStyle === 'color') return <PaletteIcon className={className} />;
  if (mapStyle === 'satellite') return <GlobeIcon className={className} />;
  return <MapIcon className={className} />;
}

// ============================================
// MapStyleToggle
// ============================================

interface MapStyleToggleProps {
  /** Small size variant for compact maps (e.g., AreaMiniMap) */
  small?: boolean;
}

export default function MapStyleToggle({ small = false }: MapStyleToggleProps) {
  const { mapStyle, setStyle } = useMapTileLayer();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [open]);

  const handleSelect = useCallback((style: MapStyle) => {
    setStyle(style);
    setOpen(false);
  }, [setStyle]);

  const buttonSize = small ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = small ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`${buttonSize} bg-card/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-foreground hover:bg-card active:bg-secondary transition-colors`}
        aria-label="Map style"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ActiveIcon mapStyle={mapStyle} className={iconSize} />
      </button>

      {/* Menu */}
      {open && (
        <div
          role="listbox"
          aria-label="Map style"
          className="absolute bottom-full mb-2 right-0 bg-card/95 backdrop-blur-sm rounded-lg shadow-xl border border-border overflow-hidden min-w-[140px]"
        >
          {OPTIONS.map(opt => {
            const selected = opt.value === mapStyle;
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={selected}
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  selected
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-secondary'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
                {selected && (
                  <svg className="w-3.5 h-3.5 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
