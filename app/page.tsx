'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, signInWithGoogle } from '@/lib/supabase';
import { VERSION } from '@/lib/version';
import dynamic from 'next/dynamic';
const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false });

/* ──────────────────────────────────────────────────
   CSS Personagem (retro pixel art) em código inline
   para a landing page
   ────────────────────────────────────────────────── */
function RetroCharacter({ colors }: { colors?: { skin?: string; shirt?: string; hair?: string } }) {
  const skin = colors?.skin || '#FFDBAC';
  const shirt = colors?.shirt || '#1a1a2e';
  const hair = colors?.hair || '#3D2B1F';

  return (
    <div style={{ width: 40, height: 56, position: 'relative', imageRendering: 'pixelated' }}>
      {/* Cabeça */}
      <div style={{ position: 'absolute', top: 0, left: 8, width: 24, height: 18, background: skin, border: '2px solid #2a1a0d' }}>
        {/* Cabelo */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: hair }} />
        {/* Olhos */}
        <div style={{ position: 'absolute', top: 7, left: 4, width: 4, height: 3, background: '#000' }} />
        <div style={{ position: 'absolute', top: 7, right: 4, width: 4, height: 3, background: '#000' }} />
        {/* Boca */}
        <div style={{ position: 'absolute', bottom: 3, left: 6, width: 10, height: 2, background: '#8B4513' }} />
      </div>
      {/* Corpo / Camisa */}
      <div style={{ position: 'absolute', top: 18, left: 4, width: 32, height: 20, background: shirt, border: '2px solid #000' }}>
        {/* Bolso */}
        <div style={{ position: 'absolute', top: 4, left: 2, width: 8, height: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }} />
      </div>
      {/* Braço esquerdo */}
      <div style={{ position: 'absolute', top: 20, left: 0, width: 6, height: 16, background: skin, border: '1px solid #2a1a0d' }} />
      {/* Braço direito / segurando arma */}
      <div style={{ position: 'absolute', top: 20, right: -4, width: 6, height: 16, background: skin, border: '1px solid #2a1a0d' }}>
        {/* Arma */}
        <div style={{ position: 'absolute', top: 6, right: -12, width: 14, height: 5, background: '#222', border: '1px solid #555' }} />
      </div>
      {/* Calça */}
      <div style={{ position: 'absolute', top: 38, left: 4, width: 14, height: 16, background: '#2d2d44', border: '2px solid #000' }} />
      <div style={{ position: 'absolute', top: 38, right: 4, width: 14, height: 16, background: '#2d2d44', border: '2px solid #000' }} />
      {/* Botas */}
      <div style={{ position: 'absolute', bottom: 0, left: 2, width: 16, height: 6, background: '#1a0d00', border: '1px solid #333' }} />
      <div style={{ position: 'absolute', bottom: 0, right: 2, width: 16, height: 6, background: '#1a0d00', border: '1px solid #333' }} />
    </div>
  );
}

/* Zumbi decorativo para a landing page */
function RetroZombie({ className = '' }: { className?: string }) {
  return (
    <div className={`${className}`} style={{ width: 36, height: 52, position: 'relative', imageRendering: 'pixelated' }}>
      {/* Cabeça podre */}
      <div style={{ position: 'absolute', top: 0, left: 6, width: 24, height: 18, background: '#4a7c59', border: '2px solid #2a4a35' }}>
        {/* Cicatrizes */}
        <div style={{ position: 'absolute', top: 3, left: 2, width: 8, height: 1, background: '#2a4a35' }} />
        {/* Olhos vermelhos */}
        <div style={{ position: 'absolute', top: 7, left: 3, width: 5, height: 4, background: '#cc0000', boxShadow: '0 0 4px #ff0000' }} />
        <div style={{ position: 'absolute', top: 7, right: 3, width: 5, height: 4, background: '#cc0000', boxShadow: '0 0 4px #ff0000' }} />
        {/* Boca rasgada */}
        <div style={{ position: 'absolute', bottom: 3, left: 4, width: 14, height: 3, background: '#1a0000', borderTop: '1px solid #660000' }} />
        <div style={{ position: 'absolute', bottom: 4, left: 6, width: 3, height: 5, background: '#cc0000' }} />
        <div style={{ position: 'absolute', bottom: 4, left: 11, width: 3, height: 4, background: '#cc0000' }} />
      </div>
      {/* Corpo rasgado */}
      <div style={{ position: 'absolute', top: 18, left: 2, width: 32, height: 20, background: '#3a5a45', border: '2px solid #2a4a35' }}>
        {/* Rasgos na roupa */}
        <div style={{ position: 'absolute', top: 2, left: 8, width: 2, height: 10, background: '#2a1a0d' }} />
        <div style={{ position: 'absolute', top: 5, right: 6, width: 3, height: 8, background: '#2a1a0d' }} />
        {/* Sangue */}
        <div style={{ position: 'absolute', top: 4, left: 12, width: 8, height: 6, background: 'rgba(139,0,0,0.6)' }} />
      </div>
      {/* Braços estendidos */}
      <div style={{ position: 'absolute', top: 18, left: -4, width: 8, height: 16, background: '#4a7c59', border: '1px solid #2a4a35', transform: 'rotate(-15deg)' }} />
      <div style={{ position: 'absolute', top: 18, right: -4, width: 8, height: 16, background: '#4a7c59', border: '1px solid #2a4a35', transform: 'rotate(15deg)' }} />
      {/* Pernas */}
      <div style={{ position: 'absolute', top: 38, left: 3, width: 12, height: 14, background: '#2a3a30', border: '1px solid #1a2a20' }} />
      <div style={{ position: 'absolute', top: 40, right: 3, width: 12, height: 12, background: '#2a3a30', border: '1px solid #1a2a20' }} />
    </div>
  );
}

/* Bloodsplat decorativo */
function BloodSplat({ style = {} }: { style?: React.CSSProperties }) {
  return (
    <div style={{
      position: 'absolute',
      background: 'radial-gradient(ellipse, #8b0000 30%, #5a0000 60%, transparent 100%)',
      borderRadius: '60% 40% 70% 30% / 50% 60% 40% 70%',
      opacity: 0.4,
      ...style,
    }} />
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [scanY, setScanY] = useState(0);
  const [blink, setBlink] = useState(true);
  const [globalStats, setGlobalStats] = useState({ zombies: 0, tiles: 0, players: 0 });

  // Animação scanline
  useEffect(() => {
    const interval = setInterval(() => {
      setScanY((y) => (y + 2) % 110);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  // Blink cursor
  useEffect(() => {
    const interval = setInterval(() => setBlink((b) => !b), 500);
    return () => clearInterval(interval);
  }, []);

  // Verificar se já está logado
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/game');
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  // Carrega stats globais reais
  useEffect(() => {
    Promise.all([
      supabase.from('kill_log').select('id', { count: 'exact', head: true }),
      supabase.from('map_tiles').select('id', { count: 'exact', head: true }),
      supabase.from('players').select('id', { count: 'exact', head: true }).eq('is_online', true),
    ]).then(([kills, tiles, players]) => {
      setGlobalStats({
        zombies: kills.count || 0,
        tiles: tiles.count || 0,
        players: players.count || 0,
      });
    });
  }, []);

  const handleLogin = async () => {
    setSigning(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="pixel-font text-red-600 text-xs animate-pulse">CARREGANDO...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black overflow-hidden" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
      {/* ─── Background: grade apocalíptica ─── */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(139,0,0,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(139,0,0,0.05) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />

      {/* ─── Scanline animado ─── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 2 }}>
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '3px',
          top: `${scanY}%`,
          background: 'linear-gradient(transparent, rgba(139,0,0,0.15), transparent)',
          transition: 'top 0.03s linear',
        }} />
        {/* CRT scanlines */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.04) 1px, rgba(0,0,0,0.04) 2px)',
        }} />
      </div>

      {/* ─── Blood splats decorativos ─── */}
      <BloodSplat style={{ width: 200, height: 120, top: '5%', left: '2%' }} />
      <BloodSplat style={{ width: 150, height: 90, bottom: '15%', right: '3%' }} />
      <BloodSplat style={{ width: 80, height: 50, top: '30%', right: '8%' }} />

      {/* ─── Vinheta ─── */}
      <div className="vignette" />

      {/* ─── Personagens decorativos ─── */}
      {/* Zumbi esquerda */}
      <div
        className="absolute animate-zombie-walk"
        style={{ bottom: '12%', left: '8%', opacity: 0.7, transform: 'scale(2)', transformOrigin: 'bottom center' }}
      >
        <RetroZombie />
      </div>
      {/* Zumbi direita */}
      <div
        className="absolute animate-zombie-walk"
        style={{ bottom: '18%', right: '10%', opacity: 0.6, transform: 'scale(2.5) scaleX(-1)', transformOrigin: 'bottom center', animationDelay: '0.25s' }}
      >
        <RetroZombie />
      </div>
      {/* Personagem herói */}
      <div
        className="absolute animate-float"
        style={{ bottom: '14%', left: '50%', transform: 'translateX(-50%) scale(3)', transformOrigin: 'bottom center', opacity: 0.9 }}
      >
        <RetroCharacter />
      </div>

      {/* ─── Conteúdo principal ─── */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Logo / Título */}
        <div className="text-center mb-12">
          {/* DEAD */}
          <div
            className="pixel-font text-red-600 block select-none"
            style={{
              fontSize: 'clamp(36px, 8vw, 80px)',
              lineHeight: 1,
              textShadow: '4px 4px 0 #5a0000, 0 0 40px rgba(200,0,0,0.6), 0 0 80px rgba(200,0,0,0.3)',
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            DEAD
          </div>
          {/* WORLD */}
          <div
            className="pixel-font block select-none"
            style={{
              fontSize: 'clamp(28px, 6vw, 60px)',
              lineHeight: 1,
              color: '#e5e5e5',
              textShadow: '3px 3px 0 #333, 0 0 20px rgba(255,255,255,0.1)',
              letterSpacing: '0.12em',
            }}
          >
            WORLD
          </div>

          {/* Subtítulo */}
          <div
            className="mt-6 text-xs tracking-widest uppercase"
            style={{ color: '#666', fontFamily: "'Share Tech Mono', monospace" }}
          >
            — Sobreviva. Explore. Domine. —
          </div>
        </div>

        {/* ─── Painel de Login ─── */}
        <div
          className="retro-panel p-8 w-full"
          style={{ maxWidth: 420, position: 'relative' }}
        >
          {/* Header do painel */}
          <div className="pixel-font text-center mb-6 text-red-500" style={{ fontSize: 10 }}>
            {'>'} TERMINAL DE ACESSO {blink ? '_' : ' '}
          </div>

          {/* Features */}
          <div className="space-y-2 mb-6 text-xs" style={{ color: '#666' }}>
            {[
              ['🌍', 'Mapa gerado da sua cidade real'],
              ['🧟', 'Zumbis online com outros jogadores'],
              ['🔫', 'Armas customizáveis e upgrades'],
              ['🏆', 'Ranking global em tempo real'],
              ['🎮', 'Sessão compartilhada — 1 mundo'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 py-1">
                <span style={{ fontSize: 14 }}>{icon}</span>
                <span style={{ color: '#aaa' }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Separador */}
          <div className="mb-6" style={{ height: 1, background: 'linear-gradient(90deg, transparent, #8b0000, transparent)' }} />

          {/* Botão Google */}
          <button
            onClick={handleLogin}
            disabled={signing}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 text-sm font-medium transition-all duration-200 relative overflow-hidden group"
            style={{
              background: signing ? '#1a1a1a' : '#0d0d0d',
              border: '2px solid',
              borderColor: signing ? '#333' : '#cc0000',
              color: signing ? '#666' : '#fff',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 9,
              letterSpacing: '0.05em',
              cursor: signing ? 'not-allowed' : 'pointer',
              boxShadow: signing ? 'none' : '0 0 20px rgba(204,0,0,0.3), inset 0 0 20px rgba(204,0,0,0.05)',
            }}
          >
            {/* Hover effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'linear-gradient(135deg, transparent 40%, rgba(139,0,0,0.15) 100%)' }}
            />

            {signing ? (
              <>
                <div
                  className="animate-spin"
                  style={{ width: 16, height: 16, border: '2px solid #333', borderTopColor: '#cc0000', borderRadius: '50%' }}
                />
                <span>CONECTANDO...</span>
              </>
            ) : (
              <>
                {/* Google Icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>ENTRAR COM GOOGLE</span>
              </>
            )}
          </button>

          {/* Footer info */}
          <div className="mt-4 text-center text-xs" style={{ color: '#444', fontFamily: "'Share Tech Mono', monospace" }}>
            Ao entrar, você concorda em sobreviver.
            <br />
            <span style={{ color: '#333' }}>v{VERSION} — Alpha</span>
          </div>
        </div>

        {/* Mapa global — onde o mundo está sendo conquistado */}
        <div className="mt-8 w-full retro-panel p-4" style={{ maxWidth: 560 }}>
          <WorldMap />
        </div>

        {/* Stats globais reais */}
        <div className="mt-6 flex gap-8 text-center flex-wrap justify-center">
          {[
            { label: 'Zumbis Mortos', value: globalStats.zombies > 0 ? globalStats.zombies.toLocaleString() : '---' },
            { label: 'Tiles Explorados', value: globalStats.tiles > 0 ? globalStats.tiles.toLocaleString() : '---' },
            { label: 'Online Agora', value: globalStats.players > 0 ? globalStats.players.toString() : '0' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="pixel-font text-red-500" style={{ fontSize: 14 }}>{value}</div>
              <div style={{ fontSize: 9, color: '#444', marginTop: 4, fontFamily: "'Share Tech Mono', monospace" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
