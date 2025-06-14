import { useEffect, useRef, useState, useCallback } from "react";
import type { Map } from "maplibre-gl";
import { generateHexGrid, pixelToHex, hexToPixel, hex, type HexCoordinate, type HexTile } from "~/lib/hexgrid";
import { gameConfig } from "~/lib/config";

// Import MapLibre CSS
import "maplibre-gl/dist/maplibre-gl.css";

interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

interface MapTile {
  q: number;
  r: number;
  terrain: 'grass' | 'mountain' | 'forest' | 'water';
}

interface ExtendedHexTile extends HexTile {
  terrain: 'grass' | 'mountain' | 'forest' | 'water';
}

export default function HexGridGame() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<Map | null>(null);
  
  const [camera, setCamera] = useState<CameraState>({
    x: 0, // Start at center of hex grid (0,0) in meter coordinates
    y: 0,
    zoom: gameConfig.map.initialZoom
  });
  
  const [selectedHex, setSelectedHex] = useState<HexCoordinate | null>(null);
  const [mapMode, setMapMode] = useState<'canvas' | 'maplibre'>('canvas');
  const [hexTiles, setHexTiles] = useState<ExtendedHexTile[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  const [currentCenterHex, setCurrentCenterHex] = useState<HexCoordinate>({ q: 0, r: 0, s: 0 });
  const [isLoadingTiles, setIsLoadingTiles] = useState(false);
  const [allMapData, setAllMapData] = useState<globalThis.Map<string, MapTile> | null>(null);
  const [isLoadingMapData, setIsLoadingMapData] = useState(true);
  
  // Touch gesture state
  const [gestureState, setGestureState] = useState({
    isDragging: false,
    isPinching: false,
    lastTouchDistance: 0,
    lastPosition: { x: 0, y: 0 },
    dragThreshold: 5,
    hasMoved: false,
    startTime: 0
  });

  // Terrain colors
  const getTerrainColor = (terrain: string, isSelected: boolean = false) => {
    if (isSelected) return '#fbbf24';
    
    switch (terrain) {
      case 'water': return '#3b82f6';
      case 'grass': return '#22c55e';
      case 'forest': return '#16a34a';
      case 'mountain': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const getTerrainBorderColor = (terrain: string, isSelected: boolean = false) => {
    if (isSelected) return '#f59e0b';
    
    switch (terrain) {
      case 'water': return '#1e40af';
      case 'grass': return '#15803d';
      case 'forest': return '#14532d';
      case 'mountain': return '#374151';
      default: return '#6b7280';
    }
  };

  // Load all map data once
  const loadMapData = useCallback(async () => {
    setIsLoadingMapData(true);
    
    try {
      console.log('Loading map data...');
      const response = await fetch('/map.json');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch map data: ${response.status}`);
      }
      
      const mapData = await response.json();
      
      // Create a map for quick lookup
      const tileMap = new globalThis.Map<string, MapTile>();
      mapData.tiles.forEach((tile: MapTile) => {
        tileMap.set(`${tile.q},${tile.r}`, tile);
      });
      
      console.log(`Loaded ${mapData.tiles.length} total tiles from map data`);
      setAllMapData(tileMap);
      
    } catch (error) {
      console.error('Error loading map data:', error);
    } finally {
      setIsLoadingMapData(false);
    }
  }, []);

  // Generate tiles that are visible on screen
  const generateVisibleTiles = useCallback((cameraX: number, cameraY: number, zoom: number) => {
    if (!allMapData) return;
    
    setIsLoadingTiles(true);
    
    try {
      // Get current screen dimensions
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const { width, height } = canvas;
      const scale = Math.pow(2, zoom - 1) / 100000;
      
      // Calculate viewport bounds in world coordinates with padding for smooth scrolling
      const paddingFactor = 1.5; // Load 50% more tiles around viewport
      const viewWidthInMeters = (width / scale) * paddingFactor;
      const viewHeightInMeters = (height / scale) * paddingFactor;
      
      const viewLeft = cameraX - viewWidthInMeters / 2;
      const viewRight = cameraX + viewWidthInMeters / 2;
      const viewTop = cameraY + viewHeightInMeters / 2;
      const viewBottom = cameraY - viewHeightInMeters / 2;
      
      // Convert world bounds to hex coordinate bounds
      const hexSize = gameConfig.hexGrid.size;
      
      // Convert viewport corners to hex coordinates
      const minQ = Math.floor((2/3 * viewLeft) / hexSize) - 2;
      const maxQ = Math.ceil((2/3 * viewRight) / hexSize) + 2;
      const minR = Math.floor((-1/3 * viewRight + Math.sqrt(3)/3 * viewBottom) / hexSize) - 2;
      const maxR = Math.ceil((-1/3 * viewLeft + Math.sqrt(3)/3 * viewTop) / hexSize) + 2;
      
      console.log(`Loading tiles for viewport: q(${minQ} to ${maxQ}), r(${minR} to ${maxR})`);
      
      // Generate hex tiles for the visible area
      const tiles: ExtendedHexTile[] = [];
      const hexesToLoad: HexCoordinate[] = [];
      
      for (let q = minQ; q <= maxQ; q++) {
        for (let r = minR; r <= maxR; r++) {
          const s = -q - r;
          const coordinate = { q, r, s };
          
          // Convert hex to world position to check if it's actually in viewport
          const worldX = hexSize * (3/2 * q);
          const worldY = hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
          
          // Check if hex center is roughly within the padded viewport
          if (worldX >= viewLeft && worldX <= viewRight && 
              worldY >= viewBottom && worldY <= viewTop) {
            hexesToLoad.push(coordinate);
          }
        }
      }
      
      hexesToLoad.forEach(coordinate => {
        const tileKey = `${coordinate.q},${coordinate.r}`;
        const mapTile = allMapData.get(tileKey);
        
        // If tile doesn't exist in map data, skip it
        if (!mapTile) return;
        
        // Convert hex coordinate to pixel position in meters (flat-top orientation)
        const x = hexSize * (3/2 * coordinate.q);
        const y = hexSize * (Math.sqrt(3)/2 * coordinate.q + Math.sqrt(3) * coordinate.r);
        
        const tile: ExtendedHexTile = {
          coordinate,
          center: { x, y },
          vertices: [], // We'll calculate this when rendering
          id: `hex-${coordinate.q}-${coordinate.r}`,
          terrain: mapTile.terrain
        };
        
        tiles.push(tile);
      });
      
      console.log(`Generated ${tiles.length} visible tiles at zoom ${zoom.toFixed(1)}, viewport: ${Math.round(viewWidthInMeters/1000)}x${Math.round(viewHeightInMeters/1000)}km`);
      setHexTiles(tiles);
      
    } catch (error) {
      console.error('Error generating visible tiles:', error);
    } finally {
      setIsLoadingTiles(false);
    }
  }, [allMapData]);



  // Calculate center hex from camera position
  const getCenterHexFromCamera = useCallback((cameraX: number, cameraY: number): HexCoordinate => {
    const hexSize = gameConfig.hexGrid.size;
    const q = Math.round((2/3 * cameraX) / hexSize);
    const r = Math.round((-1/3 * cameraX + Math.sqrt(3)/3 * cameraY) / hexSize);
    const s = -q - r;
    
    return { q, r, s };
  }, []);

  // Load map data once on mount
  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  // Load initial tiles when map data is ready
  useEffect(() => {
    if (allMapData && !isLoadingMapData) {
      const initialCenter = getCenterHexFromCamera(camera.x, camera.y);
      setCurrentCenterHex(initialCenter);
      generateVisibleTiles(camera.x, camera.y, camera.zoom);
    }
  }, [allMapData, isLoadingMapData, camera.x, camera.y, camera.zoom, getCenterHexFromCamera, generateVisibleTiles]);

  // Update tiles when camera moves or zoom changes significantly
  useEffect(() => {
    if (!allMapData || isLoadingMapData) return;
    
    const newCenterHex = getCenterHexFromCamera(camera.x, camera.y);
    
    // Check if center hex has changed significantly OR zoom changed
    const distance = (Math.abs(newCenterHex.q - currentCenterHex.q) + 
                     Math.abs(newCenterHex.r - currentCenterHex.r) + 
                     Math.abs(newCenterHex.s - currentCenterHex.s)) / 2;
    
    // Reload tiles if moved more than 2 hexes OR zoom changed (more sensitive for viewport-based loading)
    if (distance >= 2) {
      console.log(`Camera moved significantly, reloading visible tiles`);
      setCurrentCenterHex(newCenterHex);
      generateVisibleTiles(camera.x, camera.y, camera.zoom);
    }
  }, [camera.x, camera.y, camera.zoom, currentCenterHex, allMapData, isLoadingMapData, getCenterHexFromCamera, generateVisibleTiles]);

  // Handle hex click
  const handleHexClick = (hexCoord: HexCoordinate) => {
    setSelectedHex(hexCoord);
    focusOnHex(hexCoord);
  };

  // Focus camera on hex
  const focusOnHex = (hexCoord: HexCoordinate) => {
    // Calculate position in meter coordinates using the same formula as hex generation
    const hexSize = gameConfig.hexGrid.size;
    const targetX = hexSize * (3/2 * hexCoord.q);
    const targetY = hexSize * (Math.sqrt(3)/2 * hexCoord.q + Math.sqrt(3) * hexCoord.r);
    const targetZoom = Math.max(camera.zoom, 12);

    // Canvas mode - smooth camera animation
    const startCamera = { ...camera };
    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out

      setCamera({
        x: startCamera.x + (targetX - startCamera.x) * eased,
        y: startCamera.y + (targetY - startCamera.y) * eased,
        zoom: startCamera.zoom + (targetZoom - startCamera.zoom) * eased
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  };

  // Canvas rendering
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Calculate viewport bounds for culling
      const scale = Math.pow(2, camera.zoom - 1) / 100000; // Scale factor to convert meters to pixels
      const viewWidthInMeters = width / scale;
      const viewHeightInMeters = height / scale;
      const viewLeft = camera.x - viewWidthInMeters / 2;
      const viewRight = camera.x + viewWidthInMeters / 2;
      const viewTop = camera.y + viewHeightInMeters / 2;
      const viewBottom = camera.y - viewHeightInMeters / 2;

      // Render visible hexes
      let visibleCount = 0;
      hexTiles.forEach(tile => {
        const worldPos = tile.center;
        
        // Cull tiles outside viewport (with generous padding)
        const padding = gameConfig.hexGrid.size * 2; // Increased padding
        if (worldPos.x < viewLeft - padding || worldPos.x > viewRight + padding ||
            worldPos.y < viewBottom - padding || worldPos.y > viewTop + padding) {
          return;
        }

        const screenX = width / 2 + (worldPos.x - camera.x) * scale;
        const screenY = height / 2 - (worldPos.y - camera.y) * scale;

        const pixelSize = gameConfig.hexGrid.size * scale;

        // Skip if too small to see or off screen
        if (pixelSize < 0.5 || screenX < -pixelSize || screenX > width + pixelSize || 
            screenY < -pixelSize || screenY > height + pixelSize) return;

        visibleCount++;
        ctx.save();
        ctx.translate(screenX, screenY);

        // Draw hex
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const x = Math.cos(angle) * pixelSize;
          const y = Math.sin(angle) * pixelSize;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        // Fill color based on terrain
        const isSelected = selectedHex && 
          selectedHex.q === tile.coordinate.q && 
          selectedHex.r === tile.coordinate.r && 
          selectedHex.s === tile.coordinate.s;

        ctx.fillStyle = getTerrainColor(tile.terrain, isSelected || false);
        ctx.fill();

        // Draw border
        ctx.strokeStyle = getTerrainBorderColor(tile.terrain, isSelected || false);
        ctx.lineWidth = Math.max(1, pixelSize / 20);
        ctx.stroke();

        ctx.restore();
      });

      console.log(`Rendered ${visibleCount}/${hexTiles.length} tiles at zoom ${camera.zoom.toFixed(1)}, camera (${camera.x.toFixed(0)}, ${camera.y.toFixed(0)}), scale: ${scale.toFixed(6)}, viewSize: ${viewWidthInMeters.toFixed(0)}x${viewHeightInMeters.toFixed(0)}m`);
    };

    render();
  }, [camera, selectedHex, hexTiles]);

  // Handle canvas interactions
  const handleCanvasInteraction = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const scale = Math.pow(2, camera.zoom - 1) / 100000;
    const worldX = camera.x + (x - canvas.width / 2) / scale;
    const worldY = camera.y - (y - canvas.height / 2) / scale;

    // Convert world coordinates back to hex coordinates using our hex math
    const hexSize = gameConfig.hexGrid.size;
    const q = (2/3 * worldX) / hexSize;
    const r = (-1/3 * worldX + Math.sqrt(3)/3 * worldY) / hexSize;
    
    // Round to nearest hex
    const hexCoord = {
      q: Math.round(q),
      r: Math.round(r),
      s: Math.round(-q - r)
    };
    
    // Check if this hex coordinate exists in our generated tiles
    const hexExists = hexTiles.some(tile => 
      tile.coordinate.q === hexCoord.q && 
      tile.coordinate.r === hexCoord.r && 
      tile.coordinate.s === hexCoord.s
    );
    
    // Only handle click if hex exists (don't focus camera on empty areas)
    if (hexExists) {
      handleHexClick(hexCoord);
    }
  };

  // Mouse handlers for canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    setGestureState(prev => ({
      ...prev,
      isDragging: true,
      lastPosition: { x: e.clientX, y: e.clientY },
      hasMoved: false,
      startTime: Date.now()
    }));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!gestureState.isDragging) return;

    const dx = e.clientX - gestureState.lastPosition.x;
    const dy = e.clientY - gestureState.lastPosition.y;
    
    if (Math.abs(dx) > gestureState.dragThreshold || Math.abs(dy) > gestureState.dragThreshold) {
      setGestureState(prev => ({ ...prev, hasMoved: true }));
      
      const scale = Math.pow(2, camera.zoom - 1) / 100000;

      // Update camera position without boundary restrictions
      setCamera(prev => ({
        ...prev,
        x: prev.x - dx / scale,
        y: prev.y + dy / scale
      }));

      setGestureState(prev => ({
        ...prev,
        lastPosition: { x: e.clientX, y: e.clientY }
      }));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!gestureState.hasMoved && Date.now() - gestureState.startTime < 300) {
      handleCanvasInteraction(e.clientX, e.clientY);
    }
    
    setGestureState(prev => ({
      ...prev,
      isDragging: false,
      hasMoved: false
    }));
  };

  // Touch handlers for canvas
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single-finger touch begins; allow dragging only if not currently pinching
      if (gestureState.isPinching) return;
      const touch = e.touches[0];
      setGestureState(prev => ({
        ...prev,
        isDragging: true,
        isPinching: false,
        lastPosition: { x: touch.clientX, y: touch.clientY },
        hasMoved: false,
        startTime: Date.now()
      }));
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      setGestureState(prev => ({
        ...prev,
        isDragging: false,
        isPinching: true,
        lastTouchDistance: distance
      }));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && gestureState.isDragging && !gestureState.isPinching) {
      const touch = e.touches[0];
      const dx = touch.clientX - gestureState.lastPosition.x;
      const dy = touch.clientY - gestureState.lastPosition.y;
      
      if (Math.abs(dx) > gestureState.dragThreshold || Math.abs(dy) > gestureState.dragThreshold) {
        setGestureState(prev => ({ ...prev, hasMoved: true }));
        
        // Use same scale calculation as mouse drag for consistency
        const scale = Math.pow(2, camera.zoom - 1) / 100000; // pixels per meter

        // Update camera position without boundary restrictions
        setCamera(prev => ({
          ...prev,
          x: prev.x - dx / scale,
          y: prev.y + dy / scale
        }));

        setGestureState(prev => ({
          ...prev,
          lastPosition: { x: touch.clientX, y: touch.clientY }
        }));
      }
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      if (gestureState.lastTouchDistance > 0) {
        const zoomFactor = distance / gestureState.lastTouchDistance;
        setCamera(prev => {
          const newZoom = prev.zoom + Math.log2(zoomFactor);
          return {
            ...prev,
            zoom: Math.max(gameConfig.map.minZoom, 
                  Math.min(gameConfig.map.maxZoom, newZoom))
          };
        });
      }
      
      setGestureState(prev => ({
        ...prev,
        lastTouchDistance: distance,
        isPinching: true
      }));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      if (!gestureState.hasMoved && Date.now() - gestureState.startTime < 300) {
        const touch = e.changedTouches[0];
        handleCanvasInteraction(touch.clientX, touch.clientY);
      }
      
      setGestureState(prev => ({
        ...prev,
        isDragging: false,
        isPinching: false,
        hasMoved: false,
        lastTouchDistance: 0
      }));
    }
  };

  // Mouse wheel for zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const zoomDelta = -e.deltaY * 0.001;
    setCamera(prev => ({
      ...prev,
      zoom: Math.max(gameConfig.map.minZoom, 
            Math.min(gameConfig.map.maxZoom, prev.zoom + zoomDelta))
    }));
  };

  // Add wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = -e.deltaY * 0.001;
      setCamera(prev => ({
        ...prev,
        zoom: Math.max(gameConfig.map.minZoom, 
              Math.min(gameConfig.map.maxZoom, prev.zoom + zoomDelta))
      }));
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheelEvent);
  }, []);

  // Handle window resize to update canvas dimensions
  useEffect(() => {
    if (!canvasRef.current) return;

    let resizeTimeout: NodeJS.Timeout;

    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    const handleResize = () => {
      // Show resize overlay immediately
      setIsResizing(true);
      
      // Update canvas size
      updateCanvasSize();
      
      // Clear existing timeout
      clearTimeout(resizeTimeout);
      
      // Set a debounced timeout to hide overlay and trigger rerender
      resizeTimeout = setTimeout(() => {
        setIsResizing(false);
        // Reload tiles for new viewport size
        if (allMapData && !isLoadingMapData) {
          generateVisibleTiles(camera.x, camera.y, camera.zoom);
        }
      }, 300); // 300ms delay after resize stops
    };

    // Update on mount and when window resizes
    updateCanvasSize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const moveSpeed = 50000; // meters
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          setCamera(prev => ({ ...prev, y: prev.y + moveSpeed }));
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          setCamera(prev => ({ ...prev, y: prev.y - moveSpeed }));
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          setCamera(prev => ({ ...prev, x: prev.x - moveSpeed }));
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          setCamera(prev => ({ ...prev, x: prev.x + moveSpeed }));
          e.preventDefault();
          break;
        case '+':
        case '=':
          setCamera(prev => ({ 
            ...prev, 
            zoom: Math.min(gameConfig.map.maxZoom, prev.zoom + 0.5) 
          }));
          e.preventDefault();
          break;
        case '-':
          setCamera(prev => ({ 
            ...prev, 
            zoom: Math.max(gameConfig.map.minZoom, prev.zoom - 0.5) 
          }));
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to get focused tile data
  const focusedTile = selectedHex ? hexTiles.find(t => t.coordinate.q === selectedHex.q && t.coordinate.r === selectedHex.r && t.coordinate.s === selectedHex.s) : undefined;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        width={typeof window !== 'undefined' ? window.innerWidth : 1024}
        height={typeof window !== 'undefined' ? window.innerHeight : 768}
        className="w-full h-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setGestureState(prev => ({ ...prev, isDragging: false }))}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
      />
      
      {/* Focused tile overlay */}
      {focusedTile && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 bg-opacity-90 backdrop-blur-md rounded-lg shadow-lg px-4 py-3 min-w-[200px] z-40">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Hex Coordinates</h3>
          <p className="text-xs text-gray-700 dark:text-gray-300">q: {focusedTile.coordinate.q}, r: {focusedTile.coordinate.r}, s: {focusedTile.coordinate.s}</p>
          <p className="text-xs text-gray-700 dark:text-gray-300 capitalize">Terrain: {focusedTile.terrain}</p>
        </div>
      )}
      
      {/* Loading overlay */}
      {(isLoadingMapData || isLoadingTiles) && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 bg-opacity-90 backdrop-blur-md rounded-lg shadow-lg px-4 py-2 z-40">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-800 dark:text-gray-200">
              {isLoadingMapData ? 'Loading map data...' : 'Generating tiles...'}
            </span>
          </div>
        </div>
      )}
      
      {/* Resize overlay */}
      {isResizing && (
        <div 
          className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-white rounded-lg px-6 py-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-gray-800 font-medium">Adjusting map layout...</span>
            </div>
          </div>
        </div>
      )}
      

    </div>
  );
} 