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
  const { 
    showCharCustomizer, 
    toggleCharCustomizer, 
    player, 
    updatePlayerStats,
    addNotification 
  } = useGameStore();
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'design' | 'css'>('profile');
  const [windowSize, setWindowSize] = useState({ w: 800, h: 600 });

  React.useEffect(() => {
    setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  
  const [preview, setPreview] = useState({
    skin_color: player?.skin_color || '#FFDBAC',
    hair_color: player?.hair_color || '#3D2B1F',
    shirt_color: player?.shirt_color || '#1a1a2e',
    pants_color: player?.pants_color || '#2d2d44',
    name_color: player?.name_color || (player?.has_css_access ? '#39ff14' : '#ffffff'),
    custom_css: player?.custom_css || '',
  });

  // Sync state when player changes (e.g. initial load or externally)
  React.useEffect(() => {
    if (player && showCharCustomizer) {
      setPreview({
        skin_color: player.skin_color,
        hair_color: player.hair_color,
        shirt_color: player.shirt_color,
        pants_color: player.pants_color,
        name_color: player.name_color || (player.has_css_access ? '#39ff14' : '#ffffff'),
        custom_css: player.custom_css || '',
      });
    }
  }, [player?.id, showCharCustomizer]);

  const parsedStyles = React.useMemo(() => parseCustomCSS(preview.custom_css), [preview.custom_css]);

  if (!showCharCustomizer || !player) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        skin_color: preview.skin_color,
        hair_color: preview.hair_color,
        shirt_color: preview.shirt_color,
        pants_color: preview.pants_color,
        name_color: preview.name_color,
        custom_css: preview.custom_css,
      };
      await supabase
        .from('players')
        .update(data)
        .eq('id', player.id);
      updatePlayerStats(data);
      // addNotification('Perfil atualizado!', 'success'); // Optional, toggle modal is enough
      toggleCharCustomizer();
    } catch (err) {
      console.error('Save error:', err);
    }
    setSaving(false);
  };
  

  const handleConfirmPayment = async () => {
    if (!window.confirm("Você confirma que já realizou o pagamento via PIX?")) return;
    
    setConfirming(true);
    try {
      const response = await fetch('/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          username: player.username
        })
      });
      
      const data = await response.json();
      if (data.success) {
        addNotification('Confirmação enviada! Aguarde a liberação.', 'success');
      } else {
        addNotification('Erro ao enviar confirmação.', 'danger');
      }
    } catch (err) {
      console.error('Payment confirmation error:', err);
      addNotification('Falha na comunicação com o servidor.', 'danger');
    }
    setConfirming(false);
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
          <div className="pixel-font text-white" style={{ fontSize: 11 }}>👤 PERFIL DO SOBREVIVENTE</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button 
              className={`btn-retro ${activeTab === 'profile' ? 'btn-retro-yellow' : ''}`} 
              onClick={() => setActiveTab('profile')} 
              style={{ padding: '4px 8px', fontSize: 8 }}
            >RESUMO</button>
            <button 
              className={`btn-retro ${activeTab === 'design' ? 'btn-retro-yellow' : ''}`} 
              onClick={() => setActiveTab('design')} 
              style={{ padding: '4px 8px', fontSize: 8 }}
            >DESIGN</button>
            <button 
              className={`btn-retro ${activeTab === 'css' ? 'btn-retro-yellow' : ''}`} 
              onClick={() => setActiveTab('css')} 
              style={{ padding: '4px 8px', fontSize: 8, position: 'relative' }}
            >
              CSS EXPERT
              {!player.has_css_access && <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 10 }}>🔒</span>}
            </button>
          </div>
          <button className="btn-retro btn-retro-red" onClick={toggleCharCustomizer} style={{ padding: '4px 8px', fontSize: 9 }}>✕</button>
        </div>

        <div style={{ 
          display: 'flex', 
          flexDirection: windowSize.w < 768 ? 'column' : 'row',
          flex: 1, 
          overflow: 'hidden', 
          gap: 0 
        }}>
          {/* Preview do personagem */}
          <div style={{
            width: windowSize.w < 768 ? '100%' : 180,
            height: windowSize.w < 768 ? 'auto' : '100%',
            background: 'rgba(5,5,5,0.9)',
            display: 'flex',
            flexDirection: windowSize.w < 768 ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            borderRight: windowSize.w < 768 ? 'none' : '1px solid #1a1a1a',
            borderBottom: windowSize.w < 768 ? '1px solid #1a1a1a' : 'none',
            padding: 16,
            flexShrink: 0,
          }}>
            <div style={{ 
              transform: windowSize.w < 768 ? 'scale(1.5)' : 'scale(2.5)', 
              transformOrigin: 'center center', 
              marginBottom: windowSize.w < 768 ? 20 : 60, 
              marginTop: windowSize.w < 768 ? 20 : 20 
            }}>
              <PlayerSprite
                skinColor={preview.skin_color}
                hairColor={preview.hair_color}
                shirtColor={preview.shirt_color}
                pantsColor={preview.pants_color}
                nameColor={preview.name_color}
                scale={1}
                isLocal={true}
                customStyles={parsedStyles}
              />
            </div>

            {/* Stats do player */}
            <div style={{ 
              borderLeft: windowSize.w < 768 ? '1px solid #1a1a1a' : 'none',
              borderTop: windowSize.w < 768 ? 'none' : '1px solid #1a1a1a', 
              paddingTop: windowSize.w < 768 ? 0 : 12,
              paddingLeft: windowSize.w < 768 ? 16 : 0,
              flex: 1,
              width: '100%' 
            }}>
              <div className="pixel-font text-center mb-2" style={{ fontSize: 7, color: '#666' }}>ATRIBUTOS</div>
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

          {/* Opções de personalização / Perfil */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#0a0a0a' }}>
            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="pixel-font" style={{ fontSize: 10, color: '#f59e0b', borderBottom: '1px solid #333', paddingBottom: 8 }}>ESTATÍSTICAS DE SOBREVIVÊNCIA</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                   <StatCard label="NÍVEL ATUAL" value={player.level} color="#f59e0b" />
                   <StatCard label="ZUMBIS MORTOS" value={player.kills} color="#dc2626" />
                   <StatCard label="ÁREAS EXPLORADAS" value={player.tiles_explored} color="#3b82f6" />
                   <StatCard label="ITENS COLETADOS" value={player.items_collected || 0} color="#39ff14" />
                   <StatCard label="MORTES" value={player.deaths || 0} color="#666" />
                   <StatCard label="XP TOTAL" value={player.xp} color="#8b5cf6" />
                </div>

                <div className="pixel-font" style={{ fontSize: 9, color: '#666', marginTop: 10 }}>PROGRESSO DE NÍVEL</div>
                <div style={{ background: '#111', padding: 12, border: '1px solid #222' }}>
                   <div className="flex justify-between mb-2" style={{ fontSize: 8, fontFamily: 'monospace', color: '#8b5cf6' }}>
                     <span>XP ATUAL: {player.xp}</span>
                     <span>PRÓXIMO: {player.xp_to_next}</span>
                   </div>
                   <div className="bar-container" style={{ height: 10 }}>
                     <div style={{ width: `${(player.xp / player.xp_to_next) * 100}%`, height: '100%', background: '#8b5cf6' }} />
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'design' && (
              <>
                <ColorSection title="TOM DE PELE" colors={SKIN_COLORS} selected={preview.skin_color} onSelect={(c) => setPreview(p => ({ ...p, skin_color: c }))} />
                <ColorSection title="COR DO CABELO" colors={HAIR_COLORS} selected={preview.hair_color} onSelect={(c) => setPreview(p => ({ ...p, hair_color: c }))} />
                <ColorSection title="COR DA CAMISA" colors={SHIRT_COLORS} selected={preview.shirt_color} onSelect={(c) => setPreview(p => ({ ...p, shirt_color: c }))} />
                <ColorSection title="COR DA CALÇA" colors={PANTS_COLORS} selected={preview.pants_color} onSelect={(c) => setPreview(p => ({ ...p, pants_color: c }))} />
                <ColorSection title="COR DO NOME" colors={['#ffffff', '#39ff14', '#ff3e3e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308', '#22c55e']} selected={preview.name_color} onSelect={(c) => setPreview(p => ({ ...p, name_color: c }))} />
              </>
            )}

            {activeTab === 'css' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="pixel-font mb-2" style={{ fontSize: 8, color: '#39ff14' }}>EDITOR CSS DO PERSONAGEM</div>
                
                {!player.has_css_access ? (
                  <div style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'rgba(20,0,0,0.4)',
                    border: '1px dashed #dc2626',
                    padding: 24,
                    textAlign: 'center'
                  }}>
                    <div className="pixel-font" style={{ fontSize: 14, color: '#f59e0b', marginBottom: 16 }}>🔒 RECURSO BLOQUEADO</div>
                    <div style={{ fontSize: 10, color: '#fff', marginBottom: 20, maxWidth: 300, lineHeight: 1.5 }}>
                      O acesso ao CSS Expert requer um pagamento único de <span style={{ color: '#39ff14' }}>R$ 1,99</span> para manutenção dos servidores.
                    </div>
                    
                    <div style={{ background: '#000', padding: 12, border: '1px solid #333', width: '100%', marginBottom: 12 }}>
                      <div style={{ fontSize: 8, color: '#666', marginBottom: 8 }}>CHAVE PIX:</div>
                      <div style={{ fontSize: 8, color: '#39ff14', wordBreak: 'break-all', fontFamily: 'monospace', marginBottom: 12 }}>
                        00020101021126830014br.gov.bcb.pix01366c83942f-54fb-4f40-aabb-e44ca2f84f1a0221Liberação CSS Profile52040000530398654041.995802BR5925EUCLIDES RUFO SILVA DO NA6008BRASILIA62170513SXQRDeadWorld6304282B
                      </div>
                      <button 
                        className="btn-retro" 
                        style={{ fontSize: 7, width: '100%' }}
                        onClick={() => {
                          navigator.clipboard.writeText("00020101021126830014br.gov.bcb.pix01366c83942f-54fb-4f40-aabb-e44ca2f84f1a0221Liberação CSS Profile52040000530398654041.995802BR5925EUCLIDES RUFO SILVA DO NA6008BRASILIA62170513SXQRDeadWorld6304282B");
                          alert("PIX Copiado!");
                        }}
                      >COPIAR CÓDIGO PIX</button>
                    </div>

                    <div style={{ fontSize: 8, color: '#666', marginBottom: 20 }}>
                      * Após o pagamento, o acesso será liberado automaticamente em alguns minutos.
                    </div>
                    
                    {/* Botão de confirmação real */}
                    <button 
                      className="btn-retro btn-retro-green" 
                      style={{ fontSize: 9, padding: '10px 20px' }}
                      onClick={handleConfirmPayment}
                      disabled={confirming}
                    >
                      {confirming ? 'ENVIANDO...' : 'JÁ REALIZEI O PAGAMENTO'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 7, color: '#666', marginBottom: 8, fontFamily: 'monospace' }}>
                       * Apenas propriedades visuais permitidas (background, border, box-shadow, filter). Posicionamento e escala bloqueados.
                    </div>
                    <textarea
                      value={preview.custom_css}
                      onChange={(e) => setPreview(p => ({ ...p, custom_css: e.target.value }))}
                      placeholder={defaultCSSTemplate}
                      style={{
                        flex: 1,
                        minHeight: 260,
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
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t" style={{ borderColor: '#222' }}>
          <button className="btn-retro btn-retro-red" onClick={toggleCharCustomizer} style={{ fontSize: 9, padding: '8px 16px' }}>FECHAR</button>
          <button
            className="btn-retro btn-retro-green"
            onClick={handleSave}
            disabled={saving}
            style={{ fontSize: 9, padding: '8px 16px' }}
          >
            {saving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div style={{ background: '#080808', border: '1px solid #1a1a1a', padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 6, color: '#555', fontFamily: "'Press Start 2P', monospace", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, color, fontFamily: "'Share Tech Mono', monospace", fontWeight: 'bold' }}>{value}</div>
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
