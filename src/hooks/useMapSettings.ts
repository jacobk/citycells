'use client';

/**
 * useMapSettings Hook
 *
 * Combines tile style selection (via useMapTileLayer) with layer visibility
 * toggles for the unified Map Settings panel. Follows the same
 * useSyncExternalStore + localStorage pattern as useMapTileLayer.ts.
 *
 * @see docs/ADR/027-map-layer-toggles.md
 */

import { useSyncExternalStore, useCallback } from 'react';
import { useMapTileLayer } from '@/hooks/useMapTileLayer';
import type { UseMapTileLayerReturn } from '@/hooks/useMapTileLayer';

// ============================================
// Types
// ============================================

export interface LayerToggles {
  subareaLines: boolean;
  walkLines: boolean;
  walkShapes: boolean;
  heatmap: boolean;
  emojis: boolean;
}

export type LayerKey = keyof LayerToggles;

export interface UseMapSettingsReturn extends UseMapTileLayerReturn {
  layers: LayerToggles;
  setLayer: (layer: LayerKey, value: boolean) => void;
}

// ============================================
// Constants
// ============================================

const STORAGE_KEYS: Record<LayerKey, string> = {
  subareaLines: 'citycells-layer-subarea-lines',
  walkLines: 'citycells-layer-walk-lines',
  walkShapes: 'citycells-layer-walk-shapes',
  heatmap: 'citycells-layer-heatmap',
  emojis: 'citycells-layer-emojis',
};

const DEFAULTS: LayerToggles = {
  subareaLines: true,
  walkLines: false,
  walkShapes: false,
  heatmap: true,
  emojis: false,
};

// ============================================
// External Store
// ============================================

let currentLayers: LayerToggles = { ...DEFAULTS };
const listeners: Set<() => void> = new Set();

function initializeLayers(): void {
  if (typeof window === 'undefined') return;

  try {
    for (const key of Object.keys(DEFAULTS) as LayerKey[]) {
      const stored = localStorage.getItem(STORAGE_KEYS[key]);
      if (stored === 'true' || stored === 'false') {
        currentLayers[key] = stored === 'true';
      }
    }
  } catch {
    // localStorage may not be available
  }
}

function setLayerInternal(layer: LayerKey, value: boolean): void {
  if (currentLayers[layer] === value) return;

  currentLayers = { ...currentLayers, [layer]: value };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEYS[layer], String(value));
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

function getSnapshot(): LayerToggles {
  return currentLayers;
}

function getServerSnapshot(): LayerToggles {
  return DEFAULTS;
}

// Initialize on module load (client-side only)
if (typeof window !== 'undefined') {
  initializeLayers();
}

// ============================================
// Exported store functions (for testing)
// ============================================

export function getLayerToggles(): LayerToggles {
  return currentLayers;
}

export function setLayerToggle(layer: LayerKey, value: boolean): void {
  setLayerInternal(layer, value);
}

export function resetLayerToggles(): void {
  currentLayers = { ...DEFAULTS };
  if (typeof window !== 'undefined') {
    try {
      for (const key of Object.keys(STORAGE_KEYS) as LayerKey[]) {
        localStorage.removeItem(STORAGE_KEYS[key]);
      }
    } catch {
      // localStorage may not be available
    }
  }
  listeners.forEach(listener => listener());
}

// ============================================
// Hook
// ============================================

export function useMapSettings(): UseMapSettingsReturn {
  const tileLayer = useMapTileLayer();

  const layers = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setLayer = useCallback((layer: LayerKey, value: boolean) => {
    setLayerInternal(layer, value);
  }, []);

  return {
    ...tileLayer,
    layers,
    setLayer,
  };
}
