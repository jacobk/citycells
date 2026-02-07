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
  type Tier,
  type AnalysisMetrics,
  type StravaMetadata,
  type FullAnalysisResult,
  TIER_THRESHOLDS
} from '@/lib/analysis';
import {
  getMapTierFillColor,
  getMapTierBorderColor,
  getMapTierOpacity,
  UNWALKED_AREA_STYLE,
  ROUTE_STYLES,
} from '@/lib/design-tokens';
import { calculatePerimeterMeters } from '@/lib/geo-utils';
import { AreaTooltip, useAreaTooltip, type TooltipData } from '@/components/AreaTooltip';
import { TierIcon } from '@/components/TierIcon';
import { useDatabase } from '@/hooks/useDatabase';
import { 
  saveWalkAnalysis, 
  getOrCreateUserId,
  loadCachedAnalyses,
  getActivitiesToAnalyze,
  type CachedMetrics
} from '@/lib/analysis-persistence';
import { 
  getWalkIdByActivityId,
  getWalkStreams,
  needsStreamsFetch,
  saveWalkStreams
} from '@/lib/db';
import type { DeviationWithExemption } from '@/lib/exemption-types';
import type { CachedStreams } from '@/lib/types/strava-streams';

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
  // WHY: Callback to pass all area data to parent for use in SubAreaListPanel (ADR 008)
  onAreasLoaded?: (areas: Map<number, AreaClickData>) => void;
  // WHY: Callback to register refresh function for re-analysis (ADR 011)
  onRegisterRefresh?: (refreshFn: () => void) => void;
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
  // WHY: Geometry needed for mini-map display in AreaDetailsPanel (ADR 012)
  geometry?: GeoJSON.Geometry;
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

// WHY: Track zoom level for conditional rendering of tier icons (ADR 010)
interface ZoomTrackerProps {
  onZoomChange: (zoom: number) => void;
}

function ZoomTracker({ onZoomChange }: ZoomTrackerProps) {
  const map = useMapEvents({
    zoomend() {
      onZoomChange(map.getZoom());
    },
  });

  // Set initial zoom on mount
  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

/**
 * Convert cached metrics from database to full AnalysisMetrics type.
 * WHY: Cached data from loadCachedAnalyses() doesn't include computed fields
 * (alignmentScore, borderAlignedLengthMeters, totalWalkLengthMeters) that aren't
 * stored in the database. These are recomputed or set to defaults.
 * See ADR 004 Cache Loading Strategy.
 */
function convertCachedToFullMetrics(cached: CachedMetrics): AnalysisMetrics {
  // WHY: Alignment score formula: 1 - min(rmse/50, 1)
  // 50m is the max deviation threshold where score becomes 0
  // See ADR 003 for scoring formula rationale
  const alignmentScore = 1 - Math.min((cached.rmseMeters ?? 0) / 50, 1);

  return {
    perimeterCoveragePercent: cached.perimeterCoveragePercent,
    coveredDistanceMeters: cached.coveredDistanceMeters,
    areaCoveragePercent: cached.areaCoveragePercent,
    enclosedAreaSqm: cached.enclosedAreaSqm,
    isClosedLoop: cached.isClosedLoop,
    loopGapMeters: cached.loopGapMeters,
    rmseMeters: cached.rmseMeters,
    maxDeviationMeters: cached.maxDeviationMeters,
    p90DeviationMeters: cached.p90DeviationMeters,
    alignmentScore,
    efficiency: cached.efficiency,
    // WHY: These fields aren't stored in the database - set to 0 for cached data
    // They're only used for detailed analysis display, not tier calculation
    borderAlignedLengthMeters: 0,
    totalWalkLengthMeters: 0,
    rawQualityScore: cached.rawQualityScore,
    tier: cached.tier as Tier,
  };
}

export default function CityMap({ activities = [], athleteId, onProgressChange, onAreaClick, onAreasLoaded, onRegisterRefresh }: MapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [areaAnalyses, setAreaAnalyses] = useState<Map<number, AreaAnalysis>>(new Map());
  const [areaDetailsData, setAreaDetailsData] = useState<Map<number, AreaClickData>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // WHY: Track count of new activities for "Analyzing X new activities" message
  const [newActivityCount, setNewActivityCount] = useState(0);
  // WHY: Track zoom for tier icon visibility (ADR 010 - icons only at zoom 13+)
  const [currentZoom, setCurrentZoom] = useState(12);
  // WHY: Counter to force re-running the analysis effect after re-analysis (ADR 011)
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  // WHY: Database hook for persistence - loads cached results and saves new analyses
  const { db, loading: dbLoading } = useDatabase();

  // WHY: Register refresh function for re-analysis (ADR 011)
  // The refresh function increments counter to trigger the analysis effect
  useEffect(() => {
    if (onRegisterRefresh) {
      onRegisterRefresh(() => {
        setRefreshCounter(c => c + 1);
      });
    }
  }, [onRegisterRefresh]);
  
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
        // WHY: Use shared geo-utils to avoid duplicating perimeter logic (see geo-utils.ts)
        const perimeterMeters = calculatePerimeterMeters(featurePolygon);
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
        // WHY: Geometry passed through for mini-map in AreaDetailsPanel (ADR 012)
        geometry: detail.feature.geometry,
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
        const baseAreaData = buildBaseAreaClickData(areaDetails);
        setAreaDetailsData(baseAreaData);
        // WHY: Notify parent of all area data for use in SubAreaListPanel (ADR 008)
        onAreasLoaded?.(baseAreaData);
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
      const newAreaDetailsData = buildBaseAreaClickData(allAreaDetails);

      // WHY: Load cached analysis results to avoid re-computation (ADR 004)
      // This provides instant feedback for returning users
      let cachedResults = new Map<number, ReturnType<typeof loadCachedAnalyses> extends Map<number, infer V> ? V : never>();
      if (userId !== null) {
        try {
          cachedResults = loadCachedAnalyses(userId);
          console.log(`[Map] Loaded ${cachedResults.size} cached analyses from database`);
        } catch (e) {
          console.warn('[Map] Could not load cached analyses:', e);
        }
      }

      // WHY: Display cached results instantly while checking for new activities (ADR 004)
      if (cachedResults.size > 0) {
        cachedResults.forEach((cached, areaFid) => {
          newAreaAnalyses.set(areaFid, {
            areaId: areaFid,
            tier: cached.metrics.tier as Tier,
            qualityScore: cached.metrics.rawQualityScore,
            metrics: convertCachedToFullMetrics(cached.metrics),
            matchedActivities: cached.activityIds.map(id => ({ id, name: '' }))
          });

          // Also update area details data for the AreaDetailsPanel
          const areaDetails = newAreaDetailsData.get(areaFid);
          if (areaDetails) {
            areaDetails.tier = cached.metrics.tier as Tier;
            areaDetails.qualityScore = cached.metrics.rawQualityScore;
            areaDetails.metrics = convertCachedToFullMetrics(cached.metrics);
            areaDetails.walks = cached.activityIds.map(id => ({
              id,
              name: '',
              qualityScore: cached.metrics.rawQualityScore,
              isBest: true
            }));
          }
        });

        // Immediately update UI with cached data
        setAreaAnalyses(new Map(newAreaAnalyses));
        setAreaDetailsData(new Map(newAreaDetailsData));
        onAreasLoaded?.(new Map(newAreaDetailsData));

        // Update progress with cached tier counts
        const cachedTierCounts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
        newAreaAnalyses.forEach(a => { if (a.tier) cachedTierCounts[a.tier]++; });
        onProgressChange({
          completedCount: newAreaAnalyses.size,
          totalAreas: geoData.features.length,
          tierCounts: cachedTierCounts
        });
      }

      // WHY: Skip already-analyzed activities (ADR 004 Cache Loading Strategy)
      const activityIds = activities.map(a => a.id);
      const needsAnalysis = userId !== null 
        ? getActivitiesToAnalyze(userId, activityIds)
        : activityIds;

      console.log(`[Map] ${needsAnalysis.length} of ${activityIds.length} activities need analysis`);

      if (needsAnalysis.length === 0) {
        // All activities already analyzed - skip analysis entirely
        console.log('[Map] All activities already analyzed, using cached data');
        setIsAnalyzing(false);
        setNewActivityCount(0);
        return;
      }

      // WHY: Only show "Analyzing" when there are new activities to process
      setNewActivityCount(needsAnalysis.length);
      setIsAnalyzing(true);

      // WHY: Stay below Strava rate limits during initial sync (ADR 006).
      const STREAM_REQUEST_LIMIT = 80;
      const STREAM_REQUEST_DELAY_MS = 250;
      let streamRequests = 0;

      // WHY: Prefer high-fidelity Strava streams; cache locally to reduce API usage.
      async function loadStreamData(activity: StravaActivity): Promise<{
        streamCoordinates: Position[] | null;
        cachedStreams: CachedStreams | null;
        shouldSaveStreams: boolean;
        streamTime?: number[];
        streamDistance?: number[];
      }> {
        const hasDb = Boolean(db && !dbLoading);
        const cached = hasDb ? getWalkStreams(activity.id) : null;
        if (cached && cached.latlng.length > 0) {
          return {
            streamCoordinates: cached.latlng.map(([lat, lng]) => [lng, lat]),
            cachedStreams: cached,
            shouldSaveStreams: false,
            streamTime: cached.time,
            streamDistance: cached.distance,
          };
        }

        if (hasDb && !needsStreamsFetch(activity.id)) {
          return { streamCoordinates: null, cachedStreams: null, shouldSaveStreams: false };
        }

        if (streamRequests >= STREAM_REQUEST_LIMIT) {
          return { streamCoordinates: null, cachedStreams: null, shouldSaveStreams: false };
        }

        streamRequests += 1;
        await new Promise(resolve => setTimeout(resolve, STREAM_REQUEST_DELAY_MS));

        try {
          const response = await fetch(`/api/activities/streams?id=${activity.id}`);
          if (!response.ok) {
            return { streamCoordinates: null, cachedStreams: null, shouldSaveStreams: false };
          }

          const data = await response.json();
          const latlng: [number, number][] = data?.streams?.latlng?.data ?? [];
          const time: number[] | undefined = data?.streams?.time?.data;
          const distance: number[] | undefined = data?.streams?.distance?.data;

          const cachedStreams: CachedStreams = {
            latlng,
            time,
            distance,
            fetchedAt: data?.fetchedAt ?? new Date().toISOString(),
            pointCount: latlng.length,
          };

          return {
            streamCoordinates: latlng.length > 0
              ? latlng.map(([lat, lng]) => [lng, lat])
              : null,
            cachedStreams,
            shouldSaveStreams: hasDb && latlng.length > 0,
            streamTime: time,
            streamDistance: distance,
          };
        } catch (e) {
          console.warn('Failed to fetch streams for activity', activity.id, e);
          return { streamCoordinates: null, cachedStreams: null, shouldSaveStreams: false };
        }
      }

      // Pre-process only NEW activities that need analysis
      // WHY: Skip already-analyzed activities to avoid redundant computation (ADR 004)
      const activitiesToProcess = activities.filter(a => needsAnalysis.includes(a.id));
      console.log(`[Map] Processing ${activitiesToProcess.length} new activities (skipping ${activities.length - activitiesToProcess.length} already-analyzed)`);
      
      const processedActivities: Array<{
        original: StravaActivity;
        coordinates: Position[];
        stravaMetadata: StravaMetadata | undefined;
        streamCoordinates: Position[] | null;
        cachedStreams: CachedStreams | null;
        shouldSaveStreams: boolean;
      }> = [];

      for (const act of activitiesToProcess) {
        if (!act.map || !act.map.summary_polyline) continue;
        try {
          const decoded = mapboxPolyline.decode(act.map.summary_polyline);
          // WHY: mapbox polyline returns [lat, lng], turf needs [lng, lat]
          const coordinates: Position[] = decoded.map(pt => [pt[1], pt[0]]);

          const streamData = await loadStreamData(act);

          // WHY: Strava metadata is more reliable for loop detection
          // The summary_polyline is often truncated and missing GPS points
          const stravaMetadata: StravaMetadata | undefined = act.start_latlng && act.end_latlng
            ? {
              startLatLng: act.start_latlng,
              endLatLng: act.end_latlng,
              distance: act.distance,
              streamTime: streamData.streamTime,
              streamDistance: streamData.streamDistance
            }
            : undefined;
          
          processedActivities.push({ 
            original: act,
            coordinates,
            stravaMetadata,
            streamCoordinates: streamData.streamCoordinates,
            cachedStreams: streamData.cachedStreams,
            shouldSaveStreams: streamData.shouldSaveStreams
          });
        } catch (e) {
          console.warn("Error decoding polyline for activity", act.id, act.name, e);
        }
      }

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
            // WHY: Use summary polyline for intersection guard to avoid
            // false negatives if streams are privacy-cropped.
            const walkLine = turf.lineString(pAct.coordinates);
            if (!turf.booleanIntersects(walkLine, areaDetail.feature)) return;
            
            intersectCount++;
            // Run full analysis (pass Strava metadata for accurate loop detection)
            const result = analyzeWalk(
              pAct.coordinates,
              areaDetail.feature,
              areaDetail.perimeterMeters,
              areaDetail.areaSqm,
              pAct.stravaMetadata,
              pAct.streamCoordinates ?? undefined
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
          activity.stravaMetadata,
          activity.streamCoordinates ?? undefined
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

            if (activity.cachedStreams && activity.shouldSaveStreams) {
              const walkId = getWalkIdByActivityId(activityId);
              if (walkId !== null) {
                await saveWalkStreams(walkId, activity.cachedStreams);
              }
            }
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

      // WHY: Merge new analysis results with cached data in newAreaAnalyses
      // newAreaDetailsData was already created and populated with cached data earlier
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
      setNewActivityCount(0);

      // WHY: Notify parent of all area data for use in SubAreaListPanel (ADR 008)
      onAreasLoaded?.(newAreaDetailsData);

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

  // WHY: refreshCounter triggers re-load of cached analyses after re-analysis (ADR 011)
  }, [geoData, activities, onProgressChange, onAreasLoaded, buildAreaDetailMap, buildBaseAreaClickData, db, dbLoading, athleteId, refreshCounter]);

  // WHY: Style function returns tier-based colors per ADR 010 (purple-pink gradient)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getStyle = useCallback((feature: any) => {
    const areaId = feature?.properties?.FID || feature?.id;
    const analysis = areaAnalyses.get(areaId as number);

    if (analysis && analysis.tier) {
      // WHY: Use design tokens for map-specific purple-pink gradient (ADR 010)
      const fillColor = getMapTierFillColor(analysis.tier);
      const borderColor = getMapTierBorderColor(analysis.tier);
      const fillOpacity = getMapTierOpacity(analysis.tier);
      
      return {
        color: borderColor,
        weight: 2,
        opacity: 0.8,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
      };
    }

    // WHY: Subtle styling for unwalked areas so they don't compete with completed ones
    return {
      color: UNWALKED_AREA_STYLE.borderColor,
      weight: UNWALKED_AREA_STYLE.borderWeight,
      opacity: UNWALKED_AREA_STYLE.borderOpacity,
      fillColor: UNWALKED_AREA_STYLE.fillColor,
      fillOpacity: UNWALKED_AREA_STYLE.fillOpacity,
    };
  }, [areaAnalyses]);

  // Create tooltip data from a feature
  // WHY: Include circumferenceMeters for walk time estimate in tooltip (ADR 012)
  const getTooltipData = useCallback((feature: Feature): TooltipData => {
    const areaId = feature.properties?.FID || feature.id;
    const areaName = feature.properties?.delomr || 'Unknown Area';
    const analysis = areaAnalyses.get(areaId as number);
    const areaData = areaDetailsData.get(areaId as number);
    const circumferenceMeters = areaData?.totalPerimeterMeters;

    if (analysis) {
      // Find best walk (first one is used as best for now)
      const bestWalk = analysis.matchedActivities[0];
      
      return {
        areaId: areaId as number,
        areaName,
        circumferenceMeters,
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
      circumferenceMeters,
      tier: null,
      qualityScore: 0,
      walkCount: 0,
    };
  }, [areaAnalyses, areaDetailsData]);

  return (
    <div className="h-screen w-full relative">
      {isAnalyzing && newActivityCount > 0 && (
        <div className="absolute top-20 left-4 z-[400] bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded shadow">
          Analyzing {newActivityCount} new {newActivityCount === 1 ? 'activity' : 'activities'}...
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
        <ZoomTracker onZoomChange={setCurrentZoom} />
        
        {/* WHY: Triple-layer route styling per ADR 010 - cyan glow effect
            Layers render bottom-to-top: glow → outline → core */}
        {activities.flatMap(act => {
          if (!act.map || !act.map.summary_polyline) return [];
          const positions = mapboxPolyline.decode(act.map.summary_polyline);
          return [
            // Glow layer (bottom)
            <Polyline 
              key={`${act.id}-glow`}
              positions={positions} 
              pathOptions={ROUTE_STYLES.glow} 
            />,
            // Outline layer (middle)
            <Polyline 
              key={`${act.id}-outline`}
              positions={positions} 
              pathOptions={ROUTE_STYLES.outline} 
            />,
            // Core layer (top)
            <Polyline 
              key={`${act.id}-core`}
              positions={positions} 
              pathOptions={ROUTE_STYLES.core} 
            />,
          ];
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

        {/* WHY: Tier medal icons at polygon centroids per ADR 010
            Only render when zoom >= 13 for performance and visual clarity */}
        {geoData && geoData.features.map(feature => {
          const areaId = feature.properties?.FID || feature.id;
          const analysis = areaAnalyses.get(areaId as number);
          
          if (!analysis || !analysis.tier) return null;
          if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') return null;

          return (
            <TierIcon
              key={`tier-icon-${areaId}`}
              feature={feature as Feature<Polygon | MultiPolygon>}
              tier={analysis.tier}
              zoom={currentZoom}
            />
          );
        })}
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
