'use client';
import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store';

export default function Notifications() {
  const { notifications, clearNotification } = useGameStore();

  useEffect(() => {
    if (notifications.length === 0) return;
    const latest = notifications[notifications.length - 1];
    const timer = setTimeout(() => {
      clearNotification(latest.id);
    }, 3500);
    return () => clearTimeout(timer);
  }, [notifications]);

  const typeStyles: Record<string, { border: string; icon: string; glow: string }> = {
    info: { border: '#3b82f6', icon: 'ℹ', glow: 'rgba(59,130,246,0.25)' },
    success: { border: '#22c55e', icon: '✓', glow: 'rgba(34,197,94,0.25)' },
    warning: { border: '#f59e0b', icon: '⚠', glow: 'rgba(245,158,11,0.25)' },
    danger: { border: '#dc2626', icon: '✕', glow: 'rgba(220,38,38,0.25)' },
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        right: 12,
        zIndex: 600,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 280,
        pointerEvents: 'none',
      }}
    >
      {notifications.map((notif) => {
        const style = typeStyles[notif.type] || typeStyles.info;
        return (
          <div
            key={notif.id}
            className="notification-enter"
            style={{
              background: 'rgba(8,8,8,0.95)',
              border: `1px solid ${style.border}`,
              borderLeft: `3px solid ${style.border}`,
              padding: '8px 12px',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              boxShadow: `0 0 12px ${style.glow}`,
              fontFamily: "'Share Tech Mono', monospace",
            }}
          >
            <span style={{ color: style.border, fontSize: 12, flexShrink: 0, marginTop: 1 }}>{style.icon}</span>
            <span style={{ color: '#ccc', fontSize: 10, lineHeight: 1.5 }}>{notif.message}</span>
          </div>
        );
      })}
    </div>
  );
}
