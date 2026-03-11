import { create } from 'zustand';
import { Player, MapTile, Zombie, InventoryItem, WorldItem, ChatMessage } from './supabase';

interface DamageNumber {
  id: string;
  x: number;
  y: number;
  damage: number;
  isCrit: boolean;
  isHeal?: boolean;
  createdAt: number;
}

interface GameState {
  // Auth
  userId: string | null;
  setUserId: (id: string | null) => void;

  // Player
  player: Player | null;
  setPlayer: (player: Player | null) => void;
  updatePlayerStats: (updates: Partial<Player>) => void;

  // Online players
  onlinePlayers: Player[];
  setOnlinePlayers: (players: Player[]) => void;
  updateOnlinePlayer: (player: Player) => void;
  removeOnlinePlayer: (playerId: string) => void;

  // Map
  tiles: Map<string, MapTile>;
  setTile: (tile: MapTile) => void;
  setTiles: (tiles: MapTile[]) => void;

  // Viewport
  viewportX: number;
  viewportY: number;
  setViewport: (x: number, y: number) => void;
  playerPixelX: number;
  playerPixelY: number;
  setPlayerPixel: (x: number, y: number) => void;
  // Origin Tile for global relative pixel coords
  originTile: { x: number, y: number } | null;
  setOriginTile: (x: number, y: number) => void;

  // Zombies
  zombies: Map<string, Zombie>;
  setZombie: (zombie: Zombie) => void;
  setZombies: (zombies: Zombie[]) => void;
  removeZombie: (id: string) => void;

  // World Items
  worldItems: WorldItem[];
  setWorldItems: (items: WorldItem[]) => void;
  removeWorldItem: (id: string) => void;
  addWorldItem: (item: WorldItem) => void;

  // Inventory
  inventory: InventoryItem[];
  setInventory: (items: InventoryItem[]) => void;
  addInventoryItem: (item: InventoryItem) => void;
  removeInventoryItem: (id: string) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  equippedWeapon: InventoryItem | null;
  setEquippedWeapon: (weapon: InventoryItem | null) => void;
  equippedSecondaryWeapon: InventoryItem | null;
  setEquippedSecondaryWeapon: (weapon: InventoryItem | null) => void;

  // Ammo
  ammo: Record<string, number>;
  setAmmo: (type: string, amount: number) => void;
  useAmmo: (type: string, amount: number) => boolean;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;

  // UI State
  showInventory: boolean;
  toggleInventory: () => void;
  showLeaderboard: boolean;
  toggleLeaderboard: () => void;
  showCharCustomizer: boolean;
  toggleCharCustomizer: () => void;
  showWeaponUpgrade: boolean;
  toggleWeaponUpgrade: () => void;
  showChat: boolean;
  toggleChat: () => void;
  showMap: boolean;
  toggleMap: () => void;

  // Game State
  isGameRunning: boolean;
  setGameRunning: (running: boolean) => void;
  gameTime: number; // seconds since epoch
  setGameTime: (time: number) => void;

  // Damage Numbers (floating)
  damageNumbers: DamageNumber[];
  addDamageNumber: (dn: Omit<DamageNumber, 'id' | 'createdAt'>) => void;
  clearOldDamageNumbers: () => void;
  
  // Real-time lighting
  isNight: boolean;
  setIsNight: (isNight: boolean) => void;

  // Notifications
  notifications: Array<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'danger'; createdAt: number }>;
  addNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'danger') => void;
  clearNotification: (id: string) => void;
  activeWeaponSlot: 'primary' | 'secondary';
  setActiveWeaponSlot: (slot: 'primary' | 'secondary') => void;

  // Camera Zoom
  cameraZoom: number;
  setCameraZoom: (zoom: number) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  // Auth
  userId: null,
  setUserId: (id) => set({ userId: id }),

  // Player
  player: null,
  setPlayer: (player) => set({ player }),
  updatePlayerStats: (updates) =>
    set((state) => ({ player: state.player ? { ...state.player, ...updates } : null })),

  // Online players
  onlinePlayers: [],
  setOnlinePlayers: (onlinePlayers) => set({ onlinePlayers }),
  updateOnlinePlayer: (player) =>
    set((state) => ({
      onlinePlayers: state.onlinePlayers.some((p) => p.id === player.id)
        ? state.onlinePlayers.map((p) => (p.id === player.id ? player : p))
        : [...state.onlinePlayers, player],
    })),
  removeOnlinePlayer: (playerId) =>
    set((state) => ({
      onlinePlayers: state.onlinePlayers.filter((p) => p.id !== playerId),
    })),

  // Map
  tiles: new Map(),
  setTile: (tile) =>
    set((state) => {
      const tiles = new Map(state.tiles);
      tiles.set(`${tile.tile_x},${tile.tile_y}`, tile);
      return { tiles };
    }),
  setTiles: (newTiles) =>
    set((state) => {
      const tiles = new Map(state.tiles);
      newTiles.forEach((t) => tiles.set(`${t.tile_x},${t.tile_y}`, t));
      return { tiles };
    }),

  // Viewport
  viewportX: 0,
  viewportY: 0,
  setViewport: (viewportX, viewportY) => set({ viewportX, viewportY }),
  playerPixelX: 0,
  playerPixelY: 0,
  setPlayerPixel: (playerPixelX, playerPixelY) => set({ playerPixelX, playerPixelY }),
  originTile: null,
  setOriginTile: (x, y) => set({ originTile: { x, y } }),

  // Zombies
  zombies: new Map(),
  setZombie: (zombie) =>
    set((state) => {
      const zombies = new Map(state.zombies);
      zombies.set(zombie.id, zombie);
      return { zombies };
    }),
  setZombies: (newZombies) =>
    set((state) => {
      const zombies = new Map(state.zombies);
      newZombies.forEach((z) => zombies.set(z.id, z));
      return { zombies };
    }),
  removeZombie: (id) =>
    set((state) => {
      const zombies = new Map(state.zombies);
      zombies.delete(id);
      return { zombies };
    }),

  // World Items
  worldItems: [],
  setWorldItems: (worldItems) => set({ worldItems }),
  removeWorldItem: (id) =>
    set((state) => ({ worldItems: state.worldItems.filter((i) => i.id !== id) })),
  addWorldItem: (item) => set((state) => ({ worldItems: [...state.worldItems, item] })),

  // Inventory
  inventory: [],
  setInventory: (inventory) => set({ inventory }),
  addInventoryItem: (item) => set((state) => ({ inventory: [...state.inventory, item] })),
  removeInventoryItem: (id) =>
    set((state) => ({ inventory: state.inventory.filter((i) => i.id !== id) })),
  updateInventoryItem: (id, updates) =>
    set((state) => ({
      inventory: state.inventory.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    })),
  equippedWeapon: null,
  setEquippedWeapon: (equippedWeapon) => set({ equippedWeapon }),
  equippedSecondaryWeapon: null,
  setEquippedSecondaryWeapon: (equippedSecondaryWeapon) => set({ equippedSecondaryWeapon }),

  // Ammo
  ammo: {},
  setAmmo: (type, amount) =>
    set((state) => ({ ammo: { ...state.ammo, [type]: Math.max(0, amount) } })),
  useAmmo: (type, amount) => {
    const current = get().ammo[type] || 0;
    if (current < amount) return false;
    set((state) => ({ ammo: { ...state.ammo, [type]: current - amount } }));
    return true;
  },

  // Chat
  chatMessages: [],
  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-49), msg],
    })),

  // UI
  showInventory: false,
  toggleInventory: () => set((state) => ({ showInventory: !state.showInventory })),
  showLeaderboard: false,
  toggleLeaderboard: () => set((state) => ({ showLeaderboard: !state.showLeaderboard })),
  showCharCustomizer: false,
  toggleCharCustomizer: () => set((state) => ({ showCharCustomizer: !state.showCharCustomizer })),
  showWeaponUpgrade: false,
  toggleWeaponUpgrade: () => set((state) => ({ showWeaponUpgrade: !state.showWeaponUpgrade })),
  showChat: false,
  toggleChat: () => set((state) => ({ showChat: !state.showChat })),
  showMap: false,
  toggleMap: () => set((state) => ({ showMap: !state.showMap })),

  // Game
  isGameRunning: false,
  setGameRunning: (isGameRunning) => set({ isGameRunning }),
  gameTime: 0,
  setGameTime: (gameTime) => set({ gameTime }),

  // Damage Numbers
  damageNumbers: [],
  addDamageNumber: (dn) =>
    set((state) => ({
      damageNumbers: [
        ...state.damageNumbers,
        { ...dn, id: Math.random().toString(36).slice(2), createdAt: Date.now() },
      ],
    })),
  clearOldDamageNumbers: () =>
    set((state) => ({
      damageNumbers: state.damageNumbers.filter((dn) => Date.now() - dn.createdAt < 2000),
    })),

  // Lighting
  isNight: false,
  setIsNight: (isNight) => set({ isNight }),

  // Notifications
  notifications: [],
  addNotification: (message, type = 'info') =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id: Math.random().toString(36).slice(2), message, type, createdAt: Date.now() },
      ].slice(-5),
    })),
  clearNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  activeWeaponSlot: 'primary',
  setActiveWeaponSlot: (activeWeaponSlot) => set({ activeWeaponSlot }),

  // Camera Zoom
  cameraZoom: 1,
  setCameraZoom: (cameraZoom) => set({ cameraZoom }),
}));
