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
import type { Tier } from '@/lib/analysis';
import { getTierIconConfig } from '@/lib/design-tokens';

export interface TierIconProps {
  /** Pre-computed label position [lat, lng] */
  position: [number, number];
  /** The tier to display */
  tier: Tier;
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
export function TierIcon({ position, tier }: TierIconProps) {
  const iconConfig = getTierIconConfig(tier);

  // WHY: Memoize icon to avoid recreating DivIcon on every render
  const icon = useMemo(
    () => iconConfig ? createTierDivIcon(iconConfig.emoji, iconConfig.size) : null,
    [iconConfig]
  );

  if (!icon) return null;

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
