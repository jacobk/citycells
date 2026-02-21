/**
 * V1 Share Data Fixture
 * 
 * CRITICAL: This file contains frozen test data for V1 schema.
 * DO NOT MODIFY these values after release.
 * 
 * WHY: Ensures backwards compatibility - old shared URLs must always decode correctly.
 * The encoded string represents a real V1 payload and must decode to the expected object.
 * Any changes to the encoding algorithm must not break decoding of this fixture.
 * 
 * @see docs/ADR/023-share-walk-feature.md Section 1.1 - Versioning strategy
 * @see docs/tickets/029-share-walk.md - Testing requirements
 * 
 * @module share/__fixtures__/v1-sample
 */

import type { ShareableWalkData } from '../types';

/**
 * Sample V1 ShareableWalkData for testing.
 * 
 * This represents a realistic walk around "Västra Hamnen" sub-area.
 * Values are synthetic but representative of actual app usage.
 */
export const V1_SAMPLE_DATA: ShareableWalkData = {
  v: 1,
  areaId: '42',
  areaName: 'Västra Hamnen',
  walkDate: '2026-02-15',
  stravaActivityId: 12345678901,
  boundary: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',  // Sample encoded polyline
  walkPath: 'a~l~Fjk~uOwHJy@P',              // Sample walk path polyline
  tierSegments: [
    { s: 0, e: 1, t: 'p' },   // platinum
    { s: 1, e: 2, t: 'g' },   // gold
    { s: 2, e: 3, t: 's' },   // silver
    { s: 3, e: 4, t: 'b' },   // bronze
    { s: 4, e: 5, t: 'o' },   // potato
    { s: 5, e: 6, t: 'm' },   // missed
  ],
  scores: {
    tieredBorderScore: 0.72,
    areaCoverage: 0.65,
    walkFocus: 0.89,
    qualityScore: 0.74,
    tier: 'silver',
  },
  tierDistribution: {
    platinum: 0.15,
    gold: 0.28,
    silver: 0.22,
    bronze: 0.12,
    potato: 0.08,
    missed: 0.15,
  },
  stats: {
    circumference: 2300,
    walkDistance: 2650,
    perimeterWalked: 2100,
    area: 450000,
  },
};

/**
 * Pre-computed encoded string for V1_SAMPLE_DATA.
 * 
 * CRITICAL: This string is FROZEN. Do not regenerate it.
 * It was generated once when V1 was released and must decode
 * correctly forever, regardless of any future encoding changes.
 * 
 * To verify: decodeWalkData(V1_ENCODED_FIXTURE) should equal V1_SAMPLE_DATA
 * 
 * If this test ever fails, it means backwards compatibility is broken.
 */
export const V1_ENCODED_FIXTURE = 'H4sIAAAAAAAAA0WS306DMBTGX8X0GhfoALddTV0WNWYuMeqFMfMM6qzSlpXCnBOexjfxxTxtJXLRcH7nT7_vwIE0ZBIFBDSDy5xMSEyJjxYgGMb3P9-V0XB0AUIyibkdFO8zMDZHQ5oeh_Q4SpDbqgZOM8MbbvZ2VkSHcZKejMYhXrBWtcxB77FtVXZ83pXV192qLq6l3J6vxHbRfGyfp3_zl2BesRC6opu_vXf1ze7iaj9dYtZwpm_ZRjBpKjJ5PBA8w4AwZ8JgT0nawNHIUerppqfU0aGnVU-HjsaernsaO5p4qnqaOJp6Kkj7hNYzpRmmDk4ey8-UzlGmpahucEL9Rs9VwzRsHEsT73SustpaGIzGAdnWUODu_htjb9hK5QU2owYHZhy3zde14Uraa8sCDJe1sE0RTt6oIrfvdBT0nTZCHWut5KcbHmFUKgNG2SjESsGriuV-Rms_KBhnKuM6q8ULOpOZXekwDP9-A5QBnqUJspJpLphh-gGTdhKNbKn1jttMQnza9hd9nRNWcgIAAA';

/**
 * Verify the encoded fixture matches expected data.
 * 
 * This function is used in tests to ensure backwards compatibility.
 * It should ALWAYS pass - if it fails, something is seriously broken.
 */
export function verifyV1Fixture(decoded: ShareableWalkData): boolean {
  // Check version
  if (decoded.v !== 1) return false;
  
  // Check core fields
  if (decoded.areaId !== V1_SAMPLE_DATA.areaId) return false;
  if (decoded.areaName !== V1_SAMPLE_DATA.areaName) return false;
  if (decoded.walkDate !== V1_SAMPLE_DATA.walkDate) return false;
  if (decoded.stravaActivityId !== V1_SAMPLE_DATA.stravaActivityId) return false;
  
  // Check polylines
  if (decoded.boundary !== V1_SAMPLE_DATA.boundary) return false;
  if (decoded.walkPath !== V1_SAMPLE_DATA.walkPath) return false;
  
  // Check tier segments count
  if (decoded.tierSegments.length !== V1_SAMPLE_DATA.tierSegments.length) return false;
  
  // Check scores (with floating point tolerance)
  const scoreTolerance = 0.001;
  if (Math.abs(decoded.scores.qualityScore - V1_SAMPLE_DATA.scores.qualityScore) > scoreTolerance) return false;
  
  return true;
}
