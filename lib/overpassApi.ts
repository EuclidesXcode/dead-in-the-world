// ──────────────────────────────────────────────────────
//  OVERPASS API — busca dados reais de ruas e prédios
//  da OpenStreetMap na localização do jogador
// ──────────────────────────────────────────────────────

export interface OsmNode {
  lat: number;
  lon: number;
}

export interface OsmWay {
  id: number;
  type: 'way';
  tags: Record<string, string>;
  geometry: OsmNode[];
}

export interface OverpassResult {
  elements: OsmWay[];
}

// Busca ruas, prédios, parques de um raio em torno de lat/lng
export async function fetchAreaData(lat: number, lng: number, radiusMeters = 700): Promise<OsmWay[]> {
  const query = `
[out:json][timeout:90];
(
  way["highway"](around:${radiusMeters},${lat},${lng});
  way["building"](around:${radiusMeters},${lat},${lng});
  way["leisure"~"park|garden|grass|pitch"](around:${radiusMeters},${lat},${lng});
  way["landuse"~"grass|park|forest|meadow|recreation_ground"](around:${radiusMeters},${lat},${lng});
);
out geom;
  `.trim();

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
  });

  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  const data: OverpassResult = await res.json();
  return data.elements || [];
}

// Largura real de cada tipo de via (metros)
export const ROAD_WIDTHS_M: Record<string, number> = {
  motorway: 28,
  motorway_link: 16,
  trunk: 22,
  trunk_link: 14,
  primary: 18,
  primary_link: 12,
  secondary: 14,
  secondary_link: 10,
  tertiary: 12,
  tertiary_link: 9,
  residential: 9,
  living_street: 8,
  service: 6,
  unclassified: 8,
  road: 8,
  footway: 3,
  cycleway: 2.5,
  path: 2.5,
  pedestrian: 8,
  track: 5,
  steps: 3,
};

export const ROAD_IS_MAJOR: Record<string, boolean> = {
  motorway: true, trunk: true, primary: true, secondary: true,
  tertiary: true, residential: true, living_street: true,
  pedestrian: true, unclassified: true,
};
