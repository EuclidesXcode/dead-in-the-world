'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '@/lib/store';
import { Zombie, Player } from '@/lib/supabase';
import { latLngToOsmTile, playerWorldPixelFromLatLng, getVisibleOsmTiles, getPrefetchOsmTiles, osmTileUrl, GAME_TILE_PX, OSM_ZOOM } from '@/lib/osmTiles';
import { distance, calculatePlayerDamage, calculateZombieDamage, checkLevelUp } from '@/lib/combat';
import { calcMaxZombies, createSpawnZombie, nextSpawnDelay } from '@/lib/zombieSpawner';
import { supabase } from '@/lib/supabase';
import PlayerSprite from './PlayerSprite';
import ZombieSprite from './ZombieSprite';

// ── Cache de imagens pre-carregadas ──
const tileImageCache = new Set<string>();

function preloadTile(url: string) {
  if (tileImageCache.has(url)) return;
  tileImageCache.add(url);
  const img = new Image();
  img.src = url;
}

export default function GameCanvas() {
  const {
    player, updatePlayerStats,
    tiles, setTile,
    zombies, setZombie, removeZombie, addZombie,
    worldItems, removeWorldItem,
    addInventoryItem, inventory,
    onlinePlayers,
    viewportX, viewportY, setViewport,
    playerPixelX, playerPixelY, setPlayerPixel,
    equippedWeapon, ammo, useAmmo,
    damageNumbers, addDamageNumber, clearOldDamageNumbers,
    addNotification,
    setEquippedWeapon,
  } = useGameStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const lastUpdateRef = useRef(Date.now());
  const lastAttackRef = useRef(0);
  const playerPosRef = useRef({ x: 0, y: 0 });
  const originTileRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isMoving, setIsMoving] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [playerDir, setPlayerDir] = useState(0);
  const [windowSize, setWindowSize] = useState({ w: 800, h: 600 });
  const [currentTarget, setCurrentTarget] = useState<string | null>(null);

  // ── Window size ──
  useEffect(() => {
    setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Inicializa posição do player usando lat/lng real → pixel OSM ──
  useEffect(() => {
    if (!player?.last_lat || !player?.last_lng) return;
    const { originTileX, originTileY, pixelX, pixelY } =
      playerWorldPixelFromLatLng(player.last_lat, player.last_lng);
    originTileRef.current = { x: originTileX, y: originTileY };
    playerPosRef.current = { x: pixelX, y: pixelY };
    setPlayerPixel(pixelX, pixelY);
  }, [player?.id]);

  // ── Teclado (WASD) ──
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      // Atalhos de UI
      const st = useGameStore.getState();
      if (e.code === 'KeyI') st.toggleInventory();
      if (e.code === 'KeyM') st.toggleMap();
      if (e.code === 'KeyC') st.toggleCharCustomizer();
      if (e.code === 'KeyU') st.toggleWeaponUpgrade();
      if (e.code === 'KeyT') st.toggleChat();
      if (e.code === 'KeyL') st.toggleLeaderboard();
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // ── Touch movement events ──
  useEffect(() => {
    const onTouchMove = (e: CustomEvent) => {
      const { dx, dy } = e.detail;
      if (Math.abs(dx) > 0.1) { dx > 0 ? keysRef.current.add('KeyD') : keysRef.current.add('KeyA'); }
      else { keysRef.current.delete('KeyD'); keysRef.current.delete('KeyA'); }
      if (Math.abs(dy) > 0.1) { dy > 0 ? keysRef.current.add('KeyS') : keysRef.current.add('KeyW'); }
      else { keysRef.current.delete('KeyS'); keysRef.current.delete('KeyW'); }
    };
    const onTouchStop = () => {
      ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach(k => keysRef.current.delete(k));
    };
    const onTouchAttack = () => { lastAttackRef.current = 0; }; // força próximo ataque
    window.addEventListener('touch-move', onTouchMove as any);
    window.addEventListener('touch-stop', onTouchStop);
    window.addEventListener('touch-attack', onTouchAttack);
    return () => {
      window.removeEventListener('touch-move', onTouchMove as any);
      window.removeEventListener('touch-stop', onTouchStop);
      window.removeEventListener('touch-attack', onTouchAttack);
    };
  }, []);

  // ── Sistema de Spawn ──
  const scheduleSpawn = useCallback(() => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    spawnTimerRef.current = setTimeout(() => {
      const state = useGameStore.getState();
      const p = state.player;
      if (!p) { scheduleSpawn(); return; }

      const aliveZombies = Array.from(state.zombies.values()).filter(z => z.is_alive);
      const onlineP = state.onlinePlayers;
      const avgLevel = onlineP.length > 0
        ? Math.round((p.level + onlineP.reduce((s, op) => s + op.level, 0)) / (onlineP.length + 1))
        : p.level;
      const maxZ = calcMaxZombies(avgLevel, onlineP.length + 1);

      if (aliveZombies.length < maxZ) {
        // Spawna 1-3 de uma vez
        const spawnCount = Math.min(
          Math.floor(Math.random() * 3) + 1,
          maxZ - aliveZombies.length
        );
        for (let i = 0; i < spawnCount; i++) {
          const newZombie = createSpawnZombie(
            playerPosRef.current.x, playerPosRef.current.y,
            originTileRef.current.x, originTileRef.current.y,
            avgLevel
          );
          addZombie(newZombie as any);
        }
      }
      scheduleSpawn();
    }, nextSpawnDelay());
  }, []);

  useEffect(() => {
    scheduleSpawn();
    return () => { if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current); };
  }, [scheduleSpawn]);

  // ── Auto-aim: encontra zumbi mais próximo no alcance ──
  const findNearestZombie = useCallback((px: number, py: number, range: number): Zombie | null => {
    const state = useGameStore.getState();
    let nearest: Zombie | null = null;
    let minDist = range;
    state.zombies.forEach((zombie) => {
      if (!zombie.is_alive) return;
      const d = distance(px, py, zombie.pos_x, zombie.pos_y);
      if (d < minDist) { minDist = d; nearest = zombie as Zombie; }
    });
    return nearest;
  }, []);

  // ── Auto-attack: dispara no alvo mais próximo ──
  const autoAttack = useCallback((p: Player, px: number, py: number) => {
    const now = Date.now();
    const weapon = useGameStore.getState().equippedWeapon;
    const fireRate = weapon?.stats?.fire_rate || 0.8;
    const cooldown = 1000 / fireRate;
    if (now - lastAttackRef.current < cooldown) return;

    const range = weapon?.stats?.range ? weapon.stats.range * 8 : 300; // range em pixels
    const target = findNearestZombie(px, py, range);
    if (!target) { setCurrentTarget(null); return; }

    setCurrentTarget(target.id);
    lastAttackRef.current = now;
    setIsAttacking(true);
    setTimeout(() => setIsAttacking(false), 100);

    // Aponta para o alvo
    const dx = target.pos_x - px;
    const dy = target.pos_y - py;
    setPlayerDir((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360);

    // Consome munição se necessário
    if (weapon?.stats?.ammo_type) {
      const ok = useGameStore.getState().useAmmo(weapon.stats.ammo_type, 1);
      if (!ok) { addNotification('Sem munição!', 'warning'); return; }
    }

    const { damage, isCrit, missed } = calculatePlayerDamage(p, weapon);
    const state = useGameStore.getState();

    addDamageNumber({
      x: target.pos_x - state.viewportX,
      y: target.pos_y - state.viewportY - 20,
      damage: missed ? 0 : damage,
      isCrit,
    });

    if (!missed) {
      const newHp = Math.max(0, target.current_health - damage);
      if (newHp <= 0) {
        setZombie({ ...target, is_alive: false, current_health: 0 });
        setCurrentTarget(null);
        setTimeout(() => removeZombie(target.id), 800);

        const newXp = p.xp + target.xp_reward;
        const result = checkLevelUp({ ...p, xp: newXp });
        updatePlayerStats({ kills: p.kills + 1, xp: result.newPlayer.xp, level: result.newPlayer.level });
        if (result.leveled) addNotification(`🎉 LEVEL UP! Nível ${result.newPlayer.level}!`, 'success');

        supabase.from('kill_log').insert({
          player_id: p.id,
          zombie_type: target.zombie_type,
          zombie_id: target.id,
          tile_x: target.tile_x,
          tile_y: target.tile_y,
          xp_gained: target.xp_reward,
          weapon_used: weapon?.item_id || 'fists',
        });
      } else {
        setZombie({ ...target, current_health: newHp });
      }
    }
  }, []);

  // ── Game Loop Principal ──
  useEffect(() => {
    const gameLoop = () => {
      const now = Date.now();
      const dt = Math.min((now - lastUpdateRef.current) / 1000, 0.05);
      lastUpdateRef.current = now;

      const p = useGameStore.getState().player;
      if (!p) { animFrameRef.current = requestAnimationFrame(gameLoop); return; }

      // Movimentação
      const speed = 80 * (1 + p.agility * 0.04);
      let dx = 0, dy = 0;
      const keys = keysRef.current;
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

      const moving = dx !== 0 || dy !== 0;
      setIsMoving(moving);

      if (moving) {
        const len = Math.sqrt(dx * dx + dy * dy);
        playerPosRef.current.x += (dx / len) * speed * dt;
        playerPosRef.current.y += (dy / len) * speed * dt;
        const newStamina = Math.max(0, p.current_stamina - dt * 6);
        if (newStamina !== p.current_stamina) updatePlayerStats({ current_stamina: newStamina });
        checkItemPickup();
      } else {
        const newStamina = Math.min(p.max_stamina, p.current_stamina + dt * 10);
        if (Math.abs(newStamina - p.current_stamina) > 0.1) updatePlayerStats({ current_stamina: newStamina });
      }

      const px = playerPosRef.current.x;
      const py = playerPosRef.current.y;
      setPlayerPixel(px, py);

      // Viewport
      const { w, h } = useWindowSize();
      setViewport(px - w / 2, py - h / 2);

      // Auto-attack
      autoAttack(p, px, py);

      // Atualiza zumbis
      updateZombies(dt, p, px, py);

      // Pre-load tiles OSM
      prefetchNearbyTiles();

      clearOldDamageNumbers();
      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [windowSize]);

  const useWindowSize = () => windowSize;

  const prefetchNearbyTiles = useCallback(() => {
    const state = useGameStore.getState();
    const tiles = getPrefetchOsmTiles(
      state.viewportX, state.viewportY,
      windowSize.w, windowSize.h,
      originTileRef.current.x, originTileRef.current.y,
      3
    );
    tiles.forEach(({ tileX, tileY }) => {
      preloadTile(osmTileUrl(tileX, tileY));
    });
  }, [windowSize]);

  const checkItemPickup = useCallback(() => {
    const state = useGameStore.getState();
    const px = playerPosRef.current.x;
    const py = playerPosRef.current.y;
    state.worldItems.forEach((item) => {
      if (distance(px, py, item.pos_x, item.pos_y) < 40) {
        removeWorldItem(item.id);
        addInventoryItem({
          id: crypto.randomUUID(),
          player_id: state.player?.id || '',
          item_type: item.item_type,
          item_id: item.item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          weight: item.weight,
          rarity: item.rarity,
          stats: item.stats || {},
          equipped: false,
          upgrades: [],
          durability: 100,
        });
        addNotification(`Coletou: ${item.item_name}`, 'info');
        if (item.item_type === 'weapon' && !state.equippedWeapon) {
          setEquippedWeapon({ ...item, id: crypto.randomUUID(), player_id: state.player?.id || '', equipped: true, upgrades: [], durability: 100 });
        }
      }
    });
  }, []);

  const updateZombies = useCallback((dt: number, p: Player, px: number, py: number) => {
    const state = useGameStore.getState();
    state.zombies.forEach((zombie) => {
      if (!zombie.is_alive) return;
      const d = distance(zombie.pos_x, zombie.pos_y, px, py);
      if (d < 600) {
        if (d < 40) {
          // Ataca player
          const dmg = calculateZombieDamage(zombie as any, p);
          const newHp = Math.max(0, p.current_health - dmg * dt);
          if (Math.abs(newHp - p.current_health) > 0.05) updatePlayerStats({ current_health: newHp });
        } else {
          // Move em direção ao player
          const ddx = (px - zombie.pos_x) / d;
          const ddy = (py - zombie.pos_y) / d;
          const spd = (zombie.speed * 50) * dt;
          setZombie({
            ...zombie,
            pos_x: zombie.pos_x + ddx * spd,
            pos_y: zombie.pos_y + ddy * spd,
            direction: Math.atan2(ddy, ddx) * 180 / Math.PI,
          });
        }
      }
    });
  }, []);

  if (!player) return null;

  const { w, h } = windowSize;

  // ── Calcula tiles OSM visíveis ──
  const visibleTiles = getVisibleOsmTiles(
    viewportX, viewportY, w, h,
    originTileRef.current.x, originTileRef.current.y
  );

  return (
    <div
      ref={canvasRef}
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#1a1a1a' }}
    >
      {/* ── Mapa Real OSM ── */}
      {visibleTiles.map(({ tileX, tileY, worldX, worldY }) => {
        const screenX = worldX - viewportX;
        const screenY = worldY - viewportY;
        return (
          <img
            key={`${tileX}-${tileY}`}
            src={osmTileUrl(tileX, tileY)}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              width: GAME_TILE_PX,
              height: GAME_TILE_PX,
              imageRendering: 'auto',
              // Aplica tint escuro de apocalipse em cima do mapa
              filter: 'brightness(0.65) saturate(0.7) sepia(0.2)',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        );
      })}

      {/* ── Overlay escuro de apocalipse ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(10, 5, 5, 0.25)',
        pointerEvents: 'none',
        mixBlendMode: 'multiply',
      }} />

      {/* ── Scanlines ── */}
      <div className="scanlines" />

      {/* ── Items no mundo ── */}
      {useGameStore.getState().worldItems.map((item) => {
        const sx = item.pos_x - viewportX;
        const sy = item.pos_y - viewportY;
        if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) return null;
        return (
          <div key={item.id} style={{
            position: 'absolute', left: sx - 14, top: sy - 14,
            width: 28, height: 28,
            background: 'rgba(0,0,0,0.85)',
            border: `2px solid ${rarityColor(item.rarity)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, borderRadius: 2,
            animation: 'float 2s ease-in-out infinite',
            boxShadow: `0 0 10px ${rarityColor(item.rarity)}66`,
            zIndex: 50,
          }}>
            {itemEmoji(item.item_id)}
          </div>
        );
      })}

      {/* ── Zumbis ── */}
      {Array.from(zombies.values()).map((zombie) => {
        if (!zombie.is_alive) return null;
        const sx = zombie.pos_x - viewportX;
        const sy = zombie.pos_y - viewportY;
        if (sx < -100 || sx > w + 100 || sy < -100 || sy > h + 100) return null;
        const isTarget = currentTarget === zombie.id;
        return (
          <div key={zombie.id} style={{ position: 'absolute', left: sx - 16, top: sy - 44, zIndex: 80 }}>
            {/* Marcador de alvo */}
            {isTarget && (
              <div style={{
                position: 'absolute', top: -12, left: 4,
                width: 24, height: 12, textAlign: 'center',
                fontSize: 9, color: '#dc2626',
                fontFamily: "'Press Start 2P', monospace",
                animation: 'pulse-red 0.5s ease-in-out infinite',
              }}>▼</div>
            )}
            <ZombieSprite
              zombieType={zombie.zombie_type as any}
              health={zombie.current_health}
              maxHealth={zombie.max_health}
              direction={zombie.direction}
              isMoving={true}
              scale={1}
              showHealthBar={true}
            />
          </div>
        );
      })}

      {/* ── Outros jogadores online ── */}
      {onlinePlayers.map((op) => {
        if (op.id === player.id || !op.last_lat || !op.last_lng) return null;
        const { pixelX: opX, pixelY: opY } = playerWorldPixelFromLatLng(op.last_lat, op.last_lng);
        const sx = opX - viewportX;
        const sy = opY - viewportY;
        if (sx < -100 || sx > w + 100 || sy < -100 || sy > h + 100) return null;
        return (
          <div key={op.id} style={{ position: 'absolute', left: sx - 16, top: sy - 44, zIndex: 90 }}>
            <PlayerSprite
              skinColor={op.skin_color} hairColor={op.hair_color}
              shirtColor={op.shirt_color} pantsColor={op.pants_color}
              username={op.username} showHealthBar health={op.current_health}
              maxHealth={op.max_health} scale={1} isLocal={false}
            />
          </div>
        );
      })}

      {/* ── Player local ── */}
      <div style={{
        position: 'absolute',
        left: playerPixelX - viewportX - 16,
        top: playerPixelY - viewportY - 44,
        zIndex: 100,
      }}>
        <PlayerSprite
          skinColor={player.skin_color} hairColor={player.hair_color}
          shirtColor={player.shirt_color} pantsColor={player.pants_color}
          direction={playerDir} isMoving={isMoving} isAttacking={isAttacking}
          health={player.current_health} maxHealth={player.max_health}
          showHealthBar={false} scale={1} isLocal username={player.username}
        />
      </div>

      {/* ── Damage Numbers ── */}
      {damageNumbers.map((dn) => (
        <div key={dn.id}
          className={`damage-number ${dn.isCrit ? 'crit' : dn.isHeal ? 'heal' : dn.damage === 0 ? 'miss' : 'normal'}`}
          style={{ left: dn.x, top: dn.y, position: 'absolute', zIndex: 300 }}
        >
          {dn.damage === 0 ? 'MISS' : dn.isCrit ? `⚡${dn.damage}!` : dn.isHeal ? `+${dn.damage}` : dn.damage}
        </div>
      ))}

      {/* ── Atribuição OSM (obrigatória por licença) ── */}
      <div style={{
        position: 'absolute', bottom: 24, right: 8, zIndex: 500,
        fontSize: 9, color: 'rgba(255,255,255,0.35)',
        fontFamily: 'Arial, sans-serif', pointerEvents: 'none',
      }}>
        © OpenStreetMap contributors
      </div>
    </div>
  );
}

function rarityColor(r: string) {
  return ({ common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' } as any)[r] || '#9ca3af';
}
function itemEmoji(id: string) {
  return ({ pistol: '🔫', shotgun: '🔫', rifle: '🔫', knife: '🔪', machete: '🗡️', bat: '⚾', bandage: '🩹', medkit: '🧰', pain_meds: '💊', canned_food: '🥫', water_bottle: '💧', ammo_9mm: '🔶', ammo_shotgun: '🔶', ammo_rifle: '🔷' } as any)[id] || '📦';
}
