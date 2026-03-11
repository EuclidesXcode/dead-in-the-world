'use client';
import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store';
import { VERSION, VERSION_LABEL } from '@/lib/version';

export default function HUD() {
  const { player, equippedWeapon, ammo, toggleInventory, toggleLeaderboard, toggleCharCustomizer, toggleWeaponUpgrade, toggleChat, toggleMap, onlinePlayers } = useGameStore();

  if (!player) return null;

  const healthPercent = (player.current_health / player.max_health) * 100;
  const staminaPercent = (player.current_stamina / player.max_stamina) * 100;
  const xpPercent = (player.xp / player.xp_to_next) * 100;
  const weapon = equippedWeapon;
  const ammoCount = weapon?.stats?.ammo_type ? (ammo[weapon.stats.ammo_type] || 0) : null;

  return (
    <>
      {/* ── TOP LEFT: Stats do player ── */}
      <div
        className="absolute top-3 left-3 z-50"
        style={{ minWidth: 220 }}
      >
        <div className="retro-panel p-3">
          {/* Player info */}
          <div className="flex items-center gap-2 mb-3">
            {/* Avatar miniatura */}
            <div style={{ width: 28, height: 28, background: '#1a1a1a', border: '2px solid #8b0000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 14 }}>💀</span>
            </div>
            <div>
              <div className="pixel-font text-white" style={{ fontSize: 8 }}>{player.username}</div>
              <div style={{ color: '#666', fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
                LVL <span style={{ color: '#f59e0b' }}>{player.level}</span>
              </div>
            </div>
          </div>

          {/* Vida */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 8, color: '#dc2626', fontFamily: "'Press Start 2P', monospace" }}>HP</span>
              <span style={{ fontSize: 8, color: '#dc2626', fontFamily: "'Share Tech Mono', monospace" }}>{player.current_health}/{player.max_health}</span>
            </div>
            <div className="bar-container">
              <div
                className="bar-fill bar-health"
                style={{ width: `${healthPercent}%` }}
              />
            </div>
          </div>

          {/* Stamina */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 8, color: '#3b82f6', fontFamily: "'Press Start 2P', monospace" }}>ST</span>
              <span style={{ fontSize: 8, color: '#3b82f6', fontFamily: "'Share Tech Mono', monospace" }}>{player.current_stamina}/{player.max_stamina}</span>
            </div>
            <div className="bar-container">
              <div
                className="bar-fill bar-stamina"
                style={{ width: `${staminaPercent}%` }}
              />
            </div>
          </div>

          {/* XP */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 8, color: '#8b5cf6', fontFamily: "'Press Start 2P', monospace" }}>XP</span>
              <span style={{ fontSize: 8, color: '#8b5cf6', fontFamily: "'Share Tech Mono', monospace" }}>{player.xp}/{player.xp_to_next}</span>
            </div>
            <div className="bar-container">
              <div
                className="bar-fill bar-xp"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Kills & Tiles */}
        <div className="mt-2 flex gap-2">
          <div className="retro-panel px-3 py-1 text-center flex-1">
            <div style={{ fontSize: 7, color: '#666', fontFamily: "'Share Tech Mono', monospace" }}>MORTES</div>
            <div style={{ fontSize: 12, color: '#dc2626', fontFamily: "'Press Start 2P', monospace" }}>{player.kills}</div>
          </div>
          <div className="retro-panel px-3 py-1 text-center flex-1">
            <div style={{ fontSize: 7, color: '#666', fontFamily: "'Share Tech Mono', monospace" }}>TILES</div>
            <div style={{ fontSize: 12, color: '#39ff14', fontFamily: "'Press Start 2P', monospace" }}>{player.tiles_explored}</div>
          </div>
        </div>
      </div>

      {/* ── TOP RIGHT: Online players & Arma ── */}
      <div className="absolute top-3 right-3 z-50 flex flex-col gap-2 items-end">
        {/* Online counter */}
        <div className="retro-panel px-3 py-2">
          <div className="flex items-center gap-2">
            <div style={{ width: 6, height: 6, background: '#39ff14', borderRadius: '50%', boxShadow: '0 0 6px #39ff14', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 8, color: '#39ff14', fontFamily: "'Press Start 2P', monospace" }}>{onlinePlayers.length + 1} ONLINE</span>
          </div>
        </div>

        {/* Arma equipada */}
        {weapon && (
          <div className="retro-panel px-3 py-2" style={{ minWidth: 150 }}>
            <div style={{ fontSize: 7, color: '#666', fontFamily: "'Share Tech Mono', monospace", marginBottom: 4 }}>EQUIPADO</div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 9, color: '#f59e0b', fontFamily: "'Press Start 2P', monospace" }}>
                {weapon.item_name.toUpperCase().slice(0, 10)}
              </span>
              {ammoCount !== null && (
                <span style={{ fontSize: 9, color: '#fff', fontFamily: "'Share Tech Mono', monospace" }}>
                  {ammoCount}🔶
                </span>
              )}
            </div>
            {/* Durabilidade */}
            <div className="bar-container mt-1" style={{ height: 3 }}>
              <div
                className="bar-fill"
                style={{ width: `${weapon.durability || 100}%`, background: 'linear-gradient(90deg, #f59e0b, #fcd34d)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM CENTER: Hotbar de ações ── */}
      <div
        className="absolute bottom-4 left-1/2 z-50"
        style={{ 
          transform: 'translateX(-50%)', 
          display: 'flex',
          maxWidth: '90vw'
        }}
      >
        <div className="retro-panel px-2 py-2">
          <div className="flex items-center gap-1" style={{ overflowX: 'auto', maxWidth: '85vw' }}>
            {[
              { key: 'I', label: 'INVENTÁRIO', icon: '🎒', action: toggleInventory },
              { key: 'M', label: 'MAPA', icon: '🗺️', action: toggleMap },
              { key: 'C', label: 'PERFIL', icon: '👤', action: toggleCharCustomizer },
              { key: 'U', label: 'UPGRADE', icon: '🔫', action: toggleWeaponUpgrade },
              { key: 'T', label: 'CHAT', icon: '💬', action: toggleChat },
              { key: 'L', label: 'RANKING', icon: '🏆', action: toggleLeaderboard },
            ].map(({ key, label, icon, action }) => (
              <button
                key={key}
                onClick={action}
                className="flex flex-col items-center gap-1 hover:bg-red-900 transition-colors"
                style={{ 
                  border: '1px solid #333', 
                  minWidth: window.innerWidth < 768 ? 48 : 40,
                  padding: window.innerWidth < 768 ? '10px 8px' : '6px 4px', 
                  background: 'transparent', 
                  cursor: 'pointer' 
                }}
                title={label}
              >
                <span style={{ fontSize: window.innerWidth < 768 ? 20 : 16 }}>{icon}</span>
                <span style={{ fontSize: 6, color: '#555', fontFamily: "'Share Tech Mono', monospace" }}>[{key}]</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM LEFT: Badge de versão ── */}
      <div
        className="absolute bottom-2 left-2 z-50"
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 9,
          color: '#333',
          letterSpacing: '0.05em',
          lineHeight: 1,
          userSelect: 'none',
        }}>
          <span style={{ color: '#8b0000' }}>◆</span>
          {' '}DeadWorld{' '}
          <span style={{ color: '#444' }}>v{VERSION}</span>
          {' '}
          <span style={{ color: '#2a2a2a' }}>{VERSION_LABEL}</span>
        </div>
      </div>
    </>
  );
}
