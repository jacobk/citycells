'use client';

/**
 * SharedWalkMap Component
 * 
 * Map component for the shared walk viewer page.
 * Renders the sub-area boundary and walk route with tier-based coloring.
 * 
 * WHY: Separate component to isolate Leaflet imports and avoid SSR issues.
 * The parent page uses dynamic import with ssr: false.
 * 
 * @see docs/ADR/023-share-walk-feature.md
 */

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Tier } from '@/lib/analysis';
import type { TieredSegment } from '@/lib/distance-tiers';
import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';
import {
  TIER_FILL_COLORS,
  TIER_BORDER_COLORS,
  UNWALKED_AREA_STYLE,
} from '@/lib/design-tokens';
import { TILE_LAYER_URL, TILE_LAYER_ATTRIBUTION, MALMO_CENTER } from '@/lib/map-config';

// =============================================================================
// Types
// =============================================================================

interface SharedWalkMapProps {
  /** Boundary coordinates in [lng, lat] format */
  boundaryCoords: number[][];
  /** Walk path coordinates in [lng, lat] format */
  walkCoords: number[][];
  /** Tier segments for route coloring */
  tierSegments: TieredSegment[];
  /** Tier for boundary styling */
  tier?: Tier;
}

// =============================================================================
// Map Bounds Fitter
// =============================================================================

/**
 * Child component that fits map to boundary bounds.
 */
function FitBoundsFitter({ boundaryCoords }: { boundaryCoords: number[][] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || boundaryCoords.length === 0) return;

    try {
      // Convert to Leaflet LatLng format [lat, lng]
      const latLngs = boundaryCoords.map(([lng, lat]) => [lat, lng] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    } catch (e) {
      console.warn('[SharedWalkMap] Failed to fit bounds:', e);
    }
  }, [boundaryCoords, map]);

  return null;
}

// =============================================================================
// Route Renderer
// =============================================================================

/**
 * Renders the walk route with tier-based coloring.
 */
function TieredRoute({ 
  walkCoords, 
  tierSegments 
}: { 
  walkCoords: number[][]; 
  tierSegments: TieredSegment[];
}) {
  // Convert coordinates to Leaflet format and group by tier for efficient rendering
  const routeSegments = useMemo(() => {
    if (walkCoords.length < 2 || tierSegments.length === 0) {
      // Fallback: render entire route in default color
      return [{
        positions: walkCoords.map(([lng, lat]) => [lat, lng] as [number, number]),
        color: DISTANCE_TIER_COLORS.silver,
        isDashed: false,
      }];
    }

    return tierSegments.map(segment => {
      // Extract coordinates for this segment
      const segmentCoords = walkCoords.slice(segment.startIndex, segment.endIndex + 1);
      
      return {
        positions: segmentCoords.map(([lng, lat]) => [lat, lng] as [number, number]),
        color: DISTANCE_TIER_COLORS[segment.tier],
        isDashed: segment.tier === 'missed',
      };
    });
  }, [walkCoords, tierSegments]);

  return (
    <>
      {routeSegments.map((segment, idx) => (
        <Polyline
          key={idx}
          positions={segment.positions}
          pathOptions={{
            color: segment.color,
            weight: 4,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: segment.isDashed ? '8, 8' : undefined,
          }}
        />
      ))}
    </>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function SharedWalkMap({
  boundaryCoords,
  walkCoords,
  tierSegments,
  tier,
}: SharedWalkMapProps) {
  // Convert boundary to Leaflet format [lat, lng]
  const boundaryLatLngs = useMemo(() => 
    boundaryCoords.map(([lng, lat]) => [lat, lng] as [number, number]),
    [boundaryCoords]
  );

  // Style for boundary polygon
  const boundaryStyle = useMemo(() => ({
    color: tier ? TIER_BORDER_COLORS[tier] : UNWALKED_AREA_STYLE.borderColor,
    weight: 3,
    opacity: 0.9,
    fillColor: tier ? TIER_FILL_COLORS[tier] : UNWALKED_AREA_STYLE.fillColor,
    fillOpacity: 0.2,
  }), [tier]);

  return (
    <MapContainer
      center={MALMO_CENTER}
      zoom={14}
      style={{ height: '100%', width: '100%' }}
      className="h-full w-full"
      zoomControl={true}
      dragging={true}
      touchZoom={true}
      scrollWheelZoom={true}
      doubleClickZoom={true}
      attributionControl={true}
    >
      <TileLayer
        url={TILE_LAYER_URL}
        attribution={TILE_LAYER_ATTRIBUTION}
      />
      
      {/* Boundary polygon */}
      <Polygon
        positions={boundaryLatLngs}
        pathOptions={boundaryStyle}
      />
      
      {/* Walk route with tier coloring */}
      <TieredRoute walkCoords={walkCoords} tierSegments={tierSegments} />
      
      {/* Fit to boundary bounds */}
      <FitBoundsFitter boundaryCoords={boundaryCoords} />
    </MapContainer>
  );
}
