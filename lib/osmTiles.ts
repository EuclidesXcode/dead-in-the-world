// ──────────────────────────────────────────────────────
//  OSM TILE SYSTEM
//  Usa OpenStreetMap zoom 17 como sistema de coordenadas
//  Cada tile OSM ≈ 153m², renderizado em 512px no jogo
// ──────────────────────────────────────────────────────

export const OSM_ZOOM = 17;
export const OSM_NATIVE_PX = 256;      // Tamanho nativo OSM
export const GAME_TILE_PX = 1400;      // Tamanho renderizado no jogo (zoom mega largo para ruas bem abertas)
export const METERS_PER_TILE = 153;    // Aproximado à latitude do equador

// ── Conversão lat/lng → tile OSM ──
export function latLngToOsmTile(lat: number, lng: number, zoom = OSM_ZOOM) {
  const n = Math.pow(2, zoom);
  const tileX = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const tileY = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { tileX, tileY };
}

// ── Posição fracionária dentro do tile (0–1) ──
export function latLngToFractionalOsmTile(lat: number, lng: number, zoom = OSM_ZOOM) {
  const n = Math.pow(2, zoom);
  const fracX = (lng + 180) / 360 * n;
  const latRad = lat * Math.PI / 180;
  const fracY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  return { fracX, fracY };
}

// ── Conversão tile → lat/lng (top-left do tile) ──
export function osmTileToLatLng(tileX: number, tileY: number, zoom = OSM_ZOOM) {
  const n = Math.pow(2, zoom);
  const lng = (tileX / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n)));
  const lat = latRad * (180 / Math.PI);
  return { lat, lng };
}

// ── URL da imagem OSM tile ──
export function osmTileUrl(tileX: number, tileY: number, zoom = OSM_ZOOM): string {
  // Distribuição entre 3 subdomínios para melhor performance
  const s = ['a', 'b', 'c'][Math.abs(tileX + tileY) % 3];
  return `https://${s}.tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
}

// ── Posição em pixel de jogo: player começa em (offsetX, offsetY) relativo ao seu tile de origem ──
export function playerWorldPixelFromLatLng(lat: number, lng: number, zoom = OSM_ZOOM) {
  const { fracX, fracY } = latLngToFractionalOsmTile(lat, lng, zoom);
  const originTileX = Math.floor(fracX);
  const originTileY = Math.floor(fracY);
  const offsetX = (fracX - originTileX) * GAME_TILE_PX;
  const offsetY = (fracY - originTileY) * GAME_TILE_PX;
  return { originTileX, originTileY, pixelX: offsetX, pixelY: offsetY };
}

// ── Pixel de jogo → lat/lng ──
export function worldPixelToLatLng(
  pixelX: number, pixelY: number,
  originTileX: number, originTileY: number,
  zoom = OSM_ZOOM
) {
  const fracX = originTileX + pixelX / GAME_TILE_PX;
  const fracY = originTileY + pixelY / GAME_TILE_PX;
  return osmTileToLatLng(fracX, fracY, zoom);
}

// ── Tiles visíveis dado viewport ──
export function getVisibleOsmTiles(
  viewportX: number, viewportY: number,
  screenW: number, screenH: number,
  originTileX: number, originTileY: number
): { tileX: number; tileY: number; worldX: number; worldY: number }[] {
  const tiles: { tileX: number; tileY: number; worldX: number; worldY: number }[] = [];

  const startWorldTileX = Math.floor(viewportX / GAME_TILE_PX) - 1;
  const startWorldTileY = Math.floor(viewportY / GAME_TILE_PX) - 1;
  const endWorldTileX = Math.ceil((viewportX + screenW) / GAME_TILE_PX) + 1;
  const endWorldTileY = Math.ceil((viewportY + screenH) / GAME_TILE_PX) + 1;

  for (let ty = startWorldTileY; ty <= endWorldTileY; ty++) {
    for (let tx = startWorldTileX; tx <= endWorldTileX; tx++) {
      tiles.push({
        tileX: originTileX + tx,
        tileY: originTileY + ty,
        worldX: tx * GAME_TILE_PX,
        worldY: ty * GAME_TILE_PX,
      });
    }
  }

  return tiles;
}

// ── Tiles para pre-loading (raio maior que o visível) ──
export function getPrefetchOsmTiles(
  viewportX: number, viewportY: number,
  screenW: number, screenH: number,
  originTileX: number, originTileY: number,
  radiusExtra = 3  // tiles extras em cada direção
): { tileX: number; tileY: number }[] {
  const tiles: { tileX: number; tileY: number }[] = [];
  const startX = Math.floor(viewportX / GAME_TILE_PX) - radiusExtra;
  const startY = Math.floor(viewportY / GAME_TILE_PX) - radiusExtra;
  const endX = Math.ceil((viewportX + screenW) / GAME_TILE_PX) + radiusExtra;
  const endY = Math.ceil((viewportY + screenH) / GAME_TILE_PX) + radiusExtra;

  for (let ty = startY; ty <= endY; ty++) {
    for (let tx = startX; tx <= endX; tx++) {
      tiles.push({ tileX: originTileX + tx, tileY: originTileY + ty });
    }
  }
  return tiles;
}

// ── Converte tile OSM game (zoom 17) para posição no mapa mundial (zoom 2) ──
export function osmTileToWorldMapPx(
  tileX: number, tileY: number,
  canvasWidth: number, canvasHeight: number,
  zoom = OSM_ZOOM
) {
  const scale = Math.pow(2, zoom);
  const canvasX = (tileX / scale) * canvasWidth;
  const canvasY = (tileY / scale) * canvasHeight;
  return { canvasX, canvasY };
}
