'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '@/lib/store';
import { Zombie, Player, WorldItem } from '@/lib/supabase';
import { playerWorldPixelFromLatLng, GAME_TILE_PX, worldPixelToLatLng } from '@/lib/osmTiles';
import { distance, calculatePlayerDamage, calculateZombieDamage, checkLevelUp } from '@/lib/combat';
import { calcMaxZombies, createSpawnZombie, nextSpawnDelay } from '@/lib/zombieSpawner';
import { supabase } from '@/lib/supabase';
import { audioSystem } from '@/lib/audio';
import PlayerSprite from './PlayerSprite';
import ZombieSprite from './ZombieSprite';
import StreetMap from './StreetMap';
import { parseCustomCSS } from '@/lib/cssParser';
import { generateZombieDrop } from '@/lib/loot';
import { WorldItem as WorldItemType } from '@/lib/supabase';

interface VisualProjectile {
  id: string;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  progress: number;
  size?: number;
  type?: string;
}

export function useWindowSize() {
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    setSize({ w: window.innerWidth, h: window.innerHeight });
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

// ── Funcao global de checagem física SVG (não depende de viewport) ──
const isPointOnWalkableRoad = (worldX: number, worldY: number) => {
  const svg = document.getElementById('street-map-svg') as any as SVGSVGElement;
  if (!svg) return true; // Se mapa não renderizou, não bloqueia
  const pt = svg.createSVGPoint();
  pt.x = worldX;
  pt.y = worldY;

  // 1. Checa se está DENTRO de um objeto sólido (prédio/container)
  const solids = document.querySelectorAll('.solid-object');
  for (let i = 0; i < solids.length; i++) {
    const el = solids[i] as any;
    if (el.isPointInFill(pt)) return false;
  }

  // 2. Se não estiver em sólido, checa se está em área caminhável
  const roads = document.querySelectorAll('.walkable-road');
  for (let i = 0; i < roads.length; i++) {
    const el = roads[i] as any;
    if (el.tagName === 'polygon') {
      if (el.isPointInFill(pt)) return true;
    } else if (el.tagName === 'path') {
      if (el.isPointInStroke(pt)) return true;
    }
  }
  return false;
};



export default function GameCanvas() {
  const {
    player, updatePlayerStats,
    tiles, setTile,
    zombies, setZombie, removeZombie,
    worldItems, removeWorldItem,
    addInventoryItem, inventory, setInventory,
    onlinePlayers,
    viewportX, viewportY, setViewport,
    playerPixelX, playerPixelY, setPlayerPixel,
    equippedWeapon, equippedSecondaryWeapon, ammo, useAmmo,
    damageNumbers, addDamageNumber, clearOldDamageNumbers,
    addNotification,
    setEquippedWeapon,
    activeWeaponSlot, setActiveWeaponSlot,
    cameraZoom,
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
  const [projectiles, setProjectiles] = useState<VisualProjectile[]>([]);
  const [hordeActive, setHordeActive] = useState(false);
  const [hordeTimer, setHordeTimer] = useState(0);

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

  // ── Limpeza de itens em zonas proibidas (prédios) ──
  useEffect(() => {
    if (status !== 'ready') return;
    const cleanupItems = () => {
      const state = useGameStore.getState();
      const invalidItems = state.worldItems.filter(item => !isPointOnWalkableRoad(item.pos_x, item.pos_y));
      if (invalidItems.length > 0) {
        invalidItems.forEach(item => removeWorldItem(item.id));
      }
    };
    // Executa após um pequeno delay para garantir que o SVG carregou
    const timer = setTimeout(cleanupItems, 2000);
    return () => clearTimeout(timer);
  }, [status, tiles.size]);


  // ── Teclado (WASD + Novas Teclas) ──
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      // Inventário no TAB
      if (e.code === 'Tab') {
        e.preventDefault();
        useGameStore.getState().toggleInventory();
        return;
      }

      keysRef.current.add(e.code);

      const st = useGameStore.getState();
      
      // Armamentos 1 e 2
      if (e.code === 'Digit1') {
        st.setActiveWeaponSlot('primary');
        st.addNotification('Arma Principal Selecionada', 'info');
      }
      if (e.code === 'Digit2') {
        st.setActiveWeaponSlot('secondary');
        st.addNotification('Arma Secundária Selecionada', 'info');
      }

      // Atalhos de UI mantidos ou movidos
      if (e.code === 'KeyM') st.toggleMap();
      if (e.code === 'KeyC') st.toggleCharCustomizer();
      if (e.code === 'KeyU') st.toggleWeaponUpgrade();
      if (e.code === 'KeyT') st.toggleChat();
      if (e.code === 'KeyL') st.toggleLeaderboard();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') e.preventDefault();
      keysRef.current.delete(e.code);
    };
    
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

  // ── Lógica de Morte ──
  useEffect(() => {
    if (player && player.current_health <= 0) {
      const handleDeath = async () => {
        addNotification('💀 VOCÊ MORREU!', 'danger');
        addNotification('Seu inventário foi perdido.', 'warning');

        // Limpa inventário no banco
        await supabase.from('inventory').delete().eq('player_id', player.id);
        
        // Atualiza estado local
        setInventory([]);
        updatePlayerStats({
          current_health: player.max_health,
          current_stamina: player.max_stamina,
          deaths: (player.deaths || 0) + 1
        });

        // Teleporta de volta (opcional, aqui apenas cura)
        addNotification('Renascendo...', 'info');
      };
      handleDeath();
    }
  }, [player?.current_health === 0]);

  // ── Sistema de Spawn ──
  const scheduleSpawn = useCallback(() => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    
    // Calcula delay baseado na horda
    const baseDelay = nextSpawnDelay();
    const finalDelay = hordeActive ? baseDelay * 0.3 : baseDelay;

    spawnTimerRef.current = setTimeout(() => {
      const state = useGameStore.getState();
      const p = state.player;
      if (!p) { scheduleSpawn(); return; }

      const aliveZombies = Array.from(state.zombies.values()).filter(z => z.is_alive);
      const onlineP = state.onlinePlayers;
      const avgLevel = onlineP.length > 0
        ? Math.round((p.level + onlineP.reduce((s, op) => s + op.level, 0)) / (onlineP.length + 1))
        : p.level;
      
      let maxZ = calcMaxZombies(avgLevel, onlineP.length + 1);
      if (hordeActive) maxZ = Math.min(150, maxZ * 2.5); // Aumenta limite na horda

      if (aliveZombies.length < maxZ) {
        // Spawna mais de uma vez se horda
        const spawnCount = Math.min(
          hordeActive ? Math.floor(Math.random() * 5) + 4 : Math.floor(Math.random() * 3) + 1,
          maxZ - aliveZombies.length
        );
        for (let i = 0; i < spawnCount; i++) {
          const newZombie = createSpawnZombie(
            playerPosRef.current.x, playerPosRef.current.y,
            originTileRef.current.x, originTileRef.current.y,
            avgLevel,
            isPointOnWalkableRoad
          );
          setZombie(newZombie as any);
        }
      }
      scheduleSpawn();
    }, finalDelay);
  }, [hordeActive]);


  useEffect(() => {
    scheduleSpawn();
    return () => { if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current); };
  }, [scheduleSpawn]);

  // ── Auto-aim: encontra zumbi mais próximo no alcance ──
  const findTargetsAtPosition = useCallback((wx: number, wy: number, radius: number, limit: number): (Zombie | Player)[] => {
    const state = useGameStore.getState();
    const targets: { t: Zombie | Player, d: number }[] = [];
    
    // Zumbis
    Array.from(state.zombies.values())
      .filter(z => z.is_alive)
      .forEach(z => {
        const d = distance(wx, wy, z.pos_x, z.pos_y);
        if (d <= radius) targets.push({ t: z, d });
      });

    // Outros Jogadores (PvP)
    state.onlinePlayers.forEach(op => {
      if (op.id === state.player?.id) return;
      const { pixelX, pixelY } = playerWorldPixelFromLatLng(op.last_lat, op.last_lng);
      const d = distance(wx, wy, pixelX, pixelY);
      if (d <= radius) targets.push({ t: op as any, d });
    });

    return targets.sort((a, b) => a.d - b.d).slice(0, limit).map(i => i.t);
  }, []);

  const collectItem = useCallback((item: WorldItem) => {
    const state = useGameStore.getState();
    removeWorldItem(item.id);
    const invItem = {
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
    };
    addInventoryItem(invItem);
    supabase.from('inventory').insert(invItem).then();
    addNotification(`Coletou: ${item.item_name}`, 'info');
    updatePlayerStats({ items_collected: (state.player?.items_collected || 0) + 1 });
    if (item.item_type === 'weapon' && !state.equippedWeapon) {
      setEquippedWeapon({ ...invItem, equipped: true });
    }
  }, [removeWorldItem, addInventoryItem, addNotification, setEquippedWeapon]);

  // ── Manual Attack ──
  const performAttack = useCallback((p: Player, px: number, py: number) => {
    const now = Date.now();
    const state = useGameStore.getState();
    const zoom = windowSize.w < 768 ? 0.65 : 1.0;
    
    const w1 = state.equippedWeapon;
    const w2 = state.equippedSecondaryWeapon;
    const activeSlot = state.activeWeaponSlot;
    const mainWeapon = activeSlot === 'primary' ? w1 : w2;
    const offWeapon = activeSlot === 'primary' ? w2 : w1;

    const fireRate = mainWeapon?.stats?.fire_rate || offWeapon?.stats?.fire_rate || 0.8;
    const cooldown = 1000 / fireRate;
    if (now - lastAttackRef.current < cooldown) return;

    // Mira: No PC usamos a posição do mouse, no Celular o inimigo mais próximo
    const isPC = windowSize.w >= 768;
    let targetX: number, targetY: number;

    if (isPC) {
       targetX = (mousePosRef.current.x / zoom) + state.viewportX;
       targetY = (mousePosRef.current.y / zoom) + state.viewportY;
    } else {
       // Mobile continua com auto-lock no mais próximo
       const nearest = findTargetsAtPosition(px, py, 400, 1)[0] as Zombie;
       if (!nearest) return;
       targetX = nearest.pos_x;
       targetY = nearest.pos_y;
    }

    const targets = findTargetsAtPosition(targetX, targetY, 60, (w1 && w2) ? 2 : 1);
    
    lastAttackRef.current = now;
    setIsAttacking(true);
    setTimeout(() => setIsAttacking(false), 100);

    const processShoot = (target: any, weapon: any, isSecondary: boolean) => {
      if (!weapon) return false;
      
      // Direção do Player baseada na mira
      const dx = targetX - px;
      const dy = targetY - py;
      setPlayerDir((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360);

      if (weapon.stats?.ammo_type) {
        const ok = useGameStore.getState().useAmmo(weapon.stats.ammo_type, 1);
        if (!ok) {
           if (!isSecondary) addNotification(`Sem munição: ${weapon.item_name}`, 'warning');
           return false;
        }
      }

      audioSystem?.playShootSound();
      const { damage, isCrit, missed } = calculatePlayerDamage(p, weapon);
      
      // Pega posição do alvo para feedback
      let tx = target?.pos_x ?? targetX;
      let ty = target?.pos_y ?? targetY;
      
      if (target && 'last_lat' in target) { // É um Player
         const { pixelX, pixelY } = playerWorldPixelFromLatLng(target.last_lat, target.last_lng);
         tx = pixelX; ty = pixelY;
      }

      addDamageNumber({
        x: tx - state.viewportX,
        y: ty - state.viewportY - 20,
        damage: missed ? 0 : damage,
        isCrit,
      });

      if (!missed && target) {
        const splashRadius = weapon.stats?.splash_radius || 0;
        const targetsToHit = splashRadius > 0 
          ? findTargetsAtPosition(tx, ty, splashRadius, 10) // Pega até 10 inimigos no raio
          : [target];

        targetsToHit.forEach(t => {
          if ('zombie_type' in t) { // Dano em Zumbi
            audioSystem?.playZombieHurt();
            const freshTarget = useGameStore.getState().zombies.get(t.id);
            if (!freshTarget || !freshTarget.is_alive) return;
            
            // Dano de splash pode ser menor se não for o alvo principal? 
            // Por enquanto 100% de dano em todos no raio
            const newHp = Math.max(0, freshTarget.current_health - (splashRadius > 0 ? damage * 0.8 : damage));
            
            if (newHp <= 0) {
              setZombie({ ...freshTarget, is_alive: false, current_health: 0 });
              const drop = generateZombieDrop(freshTarget.pos_x, freshTarget.pos_y);
              if (drop) useGameStore.getState().addWorldItem(drop);
              setTimeout(() => removeZombie(t.id), 800);
              updatePlayerStats({ kills: p.kills + 1, xp: p.xp + (freshTarget.xp_reward || 10) });
              if (targetsToHit.length === 1) addNotification(`Zumbi abatido! +${freshTarget.xp_reward} XP`, 'success');
            } else {
              setZombie({ ...freshTarget, current_health: newHp });
            }
          }
        });
        
        if (splashRadius > 0) addNotification(`Explosão atingiu ${targetsToHit.length} inimigos!`, 'danger');
      }

      // Sistema visual do projétil
      setProjectiles(prev => [...prev.slice(-10), {
        id: Math.random().toString(36).slice(2),
        sx: px, sy: py, tx, ty, progress: 0,
        size: weapon.stats?.projectile_size || 3,
        type: weapon.stats?.bullet_type || 'normal',
      }]);

      return true;
    };

    if (mainWeapon) processShoot(targets[0], mainWeapon, false);
    if (offWeapon && targets.length > 1) processShoot(targets[1], offWeapon, true);
    
  }, [findTargetsAtPosition, setZombie, removeZombie, updatePlayerStats, addDamageNumber, addNotification, windowSize.w]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!player) return;
    const state = useGameStore.getState();
    const px = playerPosRef.current.x;
    const py = playerPosRef.current.y;
    
    // Coordenadas do click no mundo corrigidas pelo zoom
    const zoom = windowSize.w < 768 ? 0.65 : 1.0;
    const clickX = (e.clientX / zoom) + state.viewportX;
    const clickY = (e.clientY / zoom) + state.viewportY;

    // 1. Tentar coletar itens (dentro de 100px do player)
    let pickedUp = false;
    state.worldItems.forEach((item) => {
      const distToPlayer = distance(px, py, item.pos_x, item.pos_y);
      const distToClick = distance(clickX, clickY, item.pos_x, item.pos_y);
      
      // Se clicar perto do item E o player estiver a 100px dele
      if (distToPlayer < 100 && distToClick < 50) {
        collectItem(item);
        pickedUp = true;
      }
    });

    if (pickedUp) return;

    // 2. Senão, atirar
    performAttack(player, px, py);
  };



  const prefetchNearbyTiles = useCallback(() => { /* StreetMap cuida do buffer */ }, []);


  const checkItemPickup = useCallback(() => {
    const state = useGameStore.getState();
    const px = playerPosRef.current.x;
    const py = playerPosRef.current.y;
    state.worldItems.forEach((item) => {
      if (distance(px, py, item.pos_x, item.pos_y) < 40) {
        removeWorldItem(item.id);
        const invItem = {
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
        };
        addInventoryItem(invItem);
        // Persistência no Supabase
        supabase.from('inventory').insert(invItem).then();

        addNotification(`Coletou: ${item.item_name}`, 'info');
        updatePlayerStats({ items_collected: (state.player?.items_collected || 0) + 1 });
        if (item.item_type === 'weapon' && !state.equippedWeapon) {
          setEquippedWeapon({ ...invItem, equipped: true });
        }
      }
    });
  }, []);

  const updateZombies = useCallback((dt: number, p: Player, px: number, py: number) => {
    const state = useGameStore.getState();
    state.zombies.forEach((zombie) => {
      if (!zombie.is_alive) return;
      const d = distance(zombie.pos_x, zombie.pos_y, px, py);
      
      // Logica Especial de Tipos
      if (zombie.zombie_type === 'screamer' && d < 350 && !hordeActive) {
         // Screamer tem chance de chamar horda se estiver perto
         if (Math.random() < 0.002 * dt * 60) {
            setHordeActive(true);
            setHordeTimer(15); // 15 segundos de horda
            addNotification('🚨 ALERTA: HORDA SE APROXIMANDO!', 'danger');
            audioSystem?.playZombieGasp(); // Reaproveita som de alerta
         }
      }

      if (zombie.zombie_type === 'leaper' && d < 300 && d > 100 && !zombie.is_jumping && (zombie.jump_cooldown || 0) <= 0) {
         // Leaper pula se estiver num range específico
         setZombie({
           ...zombie,
           is_jumping: true,
           jump_progress: 0,
           jump_cooldown: 5, // 5 segundos entre pulos
         });
         return;
      }

      if (zombie.is_jumping) {
         const newProgress = (zombie.jump_progress || 0) + dt * 1.5;
         if (newProgress >= 1) {
            setZombie({ ...zombie, is_jumping: false, jump_progress: 1, jump_cooldown: 5 });
         } else {
            // No pulo ele vai reto pro player e ignora colisões
            const ddx = (px - zombie.pos_x) / d;
            const ddy = (py - zombie.pos_y) / d;
            const leapSpeed = 500 * dt; // Muito rápido
            setZombie({
              ...zombie,
              pos_x: zombie.pos_x + ddx * leapSpeed,
              pos_y: zombie.pos_y + ddy * leapSpeed,
              jump_progress: newProgress,
              direction: Math.atan2(ddy, ddx) * 180 / Math.PI,
            });
         }
         return;
      }

      // Reduz cooldown de pulo
      if ((zombie.jump_cooldown || 0) > 0) {
         setZombie({ ...zombie, jump_cooldown: (zombie.jump_cooldown || 0) - dt });
      }

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
          let spd = (zombie.speed * 50) * dt;
          
          // Se horda ativa, zumbis ficam 20% mais rápidos
          if (hordeActive) spd *= 1.25;

          let stepX = ddx * spd;
          let stepY = ddy * spd;

          if (!process.env.NEXT_PUBLIC_IGNORE_COLLISION) {
            const targetX = zombie.pos_x + stepX;
            const targetY = zombie.pos_y + stepY + 15;

            let moveAllowed = isPointOnWalkableRoad(targetX, targetY);

            if (!moveAllowed) {
              if (isPointOnWalkableRoad(targetX, zombie.pos_y + 15)) { stepY = 0; moveAllowed = true; }
              else if (isPointOnWalkableRoad(zombie.pos_x, targetY)) { stepX = 0; moveAllowed = true; }
            }

            if (!moveAllowed) {
              stepX = 0;
              stepY = 0;
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
  }, [hordeActive]);

  // ── Game Loop Principal ──
  useEffect(() => {
    const gameLoop = () => {
      const now = Date.now();
      const dt = Math.min((now - lastUpdateRef.current) / 1000, 0.05);
      lastUpdateRef.current = now;

      const p = useGameStore.getState().player;
      if (!p) { animFrameRef.current = requestAnimationFrame(gameLoop); return; }

      const showInventory = useGameStore.getState().showInventory;
      
      const { w: screenW, h: screenH } = windowSize;
      const baseZoom = screenW < 768 ? 0.65 : 1.0;
      const zoom = baseZoom * useGameStore.getState().cameraZoom;
      const w = screenW / zoom;
      const h = screenH / zoom;

      // Movimentação (Teclado ou Mouse) - Ajustada para o novo GAME_TILE_PX massivo
      const speed = 220 * (1 + p.agility * 0.04);
      let dx = 0, dy = 0;

      if (!showInventory) {
        const keys = keysRef.current;
        if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
      }

      const moving = dx !== 0 || dy !== 0;
      setIsMoving(moving);

      // Facing direction
      if (screenW >= 768) {
        const mdx = (mousePosRef.current.x / zoom) - w / 2;
        const mdy = (mousePosRef.current.y / zoom) - h / 2;
        setPlayerDir((Math.atan2(mdy, mdx) * 180 / Math.PI + 360) % 360);
      } else if (moving) {
        setPlayerDir((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360);
      }

      const keys = keysRef.current;
      let isSprinting = moving && !showInventory && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && p.current_stamina > 5;
      const finalSpeed = isSprinting ? speed * 1.8 : speed;

      if (moving) {
        const len = Math.sqrt(dx * dx + dy * dy);
        let stepX = (dx / len) * finalSpeed * dt;
        let stepY = (dy / len) * finalSpeed * dt;

        // Collision Check: SVG Natively with isPointOnWalkableRoad
        let moveAllowed = true;
        if (!process.env.NEXT_PUBLIC_IGNORE_COLLISION) {
           const pxBase = playerPosRef.current.x;
           const pyBase = playerPosRef.current.y;
           const targetX = pxBase + stepX;
           const targetY = pyBase + stepY + 10;
           
           moveAllowed = isPointOnWalkableRoad(targetX, targetY);
           
           if (!moveAllowed) {
              if (isPointOnWalkableRoad(targetX, pyBase + 10)) { stepY = 0; moveAllowed = true; }
              else if (isPointOnWalkableRoad(pxBase, targetY)) { stepX = 0; moveAllowed = true; }
           }
        }

        if (moveAllowed) {
          playerPosRef.current.x += stepX;
          playerPosRef.current.y += stepY;
          const staminaConsumption = isSprinting ? dt * 25 : dt * 5;
          const newStamina = Math.max(0, p.current_stamina - staminaConsumption);
          if (newStamina !== p.current_stamina) updatePlayerStats({ current_stamina: newStamina });
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

      // Mobile Auto-actions
      if (w < 768) {
        checkItemPickup();
        performAttack(p, px, py);
      }
      // Atualiza zumbis
      updateZombies(dt, p, px, py);

      // Atualiza Timer da Horda
      if (hordeActive) {
         setHordeTimer(prev => {
           if (prev <= 0) {
              setHordeActive(false);
              return 0;
           }
           return prev - dt;
         });
      }

      // Atualiza Projéteis Visuais
      setProjectiles(prev => {
        if (prev.length === 0) return prev;
        return prev
          .map(pj => ({ ...pj, progress: pj.progress + dt * 4.5 })) // Um pouco mais lento (era 6)
          .filter(pj => pj.progress < 1);
      });

      // Pre-load tiles OSM
      prefetchNearbyTiles();

      clearOldDamageNumbers();
      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [windowSize, performAttack, checkItemPickup, updateZombies, prefetchNearbyTiles, clearOldDamageNumbers, setPlayerPixel, setViewport, updatePlayerStats]);

  if (!player) return null;

  const baseZoom = windowSize.w < 768 ? 0.65 : 1.0;
  const zoom = baseZoom * cameraZoom;
  const w = windowSize.w / zoom;
  const h = windowSize.h / zoom;

  return (
    <div
      ref={canvasRef}
      className="game-canvas"
      onClick={handleCanvasClick}
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#12110a' }}
    >
      <div style={{
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        width: w,
        height: h,
        position: 'absolute',
        top: 0, left: 0
      }}>
        {/* Dust Motes (Atmosfera) */}
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="dust-mote" style={{
            left: (i * 7.5 + Math.random() * 10) + '%',
            top: (i * 6.5 + Math.random() * 20) + '%',
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${10 + Math.random() * 5}s`
          }} />
        ))}

        {/* Overlay de Horda */}
        {hordeActive && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(139,0,0,0.1)',
            zIndex: 1,
            pointerEvents: 'none',
            animation: 'pulse-horde 2s infinite'
          }} />
        )}

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

        {projectiles.map(pj => {
          const x = pj.sx + (pj.tx - pj.sx) * pj.progress;
          const y = pj.sy + (pj.ty - pj.sy) * pj.progress;
          const angle = Math.atan2(pj.ty - pj.sy, pj.tx - pj.sx) * 180 / Math.PI;
          const size = pj.size || 3;
          
          let color = '#ffaa00';
          let shadow = '0 0 5px #ff6600';
          let width = size * 3;
          let height = size;

          if (pj.type === 'plasma') {
            color = '#00f2ff';
            shadow = '0 0 10px #00f2ff, 0 0 20px #00f2ff66';
            width = size * 4;
          } else if (pj.type === 'rocket') {
            color = '#ff4400';
            shadow = '0 0 15px #ff4400, 0 0 30px #ffcc0066';
            width = size * 4;
            height = size * 2;
          } else if (pj.type === 'rail') {
            color = '#ffffff';
            shadow = '0 0 8px #ffffff';
            width = size * 10;
            height = 2;
          } else if (pj.type === 'heavy') {
            color = '#fcd34d';
            shadow = '0 0 6px #f59e0b';
            width = size * 3;
            height = size * 1.5;
          }

          return (
            <div key={pj.id} className="projectile-ember" style={{
              left: x - viewportX,
              top: y - viewportY,
              width, height,
              background: color,
              boxShadow: shadow,
              transform: `rotate(${angle}deg)`,
              borderRadius: '50% 100% 100% 50% / 50% 100% 100% 50%',
            }} />
          );
        })}

        {/* ── ITENS NO CHÃO ── */}
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
            animation: 'anim-item-float 2.5s infinite ease-in-out',
            boxShadow: `0 0 10px ${rarityColor(item.rarity)}66`,
            zIndex: 55,
          }}>
            {itemEmoji(item.item_id)}
          </div>
        );
      })}

      {/* ── Zumbis ── */}
      {Array.from(zombies.values()).map((zombie) => {
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
              health={zombie.current_health} maxHealth={zombie.max_health}
              direction={zombie.direction} 
              isMoving={zombie.is_alive && distance(zombie.pos_x, zombie.pos_y, playerPosRef.current.x, playerPosRef.current.y) < 600}
              isAttacking={zombie.is_alive && distance(zombie.pos_x, zombie.pos_y, playerPosRef.current.x, playerPosRef.current.y) < 50}
              scale={zombie.zombie_type === 'tank' ? 1.5 : 1}
              isAlive={zombie.is_alive}
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
        
        // Parse styles for other player
        const opCustomStyles = op.custom_css ? parseCustomCSS(op.custom_css) : {};

        return (
          <div key={op.id} style={{ position: 'absolute', left: sx - 16, top: sy - 44, zIndex: 90 }}>
            <PlayerSprite
              skinColor={op.skin_color} hairColor={op.hair_color}
              shirtColor={op.shirt_color} pantsColor={op.pants_color}
              username={op.username} showHealthBar health={op.current_health}
              maxHealth={op.max_health} scale={1} isLocal={false}
              customStyles={opCustomStyles}
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
          customStyles={parseCustomCSS(player.custom_css || '')}
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
      </div>

      {/* ── Weapon HUD ── */}
      <div style={{
        position: 'absolute', 
        bottom: windowSize.w < 768 ? 100 : 20, 
        left: 20, 
        zIndex: 1000,
        display: 'flex', gap: 10, pointerEvents: 'none'
      }}>
        <div style={{
          padding: '10px 15px', background: 'rgba(5,5,5,0.85)', 
          border: `2px solid ${activeWeaponSlot === 'primary' ? '#00f2ff' : '#444'}`,
          borderRadius: 6, color: '#fff', fontSize: 11, fontFamily: 'Outfit, sans-serif',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: activeWeaponSlot === 'primary' ? '0 0 15px rgba(0,242,255,0.3)' : 'none',
          transition: 'all 0.2s ease',
          opacity: activeWeaponSlot === 'primary' ? 1 : 0.6
        }}>
          <span style={{ opacity: 0.5 }}>1</span>
          <span>{equippedWeapon ? itemEmoji(equippedWeapon.item_id) : '👊'}</span>
          <span>{equippedWeapon?.item_name || 'Mãos Nuas'}</span>
        </div>
        <div style={{
          padding: '10px 15px', background: 'rgba(5,5,5,0.85)', 
          border: `2px solid ${activeWeaponSlot === 'secondary' ? '#00f2ff' : '#444'}`,
          borderRadius: 6, color: '#fff', fontSize: 11, fontFamily: 'Outfit, sans-serif',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: activeWeaponSlot === 'secondary' ? '0 0 15px rgba(0,242,255,0.3)' : 'none',
          transition: 'all 0.2s ease',
          opacity: activeWeaponSlot === 'secondary' ? 1 : 0.6
        }}>
          <span style={{ opacity: 0.5 }}>2</span>
          <span>{equippedSecondaryWeapon ? itemEmoji(equippedSecondaryWeapon.item_id) : '✖️'}</span>
          <span>{equippedSecondaryWeapon?.item_name || 'Vazio'}</span>
        </div>
      </div>

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
