'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/lib/store';
import { latLngToTile, getVisibleTileCoords, createProceduralTile, TILE_SIZE_METERS } from '@/lib/mapGenerator';
import { generateTileLoot } from '@/lib/loot';
import { ZOMBIE_STATS, randomZombieType } from '@/lib/combat';
import { xpToNextLevel } from '@/lib/combat';
import GameCanvas from '@/components/GameCanvas';
import HUD from '@/components/HUD';
import Inventory from '@/components/Inventory';
import Leaderboard from '@/components/Leaderboard';
import CharacterCustomizer from '@/components/CharacterCustomizer';
import Chat from '@/components/Chat';
import Notifications from '@/components/Notifications';
import TouchControls from '@/components/TouchControls';
import { MapTile, Player } from '@/lib/supabase';

type LoadStatus = 'auth' | 'location' | 'player' | 'map' | 'ready' | 'error';

export default function GamePage() {
  const router = useRouter();
  const {
    setPlayer, player, updatePlayerStats,
    setTiles, setTile,
    setZombies, setZombie,
    setWorldItems,
    setInventory, setEquippedWeapon, setAmmo,
    setOnlinePlayers, updateOnlinePlayer, removeOnlinePlayer,
    addNotification,
    setGameRunning,
    viewportX, viewportY,
    playerPixelX, playerPixelY,
  } = useGameStore();

  const [status, setStatus] = useState<LoadStatus>('auth');
  const [loadMsg, setLoadMsg] = useState('Autenticando...');
  const [error, setError] = useState('');

  // ── 1. Auth check ──
  useEffect(() => {
    initGame();
  }, []);

  const initGame = async () => {
    try {
      // Verifica sessão
      setStatus('auth');
      setLoadMsg('Verificando autenticação...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/'); return; }

      const user = session.user;

      // ── 2. Geolocalização ──
      setStatus('location');
      setLoadMsg('Obtendo sua localização...');
      const coords = await getLocation();

      // ── 3. Player data ──
      setStatus('player');
      setLoadMsg('Carregando seu personagem...');
      const playerData = await loadOrCreatePlayer(user, coords);
      setPlayer(playerData);

      // ── 4. Mapa ──
      setStatus('map');
      setLoadMsg('Gerando o mapa ao redor...');
      await loadMap(playerData, coords);

      // ── 5. Inventário ──
      setLoadMsg('Carregando inventário...');
      await loadInventory(playerData);

      // ── 6. Online players ──
      setLoadMsg('Conectando ao mundo...');
      await markOnline(playerData);
      subscribeRealtime(playerData);

      // ── 7. Boas-vindas ──
      setStatus('ready');
      setGameRunning(true);
      addNotification(`Bem-vindo de volta, ${playerData.username}!`, 'success');
      addNotification('WASD para mover · Clique para atirar', 'info');

    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Erro desconhecido');
    }
  };

  // ── Geolocalização ──
  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        // Fallback: São Paulo centro
        resolve({ lat: -23.5505, lng: -46.6333 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: -23.5505, lng: -46.6333 }), // Fallback se negar
        { timeout: 8000, enableHighAccuracy: false }
      );
    });
  };

  // ── Carrega ou cria player ──
  const loadOrCreatePlayer = async (user: any, coords: { lat: number; lng: number }): Promise<Player> => {
    const { tile_x, tile_y } = latLngToTile(coords.lat, coords.lng);

    const { data: existing } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return existing as Player;
    }

    // Cria novo player
    const username = user.user_metadata?.full_name?.split(' ')[0] || `Survivor_${Math.floor(Math.random() * 9999)}`;
    const newPlayer = {
      user_id: user.id,
      username,
      avatar_url: user.user_metadata?.avatar_url || null,
      level: 1,
      xp: 0,
      xp_to_next: 100,
      max_health: 100,
      current_health: 100,
      max_stamina: 100,
      current_stamina: 100,
      strength: 5,
      agility: 5,
      precision_stat: 5,
      skin_color: '#FFDBAC',
      hair_color: '#3D2B1F',
      shirt_color: '#1a1a2e',
      pants_color: '#2d2d44',
      last_lat: coords.lat,
      last_lng: coords.lng,
      tile_x,
      tile_y,
      kills: 0,
      tiles_explored: 0,
      items_collected: 0,
      deaths: 0,
      is_online: true,
    };

    const { data, error } = await supabase
      .from('players')
      .insert(newPlayer)
      .select()
      .single();

    if (error) throw new Error('Falha ao criar personagem: ' + error.message);
    return data as Player;
  };

  // ── Carrega mapa ──
  const loadMap = async (playerData: Player, coords: { lat: number; lng: number }) => {
    const { tile_x, tile_y } = latLngToTile(coords.lat, coords.lng);
    const visibleCoords = getVisibleTileCoords(tile_x, tile_y, 8); // 8 tiles de raio

    // Busca tiles existentes do banco
    const { data: existingTiles } = await supabase
      .from('map_tiles')
      .select('*')
      .in('tile_x', visibleCoords.map(c => c.tile_x))
      .in('tile_y', visibleCoords.map(c => c.tile_y));

    const existingMap = new Map<string, MapTile>();
    (existingTiles || []).forEach(t => existingMap.set(`${t.tile_x},${t.tile_y}`, t as MapTile));

    // Cria tiles que ainda não existem
    const newTiles: any[] = [];
    visibleCoords.forEach(({ tile_x: tx, tile_y: ty }) => {
      if (!existingMap.has(`${tx},${ty}`)) {
        const lat = coords.lat + (ty - tile_y) * (TILE_SIZE_METERS / 111320);
        const lng = coords.lng + (tx - tile_x) * (TILE_SIZE_METERS / (111320 * Math.cos(coords.lat * Math.PI / 180)));
        const newTile = createProceduralTile(tx, ty, lat, lng);
        newTiles.push(newTile);
      }
    });

    if (newTiles.length > 0) {
      const { data: inserted } = await supabase
        .from('map_tiles')
        .upsert(newTiles, { onConflict: 'tile_x,tile_y' })
        .select();
      (inserted || []).forEach(t => existingMap.set(`${t.tile_x},${t.tile_y}`, t as MapTile));
    }

    setTiles(Array.from(existingMap.values()));

    // Marca tile central como explorado
    const centerTile = existingMap.get(`${tile_x},${tile_y}`);
    if (centerTile && !centerTile.explored_by) {
      await supabase.from('map_tiles').update({
        explored_by: playerData.id,
        explored_at: new Date().toISOString(),
      }).eq('id', centerTile.id);
      updatePlayerStats({ tiles_explored: playerData.tiles_explored + 1 });
    }

    // Spawna loot e zumbis nos tiles próximos
    await spawnWorldContent(existingMap, tile_x, tile_y);
  };

  // ── Spawna loot e zumbis ──
  const spawnWorldContent = async (tiles: Map<string, MapTile>, centerX: number, centerY: number) => {
    const worldItems: any[] = [];
    const zombiesData: any[] = [];

    tiles.forEach((tile) => {
      const dist = Math.max(Math.abs(tile.tile_x - centerX), Math.abs(tile.tile_y - centerY));
      if (dist > 3) return;

      // Loot
      if (tile.has_loot && !tile.loot_collected) {
        const lootCount = Math.floor(Math.random() * 3) + 1;
        const loot = generateTileLoot(tile.tile_type as any, tile.tile_x, tile.tile_y, lootCount);
        loot.forEach(item => {
          worldItems.push({
            ...item,
            id: crypto.randomUUID(),
            tile_x: tile.tile_x,
            tile_y: tile.tile_y,
            pos_x: tile.tile_x * 64 + item.pos_x,
            pos_y: tile.tile_y * 64 + item.pos_y,
          });
        });
      }

      // Zumbis
      for (let i = 0; i < tile.zombie_density; i++) {
        const type = randomZombieType();
        const stats = ZOMBIE_STATS[type];
        zombiesData.push({
          id: crypto.randomUUID(),
          tile_x: tile.tile_x,
          tile_y: tile.tile_y,
          pos_x: tile.tile_x * 64 + Math.random() * 48 + 8,
          pos_y: tile.tile_y * 64 + Math.random() * 48 + 8,
          zombie_type: type,
          max_health: stats.max_health,
          current_health: stats.max_health,
          damage: stats.damage,
          speed: stats.speed,
          xp_reward: stats.xp_reward,
          is_alive: true,
          direction: Math.random() * 360,
        });
      }
    });

    setWorldItems(worldItems);
    setZombies(zombiesData as any);
  };

  // ── Inventário ──
  const loadInventory = async (playerData: Player) => {
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('player_id', playerData.id);

    const items = (data || []) as any[];
    setInventory(items);

    // Ammo count
    const ammoByType: Record<string, number> = {};
    items.filter(i => i.item_type === 'ammo').forEach(i => {
      ammoByType[i.item_id] = (ammoByType[i.item_id] || 0) + i.quantity;
    });
    Object.entries(ammoByType).forEach(([type, count]) => {
      useGameStore.getState().setAmmo(type, count);
    });

    // Auto-equipa a primeira arma encontrada
    const firstWeapon = items.find(i => i.equipped || i.item_type === 'weapon');
    if (firstWeapon) setEquippedWeapon(firstWeapon);
  };

  // ── Marca online ──
  const markOnline = async (playerData: Player) => {
    await supabase.from('players').update({
      is_online: true,
      last_seen: new Date().toISOString(),
    }).eq('id', playerData.id);

    // Marca offline ao sair
    const markOffline = () => {
      supabase.from('players').update({ is_online: false }).eq('id', playerData.id);
    };
    window.addEventListener('beforeunload', markOffline);
    return () => window.removeEventListener('beforeunload', markOffline);
  };

  // ── Realtime subscriptions ──
  const subscribeRealtime = (playerData: Player) => {
    // Players online
    const playersChannel = supabase
      .channel('online_players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Player;
          if (updated.id !== playerData.id) {
            if (updated.is_online) updateOnlinePlayer(updated);
            else removeOnlinePlayer(updated.id);
          }
        }
      })
      .subscribe();

    // Map tiles criados por outros players
    const tilesChannel = supabase
      .channel('map_tiles_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'map_tiles' }, (payload) => {
        setTile(payload.new as MapTile);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(tilesChannel);
    };
  };

  // ── Sync periódico da posição do player ──
  useEffect(() => {
    if (!player || status !== 'ready') return;
    const interval = setInterval(async () => {
      const state = useGameStore.getState();
      const p = state.player;
      if (!p) return;
      await supabase.from('players').update({
        current_health: Math.round(p.current_health),
        current_stamina: Math.round(p.current_stamina),
        xp: p.xp,
        level: p.level,
        kills: p.kills,
        tiles_explored: p.tiles_explored,
        last_seen: new Date().toISOString(),
      }).eq('id', p.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [player?.id, status]);

  // ── Touch controls callbacks ──
  const handleTouchMove = useCallback((dx: number, dy: number) => {
    // Injeta input de movimento para o game loop via evento customizado
    window.dispatchEvent(new CustomEvent('touch-move', { detail: { dx, dy } }));
  }, []);

  const handleTouchAttack = useCallback(() => {
    window.dispatchEvent(new CustomEvent('touch-attack'));
  }, []);

  const handleTouchStopMove = useCallback(() => {
    window.dispatchEvent(new CustomEvent('touch-stop'));
  }, []);

  // ── Tela de loading ──
  if (status !== 'ready') {
    return (
      <LoadingScreen status={status} message={loadMsg} error={error} onRetry={initGame} />
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Efeitos de fundo */}
      <div className="scanlines" />
      <div className="vignette" />

      {/* Canvas do jogo */}
      <GameCanvas />

      {/* HUD */}
      <HUD />

      {/* Modais */}
      <Inventory />
      <Leaderboard />
      <CharacterCustomizer />
      <Chat />

      {/* Notificações */}
      <Notifications />

      {/* Controles touch (mobile) */}
      <TouchControls
        onMove={handleTouchMove}
        onAttack={handleTouchAttack}
        onStopMove={handleTouchStopMove}
      />
    </div>
  );
}

// ── Tela de loading retro ──
function LoadingScreen({ status, message, error, onRetry }: {
  status: LoadStatus;
  message: string;
  error: string;
  onRetry: () => void;
}) {
  const steps: { key: LoadStatus; label: string; icon: string }[] = [
    { key: 'auth', label: 'Auth', icon: '🔐' },
    { key: 'location', label: 'GPS', icon: '📍' },
    { key: 'player', label: 'Personagem', icon: '👤' },
    { key: 'map', label: 'Mapa', icon: '🗺️' },
    { key: 'ready', label: 'Pronto', icon: '✓' },
  ];
  const currentIdx = steps.findIndex(s => s.key === status);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#050505',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 32, padding: 24,
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      {/* Título */}
      <div>
        <div className="pixel-font text-red-600 text-center" style={{ fontSize: 'clamp(24px, 6vw, 48px)', textShadow: '3px 3px 0 #5a0000' }}>
          DEAD
        </div>
        <div className="pixel-font text-center" style={{ fontSize: 'clamp(18px, 4vw, 32px)', color: '#e5e5e5', textShadow: '2px 2px 0 #333' }}>
          WORLD
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {steps.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.key} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              border: `1px solid ${done ? '#22c55e' : active ? '#8b0000' : '#1a1a1a'}`,
              background: done ? 'rgba(34,197,94,0.08)' : active ? 'rgba(139,0,0,0.15)' : 'transparent',
              color: done ? '#22c55e' : active ? '#fff' : '#333',
              fontSize: 10,
              transition: 'all 0.3s',
            }}>
              <span style={{ fontSize: 14 }}>{done ? '✓' : step.icon}</span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Mensagem atual */}
      {status !== 'error' && (
        <div style={{ color: '#666', fontSize: 11, textAlign: 'center' }}>
          <span style={{ color: '#8b0000' }}>{'>'} </span>
          <span className="animate-pulse">{message}</span>
        </div>
      )}

      {/* Erro */}
      {status === 'error' && (
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div className="pixel-font text-red-500 mb-4" style={{ fontSize: 10 }}>ERRO AO CARREGAR</div>
          <div style={{ color: '#666', fontSize: 11, marginBottom: 16 }}>{error}</div>
          <button className="btn-retro btn-retro-red" onClick={onRetry} style={{ fontSize: 9 }}>
            TENTAR NOVAMENTE
          </button>
        </div>
      )}

      {/* Dica de controles (mobile) */}
      <div style={{ color: '#222', fontSize: 9, textAlign: 'center', marginTop: 8 }}>
        PC: WASD + clique para atirar<br />
        Mobile: joystick virtual + botão de ataque
      </div>
    </div>
  );
}
