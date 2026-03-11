'use client';
import React, { useRef, useState, useEffect, useCallback } from 'react';

// ──────────────────────────────────────────────────────
//  CONTROLES TOUCH PARA MOBILE
//  Joystick virtual (movimento) + Botão de ataque
// ──────────────────────────────────────────────────────

interface TouchControlsProps {
  onMove: (dx: number, dy: number) => void;  // -1 a 1 normalizado
  onAttack: () => void;
  onStopMove: () => void;
}

interface JoystickState {
  active: boolean;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  touchId: number | null;
}

const JOYSTICK_RADIUS = 56;
const KNOB_RADIUS = 22;

export default function TouchControls({ onMove, onAttack, onStopMove }: TouchControlsProps) {
  const [joystick, setJoystick] = useState<JoystickState>({
    active: false, originX: 0, originY: 0, currentX: 0, currentY: 0, touchId: null,
  });
  const [attackPressed, setAttackPressed] = useState(false);

  const joystickRef = useRef<JoystickState>(joystick);
  joystickRef.current = joystick;

  // Apenas mostra em dispositivos touch
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    setJoystick({
      active: true,
      originX: touch.clientX,
      originY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      touchId: touch.identifier,
    });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const j = joystickRef.current;
    const touch = Array.from(e.changedTouches).find(t => t.identifier === j.touchId);
    if (!touch || !j.active) return;

    const dx = touch.clientX - j.originX;
    const dy = touch.clientY - j.originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);

    const clampedX = j.originX + Math.cos(angle) * clamped;
    const clampedY = j.originY + Math.sin(angle) * clamped;

    setJoystick(prev => ({ ...prev, currentX: clampedX, currentY: clampedY }));

    // Normaliza movimento
    const normX = (clampedX - j.originX) / JOYSTICK_RADIUS;
    const normY = (clampedY - j.originY) / JOYSTICK_RADIUS;
    onMove(normX, normY);
  }, [onMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    setJoystick(prev => ({ ...prev, active: false, currentX: prev.originX, currentY: prev.originY, touchId: null }));
    onStopMove();
  }, [onStopMove]);

  if (!isTouch) return null;

  const knobOffsetX = joystick.active ? joystick.currentX - joystick.originX : 0;
  const knobOffsetY = joystick.active ? joystick.currentY - joystick.originY : 0;

  return (
    <>
      {/* ── Área do joystick (metade esquerda da tela) ── */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '50%',
          height: '45%',
          zIndex: 200,
          touchAction: 'none',
        }}
      >
        {/* Joystick visual — só aparece quando ativo */}
        {joystick.active && (
          <div
            style={{
              position: 'absolute',
              left: joystick.originX - JOYSTICK_RADIUS,
              top: joystick.originY - JOYSTICK_RADIUS,
              width: JOYSTICK_RADIUS * 2,
              height: JOYSTICK_RADIUS * 2,
              background: 'rgba(139,0,0,0.15)',
              border: '2px solid rgba(139,0,0,0.4)',
              borderRadius: '50%',
            }}
          >
            {/* Knob central */}
            <div style={{
              position: 'absolute',
              left: JOYSTICK_RADIUS + knobOffsetX - KNOB_RADIUS,
              top: JOYSTICK_RADIUS + knobOffsetY - KNOB_RADIUS,
              width: KNOB_RADIUS * 2,
              height: KNOB_RADIUS * 2,
              background: 'rgba(220,0,0,0.5)',
              border: '2px solid rgba(255,50,50,0.8)',
              borderRadius: '50%',
              boxShadow: '0 0 12px rgba(220,0,0,0.5)',
            }} />
          </div>
        )}

        {/* Hint quando inativo */}
        {!joystick.active && (
          <div style={{
            position: 'absolute',
            bottom: 60,
            left: 60,
            width: JOYSTICK_RADIUS * 2,
            height: JOYSTICK_RADIUS * 2,
            background: 'rgba(30,30,30,0.5)',
            border: '2px dashed rgba(100,100,100,0.3)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: 24, opacity: 0.3 }}>🕹️</span>
          </div>
        )}
      </div>

      {/* ── Botões de ação (metade direita) ── */}
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'flex-end',
      }}>
        {/* Botão de ataque / tiro */}
        <button
          onTouchStart={(e) => { e.preventDefault(); setAttackPressed(true); onAttack(); }}
          onTouchEnd={(e) => { e.preventDefault(); setAttackPressed(false); }}
          style={{
            width: 70,
            height: 70,
            borderRadius: '50%',
            background: attackPressed ? 'rgba(200,0,0,0.8)' : 'rgba(139,0,0,0.5)',
            border: '3px solid rgba(255,50,50,0.8)',
            fontSize: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: attackPressed ? '0 0 20px rgba(255,0,0,0.8)' : '0 0 10px rgba(139,0,0,0.4)',
            touchAction: 'none',
            userSelect: 'none',
            transition: 'all 0.1s',
            transform: attackPressed ? 'scale(0.9)' : 'scale(1)',
            cursor: 'pointer',
          }}
        >
          🔫
        </button>

        {/* Botão de inventário */}
        <button
          onTouchStart={(e) => { e.preventDefault(); useGameStoreTouch().toggleInventory(); }}
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: 'rgba(30,30,30,0.7)',
            border: '2px solid rgba(100,100,100,0.5)',
            fontSize: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            userSelect: 'none',
            cursor: 'pointer',
          }}
        >
          🎒
        </button>
      </div>

      {/* ── Botões de menu (top, mobile) ── */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        zIndex: 200,
        display: 'flex',
        gap: 8,
        padding: '8px',
      }}>
        {[
          { icon: '🏆', action: () => useGameStoreTouch().toggleLeaderboard() },
          { icon: '🗺️', action: () => useGameStoreTouch().toggleMap() },
          { icon: '💬', action: () => useGameStoreTouch().toggleChat() },
        ].map(({ icon, action }, i) => (
          <button
            key={i}
            onTouchStart={(e) => { e.preventDefault(); action(); }}
            style={{
              width: 40,
              height: 40,
              background: 'rgba(10,10,10,0.8)',
              border: '1px solid rgba(139,0,0,0.5)',
              color: '#fff',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              touchAction: 'none',
            }}
          >
            {icon}
          </button>
        ))}
      </div>
    </>
  );
}

// Helper para acessar store sem hook (em event handlers touch)
function useGameStoreTouch() {
  const { useGameStore } = require('@/lib/store');
  return useGameStore.getState();
}
