'use client';

/**
 * MapSettingsPanel Component
 *
 * Unified floating panel combining tile style selection and layer visibility
 * toggles. Replaces the previous MapStyleToggle component.
 *
 * Also exports MapStyleClass — a react-leaflet child component that imperatively
 * syncs the CSS class on the Leaflet container (MapContainer className is immutable
 * after mount in react-leaflet v4).
 *
 * @see docs/ADR/027-map-layer-toggles.md
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import { useMapSettings } from '@/hooks/useMapSettings';
import type { MapStyle } from '@/hooks/useMapTileLayer';
import type { LayerKey } from '@/hooks/useMapSettings';

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
// SVG Icons
// ============================================

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

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 17l10 5 10-5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12l10 5 10-5" />
    </svg>
  );
}

// ============================================
// Tile style options
// ============================================

interface StyleOption {
  value: MapStyle;
  label: string;
  icon: React.ReactNode;
}

const ICON_SIZE = 'w-3.5 h-3.5';

const STYLE_OPTIONS: StyleOption[] = [
  { value: 'street', label: 'Gray', icon: <MapIcon className={ICON_SIZE} /> },
  { value: 'color', label: 'Color', icon: <PaletteIcon className={ICON_SIZE} /> },
  { value: 'satellite', label: 'Satellite', icon: <GlobeIcon className={ICON_SIZE} /> },
];

// ============================================
// Layer toggle configuration
// ============================================

interface LayerOption {
  key: LayerKey;
  label: string;
}

const LAYER_OPTIONS: LayerOption[] = [
  { key: 'subareaLines', label: 'Subarea Lines' },
  { key: 'walkLines', label: 'Walk Lines' },
  { key: 'walkShapes', label: 'Walk Shapes' },
  { key: 'heatmap', label: 'Heatmap' },
  { key: 'emojis', label: 'Emojis' },
];

// ============================================
// Toggle Switch sub-component
// ============================================

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      className="w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] text-sm text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span>{label}</span>
      <div
        className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <div
          className={`w-4 h-4 mt-0.5 rounded-full bg-card shadow-sm transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  );
}

// ============================================
// MapSettingsPanel
// ============================================

interface MapSettingsPanelProps {
  /** 'full' shows tile style + layer toggles; 'compact' shows tile style only */
  variant?: 'full' | 'compact';
}

export default function MapSettingsPanel({ variant = 'full' }: MapSettingsPanelProps) {
  const { mapStyle, setStyle, layers, setLayer } = useMapSettings();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [open]);

  const handleStyleSelect = useCallback((style: MapStyle) => {
    setStyle(style);
  }, [setStyle]);

  const isCompact = variant === 'compact';
  const buttonSize = isCompact ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = isCompact ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div ref={panelRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`${buttonSize} bg-card/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-foreground hover:bg-card active:bg-secondary transition-colors`}
        aria-label="Map settings"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <LayersIcon className={iconSize} />
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 bg-card/95 backdrop-blur-sm rounded-lg shadow-xl border border-border overflow-hidden min-w-[200px]"
        >
          {/* Map Style section */}
          <div className="px-3 pt-3 pb-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Map Style
            </div>
            {/* Segmented control — same pattern as theme picker in HamburgerMenu */}
            <div className="flex bg-muted rounded-lg p-0.5" role="radiogroup" aria-label="Map style selection">
              {STYLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleStyleSelect(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    mapStyle === opt.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  role="radio"
                  aria-checked={mapStyle === opt.value}
                  aria-label={opt.label}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Layers section — only in full variant */}
          {!isCompact && (
            <>
              <div className="border-t border-border mx-3" />
              <div className="py-1">
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Layers
                </div>
                {LAYER_OPTIONS.map(opt => (
                  <ToggleSwitch
                    key={opt.key}
                    checked={layers[opt.key]}
                    onChange={() => setLayer(opt.key, !layers[opt.key])}
                    label={opt.label}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
