import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
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
  const [hexTiles, setHexTiles] = useState<HexTile[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  
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

  // Generate hex tiles
  useEffect(() => {
    // Generate a simpler grid in meter coordinates centered at (0,0)
    const tiles: HexTile[] = [];
    const hexSize = gameConfig.hexGrid.size;
    
    // Create a much smaller grid for testing - let's say 20x20 hexes
    const gridRadius = 16;
    
    for (let q = -gridRadius; q <= gridRadius; q++) {
      for (let r = -gridRadius; r <= gridRadius; r++) {
        // Skip if too far from center (make a circular-ish grid)
        if (Math.abs(q) + Math.abs(r) + Math.abs(-q-r) > gridRadius * 2) continue;
        
        const coordinate = { q, r, s: -q - r };
        
        // Convert hex coordinate to pixel position in meters (flat-top orientation)
        const x = hexSize * (3/2 * q);
        const y = hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
        
        const tile: HexTile = {
          coordinate,
          center: { x, y },
          vertices: [], // We'll calculate this when rendering
          id: `hex-${q}-${r}`
        };
        
        tiles.push(tile);
      }
    }
    
    console.log(`Generated ${tiles.length} hex tiles`);
    console.log(`Sample tile centers:`, tiles.slice(0, 3).map(t => `(${t.center.x}, ${t.center.y})`));
    setHexTiles(tiles);
  }, []);

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

      // Calculate viewport bounds for culling (simplified meter-based system)
      const baseViewSize = 100000; // Base view size in meters at zoom level 1
      const viewSize = baseViewSize / Math.pow(2, camera.zoom - 1);
      const viewLeft = camera.x - viewSize / 2;
      const viewRight = camera.x + viewSize / 2;
      const viewTop = camera.y + viewSize / 2;
      const viewBottom = camera.y - viewSize / 2;



      // Render visible hexes
      let visibleCount = 0;
      hexTiles.forEach(tile => {
        const worldPos = tile.center;
        
        // Temporarily disable culling for debugging
        // const padding = gameConfig.hexGrid.size * 0.5;
        // if (worldPos.x < viewLeft - padding || worldPos.x > viewRight + padding ||
        //     worldPos.y < viewBottom - padding || worldPos.y > viewTop + padding) {
        //   return;
        // }

        const scale = Math.pow(2, camera.zoom - 1) / 100000; // Scale factor to convert meters to pixels
        const screenX = width / 2 + (worldPos.x - camera.x) * scale;
        const screenY = height / 2 - (worldPos.y - camera.y) * scale;

        const pixelSize = gameConfig.hexGrid.size * scale;

        // Skip if too small to see (reduced threshold for debugging)
        if (pixelSize < 0.1) return;

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

        if (isSelected) {
          ctx.fillStyle = '#fbbf24';
        } else {
          // Simple random terrain for demo
          const hash = (tile.coordinate.q * 31 + tile.coordinate.r * 37) % 100;
          ctx.fillStyle = hash < 20 ? '#3b82f6' : '#22c55e'; // 20% water, 80% land
        }
        ctx.fill();

        // Draw border
        ctx.strokeStyle = isSelected ? '#f59e0b' : '#374151';
        ctx.lineWidth = Math.max(1, pixelSize / 20);
        ctx.stroke();

        ctx.restore();
      });

      console.log(`Rendered ${visibleCount} tiles at zoom ${camera.zoom.toFixed(1)}, camera (${camera.x}, ${camera.y})`);
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
      
      // Define map boundaries
      const mapWidth = gameConfig.hexGrid.mapWidth;
      const mapHeight = gameConfig.hexGrid.mapHeight;

      // Update camera position with boundary checks
      setCamera(prev => ({
        ...prev,
        x: Math.max(-mapWidth / 3, Math.min(mapWidth / 3, prev.x - dx / scale)),
        y: Math.max(-mapHeight / 3, Math.min(mapHeight / 3, prev.y + dy / scale))
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
        
        // Define map boundaries
        const mapWidth = gameConfig.hexGrid.mapWidth;
        const mapHeight = gameConfig.hexGrid.mapHeight;

        // Update camera position with boundary checks
        setCamera(prev => ({
          ...prev,
          x: Math.max(-mapWidth / 3, Math.min(mapWidth / 3, prev.x - dx / scale)),
          y: Math.max(-mapHeight / 3, Math.min(mapHeight / 3, prev.y + dy / scale))
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
        // Force a rerender by updating camera state (triggers canvas redraw)
        setCamera(prev => ({ ...prev }));
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