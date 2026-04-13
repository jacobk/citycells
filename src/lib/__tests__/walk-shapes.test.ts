/**
 * Unit Tests for Walk Shape Generation
 *
 * Tests for GPS track polygon creation in src/lib/walk-shapes.ts.
 *
 * @see docs/ADR/027-map-layer-toggles.md
 *
 * @module lib/__tests__/walk-shapes.test
 */

import { describe, it, expect } from 'vitest';
import { generateWalkShape } from '../walk-shapes';

describe('generateWalkShape', () => {
  it('returns a valid polygon from 3+ GPS points', () => {
    const coords: [number, number][] = [
      [55.590, 13.000],
      [55.591, 13.001],
      [55.592, 13.002],
    ];

    const result = generateWalkShape(coords);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('Feature');
    expect(result!.geometry.type).toBe('Polygon');
  });

  it('returns null for empty input', () => {
    expect(generateWalkShape([])).toBeNull();
  });

  it('returns null for a single point', () => {
    expect(generateWalkShape([[55.590, 13.000]])).toBeNull();
  });

  it('returns null for two points', () => {
    const coords: [number, number][] = [
      [55.590, 13.000],
      [55.591, 13.001],
    ];
    expect(generateWalkShape(coords)).toBeNull();
  });

  it('returns a valid polygon from a closed loop', () => {
    const coords: [number, number][] = [
      [55.590, 13.000],
      [55.591, 13.001],
      [55.592, 13.000],
      [55.590, 13.000], // same as first point
    ];

    const result = generateWalkShape(coords);

    expect(result).not.toBeNull();
    expect(result!.geometry.type).toBe('Polygon');
    // Ring should be closed (first === last)
    const ring = result!.geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('closes an open path by appending the first coordinate', () => {
    const coords: [number, number][] = [
      [55.590, 13.000],
      [55.591, 13.001],
      [55.592, 13.002],
    ];

    const result = generateWalkShape(coords);
    const ring = result!.geometry.coordinates[0];

    // Should have 4 coordinates (3 input + 1 closing)
    expect(ring.length).toBe(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('does not double-close an already closed path', () => {
    const coords: [number, number][] = [
      [55.590, 13.000],
      [55.591, 13.001],
      [55.592, 13.002],
      [55.590, 13.000], // already closed
    ];

    const result = generateWalkShape(coords);
    const ring = result!.geometry.coordinates[0];

    // Should have 4 coordinates (not 5)
    expect(ring.length).toBe(4);
  });

  it('converts [lat, lng] to GeoJSON [lng, lat] order', () => {
    const coords: [number, number][] = [
      [55.590, 13.000],
      [55.591, 13.001],
      [55.592, 13.002],
    ];

    const result = generateWalkShape(coords);
    const ring = result!.geometry.coordinates[0];

    // First coordinate: input [lat=55.590, lng=13.000] → output [lng=13.000, lat=55.590]
    expect(ring[0][0]).toBe(13.000);
    expect(ring[0][1]).toBe(55.590);
  });

  it('returns null for null/undefined input', () => {
    expect(generateWalkShape(null as unknown as [number, number][])).toBeNull();
    expect(generateWalkShape(undefined as unknown as [number, number][])).toBeNull();
  });
});
