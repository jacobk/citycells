/**
 * Adjacency Graph Utilities for Achievement System
 * 
 * Builds and queries a graph of area relationships for achievements
 * based on adjacent areas and special configurations.
 * 
 * See ADR 019 for achievement system design.
 * See TICKET-023 for implementation requirements.
 * 
 * @module adjacency
 */

import type { AreaRow } from './db';

// ============================================
// Types
// ============================================

/**
 * Adjacency graph: Map from area FID to set of adjacent area FIDs.
 */
export type AdjacencyGraph = Map<number, Set<number>>;

/**
 * Vertex map: Map from vertex key to set of area FIDs that share that vertex.
 * WHY: Used for triple-point and crossroads achievements.
 */
export type VertexMap = Map<string, Set<number>>;

// ============================================
// Constants
// ============================================

// WHY: Tolerance for considering two points as the same vertex
// GeoJSON coordinates may have slight variations due to precision
const VERTEX_TOLERANCE_DEGREES = 0.0001; // ~11 meters at Malmö latitude

// ============================================
// Graph Building
// ============================================

/**
 * Build an adjacency graph from areas.
 * Two areas are adjacent if they share any boundary segment or vertex.
 * 
 * WHY: This is computed once since area boundaries are static.
 * The graph is used for cluster detection and configuration achievements.
 */
export function buildAdjacencyGraph(areas: AreaRow[]): AdjacencyGraph {
  const graph: AdjacencyGraph = new Map();
  
  // Initialize empty sets for all areas
  for (const area of areas) {
    graph.set(area.fid, new Set());
  }
  
  // Extract vertices for each area
  const areaVertices = new Map<number, Set<string>>();
  for (const area of areas) {
    const vertices = extractVertices(area.geometry_json);
    areaVertices.set(area.fid, vertices);
  }
  
  // Build adjacency by finding areas with shared vertices
  // WHY: Two areas are adjacent if they share at least one vertex
  for (let i = 0; i < areas.length; i++) {
    const areaA = areas[i];
    const verticesA = areaVertices.get(areaA.fid)!;
    
    for (let j = i + 1; j < areas.length; j++) {
      const areaB = areas[j];
      const verticesB = areaVertices.get(areaB.fid)!;
      
      // Check for shared vertices
      if (hasSharedVertex(verticesA, verticesB)) {
        graph.get(areaA.fid)!.add(areaB.fid);
        graph.get(areaB.fid)!.add(areaA.fid);
      }
    }
  }
  
  return graph;
}

/**
 * Build a vertex map showing which areas share each vertex.
 * WHY: Used for triple-point and crossroads achievements.
 */
export function buildVertexMap(areas: AreaRow[]): VertexMap {
  const vertexMap: VertexMap = new Map();
  
  for (const area of areas) {
    const vertices = extractVerticesRaw(area.geometry_json);
    
    for (const [lng, lat] of vertices) {
      const key = vertexKey(lng, lat);
      
      if (!vertexMap.has(key)) {
        vertexMap.set(key, new Set());
      }
      vertexMap.get(key)!.add(area.fid);
    }
  }
  
  return vertexMap;
}

// ============================================
// Vertex Extraction Helpers
// ============================================

/**
 * Extract all unique vertices from a geometry as rounded keys.
 */
function extractVertices(geometryJson: string): Set<string> {
  const vertices = new Set<string>();
  const coords = extractVerticesRaw(geometryJson);
  
  for (const [lng, lat] of coords) {
    vertices.add(vertexKey(lng, lat));
  }
  
  return vertices;
}

/**
 * Extract all vertex coordinates from a geometry.
 */
function extractVerticesRaw(geometryJson: string): Array<[number, number]> {
  const vertices: Array<[number, number]> = [];
  
  try {
    const geometry = JSON.parse(geometryJson);
    
    if (geometry.type === 'Polygon') {
      // Polygon has array of rings, first is exterior
      for (const ring of geometry.coordinates) {
        for (const coord of ring) {
          vertices.push([coord[0], coord[1]]);
        }
      }
    } else if (geometry.type === 'MultiPolygon') {
      // MultiPolygon has array of polygons
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          for (const coord of ring) {
            vertices.push([coord[0], coord[1]]);
          }
        }
      }
    }
  } catch {
    // Invalid geometry
  }
  
  return vertices;
}

/**
 * Create a vertex key from coordinates.
 * WHY: Round to tolerance to handle floating point variations.
 */
function vertexKey(lng: number, lat: number): string {
  const precision = 1 / VERTEX_TOLERANCE_DEGREES;
  const roundedLng = Math.round(lng * precision) / precision;
  const roundedLat = Math.round(lat * precision) / precision;
  return `${roundedLng.toFixed(4)},${roundedLat.toFixed(4)}`;
}

/**
 * Check if two sets of vertices have any in common.
 */
function hasSharedVertex(verticesA: Set<string>, verticesB: Set<string>): boolean {
  for (const v of verticesA) {
    if (verticesB.has(v)) {
      return true;
    }
  }
  return false;
}

// ============================================
// Cluster Detection (BFS)
// ============================================

/**
 * Find the largest connected cluster of completed areas.
 * WHY: Used for adjacent area achievements (Good Neighbors, Trilogy, etc.)
 * 
 * @param graph - The adjacency graph
 * @param completedFids - Set of completed area FIDs
 * @returns Size of the largest connected cluster
 */
export function findLargestConnectedCluster(
  graph: AdjacencyGraph,
  completedFids: Set<number>
): number {
  if (completedFids.size === 0) {
    return 0;
  }
  
  const visited = new Set<number>();
  let largestCluster = 0;
  
  // BFS from each unvisited completed area
  for (const fid of completedFids) {
    if (visited.has(fid)) continue;
    
    const clusterSize = bfsClusterSize(graph, fid, completedFids, visited);
    largestCluster = Math.max(largestCluster, clusterSize);
  }
  
  return largestCluster;
}

/**
 * BFS to find cluster size starting from a given area.
 */
function bfsClusterSize(
  graph: AdjacencyGraph,
  startFid: number,
  completedFids: Set<number>,
  visited: Set<number>
): number {
  const queue: number[] = [startFid];
  let size = 0;
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (visited.has(current)) continue;
    visited.add(current);
    size++;
    
    // Add adjacent completed areas to queue
    const neighbors = graph.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (completedFids.has(neighbor) && !visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }
  
  return size;
}

// ============================================
// Configuration Detection
// ============================================

/**
 * Check if there are N completed areas sharing a single vertex.
 * WHY: Used for triple-point (3) and crossroads (4) achievements.
 */
export function hasAreasShareVertex(
  vertexMap: VertexMap,
  completedFids: Set<number>,
  minCount: number
): boolean {
  for (const [, areaFids] of vertexMap) {
    // Count how many completed areas share this vertex
    let completedCount = 0;
    for (const fid of areaFids) {
      if (completedFids.has(fid)) {
        completedCount++;
      }
    }
    
    if (completedCount >= minCount) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if completed areas form a linear chain of length N.
 * WHY: Used for chain-reaction achievement.
 * 
 * A chain is a sequence of areas where each is adjacent only to 
 * at most 2 other areas in the chain (forming a line, not a cluster).
 */
export function hasLinearChain(
  graph: AdjacencyGraph,
  completedFids: Set<number>,
  minLength: number
): boolean {
  if (completedFids.size < minLength) {
    return false;
  }
  
  // For each completed area, try to find a chain starting from it
  for (const startFid of completedFids) {
    const chainLength = findLongestChainFrom(graph, startFid, completedFids);
    if (chainLength >= minLength) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find the longest linear chain starting from a given area.
 * WHY: Uses DFS to explore potential chains.
 */
function findLongestChainFrom(
  graph: AdjacencyGraph,
  startFid: number,
  completedFids: Set<number>
): number {
  // DFS to find longest path without revisiting
  function dfs(current: number, visited: Set<number>): number {
    visited.add(current);
    let maxLength = 1;
    
    const neighbors = graph.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (completedFids.has(neighbor) && !visited.has(neighbor)) {
          const length = 1 + dfs(neighbor, new Set(visited));
          maxLength = Math.max(maxLength, length);
        }
      }
    }
    
    return maxLength;
  }
  
  return dfs(startFid, new Set());
}

/**
 * Check if completed areas completely surround any incomplete area.
 * WHY: Used for encirclement achievement.
 * 
 * An area is encircled if ALL its neighbors are completed.
 */
export function hasEncirclement(
  graph: AdjacencyGraph,
  completedFids: Set<number>,
  allFids: Set<number>
): boolean {
  // Check each incomplete area
  for (const fid of allFids) {
    if (completedFids.has(fid)) continue;
    
    const neighbors = graph.get(fid);
    if (!neighbors || neighbors.size === 0) continue;
    
    // Check if ALL neighbors are completed
    let allNeighborsCompleted = true;
    for (const neighbor of neighbors) {
      if (!completedFids.has(neighbor)) {
        allNeighborsCompleted = false;
        break;
      }
    }
    
    if (allNeighborsCompleted) {
      return true;
    }
  }
  
  return false;
}

// ============================================
// Caching
// ============================================

// WHY: Cache the adjacency graph and vertex map since area boundaries are static
let cachedAdjacencyGraph: AdjacencyGraph | null = null;
let cachedVertexMap: VertexMap | null = null;

/**
 * Get or build the adjacency graph.
 * WHY: Caches the result since area boundaries don't change.
 */
export function getAdjacencyGraph(areas: AreaRow[]): AdjacencyGraph {
  if (!cachedAdjacencyGraph) {
    console.log('[Adjacency] Building adjacency graph...');
    cachedAdjacencyGraph = buildAdjacencyGraph(areas);
    console.log(`[Adjacency] Built graph with ${cachedAdjacencyGraph.size} areas`);
  }
  return cachedAdjacencyGraph;
}

/**
 * Get or build the vertex map.
 * WHY: Caches the result since area boundaries don't change.
 */
export function getVertexMap(areas: AreaRow[]): VertexMap {
  if (!cachedVertexMap) {
    console.log('[Adjacency] Building vertex map...');
    cachedVertexMap = buildVertexMap(areas);
    console.log(`[Adjacency] Built vertex map with ${cachedVertexMap.size} unique vertices`);
  }
  return cachedVertexMap;
}

/**
 * Clear cached data (for testing or if areas change).
 */
export function clearAdjacencyCache(): void {
  cachedAdjacencyGraph = null;
  cachedVertexMap = null;
}
