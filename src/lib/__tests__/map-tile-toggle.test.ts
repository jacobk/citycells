/**
 * Tests for map tile toggle store logic.
 *
 * @see docs/ADR/025-satellite-map-toggle.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// WHY: Mock map-config before importing the hook
vi.mock('@/lib/map-config', () => ({
  TILE_LAYER_URL: 'https://osm.test/{z}/{x}/{y}.png',
  TILE_LAYER_ATTRIBUTION: 'OSM',
  SATELLITE_TILE_URL: 'https://esri.test/{z}/{y}/{x}',
  SATELLITE_TILE_ATTRIBUTION: 'Esri',
}));

import { getMapStyle, setMapStyle, resetMapStyle } from '@/hooks/useMapTileLayer';
import { TILE_LAYER_URL, SATELLITE_TILE_URL } from '@/lib/map-config';

describe('map tile toggle store', () => {
  beforeEach(() => {
    resetMapStyle();
  });

  it('defaults to street style', () => {
    expect(getMapStyle()).toBe('street');
  });

  it('cycles through all three styles', () => {
    setMapStyle('color');
    expect(getMapStyle()).toBe('color');

    setMapStyle('satellite');
    expect(getMapStyle()).toBe('satellite');

    setMapStyle('street');
    expect(getMapStyle()).toBe('street');
  });

  it('resets to street', () => {
    setMapStyle('satellite');
    resetMapStyle();
    expect(getMapStyle()).toBe('street');
  });

  it('exports correct tile URLs', () => {
    expect(TILE_LAYER_URL).toContain('osm.test');
    expect(SATELLITE_TILE_URL).toContain('esri.test');
  });

  it('accepts all valid style values', () => {
    setMapStyle('street');
    expect(getMapStyle()).toBe('street');

    setMapStyle('color');
    expect(getMapStyle()).toBe('color');

    setMapStyle('satellite');
    expect(getMapStyle()).toBe('satellite');
  });
});
