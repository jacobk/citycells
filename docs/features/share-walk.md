# Share Walk

## Overview

The Share Walk feature allows users to share their walk achievements with others via shareable URLs or downloadable/copyable images. This enables competitive walkers to showcase their precision walking accomplishments on social media or directly with friends.

The feature provides two sharing mechanisms:
1. **Shareable URL**: A self-contained link encoding all walk data that anyone can view without authentication
2. **Image Export**: Static images in multiple formats (square, wide, story) for various social platforms

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) Section 2 (Share Walk Stories):
- "As a competitive walker, I want to share my walk achievements with friends, so they can see my stats and precision."
- "As a user, I want to generate a shareable URL that anyone can view without logging in, so sharing is frictionless."
- "As a user, I want the shared view to include all stats from the details panel (map, walk route, tier breakdowns, scores), so recipients get the full picture."
- "As a user, I want to generate a shareable image of my walk stats, so I can post it on social media or send via messaging apps."
- "As a user, I want multiple image formats (square, wide, story), so I can share on different platforms optimally."

## Implementation

**Implementation Status:** Complete (2026-02-21)

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/share/types.ts` | ShareableWalkData interface with version field, error types, tier abbreviations |
| `src/lib/share/encode.ts` | Walk data encoding/compression, URL generation, data building helper |
| `src/lib/share/decode.ts` | Version-aware decoding with `decodeV1()`, tier segment expansion |
| `src/lib/share/image.ts` | html2canvas integration for image generation |
| `src/lib/share/index.ts` | Barrel export for share module |
| `src/lib/share/__fixtures__/v1-sample.ts` | Frozen V1 test fixture (NEVER modify) |
| `src/lib/__tests__/share.test.ts` | Unit tests for encode/decode/versioning |
| `src/app/share/walk/page.tsx` | Shared walk viewer page (public, no auth) |
| `src/app/share/walk/SharedWalkMap.tsx` | Map component with tiered route visualization |
| `src/components/ShareModal/ShareModal.tsx` | Share options modal with link/image options |
| `src/components/SharePreview/SharePreview.tsx` | Image layout component for canvas capture |
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Modified to add share button |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     SHARE URL GENERATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Walk Data (from DB) ──► Serialize to JSON ──► Compress (pako)   │
│                                    │                              │
│                                    ▼                              │
│                          Base64url encode ──► Generate URL        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     SHARE URL VIEWING                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  URL param ──► Base64url decode ──► Decompress (pako)            │
│                                           │                       │
│                                           ▼                       │
│                          Version switch ──► decodeV1() ──► Render │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     IMAGE GENERATION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Walk Data ──► Render SharePreview component ──► html2canvas     │
│                                                       │           │
│                                                       ▼           │
│                           Canvas ──► toBlob() ──► Download/Preview│
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `encodeWalkData()` | encode.ts | Compress and base64url encode ShareableWalkData |
| `generateShareUrl()` | encode.ts | Generate full shareable URL with length warning |
| `buildShareableWalkData()` | encode.ts | Construct ShareableWalkData from analysis results |
| `decodeWalkData()` | decode.ts | Version-aware decoder (calls decodeV1, etc.) |
| `decodeV1()` | decode.ts | Decode V1 format (frozen, never modify) |
| `expandTierSegments()` | decode.ts | Convert compact segments to full format |
| `generateShareImage()` | image.ts | Use html2canvas to capture SharePreview |
| `downloadImage()` | image.ts | Trigger browser download of image blob |

## Rationale

### Design Decisions

**URL-Encoded Data (No Server Storage):**
The shareable URL contains all walk data encoded directly in the URL. This eliminates the need for server-side storage of shared walks, making the feature work even if the server is offline and avoiding database maintenance for shared content.

**Schema Versioning:**
All encoded URLs include a version field (`v: 1` for initial release). This enables future changes to the data structure without breaking existing shared links. The decoder uses version-specific functions (`decodeV1()`, `decodeV2()`, etc.) and old decoders are never removed, ensuring all previously shared URLs remain functional indefinitely.

**Client-Side Image Generation:**
Using html2canvas for image generation means no server resources are consumed for image rendering. This keeps hosting costs low and allows instant previews before export.

**Multiple Image Formats:**
Different social platforms have different optimal image dimensions. Providing square (Instagram), wide (Twitter/OG), and story (vertical) formats ensures users can share optimally on their preferred platform.

**Compression with pako:**
Walk data (especially polylines) can be substantial. Using gzip compression significantly reduces URL length while maintaining all data fidelity.

### ADR References

- [ADR 023: Share Walk Feature](../ADR/023-share-walk-feature.md) - Core technical decisions for URL encoding and image generation
- [ADR 021: Tiered Distance Scoring](../ADR/021-tiered-distance-scoring.md) - Tier colors used in walk route visualization
- [ADR 010: Map Visual Design System](../ADR/010-map-visual-design-system.md) - Color palette for consistent branding

## Current Limitations

1. **URL Length Limits:** Very long walks with many tier segments may exceed URL length limits (~2000 chars). Users should use image export for these cases.
2. **Map Tiles in Images:** Static images require map tile attribution; implementation must handle tile loading before canvas capture.
3. **Clipboard API Support:** "Copy Image" may not work in all browsers; feature detection required with fallback to download.
4. **No Server-Side Preview:** Open Graph/Twitter card previews require server-side rendering or pre-generated images (future enhancement).
