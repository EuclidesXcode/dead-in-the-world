import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/lib/store';

// ──────────────────────────────────────────────────────
//  PLAYER CSS SPRITE — Visão isométrica 3/4 (perspectiva ~75°)
//  Estilo refinado com iluminação direcional e volume
// ──────────────────────────────────────────────────────

interface PlayerSpriteProps {
  skinColor?: string;
  hairColor?: string;
  shirtColor?: string;
  pantsColor?: string;
  direction?: number;
  isMoving?: boolean;
  isAttacking?: boolean;
  health?: number;
  maxHealth?: number;
  showHealthBar?: boolean;
  scale?: number;
  isLocal?: boolean;
  username?: string;
  nameColor?: string;
  customStyles?: Record<string, React.CSSProperties>;
}

export default function PlayerSprite({
  skinColor = '#FFDBAC',
  hairColor = '#3D2B1F',
  shirtColor = '#1a1a2e',
  pantsColor = '#2d2d44',
  direction = 0,
  isMoving = false,
  isAttacking = false,
  health = 100,
  maxHealth = 100,
  showHealthBar = false,
  scale = 1,
  isLocal = false,
  username,
  nameColor,
  customStyles = {},
}: PlayerSpriteProps) {
  const isNight = useGameStore(state => state.isNight);
  const s = scale;
  const [hurtState, setHurtState] = useState(false);
  const prevHealthRef = useRef(health);

  useEffect(() => {
    if (health < prevHealthRef.current) {
      setHurtState(true);
      const t = setTimeout(() => setHurtState(false), 400);
      prevHealthRef.current = health;
      return () => clearTimeout(t);
    }
    prevHealthRef.current = health;
  }, [health]);

  const facingLeft = direction > 90 && direction < 270;
  const scaleX = facingLeft ? -1 : 1;
  const baseAnim = isMoving ? 'anim-walk-bounce' : 'anim-idle-breath';
  const hurtAnim = hurtState ? 'anim-hurt' : '';
  const tilt = isMoving ? (facingLeft ? -5 : 5) : 0;

  const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const healthColor = healthPercent > 60 ? '#22c55e' : healthPercent > 30 ? '#f59e0b' : '#dc2626';

  // Cores derivadas para shading
  const skinShadow = darkenColor(skinColor, 25);
  const skinHighlight = lightenColor(skinColor, 15);
  const shirtShadow = darkenColor(shirtColor, 30);
  const shirtHighlight = lightenColor(shirtColor, 12);
  const pantsShadow = darkenColor(pantsColor, 25);

  return (
    <div
      style={{
        position: 'relative',
        width: 36 * scale,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        imageRendering: 'pixelated',
        transform: `rotate(${tilt}deg) scaleX(${scaleX})`,
        transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        ...customStyles.container
      }}
    >
      {/* ── Username (não espelha) ── */}
      {username && (
        <div
          style={{
            position: 'absolute',
            top: -24,
            left: '50%',
            transform: `translateX(-50%) scaleX(${scaleX})`,
            whiteSpace: 'nowrap',
            fontSize: 7,
            fontFamily: "'Press Start 2P', monospace",
            color: customStyles.username?.color || nameColor || (isLocal ? '#39ff14' : '#fff'),
            textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
            pointerEvents: 'none',
            zIndex: 20,
            ...customStyles.username
          }}
        >
          {username}
        </div>
      )}

      {/* ── Barra de vida ── */}
      {showHealthBar && (
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: `translateX(-50%) scaleX(${scaleX})`,
            width: 34,
            height: 4,
            background: 'rgba(0,0,0,0.7)',
            border: '1px solid #444',
            borderRadius: 1,
            zIndex: 20,
            ...customStyles.healthBar
          }}
        >
          <div style={{ width: `${healthPercent}%`, height: '100%', background: healthColor, transition: 'width 0.3s', borderRadius: 1 }} />
        </div>
      )}

      {/* ── Sprite do personagem (visão isométrica 3/4) ── */}
      <div
        className={`${baseAnim} ${hurtAnim}`}
        style={{
          position: 'relative',
          width: 36 * scale,
          height: 48 * scale,
          imageRendering: 'pixelated',
          transformOrigin: 'bottom center',
          ...customStyles.sprite
        }}
      >
        {/* ══ SOMBRA NO CHÃO (Isométrica — elipse achatada) ══ */}
        <div style={{
          position: 'absolute',
          bottom: -2 * s,
          left: '50%',
          transform: `translateX(-50%) ${isMoving ? 'scale(1.15, 0.7)' : 'scale(1, 0.6)'}`,
          width: 30 * s,
          height: 14 * s,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
          borderRadius: '50%',
          transition: 'transform 0.3s ease',
          zIndex: 0,
          ...customStyles.shadow
        }} />

        {/* ══ PERNAS (visão isométrica — perspectiva frontal/superior) ══ */}
        <div style={{ position: 'absolute', bottom: 2 * s, left: 0, right: 0, zIndex: 2 }}>
          {/* Perna esquerda */}
          <div className={isMoving ? 'anim-leg-left' : ''} style={{
            position: 'absolute', bottom: 0, left: 5 * s,
            width: 10 * s, height: 14 * s,
            background: `linear-gradient(135deg, ${pantsColor} 0%, ${pantsShadow} 100%)`,
            border: `${s}px solid rgba(0,0,0,0.5)`,
            borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
            transformOrigin: 'top center',
            ...customStyles.legL
          }}>
            {/* Bota */}
            <div style={{
              position: 'absolute', bottom: -s, left: -s, right: -s, height: 5 * s,
              background: 'linear-gradient(180deg, #2a1a0a, #1a0d00)',
              border: `${s}px solid #333`,
              borderRadius: `0 0 ${2*s}px ${2*s}px`,
              ...customStyles.bootL
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: s, background: 'rgba(255,255,255,0.08)' }} />
            </div>
          </div>
          {/* Perna direita */}
          <div className={isMoving ? 'anim-leg-right' : ''} style={{
            position: 'absolute', bottom: 0, right: 5 * s,
            width: 10 * s, height: 14 * s,
            background: `linear-gradient(135deg, ${pantsShadow} 0%, ${pantsColor} 100%)`,
            border: `${s}px solid rgba(0,0,0,0.5)`,
            borderRadius: `${s}px ${s}px ${2*s}px ${2*s}px`,
            transformOrigin: 'top center',
            ...customStyles.legR
          }}>
            <div style={{
              position: 'absolute', bottom: -s, left: -s, right: -s, height: 5 * s,
              background: 'linear-gradient(180deg, #2a1a0a, #1a0d00)',
              border: `${s}px solid #333`,
              borderRadius: `0 0 ${2*s}px ${2*s}px`,
              ...customStyles.bootR
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: s, background: 'rgba(255,255,255,0.08)' }} />
            </div>
          </div>
        </div>

        {/* ══ TORSO / COLETE TÁTICO ══ */}
        <div style={{
          position: 'absolute', top: 16 * s, left: 3 * s, width: 30 * s, height: 18 * s,
          background: `linear-gradient(160deg, ${shirtHighlight} 0%, ${shirtColor} 40%, ${shirtShadow} 100%)`,
          border: `${2 * s}px solid rgba(0,0,0,0.6)`,
          borderRadius: `${3*s}px ${3*s}px ${s}px ${s}px`,
          zIndex: 4,
          overflow: 'hidden',
          ...customStyles.torso
        }}>
          {/* Colete tático com gradiente */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `
              linear-gradient(to right, rgba(0,0,0,0.3) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.3) 100%),
              linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 30%)
            `,
          }} />
          {/* Detalhe bolso */}
          <div style={{ position: 'absolute', top: 3 * s, left: 3 * s, width: 8 * s, height: 7 * s, background: 'rgba(0,0,0,0.15)', border: `${s}px solid rgba(255,255,255,0.06)`, borderRadius: s }} />
          {/* Tiras do colete */}
          <div style={{ position: 'absolute', top: 0, left: '50%', width: s, bottom: 0, background: 'rgba(0,0,0,0.15)' }} />
          {/* Botões metálicos */}
          <div style={{ position: 'absolute', top: 4 * s, right: 5 * s, width: 3 * s, height: 2 * s, background: '#555', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', top: 9 * s, right: 5 * s, width: 3 * s, height: 2 * s, background: '#444', borderRadius: '50%' }} />
          {/* Sombra inferior do peito */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 * s, background: 'linear-gradient(transparent, rgba(0,0,0,0.25))' }} />
          {/* Rim light noturno */}
          {isNight && <div style={{ position: 'absolute', top: 0, left: 0, width: '35%', height: '45%', background: 'rgba(255,180,60,0.3)', filter: 'blur(2px)' }} />}
        </div>

        {/* ══ CINTURÃO ══ */}
        <div style={{
          position: 'absolute', top: 33 * s, left: 3 * s, width: 30 * s, height: 3 * s,
          background: 'linear-gradient(135deg, #2a1a00, #1a0d00)',
          border: `${s}px solid rgba(80,60,30,0.5)`,
          zIndex: 5,
          borderRadius: s,
        }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 5 * s, height: 3 * s, background: 'linear-gradient(135deg, #888, #555)', borderRadius: s }} />
        </div>

        {/* ══ MOCHILA (atrás, visível de cima) ══ */}
        <div style={{
          position: 'absolute', top: 18 * s, left: -1 * s, width: 10 * s, height: 16 * s,
          background: 'linear-gradient(160deg, #4a3525, #3d2b1f)',
          border: `${2 * s}px solid rgba(0,0,0,0.5)`,
          borderRadius: `${2*s}px ${s}px ${s}px ${2*s}px`,
          zIndex: 3,
          ...customStyles.backpack
        }}>
          <div style={{ position: 'absolute', top: 3*s, left: 2*s, width: 5*s, height: 2*s, background: 'rgba(255,255,255,0.08)', borderRadius: s }} />
          <div style={{ position: 'absolute', top: 0, right: s, bottom: 0, width: s, background: 'rgba(0,0,0,0.2)' }} />
        </div>

        {/* ══ BRAÇO ESQUERDO (traseiro) ══ */}
        <div
          className={isMoving ? 'anim-arm-left' : ''}
          style={{
            position: 'absolute', top: 18 * s, left: 0, width: 7 * s, height: 16 * s,
            background: `linear-gradient(160deg, ${skinHighlight}, ${skinColor}, ${skinShadow})`,
            border: `${s}px solid rgba(0,0,0,0.4)`,
            borderRadius: `${2*s}px`,
            transformOrigin: 'top center',
            zIndex: 3,
            ...customStyles.armL
          }}
        >
          <div style={{
            position: 'absolute', bottom: 0, left: s, right: s, height: 5 * s,
            background: skinColor, borderRadius: `0 0 ${2*s}px ${2*s}px`,
          }} />
        </div>

        {/* ══ BRAÇO DIREITO (arma) ══ */}
        <div
          className={isAttacking ? 'anim-recoil' : ''}
          style={{
            position: 'absolute', top: 18 * s, right: 0, width: 7 * s, height: 16 * s,
            background: `linear-gradient(200deg, ${skinColor}, ${skinShadow})`,
            border: `${s}px solid rgba(0,0,0,0.4)`,
            borderRadius: `${2*s}px`,
            transformOrigin: 'top center',
            zIndex: 8,
            ...customStyles.armR
          }}
        >
          <div style={{
            position: 'absolute', bottom: 0, left: s, right: s, height: 5 * s,
            background: skinColor, borderRadius: `0 0 ${2*s}px ${2*s}px`,
          }} />
          {/* ── ARMA ── */}
          <div style={{
            position: 'absolute', bottom: 2 * s, right: -14 * s,
            width: 18 * s, height: 8 * s,
            zIndex: 9,
            ...customStyles.weapon
          }}>
            {/* Cabo ergonômico */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, width: 8 * s, height: 7 * s,
              background: 'linear-gradient(180deg, #222, #0d0d0d)',
              border: `${s}px solid #444`,
              borderRadius: `0 0 ${2*s}px ${s}px`,
            }} />
            {/* Cano */}
            <div style={{
              position: 'absolute', top: 0, left: 3 * s, width: 15 * s, height: 5 * s,
              background: 'linear-gradient(180deg, #2a2a2a, #111)',
              border: `${s}px solid #555`,
              borderRadius: `${s}px ${2*s}px ${2*s}px ${s}px`,
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: s, background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'absolute', top: s, left: 4 * s, width: 2 * s, height: 2 * s, background: '#555' }} />
            </div>
            {/* Flash de tiro */}
            {isAttacking && (
              <div
                className="anim-muzzle"
                style={{
                  position: 'absolute', top: '30%', right: -8 * s,
                  width: 14 * s, height: 14 * s,
                  background: 'radial-gradient(circle, rgba(255,255,255,0.95) 5%, rgba(255,220,0,0.7) 25%, rgba(255,100,0,0.3) 60%, transparent 100%)',
                  borderRadius: '50%',
                  zIndex: 20,
                }}
              />
            )}
          </div>
        </div>

        {/* ══ CABEÇA (visão 3/4 — topo do cabelo mais visível) ══ */}
        <div className={isMoving ? 'anim-head-bob' : ''} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 12 }}>
          <div style={{
            position: 'absolute', top: 0, left: 5 * s, width: 26 * s, height: 18 * s,
            ...customStyles.head
          }}>
            {/* Topo do cabelo (visível de cima — esta é a parte principal na vista isométrica) */}
            <div style={{
              position: 'absolute', top: -2 * s, left: -s, right: -s, height: 10 * s,
              background: `linear-gradient(180deg, ${lightenColor(hairColor, 10)}, ${hairColor})`,
              borderRadius: `${4*s}px ${4*s}px ${s}px ${s}px`,
              border: `${s}px solid rgba(0,0,0,0.4)`,
              zIndex: 2,
              ...customStyles.hair
            }}>
              {/* Brilho no cabelo */}
              <div style={{ position: 'absolute', top: s, left: 4*s, width: 8*s, height: 2*s, background: 'rgba(255,255,255,0.12)', borderRadius: s }} />
              {/* Volume lateral */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: 3 * s, height: 8 * s, background: darkenColor(hairColor, 15) }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 3 * s, height: 8 * s, background: darkenColor(hairColor, 20) }} />
            </div>

            {/* Base da cabeça (rosto) */}
            <div style={{
              position: 'absolute', top: 4 * s, left: 0, right: 0, bottom: 0,
              background: `linear-gradient(160deg, ${skinHighlight} 0%, ${skinColor} 50%, ${skinShadow} 100%)`,
              border: `${2 * s}px solid rgba(40, 25, 10, 0.6)`,
              borderRadius: `${2*s}px`,
              overflow: 'hidden',
              ...customStyles.headBase
            }}>
              {isNight && <div style={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '35%', background: 'rgba(255,180,60,0.35)', filter: 'blur(1px)' }} />}
            </div>

            {/* Olho esquerdo */}
            <div style={{
              position: 'absolute', top: 8 * s, left: 4 * s, width: 7 * s, height: 5 * s,
              background: '#fff',
              border: `${s}px solid rgba(0,0,0,0.7)`,
              borderRadius: `${s}px`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
              ...customStyles.eyeL
            }}>
              <div style={{ width: 3 * s, height: 3 * s, background: '#1a1a1a', borderRadius: '50%', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: s, height: s, background: '#fff', borderRadius: '50%' }} />
              </div>
            </div>
            {/* Olho direito */}
            <div style={{
              position: 'absolute', top: 8 * s, right: 4 * s, width: 7 * s, height: 5 * s,
              background: '#fff',
              border: `${s}px solid rgba(0,0,0,0.7)`,
              borderRadius: `${s}px`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
              ...customStyles.eyeR
            }}>
              <div style={{ width: 3 * s, height: 3 * s, background: '#1a1a1a', borderRadius: '50%', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: s, height: s, background: '#fff', borderRadius: '50%' }} />
              </div>
            </div>

            {/* Sobrancelhas volumosas */}
            <div style={{
              position: 'absolute', top: 6.5 * s, left: 3.5 * s, width: 8 * s, height: 1.5 * s,
              background: hairColor, borderRadius: s, transform: 'rotate(-3deg)'
            }} />
            <div style={{
              position: 'absolute', top: 6.5 * s, right: 3.5 * s, width: 8 * s, height: 1.5 * s,
              background: hairColor, borderRadius: s, transform: 'rotate(3deg)'
            }} />

            {/* Nariz com volume */}
            <div style={{
              position: 'absolute', top: 11 * s, left: '50%', transform: 'translateX(-50%)',
              width: 5 * s, height: 3 * s,
              background: `linear-gradient(135deg, transparent 20%, rgba(0,0,0,0.15) 80%)`,
              borderRadius: `0 0 ${2*s}px ${2*s}px`,
              ...customStyles.nose
            }} />

            {/* Boca */}
            <div style={{
              position: 'absolute', bottom: 2 * s, left: '50%', transform: 'translateX(-50%)',
              width: 10 * s, height: 2.5 * s,
              background: 'linear-gradient(180deg, #7a3a1a, #5a2a10)',
              borderRadius: `0 0 ${2*s}px ${2*s}px`,
              ...customStyles.mouth
            }}>
              <div style={{ position: 'absolute', top: 0, left: 3 * s, width: 1.5 * s, height: s, background: 'rgba(255,255,255,0.6)', borderRadius: s }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Utilitários de cor
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
  const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(2.55 * percent));
  const b = Math.max(0, (num & 0x0000FF) - Math.round(2.55 * percent));
  return `rgb(${r},${g},${b})`;
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + Math.round(2.55 * percent));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(2.55 * percent));
  const b = Math.min(255, (num & 0x0000FF) + Math.round(2.55 * percent));
  return `rgb(${r},${g},${b})`;
}
