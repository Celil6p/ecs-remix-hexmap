/**
 * Game configuration and environment settings
 */

export const gameConfig = {
  // Map settings (using MapLibre - no API key required!)
  map: {
    // Start with canvas mode by default (most reliable)
    defaultStyle: '', // Empty string will force canvas mode
    // Alternative free styles (uncomment if you want real maps):
    // 'https://demotiles.maplibre.org/style.json', // Free demo style
    // 'https://tiles.openfreemap.org/styles/liberty', // OpenFreeMap
    initialCenter: [0, 0] as [number, number],
    initialZoom: 10,
    minZoom: 10,  // Keep zoomed in to see hex details clearly
    maxZoom: 14,  // Prevent zooming in too close
  },

  // Hex grid settings
  hexGrid: {
    size: 2000, // Size of each hex in meters (larger for visibility)
    mapWidth: 200000, // Total map width in meters (200km)
    mapHeight: 200000, // Total map height in meters (200km)
  },

  // Game settings
  game: {
    maxUnitsPerHex: 1,
    initialUnits: 3,
    terrainTypes: {
      plains: { color: '#90EE90', movementCost: 1 },
      forest: { color: '#228B22', movementCost: 2 },
      water: { color: '#4169E1', movementCost: 999 }, // Impassable
      mountain: { color: '#A0522D', movementCost: 3 },
    },
    unitTypes: {
      warrior: {
        health: 100,
        movementRange: 2,
        color: '#FF4444',
      },
      archer: {
        health: 80,
        movementRange: 1,
        color: '#44FF44',
      },
      cavalry: {
        health: 120,
        movementRange: 3,
        color: '#4444FF',
      },
    },
  },

  // Visual settings
  visuals: {
    hexOpacity: 0.6,
    selectedHexOpacity: 0.9,
    unitRadius: 8,
    unitStrokeWidth: 2,
    unitStrokeColor: '#ffffff',
  },
};

export type GameConfig = typeof gameConfig; 