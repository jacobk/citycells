/**
 * Analysis Visualization Utilities
 * 
 * Generates SVG visualizations for each analysis metric to help
 * understand how calculations work and debug issues.
 * 
 * WHY: Visual debugging makes it easier to:
 * 1. Understand how metrics are calculated
 * 2. Identify issues in the analysis
 * 3. Validate expected values for test fixtures
 * 4. Create documentation
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon, LineString, Position } from 'geojson';
import { PERIMETER_BUFFER_METERS, LOOP_CLOSURE_THRESHOLD_METERS } from '@/lib/analysis';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Types
// ============================================

interface BoundingBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

interface SVGOptions {
  width?: number;
  height?: number;
  padding?: number;
  title?: string;
  showLegend?: boolean;
}

// ============================================
// Coordinate Transformation
// ============================================

/**
 * Calculate bounding box for coordinates.
 */
function getBoundingBox(coords: Position[][]): BoundingBox {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (const ring of coords) {
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }

  return { minLng, maxLng, minLat, maxLat };
}

/**
 * Transform geo coordinates to SVG coordinates.
 */
function geoToSVG(
  lng: number, 
  lat: number, 
  bbox: BoundingBox, 
  width: number, 
  height: number,
  padding: number
): [number, number] {
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;
  
  const x = padding + ((lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * innerWidth;
  // Flip Y axis (SVG has Y increasing downward)
  const y = padding + ((bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat)) * innerHeight;
  
  return [x, y];
}

/**
 * Convert a coordinate array to SVG path string.
 */
function coordsToPath(
  coords: Position[],
  bbox: BoundingBox,
  width: number,
  height: number,
  padding: number,
  close: boolean = false
): string {
  const points = coords.map(([lng, lat]) => 
    geoToSVG(lng, lat, bbox, width, height, padding)
  );
  
  const pathParts = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`
  );
  
  if (close) pathParts.push('Z');
  
  return pathParts.join(' ');
}

// ============================================
// SVG Generation
// ============================================

/**
 * Generate SVG header with styles.
 */
function svgHeader(width: number, height: number, title?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="0 0 ${width} ${height}" 
     width="${width}" 
     height="${height}">
  <title>${title || 'Analysis Visualization'}</title>
  <style>
    .area-polygon { fill: #e0e7ff; stroke: #4f46e5; stroke-width: 2; fill-opacity: 0.3; }
    .walk-path { fill: none; stroke: #3b82f6; stroke-width: 2; stroke-linecap: round; }
    .walk-path-covered { fill: none; stroke: #22c55e; stroke-width: 3; stroke-linecap: round; }
    .walk-path-uncovered { fill: none; stroke: #ef4444; stroke-width: 3; stroke-linecap: round; }
    .buffer-zone { fill: #fef08a; fill-opacity: 0.3; stroke: #ca8a04; stroke-width: 1; stroke-dasharray: 4,2; }
    .enclosed-area { fill: #86efac; fill-opacity: 0.5; stroke: #16a34a; stroke-width: 1; }
    .intersection-area { fill: #a78bfa; fill-opacity: 0.5; stroke: #7c3aed; stroke-width: 2; }
    .start-point { fill: #22c55e; }
    .end-point { fill: #ef4444; }
    .loop-gap { stroke: #f97316; stroke-width: 2; stroke-dasharray: 6,3; }
    .deviation-marker { fill: #f97316; fill-opacity: 0.7; }
    .legend { font-family: system-ui, sans-serif; font-size: 12px; }
    .title { font-family: system-ui, sans-serif; font-size: 16px; font-weight: bold; }
    .metric-value { font-family: system-ui, sans-serif; font-size: 14px; }
  </style>
  <rect width="100%" height="100%" fill="white"/>
`;
}

/**
 * Generate legend for the visualization.
 */
function svgLegend(items: { color: string; label: string }[], x: number, y: number): string {
  const itemHeight = 20;
  let result = `<g class="legend" transform="translate(${x}, ${y})">`;
  
  items.forEach((item, i) => {
    result += `
    <rect x="0" y="${i * itemHeight}" width="16" height="12" fill="${item.color}" />
    <text x="22" y="${i * itemHeight + 10}">${item.label}</text>`;
  });
  
  result += '</g>';
  return result;
}

// ============================================
// Specific Visualizations
// ============================================

/**
 * Generate perimeter coverage visualization.
 * 
 * Shows:
 * - Sub-area polygon
 * - 25m buffer around perimeter
 * - Walk path with covered/uncovered segments
 */
export function visualizePerimeterCoverage(
  walkCoordinates: Position[],
  areaPolygon: Feature<Polygon | MultiPolygon>,
  coveredMeters: number,
  totalPerimeterMeters: number,
  options: SVGOptions = {}
): string {
  const { width = 800, height = 600, padding = 40, title, showLegend = true } = options;
  
  // Get all coordinates for bounding box
  const areaCoords = areaPolygon.geometry.type === 'Polygon' 
    ? areaPolygon.geometry.coordinates 
    : areaPolygon.geometry.coordinates.flat();
  
  const allCoords = [...areaCoords, [walkCoordinates]];
  const bbox = getBoundingBox(allCoords);
  
  // Add some padding to bbox
  const bboxPadding = 0.001; // ~100m
  bbox.minLng -= bboxPadding;
  bbox.maxLng += bboxPadding;
  bbox.minLat -= bboxPadding;
  bbox.maxLat += bboxPadding;
  
  let svg = svgHeader(width, height, title || 'Perimeter Coverage Analysis');
  
  // Draw buffer zone around perimeter
  try {
    const perimeterLine = turf.polygonToLine(areaPolygon);
    const lines = perimeterLine.type === 'FeatureCollection' 
      ? perimeterLine.features 
      : [perimeterLine];
    
    for (const line of lines) {
      const buffered = turf.buffer(line as Feature<LineString>, PERIMETER_BUFFER_METERS / 1000, { units: 'kilometers' });
      if (buffered && buffered.geometry.type === 'Polygon') {
        const bufferPath = coordsToPath(buffered.geometry.coordinates[0], bbox, width, height, padding, true);
        svg += `<path class="buffer-zone" d="${bufferPath}" />`;
      }
    }
  } catch {
    // Buffer generation failed
  }
  
  // Draw area polygon
  for (const ring of areaCoords) {
    const areaPath = coordsToPath(ring, bbox, width, height, padding, true);
    svg += `<path class="area-polygon" d="${areaPath}" />`;
  }
  
  // Draw walk path with color coding
  // For now, draw entire path (future: segment by covered/uncovered)
  const walkPath = coordsToPath(walkCoordinates, bbox, width, height, padding);
  svg += `<path class="walk-path" d="${walkPath}" />`;
  
  // Draw start/end points
  const [startX, startY] = geoToSVG(walkCoordinates[0][0], walkCoordinates[0][1], bbox, width, height, padding);
  const [endX, endY] = geoToSVG(
    walkCoordinates[walkCoordinates.length - 1][0], 
    walkCoordinates[walkCoordinates.length - 1][1], 
    bbox, width, height, padding
  );
  svg += `<circle class="start-point" cx="${startX}" cy="${startY}" r="6" />`;
  svg += `<circle class="end-point" cx="${endX}" cy="${endY}" r="6" />`;
  
  // Add metrics text
  const coveragePercent = (coveredMeters / totalPerimeterMeters * 100).toFixed(1);
  svg += `<text class="title" x="10" y="25">${title || 'Perimeter Coverage'}</text>`;
  svg += `<text class="metric-value" x="10" y="45">Coverage: ${coveragePercent}% (${coveredMeters.toFixed(0)}m / ${totalPerimeterMeters.toFixed(0)}m)</text>`;
  
  // Add legend
  if (showLegend) {
    svg += svgLegend([
      { color: '#fef08a', label: `${PERIMETER_BUFFER_METERS}m buffer zone` },
      { color: '#e0e7ff', label: 'Sub-area' },
      { color: '#3b82f6', label: 'Walk path' },
      { color: '#22c55e', label: 'Start point' },
      { color: '#ef4444', label: 'End point' },
    ], width - 160, 20);
  }
  
  svg += '</svg>';
  return svg;
}

/**
 * Generate area coverage visualization.
 * 
 * Shows:
 * - Sub-area polygon
 * - Walk-enclosed polygon
 * - Intersection area
 * - Loop gap indicator
 */
export function visualizeAreaCoverage(
  walkCoordinates: Position[],
  areaPolygon: Feature<Polygon | MultiPolygon>,
  enclosedSqm: number,
  totalAreaSqm: number,
  isClosedLoop: boolean,
  loopGapMeters: number,
  options: SVGOptions = {}
): string {
  const { width = 800, height = 600, padding = 40, title, showLegend = true } = options;
  
  const areaCoords = areaPolygon.geometry.type === 'Polygon' 
    ? areaPolygon.geometry.coordinates 
    : areaPolygon.geometry.coordinates.flat();
  
  const allCoords = [...areaCoords, [walkCoordinates]];
  const bbox = getBoundingBox(allCoords);
  
  const bboxPadding = 0.001;
  bbox.minLng -= bboxPadding;
  bbox.maxLng += bboxPadding;
  bbox.minLat -= bboxPadding;
  bbox.maxLat += bboxPadding;
  
  let svg = svgHeader(width, height, title || 'Area Coverage Analysis');
  
  // Draw area polygon
  for (const ring of areaCoords) {
    const areaPath = coordsToPath(ring, bbox, width, height, padding, true);
    svg += `<path class="area-polygon" d="${areaPath}" />`;
  }
  
  // Draw walk-enclosed polygon if it's a closed loop
  if (isClosedLoop && walkCoordinates.length >= 4) {
    try {
      const closedCoords = [...walkCoordinates];
      if (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
          closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]) {
        closedCoords.push(closedCoords[0]);
      }
      
      const walkPolygon = turf.polygon([closedCoords]);
      const intersection = turf.intersect(turf.featureCollection([walkPolygon, areaPolygon]));
      
      if (intersection && intersection.geometry.type === 'Polygon') {
        const intersectionPath = coordsToPath(intersection.geometry.coordinates[0], bbox, width, height, padding, true);
        svg += `<path class="intersection-area" d="${intersectionPath}" />`;
      }
      
      // Draw the enclosed area
      const enclosedPath = coordsToPath(closedCoords, bbox, width, height, padding, true);
      svg += `<path class="enclosed-area" d="${enclosedPath}" />`;
    } catch {
      // Invalid polygon
    }
  }
  
  // Draw walk path
  const walkPath = coordsToPath(walkCoordinates, bbox, width, height, padding);
  svg += `<path class="walk-path" d="${walkPath}" />`;
  
  // Draw loop gap line
  const [startX, startY] = geoToSVG(walkCoordinates[0][0], walkCoordinates[0][1], bbox, width, height, padding);
  const [endX, endY] = geoToSVG(
    walkCoordinates[walkCoordinates.length - 1][0], 
    walkCoordinates[walkCoordinates.length - 1][1], 
    bbox, width, height, padding
  );
  
  if (!isClosedLoop) {
    svg += `<line class="loop-gap" x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" />`;
  }
  
  svg += `<circle class="start-point" cx="${startX}" cy="${startY}" r="6" />`;
  svg += `<circle class="end-point" cx="${endX}" cy="${endY}" r="6" />`;
  
  // Add metrics text
  const coveragePercent = (enclosedSqm / totalAreaSqm * 100).toFixed(1);
  svg += `<text class="title" x="10" y="25">${title || 'Area Coverage'}</text>`;
  svg += `<text class="metric-value" x="10" y="45">Coverage: ${coveragePercent}% (${(enclosedSqm / 1000000).toFixed(4)} km² / ${(totalAreaSqm / 1000000).toFixed(4)} km²)</text>`;
  svg += `<text class="metric-value" x="10" y="65">Loop: ${isClosedLoop ? 'Closed' : 'Open'} (gap: ${loopGapMeters.toFixed(1)}m, threshold: ${LOOP_CLOSURE_THRESHOLD_METERS}m)</text>`;
  
  if (showLegend) {
    svg += svgLegend([
      { color: '#e0e7ff', label: 'Sub-area' },
      { color: '#86efac', label: 'Walk-enclosed area' },
      { color: '#a78bfa', label: 'Intersection' },
      { color: '#3b82f6', label: 'Walk path' },
      { color: '#f97316', label: 'Loop gap (if open)' },
    ], width - 180, 20);
  }
  
  svg += '</svg>';
  return svg;
}

/**
 * Generate alignment visualization.
 * 
 * Shows:
 * - Sub-area border
 * - Walk path with color gradient based on distance to border
 */
export function visualizeAlignment(
  walkCoordinates: Position[],
  areaPolygon: Feature<Polygon | MultiPolygon>,
  rmseMeters: number,
  maxDeviationMeters: number,
  p90Meters: number,
  options: SVGOptions = {}
): string {
  const { width = 800, height = 600, padding = 40, title, showLegend = true } = options;
  
  const areaCoords = areaPolygon.geometry.type === 'Polygon' 
    ? areaPolygon.geometry.coordinates 
    : areaPolygon.geometry.coordinates.flat();
  
  const allCoords = [...areaCoords, [walkCoordinates]];
  const bbox = getBoundingBox(allCoords);
  
  const bboxPadding = 0.001;
  bbox.minLng -= bboxPadding;
  bbox.maxLng += bboxPadding;
  bbox.minLat -= bboxPadding;
  bbox.maxLat += bboxPadding;
  
  let svg = svgHeader(width, height, title || 'Alignment Analysis');
  
  // Add gradient definition for alignment coloring
  svg += `
  <defs>
    <linearGradient id="alignmentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#22c55e"/>
      <stop offset="50%" style="stop-color:#eab308"/>
      <stop offset="100%" style="stop-color:#ef4444"/>
    </linearGradient>
  </defs>`;
  
  // Draw area polygon border only
  for (const ring of areaCoords) {
    const areaPath = coordsToPath(ring, bbox, width, height, padding, true);
    svg += `<path fill="none" stroke="#4f46e5" stroke-width="3" d="${areaPath}" />`;
  }
  
  // Calculate distance from border for each point and draw colored segments
  try {
    const perimeterLine = turf.polygonToLine(areaPolygon);
    const lines = perimeterLine.type === 'FeatureCollection' 
      ? perimeterLine.features 
      : [perimeterLine];
    
    for (let i = 0; i < walkCoordinates.length - 1; i++) {
      const coord = walkCoordinates[i];
      const nextCoord = walkCoordinates[i + 1];
      
      // Find minimum distance to any perimeter line
      let minDist = Infinity;
      for (const line of lines) {
        const pt = turf.point(coord);
        const nearestPt = turf.nearestPointOnLine(line as Feature<LineString>, pt);
        const dist = turf.distance(pt, nearestPt, { units: 'meters' });
        if (dist < minDist) minDist = dist;
      }
      
      // Color based on distance (0m = green, 25m = yellow, 50m+ = red)
      const normalizedDist = Math.min(minDist / 50, 1);
      const hue = 120 - normalizedDist * 120; // 120 = green, 0 = red
      const color = `hsl(${hue}, 70%, 50%)`;
      
      const [x1, y1] = geoToSVG(coord[0], coord[1], bbox, width, height, padding);
      const [x2, y2] = geoToSVG(nextCoord[0], nextCoord[1], bbox, width, height, padding);
      
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3" stroke-linecap="round" />`;
    }
  } catch {
    // Fallback: draw plain path
    const walkPath = coordsToPath(walkCoordinates, bbox, width, height, padding);
    svg += `<path class="walk-path" d="${walkPath}" />`;
  }
  
  // Draw start/end points
  const [startX, startY] = geoToSVG(walkCoordinates[0][0], walkCoordinates[0][1], bbox, width, height, padding);
  const [endX, endY] = geoToSVG(
    walkCoordinates[walkCoordinates.length - 1][0], 
    walkCoordinates[walkCoordinates.length - 1][1], 
    bbox, width, height, padding
  );
  svg += `<circle class="start-point" cx="${startX}" cy="${startY}" r="6" />`;
  svg += `<circle class="end-point" cx="${endX}" cy="${endY}" r="6" />`;
  
  // Add metrics text
  const alignmentScore = Math.max(0, 1 - rmseMeters / 50);
  svg += `<text class="title" x="10" y="25">${title || 'Alignment Analysis'}</text>`;
  svg += `<text class="metric-value" x="10" y="45">RMSE: ${rmseMeters.toFixed(1)}m | Max: ${maxDeviationMeters.toFixed(1)}m | P90: ${p90Meters.toFixed(1)}m</text>`;
  svg += `<text class="metric-value" x="10" y="65">Alignment Score: ${(alignmentScore * 100).toFixed(1)}%</text>`;
  
  if (showLegend) {
    svg += `<g class="legend" transform="translate(${width - 160}, 20)">
      <text y="0">Distance from border:</text>
      <rect x="0" y="10" width="16" height="12" fill="#22c55e" />
      <text x="22" y="20">0m (perfect)</text>
      <rect x="0" y="30" width="16" height="12" fill="#eab308" />
      <text x="22" y="40">25m</text>
      <rect x="0" y="50" width="16" height="12" fill="#ef4444" />
      <text x="22" y="60">50m+ (poor)</text>
    </g>`;
  }
  
  svg += '</svg>';
  return svg;
}

// ============================================
// File Output Helpers
// ============================================

/**
 * Save SVG to file in the test output directory.
 */
export function saveSVG(filename: string, content: string): void {
  const outputDir = path.join(process.cwd(), 'src/__tests__/output');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(outputDir, filename), content);
}

/**
 * Generate all visualizations for an analysis result.
 */
export function generateAllVisualizations(
  activityId: string,
  walkCoordinates: Position[],
  areaPolygon: Feature<Polygon | MultiPolygon>,
  areaName: string,
  metrics: {
    coveredMeters: number;
    perimeterMeters: number;
    enclosedSqm: number;
    areaSqm: number;
    isClosedLoop: boolean;
    loopGapMeters: number;
    rmseMeters: number;
    maxDeviationMeters: number;
    p90Meters: number;
  }
): void {
  const prefix = `${activityId}-${areaName.replace(/\s+/g, '_')}`;
  
  // Perimeter coverage
  const perimeterSVG = visualizePerimeterCoverage(
    walkCoordinates,
    areaPolygon,
    metrics.coveredMeters,
    metrics.perimeterMeters,
    { title: `Perimeter Coverage: ${areaName}` }
  );
  saveSVG(`${prefix}-perimeter.svg`, perimeterSVG);
  
  // Area coverage
  const areaSVG = visualizeAreaCoverage(
    walkCoordinates,
    areaPolygon,
    metrics.enclosedSqm,
    metrics.areaSqm,
    metrics.isClosedLoop,
    metrics.loopGapMeters,
    { title: `Area Coverage: ${areaName}` }
  );
  saveSVG(`${prefix}-area.svg`, areaSVG);
  
  // Alignment
  const alignmentSVG = visualizeAlignment(
    walkCoordinates,
    areaPolygon,
    metrics.rmseMeters,
    metrics.maxDeviationMeters,
    metrics.p90Meters,
    { title: `Alignment: ${areaName}` }
  );
  saveSVG(`${prefix}-alignment.svg`, alignmentSVG);
}
