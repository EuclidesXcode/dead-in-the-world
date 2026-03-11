'use client';
import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

interface LeaderEntry {
  id: string;
  username: string;
  level: number;
  kills: number;
  tiles_explored: number;
  xp: number;
  skin_color: string;
  shirt_color: string;
}

type Tab = 'kills' | 'level' | 'explorer';

export default function Leaderboard() {
  const { showLeaderboard, toggleLeaderboard, player } = useGameStore();
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [tab, setTab] = useState<Tab>('kills');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showLeaderboard) return;
    fetchLeaderboard();
  }, [showLeaderboard, tab]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let orderColumn = 'kills';
      if (tab === 'level') orderColumn = 'level';
      if (tab === 'explorer') orderColumn = 'tiles_explored';

      const { data } = await supabase
        .from('players')
        .select('id, username, level, kills, tiles_explored, xp, skin_color, shirt_color')
        .order(orderColumn, { ascending: false })
        .limit(20);

      setLeaders(data || []);
    } catch { }
    setLoading(false);
  };

  if (!showLeaderboard) return null;

  const tabs: { key: Tab; label: string; icon: string; valueKey: keyof LeaderEntry }[] = [
    { key: 'kills', label: 'MAIS MORTES', icon: '💀', valueKey: 'kills' },
    { key: 'level', label: 'NÍVEL', icon: '⭐', valueKey: 'level' },
    { key: 'explorer', label: 'EXPLORADOR', icon: '🗺️', valueKey: 'tiles_explored' },
  ];

  const currentTabConfig = tabs.find(t => t.key === tab)!;

  const getMedal = (index: number) => {
    if (index === 0) return { emoji: '🥇', color: '#ffd700' };
    if (index === 1) return { emoji: '🥈', color: '#c0c0c0' };
    if (index === 2) return { emoji: '🥉', color: '#cd7f32' };
    return { emoji: `#${index + 1}`, color: '#555' };
  };

  return (
    <div className="modal-overlay" onClick={toggleLeaderboard}>
      <div
        className="modal-content retro-panel"
        style={{ width: 'min(550px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#8b0000' }}>
          <div className="pixel-font text-yellow-500" style={{ fontSize: 11 }}>🏆 RANKING GLOBAL</div>
          <button className="btn-retro btn-retro-red" onClick={toggleLeaderboard} style={{ padding: '4px 8px', fontSize: 9 }}>✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto" style={{ borderColor: '#222' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                padding: '10px 8px',
                fontSize: 8,
                fontFamily: "'Press Start 2P', monospace",
                background: tab === t.key ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: tab === t.key ? '#f59e0b' : '#555',
                border: 'none',
                borderBottom: tab === t.key ? '2px solid #f59e0b' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {t.icon} <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div className="flex justify-center items-center p-8">
              <div className="pixel-font text-yellow-500 animate-pulse" style={{ fontSize: 9 }}>CARREGANDO...</div>
            </div>
          )}

          {!loading && leaders.map((entry, index) => {
            const medal = getMedal(index);
            const isCurrentPlayer = entry.id === player?.id;
            const value = entry[currentTabConfig.valueKey];

            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  borderBottom: '1px solid #111',
                  background: isCurrentPlayer ? 'rgba(57,255,20,0.06)' : 'transparent',
                  borderLeft: isCurrentPlayer ? '3px solid #39ff14' : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                {/* Posição */}
                <div style={{
                  minWidth: 36,
                  fontSize: index < 3 ? 18 : 10,
                  color: medal.color,
                  fontFamily: "'Press Start 2P', monospace",
                  textAlign: 'center',
                }}>
                  {medal.emoji}
                </div>

                {/* Mini avatar CSS */}
                <MiniAvatar skinColor={entry.skin_color || '#FFDBAC'} shirtColor={entry.shirt_color || '#1a1a2e'} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 9,
                    color: isCurrentPlayer ? '#39ff14' : '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {entry.username}
                    {isCurrentPlayer && <span style={{ fontSize: 7, color: '#39ff14', marginLeft: 6 }}>◄ você</span>}
                  </div>
                  <div style={{ fontSize: 8, color: '#555', fontFamily: "'Share Tech Mono', monospace", marginTop: 2 }}>
                    LVL {entry.level}
                  </div>
                </div>

                {/* Valor destacado */}
                <div style={{
                  textAlign: 'right',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 13,
                  color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#fff',
                }}>
                  {Number(value).toLocaleString()}
                  <div style={{ fontSize: 7, color: '#555', fontFamily: "'Share Tech Mono', monospace", marginTop: 2 }}>
                    {currentTabConfig.key === 'kills' ? 'KILLS' : currentTabConfig.key === 'level' ? 'LEVEL' : 'TILES'}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Posição do player atual se não estiver no top 20 */}
          {player && !leaders.find(l => l.id === player.id) && (
            <>
              <div style={{ textAlign: 'center', padding: '8px', color: '#333', fontSize: 11 }}>• • •</div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                background: 'rgba(57,255,20,0.06)',
                borderLeft: '3px solid #39ff14',
              }}>
                <div style={{ minWidth: 36, fontSize: 10, color: '#39ff14', fontFamily: "'Press Start 2P', monospace", textAlign: 'center' }}>?</div>
                <MiniAvatar skinColor={player.skin_color} shirtColor={player.shirt_color} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#39ff14' }}>{player.username}</div>
                  <div style={{ fontSize: 8, color: '#555', fontFamily: "'Share Tech Mono', monospace" }}>LVL {player.level}</div>
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13, color: '#fff' }}>
                  {tab === 'kills' ? player.kills : tab === 'level' ? player.level : player.tiles_explored}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t text-center" style={{ borderColor: '#222', fontSize: 8, color: '#333', fontFamily: "'Share Tech Mono', monospace" }}>
          Atualizado em tempo real · {leaders.length} jogadores
        </div>
      </div>
    </div>
  );
}

// Mini avatar retro para o ranking
function MiniAvatar({ skinColor, shirtColor }: { skinColor: string; shirtColor: string }) {
  return (
    <div style={{ position: 'relative', width: 20, height: 28, imageRendering: 'pixelated', flexShrink: 0 }}>
      {/* Cabeça */}
      <div style={{ position: 'absolute', top: 0, left: 4, width: 12, height: 10, background: skinColor, border: '1px solid #2a1a0d' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#3D2B1F' }} />
        <div style={{ position: 'absolute', top: 5, left: 2, width: 2, height: 2, background: '#000' }} />
        <div style={{ position: 'absolute', top: 5, right: 2, width: 2, height: 2, background: '#000' }} />
      </div>
      {/* Corpo */}
      <div style={{ position: 'absolute', top: 10, left: 2, width: 16, height: 10, background: shirtColor, border: '1px solid #000' }} />
      {/* Pernas */}
      <div style={{ position: 'absolute', top: 20, left: 2, width: 6, height: 8, background: '#2d2d44', border: '1px solid #000' }} />
      <div style={{ position: 'absolute', top: 20, right: 2, width: 6, height: 8, background: '#2d2d44', border: '1px solid #000' }} />
    </div>
  );
}
