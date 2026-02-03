# Metrics Documentation

## Overview

The Metrics Documentation feature provides an in-app help system that explains how CityCells calculates walk quality scores. Users can click on any metric in the Area Details Panel to access detailed, pedagogical documentation with interactive D3 visualizations that demonstrate the mathematical concepts behind each scoring component.

This feature bridges the gap between technical accuracy and user understanding, transforming opaque numbers into actionable insights.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md):
- "As a user, I want to see a detailed score breakdown for each area, so I understand how to improve"
- "As a user, I want to understand what each metric means so I can walk more effectively"
- "As a user, I want visual explanations of the scoring math so I can see why my score is what it is"

## Metric Naming

User-friendly names that summarize what each metric measures:

| Internal Name | User-Friendly Name | One-Line Summary |
|---------------|-------------------|------------------|
| `perimeterCoverage` | **Border Traced** | Percentage of the area's outline you walked |
| `areaCoverage` | **Area Enclosed** | How much area your loop encircles |
| `alignmentScore` | **Path Precision** | How close you stayed to the exact border |
| `efficiency` | **Route Efficiency** | Ratio of useful walking to total distance |

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/app/docs/layout.tsx` | Docs layout with navigation back to the map |
| `src/app/docs/metrics/page.tsx` | Metrics overview/index page |
| `src/app/docs/metrics/[slug]/page.tsx` | Dynamic metric detail pages |
| `src/components/Docs/MetricCard.tsx` | Reusable metric summary card |
| `src/components/Docs/MetricVisualizations/` | D3 visualization components |
| `src/lib/metrics-content.ts` | Metric documentation content data |
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Clickable metric links to docs pages |

### Data Flow

```
User taps metric in AreaDetailsPanel
           │
           ▼
   Navigate to /docs/metrics/[slug]
           │
           ▼
┌──────────────────────────────────┐
│      Metric Documentation Page   │
│         (Mobile-First)           │
│                                  │
│  ┌────────────────────────────┐  │
│  │  Plain English Summary     │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  Why It Matters            │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  D3 Interactive Visual     │◄─┼── Static example data
│  │  (touch-optimized)         │  │   (illustrates algorithm)
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  Calculation Steps         │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  Tips to Improve           │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

### Key Functions

- `METRICS_CONTENT` in `src/lib/metrics-content.ts` defines summaries, explanations, and tips for each metric.
- `MetricDetailPage` in `src/app/docs/metrics/[slug]/page.tsx` selects the metric content and visualization based on the slug.
- Visualization components in `src/components/Docs/MetricVisualizations/` render interactive D3 diagrams with static example data.

## Documentation Content Specifications

### Border Traced (Perimeter Coverage)

**Summary:** "Measures what percentage of the area's outline you walked within 25 meters."

**Visualization:** Animated SVG showing:
1. A sample polygon (the sub-area)
2. A 25-meter buffer zone around the perimeter (semi-transparent)
3. An animated walk path that traces along the border
4. Real-time counter showing coverage percentage as path animates
5. Toggle to show "good" vs "poor" coverage examples

**Key Concepts to Illustrate:**
- The 25m buffer (why it exists - GPS accuracy, sidewalk offsets)
- How coverage percentage is calculated (covered length / total perimeter)
- What 100% coverage looks like vs partial coverage

### Area Enclosed

**Summary:** "Measures how much of the sub-area falls inside your walking loop."

**Visualization:** Interactive SVG showing:
1. The sub-area polygon (filled light blue)
2. A draggable/editable walk path polygon
3. Intersection area highlighted (shows enclosed percentage)
4. Toggle between closed loop vs open path to show difference

**Key Concepts to Illustrate:**
- Why a closed loop is required (start/end within 100m)
- How intersection area is calculated
- Why open paths get 0% area coverage
- The 100m closure threshold

### Path Precision (Alignment Score)

**Summary:** "Measures how close you stayed to the border throughout your walk."

**Visualization:** Animated heat map showing:
1. Walk path colored by distance from border (gradient: green → yellow → red)
2. Hover over any point to see exact distance
3. RMSE calculation animated step-by-step
4. Slider to adjust sample walk deviation and see score change

**Key Concepts to Illustrate:**
- RMSE formula: √(sum of squared distances / n points)
- Why RMSE penalizes large deviations more (squared)
- The 50m normalization (50m average = 0 score)
- Difference between max deviation and RMSE

### Route Efficiency

**Summary:** "Measures what percentage of your walk was actually along the border."

**Visualization:** Side-by-side comparison showing:
1. An efficient walk (stays on border): high score
2. An inefficient walk (lots of detours): low score
3. Animated highlighting of "wasted" distance
4. Formula breakdown: border-aligned distance / total distance

**Key Concepts to Illustrate:**
- Why efficiency matters (rewards focused walking)
- How detours lower the score
- The difference between efficiency and perimeter coverage

## Rationale

### Design Decisions

1. **Separate pages vs inline tooltips**: Full pages allow for rich, scrollable content with large visualizations. Tooltips would be too cramped for interactive D3 diagrams.

2. **Action-based naming**: Names like "Border Traced" immediately convey what the user did, making scores feel like achievements rather than arbitrary numbers.

3. **D3 for visualizations**: Provides fine-grained SVG control needed for custom geometric illustrations. See ADR 007 for alternatives considered.

4. **Progressive disclosure**: Summary first, details on scroll. Users who just want a quick answer see it immediately; curious users can explore deeper.

### ADR References

- [ADR 003: Multi-Metric Completion Scoring](../ADR/003-multi-metric-completion-scoring.md) - Defines the metrics being documented
- [ADR 007: Interactive Metrics Documentation](../ADR/007-interactive-metrics-documentation.md) - Technical decisions for this feature

## Current Limitations

1. **No deep-linking to specific sections**: Can't link directly to a specific concept within a metric page

## Design Notes

- **Mobile-first visualizations**: All D3 interactions designed for touch screens first, enhanced for desktop
- **Example data only**: Visualizations use static example walks to illustrate algorithms clearly; not connected to user's actual data
