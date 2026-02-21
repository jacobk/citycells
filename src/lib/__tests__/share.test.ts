/**
 * Unit Tests for Share Walk Functions
 * 
 * Tests for encoding, decoding, and version handling of shareable walk URLs.
 * 
 * WHY: The ticket (TICKET-029) requires unit tests for:
 * - encodeWalkData() - encoding and compression
 * - decodeWalkData() - version-aware decoding
 * - Round-trip equality (encode → decode → same data)
 * - Error handling for malformed/unsupported data
 * - V1 fixture regression test (CRITICAL for backwards compatibility)
 * 
 * @see docs/ADR/023-share-walk-feature.md - Versioning strategy
 * @see docs/tickets/029-share-walk.md - Testing requirements
 * 
 * @module lib/__tests__/share.test
 */

import { describe, it, expect } from 'vitest';
import {
  encodeWalkData,
  decodeWalkData,
  generateShareUrl,
  validateShareData,
  CURRENT_SHARE_VERSION,
  UnsupportedVersionError,
  InvalidShareDataError,
} from '../share';
import {
  V1_SAMPLE_DATA,
  V1_ENCODED_FIXTURE,
  verifyV1Fixture,
} from '../share/__fixtures__/v1-sample';

// ============================================
// Test Fixtures
// ============================================

// WHY: Minimal valid data for testing edge cases
const minimalValidData = {
  v: 1,
  areaId: '1',
  areaName: 'Test Area',
  walkDate: '2026-01-01',
  boundary: 'abc',
  walkPath: 'xyz',
  tierSegments: [],
  scores: {
    tieredBorderScore: 0.5,
    areaCoverage: 0.5,
    walkFocus: 0.5,
    qualityScore: 0.5,
    tier: 'silver',
  },
  tierDistribution: {
    platinum: 0,
    gold: 0,
    silver: 1,
    bronze: 0,
    potato: 0,
    missed: 0,
  },
  stats: {
    circumference: 1000,
    walkDistance: 1000,
    perimeterWalked: 800,
    area: 100000,
  },
};

// ============================================
// encodeWalkData Tests
// ============================================

describe('encodeWalkData', () => {
  it('should encode typical walk data to valid base64url', () => {
    const encoded = encodeWalkData(V1_SAMPLE_DATA);
    
    // Should be non-empty string
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    
    // Should be URL-safe (no +, /, or =)
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('should include version field in encoded data', () => {
    const encoded = encodeWalkData(V1_SAMPLE_DATA);
    const decoded = decodeWalkData(encoded);
    
    expect(decoded.v).toBe(CURRENT_SHARE_VERSION);
  });

  it('should handle minimal valid data', () => {
    const encoded = encodeWalkData(minimalValidData);
    
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('should produce different output for different input', () => {
    const data1 = { ...minimalValidData, areaName: 'Area One' };
    const data2 = { ...minimalValidData, areaName: 'Area Two' };
    
    const encoded1 = encodeWalkData(data1);
    const encoded2 = encodeWalkData(data2);
    
    expect(encoded1).not.toBe(encoded2);
  });
});

// ============================================
// decodeWalkData Tests
// ============================================

describe('decodeWalkData', () => {
  it('should decode encoded data with round-trip equality', () => {
    const encoded = encodeWalkData(V1_SAMPLE_DATA);
    const decoded = decodeWalkData(encoded);
    
    // Check key fields match
    expect(decoded.v).toBe(V1_SAMPLE_DATA.v);
    expect(decoded.areaId).toBe(V1_SAMPLE_DATA.areaId);
    expect(decoded.areaName).toBe(V1_SAMPLE_DATA.areaName);
    expect(decoded.walkDate).toBe(V1_SAMPLE_DATA.walkDate);
    expect(decoded.stravaActivityId).toBe(V1_SAMPLE_DATA.stravaActivityId);
    expect(decoded.boundary).toBe(V1_SAMPLE_DATA.boundary);
    expect(decoded.walkPath).toBe(V1_SAMPLE_DATA.walkPath);
    expect(decoded.tierSegments).toEqual(V1_SAMPLE_DATA.tierSegments);
    expect(decoded.scores).toEqual(V1_SAMPLE_DATA.scores);
    expect(decoded.tierDistribution).toEqual(V1_SAMPLE_DATA.tierDistribution);
    expect(decoded.stats).toEqual(V1_SAMPLE_DATA.stats);
  });

  it('should handle malformed input gracefully', () => {
    expect(() => decodeWalkData('')).toThrow(InvalidShareDataError);
    expect(() => decodeWalkData('not-valid-base64!')).toThrow(InvalidShareDataError);
    expect(() => decodeWalkData('abc123')).toThrow(InvalidShareDataError);
  });

  it('should throw InvalidShareDataError for null/undefined', () => {
    expect(() => decodeWalkData(null as unknown as string)).toThrow(InvalidShareDataError);
    expect(() => decodeWalkData(undefined as unknown as string)).toThrow(InvalidShareDataError);
  });

  it('should throw UnsupportedVersionError for future versions', () => {
    // Create data with a future version
    const futureData = { ...V1_SAMPLE_DATA, v: 999 };
    const encoded = encodeWalkData(futureData);
    
    expect(() => decodeWalkData(encoded)).toThrow(UnsupportedVersionError);
  });

  it('should provide helpful error message for unsupported version', () => {
    const futureData = { ...V1_SAMPLE_DATA, v: 999 };
    const encoded = encodeWalkData(futureData);
    
    try {
      decodeWalkData(encoded);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedVersionError);
      expect((e as UnsupportedVersionError).message).toContain('newer version');
      expect((e as UnsupportedVersionError).version).toBe(999);
    }
  });
});

// ============================================
// V1 Fixture Regression Test (CRITICAL)
// ============================================

describe('V1 Fixture Regression', () => {
  /**
   * CRITICAL TEST: This must ALWAYS pass.
   * 
   * If this test fails, it means backwards compatibility is broken
   * and old shared URLs will stop working.
   * 
   * DO NOT modify the V1_ENCODED_FIXTURE unless you're certain
   * what you're doing and have a migration plan for existing URLs.
   */
  it('should decode frozen V1 fixture correctly', () => {
    const decoded = decodeWalkData(V1_ENCODED_FIXTURE);
    
    // Verify using the fixture's verification function
    expect(verifyV1Fixture(decoded)).toBe(true);
  });

  it('should decode V1 fixture to matching data', () => {
    const decoded = decodeWalkData(V1_ENCODED_FIXTURE);
    
    // Check all fields match V1_SAMPLE_DATA
    expect(decoded.v).toBe(V1_SAMPLE_DATA.v);
    expect(decoded.areaId).toBe(V1_SAMPLE_DATA.areaId);
    expect(decoded.areaName).toBe(V1_SAMPLE_DATA.areaName);
    expect(decoded.walkDate).toBe(V1_SAMPLE_DATA.walkDate);
    expect(decoded.stravaActivityId).toBe(V1_SAMPLE_DATA.stravaActivityId);
    expect(decoded.boundary).toBe(V1_SAMPLE_DATA.boundary);
    expect(decoded.walkPath).toBe(V1_SAMPLE_DATA.walkPath);
    expect(decoded.tierSegments.length).toBe(V1_SAMPLE_DATA.tierSegments.length);
    expect(decoded.scores.tier).toBe(V1_SAMPLE_DATA.scores.tier);
  });
});

// ============================================
// generateShareUrl Tests
// ============================================

describe('generateShareUrl', () => {
  it('should generate URL with correct format', () => {
    const { url } = generateShareUrl(V1_SAMPLE_DATA, 'https://citycells.app');
    
    expect(url).toMatch(/^https:\/\/citycells\.app\/share\/walk\?d=/);
  });

  it('should include data parameter', () => {
    const { url } = generateShareUrl(V1_SAMPLE_DATA, 'https://citycells.app');
    
    const urlObj = new URL(url);
    const dataParam = urlObj.searchParams.get('d');
    
    expect(dataParam).toBeTruthy();
    expect(dataParam!.length).toBeGreaterThan(0);
  });

  it('should report URL length correctly', () => {
    const result = generateShareUrl(V1_SAMPLE_DATA, 'https://citycells.app');
    
    expect(result.length).toBe(result.url.length);
  });

  it('should flag long URLs', () => {
    // Create data with very long polylines to exceed URL limit
    // WHY: Use random-ish data that doesn't compress well
    const randomChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const makeLongString = (len: number) => {
      let result = '';
      for (let i = 0; i < len; i++) {
        result += randomChars[(i * 7 + 13) % randomChars.length];
      }
      return result;
    };
    
    const longData = {
      ...minimalValidData,
      boundary: makeLongString(3000),
      walkPath: makeLongString(3000),
      tierSegments: Array.from({ length: 500 }, (_, i) => ({
        s: i, e: i + 1, t: ['p', 'g', 's', 'b', 'o', 'm'][i % 6],
      })),
    };
    
    const result = generateShareUrl(longData, 'https://citycells.app');
    
    expect(result.isLong).toBe(true);
    expect(result.length).toBeGreaterThan(2000);
  });
});

// ============================================
// validateShareData Tests
// ============================================

describe('validateShareData', () => {
  it('should validate correct data', () => {
    expect(validateShareData(V1_SAMPLE_DATA)).toBe(true);
    expect(validateShareData(minimalValidData)).toBe(true);
  });

  it('should reject missing required fields', () => {
    const missingAreaId = { ...minimalValidData, areaId: undefined };
    expect(validateShareData(missingAreaId as unknown as typeof minimalValidData)).toBe(false);
    
    const missingScores = { ...minimalValidData, scores: undefined };
    expect(validateShareData(missingScores as unknown as typeof minimalValidData)).toBe(false);
  });

  it('should reject invalid version', () => {
    const noVersion = { ...minimalValidData, v: undefined };
    expect(validateShareData(noVersion as unknown as typeof minimalValidData)).toBe(false);
    
    const zeroVersion = { ...minimalValidData, v: 0 };
    expect(validateShareData(zeroVersion)).toBe(false);
  });
});
