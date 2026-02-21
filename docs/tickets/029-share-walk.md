# TICKET-029: Share Walk Feature

**Related:** ADR 023, PRD Section 3.17  
**Feature:** Share Walk (docs/features/share-walk.md)  
**Status:** Ready for Implementation  
**Created:** 2026-02-21

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/023-share-walk-feature.md` - Technical decisions for URL encoding, image generation, and data schema
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.17 - Functional requirements for share feature
3. `docs/features/share-walk.md` - Feature overview and implementation placeholders to fill
4. `src/components/panels/AreaDetailsPanel.tsx` - Panel where share button will be added
5. `src/lib/geo-distance.ts` - Existing geo utilities to understand patterns
6. `docs/ADR/021-tiered-distance-scoring.md` - Tier colors for route visualization

## Implementation Checklist

### 1. Create Share Data Types and Encoding Utilities

Create `src/lib/share/types.ts` with `ShareableWalkData` interface (see ADR 023).
- **CRITICAL:** Include `v: number` as first field for schema versioning
- Export `CURRENT_SHARE_VERSION = 1`

Create `src/lib/share/encode.ts`:
- `encodeWalkData(data: ShareableWalkData): string` - Serialize, compress with pako, base64url encode
- `generateShareUrl(data: ShareableWalkData): string` - Create full shareable URL
- Always set `v: CURRENT_SHARE_VERSION` when encoding

Create `src/lib/share/decode.ts`:
- `decodeWalkData(encoded: string): ShareableWalkData` - Version-aware decoder
- Implement version switch: `decodeV1()`, future `decodeV2()`, etc.
- Handle malformed/corrupted data gracefully
- Handle unsupported future versions with user-friendly error
- **NEVER delete old version decoders** - old URLs must work forever

### 2. Create Shared Walk Viewer Page

Create `src/app/share/walk/page.tsx`:
- Parse `d` query parameter
- Decode walk data
- Render interactive map with boundary and walk route
- Display all stats (same as AreaDetailsPanel when viewing matched walk)
- No authentication required
- Handle invalid/expired links gracefully

### 3. Create Share Modal Component

Create `src/components/ShareModal.tsx`:
- Three options: Copy Link, Download Image, Copy Image
- Format selector for image (Square, Wide, Story)
- Loading states during generation
- Success/error feedback
- Close on backdrop click or X button

### 4. Create Share Preview Component

Create `src/components/SharePreview.tsx`:
- React component rendering the shareable image layout
- Accept format prop (square, wide, story)
- Include: logo, area name, tier badge, map, stats, tier distribution, watermark
- Optimized for canvas capture (no external fonts/images that may fail)

### 5. Implement Image Generation

In `src/lib/share/image.ts`:
- `generateShareImage(data: ShareableWalkData, format: 'square' | 'wide' | 'story'): Promise<Blob>`
- Use html2canvas to capture SharePreview component
- Handle map tile loading (wait for tiles before capture)
- Return image blob for download or clipboard

### 6. Add Share Button to Area Details Panel

Modify `src/components/panels/AreaDetailsPanel.tsx`:
- Add share button (icon) in header area
- Only show when area has matched walk(s)
- On click, open ShareModal with current walk data
- Extract walk data into ShareableWalkData format

### 7. Install Dependencies

Add required packages:
- `pako` - gzip compression/decompression
- `html2canvas` - DOM to canvas capture

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Tier colors are defined in multiple places; consider centralizing in `src/lib/constants/tiers.ts`
- [x] **DRY check** - Reuse existing tier color definitions from map visualization
- [x] **Modularity** - All share logic isolated in `src/lib/share/` for easy testing
- [x] **Debt impact** - Reduces debt by formalizing tier colors; adds pako/html2canvas dependencies

**Specific refactoring tasks:**
- Consider extracting tier color constants to shared location if not already centralized
- SharePreview should reuse existing stat display components where possible

## Testing Requirements

**Reference:** [AGENTS.md Section 2](../../AGENTS.md#2-build-verification-checklist-required), [ADR 020](../ADR/020-agent-build-verification.md)

### Unit Tests Required

| Function | Test File | Test Cases |
|----------|-----------|------------|
| `encodeWalkData` | `src/lib/__tests__/share.test.ts` | Encode typical walk data, verify output is valid base64url |
| `encodeWalkData` | `src/lib/__tests__/share.test.ts` | Encoded data includes version field `v` |
| `decodeWalkData` | `src/lib/__tests__/share.test.ts` | Decode encoded data, verify round-trip equality |
| `decodeWalkData` | `src/lib/__tests__/share.test.ts` | Handle malformed input gracefully (throw or return null) |
| `decodeWalkData` | `src/lib/__tests__/share.test.ts` | Handle unsupported future version with specific error |
| `decodeV1` | `src/lib/__tests__/share.test.ts` | Decode frozen V1 fixture (regression test) |
| `generateShareUrl` | `src/lib/__tests__/share.test.ts` | URL format correct, data parameter present |

**Version Fixture Requirement:**
Create `src/lib/share/__fixtures__/v1-sample.ts` with a frozen encoded string representing V1 data.
This fixture must NEVER be modified and must be tested on every run to ensure old URLs remain decodable.

### Verification Checklist

Implementation agent MUST run before marking complete:
```bash
npm run lint   # Must pass
npm run build  # Must pass
npm run test   # Must pass
```

## Acceptance Criteria

- [ ] Share button visible in Area Details Panel when viewing area with matched walk
- [ ] Clicking share button opens modal with Copy Link, Download Image, Copy Image options
- [ ] Copy Link copies a valid URL to clipboard that opens in new tab without login
- [ ] Shared URL displays map with boundary and walk route (tier-colored)
- [ ] Shared URL displays all stats: area name, tier, scores, tier distribution
- [ ] Download Image downloads PNG in selected format (square/wide/story)
- [ ] Downloaded image contains map, stats, tier breakdown, and CityCells branding
- [ ] Copy Image copies image to clipboard (where browser supports)
- [ ] URL length warning shown if walk data exceeds limit (suggest image instead)
- [ ] **Encoded URLs include version field (`v: 1`)**
- [ ] **Decoder handles version switching correctly**
- [ ] **V1 fixture test passes (frozen encoded string decodes correctly)**
- [ ] **Unsupported future version shows user-friendly error message**
- [ ] All tests pass (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Lint passes (`npm run lint`)

## Files to Modify

| File | Change |
|------|--------|
| NEW: `src/lib/share/types.ts` | ShareableWalkData interface with version field |
| NEW: `src/lib/share/encode.ts` | Encoding/URL generation functions |
| NEW: `src/lib/share/decode.ts` | Version-aware decoding with decodeV1(), etc. |
| NEW: `src/lib/share/image.ts` | Image generation function |
| NEW: `src/lib/share/index.ts` | Barrel export |
| NEW: `src/lib/share/__fixtures__/v1-sample.ts` | Frozen V1 encoded string for regression tests |
| NEW: `src/app/share/walk/page.tsx` | Shared walk viewer page |
| NEW: `src/components/ShareModal.tsx` | Share options modal |
| NEW: `src/components/SharePreview.tsx` | Image layout component |
| NEW: `src/lib/__tests__/share.test.ts` | Unit tests for encode/decode including version fixtures |
| `src/components/panels/AreaDetailsPanel.tsx` | Add share button |
| `package.json` | Add pako, html2canvas dependencies |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- Ensure map tiles are loaded before canvas capture (may need to wait for tile load events)
- Consider progressive loading for shared view (show loading state while decoding)
- Clipboard API for images requires HTTPS in production
