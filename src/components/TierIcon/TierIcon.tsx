'use client';

/**
 * TierIcon Component
 * 
 * WHY: Medal icons provide instant tier recognition without hovering,
 * reinforcing gamification and adding visual reward for higher tiers.
 * 
 * @see docs/ADR/010-map-visual-design-system.md Section 4
 */

import { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { Tier } from '@/lib/analysis';
import { getTierIconConfig, TIER_ICON_MIN_ZOOM } from '@/lib/design-tokens';

export interface TierIconProps {
  /** The GeoJSON feature (polygon) to place the icon on */
  feature: Feature<Polygon | MultiPolygon>;
  /** The tier to display */
  tier: Tier;
  /** Current map zoom level */
  zoom: number;
}

/**
 * Calculate the best point to place a label/icon within a polygon.
 * Uses centroid if it's inside the polygon, otherwise falls back to pointOnFeature.
 * 
 * WHY: Centroid may fall outside concave polygons (e.g., L-shaped areas).
 * turf.pointOnFeature() guarantees a point inside the polygon.
 */
function getLabelPoint(feature: Feature<Polygon | MultiPolygon>): [number, number] {
  try {
    const centroid = turf.centroid(feature);
    
    // Check if centroid is inside the polygon
    if (turf.booleanPointInPolygon(centroid, feature)) {
      const coords = centroid.geometry.coordinates;
      return [coords[1], coords[0]]; // [lat, lng] for Leaflet
    }
    
    // Fallback to a guaranteed point inside
    const pointOnFeature = turf.pointOnFeature(feature);
    const coords = pointOnFeature.geometry.coordinates;
    return [coords[1], coords[0]]; // [lat, lng] for Leaflet
  } catch (e) {
    console.warn('Error calculating label point:', e);
    // Last resort: use first coordinate of polygon
    const coords = feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates[0][0]
      : feature.geometry.coordinates[0][0][0];
    return [coords[1], coords[0]];
  }
}

/**
 * Creates a Leaflet DivIcon with the tier emoji.
 */
function createTierDivIcon(emoji: string, size: number): L.DivIcon {
  return L.divIcon({
    className: 'tier-icon', // WHY: Custom class allows CSS styling if needed
    html: `<span style="font-size: ${size}px; line-height: 1; display: block; text-align: center;">${emoji}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2], // Center the icon on the point
  });
}

/**
 * Renders a tier medal icon at the centroid of a completed area.
 * Icons are only visible at zoom level >= TIER_ICON_MIN_ZOOM (13).
 */
export function TierIcon({ feature, tier, zoom }: TierIconProps) {
  // WHY: Don't render if no tier or zoom too low
  if (!tier || zoom < TIER_ICON_MIN_ZOOM) {
    return null;
  }

  const iconConfig = getTierIconConfig(tier);
  if (!iconConfig) {
    return null;
  }

  // WHY: Memoize position and icon to avoid recalculating on every render
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const position = useMemo(() => getLabelPoint(feature), [feature]);
  
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const icon = useMemo(
    () => createTierDivIcon(iconConfig.emoji, iconConfig.size),
    [iconConfig.emoji, iconConfig.size]
  );

  return (
    <Marker 
      position={position}
      icon={icon}
      // WHY: Icons are non-interactive (click passes through to area)
      interactive={false}
    />
  );
}

export default TierIcon;
