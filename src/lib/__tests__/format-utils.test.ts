/**
 * Unit Tests for Format Utilities
 * 
 * Tests for the formatting functions in src/lib/format-utils.ts.
 * 
 * WHY: formatDistance is used across the UI for consistent distance display.
 * While simple, incorrect formatting would affect user experience.
 * 
 * @module lib/__tests__/format-utils.test
 */

import { describe, it, expect } from 'vitest';
import { formatDistance } from '../format-utils';

describe('formatDistance', () => {
  describe('meters display (< 1000m)', () => {
    it('should format small distances as rounded meters', () => {
      expect(formatDistance(50)).toBe('50 m');
      expect(formatDistance(100)).toBe('100 m');
      expect(formatDistance(999)).toBe('999 m');
    });

    it('should round fractional meters', () => {
      expect(formatDistance(50.4)).toBe('50 m');
      expect(formatDistance(50.6)).toBe('51 m');
      expect(formatDistance(999.9)).toBe('1000 m');
    });

    it('should handle zero meters', () => {
      expect(formatDistance(0)).toBe('0 m');
    });
  });

  describe('kilometers display (>= 1000m)', () => {
    it('should format distances >= 1000m as kilometers with 2 decimals', () => {
      expect(formatDistance(1000)).toBe('1.00 km');
      expect(formatDistance(1500)).toBe('1.50 km');
      expect(formatDistance(2350)).toBe('2.35 km');
    });

    it('should format large distances correctly', () => {
      expect(formatDistance(10000)).toBe('10.00 km');
      expect(formatDistance(42195)).toBe('42.20 km'); // Marathon distance
    });

    it('should handle exact kilometer values', () => {
      expect(formatDistance(5000)).toBe('5.00 km');
      expect(formatDistance(100000)).toBe('100.00 km');
    });
  });

  describe('boundary at 1000m', () => {
    it('should switch to km format exactly at 1000m', () => {
      expect(formatDistance(999)).toBe('999 m');
      expect(formatDistance(1000)).toBe('1.00 km');
    });

    it('should format 999.9m as rounded 1000 m', () => {
      // Math.round(999.9) = 1000, but 999.9 < 1000 so stays in meters
      expect(formatDistance(999.9)).toBe('1000 m');
    });
  });
});
