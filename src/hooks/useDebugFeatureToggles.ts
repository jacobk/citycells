'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

export type FeatureId =
  | 'db-init'
  | 'geojson-load'
  | 'area-detail'
  | 'cached-analysis'
  | 'activity-processing'
  | 'walk-analysis'
  | 'db-persist'
  | 'route-viz'
  | 'tier-icons'
  | 'geojson-style';

interface FeatureDefinition {
  id: FeatureId;
  label: string;
  description: string;
  dependsOn: FeatureId[];
}

const FEATURES: FeatureDefinition[] = [
  { id: 'db-init', label: 'Database Init', description: 'SQL.js / IndexedDB initialization', dependsOn: [] },
  { id: 'geojson-load', label: 'GeoJSON Loading', description: 'Fetch area polygon data', dependsOn: [] },
  { id: 'area-detail', label: 'Area Details', description: 'turf.area + perimeter for all areas', dependsOn: ['geojson-load'] },
  { id: 'cached-analysis', label: 'Cached Analysis', description: 'Load stored results from DB', dependsOn: ['db-init', 'area-detail'] },
  { id: 'activity-processing', label: 'Activity Processing', description: 'Decode polylines + fetch streams', dependsOn: ['geojson-load'] },
  { id: 'walk-analysis', label: 'Walk Analysis', description: 'N×M intersection loop', dependsOn: ['area-detail', 'activity-processing'] },
  { id: 'db-persist', label: 'DB Persistence', description: 'Save analysis results to DB', dependsOn: ['db-init', 'walk-analysis'] },
  { id: 'route-viz', label: 'Route Visualization', description: 'Deviation-colored route rendering', dependsOn: ['activity-processing', 'walk-analysis'] },
  { id: 'tier-icons', label: 'Tier Icons', description: 'Medal icons at polygon centroids', dependsOn: ['area-detail', 'walk-analysis'] },
  { id: 'geojson-style', label: 'GeoJSON Styling', description: 'Tier-based area coloring', dependsOn: ['area-detail', 'walk-analysis'] },
];

export interface FeatureToggle {
  id: FeatureId;
  label: string;
  description: string;
  enabled: boolean;
  forced: boolean; // true = disabled because an upstream dep is off
  timing: number | null;
  dependsOn: FeatureId[];
}

export interface DebugToggles {
  features: FeatureToggle[];
  isEnabled: (id: FeatureId) => boolean;
  toggle: (id: FeatureId) => void;
  recordTiming: (id: FeatureId, ms: number) => void;
  enableAll: () => void;
  resetAll: () => void;
}

function getDownstream(id: FeatureId): FeatureId[] {
  const result: FeatureId[] = [];
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const f of FEATURES) {
      if (f.dependsOn.includes(current) && !result.includes(f.id)) {
        result.push(f.id);
        queue.push(f.id);
      }
    }
  }
  return result;
}

function allDepsEnabled(id: FeatureId, enabledSet: Set<FeatureId>): boolean {
  const def = FEATURES.find(f => f.id === id);
  if (!def) return true;
  return def.dependsOn.every(dep => enabledSet.has(dep));
}

export function useDebugFeatureToggles(): DebugToggles | null {
  const searchParams = useSearchParams();
  const isDebug = searchParams.get('debug') === 'true';

  const [enabledSet, setEnabledSet] = useState<Set<FeatureId>>(new Set());
  const [timings, setTimings] = useState<Map<FeatureId, number>>(new Map());

  const isEnabled = useCallback((id: FeatureId): boolean => {
    return enabledSet.has(id);
  }, [enabledSet]);

  const toggle = useCallback((id: FeatureId) => {
    setEnabledSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        for (const downstream of getDownstream(id)) {
          next.delete(downstream);
        }
      } else {
        if (allDepsEnabled(id, next)) {
          next.add(id);
        }
      }
      return next;
    });
    setTimings(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const recordTiming = useCallback((id: FeatureId, ms: number) => {
    setTimings(prev => new Map(prev).set(id, ms));
  }, []);

  const enableAll = useCallback(() => {
    setEnabledSet(new Set(FEATURES.map(f => f.id)));
    setTimings(new Map());
  }, []);

  const resetAll = useCallback(() => {
    setEnabledSet(new Set());
    setTimings(new Map());
  }, []);

  if (!isDebug) return null;

  const features: FeatureToggle[] = FEATURES.map(def => ({
    id: def.id,
    label: def.label,
    description: def.description,
    enabled: enabledSet.has(def.id),
    forced: !allDepsEnabled(def.id, enabledSet),
    timing: timings.get(def.id) ?? null,
    dependsOn: def.dependsOn,
  }));

  return { features, isEnabled, toggle, recordTiming, enableAll, resetAll };
}
