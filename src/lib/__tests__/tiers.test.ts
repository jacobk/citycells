/**
 * Unit Tests for Tier Assignment
 * 
 * Tests for the centralized tier assignment logic in src/lib/tiers.ts.
 * 
 * WHY: The assignTier() function has a bug history (TICKET-016) where the
 * potato tier was missing in some locations, causing areas to disappear
 * after page refresh. These tests ensure the tier boundaries are correct.
 * 
 * See ADR 003 for tier thresholds.
 * See TICKET-016 for the potato tier persistence bug.
 * 
 * @module lib/__tests__/tiers.test
 */

import { describe, it, expect } from 'vitest';
import { assignTier, TIER_THRESHOLDS } from '../tiers';

describe('assignTier', () => {
  describe('tier boundary values', () => {
    it('should assign platinum for score >= 0.95', () => {
      expect(assignTier(0.95)).toBe('platinum');
      expect(assignTier(0.99)).toBe('platinum');
      expect(assignTier(1.0)).toBe('platinum');
    });

    it('should assign gold for score >= 0.85 and < 0.95', () => {
      expect(assignTier(0.85)).toBe('gold');
      expect(assignTier(0.90)).toBe('gold');
      expect(assignTier(0.9499)).toBe('gold');
    });

    it('should assign silver for score >= 0.70 and < 0.85', () => {
      expect(assignTier(0.70)).toBe('silver');
      expect(assignTier(0.77)).toBe('silver');
      expect(assignTier(0.8499)).toBe('silver');
    });

    it('should assign bronze for score >= 0.50 and < 0.70', () => {
      expect(assignTier(0.50)).toBe('bronze');
      expect(assignTier(0.60)).toBe('bronze');
      expect(assignTier(0.6999)).toBe('bronze');
    });

    it('should assign potato for score > 0 and < 0.50', () => {
      // WHY: This was the root cause of TICKET-016
      // Potato tier areas were disappearing because this case was missing
      expect(assignTier(0.01)).toBe('potato');
      expect(assignTier(0.25)).toBe('potato');
      expect(assignTier(0.4999)).toBe('potato');
    });

    it('should return null for score = 0', () => {
      expect(assignTier(0)).toBeNull();
    });
  });

  describe('exact boundary transitions', () => {
    it('should correctly handle platinum/gold boundary (0.95)', () => {
      expect(assignTier(0.95)).toBe('platinum');
      expect(assignTier(0.9499999)).toBe('gold');
    });

    it('should correctly handle gold/silver boundary (0.85)', () => {
      expect(assignTier(0.85)).toBe('gold');
      expect(assignTier(0.8499999)).toBe('silver');
    });

    it('should correctly handle silver/bronze boundary (0.70)', () => {
      expect(assignTier(0.70)).toBe('silver');
      expect(assignTier(0.6999999)).toBe('bronze');
    });

    it('should correctly handle bronze/potato boundary (0.50)', () => {
      expect(assignTier(0.50)).toBe('bronze');
      expect(assignTier(0.4999999)).toBe('potato');
    });

    it('should correctly handle potato/null boundary (0)', () => {
      expect(assignTier(0.0001)).toBe('potato');
      expect(assignTier(0)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle negative scores as null', () => {
      // WHY: Negative scores shouldn't happen but if they do, treat as no tier
      expect(assignTier(-0.1)).toBeNull();
      expect(assignTier(-1)).toBeNull();
    });

    it('should handle scores > 1 as platinum', () => {
      // WHY: Scores > 1 shouldn't happen but if they do, cap at platinum
      expect(assignTier(1.5)).toBe('platinum');
      expect(assignTier(2.0)).toBe('platinum');
    });
  });
});

describe('TIER_THRESHOLDS', () => {
  it('should have correct threshold values per ADR 003', () => {
    expect(TIER_THRESHOLDS.platinum).toBe(0.95);
    expect(TIER_THRESHOLDS.gold).toBe(0.85);
    expect(TIER_THRESHOLDS.silver).toBe(0.70);
    expect(TIER_THRESHOLDS.bronze).toBe(0.50);
  });

  it('should be in descending order', () => {
    expect(TIER_THRESHOLDS.platinum).toBeGreaterThan(TIER_THRESHOLDS.gold);
    expect(TIER_THRESHOLDS.gold).toBeGreaterThan(TIER_THRESHOLDS.silver);
    expect(TIER_THRESHOLDS.silver).toBeGreaterThan(TIER_THRESHOLDS.bronze);
  });
});
