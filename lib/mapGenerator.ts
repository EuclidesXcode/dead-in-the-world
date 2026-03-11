import seedrandom from 'seedrandom';
import { TileType, MapTile } from './supabase';

// Tamanho de cada tile em metros
export const TILE_SIZE_METERS = 50;
// Quantos tiles mostrar na tela
export const VIEWPORT_TILES = 15;
// Pixels por tile
export const TILE_PIXELS = 64;

// Converte lat/lng para coordenadas de tile global
export function latLngToTile(lat: number, lng: number): { tile_x: number; tile_y: number } {
  // Usando escala baseada em metros por grau
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos((lat * Math.PI) / 180);

  const tile_x = Math.floor((lng * metersPerDegreeLng) / TILE_SIZE_METERS);
  const tile_y = Math.floor((lat * metersPerDegreeLat) / TILE_SIZE_METERS);

  return { tile_x, tile_y };
}

// Converte coordenadas de tile para lat/lng (centro do tile)
export function tileToLatLng(tile_x: number, tile_y: number): { lat: number; lng: number } {
  const metersPerDegreeLat = 111320;
  const refLat = (tile_y * TILE_SIZE_METERS) / metersPerDegreeLat;
  const metersPerDegreeLng = 111320 * Math.cos((refLat * Math.PI) / 180);

  const lat = (tile_y * TILE_SIZE_METERS) / metersPerDegreeLat;
  const lng = (tile_x * TILE_SIZE_METERS) / metersPerDegreeLng;

  return { lat, lng };
}

// Gera um seed único para cada tile
export function getTileSeed(tile_x: number, tile_y: number): number {
  const seed = `dw_${tile_x}_${tile_y}`;
  const rng = seedrandom(seed);
  return Math.floor(rng() * 2147483647);
}

// Tipos de tile com pesos de distribuição
const TILE_DISTRIBUTIONS: Record<string, { type: TileType; weight: number }[]> = {
  urban: [
    { type: 'street', weight: 35 },
    { type: 'building', weight: 30 },
    { type: 'market', weight: 10 },
    { type: 'hospital', weight: 5 },
    { type: 'abandoned', weight: 10 },
    { type: 'ruins', weight: 5 },
    { type: 'military_base', weight: 5 },
  ],
  rural: [
    { type: 'forest', weight: 45 },
    { type: 'street', weight: 20 },
    { type: 'building', weight: 15 },
    { type: 'abandoned', weight: 10 },
    { type: 'river', weight: 10 },
  ],
  mixed: [
    { type: 'street', weight: 25 },
    { type: 'building', weight: 20 },
    { type: 'forest', weight: 20 },
    { type: 'abandoned', weight: 15 },
    { type: 'market', weight: 8 },
    { type: 'hospital', weight: 5 },
    { type: 'ruins', weight: 5 },
    { type: 'river', weight: 2 },
  ],
};

// Determina tipo do tile baseado em seed e localização
export function generateTileType(tile_x: number, tile_y: number, lat: number): TileType {
  const seed = getTileSeed(tile_x, tile_y);
  const rng = seedrandom(`type_${seed}`);
  const rand = rng();

  // Distribui baseado em latitude (tropical = mais floresta, temperado = mais urbano)
  const absLat = Math.abs(lat);
  let distribution: { type: TileType; weight: number }[];

  if (absLat < 20) distribution = TILE_DISTRIBUTIONS.mixed; // tropical
  else if (absLat < 45) distribution = TILE_DISTRIBUTIONS.urban; // temperado
  else distribution = TILE_DISTRIBUTIONS.rural; // frio

  // Seleciona baseado em peso
  const totalWeight = distribution.reduce((sum, item) => sum + item.weight, 0);
  let accumulated = 0;
  let selected: TileType = 'street';

  for (const item of distribution) {
    accumulated += item.weight / totalWeight;
    if (rand < accumulated) {
      selected = item.type;
      break;
    }
  }

  return selected;
}

// Configurações de loot por tipo de tile
export const TILE_LOOT_CONFIG: Record<TileType, {
  itemTypes: string[];
  zombieDensity: [number, number]; // min, max
  rarity: string;
}> = {
  street: { itemTypes: ['ammo', 'food', 'material'], zombieDensity: [1, 3], rarity: 'common' },
  building: { itemTypes: ['food', 'water', 'material', 'heal'], zombieDensity: [2, 4], rarity: 'common' },
  hospital: { itemTypes: ['heal', 'medkit', 'upgrade'], zombieDensity: [3, 5], rarity: 'uncommon' },
  market: { itemTypes: ['food', 'water', 'ammo', 'material'], zombieDensity: [2, 4], rarity: 'uncommon' },
  military_base: { itemTypes: ['weapon', 'ammo', 'upgrade'], zombieDensity: [4, 5], rarity: 'rare' },
  forest: { itemTypes: ['food', 'material', 'heal'], zombieDensity: [1, 2], rarity: 'common' },
  river: { itemTypes: ['water', 'food', 'material'], zombieDensity: [1, 2], rarity: 'common' },
  ruins: { itemTypes: ['material', 'ammo', 'weapon'], zombieDensity: [3, 5], rarity: 'uncommon' },
  abandoned: { itemTypes: ['food', 'ammo', 'heal', 'weapon'], zombieDensity: [2, 4], rarity: 'uncommon' },
};

// Gera tiles ao redor de uma posição
export function getVisibleTileCoords(
  center_x: number,
  center_y: number,
  radius: number = 5
): Array<{ tile_x: number; tile_y: number }> {
  const coords = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      coords.push({ tile_x: center_x + dx, tile_y: center_y + dy });
    }
  }
  return coords;
}

// Cria um tile proceduralmente
export function createProceduralTile(
  tile_x: number,
  tile_y: number,
  lat: number,
  lng: number
): Omit<MapTile, 'id' | 'explored_by' | 'explored_at'> {
  const seed = getTileSeed(tile_x, tile_y);
  const rng = seedrandom(`zombie_${seed}`);
  const tile_type = generateTileType(tile_x, tile_y, lat);
  const config = TILE_LOOT_CONFIG[tile_type];
  const zombieDensity = Math.floor(
    rng() * (config.zombieDensity[1] - config.zombieDensity[0] + 1) + config.zombieDensity[0]
  );

  return {
    tile_x,
    tile_y,
    center_lat: lat,
    center_lng: lng,
    tile_type,
    has_loot: true,
    loot_collected: false,
    zombie_density: zombieDensity,
    seed_value: seed,
  };
}

// Cores para render de cada tipo de tile
export const TILE_COLORS: Record<TileType, { base: string; border: string; icon: string }> = {
  street: { base: '#2d2d2d', border: '#404040', icon: '🛣️' },
  building: { base: '#1a3a4a', border: '#2a5a6a', icon: '🏢' },
  hospital: { base: '#1a3a1a', border: '#2a6a2a', icon: '🏥' },
  market: { base: '#3a2a1a', border: '#6a4a2a', icon: '🏪' },
  military_base: { base: '#1a2a1a', border: '#3a5a3a', icon: '🪖' },
  forest: { base: '#0d2b0d', border: '#1a4a1a', icon: '🌲' },
  river: { base: '#0d1f3c', border: '#1a3a6a', icon: '🌊' },
  ruins: { base: '#2a1a0d', border: '#4a3a2a', icon: '🏚️' },
  abandoned: { base: '#1a1a2a', border: '#2a2a4a', icon: '🏗️' },
};
