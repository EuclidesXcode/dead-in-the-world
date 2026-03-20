'use client';
import React, { useState, useEffect, useRef } from 'react';
import { ZombieType } from '@/lib/supabase';

// ──────────────────────────────────────────────────────
//  ZOMBIE CSS SPRITES — Visão isométrica 3/4
//  Walker / Runner / Tank / Screamer / Leaper
//  Estilo refinado com iluminação e volume
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
  isAlive?: boolean;
}

// Utilitários de cor
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  if (isNaN(num)) return hex;
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
  const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(2.55 * percent));
  const b = Math.max(0, (num & 0x0000FF) - Math.round(2.55 * percent));
  return `rgb(${r},${g},${b})`;
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  if (isNaN(num)) return hex;
  const r = Math.min(255, (num >> 16) + Math.round(2.55 * percent));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(2.55 * percent));
  const b = Math.min(255, (num & 0x0000FF) + Math.round(2.55 * percent));
  return `rgb(${r},${g},${b})`;
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
  isAlive = true,
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
    screamer: 'anim-zombie-limp',
    leaper: 'anim-runner-dash'
  };

  const baseAnim = isMoving ? animTypeMap[zombieType] : 'anim-idle-breath';
  const hurtAnim = hurtState ? 'anim-hurt' : '';
  const deathAnim = !isAlive ? 'anim-zombie-death' : '';
  const animClass = !isAlive ? deathAnim : `${baseAnim} ${hurtAnim}`;

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      imageRendering: 'pixelated',
      transform: `scaleX(${facingLeft ? -1 : 1})`,
    }}>
      {/* Barra de vida */}
      {showHealthBar && isAlive && (
        <div style={{
          position: 'absolute',
          top: -10,
          left: '50%',
          transform: `translateX(-50%) scaleX(${facingLeft ? -1 : 1})`,
          width: 38,
          height: 4,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid #444',
          borderRadius: 1,
          zIndex: 20,
        }}>
          <div style={{ width: `${healthPercent}%`, height: '100%', background: '#dc2626', transition: 'width 0.2s', borderRadius: 1 }} />
        </div>
      )}

      <div className={animClass}>
        {zombieType === 'walker' && <WalkerZombie scale={scale} isAttacking={isAttacking} isMoving={isMoving} />}
        {zombieType === 'runner' && <RunnerZombie scale={scale} isAttacking={isAttacking} isMoving={isMoving} />}
        {zombieType === 'tank' && <TankZombie scale={scale} isAttacking={isAttacking} isMoving={isMoving} />}
        {zombieType === 'screamer' && <ScreamerZombie scale={scale} isAttacking={isAttacking} isMoving={isMoving} />}
        {zombieType === 'leaper' && <LeaperZombie scale={scale} isAttacking={isAttacking} isMoving={isMoving} />}

        {/* Poça de sangue ao morrer */}
        {!isAlive && (
          <div className="anim-blood" style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 44 * scale, height: 44 * scale,
            background: 'radial-gradient(circle, rgba(120,0,0,0.85) 0%, rgba(100,0,0,0.4) 40%, transparent 70%)',
            borderRadius: '50%', pointerEvents: 'none',
            zIndex: -1, translate: '-50% -50%'
          }} />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  Sombra isométrica compartilhada
// ════════════════════════════════════════
function IsoShadow({ s, width = 28, moving = false }: { s: number; width?: number; moving?: boolean }) {
  return (
    <div style={{
      position: 'absolute', bottom: -2 * s, left: '50%',
      transform: `translateX(-50%) ${moving ? 'scale(1.1, 0.65)' : 'scale(1, 0.55)'}`,
      width: width * s, height: 12 * s,
      background: 'radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 65%, transparent 100%)',
      borderRadius: '50%', transition: 'transform 0.3s', zIndex: 0,
    }} />
  );
}

// ════════════════════════════════════════
//  WALKER — zumbi padrão
// ════════════════════════════════════════
function WalkerZombie({ scale: s, isAttacking, isMoving }: { scale: number; isAttacking: boolean; isMoving: boolean }) {
  const skin = '#4a7c59';
  const skinDark = darkenColor(skin, 20);
  const skinLight = lightenColor(skin, 10);
  const armRot = isAttacking ? 'rotate(-55deg)' : 'rotate(-30deg)';

  return (
    <div style={{ position: 'relative', width: 32 * s, height: 48 * s, imageRendering: 'pixelated' }}>
      <IsoShadow s={s} width={30} moving={isMoving} />

      {/* Pernas */}
      <div className={isMoving ? 'anim-leg-left' : ''} style={{
        position: 'absolute', bottom: 2 * s, left: 4 * s, width: 10 * s, height: 14 * s,
        background: `linear-gradient(160deg, #2a3a30, #1a2a20)`,
        border: `${s}px solid rgba(0,0,0,0.5)`, borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
        transformOrigin: 'top center', zIndex: 1,
      }}>
        <div style={{ position: 'absolute', bottom: -s, left: -s, right: -s, height: 4 * s, background: '#1a0d00', border: `${s}px solid #333`, borderRadius: `0 0 ${2*s}px ${2*s}px` }} />
      </div>
      <div className={isMoving ? 'anim-leg-right' : ''} style={{
        position: 'absolute', bottom: 4 * s, right: 4 * s, width: 10 * s, height: 12 * s,
        background: `linear-gradient(160deg, #1a2a20, #0d1a10)`,
        border: `${s}px solid rgba(0,0,0,0.5)`, borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
        transformOrigin: 'top center', zIndex: 1,
      }}>
        <div style={{ position: 'absolute', bottom: -s, left: -s, right: -s, height: 4 * s, background: '#1a0d00', border: `${s}px solid #333`, borderRadius: `0 0 ${2*s}px ${2*s}px` }} />
      </div>

      {/* Torso rasgado */}
      <div style={{
        position: 'absolute', top: 20 * s, left: 2 * s, width: 28 * s, height: 18 * s,
        background: `linear-gradient(160deg, ${skinLight} 0%, #3a5a45 40%, ${skinDark} 100%)`,
        border: `${2 * s}px solid rgba(0,0,0,0.5)`,
        borderRadius: `${3*s}px ${3*s}px ${s}px ${s}px`,
        zIndex: 3, overflow: 'hidden',
      }}>
        {/* Mancha de sangue */}
        <div style={{ position: 'absolute', top: 2 * s, left: 6 * s, width: 14 * s, height: 10 * s, background: 'rgba(139,0,0,0.55)', borderRadius: '40%' }} />
        {/* Entranhas */}
        <div style={{ position: 'absolute', bottom: 2 * s, left: 3 * s, width: 20 * s, height: 5 * s, background: 'rgba(160,40,40,0.4)', borderRadius: `${2*s}px` }} />
        {/* Moscas */}
        {[0, 1, 2].map(i => (
          <div key={i} className="anim-float" style={{
            position: 'absolute', top: `${20 + i * 25}%`, left: `${15 + i * 30}%`,
            width: s * 1.5, height: s * 1.5, background: '#000', borderRadius: '50%', opacity: 0.5,
          }} />
        ))}
      </div>

      {/* Braços estendidos */}
      <div style={{
        position: 'absolute', top: 20 * s, left: -4 * s, width: 8 * s, height: 18 * s,
        background: `linear-gradient(180deg, ${skinLight}, ${skinDark})`,
        border: `${s}px solid rgba(0,0,0,0.4)`, borderRadius: `${2*s}px`,
        transformOrigin: 'top center', transform: armRot, transition: 'transform 0.15s', zIndex: 4,
      }}>
        {/* Garras */}
        <div style={{ position: 'absolute', bottom: -3 * s, left: 0, right: 0, display: 'flex', justifyContent: 'space-around' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 2 * s, height: 5 * s, background: '#1a0d00', borderRadius: s, transform: `rotate(${-8 + i * 8}deg)` }} />
          ))}
        </div>
      </div>
      <div style={{
        position: 'absolute', top: 20 * s, right: -4 * s, width: 8 * s, height: 16 * s,
        background: `linear-gradient(180deg, ${skin}, ${skinDark})`,
        border: `${s}px solid rgba(0,0,0,0.4)`, borderRadius: `${2*s}px`,
        transformOrigin: 'top center', transform: armRot, transition: 'transform 0.15s', zIndex: 4,
      }}>
        <div style={{ position: 'absolute', bottom: -3 * s, left: 0, right: 0, display: 'flex', justifyContent: 'space-around' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 2 * s, height: 5 * s, background: '#1a0d00', borderRadius: s }} />
          ))}
        </div>
      </div>

      {/* Pescoço */}
      <div style={{
        position: 'absolute', top: 16 * s, left: 10 * s, width: 12 * s, height: 6 * s,
        background: `linear-gradient(160deg, ${skin}, ${skinDark})`,
        border: `${s}px solid rgba(0,0,0,0.3)`, zIndex: 5,
      }} />

      {/* Cabeça */}
      <div style={{
        position: 'absolute', top: 0, left: 4 * s, width: 24 * s, height: 20 * s,
        zIndex: 10,
      }}>
        {/* Topo craniano (visível de cima) */}
        <div style={{
          position: 'absolute', top: -2 * s, left: -s, right: -s, height: 8 * s,
          background: `linear-gradient(180deg, ${skinLight}, ${skin})`,
          borderRadius: `${5*s}px ${5*s}px ${s}px ${s}px`,
          border: `${s}px solid rgba(0,0,0,0.3)`,
        }}>
          {/* Cérebro exposto */}
          <div style={{ position: 'absolute', top: 0, left: 6 * s, width: 12 * s, height: 5 * s, background: 'linear-gradient(135deg, #cc6699, #aa4477)', borderRadius: `${3*s}px ${3*s}px 0 0`, border: `${s}px solid #773355` }} />
        </div>
        {/* Rosto */}
        <div style={{
          position: 'absolute', top: 3 * s, left: 0, right: 0, bottom: 0,
          background: `linear-gradient(160deg, ${skinLight}, ${skin}, ${skinDark})`,
          border: `${2 * s}px solid rgba(40,60,40,0.6)`,
          borderRadius: `${2*s}px`,
        }}>
          {/* Boca com dentes */}
          <div style={{
            position: 'absolute', bottom: 2 * s, left: 3 * s, right: 3 * s, height: 5 * s,
            background: '#0d0000', border: `${s}px solid #440000`, borderRadius: s,
          }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ position: 'absolute', top: 0, left: `${15 + i * 30}%`, width: 2 * s, height: 3 * s, background: '#ccbb88' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  RUNNER — zumbi rápido
// ════════════════════════════════════════
function RunnerZombie({ scale: s, isAttacking, isMoving }: { scale: number; isAttacking: boolean; isMoving: boolean }) {
  return (
    <div style={{ position: 'relative', width: 26 * s, height: 48 * s, imageRendering: 'pixelated' }}>
      <IsoShadow s={s} width={24} moving={isMoving} />

      {/* Pernas longas */}
      <div className={isMoving ? 'anim-leg-left' : ''} style={{
        position: 'absolute', bottom: 0, left: 2 * s, width: 9 * s, height: 16 * s,
        background: 'linear-gradient(160deg, #1a2a20, #0d1a10)',
        border: `${s}px solid rgba(0,0,0,0.5)`, borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
        transformOrigin: 'top center', zIndex: 1,
      }}>
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 4 * s, background: '#0d0500', borderRadius: `0 0 ${2*s}px ${2*s}px` }} />
      </div>
      <div className={isMoving ? 'anim-leg-right' : ''} style={{
        position: 'absolute', bottom: 2 * s, right: 2 * s, width: 9 * s, height: 14 * s,
        background: 'linear-gradient(160deg, #0d1a10, #050d05)',
        border: `${s}px solid rgba(0,0,0,0.5)`, borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
        transformOrigin: 'top center', zIndex: 1,
      }}>
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 4 * s, background: '#0d0500', borderRadius: `0 0 ${2*s}px ${2*s}px` }} />
      </div>

      {/* Corpo magro */}
      <div style={{
        position: 'absolute', top: 16 * s, left: 3 * s, width: 22 * s, height: 20 * s,
        background: 'linear-gradient(160deg, #3a5a40, #2d4a38, #1a2a20)',
        border: `${2 * s}px solid rgba(0,0,0,0.5)`,
        borderRadius: `${3*s}px ${3*s}px ${s}px ${s}px`,
        zIndex: 3, overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 4*s, width: 2*s, height: '70%', background: 'rgba(139,0,0,0.5)' }} />
        {[0, 1, 2].map(i => (
          <div key={i} style={{ position: 'absolute', top: (3 + i * 5) * s, left: 2*s, right: 2*s, height: s, background: 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>

      {/* Braços em posição de corrida */}
      <div style={{
        position: 'absolute', top: 18 * s, left: -3 * s, width: 6 * s, height: 16 * s,
        background: 'linear-gradient(180deg, #5a8c69, #3a6050)',
        border: `${s}px solid rgba(0,0,0,0.4)`, borderRadius: `${2*s}px`,
        transform: 'rotate(25deg)', transformOrigin: 'top center', zIndex: 4,
      }} />
      <div style={{
        position: 'absolute', top: 18 * s, right: -3 * s, width: 6 * s, height: 16 * s,
        background: 'linear-gradient(180deg, #5a8c69, #3a6050)',
        border: `${s}px solid rgba(0,0,0,0.4)`, borderRadius: `${2*s}px`,
        transform: 'rotate(-25deg)', transformOrigin: 'top center', zIndex: 4,
      }} />

      {/* Cabeça */}
      <div style={{
        position: 'absolute', top: 0, left: 4 * s, width: 20 * s, height: 18 * s, zIndex: 10,
      }}>
        <div style={{
          position: 'absolute', top: -s, left: -s, right: -s, height: 7 * s,
          background: 'linear-gradient(180deg, #6a9c79, #5a8c69)',
          borderRadius: `${4*s}px ${4*s}px 0 0`, border: `${s}px solid rgba(0,0,0,0.3)`,
        }} />
        <div style={{
          position: 'absolute', top: 3 * s, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(160deg, #6a9c79, #5a8c69, #3a6050)',
          border: `${2 * s}px solid rgba(30,50,35,0.6)`, borderRadius: `${2*s}px`,
        }}>
          {/* Olhos vermelhos brilhantes */}
          <div style={{ position: 'absolute', top: 3 * s, left: 2 * s, width: 6 * s, height: 4 * s, background: '#ff3300', borderRadius: s, boxShadow: `0 0 ${6*s}px #ff6600` }} />
          <div style={{ position: 'absolute', top: 3 * s, right: 2 * s, width: 6 * s, height: 4 * s, background: '#ff3300', borderRadius: s, boxShadow: `0 0 ${6*s}px #ff6600` }} />
          {/* Boca aberta */}
          <div style={{
            position: 'absolute', bottom: s, left: 2 * s, right: 2 * s, height: 6 * s,
            background: '#0d0000', border: `${s}px solid #440000`, borderRadius: s,
          }}>
            <div style={{ position: 'absolute', top: 0, left: 2 * s, width: 2 * s, height: 3 * s, background: '#ccbb88' }} />
            <div style={{ position: 'absolute', top: 0, right: 2 * s, width: 2 * s, height: 3 * s, background: '#ccbb88' }} />
            <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 4 * s, height: 3 * s, background: '#cc4444', borderRadius: s }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  TANK — zumbi gordo
// ════════════════════════════════════════
function TankZombie({ scale: s, isAttacking, isMoving }: { scale: number; isAttacking: boolean; isMoving: boolean }) {
  return (
    <div style={{ position: 'relative', width: 48 * s, height: 54 * s, imageRendering: 'pixelated' }}>
      <IsoShadow s={s} width={44} moving={isMoving} />

      {/* Pernas grossas */}
      <div className={isMoving ? 'anim-leg-left' : ''} style={{
        position: 'absolute', bottom: 0, left: 6 * s, width: 16 * s, height: 14 * s,
        background: 'linear-gradient(160deg, #1a2a20, #0d1a10)',
        border: `${2 * s}px solid rgba(0,0,0,0.5)`, borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
        transformOrigin: 'top center', zIndex: 1,
      }}>
        <div style={{ position: 'absolute', bottom: 0, inset: 0, top: 'auto', height: 5 * s, background: '#0d0500', borderRadius: `0 0 ${2*s}px ${2*s}px` }} />
      </div>
      <div className={isMoving ? 'anim-leg-right' : ''} style={{
        position: 'absolute', bottom: 2 * s, right: 6 * s, width: 16 * s, height: 12 * s,
        background: 'linear-gradient(160deg, #0d1a10, #050d05)',
        border: `${2 * s}px solid rgba(0,0,0,0.5)`, borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
        transformOrigin: 'top center', zIndex: 1,
      }}>
        <div style={{ position: 'absolute', bottom: 0, inset: 0, top: 'auto', height: 5 * s, background: '#0d0500', borderRadius: `0 0 ${2*s}px ${2*s}px` }} />
      </div>

      {/* Torso enorme */}
      <div style={{
        position: 'absolute', top: 24 * s, left: 0, width: 48 * s, height: 22 * s,
        background: 'linear-gradient(160deg, #3a6048, #2a4535, #1a3020)',
        border: `${3 * s}px solid rgba(0,0,0,0.5)`,
        borderRadius: `${4*s}px`,
        zIndex: 3, overflow: 'hidden',
      }}>
        {/* Músculos */}
        <div style={{ position: 'absolute', top: 3 * s, left: 5 * s, width: 16 * s, height: 16 * s, background: 'rgba(255,255,255,0.04)', border: `${s}px solid rgba(255,255,255,0.06)`, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: 3 * s, right: 5 * s, width: 16 * s, height: 16 * s, background: 'rgba(255,255,255,0.04)', border: `${s}px solid rgba(255,255,255,0.06)`, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: 4 * s, left: 10 * s, width: 28 * s, height: 12 * s, background: 'rgba(139,0,0,0.45)', borderRadius: '30%' }} />
      </div>

      {/* Pescoço grosso */}
      <div style={{
        position: 'absolute', top: 20 * s, left: 14 * s, width: 20 * s, height: 8 * s,
        background: 'linear-gradient(160deg, #3a6048, #2a4535)',
        border: `${2 * s}px solid rgba(0,0,0,0.3)`, zIndex: 5,
      }} />

      {/* Braços enormes */}
      <div style={{
        position: 'absolute', top: 24 * s, left: -8 * s, width: 12 * s, height: 24 * s,
        background: 'linear-gradient(180deg, #3a6048, #2a4535)',
        border: `${2 * s}px solid rgba(0,0,0,0.4)`, borderRadius: `${3*s}px`,
        transform: isAttacking ? 'rotate(-65deg)' : 'rotate(-20deg)', transformOrigin: 'top center',
        transition: 'transform 0.12s', zIndex: 4,
      }} />
      <div style={{
        position: 'absolute', top: 24 * s, right: -8 * s, width: 12 * s, height: 24 * s,
        background: 'linear-gradient(180deg, #3a6048, #2a4535)',
        border: `${2 * s}px solid rgba(0,0,0,0.4)`, borderRadius: `${3*s}px`,
        transform: isAttacking ? 'rotate(65deg)' : 'rotate(20deg)', transformOrigin: 'top center',
        transition: 'transform 0.12s', zIndex: 4,
      }} />

      {/* Cabeça enorme */}
      <div style={{
        position: 'absolute', top: 0, left: 8 * s, width: 32 * s, height: 24 * s, zIndex: 10,
      }}>
        <div style={{
          position: 'absolute', top: -2 * s, left: -s, right: -s, height: 10 * s,
          background: 'linear-gradient(180deg, #4a7058, #3a6048)',
          borderRadius: `${6*s}px ${6*s}px 0 0`, border: `${s}px solid rgba(0,0,0,0.3)`,
        }}>
          {/* Cicatrizes */}
          <div style={{ position: 'absolute', top: 3 * s, left: 8 * s, width: s, height: 8 * s, background: 'rgba(0,0,0,0.3)' }} />
        </div>
        <div style={{
          position: 'absolute', top: 4 * s, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(160deg, #4a7058, #3a6048, #2a4535)',
          border: `${3 * s}px solid rgba(20,40,25,0.6)`, borderRadius: `${3*s}px`,
        }}>
          {/* Olhos */}
          <div style={{ position: 'absolute', top: 4 * s, left: 4 * s, width: 9 * s, height: 7 * s, background: '#cc0000', borderRadius: `${2*s}px`, boxShadow: `0 0 ${8*s}px rgba(255,0,0,0.5)` }}>
            <div style={{ position: 'absolute', inset: s, background: '#660000', borderRadius: s }} />
          </div>
          <div style={{ position: 'absolute', top: 4 * s, right: 4 * s, width: 9 * s, height: 7 * s, background: '#cc0000', borderRadius: `${2*s}px`, boxShadow: `0 0 ${8*s}px rgba(255,0,0,0.5)` }}>
            <div style={{ position: 'absolute', inset: s, background: '#660000', borderRadius: s }} />
          </div>
          {/* Boca enorme */}
          <div style={{
            position: 'absolute', bottom: 2 * s, left: 4 * s, right: 4 * s, height: 7 * s,
            background: '#0d0000', border: `${2 * s}px solid #660000`, borderRadius: `${s}px`,
          }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ position: 'absolute', top: 0, left: `${8 + i * 18}%`, width: 3 * s, height: 5 * s, background: '#ddcc99' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  SCREAMER — grita e chama hordas
// ════════════════════════════════════════
function ScreamerZombie({ scale: s, isAttacking, isMoving }: { scale: number; isAttacking: boolean; isMoving: boolean }) {
  const mouthH = isAttacking ? 10 * s : 5 * s;

  return (
    <div style={{ position: 'relative', width: 30 * s, height: 50 * s, imageRendering: 'pixelated' }}>
      <IsoShadow s={s} width={28} moving={isMoving} />

      {/* Pernas */}
      <div className={isMoving ? 'anim-leg-left' : ''} style={{
        position: 'absolute', bottom: 0, left: 4 * s, width: 10 * s, height: 14 * s,
        background: 'linear-gradient(160deg, #2a3a30, #1a2a20)',
        border: `${s}px solid rgba(0,0,0,0.5)`, borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
        transformOrigin: 'top center', zIndex: 1,
      }}>
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 4 * s, background: '#0d0500', borderRadius: `0 0 ${2*s}px ${2*s}px` }} />
      </div>
      <div className={isMoving ? 'anim-leg-right' : ''} style={{
        position: 'absolute', bottom: 0, right: 4 * s, width: 10 * s, height: 14 * s,
        background: 'linear-gradient(160deg, #1a2a20, #0d1a10)',
        border: `${s}px solid rgba(0,0,0,0.5)`, borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
        transformOrigin: 'top center', zIndex: 1,
      }}>
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 4 * s, background: '#0d0500', borderRadius: `0 0 ${2*s}px ${2*s}px` }} />
      </div>

      {/* Corpo esguio */}
      <div style={{
        position: 'absolute', top: 22 * s, left: 4 * s, width: 22 * s, height: 18 * s,
        background: 'linear-gradient(160deg, #4a6a58, #3a5a48, #2a4a38)',
        border: `${2 * s}px solid rgba(0,0,0,0.5)`, borderRadius: `${3*s}px`,
        zIndex: 3, overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,0,0,0.15)' }} />
      </div>

      {/* Braços levantados */}
      <div style={{
        position: 'absolute', top: 18 * s, left: -4 * s, width: 7 * s, height: 18 * s,
        background: 'linear-gradient(180deg, #52806a, #3a6050)',
        border: `${s}px solid rgba(0,0,0,0.4)`, borderRadius: `${2*s}px`,
        transform: 'rotate(-65deg)', transformOrigin: 'top center', zIndex: 4,
      }} />
      <div style={{
        position: 'absolute', top: 18 * s, right: -4 * s, width: 7 * s, height: 18 * s,
        background: 'linear-gradient(180deg, #52806a, #3a6050)',
        border: `${s}px solid rgba(0,0,0,0.4)`, borderRadius: `${2*s}px`,
        transform: 'rotate(65deg)', transformOrigin: 'top center', zIndex: 4,
      }} />

      {/* Cabeça */}
      <div style={{ position: 'absolute', top: 0, left: 3 * s, width: 24 * s, height: 24 * s, zIndex: 10 }}>
        <div style={{
          position: 'absolute', top: -s, left: -s, right: -s, height: 8 * s,
          background: 'linear-gradient(180deg, #62907a, #52806a)',
          borderRadius: `${4*s}px ${4*s}px 0 0`, border: `${s}px solid rgba(0,0,0,0.3)`,
        }} />
        <div style={{
          position: 'absolute', top: 3 * s, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(160deg, #62907a, #52806a, #3a6050)',
          border: `${2 * s}px solid rgba(30,50,40,0.6)`, borderRadius: `${2*s}px`,
        }}>
          {/* Olhos esbugalhados */}
          <div style={{ position: 'absolute', top: 3 * s, left: 2 * s, width: 8 * s, height: 7 * s, background: '#fff', border: `${s}px solid #000`, borderRadius: `${2*s}px` }}>
            <div style={{ position: 'absolute', inset: s, background: '#cc0000', borderRadius: '50%' }} />
          </div>
          <div style={{ position: 'absolute', top: 3 * s, right: 2 * s, width: 8 * s, height: 7 * s, background: '#fff', border: `${s}px solid #000`, borderRadius: `${2*s}px` }}>
            <div style={{ position: 'absolute', inset: s, background: '#cc0000', borderRadius: '50%' }} />
          </div>
          {/* BOCA ENORME */}
          <div style={{
            position: 'absolute', bottom: s, left: 2 * s, right: 2 * s, height: mouthH,
            background: '#0d0000', border: `${2 * s}px solid #440000`, borderRadius: s,
            transition: 'height 0.1s', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 3 * s, height: 5 * s, background: '#cc4444', borderRadius: s }} />
          </div>
          {/* Ondas sonoras */}
          {isAttacking && (
            <>
              <div style={{ position: 'absolute', left: -10 * s, top: '50%', width: 8 * s, height: 8 * s, border: `${s}px solid rgba(255,100,0,0.5)`, borderRadius: '50%', animation: 'ping 0.5s infinite' }} />
              <div style={{ position: 'absolute', right: -10 * s, top: '50%', width: 8 * s, height: 8 * s, border: `${s}px solid rgba(255,100,0,0.5)`, borderRadius: '50%', animation: 'ping 0.5s 0.25s infinite' }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  LEAPER — pula obstáculos
// ════════════════════════════════════════
function LeaperZombie({ scale: s, isAttacking, isMoving }: { scale: number; isAttacking: boolean; isMoving: boolean }) {
  return (
    <div style={{ position: 'relative', width: 28 * s, height: 46 * s, imageRendering: 'pixelated' }}>
      <IsoShadow s={s} width={26} moving={isMoving} />

      {/* Pernas poderosas */}
      <div className={isMoving ? 'anim-leg-left' : ''} style={{
        position: 'absolute', bottom: 0, left: 2 * s, width: 11 * s, height: 14 * s,
        background: 'linear-gradient(160deg, #1a2a20, #050d05)',
        border: `${2 * s}px solid rgba(0,0,0,0.5)`, borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
        transformOrigin: 'top center', zIndex: 1,
      }} />
      <div className={isMoving ? 'anim-leg-right' : ''} style={{
        position: 'absolute', bottom: 0, right: 2 * s, width: 11 * s, height: 14 * s,
        background: 'linear-gradient(160deg, #0d1a10, #050d05)',
        border: `${2 * s}px solid rgba(0,0,0,0.5)`, borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
        transformOrigin: 'top center', zIndex: 1,
      }} />

      {/* Corpo arqueado */}
      <div style={{
        position: 'absolute', top: 20 * s, left: 3 * s, width: 24 * s, height: 16 * s,
        background: 'linear-gradient(160deg, #4a6a55, #3a5a45, #2a4a35)',
        border: `${2 * s}px solid rgba(0,0,0,0.5)`, borderRadius: `${3*s}px`,
        transform: 'skewX(-8deg)', zIndex: 3, overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 2*s, right: 2*s, height: s, background: 'rgba(255,255,255,0.15)' }} />
      </div>

      {/* Braços-garras */}
      <div style={{
        position: 'absolute', top: 24 * s, left: -4 * s, width: 7 * s, height: 20 * s,
        background: 'linear-gradient(180deg, #7a9c79, #5a8060)',
        border: `${s}px solid rgba(0,0,0,0.4)`, borderRadius: `${2*s}px`,
        transform: 'rotate(18deg)', transformOrigin: 'top center', zIndex: 4,
      }} />
      <div style={{
        position: 'absolute', top: 24 * s, right: -4 * s, width: 7 * s, height: 20 * s,
        background: 'linear-gradient(180deg, #7a9c79, #5a8060)',
        border: `${s}px solid rgba(0,0,0,0.4)`, borderRadius: `${2*s}px`,
        transform: 'rotate(-18deg)', transformOrigin: 'top center', zIndex: 4,
      }} />

      {/* Cabeça curvada */}
      <div style={{ position: 'absolute', top: 4 * s, left: 3 * s, width: 22 * s, height: 20 * s, zIndex: 10 }}>
        <div style={{
          position: 'absolute', top: -s, left: -s, right: -s, height: 8 * s,
          background: 'linear-gradient(180deg, #8aac89, #7a9c79)',
          borderRadius: `${4*s}px ${4*s}px 0 0`, border: `${s}px solid rgba(0,0,0,0.3)`,
        }} />
        <div style={{
          position: 'absolute', top: 3 * s, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(160deg, #8aac89, #7a9c79, #5a8060)',
          border: `${2 * s}px solid rgba(30,50,30,0.6)`, borderRadius: `${3*s}px`,
        }}>
          {/* Olhos amarelos */}
          <div style={{ position: 'absolute', top: 3 * s, left: 2 * s, width: 7 * s, height: 5 * s, background: '#ff0', borderRadius: `${2*s}px`, boxShadow: `0 0 ${8*s}px rgba(255,255,0,0.6)` }} />
          <div style={{ position: 'absolute', top: 3 * s, right: 2 * s, width: 7 * s, height: 5 * s, background: '#ff0', borderRadius: `${2*s}px`, boxShadow: `0 0 ${8*s}px rgba(255,255,0,0.6)` }} />
          {/* Presas */}
          <div style={{ position: 'absolute', bottom: 0, left: 5 * s, width: 2 * s, height: 5 * s, background: '#fff', borderRadius: `0 0 ${s}px ${s}px` }} />
          <div style={{ position: 'absolute', bottom: 0, right: 5 * s, width: 2 * s, height: 5 * s, background: '#fff', borderRadius: `0 0 ${s}px ${s}px` }} />
        </div>
      </div>
    </div>
  );
}
