'use client';

/**
 * SharePreview Component
 * 
 * Renders a shareable image layout for walk achievements.
 * Designed to be captured by html2canvas for image export.
 * 
 * WHY: Provides consistent, branded image exports in multiple formats
 * for sharing on social media. Uses a static layout optimized for
 * canvas capture (no external fonts/images that may fail).
 * 
 * @see docs/ADR/023-share-walk-feature.md Section 2 - Image Generation
 * @see docs/tickets/029-share-walk.md - Implementation requirements
 */

import { forwardRef } from 'react';
import type { ShareableWalkData } from '@/lib/share';
import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';
import type { DistanceTier } from '@/lib/distance-tiers';
import { getTierColor, getTierDisplayName, type Tier } from '@/lib/analysis';
import { formatDistance } from '@/lib/format-utils';
import StaticRouteMap from './StaticRouteMap';

// =============================================================================
// Types
// =============================================================================

export type ShareImageFormat = 'square' | 'wide' | 'story';

interface SharePreviewProps {
  data: ShareableWalkData;
  format: ShareImageFormat;
  /** Map snapshot image as data URL (rendered separately) */
  mapSnapshot?: string;
  /** When true, renders at full size for image capture (no scale transform) */
  forCapture?: boolean;
}

// =============================================================================
// Format Configurations
// =============================================================================

const FORMAT_CONFIGS: Record<ShareImageFormat, { width: number; height: number; name: string }> = {
  square: { width: 1080, height: 1080, name: 'Square (1080x1080)' },
  wide: { width: 1200, height: 630, name: 'Wide (1200x630)' },
  story: { width: 1080, height: 1920, name: 'Story (1080x1920)' },
};

export { FORMAT_CONFIGS };

// =============================================================================
// Tier Distribution Mini Chart
// =============================================================================

function TierMiniChart({ distribution }: { distribution: ShareableWalkData['tierDistribution'] }) {
  const tiers: DistanceTier[] = ['platinum', 'gold', 'silver', 'bronze', 'potato', 'missed'];
  
  // Calculate total for verification (should be ~1.0)
  const total = tiers.reduce((sum, tier) => sum + (distribution[tier] || 0), 0);
  
  return (
    // WHY: Use inline styles only - no Tailwind classes to avoid lab() color issues
    <div style={{
      display: 'flex',
      height: 16,
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      {tiers.map((tier) => {
        const percentage = (distribution[tier] || 0) / (total || 1) * 100;
        if (percentage < 0.5) return null; // Skip tiny segments
        
        return (
          <div
            key={tier}
            style={{
              width: `${percentage}%`,
              backgroundColor: DISTANCE_TIER_COLORS[tier],
            }}
          />
        );
      })}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * SharePreview renders the shareable image content.
 * 
 * Uses forwardRef to allow parent to access the DOM element for html2canvas capture.
 * All styling uses inline styles to ensure canvas capture works correctly.
 */
const SharePreview = forwardRef<HTMLDivElement, SharePreviewProps>(
  function SharePreview({ data, format, mapSnapshot, forCapture = false }, ref) {
    const config = FORMAT_CONFIGS[format];
    const tier = data.scores.tier as Tier;
    const tierColor = getTierColor(tier);
    const tierName = getTierDisplayName(tier);
    
    // Scale factor for preview display only (not for capture)
    // WHY: When forCapture=true, we render at full size (1080px etc) for image generation
    // When forCapture=false, we scale down to fit in the modal preview area
    const scale = forCapture ? 1 : (format === 'story' ? 0.25 : 0.35);
    
    const isVertical = format === 'story';
    const isWide = format === 'wide';

    return (
      <div
        ref={ref}
        style={{
          // WHY: Explicit dimensions and styles to avoid inheriting CSS variables
          // that use unsupported color functions (lab, oklch) from Tailwind v4
          width: config.width,
          height: config.height,
          // WHY: Only apply scale transform for preview display, not for capture
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
          backgroundColor: '#1e1e2e', // Dark background - explicit hex, not CSS var
          color: '#ffffff', // Explicit hex color
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 16, // Explicit base font size
          lineHeight: 1.5, // Explicit line height
          padding: isWide ? 32 : 40,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxSizing: 'border-box',
          // WHY: Isolation context to prevent style inheritance issues
          isolation: 'isolate',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: isWide ? 16 : 24,
        }}>
          {/* Logo and Title */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 8,
            }}>
              {/* CityCells Logo */}
              <svg width={isWide ? 28 : 36} height={isWide ? 28 : 36} viewBox="0 0 24 24" fill="#a855f7">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span style={{ 
                fontSize: isWide ? 24 : 32, 
                fontWeight: 700,
                color: '#a855f7',
              }}>
                CityCells
              </span>
            </div>
            <h1 style={{
              fontSize: isWide ? 28 : 36,
              fontWeight: 700,
              margin: 0,
              marginBottom: 4,
            }}>
              {data.areaName}
            </h1>
            <p style={{
              fontSize: isWide ? 14 : 16,
              color: '#a1a1aa',
              margin: 0,
            }}>
              Walked on {data.walkDate}
            </p>
          </div>
          
          {/* Tier Badge */}
          <div style={{
            backgroundColor: tierColor,
            color: '#ffffff',
            padding: isWide ? '8px 16px' : '12px 24px',
            borderRadius: 999,
            fontSize: isWide ? 18 : 24,
            fontWeight: 700,
            textTransform: 'uppercase',
          }}>
            {tierName}
          </div>
        </div>

        {/* Map Section */}
        {/* WHY: SVG-based map renders natively with modern-screenshot, no tile loading needed */}
        <div style={{
          flex: isVertical ? 1.5 : 1,
          backgroundColor: '#1a1a2e',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: isWide ? 16 : 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isWide ? 280 : isVertical ? 600 : 400,
        }}>
          {mapSnapshot ? (
            /* eslint-disable-next-line @next/next/no-img-element -- WHY: mapSnapshot is a data URL from html2canvas, next/image doesn't optimize data URLs */
            <img 
              src={mapSnapshot} 
              alt="Walk route map"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            // Render SVG-based static map from polyline data
            <StaticRouteMap
              data={data}
              width={config.width - (isWide ? 64 : 80)}
              height={isWide ? 280 : isVertical ? 600 : 400}
            />
          )}
        </div>

        {/* Stats Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isWide ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
          gap: isWide ? 16 : 20,
          marginBottom: isWide ? 16 : 24,
        }}>
          <StatBox 
            label="Quality Score" 
            value={`${(data.scores.qualityScore * 100).toFixed(1)}%`}
            highlight
            isWide={isWide}
          />
          <StatBox 
            label="Boundary Coverage" 
            value={`${(data.scores.tieredBorderScore * 100).toFixed(0)}%`}
            isWide={isWide}
          />
          <StatBox 
            label="Walk Distance" 
            value={formatDistance(data.stats.walkDistance)}
            isWide={isWide}
          />
          <StatBox 
            label="Circumference" 
            value={formatDistance(data.stats.circumference)}
            isWide={isWide}
          />
        </div>

        {/* Tier Distribution */}
        {!isWide && (
          <div style={{ marginBottom: 24 }}>
            <p style={{
              fontSize: 14,
              color: '#a1a1aa',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              Precision Breakdown
            </p>
            <TierMiniChart distribution={data.tierDistribution} />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              fontSize: 12,
              color: '#6b7280',
            }}>
              {(['platinum', 'gold', 'silver', 'bronze', 'potato', 'missed'] as DistanceTier[]).map(t => {
                const pct = (data.tierDistribution[t] || 0) * 100;
                if (pct < 1) return null;
                return (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: DISTANCE_TIER_COLORS[t],
                    }} />
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'auto',
          paddingTop: isWide ? 12 : 16,
          borderTop: '1px solid #3d3d4d',
        }}>
          <span style={{ fontSize: isWide ? 14 : 16, color: '#6b7280' }}>
            citycells.app
          </span>
          <span style={{ fontSize: isWide ? 14 : 16, color: '#6b7280' }}>
            Malmö, Sweden
          </span>
        </div>
      </div>
    );
  }
);

// =============================================================================
// Stat Box Component
// =============================================================================

function StatBox({ 
  label, 
  value, 
  highlight = false,
  isWide = false,
}: { 
  label: string; 
  value: string; 
  highlight?: boolean;
  isWide?: boolean;
}) {
  return (
    <div style={{
      backgroundColor: highlight ? '#3d2d5f' : '#2d2d3d',
      padding: isWide ? 12 : 16,
      borderRadius: 12,
      border: highlight ? '2px solid #a855f7' : 'none',
    }}>
      <p style={{
        fontSize: isWide ? 11 : 13,
        color: '#a1a1aa',
        margin: 0,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {label}
      </p>
      <p style={{
        fontSize: isWide ? 20 : 26,
        fontWeight: 700,
        margin: 0,
        color: highlight ? '#a855f7' : '#ffffff',
      }}>
        {value}
      </p>
    </div>
  );
}

export default SharePreview;
