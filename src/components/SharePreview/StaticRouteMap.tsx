'use client';

/**
 * StaticRouteMap Component
 * 
 * Renders an SVG-based static map of a walk route for share image generation.
 * 
 * WHY: For share images, we need a map that renders to canvas/image without
 * relying on external tile services or complex Leaflet-to-canvas conversion.
 * SVG renders natively with modern-screenshot and looks crisp at any scale.
 * 
 * @see docs/ADR/023-share-walk-feature.md - Technical decisions
 */

import { useMemo } from 'react';
import polyline from '@mapbox/polyline';
import type { ShareableWalkData, CompactTierSegment } from '@/lib/share';
import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';
import { TIER_FROM_ABBREVIATION } from '@/lib/share/types';
import { getTierColor, type Tier } from '@/lib/analysis';

// =============================================================================
// Types
// =============================================================================

interface StaticRouteMapProps {
  data: ShareableWalkData;
  width: number;
  height: number;
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Renders boundary polygon and walk route as SVG.
 * 
 * WHY: SVG-based rendering ensures:
 * - Perfect capture with modern-screenshot (native SVG support)
 * - No external tile loading or async operations
 * - Crisp rendering at any scale factor
 * - Tier-colored route segments matching the app's visualization
 */
export default function StaticRouteMap({ data, width, height }: StaticRouteMapProps) {
  // Decode polylines to coordinate arrays
  // WHY: @mapbox/polyline.decode returns [[lat, lng], ...] format
  const boundaryCoords = useMemo(() => {
    try {
      return polyline.decode(data.boundary);
    } catch (e) {
      console.error('[StaticRouteMap] Failed to decode boundary:', e);
      return [];
    }
  }, [data.boundary]);
  
  const walkCoords = useMemo(() => {
    try {
      return polyline.decode(data.walkPath);
    } catch (e) {
      console.error('[StaticRouteMap] Failed to decode walkPath:', e);
      return [];
    }
  }, [data.walkPath]);

  // Calculate bounding box with padding
  const bounds = useMemo(() => {
    const allCoords = [...boundaryCoords, ...walkCoords];
    if (allCoords.length === 0) {
      return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
    }
    
    const lats = allCoords.map(c => c[0]);
    const lngs = allCoords.map(c => c[1]);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    // Add 10% padding
    const latPad = (maxLat - minLat) * 0.1 || 0.001;
    const lngPad = (maxLng - minLng) * 0.1 || 0.001;
    
    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLng: minLng - lngPad,
      maxLng: maxLng + lngPad,
    };
  }, [boundaryCoords, walkCoords]);

  // Convert geographic coordinates to SVG coordinates
  // WHY: SVG Y-axis is inverted (0 at top), so we flip latitude
  const toSvg = useMemo(() => {
    const latRange = bounds.maxLat - bounds.minLat;
    const lngRange = bounds.maxLng - bounds.minLng;
    
    // Maintain aspect ratio - use the larger range to determine scale
    const geoAspect = lngRange / latRange;
    const svgAspect = width / height;
    
    let effectiveWidth = width;
    let effectiveHeight = height;
    let offsetX = 0;
    let offsetY = 0;
    
    if (geoAspect > svgAspect) {
      // Geo is wider - fit to width, center vertically
      effectiveHeight = width / geoAspect;
      offsetY = (height - effectiveHeight) / 2;
    } else {
      // Geo is taller - fit to height, center horizontally
      effectiveWidth = height * geoAspect;
      offsetX = (width - effectiveWidth) / 2;
    }
    
    return (lat: number, lng: number): [number, number] => {
      const x = offsetX + ((lng - bounds.minLng) / lngRange) * effectiveWidth;
      const y = offsetY + ((bounds.maxLat - lat) / latRange) * effectiveHeight;
      return [x, y];
    };
  }, [bounds, width, height]);

  // Create boundary polygon path
  const boundaryPath = useMemo(() => {
    if (boundaryCoords.length === 0) return '';
    
    return boundaryCoords
      .map((c, i) => {
        const [x, y] = toSvg(c[0], c[1]);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ') + ' Z';
  }, [boundaryCoords, toSvg]);

  // Create walk route segments with tier colors
  const routeSegments = useMemo(() => {
    if (walkCoords.length === 0 || !data.tierSegments) return [];
    
    return data.tierSegments.map((seg: CompactTierSegment) => {
      // Ensure indices are valid
      const startIdx = Math.max(0, seg.s);
      const endIdx = Math.min(walkCoords.length - 1, seg.e);
      
      if (startIdx >= walkCoords.length || endIdx < startIdx) {
        return null;
      }
      
      const segCoords = walkCoords.slice(startIdx, endIdx + 1);
      if (segCoords.length < 2) return null;
      
      // Get tier color
      const tier = TIER_FROM_ABBREVIATION[seg.t] || 'missed';
      const color = DISTANCE_TIER_COLORS[tier];
      
      const path = segCoords
        .map((c, i) => {
          const [x, y] = toSvg(c[0], c[1]);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
      
      return { path, color };
    }).filter(Boolean) as { path: string; color: string }[];
  }, [data.tierSegments, walkCoords, toSvg]);

  // Fallback: if no tier segments, render whole path in tier color
  const fallbackRoutePath = useMemo(() => {
    if (routeSegments.length > 0 || walkCoords.length === 0) return null;
    
    const tier = data.scores.tier as Tier;
    const color = getTierColor(tier);
    
    const path = walkCoords
      .map((c, i) => {
        const [x, y] = toSvg(c[0], c[1]);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    
    return { path, color };
  }, [routeSegments, walkCoords, toSvg, data.scores.tier]);

  // Get boundary color from tier
  const boundaryColor = getTierColor(data.scores.tier as Tier);

  return (
    <svg 
      width={width} 
      height={height} 
      style={{ 
        backgroundColor: '#1a1a2e',
        display: 'block',
      }}
    >
      {/* Grid pattern for visual interest */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2d2d4d" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      
      {/* Boundary polygon - filled with semi-transparent tier color */}
      {boundaryPath && (
        <path
          d={boundaryPath}
          fill={`${boundaryColor}33`}  // 20% opacity
          stroke={boundaryColor}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      )}
      
      {/* Walk route segments - colored by tier */}
      {routeSegments.map((seg, i) => (
        <path
          key={i}
          d={seg.path}
          fill="none"
          stroke={seg.color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      
      {/* Fallback: single-color route if no segments */}
      {fallbackRoutePath && (
        <path
          d={fallbackRoutePath.path}
          fill="none"
          stroke={fallbackRoutePath.color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      
      {/* Error state */}
      {boundaryCoords.length === 0 && walkCoords.length === 0 && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={16}
        >
          Route data unavailable
        </text>
      )}
    </svg>
  );
}
