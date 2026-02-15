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
 * @see docs/PRD/001-mvp-mobile-walker.md Section 3.7 (Mini-Map)
 */

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Tier } from '@/lib/analysis';
import {
  TIER_FILL_COLORS,
  TIER_BORDER_COLORS,
  UNWALKED_AREA_STYLE,
} from '@/lib/design-tokens';
// WHY: Panel state for triggering map resize (ADR 015)
import type { PanelState } from '@/lib/panel-state';
// WHY: Route visualization for walk routes on mini-map (Ticket 011)
import type { RouteSegment } from '@/lib/route-visualization';
import { getRoutePathOptions } from '@/lib/route-visualization';
// WHY: Shared map config for consistency across Map, AreaMiniMap, WalkingMode (ADR 017)
import { TILE_LAYER_URL, MALMO_CENTER, FIT_BOUNDS_PADDING } from '@/lib/map-config';

// WHY: Minimum height ensures map remains usable even in collapsed panel state (ADR 012, Ticket 015)
const MIN_MAP_HEIGHT_PX = 200;

interface AreaMiniMapProps {
  geometry: GeoJSON.Geometry;
  tier?: Tier;
  className?: string;
  // WHY: Panel state triggers resize invalidation when panel expands/collapses (ADR 015)
  panelState?: PanelState;
  // WHY: Optional route segments to display walk routes with deviation coloring (Ticket 011)
  routeSegments?: RouteSegment[];
}

// WHY: 0.2 opacity so streets remain visible through the fill (ADR 012)
const MINI_MAP_FILL_OPACITY = 0.2;
// WHY: Prominent stroke for clear boundary visibility (ADR 012: 3-4px)
const MINI_MAP_STROKE_WEIGHT = 3;

/**
 * Child component that calls fitBounds on the map instance.
 * WHY: MapContainer props are immutable after mount in react-leaflet v4,
 * so we use useMap() inside a child to programmatically fit bounds.
 * 
 * Includes route segments in bounds calculation to ensure full route is visible.
 */
function FitBoundsUpdater({ geometry, routeSegments }: { geometry: GeoJSON.Geometry; routeSegments?: RouteSegment[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    try {
      // Start with bounds from area geometry
      const geoJsonLayer = L.geoJSON(geometry as GeoJSON.GeoJsonObject);
      let bounds = geoJsonLayer.getBounds();
      
      // WHY: Include route segments in bounds to ensure full route is visible (Ticket 011)
      // Routes may extend beyond the area boundary, so we need to include them
      if (routeSegments && routeSegments.length > 0) {
        // Collect all positions from all route segments
        const allPositions: [number, number][] = [];
        routeSegments.forEach(segment => {
          allPositions.push(...segment.positions);
        });
        
        if (allPositions.length > 0) {
          // Create bounds from route positions
          const routeBounds = L.latLngBounds(allPositions);
          // Extend geometry bounds to include route bounds
          bounds = bounds.extend(routeBounds);
        }
      }
      
      if (bounds.isValid()) {
        // WHY: Padding ensures the boundary and route aren't clipped at edges (ADR 017 shared config)
        map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING });
      }
    } catch (e) {
      console.warn('[AreaMiniMap] Failed to fit bounds:', e);
    }
  }, [geometry, routeSegments, map]);

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

export default function AreaMiniMap({ geometry, tier, className, panelState, routeSegments }: AreaMiniMapProps) {
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

  // WHY: Default center is Malmö - will be overridden by fitBounds (ADR 017 shared config)

  // WHY: Use flex-grow with min-height instead of fixed pixel heights (Ticket 015)
  // Parent container controls available space; map fills it with min 200px
  return (
    <div 
      className={`w-full rounded-lg overflow-hidden flex-grow ${className ?? ''}`}
      style={{ minHeight: `${MIN_MAP_HEIGHT_PX}px` }}
    >
      <MapContainer
        center={MALMO_CENTER}
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
          // WHY: Same tile provider as main map for visual consistency (ADR 012, 017)
          url={TILE_LAYER_URL}
        />
        <GeoJSON
          key={JSON.stringify(geometry)}
          data={featureData}
          style={style}
        />
        {/* WHY: Route visualization with deviation-based coloring per ADR 010 (Ticket 011)
            - Routes render above area boundary polygon (correct z-order)
            - Green segments = within 25m of boundary (on-track)
            - Red segments = beyond 25m of boundary (deviation) */}
        {routeSegments && routeSegments.map((segment, index) => (
          <Polyline
            key={`route-segment-${index}`}
            positions={segment.positions}
            pathOptions={getRoutePathOptions(segment.color)}
          />
        ))}
        <FitBoundsUpdater geometry={geometry} routeSegments={routeSegments} />
        <MapResizeUpdater panelState={panelState} />
      </MapContainer>
    </div>
  );
}
