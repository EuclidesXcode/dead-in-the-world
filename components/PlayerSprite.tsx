'use client';
import React, { useEffect, useState, useRef } from 'react';

// ──────────────────────────────────────────────────────
//  PLAYER CSS SPRITE — estilo retro pixel art (GTA 1 / Mario)
//  Desenhado 100% com div CSS, sem imagens externas
// ──────────────────────────────────────────────────────

interface PlayerSpriteProps {
  skinColor?: string;
  hairColor?: string;
  shirtColor?: string;
  pantsColor?: string;
  direction?: number; // ângulo em graus
  isMoving?: boolean;
  isAttacking?: boolean;
  health?: number;     // 0-100
  maxHealth?: number;
  showHealthBar?: boolean;
  scale?: number;
  isLocal?: boolean;   // jogador local tem borda diferente
  username?: string;
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
  customStyles = {},
}: PlayerSpriteProps) {
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

  // Calcular flip baseado em direção (espelha o sprite)
  const facingLeft = direction > 90 && direction < 270;
  const scaleX = facingLeft ? -1 : 1;

  const baseAnim = isMoving ? 'anim-walk-bounce' : 'anim-idle-breath';
  const hurtAnim = hurtState ? 'anim-hurt' : '';

  const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const healthColor = healthPercent > 60 ? '#22c55e' : healthPercent > 30 ? '#f59e0b' : '#dc2626';

  return (
    <div
      style={{
        position: 'relative',
        width: 32 * scale,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        imageRendering: 'pixelated',
        transform: `scaleX(${scaleX})`,
        transition: 'transform 0.1s',
        ...customStyles.container
      }}
    >
      {/* ── Username (não espelha junto) ── */}
      {username && (
        <div
          style={{
            position: 'absolute',
            top: -18,
            left: '50%',
            transform: `translateX(-50%) scaleX(${scaleX})`,
            whiteSpace: 'nowrap',
            fontSize: 8,
            fontFamily: "'Press Start 2P', monospace",
            color: isLocal ? '#39ff14' : '#fff',
            textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
            pointerEvents: 'none',
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
            top: -10,
            left: '50%',
            transform: `translateX(-50%) scaleX(${scaleX})`,
            width: 32,
            height: 4,
            background: '#1a1a1a',
            border: '1px solid #333',
            ...customStyles.healthBar
          }}
        >
          <div style={{ width: `${healthPercent}%`, height: '100%', background: healthColor, transition: 'width 0.3s' }} />
        </div>
      )}

      {/* ── Sprite do personagem ── */}
      <div
        className={`${baseAnim} ${hurtAnim}`}
        style={{
          position: 'relative',
          width: 32 * scale,
          height: 44 * scale,
          imageRendering: 'pixelated',
          ...customStyles.sprite
        }}
      >
        {/* ══ CABEÇA ══ */}
        <Head skinColor={skinColor} hairColor={hairColor} scale={scale} isLocal={isLocal} customStyles={customStyles} />

        {/* ══ CORPO ══ */}
        <Body skinColor={skinColor} shirtColor={shirtColor} pantsColor={pantsColor} scale={scale} isMoving={isMoving} isAttacking={isAttacking} customStyles={customStyles} />

        {/* ══ SOMBRA NO CHÃO ══ */}
        <div style={{
          position: 'absolute',
          bottom: -3 * scale,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 20 * scale,
          height: 4 * scale,
          background: 'rgba(0,0,0,0.4)',
          borderRadius: '50%',
          filter: 'blur(2px)',
          ...customStyles.shadow
        }} />
      </div>
    </div>
  );
}

// ── Cabeça detalhada ──
function Head({ skinColor, hairColor, scale, isLocal, customStyles }: any) {
  const s = scale;
  return (
    <div style={{ position: 'absolute', top: 0, left: 4 * s, width: 24 * s, height: 18 * s, imageRendering: 'pixelated', ...customStyles.head }}>
      {/* Base da cabeça */}
      <div style={{
        position: 'absolute', inset: 0,
        background: skinColor,
        border: `${2 * s}px solid #2a1a0d`,
        boxShadow: isLocal ? `0 0 8px rgba(57,255,20,0.6)` : undefined,
        ...customStyles.headBase
      }} />
      {/* Cabelo */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 7 * s,
        background: hairColor,
        borderTop: `${2 * s}px solid #1a0d00`,
        ...customStyles.hair
      }} />
      {/* Lateral do cabelo esquerda */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3 * s, height: 11 * s, background: hairColor, ...customStyles.hairSideL }} />
      {/* Lateral do cabelo direita */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 3 * s, height: 11 * s, background: hairColor, ...customStyles.hairSideR }} />

      {/* Olho esquerdo */}
      <div style={{ position: 'absolute', top: 8 * s, left: 4 * s, width: 5 * s, height: 4 * s, background: '#1a1a1a', border: `${s}px solid #000`, ...customStyles.eyeL }}>
        {/* Íris */}
        <div style={{ position: 'absolute', top: s, left: s, width: 2 * s, height: 2 * s, background: '#3b6ea5' }} />
        {/* Reflexo */}
        <div style={{ position: 'absolute', top: s, right: s, width: s, height: s, background: '#fff' }} />
      </div>
      {/* Olho direito */}
      <div style={{ position: 'absolute', top: 8 * s, right: 4 * s, width: 5 * s, height: 4 * s, background: '#1a1a1a', border: `${s}px solid #000`, ...customStyles.eyeR }}>
        <div style={{ position: 'absolute', top: s, left: s, width: 2 * s, height: 2 * s, background: '#3b6ea5' }} />
        <div style={{ position: 'absolute', top: s, right: s, width: s, height: s, background: '#fff' }} />
      </div>
      {/* Nariz */}
      <div style={{ position: 'absolute', top: 10 * s, left: '50%', transform: 'translateX(-50%)', width: 3 * s, height: 2 * s, background: 'rgba(0,0,0,0.2)', ...customStyles.nose }} />
      {/* Boca */}
      <div style={{ position: 'absolute', bottom: 3 * s, left: 6 * s, width: 10 * s, height: 2 * s, background: '#8B4513', ...customStyles.mouth }}>
        {/* Dente */}
        <div style={{ position: 'absolute', top: 0, left: 3 * s, width: 2 * s, height: 2 * s, background: '#fff' }} />
        <div style={{ position: 'absolute', top: 0, right: 3 * s, width: 2 * s, height: 2 * s, background: '#fff' }} />
      </div>
      {/* Orelha */}
      <div style={{ position: 'absolute', top: 7 * s, left: -3 * s, width: 4 * s, height: 6 * s, background: skinColor, border: `${s}px solid #2a1a0d`, ...customStyles.earL }} />
      <div style={{ position: 'absolute', top: 7 * s, right: -3 * s, width: 4 * s, height: 6 * s, background: skinColor, border: `${s}px solid #2a1a0d`, ...customStyles.earR }} />
    </div>
  );
}

// ── Corpo detalhado ──
function Body({ skinColor, shirtColor, pantsColor, scale, isMoving, isAttacking, customStyles }: any) {
  const s = scale;
  // Classes de Animação CSS 
  const legLeftClass = isMoving ? 'anim-leg-left' : '';
  const legRightClass = isMoving ? 'anim-leg-right' : '';
  const armLeftClass = isMoving ? 'anim-arm-left' : '';
  const recoilClass = isAttacking ? 'anim-recoil' : '';

  return (
    <>
      {/* ── Torso / Camisa ── */}
      <div style={{
        position: 'absolute', top: 18 * s, left: 4 * s, width: 24 * s, height: 16 * s,
        background: shirtColor, border: `${2 * s}px solid rgba(0,0,0,0.6)`,
        ...customStyles.torso
      }}>
        {/* Detalhe bolso */}
        <div style={{ position: 'absolute', top: 3 * s, left: 2 * s, width: 7 * s, height: 6 * s, background: 'rgba(255,255,255,0.06)', border: `${s}px solid rgba(255,255,255,0.12)` }} />
        {/* Botões */}
        <div style={{ position: 'absolute', top: 4 * s, right: 5 * s, width: 2 * s, height: 2 * s, background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: 8 * s, right: 5 * s, width: 2 * s, height: 2 * s, background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }} />
        {/* Sombra inferior */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 * s, background: 'rgba(0,0,0,0.2)' }} />
      </div>

      <div 
        className={armLeftClass}
        style={{
        position: 'absolute', top: 20 * s, left: 0, width: 6 * s, height: 18 * s,
        background: skinColor, border: `${s}px solid #2a1a0d`,
        transformOrigin: 'top center',
        transition: 'transform 0.15s',
        ...customStyles.armL
      }}>
        {/* Mão */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5 * s, background: skinColor, borderRadius: '0 0 2px 2px' }} />
      </div>

      <div 
        className={recoilClass}
        style={{
        position: 'absolute', top: 20 * s, right: 0, width: 6 * s, height: 18 * s,
        background: skinColor, border: `${s}px solid #2a1a0d`,
        transformOrigin: 'top center',
        transform: 'rotate(0deg)',
        transition: 'transform 0.1s',
        ...customStyles.armR
      }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5 * s, background: skinColor, borderRadius: '0 0 2px 2px' }} />
        {/* Pistola */}
        <div style={{
          position: 'absolute', bottom: 3 * s, right: -14 * s,
          width: 16 * s, height: 7 * s,
          ...customStyles.weapon
        }}>
          {/* Cabo */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: 7 * s, height: 7 * s, background: '#1a1a1a', border: `${s}px solid #444` }} />
          {/* Cano */}
          <div style={{ position: 'absolute', top: 0, left: 2 * s, width: 14 * s, height: 5 * s, background: '#222', border: `${s}px solid #555` }}>
            {/* Mira */}
            <div style={{ position: 'absolute', top: 0, left: 3 * s, width: 2 * s, height: 2 * s, background: '#555' }} />
          </div>
          {/* Flash de tiro */}
          {isAttacking && (
            <div style={{
              position: 'absolute', top: '50%', right: -6 * s, transform: 'translateY(-50%)',
              width: 8 * s, height: 8 * s,
              background: 'radial-gradient(circle, #fff 20%, #ffd700 50%, transparent 100%)',
              animation: 'muzzle-flash 0.1s ease-out',
            }} />
          )}
        </div>
      </div>


      {/* ── Cinturão ── */}
      <div style={{
        position: 'absolute', top: 33 * s, left: 4 * s, width: 24 * s, height: 3 * s,
        background: '#1a0d00', border: `${s}px solid #333`,
      }}>
        {/* Fivela */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 5 * s, height: 3 * s, background: '#555' }} />
      </div>

      <div 
        className={legLeftClass}
        style={{
        position: 'absolute', top: 36 * s, left: 4 * s, width: 11 * s, height: 16 * s,
        background: pantsColor, border: `${s}px solid #1a1a2a`,
        transformOrigin: 'top center',
        transition: 'transform 0.15s',
        ...customStyles.legL
      }}>
        {/* Costura */}
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: s, background: 'rgba(255,255,255,0.08)' }} />
        {/* Bota */}
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 5 * s, background: '#1a0d00', border: `${s}px solid #333`, ...customStyles.bootL }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 * s, background: 'rgba(255,255,255,0.06)' }} />
        </div>
      </div>

      <div 
        className={legRightClass}
        style={{
        position: 'absolute', top: 36 * s, right: 5 * s, width: 11 * s, height: 16 * s,
        background: pantsColor, border: `${s}px solid #1a1a2a`,
        transformOrigin: 'top center',
        transition: 'transform 0.15s',
        ...customStyles.legR
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: s, background: 'rgba(255,255,255,0.08)' }} />
        {/* Bota */}
        <div style={{ position: 'absolute', bottom: 0, left: -s, right: -s, height: 5 * s, background: '#1a0d00', border: `${s}px solid #333`, ...customStyles.bootR }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 * s, background: 'rgba(255,255,255,0.06)' }} />
        </div>
      </div>
    </>
  );
}
