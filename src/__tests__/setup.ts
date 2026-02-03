/**
 * Vitest Setup File
 * 
 * Global setup for all tests including mocks and utilities.
 */

import { expect } from 'vitest';

// Custom matchers for analysis metrics
expect.extend({
  /**
   * Check if a number is within a percentage tolerance of expected value.
   * Useful for floating point comparisons in analysis metrics.
   */
  toBeWithinPercent(received: number, expected: number, tolerancePercent: number) {
    const tolerance = expected * (tolerancePercent / 100);
    const pass = Math.abs(received - expected) <= tolerance;
    
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within ${tolerancePercent}% of ${expected}`
          : `expected ${received} to be within ${tolerancePercent}% of ${expected} (tolerance: ±${tolerance.toFixed(4)})`,
    };
  },

  /**
   * Check if a metric is within absolute tolerance (useful for meters).
   */
  toBeWithinMeters(received: number, expected: number, toleranceMeters: number) {
    const pass = Math.abs(received - expected) <= toleranceMeters;
    
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received}m not to be within ${toleranceMeters}m of ${expected}m`
          : `expected ${received}m to be within ${toleranceMeters}m of ${expected}m (diff: ${Math.abs(received - expected).toFixed(2)}m)`,
    };
  },
});

// Extend Vitest's expect types
declare module 'vitest' {
  interface Assertion<T> {
    toBeWithinPercent(expected: number, tolerancePercent: number): T;
    toBeWithinMeters(expected: number, toleranceMeters: number): T;
  }
  interface AsymmetricMatchersContaining {
    toBeWithinPercent(expected: number, tolerancePercent: number): unknown;
    toBeWithinMeters(expected: number, toleranceMeters: number): unknown;
  }
}
