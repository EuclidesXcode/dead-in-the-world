'use client';
import React, { useState } from 'react';
import { useGameStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import PlayerSprite from './PlayerSprite';

const SKIN_COLORS = ['#FFDBAC', '#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#4a2c0a'];
const HAIR_COLORS = ['#1a0d00', '#3D2B1F', '#6B4226', '#A0522D', '#C8A165', '#D4AF37', '#8B0000', '#2b2b4a', '#888888', '#eeeeee'];
const SHIRT_COLORS = ['#1a1a2e', '#1a2e1a', '#2e1a1a', '#1a2a3e', '#2e2a1a', '#0d1a0d', '#4a1a1a', '#1a1a4a', '#2d2d2d', '#4a3a1a'];
const PANTS_COLORS = ['#2d2d44', '#1a2e1a', '#2e1a1a', '#1f1f1f', '#2a3a2a', '#3a2a1a', '#1a2a3e', '#4a2a2a'];

import { parseCustomCSS } from '@/lib/cssParser';

export default function CharacterCustomizer() {
  const { showCharCustomizer, toggleCharCustomizer, player, updatePlayerStats } = useGameStore();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'design' | 'css'>('design');

  if (!showCharCustomizer || !player) return null;

  const [preview, setPreview] = useState({
    skin_color: player.skin_color,
    hair_color: player.hair_color,
    shirt_color: player.shirt_color,
    pants_color: player.pants_color,
    custom_css: player.custom_css || '',
  });

  const parsedStyles = React.useMemo(() => parseCustomCSS(preview.custom_css), [preview.custom_css]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        skin_color: preview.skin_color,
        hair_color: preview.hair_color,
        shirt_color: preview.shirt_color,
        pants_color: preview.pants_color,
        custom_css: preview.custom_css,
      };
      await supabase
        .from('players')
        .update(data)
        .eq('id', player.id);
      updatePlayerStats(data);
      toggleCharCustomizer();
    } catch { }
    setSaving(false);
  };

  const defaultCSSTemplate = `/* Exemplos de seletores:
.head, .headBase, .hair, .torso, .armL, .armR, .legL, .legR, .bootL, .bootR, .weapon, .shadow
*/

.sprite {
  filter: drop-shadow(0 0 5px rgba(255,165,0,0.3));
}

.headBase {
  border-radius: 4px;
}

.torso {
  background: linear-gradient(to bottom, #1a1a2e, #000);
}`;

  return (
    <div className="modal-overlay" onClick={toggleCharCustomizer}>
      <div
        className="modal-content retro-panel"
        style={{ width: 'min(640px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#8b0000' }}>
          <div className="pixel-font text-white" style={{ fontSize: 11 }}>👤 PERSONALIZAR PERSONAGEM</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button 
              className={`btn-retro ${activeTab === 'design' ? 'btn-retro-yellow' : ''}`} 
              onClick={() => setActiveTab('design')} 
              style={{ padding: '4px 8px', fontSize: 8 }}
            >DESIGN</button>
            <button 
              className={`btn-retro ${activeTab === 'css' ? 'btn-retro-yellow' : ''}`} 
              onClick={() => setActiveTab('css')} 
              style={{ padding: '4px 8px', fontSize: 8 }}
            >CSS EXPERT</button>
          </div>
          <button className="btn-retro btn-retro-red" onClick={toggleCharCustomizer} style={{ padding: '4px 8px', fontSize: 9 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
          {/* Preview do personagem */}
          <div style={{
            width: 180,
            background: 'rgba(5,5,5,0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            borderRight: '1px solid #1a1a1a',
            padding: 16,
            flexShrink: 0,
          }}>
            <div style={{ transform: 'scale(2.5)', transformOrigin: 'center center', marginBottom: 60, marginTop: 20 }}>
              <PlayerSprite
                skinColor={preview.skin_color}
                hairColor={preview.hair_color}
                shirtColor={preview.shirt_color}
                pantsColor={preview.pants_color}
                scale={1}
                isLocal={true}
                customStyles={parsedStyles}
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
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#0a0a0a' }}>
            {activeTab === 'design' ? (
              <>
                <ColorSection title="TOM DE PELE" colors={SKIN_COLORS} selected={preview.skin_color} onSelect={(c) => setPreview(p => ({ ...p, skin_color: c }))} />
                <ColorSection title="COR DO CABELO" colors={HAIR_COLORS} selected={preview.hair_color} onSelect={(c) => setPreview(p => ({ ...p, hair_color: c }))} />
                <ColorSection title="COR DA CAMISA" colors={SHIRT_COLORS} selected={preview.shirt_color} onSelect={(c) => setPreview(p => ({ ...p, shirt_color: c }))} />
                <ColorSection title="COR DA CALÇA" colors={PANTS_COLORS} selected={preview.pants_color} onSelect={(c) => setPreview(p => ({ ...p, pants_color: c }))} />
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="pixel-font mb-2" style={{ fontSize: 8, color: '#39ff14' }}>EDITOR CSS DO PERSONAGEM</div>
                <div style={{ fontSize: 7, color: '#666', marginBottom: 8, fontFamily: 'monospace' }}>
                   * Apenas propriedades visuais permitidas (background, border, box-shadow, filter). Posicionamento e escala bloqueados.
                </div>
                <textarea
                  value={preview.custom_css}
                  onChange={(e) => setPreview(p => ({ ...p, custom_css: e.target.value }))}
                  placeholder={defaultCSSTemplate}
                  style={{
                    flex: 1,
                    minHeight: 300,
                    background: '#000',
                    color: '#39ff14',
                    border: '1px solid #222',
                    padding: 8,
                    fontSize: 10,
                    fontFamily: "'Share Tech Mono', monospace",
                    resize: 'none',
                    outline: 'none',
                  }}
                />
                <button 
                  className="btn-retro" 
                  onClick={() => setPreview(p => ({ ...p, custom_css: defaultCSSTemplate }))}
                  style={{ marginTop: 8, fontSize: 7, alignSelf: 'flex-start' }}
                >LIMPAR / USAR TEMPLATE</button>
              </div>
            )}
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
