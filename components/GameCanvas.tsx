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
  speed?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const moveTowards = (current: number, target: number, maxDelta: number) => {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
};
const depthScale = (screenY: number, screenH: number, min = 0.9, max = 1.12) =>
  clamp(min + (screenY / Math.max(screenH, 1)) * (max - min), min, max);

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
    cameraShake,
    triggerCameraShake,
  } = useGameStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const lastUpdateRef = useRef(Date.now());
  const lastAttackRef = useRef(0);
  const playerPosRef = useRef({ x: 0, y: 0 });
  const playerVelocityRef = useRef({ x: 0, y: 0 });
  const originTileRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const isMouseMovingRef = useRef(false);

  // ── Camera Parallax: posição suavizada da câmera ──
  const cameraPosRef = useRef({ x: 0, y: 0 });
  const cameraInitializedRef = useRef(false);
  const cameraShakeOffsetRef = useRef({ x: 0, y: 0 });
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
  const [airstrikes, setAirstrikes] = useState<{id: string, x: number, y: number, radius: number, timer: number}[]>([]);

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
    if (!player || tiles.size === 0) return;
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
  }, [player?.id, tiles.size, removeWorldItem]);


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
      if (e.code === 'Digit3') {
        st.setActiveWeaponSlot('explosive');
        st.addNotification('Explosivo Selecionado', 'info');
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

  // ── Evento Global Aleatório: Horda a cada 10 min ──
  useEffect(() => {
    // 10 minutos (600000ms)
    const interval = setInterval(() => {
       if (!hordeActive) {
          useGameStore.getState().addNotification('⚠️ ALERTA: IMENSA HORDA DE ZUMBIS SE APROXIMANDO!', 'danger');
          setHordeActive(true);
          setHordeTimer(60);

          // Spawna instantaneamente entre 25 e 40 zumbis
          const spawnCount = Math.floor(Math.random() * 16) + 25; // 25 a 40
          const level = useGameStore.getState().player?.level || 1;
          for (let i = 0; i < spawnCount; i++) {
            const newZ = createSpawnZombie(
               playerPosRef.current.x, playerPosRef.current.y,
               originTileRef.current.x, originTileRef.current.y,
               level, isPointOnWalkableRoad
            );
            if (newZ) useGameStore.getState().setZombie(newZ as any);
          }
       }
    }, 600000);
    return () => clearInterval(interval);
  }, [hordeActive]);

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

    if (activeSlot === 'explosive') {
       const grenade = state.inventory.find(i => i.item_type === 'explosive');
       if (!grenade) {
          if (now - lastAttackRef.current > 2000) {
             addNotification('Você não tem explosivos no inventário!', 'warning');
             lastAttackRef.current = now;
          }
          return;
       }
       if (now - lastAttackRef.current < 1500) return; // Cooldown de granada (1.5s)
       lastAttackRef.current = now;

       // Reduz inventário
       if (grenade.quantity <= 1) {
          useGameStore.getState().removeInventoryItem(grenade.id);
          supabase.from('inventory').delete().eq('id', grenade.id).then();
       } else {
          useGameStore.getState().updateInventoryItem(grenade.id, { quantity: grenade.quantity - 1 });
          supabase.from('inventory').update({ quantity: grenade.quantity - 1 }).eq('id', grenade.id).then();
       }

       // Projétil
       const projId = crypto.randomUUID();
        setProjectiles(prev => [...prev.slice(-30), {
          id: projId, sx: px, sy: py, tx: targetX, ty: targetY, progress: 0,
          size: 8, type: 'grenade',
        }]);

        // Camera shake leve no lançamento
        triggerCameraShake(3, 0.15);

       // Explode depois de meio seg.
       setTimeout(() => {
           audioSystem?.playShootSound(); // placeholder expl.
           const radius = grenade.stats?.explosion_radius || 120;
           const damage = grenade.stats?.damage || 250;
           
           // Camera shake forte na explosão
           triggerCameraShake(12, 0.4);
          addDamageNumber({ x: targetX - state.viewportX, y: targetY - state.viewportY - 40, damage: damage, isCrit: true });
          
          const hitTargets = findTargetsAtPosition(targetX, targetY, radius, 30);
          hitTargets.forEach(t => {
            if ('zombie_type' in t) {
              const freshTarget = useGameStore.getState().zombies.get(t.id);
              if (!freshTarget || !freshTarget.is_alive) return;
              
              const newHp = Math.max(0, freshTarget.current_health - (damage * (0.8 + Math.random() * 0.4)));
              if (newHp <= 0) {
                setZombie({ ...freshTarget, is_alive: false, current_health: 0 });
                const drop = generateZombieDrop(freshTarget.pos_x, freshTarget.pos_y);
                if (drop) useGameStore.getState().addWorldItem(drop);
                setTimeout(() => removeZombie(t.id), 800);
                updatePlayerStats({ kills: p.kills + 1, xp: p.xp + (freshTarget.xp_reward || 10) });
              } else {
                setZombie({ ...freshTarget, current_health: newHp });
              }
            }
          });
       }, 500);

       return;
    }

    const targets = findTargetsAtPosition(targetX, targetY, 60, (w1 && w2) ? 2 : 1);
    
    lastAttackRef.current = now;
    setIsAttacking(true);
    setTimeout(() => setIsAttacking(false), 100);

    const processShoot = (target: any, weapon: any, isSecondary: boolean) => {
      if (!weapon) return false;
      
      const dx = targetX - px;
      const dy = targetY - py;
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      setPlayerDir(angle);

      // Offset para simular mãos (esquerda/direita)
      const rad = (angle * Math.PI) / 180;
      const handDist = 14;
      const side = isSecondary ? 1 : -1;
      const ox = Math.cos(rad + Math.PI/2) * handDist * side;
      const oy = Math.sin(rad + Math.PI/2) * handDist * side;

      if (weapon.stats?.ammo_type) {
        const ok = useGameStore.getState().useAmmo(weapon.stats.ammo_type, 1);
        if (!ok) {
           if (!isSecondary) addNotification(`Sem munição: ${weapon.item_name}`, 'warning');
           return false;
        }
      }

      audioSystem?.playShootSound();
      const { damage, isCrit, missed } = calculatePlayerDamage(p, weapon);
      
      let tx = target?.pos_x ?? targetX;
      let ty = target?.pos_y ?? targetY;
      
      if (target && 'last_lat' in target) {
         const { pixelX, pixelY } = playerWorldPixelFromLatLng(target.last_lat, target.last_lng);
         tx = pixelX; ty = pixelY;
      }

      if (!missed) {
        addDamageNumber({
          x: tx - state.viewportX + (isSecondary ? 10 : -10),
          y: ty - state.viewportY - 20,
          damage: missed ? 0 : damage,
          isCrit,
        });

        if (target) {
          const splashRadius = weapon.stats?.splash_radius || 0;
          const targetsToHit = splashRadius > 0 
            ? findTargetsAtPosition(tx, ty, splashRadius, 10)
            : [target];

          targetsToHit.forEach(t => {
            if ('zombie_type' in t) {
              audioSystem?.playZombieHurt();
              const freshTarget = useGameStore.getState().zombies.get(t.id);
              if (!freshTarget || !freshTarget.is_alive) return;
              
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
      }

      // Sistema visual do projétil saindo da "mão"
      setProjectiles(prev => [...prev.slice(-30), {
        id: Math.random().toString(36).slice(2),
        sx: px + ox, sy: py + oy, tx, ty, progress: 0,
        size: weapon.stats?.projectile_size || 3,
        type: weapon.stats?.bullet_type || 'normal',
      }]);

      return true;
    };

    if (mainWeapon) processShoot(targets[0], mainWeapon, false);
    if (offWeapon) processShoot(targets[0], offWeapon, true);
    
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
          if (Math.abs(newHp - p.current_health) > 0.05) {
            updatePlayerStats({ current_health: newHp });
            // Camera shake sutil ao tomar dano
            if (dmg * dt > 1) {
              useGameStore.getState().triggerCameraShake(Math.min(6, dmg * dt * 0.5), 0.15);
            }
          }
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
      const h = (screenH / zoom) / 0.75; // Compensar scaleY(0.75) — área visível é maior em Y

      // Movimentação com aceleração e desaceleração para evitar resposta seca.
      const baseSpeed = 220 * (1 + p.agility * 0.04);
      let inputX = 0, inputY = 0;

      if (!showInventory) {
        const keys = keysRef.current;
        if (keys.has('KeyW') || keys.has('ArrowUp')) inputY -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) inputY += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1;
      }

      const keys = keysRef.current;
      const hasMovementInput = inputX !== 0 || inputY !== 0;
      const wantsSprint = hasMovementInput && !showInventory && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && p.current_stamina > 5;
      const targetSpeed = wantsSprint ? baseSpeed * 1.85 : baseSpeed;
      const inputLength = hasMovementInput ? Math.hypot(inputX, inputY) : 1;
      const targetVelX = hasMovementInput ? (inputX / inputLength) * targetSpeed : 0;
      const targetVelY = hasMovementInput ? (inputY / inputLength) * targetSpeed : 0;
      const accelRate = wantsSprint ? 2400 : 1800;
      const decelRate = 2100;

      playerVelocityRef.current.x = moveTowards(
        playerVelocityRef.current.x,
        targetVelX,
        (hasMovementInput ? accelRate : decelRate) * dt
      );
      playerVelocityRef.current.y = moveTowards(
        playerVelocityRef.current.y,
        targetVelY,
        (hasMovementInput ? accelRate : decelRate) * dt
      );

      let stepX = playerVelocityRef.current.x * dt;
      let stepY = playerVelocityRef.current.y * dt;

      if (!process.env.NEXT_PUBLIC_IGNORE_COLLISION) {
        const pxBase = playerPosRef.current.x;
        const pyBase = playerPosRef.current.y;
        const canMoveDiagonal = isPointOnWalkableRoad(pxBase + stepX, pyBase + stepY + 10);
        if (canMoveDiagonal) {
          playerPosRef.current.x += stepX;
          playerPosRef.current.y += stepY;
        } else {
          const canMoveX = isPointOnWalkableRoad(pxBase + stepX, pyBase + 10);
          const canMoveY = isPointOnWalkableRoad(pxBase, pyBase + stepY + 10);
          if (canMoveX) playerPosRef.current.x += stepX;
          else playerVelocityRef.current.x = 0;
          if (canMoveY) playerPosRef.current.y += stepY;
          else playerVelocityRef.current.y = 0;
        }
      } else {
        playerPosRef.current.x += stepX;
        playerPosRef.current.y += stepY;
      }

      const currentSpeed = Math.hypot(playerVelocityRef.current.x, playerVelocityRef.current.y);
      const moving = currentSpeed > 18;
      setIsMoving(moving);

      // Facing direction
      if (screenW >= 768) {
        const mdx = (mousePosRef.current.x / zoom) - w / 2;
        const mdy = (mousePosRef.current.y / zoom) - h / 2;
        setPlayerDir((Math.atan2(mdy, mdx) * 180 / Math.PI + 360) % 360);
      } else if (moving) {
        setPlayerDir((Math.atan2(playerVelocityRef.current.y, playerVelocityRef.current.x) * 180 / Math.PI + 360) % 360);
      }

      const isSprinting = wantsSprint && currentSpeed > baseSpeed * 1.15;
      if (moving) {
        const staminaConsumption = isSprinting ? dt * 24 : dt * 4;
        const newStamina = Math.max(0, p.current_stamina - staminaConsumption);
        if (Math.abs(newStamina - p.current_stamina) > 0.05) updatePlayerStats({ current_stamina: newStamina });
      } else {
        const newStamina = Math.min(p.max_stamina, p.current_stamina + dt * 10);
        if (Math.abs(newStamina - p.current_stamina) > 0.1) updatePlayerStats({ current_stamina: newStamina });
      }

      const px = playerPosRef.current.x;
      const py = playerPosRef.current.y;
      setPlayerPixel(px, py);

      // Atualiza lat/lng real quando move
      if (currentSpeed > 10 && originTileRef.current) {
        const { lat, lng } = worldPixelToLatLng(px, py, originTileRef.current.x, originTileRef.current.y);
        // Só atualiza o estado zustand se a distância for significativa para não engasgar a thread
        if (Math.abs(p.last_lat - lat) > 0.00005 || Math.abs(p.last_lng - lng) > 0.00005) {
          updatePlayerStats({ last_lat: lat, last_lng: lng });
        }
      }

      // ── Camera Parallax: Lerp suave ──
      const targetCamX = px - w / 2 + clamp(playerVelocityRef.current.x * 0.18, -70, 70);
      const targetCamY = py - h / 2 + clamp(playerVelocityRef.current.y * 0.12, -45, 45);

      if (!cameraInitializedRef.current) {
        cameraPosRef.current = { x: targetCamX, y: targetCamY };
        cameraInitializedRef.current = true;
      } else {
        // Lerp factor: quanto maior, mais responsivo (0.08 = suave, 0.2 = rígido)
        const lerpFactor = moving ? 0.16 : 0.1;
        cameraPosRef.current.x += (targetCamX - cameraPosRef.current.x) * lerpFactor;
        cameraPosRef.current.y += (targetCamY - cameraPosRef.current.y) * lerpFactor;
      }

      // ── Camera Shake ──
      const shakeState = useGameStore.getState().cameraShake;
      const shakeElapsed = (now - shakeState.startTime) / 1000;
      if (shakeElapsed < shakeState.duration && shakeState.intensity > 0) {
        const decay = 1 - (shakeElapsed / shakeState.duration); // de 1 → 0
        const freq = 25; // frequência do tremor
        cameraShakeOffsetRef.current = {
          x: Math.sin(shakeElapsed * freq * 6.28) * shakeState.intensity * decay * (Math.random() * 0.4 + 0.8),
          y: Math.cos(shakeElapsed * freq * 4.71) * shakeState.intensity * decay * (Math.random() * 0.4 + 0.8),
        };
      } else {
        cameraShakeOffsetRef.current = { x: 0, y: 0 };
      }

      const finalCamX = cameraPosRef.current.x + cameraShakeOffsetRef.current.x;
      const finalCamY = cameraPosRef.current.y + cameraShakeOffsetRef.current.y;

      // Viewport
      setViewport(finalCamX, finalCamY);

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

      // Atualiza Bombardeio
      setAirstrikes(prev => {
         if (prev.length === 0) return prev;
         let hasChanges = false;
         const next = prev.map(a => {
            const newTimer = a.timer - dt;
            if (newTimer <= 0) {
              hasChanges = true;
              // Explode
              const distP = distance(px, py, a.x, a.y);
              if (distP <= a.radius) {
                 useGameStore.getState().updatePlayerStats({ current_health: Math.max(0, p.current_health - 60) });
                 useGameStore.getState().addDamageNumber({ x: px, y: py - 20, damage: 60, isCrit: true });
              }
              const currentState = useGameStore.getState();
              currentState.zombies.forEach(zom => {
                 if (zom.is_alive && distance(zom.pos_x, zom.pos_y, a.x, a.y) <= a.radius) {
                    currentState.setZombie({ ...zom, current_health: 0, is_alive: false });
                    currentState.addDamageNumber({ x: zom.pos_x, y: zom.pos_y - 20, damage: 999, isCrit: true });
                 }
              });
              // Efeito visual na frente usando projeteis falsos grandes e lentos
              setTimeout(() => {
                setProjectiles(pj => [...pj, {
                  id: crypto.randomUUID(), sx: a.x, sy: a.y, tx: a.x, ty: a.y,
                  progress: 0.8, speed: 0.1, type: 'rocket', size: a.radius / 5
                }]);
              }, 10);
              return null;
            }
            if (newTimer !== a.timer) hasChanges = true;
            return { ...a, timer: newTimer };
         }).filter(Boolean) as any;
         return hasChanges ? next : prev;
      });

      // Atualiza Projéteis Visuais
      setProjectiles(prev => {
        if (prev.length === 0) return prev;
        return prev
          .map(pj => ({ ...pj, progress: pj.progress + dt * (pj.speed ?? 4.5) }))
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
  const h = (windowSize.h / zoom) / 0.75; // Compensar scaleY(0.75)

  // ── Parallax offsets ──
  const parallaxBgOffsetX = viewportX * 0.3;
  const parallaxBgOffsetY = viewportY * 0.3;
  const parallaxFgOffsetX = viewportX * 1.3;
  const parallaxFgOffsetY = viewportY * 1.3;
  const playerVelocity = playerVelocityRef.current;
  const playerMotion = Math.hypot(playerVelocity.x, playerVelocity.y);
  const playerMotionRatio = clamp(playerMotion / (280 + player.agility * 12), 0, 1);
  const sceneLeanX = clamp(playerVelocity.y * 0.008, -4, 4);
  const sceneLeanY = clamp(playerVelocity.x * -0.01, -6, 6);
  const sceneTranslateX = clamp(playerVelocity.x * -0.025, -16, 16);
  const sceneTranslateY = clamp(playerVelocity.y * -0.02, -12, 12);
  const visibleItems = worldItems
    .filter((item) => {
      const sx = item.pos_x - viewportX;
      const sy = item.pos_y - viewportY;
      return !(sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60);
    })
    .sort((a, b) => a.pos_y - b.pos_y);
  const visibleZombies = Array.from(zombies.values())
    .filter((zombie) => {
      const sx = zombie.pos_x - viewportX;
      const sy = zombie.pos_y - viewportY;
      return !(sx < -100 || sx > w + 100 || sy < -100 || sy > h + 100);
    })
    .sort((a, b) => a.pos_y - b.pos_y);
  const visiblePlayers = onlinePlayers
    .filter((op) => op.id !== player.id && !!op.last_lat && !!op.last_lng)
    .map((op) => {
      const { pixelX: opX, pixelY: opY } = playerWorldPixelFromLatLng(op.last_lat!, op.last_lng!);
      return { op, opX, opY };
    })
    .filter(({ opX, opY }) => {
      const sx = opX - viewportX;
      const sy = opY - viewportY;
      return !(sx < -100 || sx > w + 100 || sy < -100 || sy > h + 100);
    })
    .sort((a, b) => a.opY - b.opY);

  return (
    <div
      ref={canvasRef}
      className="game-canvas"
      onClick={handleCanvasClick}
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#12110a' }}
    >
      {/* ══════ PARALLAX LAYER: BACKGROUND (0.3x) — neblina/nuvens distantes ══════ */}
      <div className="parallax-bg-layer" style={{
        position: 'absolute',
        inset: '-20%',
        width: '140%',
        height: '140%',
        transform: `translate(${-parallaxBgOffsetX % 800}px, ${-parallaxBgOffsetY % 600}px)`,
        pointerEvents: 'none',
        zIndex: 0,
        willChange: 'transform',
      }}>
        {/* Nuvens de neblina distante */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`fog-${i}`} className="parallax-fog-cloud" style={{
            position: 'absolute',
            left: `${(i * 17.5) % 100}%`,
            top: `${(i * 13.3 + 5) % 90}%`,
            width: 200 + (i % 3) * 80,
            height: 80 + (i % 2) * 40,
            background: `radial-gradient(ellipse, rgba(${20 + i * 3},${15 + i * 2},${8 + i},${0.15 + (i % 3) * 0.05}) 0%, transparent 70%)`,
            borderRadius: '50%',
            animationDelay: `${i * 2.5}s`,
            animation: `parallax-fog-drift ${30 + i * 5}s infinite linear alternate`,
          }} />
        ))}
        {/* Estrelas distantes / pontos de luz */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={`star-${i}`} style={{
            position: 'absolute',
            left: `${(i * 8.7 + 3) % 95}%`,
            top: `${(i * 11.3 + 2) % 88}%`,
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            background: `rgba(255,${180 + i * 5},${80 + i * 10},${0.08 + (i % 4) * 0.03})`,
            borderRadius: '50%',
            boxShadow: `0 0 ${4 + i % 3}px rgba(255,${150 + i * 5},50,${0.1 + (i % 3) * 0.05})`,
            animation: `parallax-star-flicker ${3 + i * 0.7}s infinite ease-in-out alternate`,
            animationDelay: `${i * 0.4}s`,
          }} />
        ))}
      </div>

      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        overflow: 'hidden',
        perspective: '1600px',
      }}>
        <div style={{
          transform: `translate(${sceneTranslateX}px, ${sceneTranslateY}px) rotateX(${sceneLeanX}deg) rotateZ(${sceneLeanY}deg) scale(${zoom * (1 + playerMotionRatio * 0.015)}) scaleY(${0.75 - playerMotionRatio * 0.025})`,
          transformOrigin: 'center center',
          width: w,
          height: h / 0.75,
          position: 'absolute',
          top: `${-(h / 0.75 - h) / 2}px`, left: 0,
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

        {/* ── MAPA REAL: ruas pós-apocalípticas em SVG ── */}
        <StreetMap
          viewportX={viewportX}
          viewportY={viewportY}
          screenW={w}
          screenH={h / 0.75}
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

        {/* ── Bombardeios ── */}
        {airstrikes.map(a => {
          const sx = a.x - viewportX;
          const sy = a.y - viewportY;
          if (a.timer <= 0) return null;
          
          return (
            <div key={a.id} style={{
              position: 'absolute', left: sx - a.radius, top: sy - a.radius,
              width: a.radius * 2, height: a.radius * 2,
              borderRadius: '50%',
              background: 'rgba(255, 0, 0, 0.2)',
              border: '2px solid rgba(255, 0, 0, 0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse-red 0.5s infinite',
              pointerEvents: 'none',
              zIndex: 10
            }}>
              <span style={{ color: 'red', fontWeight: 'bold' }}>{Math.ceil(a.timer)}</span>
            </div>
          );
        })}

        {/* ── ITENS NO CHÃO ── */}

      {/* ══ ILUMINAÇÃO SOLAR ══ */}
      {/* Sol — luz direcional quente vindo do canto superior esquerdo */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8,
        background: 'radial-gradient(ellipse at 15% 10%, rgba(255,220,140,0.12) 0%, rgba(255,180,80,0.06) 30%, transparent 70%)',
        mixBlendMode: 'screen',
      }} />

      {/* Luz ambiente quente (simulando scattering atmosférico) */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8,
        background: 'linear-gradient(160deg, rgba(255,200,120,0.06) 0%, transparent 40%, rgba(180,140,80,0.03) 100%)',
        mixBlendMode: 'overlay',
      }} />

      {/* Sombra do sol — escurece o lado oposto ao sol */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9,
        background: 'radial-gradient(ellipse at 85% 90%, rgba(0,0,10,0.2) 0%, transparent 60%)',
      }} />

      {/* ── Vinheta ambiente pós-apocalipse ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
        background: 'radial-gradient(ellipse at 40% 35%, transparent 50%, rgba(5,3,2,0.5) 100%)',
      }} />

      {/* ── Scanlines ── */}
      <div className="scanlines" style={{ zIndex: 11 }} />

      {/* ── Items ── */}
      {visibleItems.map((item) => {
        const sx = item.pos_x - viewportX;
        const sy = item.pos_y - viewportY;
        const itemScale = depthScale(sy, h, 0.88, 1.08);
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
            transform: `scale(${itemScale})`,
            transformOrigin: 'center bottom',
            zIndex: 55 + Math.round(sy),
          }}>
            {itemEmoji(item.item_id)}
          </div>
        );
      })}

      {/* ── Zumbis ── */}
      {visibleZombies.map((zombie) => {
        const sx = zombie.pos_x - viewportX;
        const sy = zombie.pos_y - viewportY;
        const isTarget = currentTarget === zombie.id;
        const zombieScale = depthScale(sy, h, 0.9, 1.1);
        return (
          <div key={zombie.id} style={{
            position: 'absolute',
            left: sx - 16,
            top: sy - 44,
            zIndex: 80 + Math.round(sy),
            transform: `scale(${zombieScale})`,
            transformOrigin: 'center bottom',
          }}>
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
      {visiblePlayers.map(({ op, opX, opY }) => {
        const sx = opX - viewportX;
        const sy = opY - viewportY;
        const remoteScale = depthScale(sy, h, 0.92, 1.1);
        
        // Parse styles for other player
        const opCustomStyles = op.custom_css ? parseCustomCSS(op.custom_css) : {};

        return (
          <div key={op.id} style={{
            position: 'absolute',
            left: sx - 16,
            top: sy - 44,
            zIndex: 90 + Math.round(sy),
            transform: `scale(${remoteScale})`,
            transformOrigin: 'center bottom',
          }}>
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
        zIndex: 100 + Math.round(playerPixelY - viewportY),
        transform: `translateY(${clamp(-playerMotionRatio * 6, -6, 0)}px) scale(${depthScale(playerPixelY - viewportY, h, 0.94, 1.12)})`,
        transformOrigin: 'center bottom',
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
        <div style={{
          padding: '10px 15px', background: 'rgba(5,5,5,0.85)', 
          border: `2px solid ${activeWeaponSlot === 'explosive' ? '#ff3b30' : '#444'}`,
          borderRadius: 6, color: '#fff', fontSize: 11, fontFamily: 'Outfit, sans-serif',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: activeWeaponSlot === 'explosive' ? '0 0 15px rgba(255,59,48,0.3)' : 'none',
          transition: 'all 0.2s ease',
          opacity: activeWeaponSlot === 'explosive' ? 1 : 0.6
        }}>
          <span style={{ opacity: 0.5 }}>3</span>
          <span>{inventory.find(i => i.item_type === 'explosive') ? itemEmoji(inventory.find(i => i.item_type === 'explosive')!.item_id) : '💥'}</span>
          <span>
            {inventory.find(i => i.item_type === 'explosive') 
              ? `${inventory.find(i => i.item_type === 'explosive')?.item_name} (${inventory.find(i => i.item_type === 'explosive')?.quantity})` 
              : 'Sem Explosivo'
            }
          </span>
        </div>
      </div>

      {/* ══════ PARALLAX LAYER: FOREGROUND (1.3x) — cinzas/brasas flutuantes ══════ */}
      <div className="parallax-fg-layer" style={{
        position: 'absolute',
        inset: '-10%',
        width: '120%',
        height: '120%',
        transform: `translate(${-(parallaxFgOffsetX - viewportX) % 600}px, ${-(parallaxFgOffsetY - viewportY) % 400}px)`,
        pointerEvents: 'none',
        zIndex: 200,
        willChange: 'transform',
      }}>
        {/* Cinzas flutuantes */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={`ash-${i}`} className="parallax-ash" style={{
            position: 'absolute',
            left: `${(i * 5.3) % 100}%`,
            top: `${(i * 7.1 + 3) % 95}%`,
            width: 2 + (i % 3),
            height: 1 + (i % 2),
            background: i % 3 === 0 
              ? `rgba(255,${120 + i * 8},${30 + i * 5},${0.3 + (i % 4) * 0.1})`  // brasa
              : `rgba(${120 + i * 5},${100 + i * 3},${80 + i * 2},${0.2 + (i % 3) * 0.08})`,  // cinza
            borderRadius: i % 3 === 0 ? '50%' : '1px',
            boxShadow: i % 3 === 0 ? `0 0 4px rgba(255,${100 + i * 5},0,0.4)` : 'none',
            animation: `parallax-ash-float ${6 + i * 1.2}s infinite ease-in-out`,
            animationDelay: `${i * 0.7}s`,
          }} />
        ))}
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
  return ({ grenade: '💣', pistol: '🔫', shotgun: '🔫', rifle: '🔫', knife: '🔪', machete: '🗡️', bat: '⚾', bandage: '🩹', medkit: '🧰', pain_meds: '💊', canned_food: '🥫', water_bottle: '💧', ammo_9mm: '🔶', ammo_shotgun: '🔶', ammo_rifle: '🔷' } as any)[id] || '📦';
}
