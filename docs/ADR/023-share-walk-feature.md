# ADR 023: Share Walk Feature

**Date:** 2026-02-21
**Status:** Proposed
**Supersedes:** N/A

## Context

Users who complete walks want to share their achievements with friends and on social media. Currently, there is no way to share walk data outside the app. Competitive walkers in particular want to compare stats and showcase their precision walking accomplishments.

The share functionality needs to support two distinct use cases:
1. **Shareable URL**: A link that anyone can open (no login required) to view the walk details interactively
2. **Image Export**: A static image that can be copied and pasted into other applications (social media, messaging, etc.)

### Requirements

- Must include ALL stats currently visible in the details panel for a matched walk
- Must display the map with the walk route (colored by tier)
- Must show tier breakdowns and scoring details
- No authentication required to view shared content
- Support multiple image formats for different social platforms

### Constraints

- URL must be self-contained (no server-side storage of shared walks)
- Image generation should happen client-side (no server load)
- Walk data can be substantial (polyline coordinates, tier segments)

## Decision

We will implement a Share Walk feature with two sharing mechanisms:

### 1. Shareable URL with Encoded Data

Encode all walk and scoring data directly in the URL using a compressed, URL-safe format.

**URL Structure:**
```
https://citycells.app/share/walk?d={encoded_data}
```

**Data Encoding Pipeline:**
1. Serialize walk data to compact JSON
2. Compress using pako (gzip in browser)
3. Encode with base64url (URL-safe base64)

**Data Payload:**
```typescript
interface ShareableWalkData {
  // Schema version (REQUIRED - must be first field)
  v: number;               // Schema version, starts at 1
  
  // Subarea identification
  areaId: string;
  areaName: string;
  
  // Walk metadata
  walkDate: string;        // ISO date
  stravaActivityId?: number;
  
  // Geometry (compressed)
  boundary: string;        // Encoded polyline of subarea
  walkPath: string;        // Encoded polyline of walk
  tierSegments: TierSegment[]; // Start/end indices with tier
  
  // Scoring data
  scores: {
    tieredBorderScore: number;
    areaCoverage: number;
    walkFocus: number;
    qualityScore: number;
    tier: string;
  };
  
  // Tier distribution
  tierDistribution: {
    platinum: number;
    gold: number;
    silver: number;
    bronze: number;
    potato: number;
    missed: number;
  };
  
  // Stats
  stats: {
    circumference: number;    // meters
    walkDistance: number;     // meters
    perimeterWalked: number;  // meters
    area: number;             // m²
    actualWalkTime?: number;  // seconds
  };
}
```

### 1.1 Schema Versioning Strategy

**CRITICAL:** All shared URLs must remain functional indefinitely. Users may share links that get bookmarked, posted to social media, or saved in documents. Breaking old URLs is unacceptable.

**Version Field:**
- The `v` field is REQUIRED and must be the first field in the encoded data
- Initial version: `v: 1`
- Version is a simple integer, incremented for breaking changes

**Decoder Implementation:**
```typescript
function decodeWalkData(encoded: string): ShareableWalkData {
  const raw = decompress(encoded);
  const data = JSON.parse(raw);
  
  // Version-specific decoding
  switch (data.v) {
    case 1:
      return decodeV1(data);
    case 2:
      return decodeV2(data);
    // Future versions...
    default:
      if (data.v > CURRENT_VERSION) {
        throw new UnsupportedVersionError(data.v);
      }
      throw new InvalidDataError('Missing or invalid version');
  }
}
```

**Migration Rules:**
1. **Adding optional fields:** Does NOT require version bump (v1 decoder ignores unknown fields)
2. **Adding required fields:** Requires version bump; old decoder must handle missing fields with defaults
3. **Renaming fields:** Requires version bump; migration function maps old names to new
4. **Removing fields:** Requires version bump; old URLs continue to include removed data (harmless)
5. **Changing field types:** Requires version bump; migration function converts types

**Backwards Compatibility Contract:**
- The application MUST support decoding ALL previous versions forever
- Each version has its own decode function: `decodeV1()`, `decodeV2()`, etc.
- Old decoders are never removed, only new ones are added
- Unit tests MUST include fixtures for each version to prevent regressions

**Version Upgrade Path Example:**
```typescript
// v1 -> current format migration
function decodeV1(data: V1Data): ShareableWalkData {
  return {
    v: 1,
    areaId: data.areaId,
    areaName: data.areaName,
    // ... map all v1 fields
    // For fields added in v2+, use sensible defaults:
    newFieldAddedInV2: data.newFieldAddedInV2 ?? defaultValue,
  };
}
```

**Error Handling:**
- If version is higher than supported: Show user-friendly message "This link was created with a newer version of CityCells. Please refresh the page or try again later."
- If version is missing/invalid: Show "Invalid share link" error
- If data is corrupted: Show "This link appears to be damaged" error

**URL Length Considerations:**
- Target: Keep URLs under 2000 characters (safe for most browsers/platforms)
- Polylines already use efficient encoding (Google Polyline Algorithm)
- If data exceeds limit, show warning suggesting image export instead

### 2. Client-Side Image Generation

Generate shareable images using HTML Canvas/html2canvas approach.

**Image Formats:**

| Format | Dimensions | Use Case |
|--------|------------|----------|
| Square | 1080x1080 | Instagram, general |
| Wide | 1200x630 | Twitter/X, Open Graph |
| Story | 1080x1920 | Instagram Stories |

**Image Content Layout:**
```
┌─────────────────────────────────────────┐
│  [CityCells Logo]     [Area Name]       │
│                       [Tier Badge]      │
├─────────────────────────────────────────┤
│                                         │
│           [MAP WITH WALK ROUTE]         │
│           (colored by tier)             │
│                                         │
├─────────────────────────────────────────┤
│  Stats:              Tier Breakdown:    │
│  - Circumference     [===] Platinum 15% │
│  - Walk Distance     [===] Gold 28%     │
│  - Walk Time         [===] Silver 22%   │
│  - Quality Score     [===] Bronze 12%   │
│                      [===] Potato 8%    │
│                      [===] Missed 15%   │
├─────────────────────────────────────────┤
│  Score: 0.82 (Gold)   citycells.app     │
└─────────────────────────────────────────┘
```

**Image Generation Approach:**
- Render share preview as React component
- Use html2canvas to capture as image
- Support PNG export with transparency option
- Copy to clipboard using Clipboard API

### Share UI Entry Point

**Location:** Area Details Panel (when viewing a matched walk)

**Share Button:**
- Icon: Standard share icon
- Position: Near mini-map maximize button or in header
- Only visible when area has at least one matched walk

**Share Modal Options:**
1. "Copy Link" - Generates and copies shareable URL
2. "Download Image" - Opens format selector, then downloads
3. "Copy Image" - Copies image to clipboard (where supported)

## Consequences

### Positive

- Users can share achievements without logging in on the receiving end
- No server-side storage required for shared walks
- Image export works across all platforms
- Client-side generation means no server costs for image rendering
- Self-contained URLs are resilient (work even if server is down)

### Negative

- Large walks may exceed URL length limits
- Image generation quality depends on browser canvas implementation
- Map tiles in images require attribution handling
- URL encoding adds complexity to URL parsing

### Technical

- New `/share/walk` route needed for viewing shared URLs
- pako library dependency for compression
- html2canvas library dependency for image generation
- May need to render map to canvas for image export (not just DOM capture)

### Maintainability

- **Modularity:** Share encoding/decoding should be isolated in `src/lib/share/` for easy testing
- **DRY:** Reuse existing tier color constants and scoring display components
- **Testing:** Unit tests required for encode/decode functions to ensure URL compatibility
- **Versioning:** Schema version (`v` field) enables non-breaking evolution of data format
- **Version test fixtures:** Each schema version must have frozen test fixtures to catch regressions
- **Never delete old decoders:** All `decodeV{N}()` functions must be maintained forever
