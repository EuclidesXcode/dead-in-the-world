import seedrandom from 'seedrandom';
import { TileType, ItemType, ItemRarity, InventoryItem } from './supabase';
import { TILE_LOOT_CONFIG } from './mapGenerator';

// Definição completa de todos os itens do jogo
export const ITEM_DATABASE: Record<string, {
  item_id: string;
  item_name: string;
  item_type: ItemType;
  weight: number;
  rarity: ItemRarity;
  stats: Record<string, any>;
  description: string;
  emoji: string;
}> = {
  // ---- ARMAS ----
  knife: {
    item_id: 'knife', item_name: 'Faca de Combate', item_type: 'weapon',
    weight: 0.5, rarity: 'common',
    stats: { damage: 15, range: 35, precision: 2, fire_rate: 1.5, ammo_type: null },
    description: 'Silenciosa e eficaz no corpo a corpo', emoji: '🔪',
  },
  pistol: {
    item_id: 'pistol', item_name: 'Pistola 9mm', item_type: 'weapon',
    weight: 1.2, rarity: 'common',
    stats: { damage: 25, range: 150, precision: 5, fire_rate: 2, ammo_type: 'ammo_9mm', magazine: 15 },
    description: 'Arma de fogo confiável para curto alcance', emoji: '🔫',
  },
  shotgun: {
    item_id: 'shotgun', item_name: 'Escopeta', item_type: 'weapon',
    weight: 3.5, rarity: 'uncommon',
    stats: { damage: 60, range: 80, precision: -2, fire_rate: 0.7, ammo_type: 'ammo_shotgun', magazine: 6 },
    description: 'Devastadora a curta distância', emoji: '🔫',
  },
  rifle: {
    item_id: 'rifle', item_name: 'Fuzil de Assalto', item_type: 'weapon',
    weight: 4.0, rarity: 'rare',
    stats: { damage: 35, range: 250, precision: 8, fire_rate: 5, ammo_type: 'ammo_rifle', magazine: 30 },
    description: 'Alta cadência, perfeito para hordas', emoji: '🔫',
  },
  sniper: {
    item_id: 'sniper', item_name: 'Rifle de Francatirador', item_type: 'weapon',
    weight: 6.0, rarity: 'epic',
    stats: { damage: 150, range: 500, precision: 20, fire_rate: 0.3, ammo_type: 'ammo_rifle', magazine: 5 },
    description: 'Um tiro, uma morte', emoji: '🔭',
  },
  bat: {
    item_id: 'bat', item_name: 'Taco de Beisebol', item_type: 'weapon',
    weight: 1.5, rarity: 'common',
    stats: { damage: 22, range: 38, precision: 3, fire_rate: 1.2, ammo_type: null },
    description: 'Clássico para afastar zumbis', emoji: '⚾',
  },
  machete: {
    item_id: 'machete', item_name: 'Facão', item_type: 'weapon',
    weight: 1.0, rarity: 'uncommon',
    stats: { damage: 30, range: 40, precision: 4, fire_rate: 1.3, ammo_type: null },
    description: 'Corta e racha com facilidade', emoji: '🗡️',
  },

  // ---- MUNIÇÃO ----
  ammo_9mm: {
    item_id: 'ammo_9mm', item_name: 'Munição 9mm', item_type: 'ammo',
    weight: 0.05, rarity: 'common',
    stats: { ammo_type: 'ammo_9mm', quantity_per_pickup: 15 },
    description: 'Para pistolas', emoji: '🔶',
  },
  ammo_shotgun: {
    item_id: 'ammo_shotgun', item_name: 'Cartucho de Escopeta', item_type: 'ammo',
    weight: 0.1, rarity: 'uncommon',
    stats: { ammo_type: 'ammo_shotgun', quantity_per_pickup: 6 },
    description: 'Para escopetas', emoji: '🔶',
  },
  ammo_rifle: {
    item_id: 'ammo_rifle', item_name: 'Munição .308', item_type: 'ammo',
    weight: 0.08, rarity: 'rare',
    stats: { ammo_type: 'ammo_rifle', quantity_per_pickup: 10 },
    description: 'Para rifles e snipers', emoji: '🔷',
  },

  // ---- CURA ----
  bandage: {
    item_id: 'bandage', item_name: 'Atadura', item_type: 'heal',
    weight: 0.3, rarity: 'common',
    stats: { heal_amount: 15, use_time: 1.5 },
    description: 'Recupera pouca vida rapidamente', emoji: '🩹',
  },
  medkit: {
    item_id: 'medkit', item_name: 'Kit Médico', item_type: 'heal',
    weight: 1.5, rarity: 'uncommon',
    stats: { heal_amount: 60, use_time: 3.0 },
    description: 'Tratamento completo de ferimentos', emoji: '🧰',
  },
  pain_meds: {
    item_id: 'pain_meds', item_name: 'Analgésico', item_type: 'heal',
    weight: 0.1, rarity: 'common',
    stats: { heal_amount: 25, use_time: 1.0 },
    description: 'Alivia a dor e recupera vida', emoji: '💊',
  },
  morphine: {
    item_id: 'morphine', item_name: 'Morfina', item_type: 'heal',
    weight: 0.2, rarity: 'rare',
    stats: { heal_amount: 100, use_time: 2.0 },
    description: 'Recuperação completa de vida', emoji: '💉',
  },

  // ---- COMIDA E ÁGUA ----
  canned_food: {
    item_id: 'canned_food', item_name: 'Comida Enlatada', item_type: 'food',
    weight: 0.5, rarity: 'common',
    stats: { stamina_restore: 20 },
    description: 'Recupera stamina', emoji: '🥫',
  },
  energy_bar: {
    item_id: 'energy_bar', item_name: 'Barra de Energia', item_type: 'food',
    weight: 0.1, rarity: 'common',
    stats: { stamina_restore: 10 },
    description: 'Recupera stamina rapidamente', emoji: '🍫',
  },
  water_bottle: {
    item_id: 'water_bottle', item_name: 'Garrafa d\'água', item_type: 'water',
    weight: 1.0, rarity: 'common',
    stats: { stamina_restore: 30 },
    description: 'Hidratação essencial', emoji: '💧',
  },

  // ---- UPGRADES DE ARMA ----
  silencer: {
    item_id: 'silencer', item_name: 'Silenciador', item_type: 'upgrade',
    weight: 0.3, rarity: 'rare',
    stats: { noise_reduction: 0.8, damage_mod: -2, compatible: ['pistol', 'rifle'] },
    description: 'Reduz ruído ao atirar', emoji: '🔇',
  },
  extended_mag: {
    item_id: 'extended_mag', item_name: 'Pente Estendido', item_type: 'upgrade',
    weight: 0.4, rarity: 'uncommon',
    stats: { magazine_mod: 15, compatible: ['pistol', 'shotgun', 'rifle'] },
    description: 'Aumenta capacidade do carregador', emoji: '📦',
  },
  scope: {
    item_id: 'scope', item_name: 'Mira Telescópica', item_type: 'upgrade',
    weight: 0.5, rarity: 'rare',
    stats: { range_mod: 100, precision_mod: 10, compatible: ['rifle', 'sniper'] },
    description: 'Aumenta alcance e precisão', emoji: '🔭',
  },
  grip: {
    item_id: 'grip', item_name: 'Empunhadura Tática', item_type: 'upgrade',
    weight: 0.2, rarity: 'uncommon',
    stats: { precision_mod: 5, recoil_mod: 0.8, compatible: ['pistol', 'rifle', 'shotgun'] },
    description: 'Melhora controle da arma', emoji: '🖐️',
  },

  // ---- MATERIAIS ----
  scrap_metal: {
    item_id: 'scrap_metal', item_name: 'Sucata de Metal', item_type: 'material',
    weight: 2.0, rarity: 'common',
    stats: { craft_value: 1 },
    description: 'Usado para construção e reparos', emoji: '🔩',
  },
  cloth: {
    item_id: 'cloth', item_name: 'Pano', item_type: 'material',
    weight: 0.3, rarity: 'common',
    stats: { craft_value: 1 },
    description: 'Pode virar bandagem', emoji: '🧵',
  },
  gunpowder: {
    item_id: 'gunpowder', item_name: 'Pólvora Escura', item_type: 'material',
    weight: 0.1, rarity: 'uncommon',
    stats: { craft_value: 1 },
    description: 'Essencial pra fazer munição', emoji: '🧨',
  },
  // ---- EXPLOSIVOS (ARREMESSÁVEIS) ----
  grenade: {
    item_id: 'grenade', item_name: 'Granada de Fragmentação', item_type: 'explosive',
    weight: 1.0, rarity: 'rare',
    stats: { damage: 250, explosion_radius: 120, throw_range: 250 },
    description: 'Dano em área devastador.', emoji: '💣',
  },
  
  // ---- ARMAS AVANÇADAS ----
  plasma_rifle: {
    item_id: 'plasma_rifle', item_name: 'Fuzil de Plasma', item_type: 'weapon',
    weight: 5.0, rarity: 'epic',
    stats: { damage: 45, range: 350, precision: 12, fire_rate: 6, ammo_type: 'energy_cell', magazine: 40, projectile_size: 6, bullet_type: 'plasma' },
    description: 'Tecnologia experimental. Dispara pulsos energizados.', emoji: '🔫',
  },
  magnum: {
    item_id: 'magnum', item_name: 'Magnum .44', item_type: 'weapon',
    weight: 1.8, rarity: 'rare',
    stats: { damage: 85, range: 200, precision: 10, fire_rate: 1.2, ammo_type: 'ammo_9mm', magazine: 6, projectile_size: 4, bullet_type: 'heavy' },
    description: 'Poder de parada massivo em uma mão.', emoji: '🔫',
  },
  rocket_launcher: {
    item_id: 'rocket_launcher', item_name: 'Lança-Foguetes RPG', item_type: 'weapon',
    weight: 8.0, rarity: 'legendary',
    stats: { damage: 250, range: 400, precision: 5, fire_rate: 0.2, ammo_type: 'rocket', magazine: 1, projectile_size: 10, bullet_type: 'rocket', splash_radius: 120 },
    description: 'Para quando você cansa de fugir.', emoji: '🚀',
  },
  railgun: {
    item_id: 'railgun', item_name: 'Canhão Elétrico (Railgun)', item_type: 'weapon',
    weight: 7.5, rarity: 'legendary',
    stats: { damage: 500, range: 800, precision: 30, fire_rate: 0.1, ammo_type: 'energy_cell', magazine: 1, projectile_size: 2, bullet_type: 'rail', pierce: true },
    description: 'Aceleração magnética capaz de atravessar colunas de concreto.', emoji: '⚡',
  },

  // ---- MUNIÇÃO AVANÇADA ----
  energy_cell: {
    item_id: 'energy_cell', item_name: 'Célula de Energia', item_type: 'ammo',
    weight: 0.05, rarity: 'rare',
    stats: { ammo_type: 'energy_cell', quantity_per_pickup: 20 },
    description: 'Fonte de energia para armas de plasma e railguns.', emoji: '🔋',
  },
  rocket: {
    item_id: 'rocket', item_name: 'Míssil HE', item_type: 'ammo',
    weight: 1.0, rarity: 'epic',
    stats: { ammo_type: 'rocket', quantity_per_pickup: 1 },
    description: 'Projétil explosivo de alto impacto.', emoji: '🚀',
  },

  // ---- MATERIAIS ADICIONAIS ----
  electronics: {
    item_id: 'electronics', item_name: 'Componentes Eletrônicos', item_type: 'material',
    weight: 0.2, rarity: 'rare',
    stats: { craft_value: 1 },
    description: 'Circuitos necessários para upgrades de alta tecnologia.', emoji: '💾',
  },
  drone: {
    item_id: 'drone', item_name: 'Controle de Drone', item_type: 'utility',
    weight: 0.8, rarity: 'rare',
    stats: { zoom_out: 0.5, duration: 10000 },
    description: 'Visualiza a área de cima (Zoom Out) por 10s', emoji: '🎮',
  },
};

// Tabelas de loot por tipo de tile
const LOOT_TABLES: Record<TileType, Array<{ item_id: string; weight: number; quantity: [number, number] }>> = {
  street: [
    { item_id: 'ammo_9mm', weight: 30, quantity: [5, 20] },
    { item_id: 'canned_food', weight: 25, quantity: [1, 3] },
    { item_id: 'scrap_metal', weight: 25, quantity: [1, 4] },
    { item_id: 'bandage', weight: 15, quantity: [1, 2] },
    { item_id: 'bat', weight: 5, quantity: [1, 1] },
  ],
  building: [
    { item_id: 'canned_food', weight: 30, quantity: [1, 4] },
    { item_id: 'water_bottle', weight: 25, quantity: [1, 3] },
    { item_id: 'bandage', weight: 20, quantity: [1, 3] },
    { item_id: 'scrap_metal', weight: 15, quantity: [2, 5] },
    { item_id: 'knife', weight: 10, quantity: [1, 1] },
    { item_id: 'drone', weight: 3, quantity: [1, 1] },
  ],
  hospital: [
    { item_id: 'medkit', weight: 35, quantity: [1, 2] },
    { item_id: 'morphine', weight: 15, quantity: [1, 1] },
    { item_id: 'pain_meds', weight: 25, quantity: [2, 5] },
    { item_id: 'bandage', weight: 20, quantity: [3, 8] },
    { item_id: 'extended_mag', weight: 5, quantity: [1, 1] },
  ],
  market: [
    { item_id: 'canned_food', weight: 35, quantity: [2, 6] },
    { item_id: 'water_bottle', weight: 30, quantity: [2, 5] },
    { item_id: 'energy_bar', weight: 15, quantity: [2, 5] },
    { item_id: 'electronics', weight: 8, quantity: [1, 2] },
    { item_id: 'ammo_9mm', weight: 10, quantity: [5, 15] },
    { item_id: 'knife', weight: 5, quantity: [1, 1] },
    { item_id: 'drone', weight: 5, quantity: [1, 1] },
  ],
  military_base: [
    { item_id: 'rifle', weight: 20, quantity: [1, 1] },
    { item_id: 'ammo_rifle', weight: 30, quantity: [10, 30] },
    { item_id: 'ammo_9mm', weight: 20, quantity: [15, 40] },
    { item_id: 'gunpowder', weight: 15, quantity: [2, 5] },
    { item_id: 'railgun', weight: 1, quantity: [1, 1] },
    { item_id: 'plasma_rifle', weight: 5, quantity: [1, 1] },
    { item_id: 'rocket_launcher', weight: 2, quantity: [1, 1] },
    { item_id: 'energy_cell', weight: 15, quantity: [10, 30] },
    { item_id: 'rocket', weight: 8, quantity: [1, 2] },
    { item_id: 'electronics', weight: 12, quantity: [1, 3] },
    { item_id: 'drone', weight: 5, quantity: [1, 1] },
  ],
  forest: [
    { item_id: 'canned_food', weight: 40, quantity: [1, 3] },
    { item_id: 'water_bottle', weight: 30, quantity: [1, 2] },
    { item_id: 'cloth', weight: 20, quantity: [2, 5] },
    { item_id: 'bandage', weight: 10, quantity: [1, 2] },
  ],
  river: [
    { item_id: 'water_bottle', weight: 50, quantity: [1, 3] },
    { item_id: 'canned_food', weight: 30, quantity: [1, 2] },
    { item_id: 'cloth', weight: 20, quantity: [1, 3] },
  ],
  ruins: [
    { item_id: 'ammo_9mm', weight: 25, quantity: [5, 20] },
    { item_id: 'ammo_shotgun', weight: 15, quantity: [3, 8] },
    { item_id: 'scrap_metal', weight: 25, quantity: [3, 8] },
    { item_id: 'shotgun', weight: 8, quantity: [1, 1] },
    { item_id: 'magnum', weight: 5, quantity: [1, 1] },
    { item_id: 'machete', weight: 12, quantity: [1, 1] },
    { item_id: 'bandage', weight: 15, quantity: [1, 3] },
  ],
  abandoned: [
    { item_id: 'pistol', weight: 15, quantity: [1, 1] },
    { item_id: 'ammo_9mm', weight: 25, quantity: [8, 20] },
    { item_id: 'gunpowder', weight: 15, quantity: [1, 3] },
    { item_id: 'pain_meds', weight: 20, quantity: [1, 4] },
    { item_id: 'canned_food', weight: 25, quantity: [1, 3] },
    { item_id: 'grip', weight: 15, quantity: [1, 1] },
  ],
};

// Gera loot quando um zumbi morre
export function generateZombieDrop(zx: number, zy: number): any | null {
  const chance = Math.random();
  if (chance > 0.35) return null; // 35% de chance de drop

  const rng = Math.random();
  const dropTable: Array<{ item_id: string; weight: number }> = [
    { item_id: 'ammo_9mm', weight: 40 },
    { item_id: 'bandage', weight: 25 },
    { item_id: 'pain_meds', weight: 15 },
    { item_id: 'ammo_shotgun', weight: 10 },
    { item_id: 'canned_food', weight: 8 },
    { item_id: 'pistol', weight: 2 },
    { item_id: 'electronics', weight: 1 },
    { item_id: 'magnum', weight: 0.5 },
    { item_id: 'plasma_rifle', weight: 0.1 },
  ];

  const totalWeight = dropTable.reduce((s, i) => s + i.weight, 0);
  let pivot = Math.random() * totalWeight;
  let selectedId = 'ammo_9mm';
  for (const entry of dropTable) {
    pivot -= entry.weight;
    if (pivot <= 0) { selectedId = entry.item_id; break; }
  }

  const itemDef = ITEM_DATABASE[selectedId];
  if (!itemDef) return null;

  return {
    id: Math.random().toString(36).slice(2),
    item_id: itemDef.item_id,
    item_name: itemDef.item_name,
    item_type: itemDef.item_type,
    quantity: itemDef.item_type === 'ammo' ? 8 : 1,
    weight: itemDef.weight,
    rarity: itemDef.rarity,
    stats: itemDef.stats,
    pos_x: Number(zx.toFixed(1)),
    pos_y: Number(zy.toFixed(1)),
    tile_x: 0, // Não importa pro sistema de render atual do canvas
    tile_y: 0,
  };
}

export function generateTileLoot(
  tile_type: TileType,
  tile_x: number,
  tile_y: number,
  count: number = 3
): Array<{
  item_id: string;
  item_name: string;
  item_type: ItemType;
  quantity: number;
  weight: number;
  rarity: ItemRarity;
  stats: Record<string, any>;
  pos_x: number;
  pos_y: number;
}> {
  const table = LOOT_TABLES[tile_type] || LOOT_TABLES.street;
  const rng = seedrandom(`loot_${tile_x}_${tile_y}`);
  const items = [];

  const totalWeight = table.reduce((sum, item) => sum + item.weight, 0);

  for (let i = 0; i < count; i++) {
    // Seleciona item baseado em peso
    let rand = rng() * totalWeight;
    let selected = table[0];
    for (const entry of table) {
      rand -= entry.weight;
      if (rand <= 0) { selected = entry; break; }
    }

    const itemDef = ITEM_DATABASE[selected.item_id];
    if (!itemDef) continue;

    const quantity = Math.floor(
      rng() * (selected.quantity[1] - selected.quantity[0] + 1) + selected.quantity[0]
    );

    items.push({
      item_id: itemDef.item_id,
      item_name: itemDef.item_name,
      item_type: itemDef.item_type,
      quantity,
      weight: itemDef.weight,
      rarity: itemDef.rarity,
      stats: itemDef.stats,
      pos_x: Number((rng() * 420 + 40).toFixed(1)),
      pos_y: Number((rng() * 420 + 40).toFixed(1)),
    });
  }

  return items;
}

// Peso máximo do inventário
export const MAX_INVENTORY_SLOTS = 300;
export const EXPANDED_INVENTORY_SLOTS = 1000;

// Calcula peso total do inventário
export function calculateInventorySlots(items: InventoryItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

// Verifica se pode pegar item
export function canPickupItem(
  currentItems: InventoryItem[],
  newItem: { quantity: number },
  hasExpanded: boolean = false
): boolean {
  const currentSlots = calculateInventorySlots(currentItems);
  const maxSlots = hasExpanded ? EXPANDED_INVENTORY_SLOTS : MAX_INVENTORY_SLOTS;
  return currentSlots + newItem.quantity <= maxSlots;
}

// Informações de raridade
export const RARITY_CONFIG: Record<ItemRarity, { color: string; label: string; glowColor: string }> = {
  common: { color: '#9ca3af', label: 'Comum', glowColor: 'rgba(156,163,175,0.3)' },
  uncommon: { color: '#22c55e', label: 'Incomum', glowColor: 'rgba(34,197,94,0.3)' },
  rare: { color: '#3b82f6', label: 'Raro', glowColor: 'rgba(59,130,246,0.3)' },
  epic: { color: '#a855f7', label: 'Épico', glowColor: 'rgba(168,85,247,0.3)' },
  legendary: { color: '#f59e0b', label: 'Lendário', glowColor: 'rgba(245,158,11,0.3)' },
};
