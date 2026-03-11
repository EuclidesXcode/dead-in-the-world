'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '@/lib/store';
import { Zombie, Player } from '@/lib/supabase';
import { playerWorldPixelFromLatLng, GAME_TILE_PX, worldPixelToLatLng } from '@/lib/osmTiles';
import { distance, calculatePlayerDamage, calculateZombieDamage, checkLevelUp } from '@/lib/combat';
import { calcMaxZombies, createSpawnZombie, nextSpawnDelay } from '@/lib/zombieSpawner';
import { supabase } from '@/lib/supabase';
import { audioSystem } from '@/lib/audio';
import PlayerSprite from './PlayerSprite';
import ZombieSprite from './ZombieSprite';
import StreetMap from './StreetMap';



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
    setEquippedWeapon,
  } = useGameStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const lastUpdateRef = useRef(Date.now());
  const lastAttackRef = useRef(0);
  const playerPosRef = useRef({ x: 0, y: 0 });
  const originTileRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const isMouseMovingRef = useRef(false);
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

  // ── Inicializa BGM após interação do usuário ──
  useEffect(() => {
    const initAudio = () => {
      audioSystem?.startBGM();
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
    return () => {
       audioSystem?.stopBGM();
       window.removeEventListener('click', initAudio);
       window.removeEventListener('keydown', initAudio);
    };
  }, []);

  // ── Inicializa posição do player usando lat/lng real → pixel OSM ──
  useEffect(() => {
    if (!player?.last_lat || !player?.last_lng) return;
    const { originTileX, originTileY, pixelX, pixelY } =
      playerWorldPixelFromLatLng(player.last_lat, player.last_lng);
    originTileRef.current = { x: originTileX, y: originTileY };
    useGameStore.getState().setOriginTile(originTileX, originTileY);
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
    
    const onMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('mousemove', onMouseMove);
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
          setZombie(newZombie as any);
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

    // Dispara som e reduz cooldown
    audioSystem?.playShootSound();

    const { damage, isCrit, missed } = calculatePlayerDamage(p, weapon);
    const state = useGameStore.getState();

    addDamageNumber({
      x: target.pos_x - state.viewportX,
      y: target.pos_y - state.viewportY - 20,
      damage: missed ? 0 : damage,
      isCrit,
    });

    if (!missed) {
      audioSystem?.playZombieHurt();
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

      // Movimentação (Teclado ou Mouse) - Ajustada para o novo GAME_TILE_PX massivo
      const speed = 220 * (1 + p.agility * 0.04);
      let dx = 0, dy = 0;
      const keys = keysRef.current;
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

      const { w, h } = useWindowSize();

      // Se não usar WASD, segue o ponteiro do mouse
      if (dx === 0 && dy === 0) {
        const mdx = mousePosRef.current.x - w / 2;
        const mdy = mousePosRef.current.y - h / 2;
        const dist = Math.sqrt(mdx * mdx + mdy * mdy);
        
        if (isMouseMovingRef.current) {
          if (dist < 20) isMouseMovingRef.current = false;
        } else {
          // Só anda de novo quando distanciar o mouse (puxar o mouse)
          if (dist > 50) isMouseMovingRef.current = true;
        }

        if (isMouseMovingRef.current) {
          dx = mdx;
          dy = mdy;
        }
      }

      const moving = dx !== 0 || dy !== 0;
      setIsMoving(moving);

      if (moving) {
        const len = Math.sqrt(dx * dx + dy * dy);
        let stepX = (dx / len) * speed * dt;
        let stepY = (dy / len) * speed * dt;

        // Collision Check: testa elemento no centro-baixo do player (seus "pés")
        // Os próximos pés estariam visualmente parados no centro (h/2 + offset) se a camera fosse solta.
        // Como a camera segue o player, "andar" significa que o mapa anda CORTRA o player.
        // Simulamos a colisão testando qual elemento DOM está sob o centro da tela se testássemos o próximo tick.
        // Uma forma fluída de testar é verificar o SVG renderizado em w/2, h/2 + 20 antes de applyStep.
        
        // Simples test: The player is always fixed at w/2, h/2. The map is drawn underneath.
        // Test elements at (w/2, h/2 + 15) to hit the walkable-road.
        const centerEls = document.elementsFromPoint(w/2, h/2 + 10);
        const onRoad = centerEls.some(el => el.classList.contains('walkable-road') || el.classList.contains('vignette'));
        // (Nota: como o mapa tem SVG e a vignette no meio, melhor adicionar vignette na conta e usar uma logica mais macia se precisar)
        // Actually, um culling preciso seria melhor apenas com as bounds em JS, mas vamos com a approach visual:
        // A gente não "trava" o player instantaneamente no elementFromPoint porque o mapa move DEPOIS do calculo.
        // Vamos testar as bordas de restrição de movimento.
        let moveAllowed = true;
        if (!process.env.NEXT_PUBLIC_IGNORE_COLLISION) { // flag secreta
           const projectedEls = document.elementsFromPoint(w/2 + stepX, h/2 + stepY + 10);
           moveAllowed = projectedEls.some(el => el.classList.contains('walkable-road'));
           
           // Permit block if not on road, but allow sliding along walls if one axis works
           if (!moveAllowed) {
              const testX = document.elementsFromPoint(w/2 + stepX, h/2 + 10);
              if (testX.some(el => el.classList.contains('walkable-road'))) { stepY = 0; moveAllowed = true; }
              else {
                 const testY = document.elementsFromPoint(w/2, h/2 + stepY + 10);
                 if (testY.some(el => el.classList.contains('walkable-road'))) { stepX = 0; moveAllowed = true; }
              }
           }
        }

        if (moveAllowed) {
          playerPosRef.current.x += stepX;
          playerPosRef.current.y += stepY;
          const newStamina = Math.max(0, p.current_stamina - dt * 6);
          if (newStamina !== p.current_stamina) updatePlayerStats({ current_stamina: newStamina });
          checkItemPickup();
        } else {
          // Bloqueado (esbarrou fora da rua)
        }
      } else {
        const newStamina = Math.min(p.max_stamina, p.current_stamina + dt * 10);
        if (Math.abs(newStamina - p.current_stamina) > 0.1) updatePlayerStats({ current_stamina: newStamina });
      }

      const px = playerPosRef.current.x;
      const py = playerPosRef.current.y;
      setPlayerPixel(px, py);

      // Atualiza lat/lng real quando move
      if (moving && originTileRef.current) {
        const { lat, lng } = worldPixelToLatLng(px, py, originTileRef.current.x, originTileRef.current.y);
        // Só atualiza o estado zustand se a distância for significativa para não engasgar a thread
        if (Math.abs(p.last_lat - lat) > 0.00005 || Math.abs(p.last_lng - lng) > 0.00005) {
          updatePlayerStats({ last_lat: lat, last_lng: lng });
        }
      }

      // Viewport
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

  const prefetchNearbyTiles = useCallback(() => { /* StreetMap cuida do buffer */ }, []);


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

          let stepX = ddx * spd;
          let stepY = ddy * spd;

          if (!process.env.NEXT_PUBLIC_IGNORE_COLLISION) {
            const vpX = state.viewportX;
            const vpY = state.viewportY;
            const zScreenX = zombie.pos_x + stepX - vpX;
            const zScreenY = zombie.pos_y + stepY - vpY;

            // Só testa colisão visual se o zumbi estiver na tela
            if (zScreenX >= 0 && zScreenX <= window.innerWidth && zScreenY >= 0 && zScreenY <= window.innerHeight) {
              const centerEls = document.elementsFromPoint(zScreenX, zScreenY + 15);
              let moveAllowed = centerEls.some(el => el.classList.contains('walkable-road'));

              if (!moveAllowed) {
                const testX = document.elementsFromPoint(zombie.pos_x + stepX - vpX, zombie.pos_y - vpY + 15);
                if (testX.some(el => el.classList.contains('walkable-road'))) { stepY = 0; moveAllowed = true; }
                else {
                  const testY = document.elementsFromPoint(zombie.pos_x - vpX, zombie.pos_y + stepY - vpY + 15);
                  if (testY.some(el => el.classList.contains('walkable-road'))) { stepX = 0; moveAllowed = true; }
                }
              }

              if (!moveAllowed) {
                stepX = 0;
                stepY = 0;
              }
            }
          }

          setZombie({
            ...zombie,
            pos_x: zombie.pos_x + stepX,
            pos_y: zombie.pos_y + stepY,
            direction: Math.atan2(ddy, ddx) * 180 / Math.PI,
          });
        }
      }
    });
  }, []);

  if (!player) return null;

  const { w, h } = windowSize;

  return (
    <div
      ref={canvasRef}
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#12110a' }}
    >
      {/* ── MAPA REAL: ruas pós-apocalípticas em SVG/CSS ── */}
      <StreetMap
        viewportX={viewportX}
        viewportY={viewportY}
        screenW={w}
        screenH={h}
        originTileX={originTileRef.current.x}
        originTileY={originTileRef.current.y}
        playerLat={player.last_lat || 0}
        playerLng={player.last_lng || 0}
      />

      {/* ── Vinheta ambiente pós-apocalipse ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(5,3,2,0.55) 100%)',
      }} />

      {/* ── Scanlines ── */}
      <div className="scanlines" style={{ zIndex: 11 }} />

      {/* ── Items ── */}
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
            zIndex: 55,
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
