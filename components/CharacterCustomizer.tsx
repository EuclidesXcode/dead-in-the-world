'use client';
import React, { useState } from 'react';
import { useGameStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import PlayerSprite from './PlayerSprite';

const SKIN_COLORS = ['#FFDBAC', '#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#4a2c0a'];
const HAIR_COLORS = ['#1a0d00', '#3D2B1F', '#6B4226', '#A0522D', '#C8A165', '#D4AF37', '#8B0000', '#2b2b4a', '#888888', '#eeeeee'];
const SHIRT_COLORS = ['#1a1a2e', '#1a2e1a', '#2e1a1a', '#1a2a3e', '#2e2a1a', '#0d1a0d', '#4a1a1a', '#1a1a4a', '#2d2d2d', '#4a3a1a'];
const PANTS_COLORS = ['#2d2d44', '#1a2e1a', '#2e1a1a', '#1f1f1f', '#2a3a2a', '#3a2a1a', '#1a2a3e', '#4a2a2a'];

export default function CharacterCustomizer() {
  const { showCharCustomizer, toggleCharCustomizer, player, updatePlayerStats } = useGameStore();
  const [saving, setSaving] = useState(false);

  if (!showCharCustomizer || !player) return null;

  const [preview, setPreview] = useState({
    skin_color: player.skin_color,
    hair_color: player.hair_color,
    shirt_color: player.shirt_color,
    pants_color: player.pants_color,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase
        .from('players')
        .update(preview)
        .eq('id', player.id);
      updatePlayerStats(preview);
      toggleCharCustomizer();
    } catch { }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={toggleCharCustomizer}>
      <div
        className="modal-content retro-panel"
        style={{ width: 'min(580px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#8b0000' }}>
          <div className="pixel-font text-white" style={{ fontSize: 11 }}>👤 PERSONALIZAR PERSONAGEM</div>
          <button className="btn-retro btn-retro-red" onClick={toggleCharCustomizer} style={{ padding: '4px 8px', fontSize: 9 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
          {/* Preview do personagem */}
          <div style={{
            width: 160,
            background: 'rgba(5,5,5,0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            borderRight: '1px solid #1a1a1a',
            padding: 16,
            flexShrink: 0,
          }}>
            {/* Personagem em escala maior */}
            <div style={{ transform: 'scale(2.5)', transformOrigin: 'center center', marginBottom: 60, marginTop: 20 }}>
              <PlayerSprite
                skinColor={preview.skin_color}
                hairColor={preview.hair_color}
                shirtColor={preview.shirt_color}
                pantsColor={preview.pants_color}
                scale={1}
                isLocal={true}
              />
            </div>

            {/* Stats do player */}
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 12, width: '100%' }}>
              <div className="pixel-font text-center mb-2" style={{ fontSize: 7, color: '#666' }}>STATS</div>
              {[
                { label: 'FORÇA', value: player.strength, max: 20, color: '#dc2626' },
                { label: 'AGIL', value: player.agility, max: 20, color: '#3b82f6' },
                { label: 'PREC', value: player.precision_stat, max: 20, color: '#f59e0b' },
              ].map(({ label, value, max, color }) => (
                <div key={label} className="mb-2">
                  <div className="flex justify-between mb-1" style={{ fontSize: 7, fontFamily: "'Share Tech Mono', monospace" }}>
                    <span style={{ color: '#555' }}>{label}</span>
                    <span style={{ color }}>{value}</span>
                  </div>
                  <div className="bar-container" style={{ height: 4 }}>
                    <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opções de personalização */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <ColorSection
              title="TOM DE PELE"
              colors={SKIN_COLORS}
              selected={preview.skin_color}
              onSelect={(c) => setPreview(p => ({ ...p, skin_color: c }))}
            />
            <ColorSection
              title="COR DO CABELO"
              colors={HAIR_COLORS}
              selected={preview.hair_color}
              onSelect={(c) => setPreview(p => ({ ...p, hair_color: c }))}
            />
            <ColorSection
              title="COR DA CAMISA"
              colors={SHIRT_COLORS}
              selected={preview.shirt_color}
              onSelect={(c) => setPreview(p => ({ ...p, shirt_color: c }))}
            />
            <ColorSection
              title="COR DA CALÇA"
              colors={PANTS_COLORS}
              selected={preview.pants_color}
              onSelect={(c) => setPreview(p => ({ ...p, pants_color: c }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t" style={{ borderColor: '#222' }}>
          <button className="btn-retro btn-retro-red" onClick={toggleCharCustomizer} style={{ fontSize: 9, padding: '8px 16px' }}>CANCELAR</button>
          <button
            className="btn-retro btn-retro-green"
            onClick={handleSave}
            disabled={saving}
            style={{ fontSize: 9, padding: '8px 16px' }}
          >
            {saving ? 'SALVANDO...' : 'SALVAR'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorSection({ title, colors, selected, onSelect }: {
  title: string;
  colors: string[];
  selected: string;
  onSelect: (c: string) => void;
}) {
  return (
    <div className="mb-5">
      <div className="pixel-font mb-2" style={{ fontSize: 8, color: '#dc2626' }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {colors.map(color => (
          <button
            key={color}
            onClick={() => onSelect(color)}
            style={{
              width: 32,
              height: 32,
              background: color,
              border: selected === color ? '3px solid #39ff14' : '2px solid #333',
              outline: selected === color ? '1px solid rgba(57,255,20,0.3)' : 'none',
              cursor: 'pointer',
              boxShadow: selected === color ? '0 0 8px rgba(57,255,20,0.4)' : 'none',
              transition: 'all 0.15s',
              transform: selected === color ? 'scale(1.15)' : 'scale(1)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
