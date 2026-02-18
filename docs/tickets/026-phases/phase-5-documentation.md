# Phase 5: Interactive Documentation Pages

**Parent Ticket:** [TICKET-026](../026-tiered-distance-scoring.md)  
**Priority:** Medium  
**Estimated Complexity:** High

## Overview

This phase creates interactive documentation pages with D3.js visualizations explaining the scoring system. These pages are accessible from metric links in AreaDetailsPanel and the "How Scoring Works" hamburger menu item.

## Context Files to Read First

1. `docs/ADR/021-tiered-distance-scoring.md` - Section 7 (Documentation Structure)
2. `docs/ADR/007-interactive-metrics-documentation.md` - Existing metrics docs approach
3. `src/app/docs/metrics/` - Existing metrics documentation pages (reference for style)
4. `src/lib/distance-tiers.ts` - Tier constants (for visualization data)

## Prerequisites

- **Phase 1 must be complete** (tier constants and types)
- Familiarity with D3.js for interactive visualizations

## Tasks

### Task 5.1: Create `/docs/scoring` Index Page

Create `src/app/docs/scoring/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';
import { SCORE_WEIGHTS } from '@/lib/analysis';

export default function ScoringOverviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
            ← Back to Map
          </Link>
          <h1 className="text-2xl font-bold text-foreground">How Scoring Works</h1>
          <p className="text-muted-foreground mt-2">
            Learn how CityCells calculates your walk quality score.
          </p>
        </div>

        {/* Overview */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">The Formula</h2>
          <div className="bg-secondary rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Your quality score is calculated from three metrics:
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Boundary Coverage</span>
                <span className="text-primary font-medium">{(SCORE_WEIGHTS.tieredBorder * 100)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Area Enclosed</span>
                <span className="text-primary font-medium">{(SCORE_WEIGHTS.areaCoverage * 100)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Walk Focus</span>
                <span className="text-primary font-medium">{(SCORE_WEIGHTS.walkFocus * 100)}%</span>
              </div>
            </div>
          </div>
        </section>

        {/* Metrics List */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">Understanding Each Metric</h2>
          <div className="space-y-3">
            <Link 
              href="/docs/scoring/boundary-coverage"
              className="block bg-card border border-border rounded-lg p-4 hover:bg-secondary transition-colors"
            >
              <h3 className="font-medium text-foreground">Boundary Coverage</h3>
              <p className="text-sm text-muted-foreground mt-1">
                How well did you trace the area's border? Uses precision tiers.
              </p>
            </Link>
            <Link 
              href="/docs/scoring/area-enclosed"
              className="block bg-card border border-border rounded-lg p-4 hover:bg-secondary transition-colors"
            >
              <h3 className="font-medium text-foreground">Area Enclosed</h3>
              <p className="text-sm text-muted-foreground mt-1">
                How much of the area did your walk surround?
              </p>
            </Link>
            <Link 
              href="/docs/scoring/walk-focus"
              className="block bg-card border border-border rounded-lg p-4 hover:bg-secondary transition-colors"
            >
              <h3 className="font-medium text-foreground">Walk Focus</h3>
              <p className="text-sm text-muted-foreground mt-1">
                What percentage of your walk was actually tracing the boundary?
              </p>
            </Link>
          </div>
        </section>

        {/* Precision Tiers Link */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">Precision Tiers</h2>
          <Link 
            href="/docs/scoring/precision-tiers"
            className="block bg-card border border-border rounded-lg p-4 hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              {/* Color swatches */}
              {(['platinum', 'gold', 'silver', 'bronze', 'potato', 'missed'] as const).map((tier) => (
                <div 
                  key={tier}
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: DISTANCE_TIER_COLORS[tier] }}
                />
              ))}
            </div>
            <h3 className="font-medium text-foreground">Understanding Precision Tiers</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Learn about Platinum, Gold, Silver, Bronze, Potato, and Missed tiers.
            </p>
          </Link>
        </section>

        {/* Tips Section */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Tips for Higher Scores</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Walk as close to the boundary as safely possible</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Complete a full loop to maximize Area Enclosed</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Avoid unnecessary detours to improve Walk Focus</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>GPS accuracy varies—platinum is hard but achievable!</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
```

### Task 5.2: Create Precision Tiers Page with Interactive D3

Create `src/app/docs/scoring/precision-tiers/page.tsx`:

```tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import * as d3 from 'd3';
import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';
import { DISTANCE_TIER_THRESHOLDS, TIER_POINTS, assignDistanceTier } from '@/lib/distance-tiers';

export default function PrecisionTiersPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [distance, setDistance] = useState(15); // Interactive slider value
  const currentTier = assignDistanceTier(distance);

  // D3 Visualization
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = 200;
    
    svg.selectAll('*').remove();
    
    // Create tier bands visualization
    const tiers = [
      { name: 'platinum', max: 10, color: DISTANCE_TIER_COLORS.platinum },
      { name: 'gold', max: 20, color: DISTANCE_TIER_COLORS.gold },
      { name: 'silver', max: 30, color: DISTANCE_TIER_COLORS.silver },
      { name: 'bronze', max: 40, color: DISTANCE_TIER_COLORS.bronze },
      { name: 'potato', max: 50, color: DISTANCE_TIER_COLORS.potato },
      { name: 'missed', max: 70, color: DISTANCE_TIER_COLORS.missed },
    ];

    const xScale = d3.scaleLinear()
      .domain([0, 70])
      .range([40, width - 20]);

    // Draw tier bands
    let prevMax = 0;
    tiers.forEach((tier) => {
      svg.append('rect')
        .attr('x', xScale(prevMax))
        .attr('y', 40)
        .attr('width', xScale(tier.max) - xScale(prevMax))
        .attr('height', 60)
        .attr('fill', tier.color)
        .attr('opacity', 0.7);
      prevMax = tier.max;
    });

    // Draw boundary line (0m)
    svg.append('line')
      .attr('x1', xScale(0))
      .attr('y1', 30)
      .attr('x2', xScale(0))
      .attr('y2', 110)
      .attr('stroke', '#000')
      .attr('stroke-width', 3);

    svg.append('text')
      .attr('x', xScale(0))
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', 'currentColor')
      .text('Boundary');

    // Draw current distance indicator
    svg.append('line')
      .attr('x1', xScale(distance))
      .attr('y1', 30)
      .attr('x2', xScale(distance))
      .attr('y2', 110)
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4');

    svg.append('circle')
      .attr('cx', xScale(distance))
      .attr('cy', 70)
      .attr('r', 8)
      .attr('fill', '#ef4444');

    // X-axis
    const xAxis = d3.axisBottom(xScale)
      .tickValues([0, 10, 20, 30, 40, 50, 60, 70])
      .tickFormat(d => `${d}m`);

    svg.append('g')
      .attr('transform', `translate(0, 120)`)
      .call(xAxis);

  }, [distance]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/docs/scoring" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
            ← Back to Scoring
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Precision Tiers</h1>
          <p className="text-muted-foreground mt-2">
            Your walking precision is measured by how close you are to the boundary.
          </p>
        </div>

        {/* Interactive Visualization */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">Interactive Distance Demo</h2>
          <div className="bg-card border border-border rounded-lg p-4">
            <svg ref={svgRef} className="w-full h-[160px]" />
            
            {/* Slider */}
            <div className="mt-4">
              <label className="text-sm text-muted-foreground block mb-2">
                Distance from boundary: <span className="font-medium text-foreground">{distance}m</span>
              </label>
              <input
                type="range"
                min="0"
                max="70"
                value={distance}
                onChange={(e) => setDistance(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Current Tier Display */}
            <div className="mt-4 flex items-center gap-3">
              <div 
                className="w-6 h-6 rounded"
                style={{ backgroundColor: DISTANCE_TIER_COLORS[currentTier.tier] }}
              />
              <div>
                <span className="font-medium text-foreground capitalize">{currentTier.tier}</span>
                <span className="text-muted-foreground ml-2">
                  ({(currentTier.points * 100).toFixed(0)}% points)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tier Table */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">All Precision Tiers</h2>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left py-2 px-3 font-medium">Tier</th>
                  <th className="text-right py-2 px-3 font-medium">Distance</th>
                  <th className="text-right py-2 px-3 font-medium">Points</th>
                  <th className="text-left py-2 px-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { tier: 'platinum', dist: '≤ 10m', points: '100%', desc: 'GPS-perfect tracking' },
                  { tier: 'gold', dist: '≤ 20m', points: '80%', desc: 'Excellent precision' },
                  { tier: 'silver', dist: '≤ 30m', points: '55%', desc: 'Good precision' },
                  { tier: 'bronze', dist: '≤ 40m', points: '30%', desc: 'Acceptable' },
                  { tier: 'potato', dist: '≤ 50m', points: '10%', desc: 'Minimal credit' },
                  { tier: 'missed', dist: '> 50m', points: '0%', desc: 'Too far to count' },
                ].map((row) => (
                  <tr key={row.tier} className="border-b border-border last:border-0">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: DISTANCE_TIER_COLORS[row.tier as keyof typeof DISTANCE_TIER_COLORS] }}
                        />
                        <span className="capitalize">{row.tier}</span>
                      </div>
                    </td>
                    <td className="text-right py-2 px-3 text-muted-foreground">{row.dist}</td>
                    <td className="text-right py-2 px-3 font-medium">{row.points}</td>
                    <td className="py-2 px-3 text-muted-foreground">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* GPS Accuracy Note */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">About GPS Accuracy</h2>
          <div className="bg-secondary rounded-lg p-4 text-sm text-muted-foreground space-y-2">
            <p>
              <strong className="text-foreground">Typical GPS accuracy:</strong> 5-15 meters in urban areas with clear sky.
            </p>
            <p>
              <strong className="text-foreground">Factors affecting accuracy:</strong> Tall buildings, dense tree cover, 
              weather conditions, and your device's GPS chip quality.
            </p>
            <p>
              <strong className="text-foreground">Pro tip:</strong> Platinum tier (≤10m) is challenging but achievable 
              on open paths with good GPS signal. Don't stress about occasional Gold or Silver segments—they still 
              contribute significantly to your score!
            </p>
          </div>
        </section>

        {/* Route Colors */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Route Colors on the Map</h2>
          <p className="text-sm text-muted-foreground mb-4">
            When you view your walk route on the map, each segment is colored based on its precision tier:
          </p>
          <div className="flex flex-wrap gap-3">
            {(['platinum', 'gold', 'silver', 'bronze', 'potato', 'missed'] as const).map((tier) => (
              <div key={tier} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-8 h-2 rounded"
                  style={{ backgroundColor: DISTANCE_TIER_COLORS[tier] }}
                />
                <span className="capitalize text-muted-foreground">{tier}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
```

### Task 5.3: Create Individual Metric Pages

Create these additional pages following the same pattern as existing `/docs/metrics/*` pages:

1. `src/app/docs/scoring/boundary-coverage/page.tsx` - Boundary Coverage explanation
2. `src/app/docs/scoring/area-enclosed/page.tsx` - Area Enclosed explanation  
3. `src/app/docs/scoring/walk-focus/page.tsx` - Walk Focus explanation

Each page should include:
- Back link to `/docs/scoring`
- Clear explanation of what the metric measures
- Interactive D3 visualization showing good vs poor examples
- Tips for improvement
- Reference to the 45%/25%/30% weight

**Reference existing pages in `src/app/docs/metrics/` for D3 visualization patterns.**

## Acceptance Criteria

- [ ] `/docs/scoring` index page exists with overview and links
- [ ] `/docs/scoring/precision-tiers` has interactive D3 distance slider
- [ ] Tier table shows all 6 tiers with colors, distances, and points
- [ ] GPS accuracy section explains real-world considerations
- [ ] `/docs/scoring/boundary-coverage` page with D3 visualization
- [ ] `/docs/scoring/area-enclosed` page with D3 visualization
- [ ] `/docs/scoring/walk-focus` page with D3 visualization
- [ ] All pages are mobile-friendly (touch-optimized)
- [ ] Pages use design system colors and tokens

## Verification

```bash
npm run lint   # Must pass
npm run build  # Must pass
npm run test   # Must pass
```

**Visual verification:**
1. Navigate to `/docs/scoring` directly
2. Verify all links work
3. Test interactive slider on precision-tiers page
4. Verify D3 visualizations render on all pages
5. Test on mobile viewport

## Dependencies

- Phase 1 must be complete (tier constants and types for imports)
- D3.js is already a project dependency

## Notes

- D3 visualizations should be client components (`'use client'`)
- Use existing `/docs/metrics/*` pages as reference for styling patterns
- Ensure visualizations work on touch devices
- Consider reduced motion preferences for animations
- The precision-tiers slider demo is the key interactive element
