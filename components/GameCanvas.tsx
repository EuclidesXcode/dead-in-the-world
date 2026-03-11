'use client';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { TILE_PIXELS } from '@/lib/mapGenerator';
import { TILE_COLORS } from '@/lib/mapGenerator';
import { TileType } from '@/lib/supabase';
import PlayerSprite from './PlayerSprite';
import ZombieSprite from './ZombieSprite';
import { distance, calculatePlayerDamage, canZombieAttack, calculateZombieDamage, checkLevelUp } from '@/lib/combat';
import { supabase } from '@/lib/supabase';

const TILE_SIZE = TILE_PIXELS; // px por tile no render
const VIEWPORT_W = typeof window !== 'undefined' ? window.innerWidth : 1920;
const VIEWPORT_H = typeof window !== 'undefined' ? window.innerHeight : 1080;

export default function GameCanvas() {
  const {
    player, updatePlayerStats,
    tiles, setTile,
    zombies, setZombie, removeZombie,
    worldItems, removeWorldItem,
    addInventoryItem, inventory,
    onlinePlayers,
    viewportX, viewportY, setViewport,
    playerPixelX, playerPixelY, setPlayerPixel,
    equippedWeapon, ammo, useAmmo,
    damageNumbers, addDamageNumber, clearOldDamageNumbers,
    addNotification,
    updatePlayerStats: updatePlayer,
    setEquippedWeapon,
  } = useGameStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const lastUpdateRef = useRef(Date.now());
  const lastAttackRef = useRef(0);
  const playerPosRef = useRef({ x: 0, y: 0 }); // posição em pixels no mundo
  const animFrameRef = useRef<number>(0);
  const [isMoving, setIsMoving] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [playerDir, setPlayerDir] = useState(0);
  const [windowSize, setWindowSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Inicializa posição do player ──
  useEffect(() => {
    if (!player) return;
    playerPosRef.current = {
      x: player.tile_x * TILE_SIZE + TILE_SIZE / 2,
      y: player.tile_y * TILE_SIZE + TILE_SIZE / 2,
    };
    setPlayerPixel(playerPosRef.current.x, playerPosRef.current.y);
  }, [player?.id]);

  // ── Teclado ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      keysRef.current[down ? 'add' : 'delete'](e.code);
    };
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));

    // Atalhos de UI
    const onKeyDown = (e: KeyboardEvent) => {
      const { toggleInventory, toggleLeaderboard, toggleCharCustomizer, toggleWeaponUpgrade, toggleChat, toggleMap } = useGameStore.getState();
      if (e.code === 'KeyI') toggleInventory();
      if (e.code === 'KeyM') toggleMap();
      if (e.code === 'KeyC') toggleCharCustomizer();
      if (e.code === 'KeyU') toggleWeaponUpgrade();
      if (e.code === 'KeyT') toggleChat();
      if (e.code === 'KeyL') toggleLeaderboard();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', (e) => onKey(e, true));
      window.removeEventListener('keyup', (e) => onKey(e, false));
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // ── Clique no mapa para mirar e atirar ──
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !player) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Direção do player para o mouse
    const worldMouseX = mouseX + viewportX;
    const worldMouseY = mouseY + viewportY;
    const dx = worldMouseX - playerPosRef.current.x;
    const dy = worldMouseY - playerPosRef.current.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    setPlayerDir(((angle % 360) + 360) % 360);

    // Atacar
    attack(worldMouseX, worldMouseY, angle);
  }, [player, viewportX, viewportY, equippedWeapon]);

  const attack = useCallback((targetX: number, targetY: number, angle: number) => {
    const now = Date.now();
    const weapon = useGameStore.getState().equippedWeapon;
    const p = useGameStore.getState().player;
    if (!p) return;

    // Fire rate
    const fireRate = weapon?.stats?.fire_rate || 1;
    const cooldown = 1000 / fireRate;
    if (now - lastAttackRef.current < cooldown) return;
    lastAttackRef.current = now;

    setIsAttacking(true);
    setTimeout(() => setIsAttacking(false), 150);

    // Consome munição
    if (weapon?.stats?.ammo_type) {
      const canShoot = useGameStore.getState().useAmmo(weapon.stats.ammo_type, 1);
      if (!canShoot) {
        addNotification('Sem munição!', 'warning');
        return;
      }
    }

    // Alcance da arma
    const range = weapon?.stats?.range || 40;

    // Verifica zumbis no alcance
    const zombieMap = useGameStore.getState().zombies;
    zombieMap.forEach((zombie) => {
      if (!zombie.is_alive) return;
      const zombieDist = distance(playerPosRef.current.x, playerPosRef.current.y, zombie.pos_x, zombie.pos_y);
      if (zombieDist > range) return;

      // Ângulo para o zumbi
      const dxZ = zombie.pos_x - playerPosRef.current.x;
      const dyZ = zombie.pos_y - playerPosRef.current.y;
      const angleToZombie = Math.atan2(dyZ, dxZ) * (180 / Math.PI);
      const angleDiff = Math.abs(((angleToZombie - angle + 180 + 360) % 360) - 180);
      if (angleDiff > 30) return; // spread angular da arma

      const { damage, isCrit, missed } = calculatePlayerDamage(p, weapon);

      // Mostra número de dano
      addDamageNumber({
        x: zombie.pos_x - viewportX,
        y: zombie.pos_y - viewportY - 20,
        damage: missed ? 0 : damage,
        isCrit,
      });

      if (!missed) {
        const newHealth = Math.max(0, zombie.current_health - damage);
        if (newHealth <= 0) {
          // Zumbi morto
          setZombie({ ...zombie, is_alive: false, current_health: 0 });
          setTimeout(() => removeZombie(zombie.id), 1000);

          // XP
          const newXp = p.xp + zombie.xp_reward;
          const result = checkLevelUp({ ...p, xp: newXp });
          updatePlayerStats({ kills: p.kills + 1, xp: result.newPlayer.xp, level: result.newPlayer.level });
          if (result.leveled) {
            addNotification(`🎉 LEVEL UP! Nível ${result.newPlayer.level}!`, 'success');
          }

          // Salva kill no Supabase
          supabase.from('kill_log').insert({
            player_id: p.id,
            zombie_type: zombie.zombie_type,
            zombie_id: zombie.id,
            tile_x: zombie.tile_x,
            tile_y: zombie.tile_y,
            xp_gained: zombie.xp_reward,
            weapon_used: weapon?.item_id || 'fists',
          });
        } else {
          setZombie({ ...zombie, current_health: newHealth });
        }
      }
    });
  }, [viewportX, viewportY]);

  // ── Game Loop Principal ──
  useEffect(() => {
    const gameLoop = () => {
      const now = Date.now();
      const dt = Math.min((now - lastUpdateRef.current) / 1000, 0.05);
      lastUpdateRef.current = now;

      const p = useGameStore.getState().player;
      if (!p) {
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // ── Movimentação ──
      const speed = 120 * (1 + p.agility * 0.05); // px/s
      let dx = 0, dy = 0;
      const keys = keysRef.current;

      if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

      const moving = dx !== 0 || dy !== 0;
      setIsMoving(moving);

      if (moving) {
        // Normaliza diagonal
        const len = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / len) * speed * dt;
        dy = (dy / len) * speed * dt;

        playerPosRef.current.x += dx;
        playerPosRef.current.y += dy;

        // Direção do movimento
        setPlayerDir((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360);

        // Consome stamina
        const newStamina = Math.max(0, p.current_stamina - dt * 8);
        if (newStamina !== p.current_stamina) updatePlayerStats({ current_stamina: newStamina });

        // Verifica coleta de itens
        checkItemPickup();
      } else {
        // Recupera stamina
        const newStamina = Math.min(p.max_stamina, p.current_stamina + dt * 12);
        if (Math.abs(newStamina - p.current_stamina) > 0.1) updatePlayerStats({ current_stamina: newStamina });
      }

      // Atualiza pixel do player
      setPlayerPixel(playerPosRef.current.x, playerPosRef.current.y);

      // ── Viewport segue o player ──
      const vx = playerPosRef.current.x - windowSize.w / 2;
      const vy = playerPosRef.current.y - windowSize.h / 2;
      setViewport(vx, vy);

      // ── Move zumbis ──
      updateZombies(dt, p);

      // ── Limpa damage numbers ──
      clearOldDamageNumbers();

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [windowSize]);

  const checkItemPickup = useCallback(() => {
    const state = useGameStore.getState();
    const items = state.worldItems;
    const px = playerPosRef.current.x;
    const py = playerPosRef.current.y;

    items.forEach((item) => {
      const d = distance(px, py, item.pos_x, item.pos_y);
      if (d < 30) {
        // Auto pickup
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

        // Auto-equipa primeira arma
        if (item.item_type === 'weapon' && !state.equippedWeapon) {
          setEquippedWeapon({
            id: crypto.randomUUID(),
            player_id: state.player?.id || '',
            item_type: 'weapon',
            item_id: item.item_id,
            item_name: item.item_name,
            quantity: 1,
            weight: item.weight,
            rarity: item.rarity,
            stats: item.stats || {},
            equipped: true,
            upgrades: [],
            durability: 100,
          });
        }
      }
    });
  }, []);

  const updateZombies = useCallback((dt: number, p: any) => {
    const state = useGameStore.getState();
    const px = playerPosRef.current.x;
    const py = playerPosRef.current.y;

    state.zombies.forEach((zombie) => {
      if (!zombie.is_alive) return;

      const dist = distance(zombie.pos_x, zombie.pos_y, px, py);
      const stats_zombie = { detection_range: 200, attack_range: 35 };

      if (dist < stats_zombie.detection_range) {
        if (dist < stats_zombie.attack_range) {
          // Ataca player
          const dmg = calculateZombieDamage(zombie, p);
          const newHealth = Math.max(0, (p.current_health || 100) - dmg * dt * 2);
          if (newHealth !== p.current_health) {
            updatePlayerStats({ current_health: newHealth });
          }
        } else {
          // Move em direção ao player
          const ddx = (px - zombie.pos_x) / dist;
          const ddy = (py - zombie.pos_y) / dist;
          const spd = zombie.speed * 60 * dt;
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

  // ── Renderiza tiles visíveis ──
  const visibleTiles: React.ReactNode[] = [];
  const tilesAcross = Math.ceil(windowSize.w / TILE_SIZE) + 2;
  const tilesDown = Math.ceil(windowSize.h / TILE_SIZE) + 2;
  const startTileX = Math.floor(viewportX / TILE_SIZE) - 1;
  const startTileY = Math.floor(viewportY / TILE_SIZE) - 1;

  for (let ty = startTileY; ty < startTileY + tilesDown; ty++) {
    for (let tx = startTileX; tx < startTileX + tilesAcross; tx++) {
      const key = `${tx},${ty}`;
      const tile = tiles.get(key);
      const screenX = tx * TILE_SIZE - viewportX;
      const screenY = ty * TILE_SIZE - viewportY;

      if (!tile) {
        // Tile desconhecido / fog of war
        visibleTiles.push(
          <div
            key={key}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              width: TILE_SIZE,
              height: TILE_SIZE,
              background: '#050505',
              border: '1px solid #0a0a0a',
            }}
          />
        );
        continue;
      }

      const tileColors = TILE_COLORS[tile.tile_type as TileType] || TILE_COLORS.street;
      visibleTiles.push(
        <TileRenderer
          key={key}
          tile={tile}
          screenX={screenX}
          screenY={screenY}
          colors={tileColors}
        />
      );
    }
  }

  return (
    <div
      ref={canvasRef}
      className="game-canvas"
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}
      onClick={handleCanvasClick}
    >
      {/* ── Tiles ── */}
      {visibleTiles}

      {/* ── Items no mundo ── */}
      {useGameStore.getState().worldItems.map((item) => {
        const sx = item.pos_x - viewportX;
        const sy = item.pos_y - viewportY;
        if (sx < -50 || sx > windowSize.w + 50 || sy < -50 || sy > windowSize.h + 50) return null;
        return (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              left: sx - 12,
              top: sy - 12,
              width: 24,
              height: 24,
              background: 'rgba(0,0,0,0.7)',
              border: `2px solid ${getRarityColor(item.rarity)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              animation: 'float 2s ease-in-out infinite',
              boxShadow: `0 0 8px ${getRarityColor(item.rarity)}`,
              zIndex: 50,
              cursor: 'pointer',
            }}
          >
            {getItemEmoji(item.item_id)}
          </div>
        );
      })}

      {/* ── Zumbis ── */}
      {Array.from(zombies.values()).map((zombie) => {
        if (!zombie.is_alive) return null;
        const sx = zombie.pos_x - viewportX;
        const sy = zombie.pos_y - viewportY;
        if (sx < -100 || sx > windowSize.w + 100 || sy < -100 || sy > windowSize.h + 100) return null;
        return (
          <div
            key={zombie.id}
            style={{ position: 'absolute', left: sx - 16, top: sy - 44, zIndex: 80 }}
          >
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

      {/* ── Outros players online ── */}
      {onlinePlayers.map((op) => {
        if (op.id === player.id) return null;
        const opPx = op.tile_x * TILE_SIZE;
        const opPy = op.tile_y * TILE_SIZE;
        const sx = opPx - viewportX;
        const sy = opPy - viewportY;
        if (sx < -100 || sx > windowSize.w + 100 || sy < -100 || sy > windowSize.h + 100) return null;
        return (
          <div key={op.id} style={{ position: 'absolute', left: sx - 16, top: sy - 44, zIndex: 90 }}>
            <PlayerSprite
              skinColor={op.skin_color}
              hairColor={op.hair_color}
              shirtColor={op.shirt_color}
              pantsColor={op.pants_color}
              username={op.username}
              showHealthBar={true}
              health={op.current_health}
              maxHealth={op.max_health}
              scale={1}
              isLocal={false}
            />
          </div>
        );
      })}

      {/* ── Player local ── */}
      <div
        style={{
          position: 'absolute',
          left: playerPixelX - viewportX - 16,
          top: playerPixelY - viewportY - 44,
          zIndex: 100,
        }}
      >
        <PlayerSprite
          skinColor={player.skin_color}
          hairColor={player.hair_color}
          shirtColor={player.shirt_color}
          pantsColor={player.pants_color}
          direction={playerDir}
          isMoving={isMoving}
          isAttacking={isAttacking}
          health={player.current_health}
          maxHealth={player.max_health}
          showHealthBar={false}
          scale={1}
          isLocal={true}
          username={player.username}
        />
      </div>

      {/* ── Damage Numbers ── */}
      {damageNumbers.map((dn) => (
        <div
          key={dn.id}
          className={`damage-number ${dn.isCrit ? 'crit' : dn.isHeal ? 'heal' : dn.damage === 0 ? 'miss' : 'normal'}`}
          style={{ left: dn.x, top: dn.y }}
        >
          {dn.damage === 0 ? 'MISS' : dn.isCrit ? `⚡${dn.damage}!` : dn.isHeal ? `+${dn.damage}` : dn.damage}
        </div>
      ))}
    </div>
  );
}

// ── Tile rendered individualmente ──
function TileRenderer({ tile, screenX, screenY, colors }: any) {
  const s = TILE_SIZE;
  return (
    <div
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        width: s,
        height: s,
        background: colors.base,
        border: `1px solid ${colors.border}`,
        imageRendering: 'pixelated',
        overflow: 'hidden',
      }}
    >
      {/* Detalhes visuais do tipo de tile */}
      {tile.tile_type === 'street' && <StreetDetails s={s} />}
      {tile.tile_type === 'building' && <BuildingDetails s={s} />}
      {tile.tile_type === 'forest' && <ForestDetails s={s} />}
      {tile.tile_type === 'hospital' && <HospitalDetails s={s} />}
      {tile.tile_type === 'military_base' && <MilitaryDetails s={s} />}
      {tile.tile_type === 'river' && <RiverDetails s={s} />}
      {tile.tile_type === 'ruins' && <RuinsDetails s={s} />}

      {/* Indicador de loot */}
      {tile.has_loot && !tile.loot_collected && (
        <div style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, background: '#f59e0b', borderRadius: '50%', boxShadow: '0 0 4px #f59e0b' }} />
      )}
    </div>
  );
}

// Detalhes visuais dos tiles
function StreetDetails({ s }: { s: number }) {
  return (
    <>
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: '#444', transform: 'translateY(-50%)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, background: '#444', transform: 'translateX(-50%)' }} />
      {/* Marcas da estrada */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{ position: 'absolute', top: '50%', left: `${10 + i * 20}%`, width: 8, height: 2, background: '#555', transform: 'translateY(-50%)' }} />
      ))}
    </>
  );
}

function BuildingDetails({ s }: { s: number }) {
  return (
    <>
      {/* Janelas */}
      {[[10, 10], [35, 10], [10, 35], [35, 35]].map(([x, y], i) => (
        <div key={i} style={{ position: 'absolute', top: y, left: x, width: 12, height: 10, background: 'rgba(100,150,200,0.15)', border: '1px solid rgba(100,150,200,0.2)' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', bottom: 0, width: 1, background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', left: 0, top: '50%', right: 0, height: 1, background: 'rgba(255,255,255,0.05)' }} />
        </div>
      ))}
      {/* Porta */}
      <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 10, height: 14, background: '#0d1520', border: '1px solid #1a2a35' }} />
    </>
  );
}

function ForestDetails({ s }: { s: number }) {
  return (
    <>
      {/* Árvores pixeladas */}
      {[[8, 8], [32, 15], [16, 38], [44, 30], [28, 4]].map(([x, y], i) => (
        <div key={i} style={{ position: 'absolute', top: y, left: x }}>
          {/* Tronco */}
          <div style={{ position: 'absolute', bottom: 0, left: 3, width: 4, height: 6, background: '#5c3d2e' }} />
          {/* Copa */}
          <div style={{ width: 10, height: 10, background: '#1a4a1a', border: '1px solid #0d2b0d' }} />
          <div style={{ position: 'absolute', top: -3, left: 2, width: 6, height: 6, background: '#1a5a1a' }} />
        </div>
      ))}
    </>
  );
}

function HospitalDetails({ s }: { s: number }) {
  return (
    <>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 20, height: 4, background: 'rgba(255,255,255,0.15)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 4, height: 20, background: 'rgba(255,255,255,0.15)' }} />
      {/* Janelas com tint verde */}
      {[[8, 8], [40, 8], [8, 38], [40, 38]].map(([x, y], i) => (
        <div key={i} style={{ position: 'absolute', top: y, left: x, width: 10, height: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }} />
      ))}
    </>
  );
}

function MilitaryDetails({ s }: { s: number }) {
  return (
    <>
      {/* Grade/Cerca */}
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 20}%`, width: 2, background: 'rgba(100,120,100,0.3)' }} />
      ))}
      {/* Barracão */}
      <div style={{ position: 'absolute', top: 10, left: 10, width: 30, height: 25, background: '#1a2a1a', border: '1px solid #3a5a3a' }} />
      {/* Estrela militar */}
      <div style={{ position: 'absolute', top: 15, left: 18, fontSize: 12, color: 'rgba(100,140,100,0.5)' }}>★</div>
    </>
  );
}

function RiverDetails({ s }: { s: number }) {
  return (
    <>
      {/* Ondas de água */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          top: `${20 + i * 15}%`,
          left: 0, right: 0, height: 3,
          background: 'rgba(59,130,246,0.2)',
          borderRadius: 2,
        }} />
      ))}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,58,138,0.15)' }} />
    </>
  );
}

function RuinsDetails({ s }: { s: number }) {
  return (
    <>
      {/* Escombros */}
      {[[5, 5, 20, 15], [30, 20, 15, 20], [10, 35, 25, 12]].map(([x, y, w, h], i) => (
        <div key={i} style={{ position: 'absolute', top: y, left: x, width: w, height: h, background: 'rgba(80,60,40,0.4)', border: '1px solid rgba(100,80,60,0.3)' }} />
      ))}
      {/* Rachaduras */}
      <div style={{ position: 'absolute', top: 0, left: '30%', width: 1, height: '60%', background: 'rgba(0,0,0,0.3)', transform: 'rotate(5deg)' }} />
    </>
  );
}

// ── Helpers ──
function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b',
  };
  return colors[rarity] || '#9ca3af';
}

function getItemEmoji(id: string): string {
  const emojis: Record<string, string> = {
    pistol: '🔫', shotgun: '🔫', rifle: '🔫', sniper: '🔭',
    knife: '🔪', machete: '🗡️', bat: '⚾',
    bandage: '🩹', medkit: '🧰', pain_meds: '💊', morphine: '💉',
    canned_food: '🥫', water_bottle: '💧', energy_bar: '🍫',
    ammo_9mm: '🔶', ammo_shotgun: '🔶', ammo_rifle: '🔷',
    silencer: '🔇', extended_mag: '📦', scope: '🔭', grip: '🖐️',
    scrap_metal: '🔩', cloth: '🧵',
  };
  return emojis[id] || '📦';
}
