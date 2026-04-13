'use client';

/**
 * MaximizedMapModal Component
 * 
 * Full-size map modal for detailed walk route visualization. Provides:
 * - ~90% viewport coverage for maximum map visibility
 * - Per-walk toggle controls for comparing different walks
 * - Distance tier legend explaining segment colors
 * 
 * WHY: ADR 022 moved detailed route visualization from the compact mini-map
 * to this maximized modal. Users can now scroll the mini-map away, and
 * access the full-size view on-demand via the maximize button.
 * 
 * @see docs/ADR/022-scrollable-minimap-with-maximize.md
 * @see docs/tickets/027-scrollable-minimap-maximize.md
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Tier } from '@/lib/analysis';
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';
import {
  TIER_FILL_COLORS,
  UNWALKED_AREA_STYLE,
  getBorderColor,
  getBorderWeight,
  getBorderOpacity,
  getFillOpacity,
} from '@/lib/design-tokens';
import { MALMO_CENTER, FIT_BOUNDS_PADDING } from '@/lib/map-config';
import { useMapTileLayer } from '@/hooks/useMapTileLayer';
import MapStyleToggle, { MapStyleClass } from '@/components/MapStyleToggle';
import { getWalkStreams, get, type WalkRecord } from '@/lib/db';
import { prepareDeviationColoredRoute, getRoutePathOptions } from '@/lib/route-visualization';
import type { RouteSegment } from '@/lib/route-visualization';
import DistanceTierLegend from '@/components/DistanceTierLegend';
import mapboxPolyline from '@mapbox/polyline';

// ============================================
// Types
// ============================================

export interface WalkData {
  id: number;
  name: string;
  date?: string;
  isBest?: boolean;
  summaryPolyline?: string;
}

interface MaximizedMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  geometry: GeoJSON.Geometry;
  tier?: Tier;
  walks: WalkData[];
  areaName?: string;
}

// ============================================
// Helper Components
// ============================================

/**
 * Fit bounds on mount and when geometry changes.
 */
function FitBoundsUpdater({ 
  geometry, 
  routeSegments 
}: { 
  geometry: GeoJSON.Geometry; 
  routeSegments: RouteSegment[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    try {
      const geoJsonLayer = L.geoJSON(geometry as GeoJSON.GeoJsonObject);
      let bounds = geoJsonLayer.getBounds();
      
      // WHY: Include route segments in bounds to ensure full route is visible
      if (routeSegments.length > 0) {
        const allPositions: [number, number][] = [];
        routeSegments.forEach(segment => {
          allPositions.push(...segment.positions);
        });
        
        if (allPositions.length > 0) {
          const routeBounds = L.latLngBounds(allPositions);
          bounds = bounds.extend(routeBounds);
        }
      }
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING });
      }
    } catch (e) {
      console.warn('[MaximizedMapModal] Failed to fit bounds:', e);
    }
  }, [geometry, routeSegments, map]);

  return null;
}

// ============================================
// Main Component
// ============================================

export default function MaximizedMapModal({
  isOpen,
  onClose,
  geometry,
  tier,
  walks,
  areaName,
}: MaximizedMapModalProps) {
  const { tileUrl, mapStyle, isSatellite } = useMapTileLayer();
  // WHY: Track which walks are enabled for display (multi-select)
  const [enabledWalkIds, setEnabledWalkIds] = useState<Set<number>>(new Set());
  // WHY: Cache loaded route segments by walk ID
  const [routeSegmentsMap, setRouteSegmentsMap] = useState<Map<number, RouteSegment[]>>(new Map());
  // WHY: Track previous isOpen state to detect open transitions
  const prevIsOpenRef = useRef(isOpen);

  // WHY: Close on Escape key for accessibility (ADR 022)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // WHY: Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // WHY: Reset enabled walks when modal opens fresh (closed → open transition)
  // This is a legitimate use case for setState in effect: resetting component state
  // when a prop changes from false to true (modal opening). The alternative would be
  // to use a key prop on the component, but that would cause unnecessary unmount/remount.
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabledWalkIds(new Set());
       
      setRouteSegmentsMap(new Map());
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // WHY: Load route data for a walk when it's enabled
  const loadRouteForWalk = useCallback(async (walkId: number) => {
    // Skip if already loaded
    if (routeSegmentsMap.has(walkId)) {
      return;
    }

    try {
      let coordinates: Position[] | null = null;

      // Try stream data first (preferred - full path without privacy zone truncation)
      const cachedStreams = await getWalkStreams(walkId);

      if (cachedStreams && cachedStreams.latlng.length > 0) {
        // Convert from [lat, lng] to [lng, lat] for GeoJSON format
        coordinates = cachedStreams.latlng.map(([lat, lng]) => [lng, lat]);
      } else {
        // Fallback to summary_polyline from walks prop
        const walkInfo = walks.find(w => w.id === walkId);
        let polyline = walkInfo?.summaryPolyline;

        // If not in props, try database
        if (!polyline) {
          const walkRecord = await get<WalkRecord>('walks', walkId);
          if (walkRecord?.polyline) {
            polyline = walkRecord.polyline;
          }
        }

        if (polyline) {
          const decoded = mapboxPolyline.decode(polyline);
          coordinates = decoded.map(pt => [pt[1], pt[0]]);
        }
      }

      if (!coordinates || coordinates.length < 2) {
        console.warn(`[MaximizedMapModal] No route data for walk ${walkId}`);
        return;
      }

      // Prepare route segments with tier-based coloring
      const boundaryFeature: Feature<Polygon | MultiPolygon> = {
        type: 'Feature',
        properties: {},
        geometry: geometry as Polygon | MultiPolygon,
      };

      const segments = prepareDeviationColoredRoute(coordinates, boundaryFeature);
      
      setRouteSegmentsMap(prev => {
        const next = new Map(prev);
        next.set(walkId, segments);
        return next;
      });
    } catch (e) {
      console.error(`[MaximizedMapModal] Failed to load route for walk ${walkId}:`, e);
    }
  }, [geometry, walks, routeSegmentsMap]);

  // WHY: Toggle a walk on/off
  const handleToggleWalk = useCallback((walkId: number) => {
    setEnabledWalkIds(prev => {
      const next = new Set(prev);
      if (next.has(walkId)) {
        next.delete(walkId);
      } else {
        next.add(walkId);
        // Load route data when enabling
        loadRouteForWalk(walkId);
      }
      return next;
    });
  }, [loadRouteForWalk]);

  // WHY: Collect all segments from enabled walks for rendering
  const allEnabledSegments = useMemo(() => {
    const segments: RouteSegment[] = [];
    enabledWalkIds.forEach(walkId => {
      const walkSegments = routeSegmentsMap.get(walkId);
      if (walkSegments) {
        segments.push(...walkSegments);
      }
    });
    return segments;
  }, [enabledWalkIds, routeSegmentsMap]);

  // WHY: Prepare GeoJSON feature data for the map
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

  const boundaryStyle = useMemo(() => ({
    color: getBorderColor(tier, isSatellite),
    weight: getBorderWeight(3, isSatellite),
    opacity: getBorderOpacity(0.9, isSatellite),
    fillColor,
    fillOpacity: getFillOpacity(null, 0.2, isSatellite),
  }), [fillColor, tier, isSatellite]);

  // WHY: Format walk label with name and date per user preference
  const formatWalkLabel = (walk: WalkData): string => {
    if (walk.name && walk.date) {
      return `${walk.name} - ${walk.date}`;
    }
    if (walk.name) {
      return walk.name;
    }
    if (walk.date) {
      return walk.date;
    }
    return `Walk #${walk.id}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[600] flex items-center justify-center p-2 sm:p-4"
        onClick={onClose}
      >
        {/* Modal Container - ~90% viewport */}
        <div
          className="bg-card rounded-xl shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {areaName || 'Area Map'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Map Area - takes remaining space */}
          <div className="flex-1 min-h-0 relative">
            <MapContainer
              center={MALMO_CENTER}
              zoom={14}
              className="h-full w-full grayscale-tiles"
              zoomControl={true}
              dragging={true}
              touchZoom={true}
              scrollWheelZoom={true}
              doubleClickZoom={true}
              attributionControl={false}
            >
              <MapStyleClass mapStyle={mapStyle} />
              <TileLayer url={tileUrl} />
              <GeoJSON
                key={JSON.stringify(geometry)}
                data={featureData}
                style={boundaryStyle}
              />
              {/* WHY: Render all enabled walk routes with tier-based coloring */}
              {allEnabledSegments.map((segment, index) => (
                <Polyline
                  key={`route-segment-${index}`}
                  positions={segment.positions}
                  pathOptions={getRoutePathOptions(segment.color)}
                />
              ))}
              <FitBoundsUpdater geometry={geometry} routeSegments={allEnabledSegments} />
            </MapContainer>

            {/* Map style toggle - top-right of map area */}
            <div className="absolute top-3 right-3 z-[400]">
              <MapStyleToggle />
            </div>
          </div>

          {/* Control Panel - fixed bottom section */}
          <div className="border-t border-border bg-card px-4 py-3 shrink-0 max-h-[30vh] overflow-y-auto">
            {/* Walk Toggles */}
            {walks.length > 0 && (
              <div className="mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                  Walk Routes ({walks.length})
                </h3>
                <div className="space-y-1.5">
                  {walks.map(walk => {
                    const isEnabled = enabledWalkIds.has(walk.id);
                    return (
                      <label
                        key={walk.id}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        {/* WHY: Checkbox for multi-select walk toggling */}
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => handleToggleWalk(walk.id)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors flex-1 truncate">
                          {formatWalkLabel(walk)}
                        </span>
                        {walk.isBest && (
                          <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            Best
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Distance Tier Legend */}
            <div className={walks.length > 0 ? 'pt-3 border-t border-border' : ''}>
              <DistanceTierLegend compact />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
