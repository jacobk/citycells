'use client';

import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState, useCallback } from 'react';
import type { FeatureCollection, Feature, Polygon, MultiPolygon, Position } from 'geojson';
import L from 'leaflet';
import * as turf from '@turf/turf';
import mapboxPolyline from '@mapbox/polyline';
import { StravaActivity } from '@/hooks/useStrava';
import { 
  analyzeWalk, 
  getTierColor, 
  type Tier,
  type AnalysisMetrics,
  type StravaMetadata,
  type FullAnalysisResult,
  TIER_THRESHOLDS
} from '@/lib/analysis';
import { AreaTooltip, useAreaTooltip, type TooltipData } from '@/components/AreaTooltip';
import { useDatabase } from '@/hooks/useDatabase';
import { 
  saveWalkAnalysis, 
  getOrCreateUserId 
} from '@/lib/analysis-persistence';
import type { DeviationWithExemption } from '@/lib/exemption-types';

// Fix for default marker icon in Next.js
// @ts-expect-error - overriding private method
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MALMO_CENTER: [number, number] = [55.5900, 13.0038];

// WHY: Extended progress info to include tier breakdown per ADR 003
export interface ProgressInfo {
  completedCount: number;
  totalAreas: number;
  tierCounts: {
    platinum: number;
    gold: number;
    silver: number;
    bronze: number;
  };
}

interface MapProps {
  activities?: StravaActivity[];
  athleteId?: number; // WHY: Strava athlete ID for database persistence
  onProgressChange: (progress: ProgressInfo) => void;
  onAreaClick?: (areaDetails: AreaClickData) => void;
}

// WHY: Store full analysis results per area for display in popups/tooltips
interface AreaAnalysis {
  areaId: number;
  tier: Tier;
  qualityScore: number;
  metrics: AnalysisMetrics;
  matchedActivities: Array<{ id: number; name: string }>;
}

interface AreaDetail {
  feature: Feature<Polygon | MultiPolygon>;
  perimeterMeters: number;
  areaSqm: number;
}

export interface AreaWalkInfo {
  id: number;
  name: string;
  date?: string;
  distanceMeters?: number;
  qualityScore?: number;
  isBest?: boolean;
}

export interface AreaClickData {
  areaId: number;
  areaName: string;
  tier: Tier;
  qualityScore: number;
  metrics: AnalysisMetrics | null;
  totalAreaSqm: number;
  totalPerimeterMeters: number;
  walks: AreaWalkInfo[];
  deviations: DeviationWithExemption[];
}

function LocationMarker() {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const map = useMapEvents({
    locationfound(e) {
      setPosition(e.latlng);
    },
  });

  useEffect(() => {
    map.locate({ enableHighAccuracy: true });
  }, [map]);

  return position === null ? null : (
    <Marker position={position}>
      <Popup>You are here</Popup>
    </Marker>
  );
}

export default function CityMap({ activities = [], athleteId, onProgressChange, onAreaClick }: MapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [areaAnalyses, setAreaAnalyses] = useState<Map<number, AreaAnalysis>>(new Map());
  const [areaDetailsData, setAreaDetailsData] = useState<Map<number, AreaClickData>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // WHY: Database hook for persistence - loads cached results and saves new analyses
  const { db, loading: dbLoading } = useDatabase();
  
  // WHY: Tooltip for hover (desktop) and long-press (mobile) per PRD 001 section 3.5
  const {
    tooltipData,
    tooltipPosition,
    hideTooltip,
    handleMouseEnter,
    handleMouseLeave,
    handleTouchStart,
    handleTouchEnd,
  } = useAreaTooltip();

  useEffect(() => {
    fetch('/data/malmo_delomraden.geojson')
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch(err => console.error("Failed to load GeoJSON", err));
  }, []);

  const buildAreaDetailMap = useCallback((data: FeatureCollection): Map<number, AreaDetail> => {
    const areaDetails = new Map<number, AreaDetail>();

    data.features.forEach(feature => {
      if (!feature.geometry || (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) return;

      const areaId = feature.properties?.FID || feature.id;
      if (areaId === undefined || areaId === null) return;

      try {
        const featurePolygon = feature as Feature<Polygon | MultiPolygon>;
        const perimeterLine = turf.polygonToLine(featurePolygon);

        let perimeterMeters: number;
        if (perimeterLine.type === 'FeatureCollection') {
          perimeterMeters = perimeterLine.features.reduce((sum, f) => 
            sum + turf.length(f, { units: 'meters' }), 0);
        } else {
          perimeterMeters = turf.length(perimeterLine, { units: 'meters' });
        }

        const areaSqm = turf.area(featurePolygon);

        areaDetails.set(areaId as number, { 
          feature: featurePolygon, 
          perimeterMeters,
          areaSqm
        });
      } catch (e) {
        console.warn("Error processing area for analysis:", areaId, e);
      }
    });

    return areaDetails;
  }, []);

  const buildBaseAreaClickData = useCallback((details: Map<number, AreaDetail>): Map<number, AreaClickData> => {
    const baseDetails = new Map<number, AreaClickData>();

    details.forEach((detail, areaId) => {
      const areaName = detail.feature.properties?.delomr || 'Unknown Area';
      baseDetails.set(areaId, {
        areaId,
        areaName,
        tier: null,
        qualityScore: 0,
        metrics: null,
        totalAreaSqm: detail.areaSqm,
        totalPerimeterMeters: detail.perimeterMeters,
        walks: [],
        deviations: [],
      });
    });

    return baseDetails;
  }, []);

  // Analysis Logic - runs analysis for all activities, optionally persists to database
  useEffect(() => {
    if (!geoData || !activities.length) {
      if (geoData) {
        const areaDetails = buildAreaDetailMap(geoData);
        setAreaDetailsData(buildBaseAreaClickData(areaDetails));
        onProgressChange({
          completedCount: 0,
          totalAreas: geoData.features.length,
          tierCounts: { platinum: 0, gold: 0, silver: 0, bronze: 0 }
        });
      }
      return;
    }

    // WHY: Defer analysis to next tick to not block UI rendering
    setTimeout(async () => {
      setIsAnalyzing(true);
      console.log('[Map] Starting analysis for', activities.length, 'activities');
      
      // WHY: Database is optional - get userId only if db is available
      let userId: number | null = null;
      if (db && !dbLoading && athleteId) {
        try {
          userId = getOrCreateUserId(athleteId);
        } catch (e) {
          console.warn('[Map] Could not get/create user:', e);
        }
      }

      const newAreaAnalyses = new Map<number, AreaAnalysis>();
      
      // Pre-process areas with their geometry and metrics
      const allAreaDetails = buildAreaDetailMap(geoData);

      // Pre-process all activities to coordinates
      console.log(`[Map] All activities: ${activities.length}`, activities.map(a => a.id));
      const processedActivities = activities.map(act => {
        if (!act.map || !act.map.summary_polyline) return null;
        try {
          const decoded = mapboxPolyline.decode(act.map.summary_polyline);
          // WHY: mapbox polyline returns [lat, lng], turf needs [lng, lat]
          const coordinates: Position[] = decoded.map(pt => [pt[1], pt[0]]);
          
          // WHY: Strava metadata is more reliable for loop detection
          // The summary_polyline is often truncated and missing GPS points
          const stravaMetadata: StravaMetadata | undefined = act.start_latlng && act.end_latlng
            ? { startLatLng: act.start_latlng, endLatLng: act.end_latlng }
            : undefined;
          
          return { original: act, coordinates, stravaMetadata };
        } catch (e) {
          console.warn("Error decoding polyline for activity", act.id, act.name, e);
          return null;
        }
      }).filter((item): item is { original: StravaActivity; coordinates: Position[]; stravaMetadata: StravaMetadata | undefined } => Boolean(item));

      // WHY: Track best analysis per area for exclusive assignment (ADR 002)
      // Each walk can only count for one area (the one with best coverage)
      const activityBestArea = new Map<number, { areaId: number; score: number }>();

      console.log(`[Map] Processing ${processedActivities.length} activities against ${allAreaDetails.size} areas`);
      
      // Calculate coverage for each activity-area pair
      processedActivities.forEach(pAct => {
        const activityId = pAct.original.id;
        let bestAreaId: number | null = null;
        let bestScore = 0;
        let intersectCount = 0;

        allAreaDetails.forEach((areaDetail, areaId) => {
          try {
            // Quick intersection check before full analysis
            const walkLine = turf.lineString(pAct.coordinates);
            if (!turf.booleanIntersects(walkLine, areaDetail.feature)) return;
            
            intersectCount++;
            // Run full analysis (pass Strava metadata for accurate loop detection)
            const result = analyzeWalk(
              pAct.coordinates,
              areaDetail.feature,
              areaDetail.perimeterMeters,
              areaDetail.areaSqm,
              pAct.stravaMetadata
            );

            // WHY: Only consider if meets minimum threshold (Bronze = 50%)
            // See ADR 003 for completion threshold rationale
            console.log(`[Map] Activity ${activityId} vs Area ${areaId}: score=${(result.metrics.rawQualityScore * 100).toFixed(1)}%, perimeter=${(result.metrics.perimeterCoveragePercent * 100).toFixed(1)}%, area=${(result.metrics.areaCoveragePercent * 100).toFixed(1)}%`);
            if (result.metrics.rawQualityScore >= TIER_THRESHOLDS.bronze) {
              console.log(`[Map] Activity ${activityId} QUALIFIES for area ${areaId} with score ${(result.metrics.rawQualityScore * 100).toFixed(1)}%`);
              if (result.metrics.rawQualityScore > bestScore) {
                bestScore = result.metrics.rawQualityScore;
                bestAreaId = areaId;
              }
            }
          } catch (e) {
            console.warn(`Error analyzing activity ${activityId} for area ${areaId}:`, e);
          }
        });

        console.log(`[Map] Activity ${activityId} intersected ${intersectCount} areas, best match: ${bestAreaId} with score ${(bestScore * 100).toFixed(1)}%`);
        if (bestAreaId !== null) {
          activityBestArea.set(activityId, { areaId: bestAreaId, score: bestScore });
        }
      });

      // Now run full analysis only for assigned activity-area pairs
      // and aggregate results per area, saving to database
      const areaActivityScores = new Map<number, Array<{ activityId: number; name: string; score: number; metrics: AnalysisMetrics; result: FullAnalysisResult }>>();

      // WHY: Save each analysis result to database as we compute it
      for (const [activityId, { areaId, score }] of activityBestArea.entries()) {
        const activity = processedActivities.find(p => p.original.id === activityId);
        const areaDetail = allAreaDetails.get(areaId);
        
        if (!activity || !areaDetail) continue;

        const result = analyzeWalk(
          activity.coordinates,
          areaDetail.feature,
          areaDetail.perimeterMeters,
          areaDetail.areaSqm,
          activity.stravaMetadata
        );

        // Save to database if available (but don't fail analysis if save fails)
        if (userId !== null) {
          try {
            await saveWalkAnalysis(
              userId,
              activity.original,
              areaId,
              result,
              true // isPrimaryMatch
            );
          } catch (e) {
            // WHY: Log error but continue - analysis results still valid for display
            // Database save failure shouldn't prevent UI from showing results
            console.error(`[Map] Error saving analysis for activity ${activityId}, area ${areaId}:`, e);
          }
        }

        if (!areaActivityScores.has(areaId)) {
          areaActivityScores.set(areaId, []);
        }
        
        areaActivityScores.get(areaId)!.push({
          activityId,
          name: activity.original.name,
          score: result.metrics.rawQualityScore,
          metrics: result.metrics,
          result
        });
      }

      const newAreaDetailsData = buildBaseAreaClickData(allAreaDetails);

      // Create final analysis results using best score per area
      areaActivityScores.forEach((scores, areaId) => {
        // WHY: Use best score among all walks for this area
        const bestWalk = scores.reduce((best, current) => 
          current.score > best.score ? current : best
        );

        newAreaAnalyses.set(areaId, {
          areaId,
          tier: bestWalk.metrics.tier,
          qualityScore: bestWalk.metrics.rawQualityScore,
          metrics: bestWalk.metrics,
          matchedActivities: scores.map(s => ({ id: s.activityId, name: s.name }))
        });

        const areaDetails = newAreaDetailsData.get(areaId);
        if (areaDetails) {
          areaDetails.tier = bestWalk.metrics.tier;
          areaDetails.qualityScore = bestWalk.metrics.rawQualityScore;
          areaDetails.metrics = bestWalk.metrics;
          areaDetails.walks = scores.map(score => ({
            id: score.activityId,
            name: score.name,
            distanceMeters: score.metrics.totalWalkLengthMeters,
            qualityScore: score.metrics.rawQualityScore,
            isBest: score.activityId === bestWalk.activityId
          }));
          // WHY: Deviations require database IDs and exemption state.
          // Populate from persistence when details are loaded from the database.
          areaDetails.deviations = [];
        }
      });

      setAreaDetailsData(newAreaDetailsData);
      setAreaAnalyses(newAreaAnalyses);
      setIsAnalyzing(false);

      // Calculate tier counts for progress
      const tierCounts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
      newAreaAnalyses.forEach(analysis => {
        if (analysis.tier) {
          tierCounts[analysis.tier]++;
        }
      });

      onProgressChange({
        completedCount: newAreaAnalyses.size,
        totalAreas: geoData.features.length,
        tierCounts
      });
    }, 100);

  }, [geoData, activities, onProgressChange, buildAreaDetailMap, buildBaseAreaClickData]);

  // WHY: Style function returns tier-based colors per PRD 001 section 3.4
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getStyle = useCallback((feature: any) => {
    const areaId = feature?.properties?.FID || feature?.id;
    const analysis = areaAnalyses.get(areaId as number);

    if (analysis && analysis.tier) {
      const color = getTierColor(analysis.tier);
      return {
        color: color,
        weight: 2,
        opacity: 0.8,
        fillColor: color,
        // WHY: 0.4 opacity per PRD 001 section 3.4
        fillOpacity: 0.4
      };
    }

    // Default style for unmatched areas
    return {
      color: '#6b7280', // Gray-500
      weight: 1,
      opacity: 0.8,
      fillColor: '#9ca3af',
      fillOpacity: 0.1
    };
  }, [areaAnalyses]);

  // Create tooltip data from a feature
  const getTooltipData = useCallback((feature: Feature): TooltipData => {
    const areaId = feature.properties?.FID || feature.id;
    const areaName = feature.properties?.delomr || 'Unknown Area';
    const analysis = areaAnalyses.get(areaId as number);

    if (analysis) {
      // Find best walk (first one is used as best for now)
      const bestWalk = analysis.matchedActivities[0];
      
      return {
        areaId: areaId as number,
        areaName,
        tier: analysis.tier,
        qualityScore: analysis.qualityScore,
        walkCount: analysis.matchedActivities.length,
        bestWalkId: bestWalk?.id,
        bestWalkName: bestWalk?.name,
      };
    }

    return {
      areaId: areaId as number,
      areaName,
      tier: null,
      qualityScore: 0,
      walkCount: 0,
    };
  }, [areaAnalyses]);

  return (
    <div className="h-screen w-full relative">
      {isAnalyzing && (
        <div className="absolute top-20 left-4 z-[400] bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded shadow">
          Analyzing paths...
        </div>
      )}
      <MapContainer 
        center={MALMO_CENTER} 
        zoom={12} 
        className="h-full w-full z-0"
        zoomControl={false} 
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker />
        
        {/* WHY: Render activities as faint blue lines for visual context */}
        {activities.map(act => {
          if (!act.map || !act.map.summary_polyline) return null;
          const positions = mapboxPolyline.decode(act.map.summary_polyline);
          return (
            <Polyline 
              key={act.id} 
              positions={positions} 
              pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.3 }} 
            />
          );
        })}

        {geoData && (
          <GeoJSON 
            key={`geojson-${areaAnalyses.size}`}
            data={geoData} 
            style={getStyle}
            onEachFeature={(feature, layer) => {
              // WHY: Tooltip handlers for hover (desktop) and long-press (mobile)
              // Per PRD 001 section 3.5
              const tooltipData = getTooltipData(feature);
              const areaId = feature.properties?.FID || feature.id;

              // WHY: Click/tap opens the AreaDetailsPanel per PRD 001 section 3.6
              if (onAreaClick) {
                const areaDetails = areaDetailsData.get(areaId as number);
                if (areaDetails) {
                  layer.on('click', () => onAreaClick(areaDetails));
                }
              }
              
              // Desktop: hover
              layer.on('mouseover', (e: L.LeafletMouseEvent) => {
                handleMouseEnter(tooltipData, e);
              });
              layer.on('mouseout', () => {
                handleMouseLeave();
              });
              
              // Mobile: long-press (touchstart/touchend)
              // WHY: Use 'as any' for touch events since Leaflet types are incomplete
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              layer.on('touchstart', (e: any) => {
                handleTouchStart(tooltipData, e);
              });
              layer.on('touchend', () => {
                handleTouchEnd();
              });
              layer.on('touchmove', () => {
                // Cancel tooltip if user moves finger (scrolling)
                handleTouchEnd();
              });
            }}
          />
        )}
      </MapContainer>
      
      {/* WHY: Tooltip overlay outside MapContainer for proper z-index */}
      <AreaTooltip 
        data={tooltipData} 
        position={tooltipPosition} 
        onClose={hideTooltip}
      />
    </div>
  );
}
