import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

// Auth helpers
export const signInWithGoogle = async () => {
  // Usa a origem atual — funciona em localhost, Vercel e domínio customizado
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Types
export type TileType =
  | 'street'
  | 'building'
  | 'hospital'
  | 'market'
  | 'military_base'
  | 'forest'
  | 'river'
  | 'ruins'
  | 'abandoned';

export type ZombieType = 'walker' | 'runner' | 'tank' | 'screamer' | 'leaper';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemType = 'weapon' | 'ammo' | 'heal' | 'food' | 'water' | 'upgrade' | 'material';

export interface Player {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  level: number;
  xp: number;
  xp_to_next: number;
  max_health: number;
  current_health: number;
  max_stamina: number;
  current_stamina: number;
  strength: number;
  agility: number;
  precision_stat: number;
  skin_color: string;
  hair_color: string;
  shirt_color: string;
  pants_color: string;
  last_lat: number;
  last_lng: number;
  tile_x: number;
  tile_y: number;
  kills: number;
  tiles_explored: number;
  items_collected: number;
  deaths: number;
  is_online: boolean;
  last_seen: string;
  custom_css?: string;
  has_css_access: boolean;
  created_at: string;
}

export interface MapTile {
  id: string;
  tile_x: number;
  tile_y: number;
  center_lat: number;
  center_lng: number;
  tile_type: TileType;
  explored_by?: string;
  explored_at?: string;
  has_loot: boolean;
  loot_collected: boolean;
  zombie_density: number;
  seed_value: number;
}

export interface Zombie {
  id: string;
  tile_x: number;
  tile_y: number;
  pos_x: number;
  pos_y: number;
  zombie_type: ZombieType;
  max_health: number;
  current_health: number;
  damage: number;
  speed: number;
  xp_reward: number;
  is_alive: boolean;
  target_player_id?: string;
  direction: number;
  is_jumping?: boolean;
  jump_cooldown?: number;
  jump_progress?: number;
}

export interface InventoryItem {
  id: string;
  player_id: string;
  item_type: ItemType;
  item_id: string;
  item_name: string;
  quantity: number;
  weight: number;
  durability?: number;
  upgrades?: string[];
  equipped?: boolean;
  rarity: ItemRarity;
  stats: Record<string, any>;
}

export interface WorldItem {
  id: string;
  tile_x: number;
  tile_y: number;
  pos_x: number;
  pos_y: number;
  item_type: ItemType;
  item_id: string;
  item_name: string;
  quantity: number;
  weight: number;
  rarity: ItemRarity;
  stats: Record<string, any>;
  expires_at: string;
}

export interface ChatMessage {
  id: string;
  player_id: string;
  player_name: string;
  message: string;
  msg_type: 'global' | 'system' | 'action';
  created_at: string;
}

export interface GameEvent {
  id: string;
  event_type: string;
  player_id?: string;
  payload: Record<string, any>;
  tile_x?: number;
  tile_y?: number;
  created_at: string;
}
