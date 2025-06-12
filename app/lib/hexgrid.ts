/**
 * Hexagonal grid utilities for game development
 * Using flat-top hexagon orientation
 */

export interface HexCoordinate {
  q: number; // column
  r: number; // row
  s: number; // diagonal (q + r + s = 0)
}

export interface Point {
  x: number;
  y: number;
}

export interface HexTile {
  coordinate: HexCoordinate;
  center: Point;
  vertices: Point[];
  id: string;
}

/**
 * Create a hex coordinate
 */
export function hex(q: number, r: number): HexCoordinate {
  return { q, r, s: -q - r };
}

/**
 * Convert hex coordinate to pixel position
 */
export function hexToPixel(hex: HexCoordinate, size: number): Point {
  const x = size * (3/2 * hex.q);
  const y = size * (Math.sqrt(3)/2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

/**
 * Convert pixel position to hex coordinate
 */
export function pixelToHex(point: Point, size: number): HexCoordinate {
  const q = (2/3 * point.x) / size;
  const r = (-1/3 * point.x + Math.sqrt(3)/3 * point.y) / size;
  return hexRound(hex(q, r));
}

/**
 * Round fractional hex coordinates to nearest integer hex
 */
export function hexRound(h: HexCoordinate): HexCoordinate {
  let q = Math.round(h.q);
  let r = Math.round(h.r);
  let s = Math.round(h.s);

  const q_diff = Math.abs(q - h.q);
  const r_diff = Math.abs(r - h.r);
  const s_diff = Math.abs(s - h.s);

  if (q_diff > r_diff && q_diff > s_diff) {
    q = -r - s;
  } else if (r_diff > s_diff) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  return { q, r, s };
}

/**
 * Get the vertices of a hexagon
 */
export function hexVertices(center: Point, size: number): Point[] {
  const vertices: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    vertices.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle)
    });
  }
  return vertices;
}

/**
 * Generate a hexagonal grid in a rectangular area
 */
export function generateHexGrid(
  mapWidth: number,
  mapHeight: number,
  hexSize: number,
  centerLng: number = 0,
  centerLat: number = 0
): HexTile[] {
  const tiles: HexTile[] = [];
  
  // Calculate how many hexes fit in the area
  const hexWidth = hexSize * 2;
  const hexHeight = hexSize * Math.sqrt(3);
  
  const cols = Math.ceil(mapWidth / (hexWidth * 0.75));
  const rows = Math.ceil(mapHeight / hexHeight);
  
  for (let q = -Math.floor(cols / 2); q <= Math.floor(cols / 2); q++) {
    for (let r = -Math.floor(rows / 2); r <= Math.floor(rows / 2); r++) {
      const coordinate = hex(q, r);
      const pixel = hexToPixel(coordinate, hexSize);
      
      // Convert pixel offset to lng/lat offset (simplified)
      const lngOffset = pixel.x / 111320; // roughly meters per degree at equator
      const latOffset = pixel.y / 110540; // roughly meters per degree
      
      const center = {
        x: centerLng + lngOffset,
        y: centerLat + latOffset
      };
      
      const vertices = hexVertices(center, hexSize / 111320); // Convert to degrees
      
      const tile: HexTile = {
        coordinate,
        center,
        vertices,
        id: `hex-${q}-${r}`
      };
      
      tiles.push(tile);
    }
  }
  
  return tiles;
}

/**
 * Get neighboring hex coordinates
 */
export function hexNeighbors(hex: HexCoordinate): HexCoordinate[] {
  const directions = [
    { q: 1, r: 0, s: -1 },
    { q: 1, r: -1, s: 0 },
    { q: 0, r: -1, s: 1 },
    { q: -1, r: 0, s: 1 },
    { q: -1, r: 1, s: 0 },
    { q: 0, r: 1, s: -1 }
  ];
  
  return directions.map(dir => ({
    q: hex.q + dir.q,
    r: hex.r + dir.r,
    s: hex.s + dir.s
  }));
}

/**
 * Calculate distance between two hex coordinates
 */
export function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.s - b.s)
  );
} 