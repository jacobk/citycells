/**
 * Loop Detection Tests
 * 
 * Tests for the loop detection algorithm that determines
 * if a walk forms a closed loop (required for area coverage).
 * 
 * WHY: Area coverage is only calculated for closed loops.
 * If the loop detection is too strict, walks may incorrectly
 * report 0% area coverage.
 */

import { describe, it, expect } from 'vitest';
import { detectLoop, LOOP_CLOSURE_THRESHOLD_METERS } from '@/lib/analysis';
import type { Position } from 'geojson';

describe('detectLoop', () => {
  describe('threshold behavior', () => {
    it('should detect a closed loop when start/end are at same point', () => {
      const coords: Position[] = [
        [13.0, 55.6],  // Start
        [13.01, 55.6],
        [13.01, 55.61],
        [13.0, 55.61],
        [13.0, 55.6],  // Same as start
      ];
      
      const result = detectLoop(coords);
      
      expect(result.isClosedLoop).toBe(true);
      expect(result.gapMeters).toBeCloseTo(0, 0);
    });

    it('should detect a closed loop when gap is under threshold', () => {
      // ~50m gap (well under 100m threshold)
      const coords: Position[] = [
        [13.0, 55.6],      // Start
        [13.01, 55.6],
        [13.01, 55.61],
        [13.0, 55.61],
        [13.0005, 55.6],   // ~50m from start
      ];
      
      const result = detectLoop(coords);
      
      expect(result.isClosedLoop).toBe(true);
      expect(result.gapMeters).toBeLessThan(LOOP_CLOSURE_THRESHOLD_METERS);
    });

    it('should NOT detect a closed loop when gap exceeds threshold', () => {
      // ~150m gap (over 100m threshold)
      const coords: Position[] = [
        [13.0, 55.6],      // Start
        [13.01, 55.6],
        [13.01, 55.61],
        [13.0, 55.61],
        [13.002, 55.6],    // ~150m from start
      ];
      
      const result = detectLoop(coords);
      
      expect(result.isClosedLoop).toBe(false);
      expect(result.gapMeters).toBeGreaterThan(LOOP_CLOSURE_THRESHOLD_METERS);
    });

    it('should report exact gap distance', () => {
      const coords: Position[] = [
        [13.0, 55.6],      // Start
        [13.01, 55.6],
        [13.0, 55.601],    // End ~111m north of start (1 degree lat ≈ 111km)
      ];
      
      const result = detectLoop(coords);
      
      // 0.001 degrees ≈ 111m at this latitude
      expect(result.gapMeters).toBeWithinMeters(111, 10);
    });
  });

  describe('edge cases', () => {
    it('should handle empty coordinates', () => {
      const result = detectLoop([]);
      
      expect(result.isClosedLoop).toBe(false);
      expect(result.gapMeters).toBe(Infinity);
    });

    it('should handle single point', () => {
      const result = detectLoop([[13.0, 55.6]]);
      
      expect(result.isClosedLoop).toBe(false);
      expect(result.gapMeters).toBe(Infinity);
    });

    it('should handle two points', () => {
      const coords: Position[] = [
        [13.0, 55.6],
        [13.0, 55.6],  // Same point
      ];
      
      const result = detectLoop(coords);
      
      expect(result.isClosedLoop).toBe(true);
      expect(result.gapMeters).toBeCloseTo(0, 0);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical GPS drift at start/end (50m)', () => {
      // Simulate a walk that returns to roughly the same place
      // but GPS has ~50m drift
      const coords: Position[] = [
        [13.0000, 55.6000],  // Start
        [13.0100, 55.6000],  // East
        [13.0100, 55.6100],  // North
        [13.0000, 55.6100],  // West
        [13.0005, 55.6004],  // Back near start with ~50m drift
      ];
      
      const result = detectLoop(coords);
      
      expect(result.isClosedLoop).toBe(true);
      console.log(`GPS drift scenario: gap = ${result.gapMeters.toFixed(1)}m`);
    });

    it('should handle walk that ends at different location (out-and-back incomplete)', () => {
      // Walker goes out but doesn't complete the loop
      const coords: Position[] = [
        [13.0000, 55.6000],  // Start
        [13.0100, 55.6000],  // East
        [13.0100, 55.6100],  // North
        [13.0000, 55.6050],  // Back but stopped halfway
      ];
      
      const result = detectLoop(coords);
      
      // Gap should be significant (half the return)
      expect(result.isClosedLoop).toBe(false);
      console.log(`Incomplete loop: gap = ${result.gapMeters.toFixed(1)}m`);
    });
  });
});

describe('LOOP_CLOSURE_THRESHOLD_METERS constant', () => {
  it('should be 100 meters per ADR 003', () => {
    expect(LOOP_CLOSURE_THRESHOLD_METERS).toBe(100);
  });

  it('should be documented as accounting for GPS imprecision', () => {
    // This test serves as documentation
    // The 100m threshold is designed to:
    // 1. Account for GPS accuracy (typically 5-15m)
    // 2. Allow for minor variations in start/end point
    // 3. Not be so large that clearly open paths are counted as loops
    expect(LOOP_CLOSURE_THRESHOLD_METERS).toBeGreaterThanOrEqual(50);
    expect(LOOP_CLOSURE_THRESHOLD_METERS).toBeLessThanOrEqual(200);
  });
});
