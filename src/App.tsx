import { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCcw, 
  Info, 
  CheckCircle2,
  TrainFront,
  Navigation,
  AlertCircle,
  ChevronRight,
  Map as MapIcon,
  Palette,
  ZoomIn,
  ZoomOut,
  Maximize
} from 'lucide-react';
import { ALL_MAPS, type City, type Route, type MapData } from './data';

const PLAYER_COLORS = [
  { name: 'Red', hex: '#ef4444', bg: 'bg-red-500' },
  { name: 'Blue', hex: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Green', hex: '#22c55e', bg: 'bg-green-500' },
  { name: 'Yellow', hex: '#eab308', bg: 'bg-yellow-500' },
  { name: 'Black', hex: '#18181b', bg: 'bg-zinc-900' },
];

const ROUTE_COLORS: Record<string, string> = {
  gray: '#94a3b8',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  pink: '#ec4899',
  orange: '#f97316',
  white: '#f8fafc',
  black: '#18181b',
};

// Dijkstra's Algorithm for shortest path
function findShortestPath(cities: City[], routes: Route[], startCityId: string, endCityId: string) {
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const queue: string[] = [];

  cities.forEach(city => {
    distances[city.id] = Infinity;
    previous[city.id] = null;
    queue.push(city.id);
  });

  distances[startCityId] = 0;

  while (queue.length > 0) {
    queue.sort((a, b) => distances[a] - distances[b]);
    const current = queue.shift()!;

    if (current === endCityId) break;
    if (distances[current] === Infinity) break;

    const neighbors = routes.filter(r => r.cities.includes(current));
    neighbors.forEach(route => {
      const neighborId = route.cities.find(id => id !== current)!;
      const alt = distances[current] + route.length;
      if (alt < distances[neighborId]) {
        distances[neighborId] = alt;
        previous[neighborId] = current;
      }
    });
  }

  const path: string[] = [];
  let curr: string | null = endCityId;
  while (curr) {
    path.unshift(curr);
    curr = previous[curr];
  }

  return path.length > 1 ? path : null;
}

export default function App() {
  const [selectedMap, setSelectedMap] = useState<MapData | null>(null);
  const [selectedPlayerColor, setSelectedPlayerColor] = useState(PLAYER_COLORS[0]);
  const [claimedRoutes, setClaimedRoutes] = useState<Record<string, string>>({});
  const [showInfo, setShowInfo] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isMapGrayscale, setIsMapGrayscale] = useState(false);
  
  // Zoom/Pan state
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pathfinding state
  const [startCity, setStartCity] = useState<string>('');
  const [endCity, setEndCity] = useState<string>('');

  const sortedCities = useMemo(() => {
    if (!selectedMap) return [];
    return [...selectedMap.cities].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedMap]);

  const handleRouteClick = (routeId: string) => {
    setClaimedRoutes(prev => {
      const next = { ...prev };
      if (next[routeId] === selectedPlayerColor.hex) {
        delete next[routeId];
      } else {
        next[routeId] = selectedPlayerColor.hex;
      }
      return next;
    });
  };

  const resetMap = () => {
    setClaimedRoutes({});
    setShowResetConfirm(false);
    setStartCity('');
    setEndCity('');
  };

  const getCityById = (id: string) => selectedMap?.cities.find(c => c.id === id);

  const shortestPath = useMemo(() => {
    if (selectedMap && startCity && endCity && startCity !== endCity) {
      return findShortestPath(selectedMap.cities, selectedMap.routes, startCity, endCity);
    }
    return null;
  }, [selectedMap, startCity, endCity]);

  const renderRouteSegments = useCallback((route: Route, cityA: City, cityB: City, isClaimed: string | undefined, isPath: boolean) => {
    const dx = cityB.x - cityA.x;
    const dy = cityB.y - cityA.y;
    const totalLen = Math.sqrt(dx * dx + dy * dy);
    
    let offsetX = 0;
    let offsetY = 0;
    const OFFSET_VAL = 10; // Increased from 7 for better separation
    if (route.double) {
      offsetX = (-dy / totalLen) * OFFSET_VAL;
      offsetY = (dx / totalLen) * OFFSET_VAL;
    } else {
      const hasDouble = selectedMap?.routes.some(r => 
        r.id !== route.id && 
        ((r.cities[0] === route.cities[0] && r.cities[1] === route.cities[1]) ||
         (r.cities[0] === route.cities[1] && r.cities[1] === route.cities[0]))
      );
      if (hasDouble) {
        offsetX = (dy / totalLen) * OFFSET_VAL;
        offsetY = (-dx / totalLen) * OFFSET_VAL;
      }
    }

    const segments = [];
    const gap = 2;

    for (let i = 0; i < route.length; i++) {
      const startRatio = i / route.length;
      const endRatio = (i + 1) / route.length;
      
      const x1 = cityA.x + dx * startRatio + offsetX;
      const y1 = cityA.y + dy * startRatio + offsetY;
      const x2 = cityA.x + dx * endRatio + offsetX;
      const y2 = cityA.y + dy * endRatio + offsetY;

      const angle = Math.atan2(dy, dx);
      const gx = Math.cos(angle) * gap;
      const gy = Math.sin(angle) * gap;

      const baseColor = isMapGrayscale ? ROUTE_COLORS.gray : ROUTE_COLORS[route.color];

      segments.push(
        <g key={`${route.id}-seg-${i}`}>
          {/* Segment Background/Shadow for depth */}
          <line
            x1={x1 + gx}
            y1={y1 + gy}
            x2={x2 - gx}
            y2={y2 - gy}
            stroke="rgba(0,0,0,0.2)"
            strokeWidth={isPath || isClaimed ? "12" : "9"}
            strokeLinecap="round"
          />
          {/* Main Segment */}
          <line
            x1={x1 + gx}
            y1={y1 + gy}
            x2={x2 - gx}
            y2={y2 - gy}
            stroke={isClaimed || (isPath ? '#facc15' : baseColor)}
            strokeWidth={isPath || isClaimed ? "10" : "7"}
            strokeLinecap="round"
            className="transition-all duration-300"
            style={{ 
              filter: isClaimed ? 'drop-shadow(0 0 3px rgba(0,0,0,0.3))' : isPath ? 'drop-shadow(0 0 8px #facc15)' : 'none',
            }}
          />
          {/* Inner Detail for "Car" look */}
          <line
            x1={x1 + gx * 2}
            y1={y1 + gy * 2}
            x2={x2 - gx * 2}
            y2={y2 - gy * 2}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2"
            strokeLinecap="round"
            pointerEvents="none"
          />
        </g>
      );
    }

    return (
      <g 
        key={route.id} 
        className="cursor-pointer group"
        onClick={() => handleRouteClick(route.id)}
      >
        {/* Hit area - significantly larger for easier mobile clicking */}
        <line
          x1={cityA.x + offsetX}
          y1={cityA.y + offsetY}
          x2={cityB.x + offsetX}
          y2={cityB.y + offsetY}
          stroke="transparent"
          strokeWidth="30" 
        />
        {segments}
        {route.isTunnel && (
          <line
            x1={cityA.x + offsetX}
            y1={cityA.y + offsetY}
            x2={cityB.x + offsetX}
            y2={cityB.y + offsetY}
            stroke="black"
            strokeWidth="10"
            strokeDasharray="2,4"
            strokeOpacity="0.2"
            pointerEvents="none"
          />
        )}
        <line
          x1={cityA.x + offsetX}
          y1={cityA.y + offsetY}
          x2={cityB.x + offsetX}
          y2={cityB.y + offsetY}
          stroke={selectedPlayerColor.hex}
          strokeWidth="12"
          strokeOpacity="0"
          className="group-hover:stroke-opacity-20 transition-all duration-200"
        />
      </g>
    );
  }, [claimedRoutes, selectedPlayerColor, selectedMap, isMapGrayscale]);

  const renderRoutes = useMemo(() => {
    if (!selectedMap) return null;
    return selectedMap.routes.map(route => {
      const cityA = getCityById(route.cities[0]);
      const cityB = getCityById(route.cities[1]);
      if (!cityA || !cityB) return null;

      const isClaimed = claimedRoutes[route.id];
      let isPath = false;
      if (shortestPath) {
        for (let i = 0; i < shortestPath.length - 1; i++) {
          const p1 = shortestPath[i];
          const p2 = shortestPath[i+1];
          if ((route.cities[0] === p1 && route.cities[1] === p2) || 
              (route.cities[0] === p2 && route.cities[1] === p1)) {
            isPath = true;
            break;
          }
        }
      }

      return renderRouteSegments(route, cityA, cityB, isClaimed, isPath);
    });
  }, [claimedRoutes, selectedPlayerColor, shortestPath, renderRouteSegments, selectedMap]);

  if (!selectedMap) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center space-y-2">
            <div className="bg-stone-900 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <TrainFront className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-stone-900">Ticket to Ride</h1>
            <p className="text-stone-500 font-medium uppercase tracking-widest text-sm">Select Your Map Version</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ALL_MAPS.map(map => (
              <button
                key={map.id}
                onClick={() => setSelectedMap(map)}
                className="group relative bg-white p-8 rounded-3xl border border-stone-200 shadow-sm hover:shadow-xl hover:border-stone-400 transition-all text-left overflow-hidden active:scale-[0.98]"
              >
                <div className="relative z-10 space-y-4">
                  <div className="bg-stone-100 w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-stone-900 group-hover:text-white transition-colors">
                    <MapIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-stone-900">{map.name}</h2>
                    <p className="text-stone-500 text-sm mt-1">Interactive board with {map.cities.length} cities and {map.routes.length} routes.</p>
                  </div>
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-sm pt-2">
                    Start Planning <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <TrainFront className="w-48 h-48 rotate-12" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-stone-100 text-stone-900 font-sans selection:bg-stone-200 flex flex-row overflow-hidden relative">
      {/* Floating Left Controls: Player Selection (Middle Left) */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-5 z-50">
        {PLAYER_COLORS.map(color => (
          <button
            key={color.name}
            onClick={() => setSelectedPlayerColor(color)}
            className={`relative w-10 h-10 rounded-full ${color.bg} shadow-lg transition-all active:scale-90 ${
              selectedPlayerColor.name === color.name 
                ? 'ring-4 ring-stone-900 ring-offset-2 scale-110' 
                : 'opacity-60 hover:opacity-100'
            }`}
            title={color.name}
          >
            {selectedPlayerColor.name === color.name && (
              <div className="absolute -right-1 -top-1 bg-white rounded-full p-0.5 shadow-sm">
                <CheckCircle2 className="w-3 h-3 text-stone-900" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Floating Bottom Left Actions */}
      <div className="absolute left-6 bottom-8 flex flex-col gap-4 z-50">
        <button 
          onClick={() => setShowInfo(true)}
          className="p-3 bg-white/80 backdrop-blur-md hover:bg-white rounded-2xl transition-all text-stone-400 hover:text-stone-900 shadow-xl border border-stone-200"
          title="Instructions & Settings"
        >
          <Info className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setShowResetConfirm(true)}
          className="p-3 bg-white/80 backdrop-blur-md hover:bg-red-50 rounded-2xl transition-all text-red-400 shadow-xl border border-stone-200"
          title="Reset Map"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Floating Route Finder (Top Right) */}
        <div className="absolute top-6 right-6 z-40">
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-4 bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-stone-200 shadow-xl">
              <div className="flex items-center gap-2 text-stone-900">
                <button 
                  onClick={() => { setStartCity(''); setEndCity(''); }}
                  className="p-1 hover:bg-stone-200 rounded-md transition-colors"
                  title="Clear Route"
                >
                  <Navigation className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={startCity}
                  onChange={(e) => setStartCity(e.target.value)}
                  className="bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 ring-stone-900 max-w-[120px]"
                >
                  <option value="">Start</option>
                  {sortedCities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <span className="text-stone-300">→</span>
                <select 
                  value={endCity}
                  onChange={(e) => setEndCity(e.target.value)}
                  className="bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 ring-stone-900 max-w-[120px]"
                >
                  <option value="">End</option>
                  {sortedCities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Map Controls (Bottom Right) */}
        <div className="absolute bottom-8 right-8 z-40 flex flex-col gap-3">
          <div className="flex flex-col bg-white/80 backdrop-blur-md rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
            <button 
              onClick={() => setScale(s => Math.min(s + 0.2, 3))}
              className="p-3 hover:bg-white text-stone-600 transition-colors border-b border-stone-100"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setScale(s => Math.max(s - 0.2, 0.5))}
              className="p-3 hover:bg-white text-stone-600 transition-colors border-b border-stone-100"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button 
              onClick={() => { setScale(1); }}
              className="p-3 hover:bg-white text-stone-600 transition-colors"
              title="Reset Zoom"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
          
          <button 
            onClick={() => setIsMapGrayscale(!isMapGrayscale)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${
              isMapGrayscale ? 'bg-stone-900 text-white' : 'bg-white text-stone-400 hover:text-stone-900'
            } border border-stone-200`}
            title="Toggle Map Colors"
          >
            <Palette className="w-7 h-7" />
          </button>
        </div>

        {/* Map Canvas */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-hidden bg-[#fdfaf5] relative cursor-grab active:cursor-grabbing"
        >
          <motion.div 
            drag
            dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
            dragElastic={0.1}
            animate={{ scale }}
            className="w-full h-full flex items-center justify-center"
          >
            <svg 
              viewBox={selectedMap.viewBox} 
              className="w-full h-auto min-w-[800px] drop-shadow-2xl mx-auto"
              style={{ filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.05))' }}
            >
            {renderRoutes}

            {selectedMap.cities.map(city => {
              const isStart = startCity === city.id;
              const isEnd = endCity === city.id;
              const isPartOfPath = shortestPath?.includes(city.id);

              return (
                <g 
                  key={city.id} 
                  className="group/city cursor-pointer"
                  onClick={() => {
                    if (!startCity || (startCity && endCity)) {
                      setStartCity(city.id);
                      setEndCity('');
                    } else {
                      setEndCity(city.id);
                    }
                  }}
                >
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r={isStart || isEnd ? "14" : "9"}
                    fill={isStart ? "#ef4444" : isEnd ? "#3b82f6" : isPartOfPath ? "#facc15" : "white"}
                    stroke="#18181b"
                    strokeWidth="2.5"
                    className="transition-all duration-300 group-hover/city:r-12"
                  />
                  <text
                    x={city.x}
                    y={city.y + 32}
                    textAnchor="middle"
                    className={`text-xs font-black pointer-events-none select-none uppercase tracking-tighter ${
                      isStart || isEnd || isPartOfPath ? 'fill-stone-900' : 'fill-stone-600'
                    }`}
                    style={{ textShadow: '0 1px 3px white, 0 0 5px white' }}
                  >
                    {city.name}
                  </text>
                  {(isStart || isEnd || isPartOfPath) && (
                    <motion.circle
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: isPartOfPath && !isStart && !isEnd ? 1.2 : 1.5, opacity: isPartOfPath ? 0.4 : 0.3 }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      cx={city.x}
                      cy={city.y}
                      r={isPartOfPath ? "14" : "18"}
                      fill={isStart ? "#ef4444" : isEnd ? "#3b82f6" : "#facc15"}
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}
          </svg>
          </motion.div>
        </div>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-8"
          >
            <div className="max-w-md text-white text-center space-y-6">
              <h2 className="text-2xl font-bold">How to use the Planner</h2>
              <div className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-2">
                Active Map: {selectedMap.name}
              </div>
              <div className="space-y-4 text-stone-300 text-sm leading-relaxed">
                <p>1. Select your player color from the <strong>left sidebar</strong>.</p>
                <p>2. Click on any route on the map to claim it.</p>
                <p>3. Use the <strong>Route Finder</strong> (top right) to find the shortest path.</p>
                <p>4. The shortest path will be highlighted in yellow with a glow effect.</p>
              </div>
              <div className="pt-4 flex flex-col gap-3">
                <button 
                  onClick={() => setShowInfo(false)}
                  className="w-full py-3 bg-white text-stone-900 rounded-xl font-bold hover:bg-stone-100 transition-all active:scale-95"
                >
                  Got it!
                </button>
                <button 
                  onClick={() => {
                    setSelectedMap(null);
                    setShowInfo(false);
                  }}
                  className="w-full py-3 bg-stone-800 text-stone-400 rounded-xl font-bold hover:bg-stone-700 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <MapIcon className="w-4 h-4" />
                  Change Map Version
                </button>
              </div>
            </div>
          </motion.div>
        )}


        {showResetConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-stone-900">Clear Map?</h3>
                <p className="text-stone-500 text-sm mt-2">This will remove all claimed routes and reset the route finder.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={resetMap}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
