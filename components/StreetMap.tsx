'use client';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GAME_TILE_PX, OSM_ZOOM } from '@/lib/osmTiles';
import { fetchAreaData, OsmWay, ROAD_WIDTHS_M, ROAD_IS_MAJOR } from '@/lib/overpassApi';
import { useGameStore } from '@/lib/store';

// ──────────────────────────────────────────────────────
//  STREET MAP — Mapa pós-apocalíptico em SVG
//  Geometria real via Overpass API + visual CSS/SVG
// ──────────────────────────────────────────────────────

interface Props {
  viewportX: number;
  viewportY: number;
  screenW: number;
  screenH: number;
  originTileX: number;
  originTileY: number;
  playerLat: number;
  playerLng: number;
}

/* ── Utils de coordenadas ── */
function latLngToWorld(lat: number, lon: number, originTileX: number, originTileY: number) {
  const n = Math.pow(2, OSM_ZOOM);
  const fracX = (lon + 180) / 360 * n;
  const latRad = lat * Math.PI / 180;
  const fracY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  return {
    x: (fracX - originTileX) * GAME_TILE_PX,
    y: (fracY - originTileY) * GAME_TILE_PX,
  };
}

function getPixelWidth(realMeters: number, lat: number): number {
  // metros → pixels, com escala de gameplay (ruas 2.5× mais largas que a realidade)
  const metersPerPx = 360 * 111320 * Math.cos(lat * Math.PI / 180)
    / (GAME_TILE_PX * Math.pow(2, OSM_ZOOM));
  return Math.max(6, Math.round(realMeters / metersPerPx * 2.5));
}

function nodesToPts(nodes: { lat: number; lon: number }[], ox: number, oy: number) {
  return nodes.map(n => latLngToWorld(n.lat, n.lon, ox, oy));
}

function ptsToD(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  return pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  ).join(' ');
}

function ptsToPolygon(pts: { x: number; y: number }[]): string {
  return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/* ── LCG determinístico para decorações baseadas em coordenada ── */
function seededRand(seed: number) {
  let s = Math.abs(seed % 2147483647) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Comprimento de poliline ── */
function polyLen(pts: { x: number; y: number }[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    l += Math.sqrt(dx * dx + dy * dy);
  }
  return l;
}

/* ── Ponto ao longo de poliline (t=0..1) ── */
function polyPoint(pts: { x: number; y: number }[], t: number): { x: number; y: number; angle: number } | null {
  if (pts.length < 2) return null;
  let total = 0;
  const segs = pts.slice(0, -1).map((p, i) => {
    const dx = pts[i + 1].x - p.x, dy = pts[i + 1].y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    total += len;
    return { dx, dy, len, angle: Math.atan2(dy, dx) * 180 / Math.PI };
  });
  let target = t * total, cum = 0;
  for (let i = 0; i < segs.length; i++) {
    if (cum + segs[i].len >= target || i === segs.length - 1) {
      const frac = segs[i].len > 0 ? (target - cum) / segs[i].len : 0;
      return {
        x: pts[i].x + segs[i].dx * frac,
        y: pts[i].y + segs[i].dy * frac,
        angle: segs[i].angle,
      };
    }
    cum += segs[i].len;
  }
  return null;
}

/* ── Paleta pós-apocalíptica ── */
const ASPHALT = '#181714';
const SIDEWALK = '#242220';
const DIRT_BG = '#12110a';
const BUILDING = '#121212';
const GREEN_DARK = '#0c1806';
const WEED_COLORS = ['#1a3a0a', '#0f2007', '#152e09', '#1d3b0f', '#0a1c05'];
const CAR_COLORS  = ['#3a2210', '#2e1a0a', '#452a16', '#341f0e'];

/* ── Gera elemento SVG de car enferrujado ── */
function RustedCar({ cx, cy, angle, rand }: { cx: number; cy: number; angle: number; rand: () => number }) {
  const w = 36 + rand() * 16;
  const h = 18 + rand() * 6;
  const c = CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
  const tilt = (rand() - 0.5) * 28;
  return (
    <g transform={`translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(${(angle + tilt).toFixed(1)})`}>
      {/* Corpo */}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={c} rx="2.5" opacity="0.9" />
      {/* Topo/cabine */}
      <rect x={-w * 0.2} y={-h / 2} width={w * 0.4} height={h * 0.65} fill={c} opacity="0.7" rx="1.5" />
      {/* Janelas (vidro quebrado escuro) */}
      <rect x={-w * 0.15} y={-h * 0.45} width={w * 0.3} height={h * 0.5} fill="rgba(12,18,22,0.8)" rx="1" />
      {/* Manchas de ferrugem */}
      <ellipse cx={-w * 0.3} cy={h * 0.1} rx={w * 0.18} ry={h * 0.25} fill="rgba(90,30,5,0.35)" />
      <ellipse cx={w * 0.3} cy={-h * 0.15} rx={w * 0.12} ry={h * 0.2} fill="rgba(80,20,0,0.3)" />
      {/* Sangue ressecado */}
      <circle cx={-w * 0.1} cy={0} r={w * 0.08} fill="rgba(110,10,10,0.4)" />
      {/* Rodas */}
      {[[-w * 0.3, -h / 2], [w * 0.3, -h / 2], [-w * 0.3, h / 2], [w * 0.3, h / 2]].map(([wx, wy], i) => (
        <circle key={i} cx={wx} cy={wy} r="5" fill="#0a0a08" />
      ))}
    </g>
  );
}

/* ── Cluster de mato ── */
function WeedCluster({ cx, cy, size, rand }: { cx: number; cy: number; size: number; rand: () => number }) {
  const c = WEED_COLORS[Math.floor(rand() * WEED_COLORS.length)];
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={size * (0.6 + rand() * 0.8)} ry={size * (0.35 + rand() * 0.4)}
        fill={c} opacity={0.55 + rand() * 0.35}
        transform={`rotate(${(rand() * 180).toFixed(1)},${cx.toFixed(1)},${cy.toFixed(1)})`}
      />
      {/* Estaminhas */}
      {[0, 1, 2].map(i => {
        const angle = (rand() * 360) * Math.PI / 180;
        const d = size * 0.6 * rand();
        return (
          <line key={i}
            x1={cx} y1={cy}
            x2={cx + Math.cos(angle) * d} y2={cy + Math.sin(angle) * d}
            stroke={c} strokeWidth="0.8" opacity="0.5"
          />
        );
      })}
    </g>
  );
}

/* ── Prédio 3D fake (Extrusão SVG) ── */
function Building3D({ pts, height = 25, color = '#151515', id, isNight }: { pts: { x: number; y: number }[], height?: number, color?: string, id: string | number, isNight: boolean }) {
  // Configuração do Sol
  // Dia: Sol a pino (Sombra curta e centralizada)
  // Noite/Fim de tarde: Baixo e vindo do Oeste (Sombra longa)
  const sunAngleX = isNight ? -0.5 : -0.1; 
  const sunAngleY = isNight ? -0.6 : -0.1; 
  const shadowLen = isNight ? height * 1.1 : height * 0.2;
  const roofOffsetX = sunAngleX * height * (isNight ? 0.45 : 0.1);
  const roofOffsetY = sunAngleY * height * (isNight ? 0.45 : 0.1);

  const roofPts = pts.map(p => ({ x: p.x + roofOffsetX, y: p.y + roofOffsetY }));
  const shadowPts = pts.map(p => ({ x: p.x + sunAngleX * shadowLen, y: p.y - sunAngleY * shadowLen }));

  return (
    <g key={`b3d-${id}`}>
      {/* Sombra projetada (Longa e levemente âmbar) */}
      <polygon points={shadowPts.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(30,15,5,0.45)" style={{ filter: 'blur(2px)' }} />
      
      {/* Paredes laterais */}
      {pts.map((p, i) => {
        const nextIdx = (i + 1) % pts.length;
        const p1 = p; const p2 = pts[nextIdx];
        const r1 = roofPts[i]; const r2 = roofPts[nextIdx];
        
        // Brilho facetado baseado no sol
        const dx = p2.x - p1.x; const dy = p2.y - p1.y;
        const ang = Math.atan2(dy, dx);
        // Face voltada para o sol fica mais clara
        const sunDot = Math.cos(ang - Math.PI); 
        const brightness = isNight 
          ? 0.4 + (sunDot + 1) * 0.45 
          : 0.7 + (sunDot + 1) * 0.15;
        const wallColor = (isNight && brightness > 0.8) ? '#332a20' : color;
        
        return (
          <polygon key={i} points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${r2.x},${r2.y} ${r1.x},${r1.y}`} 
            fill={wallColor} style={{ filter: `brightness(${brightness.toFixed(2)})` }} stroke="rgba(0,0,0,0.5)" strokeWidth="0.5" />
        );
      })}
      
      {/* Teto (Objeto Sólido para colisão) */}
      <polygon className="solid-object" points={roofPts.map(p => `${p.x},${p.y}`).join(' ')} fill={color} stroke="rgba(255,160,50,0.1)" strokeWidth="1" />
      
      {/* Detalhes de ruína no teto */}
      <rect x={roofPts[0].x + 5} y={roofPts[0].y + 5} width={12} height={8} fill="rgba(0,0,0,0.6)" rx="1" />
    </g>
  );
}

/* ── Pequenas Construções Procedurais (Props) ── */
function SmallProp({ cx, cy, type, rand, isNight }: { cx: number; cy: number; type: 'shack' | 'container' | 'debris'; rand: () => number, isNight: boolean }) {
  const w = type === 'container' ? 40 : 25;
  const h = type === 'container' ? 18 : 25;
  const color = type === 'container' ? '#2a3b4a' : '#222';
  
  if (type === 'container') {
    return (
       <g transform={`translate(${cx},${cy}) rotate(${(rand() * 360).toFixed(1)})`}>
         {/* Sombra */}
         <rect x={isNight ? 12 : 3} y={isNight ? 10 : 3} width={w} height={h} fill={isNight ? "rgba(20,10,0,0.4)" : "rgba(0,0,0,0.15)"} style={{ filter: isNight ? 'blur(1px)' : 'none' }} />
         {/* Parede lateral fake */}
         <rect x={-w/2} y={-h/2} width={w} height={h} fill={color} filter="brightness(0.6)" />
         {/* Teto do container (Solid Object) */}
         <rect className="solid-object" x={-w/2-5} y={-h/2-8} width={w} height={h} fill={color} stroke="#111" />
         {/* Frisos do container */}
         {[1, 2, 3, 4, 5].map(i => (
           <line key={i} x1={-w/2-5 + (i*w/6)} y1={-h/2-8} x2={-w/2-5 + (i*w/6)} y2={-h/2-8+h} stroke="rgba(255,200,100,0.08)" strokeWidth="1" />
         ))}
       </g>
    );
  }
  
  if (type === 'shack') {
    return (
      <g transform={`translate(${cx},${cy})`}>
        {/* Sombra */}
        <rect x={isNight ? 8 : 2} y={isNight ? 8 : 2} width={24} height={24} fill={isNight ? "rgba(20,10,0,0.35)" : "rgba(0,0,0,0.15)"} style={{ filter: isNight ? 'blur(1px)' : 'none' }} />
        {/* Paredes */}
        <rect x={-10} y={-10} width={20} height={20} fill="#2a1f1a" stroke="#111" />
        {/* Teto (Solid Object) */}
        <polygon className="solid-object" points="-12,-12 12,-15 15,10 -10,12" fill="#3a3a2a" stroke="#222" />
        <line x1={-12} y1={-12} x2={15} y2={10} stroke="rgba(255,180,100,0.1)" />
      </g>
    );
  }
  
  return (
    <g transform={`translate(${cx},${cy})`}>
      <rect x={-10} y={-10} width={20} height={20} fill="#111" rx="2" />
      <line x1={-12} y1={-12} x2={12} y2={12} stroke="#333" strokeWidth="1" />
    </g>
  );
}

/* ── Componente principal ── */
export default function StreetMap({
  viewportX, viewportY, screenW, screenH,
  originTileX, originTileY, playerLat, playerLng,
}: Props) {
  const isNight = useGameStore(state => state.isNight);
  const [ways, setWays] = useState<OsmWay[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const waysMapRef = useRef<Map<number, OsmWay>>(new Map());
  const lastFetchRef = useRef<{ lat: number; lng: number } | null>(null);

  // Buffer de cálculo para culling (margem menor que buffer SVG para desenhar um pouco fora)
  const cullBuffer = 300;

  function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon1 - lon2) * Math.PI / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Busca dados OSM do raio inicial e carrega mais quando chega perto da borda (~40km quadrados = raio ~3500m)
  useEffect(() => {
    if (!playerLat || !playerLng) return;

    const FETCH_RADIUS = 3500; // ~38km2 -> diametro de 7km
    const FETCH_MARGIN = 1500; // Recarrega se andar muito (distância > 2000m)

    let needsFetch = false;
    if (!lastFetchRef.current) {
      needsFetch = true;
    } else {
      const dist = getDistanceMeters(playerLat, playerLng, lastFetchRef.current.lat, lastFetchRef.current.lng);
      if (dist > (FETCH_RADIUS - FETCH_MARGIN)) {
        needsFetch = true;
      }
    }

    if (needsFetch) {
      if (!lastFetchRef.current) setStatus('loading');
      lastFetchRef.current = { lat: playerLat, lng: playerLng };
      
      fetchAreaData(playerLat, playerLng, FETCH_RADIUS)
        .then(data => {
          data.forEach(w => waysMapRef.current.set(w.id, w));
          setWays(Array.from(waysMapRef.current.values()));
          setStatus('ready');
        })
        .catch(() => {
          if (waysMapRef.current.size === 0) setStatus('error');
        });
    }
  }, [playerLat, playerLng]);

  // Categorias de elementos
  const { roads, buildings, greenAreas } = useMemo(() => {
    return {
      roads: ways.filter(w => w.tags.highway && w.geometry?.length >= 2),
      buildings: ways.filter(w => w.tags.building && w.geometry?.length >= 3),
      greenAreas: ways.filter(w =>
        (w.tags.leisure || w.tags.landuse) && w.geometry?.length >= 3
      ),
    };
  }, [ways]);

  const lat = playerLat;

  // SVG cobre o viewport + buffer generoso para pre-loading invisível
  const buffer = 1200;
  const svgViewX = viewportX - buffer;
  const svgViewY = viewportY - buffer;
  const svgViewW = screenW + buffer * 2;
  const svgViewH = screenH + buffer * 2;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* ── Loading ── */}
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, background: DIRT_BG, zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ width: 40, height: 40, border: '3px solid #1a1a1a', borderTopColor: '#8b0000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#333' }}>
            GERANDO MAPA REAL...
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        </div>
      )}

      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, background: DIRT_BG }}>
          <FallbackMap viewportX={viewportX} viewportY={viewportY} svgViewX={svgViewX} svgViewY={svgViewY} svgViewW={svgViewW} svgViewH={svgViewH} />
        </div>
      )}

      {/* ── SVG Principal ── */}
      <svg
        id="street-map-svg"
        style={{ 
          position: 'absolute', 
          left: -buffer, top: -buffer, 
          width: svgViewW, height: svgViewH, 
          overflow: 'visible',
          filter: isNight 
            ? 'sepia(0.4) saturate(1.6) contrast(1.1) drop-shadow(0 0 30px rgba(255,100,0,0.1))'
            : 'none'
        }}
        viewBox={`${svgViewX} ${svgViewY} ${svgViewW} ${svgViewH}`}
      >
        <defs>
          <pattern id="asphalt-pat" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
            <rect width="48" height="48" fill={ASPHALT} />
            <circle cx="12" cy="12" r="5" fill="#151412" opacity="0.5" />
            <circle cx="36" cy="30" r="7" fill="#131210" opacity="0.4" />
            <path d="M 20 40 Q 25 35 30 42" stroke="#111" strokeWidth="1" fill="none" opacity="0.5" />
          </pattern>
          <pattern id="sidewalk-pat" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill={SIDEWALK} />
            <rect x="0" y="0" width="1" height="18" fill="#1a1816" opacity="0.6" />
            <rect x="0" y="0" width="18" height="1" fill="#1a1816" opacity="0.6" />
          </pattern>
          <pattern id="dirt-pat" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
            <rect width="48" height="48" fill={DIRT_BG} />
            <circle cx="12" cy="10" r="9" fill="#111009" opacity="0.5" />
            <circle cx="36" cy="30" r="14" fill="#0f0e08" opacity="0.4" />
          </pattern>
        </defs>

        {/* ── FUNDO ── */}
        <rect x={svgViewX} y={svgViewY} width={svgViewW} height={svgViewH} fill="url(#dirt-pat)" />

        {/* ── ÁREAS VERDES ── */}
        {greenAreas.map(way => {
          const pts = nodesToPts(way.geometry, originTileX, originTileY);
          if (pts.length < 3) return null;
          const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
          const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
          if (maxX < viewportX - cullBuffer || minX > viewportX + screenW + cullBuffer ||
              maxY < viewportY - cullBuffer || minY > viewportY + screenH + cullBuffer) return null;
          const rand = seededRand(way.id);
          return (
            <g key={`green-${way.id}`}>
              <polygon className="walkable-road" points={ptsToPolygon(pts)} fill={GREEN_DARK} stroke="#0a1304" strokeWidth="1" />
              {Array.from({ length: 4 }, (_, i) => {
                const cx = pts[0].x + (rand() - 0.5) * 150;
                const cy = pts[0].y + (rand() - 0.5) * 150;
                return <WeedCluster key={i} cx={cx} cy={cy} size={15 + rand() * 15} rand={rand} />;
              })}
            </g>
          );
        })}

        {/* ── CALÇADAS ── */}
        {roads.map(way => {
          const type = way.tags.highway;
          if (['footway', 'cycleway', 'path', 'steps'].includes(type)) return null;
          const pts = nodesToPts(way.geometry, originTileX, originTileY);
          if (pts.length < 2) return null;
          const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
          const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
          if (maxX < viewportX - cullBuffer || minX > viewportX + screenW + cullBuffer ||
              maxY < viewportY - cullBuffer || minY > viewportY + screenH + cullBuffer) return null;
          const realW = ROAD_WIDTHS_M[type] ?? 9;
          const roadPx = getPixelWidth(realW, lat);
          const sidewalkPx = roadPx + getPixelWidth(realW * 0.35, lat) * 2;
          return <path key={`sw-${way.id}`} d={ptsToD(pts)} className="walkable-road" fill="none" stroke="url(#sidewalk-pat)" strokeWidth={sidewalkPx} strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" />;
        })}

        {/* ── ASFALTO ── */}
        {roads.map(way => {
          const pts = nodesToPts(way.geometry, originTileX, originTileY);
          if (pts.length < 2) return null;
          const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
          const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
          if (maxX < viewportX - cullBuffer || minX > viewportX + screenW + cullBuffer ||
              maxY < viewportY - cullBuffer || minY > viewportY + screenH + cullBuffer) return null;
          const type = way.tags.highway;
          const realW = ROAD_WIDTHS_M[type] ?? 9;
          const roadPx = getPixelWidth(realW, lat);
          const isMinor = ['footway', 'cycleway', 'path', 'steps'].includes(type);
          return <path key={`rd-${way.id}`} d={ptsToD(pts)} className="walkable-road" fill="none" stroke={isMinor ? SIDEWALK : 'url(#asphalt-pat)'} strokeWidth={isMinor ? roadPx * 0.5 : roadPx} strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" />;
        })}

        {/* ── PRÉDIOS 3D ── */}
        {buildings.map(way => {
          const pts = nodesToPts(way.geometry, originTileX, originTileY);
          if (pts.length < 3) return null;
          const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
          const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
          if (maxX < viewportX - cullBuffer || minX > viewportX + screenW + cullBuffer ||
              maxY < viewportY - cullBuffer || minY > viewportY + screenH + cullBuffer) return null;
          const rand = seededRand(way.id);
          return <Building3D key={`b3d-${way.id}`} pts={pts} id={way.id} height={25 + rand() * 45} color={BUILDING} isNight={isNight} />;
        })}

        {/* ── PEQUENAS CONSTRUÇÕES E DECORAÇÕES ── */}
        {roads.map(way => {
          const pts = nodesToPts(way.geometry, originTileX, originTileY);
          if (pts.length < 2) return null;
          const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
          const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
          if (maxX < viewportX - cullBuffer || minX > viewportX + screenW + cullBuffer ||
              maxY < viewportY - cullBuffer || minY > viewportY + screenH + cullBuffer) return null;
          
          const type = way.tags.highway;
          const roadPx = getPixelWidth(ROAD_WIDTHS_M[type] ?? 9, lat);
          const rand = seededRand(way.id * 31);
          const len = polyLen(pts);
          const el: React.ReactNode[] = [];

          // Adiciona mato e pequenos props (shacks/containers)
          for (let i = 0; i < Math.min(Math.floor(len / 120), 5); i++) {
             if (rand() > 0.4) continue;
             const pos = polyPoint(pts, (i + rand()) / Math.max(1, len/120));
             if (!pos) continue;
             const side = rand() > 0.5 ? 1.4 : -1.4;
             const wx = pos.x + Math.cos((pos.angle+90)*Math.PI/180) * (roadPx + 15) * side;
             const wy = pos.y + Math.sin((pos.angle+90)*Math.PI/180) * (roadPx + 15) * side;
             
             if (rand() > 0.7) {
               el.push(<SmallProp key={`p-${i}`} cx={wx} cy={wy} type={rand() > 0.5 ? 'container' : 'shack'} rand={rand} isNight={isNight} />);
             } else {
               el.push(<WeedCluster key={`w-${i}`} cx={wx} cy={wy} size={15+rand()*10} rand={rand} />);
             }
          }

          if (ROAD_IS_MAJOR[type]) {
             for (let i = 0; i < Math.min(Math.floor(len / 250), 2); i++) {
                if (rand() > 0.4) continue;
                const pos = polyPoint(pts, (i + 0.5) / Math.max(1, len/250));
                if (!pos) continue;
                const carX = pos.x + (rand() - 0.5) * (roadPx * 0.4);
                const carY = pos.y + (rand() - 0.5) * (roadPx * 0.4);
                el.push(<RustedCar key={`car-${i}`} cx={carX} cy={carY} angle={pos.angle} rand={rand} />);
             }
          }
          
          return <g key={`dec-${way.id}`}>{el}</g>;
        })}

        {/* ── ATRIBUIÇÃO ── */}
        <text x={svgViewX + 8} y={svgViewY + svgViewH - 8} fontFamily="Arial" fontSize="9" fill="rgba(255,255,255,0.1)">
          © OpenStreetMap contributors
        </text>
      </svg>
    </div>
  );
}

function FallbackMap({ svgViewX, svgViewY, svgViewW, svgViewH, viewportX, viewportY }: any) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      viewBox={`${svgViewX} ${svgViewY} ${svgViewW} ${svgViewH}`}
    >
      <rect x={svgViewX} y={svgViewY} width={svgViewW} height={svgViewH} fill="#12110a" />
      {[-2, -1, 0, 1, 2, 3].map(i => (
        <g key={`gr-${i}`}>
          <line x1={svgViewX} y1={viewportY + i * 400} x2={svgViewX + svgViewW} y2={viewportY + i * 400}
            stroke="#181714" strokeWidth="45" />
          <line x1={viewportX + i * 400} y1={svgViewY} x2={viewportX + i * 400} y2={svgViewY + svgViewH}
            stroke="#181714" strokeWidth="45" />
        </g>
      ))}
    </svg>
  );
}
