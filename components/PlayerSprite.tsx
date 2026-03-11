import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/lib/store';

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

  // Calcular flip baseado em direção (espelha o sprite)
  const facingLeft = direction > 90 && direction < 270;
  const scaleX = facingLeft ? -1 : 1;

  const baseAnim = isMoving ? 'anim-walk-bounce' : 'anim-idle-breath';
  const hurtAnim = hurtState ? 'anim-hurt' : '';
  
  // Inclinação rítmica ao mover
  const tilt = isMoving ? (facingLeft ? -8 : 8) : 0;

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
        transform: `rotate(${tilt}deg) scaleX(${scaleX})`,
        transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        ...customStyles.container
      }}
    >
      {/* ── Username (não espelha junto) ── */}
      {username && (
        <div
          style={{
            position: 'absolute',
            top: -22,
            left: '50%',
            transform: `translateX(-50%) scaleX(${scaleX})`,
            whiteSpace: 'nowrap',
            fontSize: 7,
            fontFamily: "'Press Start 2P', monospace",
            color: isLocal ? '#39ff14' : '#fff',
            textShadow: '1px 1px 0 #000, -1px -1px 0 #000',
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
            top: -12,
            left: '50%',
            transform: `translateX(-50%) scaleX(${scaleX})`,
            width: 32,
            height: 3,
            background: '#000',
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
          transformOrigin: 'bottom center',
          ...customStyles.sprite
        }}
      >
        {/* ══ CABEÇA (bobbing independente) ══ */}
        <div className={isMoving ? 'anim-head-bob' : ''} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 12 }}>
          <Head skinColor={skinColor} hairColor={hairColor} scale={scale} isLocal={isLocal} customStyles={customStyles} isNight={isNight} />
        </div>

        {/* ══ MOCHILA ══ */}
        <Backpack scale={scale} color="#3d2b1f" customStyles={customStyles} />

        {/* ══ CORPO ══ */}
        <Body skinColor={skinColor} shirtColor={shirtColor} pantsColor={pantsColor} scale={scale} isMoving={isMoving} isAttacking={isAttacking} customStyles={customStyles} isNight={isNight} />

        {/* ══ SOMBRA DINÂMICA ══ */}
        <div style={{
          position: 'absolute',
          bottom: -3 * scale,
          left: '50%',
          transformOrigin: 'center',
          transform: `translateX(-50%) scale(${isMoving ? 1.2 : 1})`,
          width: 22 * scale,
          height: 5 * scale,
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '50%',
          filter: 'blur(1px)',
          transition: 'transform 0.3s ease',
          ...customStyles.shadow
        }} />
      </div>
    </div>
  );
}

// ── Cabeça detalhada ──
function Head({ skinColor, hairColor, scale, isLocal, customStyles, isNight }: any) {
  const s = scale;
  return (
    <div style={{ position: 'absolute', top: 0, left: 4 * s, width: 24 * s, height: 18 * s, imageRendering: 'pixelated', ...customStyles.head }}>
      {/* Base da cabeça com gradiente de pele */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, ${skinColor} 0%, rgba(0,0,0,0.1) 100%), ${skinColor}`,
        border: `${2 * s}px solid #2a1a0d`,
        boxShadow: isLocal ? `0 0 12px rgba(57,255,20,0.4)` : 'inset -2px -2px 0 rgba(0,0,0,0.1)',
        overflow: 'hidden',
        ...customStyles.headBase
      }}>
        {/* Rim Light (Sun) */}
        {isNight && <div style={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '30%', background: 'rgba(255,200,80,0.5)', filter: 'blur(1px)' }} />}
      </div>
      {/* Cabelo com mechas */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 8 * s,
        background: hairColor,
        borderBottom: `${s}px solid rgba(0,0,0,0.3)`,
        ...customStyles.hair
      }}>
        <div style={{ position: 'absolute', top: s, left: 4*s, width: 4*s, height: s, background: 'rgba(255,255,255,0.1)' }} />
      </div>
      
      {/* Lateral do cabelo esquerda */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4 * s, height: 12 * s, background: hairColor, ...customStyles.hairSideL }} />
      {/* Lateral do cabelo direita */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 4 * s, height: 12 * s, background: hairColor, ...customStyles.hairSideR }} />

      {/* Olho esquerdo expressivo */}
      <div style={{ 
        position: 'absolute', top: 8 * s, left: 4 * s, width: 6 * s, height: 5 * s, 
        background: '#fff', border: `${s}px solid #000`, 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...customStyles.eyeL 
      }}>
        {/* Pupila */}
        <div style={{ width: 3 * s, height: 3 * s, background: '#1a1a1a', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: s, height: s, background: '#fff', opacity: 0.8 }} />
        </div>
      </div>
      {/* Olho direito */}
      <div style={{ 
        position: 'absolute', top: 8 * s, right: 4 * s, width: 6 * s, height: 5 * s, 
        background: '#fff', border: `${s}px solid #000`, 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...customStyles.eyeR 
      }}>
        <div style={{ width: 3 * s, height: 3 * s, background: '#1a1a1a', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: s, height: s, background: '#fff', opacity: 0.8 }} />
        </div>
      </div>

      {/* Sombrancelhas */}
      <div style={{ position: 'absolute', top: 6 * s, left: 4 * s, width: 6 * s, height: s, background: hairColor, opacity: 0.8 }} />
      <div style={{ position: 'absolute', top: 6 * s, right: 4 * s, width: 6 * s, height: s, background: hairColor, opacity: 0.8 }} />

      {/* Nariz */}
      <div style={{ position: 'absolute', top: 11 * s, left: '50%', transform: 'translateX(-50%)', width: 4 * s, height: 2 * s, background: 'rgba(0,0,0,0.25)', borderRadius: s, ...customStyles.nose }} />
      
      {/* Boca */}
      <div style={{ position: 'absolute', bottom: 3 * s, left: 7 * s, width: 10 * s, height: 2 * s, background: '#8B4513', ...customStyles.mouth }}>
        <div style={{ position: 'absolute', top: 0, left: 3 * s, width: 2 * s, height: s, background: '#fff', opacity: 0.9 }} />
        <div style={{ position: 'absolute', top: 0, right: 3 * s, width: 2 * s, height: s, background: '#fff', opacity: 0.9 }} />
      </div>
    </div>
  );
}

// ── Mochila ──
function Backpack({ scale, color, customStyles }: any) {
  const s = scale;
  return (
    <div style={{
      position: 'absolute', top: 20 * s, left: -2 * s, width: 12 * s, height: 18 * s,
      background: color, border: `${2 * s}px solid rgba(0,0,0,0.6)`,
      borderRadius: '4px 2px 2px 4px',
      zIndex: 5,
      ...customStyles.backpack
    }}>
      {/* Detalhe alça */}
      <div style={{ position: 'absolute', top: 4*s, left: 2*s, width: 6*s, height: 2*s, background: 'rgba(255,255,255,0.1)' }} />
      {/* Zíper */}
      <div style={{ position: 'absolute', top: 0, right: 2*s, bottom: 0, width: s, background: 'rgba(0,0,0,0.3)' }} />
    </div>
  );
}


// ── Corpo detalhado ──
function Body({ skinColor, shirtColor, pantsColor, scale, isMoving, isAttacking, customStyles, isNight }: any) {
  const s = scale;
  // Classes de Animação CSS 
  const legLeftClass = isMoving ? 'anim-leg-left' : '';
  const legRightClass = isMoving ? 'anim-leg-right' : '';
  const armLeftClass = isMoving ? 'anim-arm-left' : '';
  const recoilClass = isAttacking ? 'anim-recoil' : '';

  return (
    <>
      {/* ── Torso / Camisa / Colete ── */}
      <div style={{
        position: 'absolute', top: 18 * s, left: 4 * s, width: 24 * s, height: 16 * s,
        background: shirtColor, border: `${2 * s}px solid rgba(0,0,0,0.7)`,
        boxShadow: 'inset -3px -3px 0 rgba(0,0,0,0.2)',
        overflow: 'hidden',
        ...customStyles.torso
      }}>
        {/* Colete Tático Detalhe */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(0,0,0,0.25) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.25) 100%)',
          pointerEvents: 'none'
        }} />
        {/* Rim Light (Sun) */}
        {isNight && <div style={{ position: 'absolute', top: 0, left: 0, width: '30%', height: '50%', background: 'rgba(255,200,80,0.4)', filter: 'blur(1.5px)' }} />}
        
        {/* Detalhe bolso superior */}
        <div style={{ position: 'absolute', top: 3 * s, left: 3 * s, width: 8 * s, height: 7 * s, background: 'rgba(0,0,0,0.15)', border: `${s}px solid rgba(255,255,255,0.05)`, borderRadius: 1 }} />
        
        {/* Botões/Cinto Peitoral */}
        <div style={{ position: 'absolute', top: 4 * s, right: 6 * s, width: 3 * s, height: 2 * s, background: '#333' }} />
        <div style={{ position: 'absolute', top: 9 * s, right: 6 * s, width: 3 * s, height: 2 * s, background: '#333' }} />
        
        {/* Sombra inferior suave */}
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
        transition: 'transform 0.05s',
        zIndex: 5,
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
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: 7 * s, height: 7 * s, background: '#111', border: `${s}px solid #333` }} />
          {/* Cano */}
          <div style={{ position: 'absolute', top: 0, left: 2 * s, width: 14 * s, height: 5 * s, background: '#1a1a1a', border: `${s}px solid #444` }}>
            {/* Mira */}
            <div style={{ position: 'absolute', top: 0, left: 3 * s, width: 2 * s, height: 2 * s, background: '#444' }} />
          </div>
          {/* Flash de tiro */}
          {isAttacking && (
            <div 
              className="anim-muzzle"
              style={{
                position: 'absolute', top: '50%', right: -6 * s,
                width: 12 * s, height: 12 * s,
                background: 'radial-gradient(circle, #fff 10%, #ffdf00 40%, rgba(255,100,0,0.4) 70%, transparent 100%)',
                zIndex: 20
              }} 
            />
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
