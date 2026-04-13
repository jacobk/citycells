/**
 * Walk Shape Generation
 *
 * Generates filled polygons from GPS track coordinates to visualize
 * actual ground coverage. Treats the walk path as a polygon boundary
 * and fills the enclosed area (like a "paint bucket" fill).
 *
 * @see docs/ADR/027-map-layer-toggles.md
 */

import type { Feature, Polygon } from 'geojson';

/**
 * Generate a filled polygon from GPS track coordinates.
 *
 * Treats the walk path as a polygon boundary. If the path is not
 * closed (start !== end), it is automatically closed by appending
 * the first coordinate.
 *
 * @param latlngCoords - Array of [lat, lng] pairs (Leaflet/GPS order)
 * @returns GeoJSON Feature<Polygon>, or null if insufficient data (<3 points)
 */
export function generateWalkShape(
  latlngCoords: [number, number][],
): Feature<Polygon> | null {
  if (!latlngCoords || latlngCoords.length < 3) return null;

  // Convert [lat, lng] to GeoJSON [lng, lat]
  const coordinates = latlngCoords.map(([lat, lng]) => [lng, lat]);

  // Close the ring if not already closed (GeoJSON polygons require closed rings)
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push([first[0], first[1]]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
  };
}
