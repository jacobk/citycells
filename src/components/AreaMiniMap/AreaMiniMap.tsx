'use client';

/**
 * AreaMiniMap Component
 * 
 * Compact, scrollable mini-map for the Area Details Panel with maximize button.
 * Users can scroll this map away with other panel content, and tap maximize
 * to open a full-size modal with walk route toggles and legend.
 * 
 * WHY: ADR 022 changed from fixed viewport-filling mini-map (ADR 012) to
 * scrollable compact map. This returns control to users - they can scroll
 * to see panel content without the map blocking the view.
 * 
 * @see docs/ADR/022-scrollable-minimap-with-maximize.md
 * @see docs/PRD/001-mvp-mobile-walker.md Section 3.7 (Mini-Map)
 */

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Tier } from '@/lib/analysis';
import {
  TIER_FILL_COLORS,
  UNWALKED_AREA_STYLE,
  getBorderColor,
  getBorderWeight,
  getBorderOpacity,
  getFillOpacity,
} from '@/lib/design-tokens';
// WHY: Shared map config for consistency across Map, AreaMiniMap, WalkingMode (ADR 017)
import { MALMO_CENTER, FIT_BOUNDS_PADDING } from '@/lib/map-config';
import { useMapTileLayer } from '@/hooks/useMapTileLayer';
import MapSettingsPanel, { MapStyleClass } from '@/components/MapSettingsPanel/MapSettingsPanel';

// WHY: Fixed height for compact scrollable mini-map per ADR 022
// This replaces the dynamic flex-grow height from ADR 012
const MINI_MAP_HEIGHT_PX = 180;

interface AreaMiniMapProps {
  geometry: GeoJSON.Geometry;
  tier?: Tier;
  className?: string;
  // WHY: Callback to open maximized map modal (ADR 022)
  onMaximize?: () => void;
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
        // WHY: Padding ensures the boundary isn't clipped at edges (ADR 017 shared config)
        map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING });
      }
    } catch (e) {
      console.warn('[AreaMiniMap] Failed to fit bounds:', e);
    }
  }, [geometry, map]);

  return null;
}

export default function AreaMiniMap({ geometry, tier, className, onMaximize }: AreaMiniMapProps) {
  const { tileUrl, mapStyle, isSatellite } = useMapTileLayer();

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
  // Satellite mode: white borders, +1px weight, boosted fill opacity (ADR 025)
  const fillColor = tier ? TIER_FILL_COLORS[tier] : UNWALKED_AREA_STYLE.borderColor;

  const style = useMemo(() => ({
    color: getBorderColor(tier, isSatellite),
    weight: getBorderWeight(MINI_MAP_STROKE_WEIGHT, isSatellite),
    opacity: getBorderOpacity(0.9, isSatellite),
    fillColor,
    fillOpacity: getFillOpacity(null, MINI_MAP_FILL_OPACITY, isSatellite),
  }), [fillColor, tier, isSatellite]);

  // WHY: Fixed height per ADR 022 - mini-map scrolls with content instead of filling viewport
  return (
    <div 
      className={`w-full rounded-lg overflow-hidden relative ${className ?? ''}`}
      style={{ height: `${MINI_MAP_HEIGHT_PX}px` }}
    >
      <MapContainer
        center={MALMO_CENTER}
        zoom={14}
        className="h-full w-full grayscale-tiles"
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
        <MapStyleClass mapStyle={mapStyle} />
        <TileLayer
          // WHY: Same tile provider as main map for visual consistency (ADR 012, 017)
          url={tileUrl}
        />
        <GeoJSON
          key={JSON.stringify(geometry)}
          data={featureData}
          style={style}
        />
        <FitBoundsUpdater geometry={geometry} />
      </MapContainer>
      
      {/* Map style toggle - top-left, small variant */}
      <div className="absolute top-2 left-2 z-[400]">
        <MapSettingsPanel variant="compact" />
      </div>

      {/* WHY: Maximize button per ADR 022 - opens full-size modal with walk toggles and legend */}
      {onMaximize && (
        <button
          onClick={onMaximize}
          className="absolute top-2 right-2 z-[400] w-8 h-8 bg-white/90 hover:bg-white rounded-md shadow-md flex items-center justify-center transition-colors"
          aria-label="Maximize map"
          title="View full-size map"
        >
          {/* Expand/Maximize icon */}
          <svg 
            className="w-4 h-4 text-gray-700" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" 
            />
          </svg>
        </button>
      )}
    </div>
  );
}
