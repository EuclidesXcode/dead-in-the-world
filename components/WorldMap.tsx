'use client';
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { osmTileToWorldMapPx, OSM_ZOOM } from '@/lib/osmTiles';

interface ExploredPoint { tileX: number; tileY: number; }
interface ActivePlayer { lat: number; lng: number; username: string; }

export default function WorldMap({ isBackground = false }: { isBackground?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState({ tiles: 0, players: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAndDraw();
    const interval = setInterval(loadAndDraw, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, []);

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

    // Fundo escuro
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // ── Carrega tiles explorados do Supabase ──
    const [{ data: tiles }, { data: players }] = await Promise.all([
      supabase.from('map_tiles').select('tile_x, tile_y').limit(2000),
      supabase.from('players').select('last_lat, last_lng, username, is_online').eq('is_online', true).limit(100),
    ]);

    setLoading(false);

    // ── Desenha continentes (OSM tiles de baixo zoom como fundo) ──
    // Usando imagem simples de baixo zoom para referência visual
    const worldImg = new Image();
    worldImg.crossOrigin = 'anonymous';
    worldImg.src = 'https://a.tile.openstreetmap.org/2/0/0.png'; // World overview
    worldImg.onload = () => {
      // Desenha 4×2 tiles do zoom 2 para cobrir o mundo todo
      const tileW = W / 4;
      const tileH = H / 2;
      for (let tx = 0; tx < 4; tx++) {
        for (let ty = 0; ty < 2; ty++) {
          const imgTile = new Image();
          imgTile.crossOrigin = 'anonymous';
          imgTile.src = `https://a.tile.openstreetmap.org/2/${tx}/${ty}.png`;
          imgTile.onload = () => {
            ctx.globalAlpha = 0.25;
            ctx.filter = 'brightness(0.4) saturate(0.3)';
            ctx.drawImage(imgTile, tx * tileW, ty * tileH, tileW, tileH);
            ctx.globalAlpha = 1;
            ctx.filter = 'none';
          };
        }
      }
    };

    // ── Pontos explorados ──
    if (tiles && tiles.length > 0) {
      setStats(prev => ({ ...prev, tiles: tiles.length }));
      const scale = Math.pow(2, OSM_ZOOM);

      tiles.forEach(({ tile_x, tile_y }) => {
        const px = (tile_x / scale) * W;
        const py = (tile_y / scale) * H;

        // Glow vermelho sangue para área explorada
        const grd = ctx.createRadialGradient(px, py, 0, px, py, 3);
        grd.addColorStop(0, 'rgba(180, 0, 0, 0.9)');
        grd.addColorStop(1, 'rgba(100, 0, 0, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // ── Players ativos ──
    if (players && players.length > 0) {
      setStats(prev => ({ ...prev, players: players.length }));
      players.forEach((p) => {
        if (!p.last_lat || !p.last_lng) return;
        const scale = Math.pow(2, OSM_ZOOM);
        const { tileX, tileY } = latLngToOsmTileLocal(p.last_lat, p.last_lng);
        const px = (tileX / scale) * W;
        const py = (tileY / scale) * H;

        // Pulso verde para player online
        const grd = ctx.createRadialGradient(px, py, 0, px, py, 5);
        grd.addColorStop(0, 'rgba(57,255,20,1)');
        grd.addColorStop(1, 'rgba(57,255,20,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      });
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

function latLngToOsmTileLocal(lat: number, lng: number, zoom = OSM_ZOOM) {
  const n = Math.pow(2, zoom);
  const tileX = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const tileY = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { tileX, tileY };
}
