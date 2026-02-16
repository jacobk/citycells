# Ticket 020: Brand Assets Creation

**Status:** Ready for Implementation
**Feature:** Branding & Visual Identity
**PRD Reference:** [PRD-001 Section 3.14](../PRD/001-mvp-mobile-walker.md#314-branding--visual-identity-added-2026-02-16)
**ADR Reference:** [ADR-018 Modern Branding & Design System](../ADR/018-branding-design-system.md)
**Blocks:** [Ticket 021](./021-design-system-implementation.md)

## Context

CityCells needs a professional visual identity. This ticket covers creating the brand assets (logo, favicon suite) that will be integrated by Ticket 021.

## Deliverables

### 1. Logo
- [ ] **Primary Logo (SVG):** A modern, geometric mark representing "CityCells" (polygons/cells/map).
- [ ] **Isotype (SVG):** Simplified icon-only version for small contexts.
- [ ] **Color Variants:** Primary (on light bg), Inverted (on dark bg), Monochrome.

### 2. Favicon Suite
Generate a complete favicon package using a tool like [RealFaviconGenerator](https://realfavicongenerator.net/):
- [ ] `favicon.ico` (16x16, 32x32)
- [ ] `favicon.svg` (scalable, modern browsers)
- [ ] `apple-touch-icon.png` (180x180)
- [ ] `android-chrome-192x192.png`
- [ ] `android-chrome-512x512.png`
- [ ] `site.webmanifest` (for PWA/Android)

### 3. Output Location
Place all assets in `public/branding/`:
```
public/
├── branding/
│   ├── logo.svg
│   ├── logo-inverted.svg
│   ├── isotype.svg
│   └── isotype-inverted.svg
├── favicon.ico
├── favicon.svg
├── apple-touch-icon.png
├── android-chrome-192x192.png
├── android-chrome-512x512.png
└── site.webmanifest
```

## Design Guidelines

**Color Palette (from ADR 018):**
- Primary: Violet (`#7c3aed`)
- Accent: Fuchsia (`#d946ef`)

**Style:**
- Modern, geometric, clean lines.
- Should evoke "cells", "map polygons", or "exploration".
- Works at small sizes (favicon) and large (documentation header).

## Acceptance Criteria
- [ ] All listed SVG and PNG files exist in `public/`.
- [ ] Logo is visually distinct and represents the CityCells concept.
- [ ] Favicon renders correctly at 16x16 (legible, not muddy).
- [ ] Assets use the defined brand colors.

## Notes
- This is a **design/asset task**, not a code task.
- Once complete, Ticket 021 will integrate these assets into the codebase.
