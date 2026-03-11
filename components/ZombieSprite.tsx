'use client';
import React, { useState, useEffect, useRef } from 'react';
import { ZombieType } from '@/lib/supabase';

// ──────────────────────────────────────────────────────
//  ZOMBIE CSS SPRITES — 4 tipos, estilo retro pixel art
//  Walker / Runner / Tank / Screamer
// ──────────────────────────────────────────────────────

interface ZombieSpriteProps {
  zombieType: ZombieType;
  health: number;
  maxHealth: number;
  direction?: number;
  isMoving?: boolean;
  isAttacking?: boolean;
  scale?: number;
  showHealthBar?: boolean;
}

export default function ZombieSprite({
  zombieType,
  health,
  maxHealth,
  direction = 0,
  isMoving = true,
  isAttacking = false,
  scale = 1,
  showHealthBar = true,
}: ZombieSpriteProps) {
  const [hurtState, setHurtState] = useState(false);
  const prevHealthRef = useRef(health);

  useEffect(() => {
    if (health < prevHealthRef.current) {
      setHurtState(true);
      const t = setTimeout(() => setHurtState(false), 300);
      prevHealthRef.current = health;
      return () => clearTimeout(t);
    }
    prevHealthRef.current = health;
  }, [health]);

  const facingLeft = direction > 90 && direction < 270;
  const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));

  const animTypeMap = {
    walker: 'anim-zombie-limp',
    runner: 'anim-runner-dash',
    tank: 'anim-tank-stomp',
    screamer: 'anim-zombie-limp'
  };

  const baseAnim = isMoving ? animTypeMap[zombieType] : 'anim-idle-breath';
  const hurtAnim = hurtState ? 'anim-hurt' : '';
  const animClass = `${baseAnim} ${hurtAnim}`;

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      imageRendering: 'pixelated',
      transform: `scaleX(${facingLeft ? -1 : 1})`,
    }}>
      {/* Barra de vida do zumbi */}
      {showHealthBar && (
        <div style={{
          position: 'absolute',
          top: -8,
          left: '50%',
          transform: `translateX(-50%) scaleX(${facingLeft ? -1 : 1})`,
          width: 36,
          height: 4,
          background: '#1a1a1a',
          border: '1px solid #333',
        }}>
          <div style={{ width: `${healthPercent}%`, height: '100%', background: '#dc2626', transition: 'width 0.2s' }} />
        </div>
      )}

      <div className={animClass}>
        {zombieType === 'walker' && <WalkerZombie scale={scale} isAttacking={isAttacking} isMoving={isMoving} />}
        {zombieType === 'runner' && <RunnerZombie scale={scale} isAttacking={isAttacking} isMoving={isMoving} />}
        {zombieType === 'tank' && <TankZombie scale={scale} isAttacking={isAttacking} isMoving={isMoving} />}
        {zombieType === 'screamer' && <ScreamerZombie scale={scale} isAttacking={isAttacking} isMoving={isMoving} />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  WALKER — zumbi padrão
// ════════════════════════════════════════
function WalkerZombie({ scale, isAttacking, isMoving }: { scale: number; isAttacking: boolean; isMoving: boolean }) {
  const s = scale;
  const armL = isAttacking ? 'rotate(-50deg)' : 'rotate(-30deg)';
  const armR = isAttacking ? 'rotate(-50deg)' : 'rotate(-30deg)';

  return (
    <div style={{ position: 'relative', width: 28 * s, height: 44 * s, imageRendering: 'pixelated' }}>
      {/* ── Cabeça podre ── */}
      <div style={{ position: 'absolute', top: 0, left: 4 * s, width: 20 * s, height: 16 * s, background: '#4a7c59', border: `${2 * s}px solid #2a4a35` }}>
        {/* Cicatriz */}
        <div style={{ position: 'absolute', top: 2 * s, left: 2 * s, width: 10 * s, height: s, background: '#2a4a35' }} />
        <div style={{ position: 'absolute', top: 3 * s, left: 5 * s, width: s, height: 5 * s, background: '#2a4a35' }} />
        {/* Olhão esquerdo vermelho */}
        <div style={{ position: 'absolute', top: 6 * s, left: 2 * s, width: 6 * s, height: 5 * s, background: '#8b0000', boxShadow: `0 0 ${3*s}px #ff0000` }}>
          <div style={{ position: 'absolute', inset: s, background: '#cc0000' }} />
          <div style={{ position: 'absolute', top: s, right: s, width: s, height: s, background: 'rgba(255,255,255,0.5)' }} />
        </div>
        {/* Olhão direito */}
        <div style={{ position: 'absolute', top: 6 * s, right: 2 * s, width: 6 * s, height: 5 * s, background: '#8b0000', boxShadow: `0 0 ${3*s}px #ff0000` }}>
          <div style={{ position: 'absolute', inset: s, background: '#cc0000' }} />
          <div style={{ position: 'absolute', top: s, left: s, width: s, height: s, background: 'rgba(255,255,255,0.5)' }} />
        </div>
        {/* Boca rasgada */}
        <div style={{ position: 'absolute', bottom: 2 * s, left: 3 * s, width: 14 * s, height: 4 * s, background: '#1a0000', border: `${s}px solid #440000` }}>
          {/* Dentes podres */}
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              position: 'absolute', bottom: 0, left: `${i * 25}%`,
              width: 3 * s, height: 3 * s,
              background: i % 2 === 0 ? '#ccbb88' : '#998866',
              borderTop: `${s}px solid #333`,
            }} />
          ))}
        </div>
        {/* Cérebro exposto (topo) */}
        <div style={{ position: 'absolute', top: -2 * s, left: 6 * s, width: 8 * s, height: 3 * s, background: '#cc6699', border: `${s}px solid #883355` }} />
      </div>

      {/* ── Pescoço ── */}
      <div style={{ position: 'absolute', top: 16 * s, left: 9 * s, width: 10 * s, height: 4 * s, background: '#4a7c59', border: `${s}px solid #2a4a35` }} />

      {/* ── Torso rasgado ── */}
      <div style={{ position: 'absolute', top: 20 * s, left: 2 * s, width: 24 * s, height: 16 * s, background: '#3a5a45', border: `${2 * s}px solid #2a4a35` }}>
        {/* Rasgos */}
        <div style={{ position: 'absolute', top: 2 * s, left: 6 * s, width: 2 * s, height: 12 * s, background: '#2a4a35' }} />
        <div style={{ position: 'absolute', top: 4 * s, right: 4 * s, width: 3 * s, height: 9 * s, background: '#2a4a35' }} />
        {/* Sangue / Mancha */}
        <div style={{ position: 'absolute', top: 3 * s, left: 8 * s, width: 10 * s, height: 8 * s, background: 'rgba(139,0,0,0.5)' }} />
        {/* Entranhas visíveis */}
        <div style={{ position: 'absolute', bottom: 2 * s, left: 4 * s, width: 16 * s, height: 4 * s, background: 'rgba(180,50,50,0.4)' }} />
      </div>

      {/* ── Braço esquerdo estendido ── */}
      <div style={{
        position: 'absolute', top: 18 * s, left: -4 * s, width: 7 * s, height: 18 * s,
        background: '#4a7c59', border: `${s}px solid #2a4a35`,
        transformOrigin: 'top center', transform: armL,
        transition: 'transform 0.15s',
      }}>
        {/* Garra */}
        <div style={{ position: 'absolute', bottom: -2 * s, left: 0, right: 0, height: 5 * s }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ position: 'absolute', bottom: 0, left: `${i * 33}%`, width: 2 * s, height: 4 * s, background: '#1a0d00', transform: 'rotate(-5deg)' }} />
          ))}
        </div>
      </div>

      {/* ── Braço direito estendido ── */}
      <div style={{
        position: 'absolute', top: 18 * s, right: -4 * s, width: 7 * s, height: 16 * s,
        background: '#4a7c59', border: `${s}px solid #2a4a35`,
        transformOrigin: 'top center', transform: armR,
        transition: 'transform 0.15s',
      }}>
        <div style={{ position: 'absolute', bottom: -2 * s, left: 0, right: 0, height: 5 * s }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ position: 'absolute', bottom: 0, left: `${i * 33}%`, width: 2 * s, height: 4 * s, background: '#1a0d00' }} />
          ))}
        </div>
      </div>

      {/* ── Pernas ── */}
      <div className={isMoving ? 'anim-leg-left' : ''} style={{ position: 'absolute', top: 36 * s, left: 3 * s, width: 9 * s, height: 13 * s, background: '#2a3a30', border: `${s}px solid #1a2a20` }}>
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 4 * s, background: '#1a0d00', border: `${s}px solid #333` }} />
      </div>
      <div className={isMoving ? 'anim-leg-right' : ''} style={{ position: 'absolute', top: 38 * s, right: 3 * s, width: 9 * s, height: 11 * s, background: '#2a3a30', border: `${s}px solid #1a2a20` }}>
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 4 * s, background: '#1a0d00', border: `${s}px solid #333` }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  RUNNER — zumbi rápido e magro
// ════════════════════════════════════════
function RunnerZombie({ scale, isAttacking, isMoving }: { scale: number; isAttacking: boolean; isMoving: boolean }) {
  const s = scale;

  return (
    <div style={{ position: 'relative', width: 22 * s, height: 46 * s, imageRendering: 'pixelated' }}>
      {/* Cabeça menor, mais agressiva */}
      <div style={{ position: 'absolute', top: 0, left: 3 * s, width: 16 * s, height: 14 * s, background: '#5a8c69', border: `${2 * s}px solid #2a4a35` }}>
        {/* Olhos estreitados */}
        <div style={{ position: 'absolute', top: 5 * s, left: 2 * s, width: 5 * s, height: 3 * s, background: '#ff3300', boxShadow: `0 0 ${4*s}px #ff6600` }} />
        <div style={{ position: 'absolute', top: 5 * s, right: 2 * s, width: 5 * s, height: 3 * s, background: '#ff3300', boxShadow: `0 0 ${4*s}px #ff6600` }} />
        {/* Boca aberta correndo */}
        <div style={{ position: 'absolute', bottom: 2 * s, left: 2 * s, width: 12 * s, height: 5 * s, background: '#0d0000', border: `${s}px solid #440000` }}>
          <div style={{ position: 'absolute', top: 0, left: 2 * s, width: 2 * s, height: 3 * s, background: '#ccbb88' }} />
          <div style={{ position: 'absolute', top: 0, right: 2 * s, width: 2 * s, height: 3 * s, background: '#ccbb88' }} />
          {/* Língua */}
          <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 4 * s, height: 3 * s, background: '#cc4444' }} />
        </div>
      </div>
      {/* Corpo magro */}
      <div style={{ position: 'absolute', top: 14 * s, left: 3 * s, width: 16 * s, height: 18 * s, background: '#2d4a38', border: `${2 * s}px solid #1a2a20` }}>
        {/* Costelas visíveis */}
        {[0, 1, 2].map(i => (
          <div key={i} style={{ position: 'absolute', top: (3 + i * 5) * s, left: s, right: s, height: s, background: 'rgba(255,255,255,0.08)' }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,0,0,0.3)' }} />
      </div>
      {/* Braços em posição de corrida */}
      <div style={{
        position: 'absolute', top: 16 * s, left: -3 * s, width: 5 * s, height: 14 * s,
        background: '#5a8c69', border: `${s}px solid #2a4a35`,
        transform: 'rotate(20deg)', transformOrigin: 'top center',
      }} />
      <div style={{
        position: 'absolute', top: 16 * s, right: -3 * s, width: 5 * s, height: 14 * s,
        background: '#5a8c69', border: `${s}px solid #2a4a35`,
        transform: 'rotate(-20deg)', transformOrigin: 'top center',
      }} />
      {/* Pernas longas de corredor */}
      <div className={isMoving ? "anim-leg-left" : ""} style={{ position: 'absolute', top: 32 * s, left: 2 * s, width: 8 * s, height: 18 * s, background: '#1a2a20', border: `${s}px solid #0d1a10` }}>
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 4 * s, background: '#0d0500' }} />
      </div>
      <div className={isMoving ? "anim-leg-right" : ""} style={{ position: 'absolute', top: 34 * s, right: 2 * s, width: 8 * s, height: 16 * s, background: '#1a2a20', border: `${s}px solid #0d1a10` }}>
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 4 * s, background: '#0d0500' }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  TANK — zumbi gordo e resistente
// ════════════════════════════════════════
function TankZombie({ scale, isAttacking, isMoving }: { scale: number; isAttacking: boolean; isMoving: boolean }) {
  const s = scale;

  return (
    <div style={{ position: 'relative', width: 44 * s, height: 50 * s, imageRendering: 'pixelated' }}>
      {/* Cabeça enorme */}
      <div style={{ position: 'absolute', top: 0, left: 8 * s, width: 28 * s, height: 22 * s, background: '#3a6048', border: `${3 * s}px solid #1a3020` }}>
        {/* Olhos injectados */}
        <div style={{ position: 'absolute', top: 7 * s, left: 4 * s, width: 8 * s, height: 7 * s, background: '#cc0000', boxShadow: `0 0 ${6*s}px #ff0000` }}>
          <div style={{ position: 'absolute', inset: s, background: '#660000' }} />
        </div>
        <div style={{ position: 'absolute', top: 7 * s, right: 4 * s, width: 8 * s, height: 7 * s, background: '#cc0000', boxShadow: `0 0 ${6*s}px #ff0000` }}>
          <div style={{ position: 'absolute', inset: s, background: '#660000' }} />
        </div>
        {/* Boca enorme */}
        <div style={{ position: 'absolute', bottom: 2 * s, left: 4 * s, width: 20 * s, height: 6 * s, background: '#0d0000', border: `${2 * s}px solid #660000` }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ position: 'absolute', top: 0, left: `${i * 20}%`, width: 3 * s, height: 5 * s, background: '#ddcc99' }} />
          ))}
        </div>
        {/* Cicatrizes pesadas */}
        <div style={{ position: 'absolute', top: 4 * s, left: 8 * s, width: s, height: 14 * s, background: '#1a3020' }} />
        <div style={{ position: 'absolute', top: 2 * s, right: 6 * s, width: 14 * s, height: s, background: '#1a3020' }} />
      </div>

      {/* Pescoço grosso */}
      <div style={{ position: 'absolute', top: 22 * s, left: 14 * s, width: 16 * s, height: 6 * s, background: '#3a6048', border: `${2 * s}px solid #1a3020` }} />

      {/* Torso enorme */}
      <div style={{ position: 'absolute', top: 28 * s, left: 0, width: 44 * s, height: 20 * s, background: '#2a4535', border: `${3 * s}px solid #1a3020` }}>
        {/* Musculatura */}
        <div style={{ position: 'absolute', top: 3 * s, left: 5 * s, width: 14 * s, height: 14 * s, background: 'rgba(255,255,255,0.04)', border: `${s}px solid rgba(255,255,255,0.06)`, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: 3 * s, right: 5 * s, width: 14 * s, height: 14 * s, background: 'rgba(255,255,255,0.04)', border: `${s}px solid rgba(255,255,255,0.06)`, borderRadius: '50%' }} />
        {/* Sangue */}
        <div style={{ position: 'absolute', top: 4 * s, left: 10 * s, width: 24 * s, height: 10 * s, background: 'rgba(139,0,0,0.5)' }} />
      </div>

      {/* Braços enormes */}
      <div style={{
        position: 'absolute', top: 26 * s, left: -6 * s, width: 10 * s, height: 22 * s,
        background: '#3a6048', border: `${2 * s}px solid #1a3020`,
        transform: isAttacking ? 'rotate(-60deg)' : 'rotate(-20deg)', transformOrigin: 'top center',
        transition: 'transform 0.1s',
      }} />
      <div style={{
        position: 'absolute', top: 26 * s, right: -6 * s, width: 10 * s, height: 22 * s,
        background: '#3a6048', border: `${2 * s}px solid #1a3020`,
        transform: isAttacking ? 'rotate(60deg)' : 'rotate(20deg)', transformOrigin: 'top center',
        transition: 'transform 0.1s',
      }} />

      {/* Pernas grossas */}
      <div className={isMoving ? "anim-leg-left" : ""} style={{ position: 'absolute', top: 48 * s, left: 4 * s, width: 16 * s, height: 12 * s, background: '#1a2a20', border: `${2 * s}px solid #0d1a10` }}>
        <div style={{ position: 'absolute', bottom: 0, inset: 0, height: 4 * s, background: '#0d0500', top: 'auto' }} />
      </div>
      <div className={isMoving ? "anim-leg-right" : ""} style={{ position: 'absolute', top: 48 * s, right: 4 * s, width: 16 * s, height: 12 * s, background: '#1a2a20', border: `${2 * s}px solid #0d1a10` }}>
        <div style={{ position: 'absolute', bottom: 0, inset: 0, height: 4 * s, background: '#0d0500', top: 'auto' }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  SCREAMER — zumbi que grita e chama hordas
// ════════════════════════════════════════
function ScreamerZombie({ scale, isAttacking, isMoving }: { scale: number; isAttacking: boolean; isMoving: boolean }) {
  const s = scale;
  const mouthOpen = isAttacking ? 10 * s : 5 * s;

  return (
    <div style={{ position: 'relative', width: 26 * s, height: 48 * s, imageRendering: 'pixelated' }}>
      {/* Cabeça com boca enorme */}
      <div style={{ position: 'absolute', top: 0, left: 3 * s, width: 20 * s, height: 20 * s, background: '#52806a', border: `${2 * s}px solid #2a4a3a` }}>
        {/* Olhos esbugalhados */}
        <div style={{ position: 'absolute', top: 4 * s, left: 2 * s, width: 7 * s, height: 7 * s, background: '#fff', border: `${s}px solid #000` }}>
          <div style={{ position: 'absolute', inset: s, background: '#cc0000', borderRadius: '50%' }} />
        </div>
        <div style={{ position: 'absolute', top: 4 * s, right: 2 * s, width: 7 * s, height: 7 * s, background: '#fff', border: `${s}px solid #000` }}>
          <div style={{ position: 'absolute', inset: s, background: '#cc0000', borderRadius: '50%' }} />
        </div>
        {/* BOCA ENORME — screaming */}
        <div style={{
          position: 'absolute', bottom: s, left: 2 * s, width: 16 * s, height: mouthOpen,
          background: '#0d0000', border: `${2 * s}px solid #440000`,
          transition: 'height 0.1s',
          overflow: 'hidden',
        }}>
          {/* Úvula */}
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 3 * s, height: 5 * s, background: '#cc4444' }} />
          {/* Dentes superiores */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{ position: 'absolute', top: 0, left: `${2 + i * 4}` + s * 4 + 'px', width: 3 * s, height: 4 * s, background: '#ddd' }} />
          ))}
        </div>
        {/* Ondas sonoras ao gritar */}
        {isAttacking && (
          <>
            <div style={{ position: 'absolute', left: -8 * s, top: '50%', width: 6 * s, height: 6 * s, border: `${s}px solid rgba(255,100,0,0.5)`, borderRadius: '50%', animation: 'ping 0.5s infinite' }} />
            <div style={{ position: 'absolute', right: -8 * s, top: '50%', width: 6 * s, height: 6 * s, border: `${s}px solid rgba(255,100,0,0.5)`, borderRadius: '50%', animation: 'ping 0.5s 0.25s infinite' }} />
          </>
        )}
      </div>
      {/* Corpo esguio */}
      <div style={{ position: 'absolute', top: 20 * s, left: 4 * s, width: 18 * s, height: 18 * s, background: '#3a5a48', border: `${2 * s}px solid #2a4a38` }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,0,0,0.2)' }} />
      </div>
      {/* Braços levantados gritando */}
      <div style={{ position: 'absolute', top: 16 * s, left: -4 * s, width: 6 * s, height: 16 * s, background: '#52806a', border: `${s}px solid #2a4a3a`, transform: 'rotate(-60deg)', transformOrigin: 'top center' }} />
      <div style={{ position: 'absolute', top: 16 * s, right: -4 * s, width: 6 * s, height: 16 * s, background: '#52806a', border: `${s}px solid #2a4a3a`, transform: 'rotate(60deg)', transformOrigin: 'top center' }} />
      {/* Pernas */}
      <div className={isMoving ? 'anim-leg-left' : ''} style={{ position: 'absolute', top: 38 * s, left: 3 * s, width: 9 * s, height: 14 * s, background: '#2a3a30', border: `${s}px solid #1a2a20` }}>
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 4 * s, background: '#0d0500' }} />
      </div>
      <div className={isMoving ? 'anim-leg-right' : ''} style={{ position: 'absolute', top: 38 * s, right: 3 * s, width: 9 * s, height: 14 * s, background: '#2a3a30', border: `${s}px solid #1a2a20` }}>
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 4 * s, background: '#0d0500' }} />
      </div>
    </div>
  );
}
