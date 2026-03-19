'use client';

/**
 * useMapTileLayer Hook
 *
 * Globally-shared, SSR-safe hook for switching between street and satellite map tiles.
 * Follows the same useSyncExternalStore + localStorage pattern as useTheme.ts.
 *
 * @see docs/ADR/025-satellite-map-toggle.md
 */

import { useSyncExternalStore, useCallback } from 'react';
import {
  TILE_LAYER_URL,
  TILE_LAYER_ATTRIBUTION,
  SATELLITE_TILE_URL,
  SATELLITE_TILE_ATTRIBUTION,
} from '@/lib/map-config';

// ============================================
// Types
// ============================================

export type MapStyle = 'street' | 'color' | 'satellite';

export interface UseMapTileLayerReturn {
  tileUrl: string;
  tileAttribution: string;
  mapStyle: MapStyle;
  isSatellite: boolean;
  setStyle: (style: MapStyle) => void;
}

// ============================================
// Constants
// ============================================

const STORAGE_KEY = 'citycells-map-style';
const DEFAULT_STYLE: MapStyle = 'street';

// ============================================
// External Store
// ============================================

let currentStyle: MapStyle = DEFAULT_STYLE;
const listeners: Set<() => void> = new Set();

function initializeStyle(): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'street' || stored === 'color' || stored === 'satellite') {
      currentStyle = stored;
    }
  } catch {
    // localStorage may not be available in some environments
  }
}

function setStyleInternal(style: MapStyle): void {
  currentStyle = style;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, style);
    } catch {
      // localStorage may not be available
    }
  }

  listeners.forEach(listener => listener());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): MapStyle {
  return currentStyle;
}

function getServerSnapshot(): MapStyle {
  return DEFAULT_STYLE;
}

// Initialize on module load (client-side only)
if (typeof window !== 'undefined') {
  initializeStyle();
}

// ============================================
// Exported store functions (for testing)
// ============================================

export function getMapStyle(): MapStyle {
  return currentStyle;
}

export function setMapStyle(style: MapStyle): void {
  setStyleInternal(style);
}

export function resetMapStyle(): void {
  currentStyle = DEFAULT_STYLE;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage may not be available
    }
  }
  listeners.forEach(listener => listener());
}

// ============================================
// Hook
// ============================================

export function useMapTileLayer(): UseMapTileLayerReturn {
  const style = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setStyle = useCallback((next: MapStyle) => {
    setStyleInternal(next);
  }, []);

  const isSatellite = style === 'satellite';

  return {
    tileUrl: isSatellite ? SATELLITE_TILE_URL : TILE_LAYER_URL,
    tileAttribution: isSatellite ? SATELLITE_TILE_ATTRIBUTION : TILE_LAYER_ATTRIBUTION,
    mapStyle: style,
    isSatellite,
    setStyle,
  };
}
