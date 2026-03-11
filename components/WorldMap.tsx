'use client';
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/lib/store';
import { latLngToOsmTile, OSM_ZOOM } from '@/lib/osmTiles';

export default function WorldMap({ isBackground = false }: { isBackground?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState({ tiles: 0, players: 0 });
  const [loading, setLoading] = useState(true);
  const { player } = useGameStore();

  useEffect(() => {
    loadAndDraw();
    const interval = setInterval(loadAndDraw, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, [player?.id]);

  const loadAndDraw = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reseta canvas se background
    if (isBackground) {
       canvas.width = window.innerWidth;
       canvas.height = window.innerHeight;
    }

    const W = canvas.width;
    const H = canvas.height;

    // Fundo escuro profundo
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    // ── Carrega tiles explorados do Supabase ──
    const [{ data: tiles }, { data: players }] = await Promise.all([
      supabase.from('map_tiles').select('tile_x, tile_y').limit(4000),
      supabase.from('players').select('last_lat, last_lng, username, is_online').eq('is_online', true).limit(100),
    ]);

    setLoading(false);

    // ── Função para carregar imagem com Promise ──
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null as any);
      });
    };

    // ── Desenha continentes (OSM zoom 2 = 4x4 tiles) ──
    const bgZoom = 2;
    const n = Math.pow(2, bgZoom); // 4
    const tileW = W / n;
    const tileH = H / n;

    // Carrega todos os tiles de fundo em paralelo
    const bgPromises: Promise<any>[] = [];
    for (let tx = 0; tx < n; tx++) {
      for (let ty = 0; ty < n; ty++) {
        bgPromises.push((async () => {
          const img = await loadImage(`https://a.tile.openstreetmap.org/${bgZoom}/${tx}/${ty}.png`);
          if (img) {
            ctx.save();
            ctx.globalAlpha = isBackground ? 0.15 : 0.25;
            ctx.filter = 'brightness(0.3) saturate(0.2) contrast(1.2) invert(0.9) hue-rotate(180deg)'; // Efeito negativo azulado/tecnológico
            ctx.drawImage(img, tx * tileW, ty * tileH, tileW, tileH);
            ctx.restore();
          }
        })());
      }
    }
    await Promise.all(bgPromises);

    // ── Pontos explorados (Red Dots) ──
    if (tiles && tiles.length > 0) {
      setStats(prev => ({ ...prev, tiles: tiles.length }));
      const worldScale = Math.pow(2, OSM_ZOOM);

      tiles.forEach(({ tile_x, tile_y }) => {
        const px = (tile_x / worldScale) * W;
        const py = (tile_y / worldScale) * H;

        ctx.fillStyle = 'rgba(220, 38, 38, 0.6)';
        ctx.beginPath();
        ctx.arc(px, py, isBackground ? 2 : 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Pequenino glow
        if (!isBackground) {
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#dc2626';
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });
    }

    // ── Players ativos (Green Dots) ──
    if (players && players.length > 0) {
      setStats(prev => ({ ...prev, players: players.length }));
      players.forEach((p) => {
        if (!p.last_lat || !p.last_lng) return;
        const { tileX, tileY } = latLngToOsmTile(p.last_lat, p.last_lng, OSM_ZOOM);
        const worldScale = Math.pow(2, OSM_ZOOM);
        const px = (tileX / worldScale) * W;
        const py = (tileY / worldScale) * H;

        ctx.fillStyle = '#39ff14';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // ── MARCADOR: VOCÊ ESTÁ AQUI (Se logado) ──
    if (player && player.last_lat && player.last_lng) {
      const { tileX, tileY } = latLngToOsmTile(player.last_lat, player.last_lng, OSM_ZOOM);
      const worldScale = Math.pow(2, OSM_ZOOM);
      const px = (tileX / worldScale) * W;
      const py = (tileY / worldScale) * H;

      // Círculo pulsante branco/azul
      const time = Date.now() / 500;
      const pulse = 1 + Math.sin(time) * 0.3;
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 8 * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      // Label
      if (!isBackground) {
        ctx.font = 'bold 9px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('VOCÊ', px, py - 12);
      }
    }

    // ── Grade do mapa ──
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += W / 8) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += H / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Borda vermelha pulsante ──
    ctx.strokeStyle = 'rgba(139,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  };

  return (
    <div style={{ position: 'relative', width: isBackground ? '100%' : 'auto', height: isBackground ? '100%' : 'auto' }}>
      {!isBackground && (
        <div className="flex items-center justify-between mb-3">
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#8b0000' }}>
            🌍 MAPA GLOBAL
          </div>
          <div style={{ display: 'flex', gap: 16, fontFamily: "'Share Tech Mono', monospace", fontSize: 9 }}>
            <span style={{ color: '#dc2626' }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, background: '#8b0000', borderRadius: '50%', marginRight: 4 }} />
              {stats.tiles.toLocaleString()} tiles
            </span>
            <span style={{ color: '#39ff14' }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, background: '#39ff14', borderRadius: '50%', marginRight: 4 }} />
              {stats.players} online
            </span>
          </div>
        </div>
      )}

      {/* Canvas do mapa */}
      <div style={{ position: 'relative', border: isBackground ? 'none' : '1px solid #1a1a1a', width: '100%', height: isBackground ? '100%' : 'auto' }}>
        <canvas
          ref={canvasRef}
          width={isBackground ? undefined : 520}
          height={isBackground ? undefined : 260}
          style={{
            display: 'block',
            width: '100%',
            height: isBackground ? '100%' : 'auto',
            imageRendering: 'pixelated',
          }}
        />

        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(5,5,5,0.85)',
          }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#333' }}>
              carregando mapa...
            </div>
          </div>
        )}

        {/* Legenda */}
        {!isBackground && (
          <div style={{
            position: 'absolute', bottom: 6, left: 8,
            fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.2)',
          }}>
            © OpenStreetMap contributors
          </div>
        )}
      </div>

      {/* Subtítulo */}
      {!isBackground && (
        <div style={{
          marginTop: 6, textAlign: 'center',
          fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: '#333',
        }}>
          Cada ponto vermelho = área já explorada por sobreviventes
        </div>
      )}
    </div>
  );
}
