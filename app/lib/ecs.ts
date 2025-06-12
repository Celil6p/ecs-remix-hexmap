/**
 * Entity Component System setup using Miniplex
 */

import { World } from "miniplex";
import type { HexCoordinate, HexTile } from "./hexgrid";

export type { HexCoordinate } from "./hexgrid";

// Component interfaces
export interface Position {
  lng: number;
  lat: number;
}

export interface HexPosition {
  coordinate: HexCoordinate;
}

export interface Renderable {
  type: "hex" | "unit" | "building";
  color: string;
  opacity: number;
  visible: boolean;
}

export interface Selectable {
  selected: boolean;
  hoverable: boolean;
}

export interface HexTileComponent {
  tile: HexTile;
  terrain: "plains" | "forest" | "water" | "mountain";
  occupied: boolean;
}

export interface Unit {
  type: string;
  health: number;
  maxHealth: number;
  movementRange: number;
  canMove: boolean;
}

export interface Building {
  type: string;
  health: number;
  maxHealth: number;
  production: Record<string, number>;
}

// Entity type
export interface Entity {
  position?: Position;
  hexPosition?: HexPosition;
  renderable?: Renderable;
  selectable?: Selectable;
  hexTile?: HexTileComponent;
  unit?: Unit;
  building?: Building;
}

// Create the ECS world
export const world = new World<Entity>();

// Archetype queries for efficient system processing
export const hexTiles = world.with("hexTile", "position", "renderable");
export const units = world.with("unit", "position", "hexPosition", "renderable");
export const buildings = world.with("building", "position", "hexPosition", "renderable");
export const selectables = world.with("selectable", "renderable");

// System functions
export class GameSystems {
  
  /**
   * Initialize hex grid entities
   */
  static initializeHexGrid(tiles: HexTile[]) {
    // Clear existing hex tiles
    for (const entity of hexTiles) {
      world.remove(entity);
    }

    // Create entities for each hex tile
    tiles.forEach(tile => {
      const terrainTypes = ["plains", "forest", "water", "mountain"] as const;
      const terrain = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
      
      const terrainColors = {
        plains: "#90EE90",
        forest: "#228B22",
        water: "#4169E1",
        mountain: "#A0522D"
      };

      world.add({
        position: {
          lng: tile.center.x,
          lat: tile.center.y
        },
        hexTile: {
          tile,
          terrain,
          occupied: false
        },
        renderable: {
          type: "hex",
          color: terrainColors[terrain],
          opacity: 0.6,
          visible: true
        },
        selectable: {
          selected: false,
          hoverable: true
        }
      });
    });
  }

  /**
   * Handle hex tile selection
   */
  static selectHexTile(coordinate: HexCoordinate) {
    for (const entity of selectables) {
      if (entity.hexTile) {
        const isTarget = 
          entity.hexTile.tile.coordinate.q === coordinate.q &&
          entity.hexTile.tile.coordinate.r === coordinate.r &&
          entity.hexTile.tile.coordinate.s === coordinate.s;
        
        entity.selectable.selected = isTarget;
        entity.renderable.opacity = isTarget ? 0.9 : 0.6;
      }
    }
  }

  /**
   * Spawn a unit at a hex coordinate
   */
  static spawnUnit(coordinate: HexCoordinate, unitType: string = "warrior") {
    // Find the hex tile at this coordinate
    const hexEntity = Array.from(hexTiles).find(entity =>
      entity.hexTile!.tile.coordinate.q === coordinate.q &&
      entity.hexTile!.tile.coordinate.r === coordinate.r &&
      entity.hexTile!.tile.coordinate.s === coordinate.s
    );

    if (!hexEntity || hexEntity.hexTile!.occupied) {
      return null; // Can't spawn here
    }

    // Mark hex as occupied
    hexEntity.hexTile!.occupied = true;

    // Create unit entity
    const unitEntity = world.add({
      position: {
        lng: hexEntity.position!.lng,
        lat: hexEntity.position!.lat
      },
      hexPosition: {
        coordinate
      },
      unit: {
        type: unitType,
        health: 100,
        maxHealth: 100,
        movementRange: 2,
        canMove: true
      },
      renderable: {
        type: "unit",
        color: "#FF4444",
        opacity: 1.0,
        visible: true
      },
      selectable: {
        selected: false,
        hoverable: true
      }
    });

    return unitEntity;
  }

  /**
   * Move a unit to a new hex coordinate
   */
  static moveUnit(unitEntity: Entity, newCoordinate: HexCoordinate): boolean {
    if (!unitEntity.unit || !unitEntity.hexPosition) {
      return false;
    }

    // Check if unit can move
    if (!unitEntity.unit.canMove) {
      return false;
    }

    // Find the target hex
    const targetHex = Array.from(hexTiles).find(entity =>
      entity.hexTile!.tile.coordinate.q === newCoordinate.q &&
      entity.hexTile!.tile.coordinate.r === newCoordinate.r &&
      entity.hexTile!.tile.coordinate.s === newCoordinate.s
    );

    if (!targetHex || targetHex.hexTile!.occupied) {
      return false; // Can't move here
    }

    // Free up the old hex
    const oldHex = Array.from(hexTiles).find(entity =>
      entity.hexTile!.tile.coordinate.q === unitEntity.hexPosition!.coordinate.q &&
      entity.hexTile!.tile.coordinate.r === unitEntity.hexPosition!.coordinate.r &&
      entity.hexTile!.tile.coordinate.s === unitEntity.hexPosition!.coordinate.s
    );

    if (oldHex) {
      oldHex.hexTile!.occupied = false;
    }

    // Update unit position
    unitEntity.position!.lng = targetHex.position!.lng;
    unitEntity.position!.lat = targetHex.position!.lat;
    unitEntity.hexPosition!.coordinate = newCoordinate;
    
    // Mark new hex as occupied
    targetHex.hexTile!.occupied = true;
    
    // Unit has moved, can't move again this turn
    unitEntity.unit.canMove = false;

    return true;
  }

  /**
   * Reset movement for all units (call at start of turn)
   */
  static resetMovement() {
    for (const entity of units) {
      entity.unit.canMove = true;
    }
  }

  /**
   * Get all entities at a specific coordinate
   */
  static getEntitiesAtCoordinate(coordinate: HexCoordinate): Entity[] {
    const entities: Entity[] = [];
    
    // Check hex tiles
    for (const entity of hexTiles) {
      const tile = entity.hexTile!.tile;
      if (tile.coordinate.q === coordinate.q && 
          tile.coordinate.r === coordinate.r && 
          tile.coordinate.s === coordinate.s) {
        entities.push(entity);
      }
    }
    
    // Check units
    for (const entity of units) {
      const pos = entity.hexPosition!.coordinate;
      if (pos.q === coordinate.q && pos.r === coordinate.r && pos.s === coordinate.s) {
        entities.push(entity);
      }
    }
    
    // Check buildings
    for (const entity of buildings) {
      const pos = entity.hexPosition!.coordinate;
      if (pos.q === coordinate.q && pos.r === coordinate.r && pos.s === coordinate.s) {
        entities.push(entity);
      }
    }
    
    return entities;
  }
} 