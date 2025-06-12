# ECS Hex Grid Game

A hexagonal grid-based game template built with **Remix**, **MapLibre GL JS**, and **Miniplex ECS**.

## Features

- 🗺️ **Interactive Hex Grid Map** - Hexagonal grid overlay on MapLibre maps
- ⚡ **Entity Component System** - Powered by Miniplex for efficient game logic
- 🎮 **Turn-based Gameplay** - Select hexes, spawn units, and manage turns
- 🌍 **Real-world Coordinates** - Hex grid positioned on actual geographic coordinates
- 🎨 **Visual Terrain Types** - Different colors for plains, forests, water, and mountains
- 📱 **Mobile-First Design** - Gesture-based navigation with pinch-to-zoom
- 🆓 **No API Keys Required** - Uses free MapLibre GL JS

## Technologies Used

- **[Remix](https://remix.run/)** - Full-stack React framework
- **[MapLibre GL JS](https://maplibre.org/)** - Free & open-source interactive maps
- **[Miniplex](https://github.com/hmans/miniplex)** - Entity Component System (ECS)
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd ecs-hexgrid
bun install  # or npm install
```

### 2. Ready to Use! ✨

No configuration needed! The game runs in high-performance canvas mode by default. You can optionally enable real maps by updating the map style in `app/lib/config.ts`:

```typescript
export const gameConfig = {
  map: {
    defaultStyle: '', // Empty = Canvas mode (default)
    // Or use free map styles:
    // defaultStyle: 'https://demotiles.maplibre.org/style.json',
    // defaultStyle: 'https://tiles.openfreemap.org/styles/liberty',
    // ... other settings
  },
  // ...
};
```

### 3. Run Development Server

```bash
bun run dev  # or npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to see your game!

## How to Play

1. **Select Hexes** - Click on hex tiles to select them
2. **Spawn Units** - Use the "Spawn Unit" button to place warriors
3. **Terrain Types** - Different colors represent different terrain:
   - 🟢 Green: Plains (easy movement)
   - 🟤 Brown: Mountains (difficult movement)
   - 🌲 Dark Green: Forests (moderate movement)
   - 🌊 Blue: Water (impassable)
4. **Turn Management** - Use "Next Turn" to reset unit movement
5. **Reset Game** - Start over with a new hex grid

## Project Structure

```
app/
├── components/
│   └── HexGridGame.tsx      # Main game component
├── lib/
│   ├── config.ts            # Game configuration
│   ├── ecs.ts              # Entity Component System setup
│   └── hexgrid.ts          # Hexagonal grid utilities
├── routes/
│   └── _index.tsx          # Main route
└── root.tsx                # App root
```

## Key Components

### Hexgrid System (`app/lib/hexgrid.ts`)
- Coordinate system for hexagonal grids
- Pixel-to-hex conversion
- Grid generation algorithms
- Neighbor finding and distance calculations

### ECS System (`app/lib/ecs.ts`)
- Entity definitions with components
- Systems for game logic
- Queries for efficient data access
- Unit spawning and movement

### Game Component (`app/components/HexGridGame.tsx`)
- Mapbox GL JS integration
- React hooks for state management
- Event handling for user interaction
- Real-time rendering of game entities

## Customization

### Adding New Unit Types

Edit `app/lib/config.ts`:

```typescript
unitTypes: {
  mage: {
    health: 60,
    movementRange: 1,
    color: '#9944FF',
  },
  // ... other units
}
```

### Modifying Terrain

Update terrain types in the same config file:

```typescript
terrainTypes: {
  desert: { color: '#F4A460', movementCost: 2 },
  // ... other terrains
}
```

### Changing Map Settings

Adjust hex grid size and map dimensions:

```typescript
hexGrid: {
  size: 1000,     // Smaller hexes
  mapWidth: 25000, // Smaller map
  mapHeight: 25000,
}
```

## Deployment

### Build for Production

```bash
bun run build  # or npm run build
```

### Deploy

The built app can be deployed to any Node.js hosting platform:

- **Vercel** - `vercel`
- **Netlify** - `netlify deploy`
- **Railway** - `railway deploy`
- **Render** - Connect your Git repo

No environment variables needed - MapLibre works out of the box!

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Resources

- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [Miniplex ECS Documentation](https://github.com/hmans/miniplex)
- [Remix Documentation](https://remix.run/docs)
- [Hexagonal Grid Guide](https://www.redblobgames.com/grids/hexagons/)
