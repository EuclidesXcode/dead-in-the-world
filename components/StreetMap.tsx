'use client';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GAME_TILE_PX, OSM_ZOOM } from '@/lib/osmTiles';
import { fetchAreaData, OsmWay, ROAD_WIDTHS_M, ROAD_IS_MAJOR } from '@/lib/overpassApi';

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
  const w = 22 + rand() * 10;
  const h = 12 + rand() * 4;
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
      {/* Rodas */}
      {[[-w * 0.3, -h / 2], [w * 0.3, -h / 2], [-w * 0.3, h / 2], [w * 0.3, h / 2]].map(([wx, wy], i) => (
        <circle key={i} cx={wx} cy={wy} r="4" fill="#0a0a08" />
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

/* ── Componente principal ── */
export default function StreetMap({
  viewportX, viewportY, screenW, screenH,
  originTileX, originTileY, playerLat, playerLng,
}: Props) {
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
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#333', animation: 'pulse 1s infinite' }}>
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
        style={{ position: 'absolute', left: -buffer, top: -buffer, width: svgViewW, height: svgViewH, overflow: 'visible' }}
        viewBox={`${svgViewX} ${svgViewY} ${svgViewW} ${svgViewH}`}
      >
        <defs>
          {/* Padrão de asfalto rachado */}
          <pattern id="asphalt-pat" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <rect width="32" height="32" fill={ASPHALT} />
            <circle cx="8" cy="8" r="3" fill="#151412" opacity="0.5" />
            <circle cx="24" cy="20" r="4" fill="#131210" opacity="0.4" />
            <rect x="12" y="4" width="8" height="1" fill="#111" opacity="0.3" />
            <rect x="2" y="20" width="6" height="0.5" fill="#0e0e0c" opacity="0.4" />
          </pattern>
          {/* Padrão de calçada (paralelepípedo/lajota) */}
          <pattern id="sidewalk-pat" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill={SIDEWALK} />
            <rect x="0" y="0" width="1" height="18" fill="#1a1816" opacity="0.6" />
            <rect x="0" y="0" width="18" height="1" fill="#1a1816" opacity="0.6" />
            <rect x="9" y="9" width="1" height="9" fill="#161412" opacity="0.3" />
            <rect x="9" y="9" width="9" height="1" fill="#161412" opacity="0.3" />
          </pattern>
          {/* Padrão de terra/dirt */}
          <pattern id="dirt-pat" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
            <rect width="48" height="48" fill={DIRT_BG} />
            <circle cx="12" cy="10" r="9" fill="#111009" opacity="0.5" />
            <circle cx="36" cy="30" r="14" fill="#0f0e08" opacity="0.4" />
            <circle cx="5" cy="38" r="6" fill="#131208" opacity="0.3" />
            <circle cx="40" cy="8" r="5" fill="#100f08" opacity="0.35" />
          </pattern>
        </defs>

        {/* ── FUNDO (terra/chão pós-apoc) ── */}
        <rect x={svgViewX} y={svgViewY} width={svgViewW} height={svgViewH} fill="url(#dirt-pat)" />

        {/* ── ÁREAS VERDES (parques abandonados) ── */}
        {greenAreas.map(way => {
          const pts = nodesToPts(way.geometry, originTileX, originTileY);
          if (pts.length < 3) return null;
          // Culling simples (bounding box bounding box)
          const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
          const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
          if (maxX < viewportX - cullBuffer || minX > viewportX + screenW + cullBuffer ||
              maxY < viewportY - cullBuffer || minY > viewportY + screenH + cullBuffer) return null;

          const rand = seededRand(way.id);
          return (
            <g key={`green-${way.id}`}>
              <polygon points={ptsToPolygon(pts)} fill={GREEN_DARK} stroke="#0a1304" strokeWidth="1" />
              {/* Mato denso na área verde */}
              {Array.from({ length: 8 }, (_, i) => {
                const cx = pts[0].x + (rand() - 0.5) * 120;
                const cy = pts[0].y + (rand() - 0.5) * 120;
                return <WeedCluster key={i} cx={cx} cy={cy} size={12 + rand() * 20} rand={rand} />;
              })}
            </g>
          );
        })}

        {/* ── CALÇADAS (layer mais largo, cor calçada) ── */}
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
          return (
            <path key={`sw-${way.id}`} d={ptsToD(pts)}
              fill="none" stroke="url(#sidewalk-pat)"
              strokeWidth={sidewalkPx} strokeLinecap="round" strokeLinejoin="round"
            />
          );
        })}

        {/* ── ASFALTO (camada principal da rua) ── */}
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
          return (
            <path key={`rd-${way.id}`} d={ptsToD(pts)}
              fill="none"
              stroke={isMinor ? SIDEWALK : 'url(#asphalt-pat)'}
              strokeWidth={isMinor ? roadPx * 0.5 : roadPx}
              strokeLinecap="round" strokeLinejoin="round"
            />
          );
        })}

        {/* ── MARCAÇÕES DE FAIXA (desgastadas, quase sumindo) ── */}
        {roads.map(way => {
          const type = way.tags.highway;
          if (!ROAD_IS_MAJOR[type]) return null;
          const pts = nodesToPts(way.geometry, originTileX, originTileY);
          if (pts.length < 2) return null;
          const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
          const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
          if (maxX < viewportX - cullBuffer || minX > viewportX + screenW + cullBuffer ||
              maxY < viewportY - cullBuffer || minY > viewportY + screenH + cullBuffer) return null;

          const realW = ROAD_WIDTHS_M[type] ?? 9;
          const roadPx = getPixelWidth(realW, lat);
          const dashLen = Math.round(roadPx * 1.2);
          return (
            <path key={`ln-${way.id}`} d={ptsToD(pts)}
              fill="none"
              stroke="rgba(52,46,10,0.28)"
              strokeWidth="1.5"
              strokeLinecap="butt"
              strokeDasharray={`${dashLen} ${dashLen * 2.5}`}
            />
          );
        })}

        {/* ── PRÉDIOS ── */}
        {buildings.map(way => {
          const pts = nodesToPts(way.geometry, originTileX, originTileY);
          if (pts.length < 3) return null;
          const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
          const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
          if (maxX < viewportX - cullBuffer || minX > viewportX + screenW + cullBuffer ||
              maxY < viewportY - cullBuffer || minY > viewportY + screenH + cullBuffer) return null;

          const rand = seededRand(way.id);
          const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
          const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
          return (
            <g key={`bld-${way.id}`}>
              {/* Sombra */}
              <polygon points={ptsToPolygon(pts.map(p => ({ x: p.x + 3, y: p.y + 3 })))}
                fill="rgba(0,0,0,0.4)" />
              {/* Paredes */}
              <polygon points={ptsToPolygon(pts)} fill={BUILDING} stroke="#0a0a0a" strokeWidth="1.5" />
              {/* Borda da ruína */}
              <polygon points={ptsToPolygon(pts)} fill="none"
                stroke="rgba(45,38,28,0.45)" strokeWidth="1" />
              {/* Janelas quebradas */}
              {Array.from({ length: Math.floor(rand() * 2) + 1 }, (_, i) => {
                if (rand() > 0.65) return null;
                const wx = cx + (rand() - 0.5) * 32;
                const wy = cy + (rand() - 0.5) * 32;
                const ws = 5 + rand() * 7;
                // Algumas janelas têm glow de luz de emergência
                const hasGlow = rand() > 0.85;
                return (
                  <g key={i}>
                    {hasGlow && <rect x={wx - ws / 2 - 1} y={wy - ws * 0.7} width={ws + 2} height={ws * 1.4 + 2}
                      fill="rgba(40,60,20,0.12)" />}
                    <rect x={wx - ws / 2} y={wy - ws * 0.7} width={ws} height={ws * 1.4}
                      fill={hasGlow ? 'rgba(20,28,14,0.5)' : 'rgba(18,22,28,0.45)'}
                      stroke="rgba(35,32,26,0.3)" strokeWidth="0.5" />
                    {/* Vidro quebrado */}
                    {rand() > 0.5 && (
                      <line x1={wx - ws / 2} y1={wy - ws * 0.4} x2={wx + ws / 2} y2={wy + ws * 0.6}
                        stroke="rgba(30,28,22,0.5)" strokeWidth="0.7" />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ── DECORAÇÕES PÓS-APOCALÍPTICAS nas ruas ── */}
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
          const len = polyLen(pts);
          const rand = seededRand(way.id * 31);
          const isMajor = ROAD_IS_MAJOR[type] ?? false;
          const el: React.ReactNode[] = [];

          // ── Mato nas bordas ──
          const weedStep = 38;
          const weedCount = Math.floor(len / weedStep);
          for (let i = 0; i < Math.min(weedCount, 15); i++) {
            if (rand() > 0.45) continue;
            const t = (i + 0.2 + rand() * 0.6) / Math.max(1, weedCount);
            const pos = polyPoint(pts, t);
            if (!pos) continue;
            const side = rand() > 0.5 ? 1 : -1;
            const edgeOffset = (roadPx / 2 - 2) * side;
            const perpR = (pos.angle + 90) * Math.PI / 180;
            const wx = pos.x + Math.cos(perpR) * edgeOffset;
            const wy = pos.y + Math.sin(perpR) * edgeOffset;
            if (wx > viewportX && wx < viewportX + screenW && wy > viewportY && wy < viewportY + screenH) {
              el.push(<WeedCluster key={`w${i}`} cx={wx} cy={wy} size={5 + rand() * 12} rand={rand} />);
            }
          }

          // ── Carros enferrujados (nas ruas principais) ──
          if (isMajor) {
            const carStep = 180;
            const carCount = Math.floor(len / carStep);
            for (let i = 0; i < Math.min(carCount, 5); i++) {
              if (rand() > 0.38) continue;
              const t = (i + 0.4 + rand() * 0.2) / Math.max(1, carCount);
              const pos = polyPoint(pts, t);
              if (!pos) continue;
              const side = rand() > 0.5 ? 1 : -1;
              const carOffset = (roadPx / 2 - 8) * side * (0.5 + rand() * 0.4);
              const perpR = (pos.angle + 90) * Math.PI / 180;
              const carX = pos.x + Math.cos(perpR) * carOffset;
              const carY = pos.y + Math.sin(perpR) * carOffset;
              if (carX > viewportX - 100 && carX < viewportX + screenW + 100 && carY > viewportY - 100 && carY < viewportY + screenH + 100) {
                el.push(<RustedCar key={`car${i}`} cx={carX} cy={carY} angle={pos.angle} rand={rand} />);
              }
            }
          }

          // ── Rachaduras no asfalto ──
          if (isMajor) {
            const crackStep = 120;
            const crackCount = Math.floor(len / crackStep);
            for (let i = 0; i < Math.min(crackCount, 8); i++) {
              if (rand() > 0.45) continue;
              const t = (i + rand()) / Math.max(1, crackCount);
              const pos = polyPoint(pts, t);
              if (!pos) continue;
              const perpR = (pos.angle + 90) * Math.PI / 180;
              const crackW = roadPx * (0.3 + rand() * 0.55);
              // Rachadura principal
              if (pos.x > viewportX - 100 && pos.x < viewportX + screenW + 100 && pos.y > viewportY - 100 && pos.y < viewportY + screenH + 100) {
                el.push(
                  <line key={`cr${i}`}
                    x1={pos.x - Math.cos(perpR) * crackW / 2}
                    y1={pos.y - Math.sin(perpR) * crackW / 2}
                    x2={pos.x + Math.cos(perpR) * crackW / 2}
                    y2={pos.y + Math.sin(perpR) * crackW / 2}
                    stroke="rgba(6,6,5,0.65)" strokeWidth={0.6 + rand() * 0.8} strokeLinecap="round"
                  />
                );
              }
            }
          }

          // ── Poças d'óleo/sangue nas calçadas ──
          if (isMajor && rand() > 0.6) {
            const t = rand();
            const pos = polyPoint(pts, t);
            if (pos && pos.x > viewportX && pos.x < viewportX + screenW && pos.y > viewportY && pos.y < viewportY + screenH) {
              const perpR = (pos.angle + 90) * Math.PI / 180;
              const side = rand() > 0.5 ? 1 : -1;
              const ox = pos.x + Math.cos(perpR) * (roadPx / 2) * side;
              const oy = pos.y + Math.sin(perpR) * (roadPx / 2) * side;
              el.push(
                <ellipse key="puddle"
                  cx={ox} cy={oy}
                  rx={8 + rand() * 12} ry={4 + rand() * 8}
                  fill="rgba(60,5,5,0.25)"
                  transform={`rotate(${(rand() * 180).toFixed(1)},${ox.toFixed(1)},${oy.toFixed(1)})`}
                />
              );
            }
          }

          return <g key={`dec-${way.id}`}>{el}</g>;
        })}

        {/* ── Atribuição OpenStreetMap ── */}
        <text
          x={svgViewX + 8} y={svgViewY + svgViewH - 8}
          fontFamily="Arial" fontSize="10"
          fill="rgba(255,255,255,0.12)"
        >
          © OpenStreetMap contributors
        </text>
      </svg>
    </div>
  );
}

/* ── Fallback quando Overpass falha (mapa procedural mínimo) ── */
function FallbackMap({ svgViewX, svgViewY, svgViewW, svgViewH, viewportX, viewportY }: any) {
  const rand = seededRand(42);
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      viewBox={`${svgViewX} ${svgViewY} ${svgViewW} ${svgViewH}`}
    >
      <rect x={svgViewX} y={svgViewY} width={svgViewW} height={svgViewH} fill="#12110a" />
      {/* Grid de ruas simples como fallback */}
      {[-2, -1, 0, 1, 2, 3].map(i => (
        <g key={`gr-${i}`}>
          <line x1={svgViewX} y1={viewportY + i * 400} x2={svgViewX + svgViewW} y2={viewportY + i * 400}
            stroke="#181714" strokeWidth="45" />
          <line x1={viewportX + i * 400} y1={svgViewY} x2={viewportX + i * 400} y2={svgViewY + svgViewH}
            stroke="#181714" strokeWidth="45" />
        </g>
      ))}
      <text x={svgViewX + svgViewW / 2} y={svgViewY + svgViewH / 2}
        textAnchor="middle" fontFamily="monospace" fontSize="12" fill="#333">
        Mapa offline — verifique a conexão
      </text>
    </svg>
  );
}
