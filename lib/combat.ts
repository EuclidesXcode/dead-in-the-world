import { Player, Zombie, InventoryItem, ZombieType } from './supabase';

// Configurações de cada tipo de zumbi
export const ZOMBIE_STATS: Record<ZombieType, {
  max_health: number;
  damage: number;
  speed: number;
  xp_reward: number;
  attack_range: number;
  detection_range: number;
}> = {
  walker: {
    max_health: 50,
    damage: 8,
    speed: 0.5,
    xp_reward: 10,
    attack_range: 35,
    detection_range: 200,
  },
  runner: {
    max_health: 30,
    damage: 12,
    speed: 2.5,
    xp_reward: 18,
    attack_range: 30,
    detection_range: 280,
  },
  tank: {
    max_health: 250,
    damage: 25,
    speed: 0.3,
    xp_reward: 50,
    attack_range: 45,
    detection_range: 150,
  },
  screamer: {
    max_health: 40,
    damage: 5,
    speed: 1.0,
    xp_reward: 30,
    attack_range: 30,
    detection_range: 350,
  },
};

// Pesos para selecionar tipo de zumbi
export const ZOMBIE_SPAWN_WEIGHTS: Record<ZombieType, number> = {
  walker: 55,
  runner: 25,
  tank: 10,
  screamer: 10,
};

// Seleciona tipo de zumbi aleatoriamente
export function randomZombieType(): ZombieType {
  const rand = Math.random() * 100;
  let accumulated = 0;
  for (const [type, weight] of Object.entries(ZOMBIE_SPAWN_WEIGHTS)) {
    accumulated += weight;
    if (rand < accumulated) return type as ZombieType;
  }
  return 'walker';
}

// Calcula dano do player em um zumbi
export function calculatePlayerDamage(
  player: Player,
  weapon: InventoryItem | null
): { damage: number; isCrit: boolean; missed: boolean } {
  // Base damage
  let baseDamage = 5 + player.strength * 2;

  // Dano da arma
  let weaponDamage = 0;
  let weaponPrecision = 0;

  if (weapon && weapon.item_type === 'weapon') {
    weaponDamage = weapon.stats?.damage || 0;
    weaponPrecision = weapon.stats?.precision || 0;
  }

  // Chance de erro: base 20%, reduzida por precisão do player e da arma
  const totalPrecision = player.precision_stat + weaponPrecision;
  const missChance = Math.max(0.02, 0.25 - totalPrecision * 0.015);
  const missed = Math.random() < missChance;

  if (missed) return { damage: 0, isCrit: false, missed: true };

  // Chance de crítico: base 5%, +1% por ponto de agilidade
  const critChance = 0.05 + player.agility * 0.01;
  const isCrit = Math.random() < critChance;

  const totalDamage = Math.floor(
    (baseDamage + weaponDamage) * (isCrit ? 2.5 : 1) * (0.85 + Math.random() * 0.3)
  );

  return { damage: totalDamage, isCrit, missed: false };
}

// Calcula dano do zumbi no player
export function calculateZombieDamage(zombie: Zombie, player: Player): number {
  // Agilidade reduz dano recebido
  const damageReduction = Math.min(0.5, player.agility * 0.02);
  const damage = Math.floor(zombie.damage * (1 - damageReduction) * (0.8 + Math.random() * 0.4));
  return Math.max(1, damage);
}

// Distância entre dois pontos
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Verifica se zumbi pode atacar o player
export function canZombieAttack(zombie: Zombie, playerX: number, playerY: number): boolean {
  const stats = ZOMBIE_STATS[zombie.zombie_type as ZombieType];
  const dist = distance(zombie.pos_x, zombie.pos_y, playerX, playerY);
  return dist <= stats.attack_range;
}

// Verifica se zumbi detectou o player
export function zombieDetectsPlayer(zombie: Zombie, playerX: number, playerY: number): boolean {
  const stats = ZOMBIE_STATS[zombie.zombie_type as ZombieType];
  const dist = distance(zombie.pos_x, zombie.pos_y, playerX, playerY);
  return dist <= stats.detection_range;
}

// Move zumbi em direção ao player
export function moveZombieTowardsPlayer(
  zombie: Zombie,
  targetX: number,
  targetY: number,
  deltaTime: number
): { pos_x: number; pos_y: number; direction: number } {
  const stats = ZOMBIE_STATS[zombie.zombie_type as ZombieType];
  const dist = distance(zombie.pos_x, zombie.pos_y, targetX, targetY);

  if (dist < 1) return { pos_x: zombie.pos_x, pos_y: zombie.pos_y, direction: zombie.direction };

  const dx = (targetX - zombie.pos_x) / dist;
  const dy = (targetY - zombie.pos_y) / dist;

  const speed = stats.speed * deltaTime * 60;
  const newX = zombie.pos_x + dx * speed;
  const newY = zombie.pos_y + dy * speed;
  const direction = Math.atan2(dy, dx) * (180 / Math.PI);

  return { pos_x: newX, pos_y: newY, direction };
}

// Calcula XP necessário para o próximo nível
export function xpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Verifica level up
export function checkLevelUp(player: Player): { leveled: boolean; levelsGained: number; newPlayer: Player } {
  let p = { ...player };
  let leveled = false;
  let levelsGained = 0;

  while (p.xp >= p.xp_to_next) {
    p.xp -= p.xp_to_next;
    p.level += 1;
    p.xp_to_next = xpToNextLevel(p.level);
    p.max_health += 10;
    p.current_health = Math.min(p.current_health + 20, p.max_health);
    p.max_stamina += 5;
    p.strength += 1;
    p.agility += 1;
    p.precision_stat += 1;
    leveled = true;
    levelsGained++;
  }

  return { leveled, levelsGained, newPlayer: p };
}

// Gera spawn de horda (screamer chamou zumbis)
export function generateHorde(centerX: number, centerY: number, count: number = 8): Array<{
  pos_x: number;
  pos_y: number;
  zombie_type: ZombieType;
}> {
  const horde = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const radius = 150 + Math.random() * 100;
    const zombie_type = Math.random() < 0.7 ? 'walker' : 'runner';
    horde.push({
      pos_x: centerX + Math.cos(angle) * radius,
      pos_y: centerY + Math.sin(angle) * radius,
      zombie_type: zombie_type as ZombieType,
    });
  }
  return horde;
}
