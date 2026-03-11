// ──────────────────────────────────────────────────────
//  SISTEMA DE SPAWN DE ZUMBIS
//  - Quantidade baseada no nível dos jogadores da área
//  - Spawn gradual com intervalos variados
//  - Spawn fora do raio de visão do jogador
//  - Máximo por área para manter performance
// ──────────────────────────────────────────────────────

import { ZOMBIE_STATS } from './combat';

export interface SpawnZombie {
  id: string;
  tile_x: number;
  tile_y: number;
  pos_x: number;
  pos_y: number;
  zombie_type: string;
  max_health: number;
  current_health: number;
  damage: number;
  speed: number;
  xp_reward: number;
  is_alive: boolean;
  direction: number;
}

// ── Configuração de spawn por nível ──
const SPAWN_CONFIG = {
  base_max: 4,              // Máximo de zumbis no viewport sem nenhum jogador
  per_player_level: 0.8,   // +0.8 max por nível médio
  per_player_count: 2,     // +2 max por jogador extra na área
  absolute_max: 40,        // Nunca excede este valor
  spawn_interval_ms: 8000, // Intervalo base de spawn (8s)
  spawn_variation_ms: 4000, // Variação aleatória ±
  min_spawn_dist: 350,     // Mínimo de pixels do jogador para spawnar
  max_spawn_dist: 700,     // Máximo de pixels do jogador para spawnar
};

// ── Type de zumbi ponderado por area e nível ──
export function pickZombieType(avgLevel: number): string {
  // Quanto maior o nível, mais tanques e runners aparecem
  const roll = Math.random() * 100;
  if (avgLevel >= 10) {
    if (roll < 5) return 'Tank';
    if (roll < 20) return 'Screamer';
    if (roll < 45) return 'Runner';
    return 'Walker';
  } else if (avgLevel >= 5) {
    if (roll < 3) return 'Tank';
    if (roll < 15) return 'Screamer';
    if (roll < 35) return 'Runner';
    return 'Walker';
  } else {
    if (roll < 1) return 'Tank';
    if (roll < 8) return 'Screamer';
    if (roll < 20) return 'Runner';
    return 'Walker';
  }
}

// ── Calcula máximo de zumbis na área ──
export function calcMaxZombies(avgPlayerLevel: number, playerCount: number): number {
  const max = Math.round(
    SPAWN_CONFIG.base_max +
    avgPlayerLevel * SPAWN_CONFIG.per_player_level +
    (playerCount - 1) * SPAWN_CONFIG.per_player_count
  );
  return Math.min(max, SPAWN_CONFIG.absolute_max);
}

// ── Gera posição de spawn válida (fora do raio do player) ──
export function getSpawnPosition(
  playerX: number, playerY: number,
): { x: number; y: number } {
  let x: number, y: number;
  let attempts = 0;
  do {
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_CONFIG.min_spawn_dist +
      Math.random() * (SPAWN_CONFIG.max_spawn_dist - SPAWN_CONFIG.min_spawn_dist);
    x = playerX + Math.cos(angle) * dist;
    y = playerY + Math.sin(angle) * dist;
    attempts++;
  } while (attempts < 10); // Evita loop infinito

  return { x, y };
}

// ── Cria um novo zumbi para spawnar ──
export function createSpawnZombie(
  playerX: number, playerY: number,
  originTileX: number, originTileY: number,
  avgLevel: number,
): SpawnZombie {
  const { x, y } = getSpawnPosition(playerX, playerY);
  const type = pickZombieType(avgLevel) as keyof typeof ZOMBIE_STATS;
  const stats = ZOMBIE_STATS[type];

  // Escala HP e dano com nível (suave)
  const levelScale = 1 + avgLevel * 0.08;
  const maxHealth = Math.round(stats.max_health * levelScale);
  const damage = Math.round(stats.damage * levelScale);

  const TILE_PX = 512;
  return {
    id: crypto.randomUUID(),
    tile_x: originTileX + Math.floor(x / TILE_PX),
    tile_y: originTileY + Math.floor(y / TILE_PX),
    pos_x: x,
    pos_y: y,
    zombie_type: type,
    max_health: maxHealth,
    current_health: maxHealth,
    damage,
    speed: stats.speed,
    xp_reward: Math.round(stats.xp_reward * (1 + avgLevel * 0.05)),
    is_alive: true,
    direction: Math.random() * 360,
  };
}

// ── Calcular próximo tempo de spawn ──
export function nextSpawnDelay(): number {
  return SPAWN_CONFIG.spawn_interval_ms +
    (Math.random() - 0.5) * 2 * SPAWN_CONFIG.spawn_variation_ms;
}

export { SPAWN_CONFIG };
