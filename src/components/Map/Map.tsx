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
  type FullAnalysisResult
} from '@/lib/analysis';
import {
  getMapTierFillColor,
  UNWALKED_AREA_STYLE,
  SATELLITE_UNWALKED_STYLE,
  getBorderColor,
  getBorderWeight,
  getBorderOpacity,
  getFillOpacity,
} from '@/lib/design-tokens';
import {
  prepareDeviationColoredRoute,
  prepareUnmatchedRoute,
  getRoutePathOptions,
  type RouteSegment,
} from '@/lib/route-visualization';
import { calculatePerimeterMeters } from '@/lib/geo-utils';
import { AreaTooltip, useAreaTooltip, type TooltipData } from '@/components/AreaTooltip';
import { TierIcon } from '@/components/TierIcon';
import { useDatabase } from '@/hooks/useDatabase';
import type { DebugToggles, FeatureId } from '@/hooks/useDebugFeatureToggles';
import { 
  saveWalkAnalysis, 
  getOrCreateUserId,
  loadCachedAnalyses,
  getActivitiesToAnalyze,
  loadActivityAreaAssignments,
  type CachedMetrics
} from '@/lib/analysis-persistence';
import {
  getWalkStreams,
  needsStreamsFetch,
  saveWalkStreams
} from '@/lib/db';
import type { DeviationWithExemption } from '@/lib/exemption-types';
import type { CachedStreams } from '@/lib/types/strava-streams';
import type { TierCounts } from '@/lib/types/tiers';
// WHY: Shared map config for consistency across Map, AreaMiniMap, WalkingMode (ADR 017)
import { MALMO_CENTER, DEFAULT_ZOOM } from '@/lib/map-config';
import { useMapTileLayer } from '@/hooks/useMapTileLayer';
import MapStyleToggle, { MapStyleClass } from '@/components/MapStyleToggle';

// Fix for default marker icon in Next.js
// @ts-expect-error - overriding private method
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// WHY: Extended progress info to include tier breakdown per ADR 003
export interface ProgressInfo {
  completedCount: number;
  totalAreas: number;
  tierCounts: TierCounts;
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
  // WHY: Route visibility toggle - hidden by default per ADR 010 Section 3
  showRoutes?: boolean;
  debugToggles?: DebugToggles | null;
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
    // WHY: ADR 021 tiered scoring - use cached values from database
    tieredBorderScore: cached.tieredBorderScore ?? 0,
    tierDistribution: cached.tierDistribution ?? {
      platinum: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
      potato: 0,
      missed: 1,
    },
    tieredSegments: [],
    walkFocus: cached.walkFocus ?? cached.efficiency, // Same value as efficiency
    rawQualityScore: cached.rawQualityScore,
    tier: cached.tier as Tier,
  };
}

// WHY: Store route visualization data per activity for deviation-colored rendering (ADR 010)
interface ActivityRouteData {
  activityId: number;
  segments: RouteSegment[];
  assignedAreaId: number | null;
}

export default function CityMap({ activities = [], athleteId, onProgressChange, onAreaClick, onAreasLoaded, onRegisterRefresh, showRoutes = false, debugToggles }: MapProps) {
  // Helper: check if a feature is enabled (always true when debug panel inactive)
  const dbg = (id: FeatureId) => !debugToggles || debugToggles.isEnabled(id);
  const { tileUrl, tileAttribution, mapStyle, isSatellite } = useMapTileLayer();
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
  
  // WHY: Store route visualization data for deviation-colored rendering (ADR 010)
  // This stores processed route segments with colors based on distance from assigned area boundary
  const [routeVisualizationData, setRouteVisualizationData] = useState<Map<number, ActivityRouteData>>(new Map());
  
  // WHY: Track which activity is assigned to which area for route deviation coloring
  // This is populated during analysis and used by route visualization effect
  const [activityAreaAssignments, setActivityAreaAssignments] = useState<Map<number, number>>(new Map());
  
  // WHY: Database hook for persistence - loads cached results and saves new analyses
  // The persistence functions manage their own IndexedDB connection internally.
  // We only need `ready` (db initialized) and `loading` state from the hook.
  const { ready: rawDbReady, loading: rawDbLoading } = useDatabase();
  // Feature 1: db-init — gate consumption so the hook always runs but Map ignores it when toggled off
  const db = dbg('db-init') ? rawDbReady : false;
  const dbLoading = dbg('db-init') ? rawDbLoading : false;

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

  // Feature 2: geojson-load
  const geojsonEnabled = dbg('geojson-load');
  useEffect(() => {
    if (!geojsonEnabled) return;
    const t0 = performance.now();
    fetch('/data/malmo_delomraden.geojson')
      .then((res) => res.json())
      .then((data) => {
        debugToggles?.recordTiming('geojson-load', performance.now() - t0);
        setGeoData(data);
      })
      .catch(err => console.error("Failed to load GeoJSON", err));
  }, [geojsonEnabled, debugToggles]);

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
    if (!geoData) {
      return;
    }

    // WHY: Defer analysis to next tick to not block UI rendering
    setTimeout(async () => {
      // WHY: Database is optional - get userId only if db is available
      let userId: number | null = null;
      if (db && !dbLoading && athleteId) {
        try {
          userId = await getOrCreateUserId(athleteId);
        } catch (e) {
          console.warn('[Map] Could not get/create user:', e);
        }
      }

      const newAreaAnalyses = new Map<number, AreaAnalysis>();

      // Feature 3: area-detail — compute perimeter/area for all polygons
      let allAreaDetails = new Map<number, AreaDetail>();
      if (dbg('area-detail')) {
        const t0 = performance.now();
        allAreaDetails = buildAreaDetailMap(geoData);
        debugToggles?.recordTiming('area-detail', performance.now() - t0);
      }
      const newAreaDetailsData = buildBaseAreaClickData(allAreaDetails);

      // Feature 4: cached-analysis — load stored results from DB
      let cachedResults = new Map<number, Awaited<ReturnType<typeof loadCachedAnalyses>> extends Map<number, infer V> ? V : never>();
      if (userId !== null && dbg('cached-analysis')) {
        try {
          const t0 = performance.now();
          cachedResults = await loadCachedAnalyses(userId);
          debugToggles?.recordTiming('cached-analysis', performance.now() - t0);
        } catch (e) {
          console.warn('[Map] Could not load cached analyses:', e);
        }
      }
      
      // WHY: If no activities AND no cached data, show empty state
      // This handles first-time users or users who haven't walked any areas yet
      if (!activities.length && cachedResults.size === 0) {
        setAreaDetailsData(newAreaDetailsData);
        onAreasLoaded?.(newAreaDetailsData);
        onProgressChange({
          completedCount: 0,
          totalAreas: geoData.features.length,
          tierCounts: { platinum: 0, gold: 0, silver: 0, bronze: 0, potato: 0 }
        });
        return;
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
            // WHY: Include summaryPolyline from cache for share feature (ADR 023)
            areaDetails.walks = cached.activityIds.map(id => ({
              id,
              name: '',
              qualityScore: cached.metrics.rawQualityScore,
              isBest: true,
              summaryPolyline: cached.activityPolylines.get(id),
            }));
          }
        });

        // Immediately update UI with cached data
        setAreaAnalyses(new Map(newAreaAnalyses));
        setAreaDetailsData(new Map(newAreaDetailsData));
        onAreasLoaded?.(new Map(newAreaDetailsData));

        // Update progress with cached tier counts
        const cachedTierCounts = { platinum: 0, gold: 0, silver: 0, bronze: 0, potato: 0 };
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
        ? await getActivitiesToAnalyze(userId, activityIds)
        : activityIds;

      if (needsAnalysis.length === 0) {
        // All activities already analyzed - skip analysis entirely
        // WHY: Load ALL activity-to-area assignments from database for route visualization
        // loadActivityAreaAssignments returns all activities with their primary area, not just
        // the best activity per area like loadCachedAnalyses does. This ensures all routes
        // can be colored based on their deviation from assigned area boundaries.
        if (userId !== null) {
          const allAssignments = await loadActivityAreaAssignments(userId);
          setActivityAreaAssignments(allAssignments);
        }

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
        const cached = hasDb ? await getWalkStreams(activity.id) : null;
        if (cached && cached.latlng.length > 0) {
          return {
            streamCoordinates: cached.latlng.map(([lat, lng]) => [lng, lat]),
            cachedStreams: cached,
            shouldSaveStreams: false,
            streamTime: cached.time,
            streamDistance: cached.distance,
          };
        }

        if (hasDb && !(await needsStreamsFetch(activity.id))) {
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

      // Feature 5: activity-processing — decode polylines + fetch streams
      const processedActivities: Array<{
        original: StravaActivity;
        coordinates: Position[];
        stravaMetadata: StravaMetadata | undefined;
        streamCoordinates: Position[] | null;
        cachedStreams: CachedStreams | null;
        shouldSaveStreams: boolean;
      }> = [];

      if (dbg('activity-processing')) {
        const t0 = performance.now();
        const activitiesToProcess = activities.filter(a => needsAnalysis.includes(a.id));
        console.log(`[Map] Processing ${activitiesToProcess.length} new activities (skipping ${activities.length - activitiesToProcess.length} already-analyzed)`);

        for (const act of activitiesToProcess) {
          if (!act.map || !act.map.summary_polyline) continue;
          try {
            const decoded = mapboxPolyline.decode(act.map.summary_polyline);
            const coordinates: Position[] = decoded.map(pt => [pt[1], pt[0]]);

            const streamData = await loadStreamData(act);

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
        debugToggles?.recordTiming('activity-processing', performance.now() - t0);
      }

      // Feature 6: walk-analysis — N×M intersection loop
      const activityBestArea = new Map<number, { areaId: number; score: number }>();

      if (dbg('walk-analysis')) {
      const walkAnalysisT0 = performance.now();
      console.log(`[Map] Processing ${processedActivities.length} activities against ${allAreaDetails.size} areas`);

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

            // WHY: Any positive score qualifies (includes Potato tier for scores < 0.50)
            // See ADR 003 (Updated 2026-02-13) - all matched walks count toward progress
            console.log(`[Map] Activity ${activityId} vs Area ${areaId}: score=${(result.metrics.rawQualityScore * 100).toFixed(1)}%, perimeter=${(result.metrics.perimeterCoveragePercent * 100).toFixed(1)}%, area=${(result.metrics.areaCoveragePercent * 100).toFixed(1)}%`);
            if (result.metrics.rawQualityScore > 0) {
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

      // Full analysis + aggregation for assigned activity-area pairs
      const areaActivityScores = new Map<number, Array<{ activityId: number; name: string; score: number; metrics: AnalysisMetrics; result: FullAnalysisResult; summaryPolyline?: string }>>();

      for (const [activityId, { areaId }] of activityBestArea.entries()) {
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

        // Feature 7: db-persist — save analysis results to DB
        if (userId !== null && dbg('db-persist')) {
          const persistT0 = performance.now();
          try {
            await saveWalkAnalysis(
              userId,
              activity.original,
              areaId,
              result,
              true // isPrimaryMatch
            );

            if (activity.cachedStreams && activity.shouldSaveStreams) {
              await saveWalkStreams(activityId, activity.cachedStreams);
            }
          } catch (e) {
            console.error(`[Map] Error saving analysis for activity ${activityId}, area ${areaId}:`, e);
          }
          debugToggles?.recordTiming('db-persist', performance.now() - persistT0);
        }

        if (!areaActivityScores.has(areaId)) {
          areaActivityScores.set(areaId, []);
        }

        areaActivityScores.get(areaId)!.push({
          activityId,
          name: activity.original.name,
          score: result.metrics.rawQualityScore,
          metrics: result.metrics,
          result,
          summaryPolyline: activity.original.map?.summary_polyline
        });
      }

      // Merge new analysis results with cached data
      areaActivityScores.forEach((scores, areaId) => {
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
            isBest: score.activityId === bestWalk.activityId,
            summaryPolyline: score.summaryPolyline
          }));
          areaDetails.deviations = [];
        }
      });

      const newAssignments = new Map<number, number>();
      activityBestArea.forEach((value, activityId) => {
        newAssignments.set(activityId, value.areaId);
      });
      if (userId !== null) {
        const allAssignments = await loadActivityAreaAssignments(userId);
        setActivityAreaAssignments(allAssignments);
      } else {
        setActivityAreaAssignments(newAssignments);
      }

      debugToggles?.recordTiming('walk-analysis', performance.now() - walkAnalysisT0);
      } // end walk-analysis gate

      setAreaDetailsData(newAreaDetailsData);
      setAreaAnalyses(newAreaAnalyses);
      setIsAnalyzing(false);
      setNewActivityCount(0);

      // WHY: Notify parent of all area data for use in SubAreaListPanel (ADR 008)
      onAreasLoaded?.(newAreaDetailsData);

      // Calculate tier counts for progress
      const tierCounts = { platinum: 0, gold: 0, silver: 0, bronze: 0, potato: 0 };
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dbg/debugToggles are stable references from props
  }, [geoData, activities, onProgressChange, onAreasLoaded, buildAreaDetailMap, buildBaseAreaClickData, db, dbLoading, athleteId, refreshCounter]);

  // Feature 8: route-viz — deviation-colored route rendering
  const routeVizEnabled = dbg('route-viz');
  useEffect(() => {
    if (!routeVizEnabled || !showRoutes || !geoData || activities.length === 0) {
      // Clear route data when routes are hidden
      if (!showRoutes && routeVisualizationData.size > 0) {
        setRouteVisualizationData(new Map());
      }
      return;
    }

    // WHY: Wrap in async IIFE because getWalkStreams is now async (IndexedDB migration)
    (async () => {
      // Build area details map for boundary access
      const areaDetails = buildAreaDetailMap(geoData);
      const newRouteData = new Map<number, ActivityRouteData>();

      for (const activity of activities) {
        if (!activity.map || !activity.map.summary_polyline) continue;

        try {
          // Decode polyline - prefer stream data if available in cache
          // WHY: Stream data provides full path without privacy zone truncation (ADR 006)
          let coordinates: Position[];
          const hasDb = Boolean(db && !dbLoading);
          const cachedStreams = hasDb ? await getWalkStreams(activity.id) : null;

          if (cachedStreams && cachedStreams.latlng.length > 0) {
            // Use stream data (convert from [lat, lng] to [lng, lat] for GeoJSON)
            coordinates = cachedStreams.latlng.map(([lat, lng]) => [lng, lat]);
          } else {
            // Fallback to summary_polyline
            const decoded = mapboxPolyline.decode(activity.map.summary_polyline);
            coordinates = decoded.map(pt => [pt[1], pt[0]]);
          }

          // Check if activity is assigned to an area
          const assignedAreaId = activityAreaAssignments.get(activity.id) ?? null;

          let segments: RouteSegment[];
          if (assignedAreaId !== null) {
            // Get the area boundary for deviation calculation
            const areaDetail = areaDetails.get(assignedAreaId);
            if (areaDetail) {
              segments = prepareDeviationColoredRoute(coordinates, areaDetail.feature);
            } else {
              // Area not found - render as unmatched
              segments = prepareUnmatchedRoute(coordinates);
            }
          } else {
            // No assigned area - render in neutral color
            segments = prepareUnmatchedRoute(coordinates);
          }

          newRouteData.set(activity.id, {
            activityId: activity.id,
            segments,
            assignedAreaId,
          });
        } catch (e) {
          console.warn('[Map] Error preparing route visualization for activity', activity.id, e);
        }
      }

      setRouteVisualizationData(newRouteData);
    })();
  }, [routeVizEnabled, showRoutes, geoData, activities, activityAreaAssignments, buildAreaDetailMap, db, dbLoading, routeVisualizationData.size]);

  // Feature 10: geojson-style — tier-based area coloring
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getStyle = useCallback((feature: any) => {
    // When geojson-style is off, show plain unwalked styling
    if (debugToggles && !debugToggles.isEnabled('geojson-style')) {
      const unwalked = isSatellite ? SATELLITE_UNWALKED_STYLE : UNWALKED_AREA_STYLE;
      return {
        color: unwalked.borderColor,
        weight: unwalked.borderWeight,
        opacity: unwalked.borderOpacity,
        fillColor: unwalked.fillColor,
        fillOpacity: unwalked.fillOpacity,
      };
    }

    const areaId = feature?.properties?.FID || feature?.id;
    const analysis = areaAnalyses.get(areaId as number);

    if (analysis && analysis.tier) {
      // WHY: Use design tokens for map-specific purple-pink gradient (ADR 010)
      // Satellite mode: white borders, +1px weight, boosted fill opacity (ADR 025)
      const fillColor = getMapTierFillColor(analysis.tier);

      return {
        color: getBorderColor(analysis.tier, isSatellite),
        weight: getBorderWeight(2, isSatellite),
        opacity: getBorderOpacity(0.8, isSatellite),
        fillColor: fillColor,
        fillOpacity: getFillOpacity(analysis.tier, 0, isSatellite),
      };
    }

    // WHY: Subtle styling for unwalked areas so they don't compete with completed ones
    // Satellite mode uses white borders for visibility (ADR 025)
    const unwalked = isSatellite ? SATELLITE_UNWALKED_STYLE : UNWALKED_AREA_STYLE;
    return {
      color: unwalked.borderColor,
      weight: unwalked.borderWeight,
      opacity: unwalked.borderOpacity,
      fillColor: unwalked.fillColor,
      fillOpacity: unwalked.fillOpacity,
    };
  }, [areaAnalyses, isSatellite, debugToggles]);

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
        zoom={DEFAULT_ZOOM}
        className="h-full w-full z-0 grayscale-tiles"
        zoomControl={false}
      >
        <MapStyleClass mapStyle={mapStyle} />
        <TileLayer
          attribution={tileAttribution}
          url={tileUrl}
        />
        <LocationMarker />
        <ZoomTracker onZoomChange={setCurrentZoom} />
        
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

        {/* WHY: Route visualization with deviation-based coloring per ADR 010
            - Hidden by default, shown via toggle control
            - Green segments = within 25m of boundary (on-track)
            - Red segments = beyond 25m of boundary (deviation)
            - Renders AFTER GeoJSON layer so routes are visible on top of area fills */}
        {showRoutes && routeVisualizationData.size > 0 && (
          Array.from(routeVisualizationData.values()).flatMap(routeData =>
            routeData.segments.map((segment, segmentIndex) => (
              <Polyline
                key={`route-${routeData.activityId}-${segmentIndex}`}
                positions={segment.positions}
                pathOptions={getRoutePathOptions(segment.color)}
              />
            ))
          )
        )}

        {/* Feature 9: tier-icons — medal icons at polygon centroids */}
        {dbg('tier-icons') && geoData && geoData.features.map(feature => {
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

      {/* Map style toggle - bottom-right floating */}
      <div className="absolute bottom-6 right-4 z-[400]">
        <MapStyleToggle />
      </div>
    </div>
  );
}
