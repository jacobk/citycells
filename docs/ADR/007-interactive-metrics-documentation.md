# ADR 007: Interactive Metrics Documentation with D3 Visualizations

**Date:** 2026-02-03
**Status:** Proposed
**Supersedes:** N/A

## Context

The CityCells analysis engine calculates multiple metrics (perimeter coverage, area coverage, alignment, efficiency) that determine a walk's quality score. Currently:

1. Users see numeric values in the Area Details Panel but lack understanding of *what they mean* or *how to improve*
2. Technical metric names (e.g., "RMSE Alignment") don't communicate purpose to casual users
3. The mathematical concepts behind scoring are documented only in developer ADRs/feature docs, not accessible to end users
4. Users can't visualize how their walk path relates to the scoring algorithm

**Requirements:**
- Metric names should be self-explanatory to non-technical users
- Each metric should have in-app documentation accessible via the UI
- Documentation should be pedagogical with visual examples
- Visualizations should be interactive to demonstrate mathematical concepts

## Decision

We will implement an in-app metrics documentation system with the following components:

### 1. User-Friendly Metric Names

Replace technical names with action-based alternatives:

| Technical Name | User-Friendly Name | Purpose Summary |
|----------------|-------------------|-----------------|
| Perimeter Coverage | **Border Traced** | How much of the area's outline you walked |
| Area Coverage | **Area Enclosed** | Whether your walk completed a full loop |
| Alignment Score | **Path Precision** | How close you stayed to the border |
| Efficiency | **Route Efficiency** | Whether you avoided unnecessary detours |

### 2. Documentation Page Structure

Create dedicated pages at `/docs/metrics/[metric-slug]`:

```
/docs/metrics/
├── page.tsx              # Metrics overview/index
├── border-traced/
│   └── page.tsx          # Perimeter coverage deep-dive
├── area-enclosed/
│   └── page.tsx          # Area coverage deep-dive
├── path-precision/
│   └── page.tsx          # Alignment score deep-dive
└── route-efficiency/
    └── page.tsx          # Efficiency deep-dive
```

### 3. Visualization Library: D3.js

**Choice:** D3.js (Data-Driven Documents)

**Rationale:**
- Already widely used in geospatial/mapping contexts
- Fine-grained control over SVG rendering needed for mathematical diagrams
- Can integrate with existing GeoJSON data formats
- Rich ecosystem for animated/interactive visualizations
- No additional map tile dependency (pure SVG illustrations)

**Alternatives Considered:**
- **Recharts/Chart.js**: Too focused on standard chart types, limited custom geometry support
- **Three.js**: Overkill for 2D explanatory diagrams
- **Canvas API**: Less accessible, harder to animate and interact with
- **Framer Motion + SVG**: Good for simple animations but less suited for data-bound visualizations

### 4. Documentation Content Structure

Each metric documentation page will include:

1. **Plain English Summary** (1-2 sentences)
2. **Why It Matters** (motivation for the metric)
3. **How It's Calculated** (step-by-step with visuals)
4. **Interactive Visualization** (D3-powered diagram)
5. **Examples** (good vs. poor scores with visual comparison)
6. **Tips to Improve** (actionable advice)

### 5. Interactive Visualization Specifications

Each metric page includes a D3 visualization:

| Metric | Visualization |
|--------|---------------|
| Border Traced | Animated path tracing around a polygon with buffer zone highlighted |
| Area Enclosed | Two-polygon comparison (walk path vs sub-area) showing intersection |
| Path Precision | Heat map of distance from border (green=close, red=far) with RMSE calculation |
| Route Efficiency | Side-by-side comparison of efficient vs inefficient paths |

### 6. UI Integration

Modify the Area Details Panel score breakdown:
- Make each metric name a clickable link
- Add small info icon (ℹ️) next to each metric
- Link navigates to `/docs/metrics/[slug]`
- Optional: popover preview on hover (desktop)

## Consequences

### Positive

- Users understand what metrics mean without external documentation
- Self-explanatory names reduce confusion and support requests
- Interactive visualizations make mathematical concepts accessible
- Consistent pedagogical approach across all metrics
- Documentation lives with the app, always up-to-date

### Negative

- Additional bundle size from D3.js (~50KB gzipped)
- Development time for custom visualizations
- Need to maintain docs pages alongside analysis code
- Potential for docs to drift from implementation if not careful

### Technical

- D3.js added as dependency (`npm install d3 @types/d3`)
- New `/docs` route namespace in Next.js app router
- Shared visualization components in `src/components/Docs/`
- May need dynamic imports for D3 to optimize initial bundle
- Consider prerendering docs pages as static for performance
- **Mobile-first**: All visualizations designed for touch interactions first, with mouse enhancements for desktop
- **Example data**: Visualizations use static, curated example walks to clearly illustrate algorithms (not user's actual data)
