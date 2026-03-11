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
      
      {/* ─── Layout Principal: Split Screen ─── */}
      <div className="relative z-10 min-h-screen flex flex-col md:flex-row overflow-hidden">
        
        {/* LADO ESQUERDO: Mapa Global Vivo */}
        <div className="relative flex-1 bg-black border-r border-[#8b000033] hidden md:block">
           <div className="absolute inset-0 opacity-80">
              <WorldMap isBackground={true} />
           </div>
           
           {/* Overlay do Mapa */}
           <div className="absolute top-6 left-6 retro-panel p-3" style={{ background: 'rgba(0,0,0,0.8)' }}>
             <div className="pixel-font text-red-600 mb-1" style={{ fontSize: 9 }}>STATUS GLOBAL</div>
             <div style={{ fontSize: 7, color: '#aaa' }}>Monitorando atividade de sobreviventes...</div>
           </div>

           {/* Pulse de atividade no fundo */}
           <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at center, transparent 0%, rgba(139,0,0,0.05) 100%)' }} />
        </div>

        {/* LADO DIREITO: Terminal de Acesso */}
        <div className="w-full md:w-[460px] flex flex-col items-center justify-center p-6 md:p-12 relative overflow-y-auto bg-black">
          {/* CRT Noise Overlay for right side */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
               style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")', filter: 'contrast(150%) brightness(150%)' }} />

          {/* Logo / Título */}
          <div className="text-center mb-12">
            <div className="pixel-font text-red-600 block select-none"
              style={{
                fontSize: '48px',
                lineHeight: 1,
                textShadow: '4px 4px 0 #5a0000, 0 0 40px rgba(200,0,0,0.6)',
                letterSpacing: '0.06em',
                marginBottom: 4,
              }}
            >DEAD</div>
            <div className="pixel-font block select-none"
              style={{
                fontSize: '36px',
                lineHeight: 1,
                color: '#e5e5e5',
                textShadow: '3px 3px 0 #333',
                letterSpacing: '0.12em',
              }}
            >WORLD</div>
            <div className="mt-4 text-[10px] tracking-widest uppercase text-[#444]">
              v{VERSION} — Online Survivors
            </div>
          </div>

          {/* Stats Rápidos (Online agora) */}
          <div className="flex gap-4 mb-8 w-full">
            <div className="flex-1 retro-panel p-3 text-center border-[#39ff1433]">
              <div className="text-[#39ff14] pixel-font mb-1" style={{ fontSize: 16 }}>{globalStats.players}</div>
              <div style={{ fontSize: 7, color: '#444' }}>ONLINE AGORA</div>
            </div>
            <div className="flex-1 retro-panel p-3 text-center">
              <div className="text-red-600 pixel-font mb-1" style={{ fontSize: 16 }}>{globalStats.zombies.toLocaleString()}</div>
              <div style={{ fontSize: 7, color: '#444' }}>ZUMBIS ABATIDOS</div>
            </div>
          </div>

          {/* Terminal de Login */}
          <div className="retro-panel p-8 w-full mb-8" style={{ position: 'relative' }}>
            <div className="pixel-font text-center mb-6 text-red-500" style={{ fontSize: 9 }}>
              {'>'} LOGIN_TERMINAL {blink ? '_' : ' '}
            </div>

            <div className="space-y-3 mb-8 text-[10px]" style={{ color: '#aaa' }}>
              <div className="flex items-center gap-3"><span className="text-[#39ff14]">✔</span> Protocolo de Mapa Ativo</div>
              <div className="flex items-center gap-3"><span className="text-[#39ff14]">✔</span> Sincronização de Sobreviventes</div>
              <div className="flex items-center gap-3"><span className="text-[#39ff14]">✔</span> Inventário Persistente</div>
            </div>

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
                boxShadow: signing ? 'none' : '0 0 20px rgba(204,0,0,0.3)',
              }}
            >
              {signing ? 'CONECTANDO...' : 'ENTRAR COM GOOGLE'}
            </button>
          </div>

          {/* Footer */}
          <div className="text-center space-y-2">
            <div style={{ fontSize: 8, color: '#333' }}>© {new Date().getFullYear()} DEAD WORLD PROJECT</div>
            <div style={{ fontSize: 7, color: '#222' }}>DADO REALIZADO ATRAVÉS DE SATELLITE (OSM)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
