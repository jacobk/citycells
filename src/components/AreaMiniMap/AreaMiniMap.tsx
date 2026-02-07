'use client';

/**
 * AreaMiniMap Component
 * 
 * Interactive mini-map for the Area Details Panel, enabling users to
 * study the selected subarea and plan walking routes by seeing streets
 * along the boundary.
 * 
 * WHY: Users need to see the exact boundary shape, street layout, and
 * surrounding context to find walkable paths. The main map is often
 * covered by the bottom sheet on mobile.
 * 
 * @see docs/ADR/012-details-panel-mini-map.md
 * @see docs/PRD/001-mvp-mobile-walker.md Section 3.6 (Mini-Map)
 */

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Tier } from '@/lib/analysis';
import {
  TIER_FILL_COLORS,
  TIER_BORDER_COLORS,
  UNWALKED_AREA_STYLE,
} from '@/lib/design-tokens';
// WHY: Panel state for dynamic height adaptation (ADR 015)
import type { PanelState } from '@/lib/panel-state';
import { getMiniMapHeight } from '@/lib/panel-state';

interface AreaMiniMapProps {
  geometry: GeoJSON.Geometry;
  tier?: Tier;
  className?: string;
  // WHY: Panel state determines mini-map height (ADR 015)
  panelState?: PanelState;
}

// WHY: 0.2 opacity so streets remain visible through the fill (ADR 012)
const MINI_MAP_FILL_OPACITY = 0.2;
// WHY: Prominent stroke for clear boundary visibility (ADR 012: 3-4px)
const MINI_MAP_STROKE_WEIGHT = 3;

/**
 * Child component that calls fitBounds on the map instance.
 * WHY: MapContainer props are immutable after mount in react-leaflet v4,
 * so we use useMap() inside a child to programmatically fit bounds.
 */
function FitBoundsUpdater({ geometry }: { geometry: GeoJSON.Geometry }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    try {
      const geoJsonLayer = L.geoJSON(geometry as GeoJSON.GeoJsonObject);
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        // WHY: Padding ensures the boundary isn't clipped at edges
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    } catch (e) {
      console.warn('[AreaMiniMap] Failed to fit bounds:', e);
    }
  }, [geometry, map]);

  return null;
}

/**
 * Child component that calls invalidateSize when panel state changes.
 * WHY: Leaflet map needs to recalculate its size when container height changes.
 * We use setTimeout to ensure CSS transition completes before resize.
 */
function MapResizeUpdater({ panelState }: { panelState?: PanelState }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !panelState) return;

    // WHY: Wait for CSS transition to complete before resizing (300ms transition)
    const timeoutId = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [panelState, map]);

  return null;
}

export default function AreaMiniMap({ geometry, tier, className, panelState }: AreaMiniMapProps) {
  // WHY: Wrap geometry in a GeoJSON Feature for the GeoJSON component
  const featureData = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry,
    }],
  }), [geometry]);

  // WHY: Use tier colors for fill/stroke, fall back to unwalked style
  const fillColor = tier ? TIER_FILL_COLORS[tier] : UNWALKED_AREA_STYLE.borderColor;
  const borderColor = tier ? TIER_BORDER_COLORS[tier] : UNWALKED_AREA_STYLE.borderColor;

  const style = useMemo(() => ({
    color: borderColor,
    weight: MINI_MAP_STROKE_WEIGHT,
    opacity: 0.9,
    fillColor,
    fillOpacity: MINI_MAP_FILL_OPACITY,
  }), [fillColor, borderColor]);

  // WHY: Calculate dynamic height based on panel state (ADR 015)
  const miniMapHeight = getMiniMapHeight(panelState ?? 'expanded');

  // WHY: Default center is Malmö - will be overridden by fitBounds
  const defaultCenter: [number, number] = [55.59, 13.00];

  return (
    <div 
      className={`w-full rounded-lg overflow-hidden transition-[height] duration-300 ease-out ${className ?? ''}`}
      style={{ height: `${miniMapHeight}px` }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={14}
        className="h-full w-full"
        // WHY: Hide zoom controls to save space - users gesture to zoom (ADR 012)
        zoomControl={false}
        // WHY: Enable all interactions for route planning exploration (ADR 012)
        dragging={true}
        touchZoom={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        // WHY: Disable attribution on mini-map to save vertical space
        attributionControl={false}
      >
        <TileLayer
          // WHY: Same tile provider as main map for visual consistency (ADR 012)
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          key={JSON.stringify(geometry)}
          data={featureData}
          style={style}
        />
        <FitBoundsUpdater geometry={geometry} />
        <MapResizeUpdater panelState={panelState} />
      </MapContainer>
    </div>
  );
}
