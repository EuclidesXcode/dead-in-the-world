'use client';
import React, { useState } from 'react';
import { useGameStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { ITEM_DATABASE, RARITY_CONFIG } from '@/lib/loot';
import { InventoryItem } from '@/lib/supabase';

const UPGRADE_ITEMS = ['silencer', 'extended_mag', 'scope', 'grip'];

export default function WeaponUpgrade() {
  const { showWeaponUpgrade, toggleWeaponUpgrade, inventory, equippedWeapon, updateInventoryItem, removeInventoryItem, addNotification } = useGameStore();
  const [selectedUpgrade, setSelectedUpgrade] = useState<string | null>(null);

  if (!showWeaponUpgrade) return null;

  const weapon = equippedWeapon;
  const availableUpgrades = inventory.filter(i => UPGRADE_ITEMS.includes(i.item_id));
  const currentUpgrades: string[] = weapon?.upgrades || [];

  const applyUpgrade = async (upgradeItem: InventoryItem) => {
    if (!weapon) return;

    const upDef = ITEM_DATABASE[upgradeItem.item_id];
    if (!upDef) return;

    const compatible = upDef.stats?.compatible || [];
    if (!compatible.includes(weapon.item_id)) {
      addNotification(`${upDef.item_name} não é compatível com ${weapon.item_name}`, 'warning');
      return;
    }

    if (currentUpgrades.includes(upgradeItem.item_id)) {
      addNotification('Este upgrade já está aplicado!', 'warning');
      return;
    }

    // Aplica o upgrade
    const newUpgrades = [...currentUpgrades, upgradeItem.item_id];
    const newStats = { ...weapon.stats };

    // Aplica bônus do upgrade
    if (upDef.stats?.damage_mod) newStats.damage = (newStats.damage || 0) + upDef.stats.damage_mod;
    if (upDef.stats?.range_mod) newStats.range = (newStats.range || 0) + upDef.stats.range_mod;
    if (upDef.stats?.precision_mod) newStats.precision = (newStats.precision || 0) + upDef.stats.precision_mod;
    if (upDef.stats?.magazine_mod) newStats.magazine = (newStats.magazine || 0) + upDef.stats.magazine_mod;

    updateInventoryItem(weapon.id, { upgrades: newUpgrades, stats: newStats });

    // Remove o item de upgrade do inventário
    if (upgradeItem.quantity <= 1) removeInventoryItem(upgradeItem.id);
    else updateInventoryItem(upgradeItem.id, { quantity: upgradeItem.quantity - 1 });

    // Salva no banco
    await supabase.from('inventory').update({ upgrades: newUpgrades, stats: newStats }).eq('id', weapon.id);

    addNotification(`${upDef.item_name} instalado em ${weapon.item_name}!`, 'success');
    setSelectedUpgrade(null);
  };

  const getStatDiff = (upgradeId: string) => {
    const def = ITEM_DATABASE[upgradeId];
    if (!def) return [];
    const diffs = [];
    if (def.stats?.damage_mod) diffs.push({ label: 'DANO', value: def.stats.damage_mod });
    if (def.stats?.range_mod) diffs.push({ label: 'ALCANCE', value: def.stats.range_mod });
    if (def.stats?.precision_mod) diffs.push({ label: 'PRECISÃO', value: def.stats.precision_mod });
    if (def.stats?.magazine_mod) diffs.push({ label: 'PENTE', value: def.stats.magazine_mod });
    return diffs;
  };

  return (
    <div className="modal-overlay" onClick={toggleWeaponUpgrade}>
      <div
        className="modal-content retro-panel"
        style={{ width: 'min(520px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#8b0000' }}>
          <div className="pixel-font text-yellow-500" style={{ fontSize: 11 }}>🔫 UPGRADE DE ARMA</div>
          <button className="btn-retro btn-retro-red" onClick={toggleWeaponUpgrade} style={{ padding: '4px 8px', fontSize: 9 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Arma equipada */}
          {!weapon ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#444', fontFamily: "'Press Start 2P', monospace", fontSize: 9 }}>
              Nenhuma arma equipada.<br />
              <span style={{ color: '#555', fontSize: 8, fontFamily: "'Share Tech Mono', monospace", display: 'block', marginTop: 8 }}>
                Equipe uma arma no inventário primeiro.
              </span>
            </div>
          ) : (
            <>
              {/* Info da arma atual */}
              <div className="retro-panel-green p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <span style={{ fontSize: 28 }}>🔫</span>
                  <div>
                    <div className="pixel-font" style={{ fontSize: 10, color: '#fff' }}>{weapon.item_name}</div>
                    <div style={{ fontSize: 9, color: RARITY_CONFIG[weapon.rarity].color, fontFamily: "'Share Tech Mono', monospace" }}>
                      {RARITY_CONFIG[weapon.rarity].label.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Stats atuais */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'DANO', value: weapon.stats?.damage },
                    { label: 'ALCANCE', value: weapon.stats?.range, suffix: 'm' },
                    { label: 'PRECISÃO', value: weapon.stats?.precision },
                    { label: 'PENTE', value: weapon.stats?.magazine || '∞' },
                  ].map(({ label, value, suffix = '' }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
                      <span style={{ color: '#555' }}>{label}:</span>
                      <span style={{ color: '#f59e0b' }}>{value}{suffix}</span>
                    </div>
                  ))}
                </div>

                {/* Upgrades instalados */}
                {currentUpgrades.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(74,124,89,0.3)' }}>
                    <div style={{ fontSize: 7, color: '#555', fontFamily: "'Share Tech Mono', monospace", marginBottom: 6 }}>UPGRADES INSTALADOS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {currentUpgrades.map(upId => (
                        <div key={upId} style={{
                          background: 'rgba(74,124,89,0.2)', border: '1px solid rgba(74,124,89,0.4)',
                          padding: '2px 8px', fontSize: 8, color: '#4a7c59',
                          fontFamily: "'Share Tech Mono', monospace",
                        }}>
                          {ITEM_DATABASE[upId]?.item_name || upId}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Upgrades disponíveis */}
              <div className="pixel-font mb-3" style={{ fontSize: 8, color: '#666' }}>UPGRADES NO INVENTÁRIO</div>

              {availableUpgrades.length === 0 ? (
                <div style={{ color: '#333', fontSize: 10, fontFamily: "'Share Tech Mono', monospace", textAlign: 'center', padding: 16 }}>
                  Nenhum upgrade disponível.<br />Explore o mapa para encontrar upgrades!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {availableUpgrades.map(upgrade => {
                    const def = ITEM_DATABASE[upgrade.item_id];
                    const compatible = def?.stats?.compatible || [];
                    const isCompat = compatible.includes(weapon.item_id);
                    const alreadyApplied = currentUpgrades.includes(upgrade.item_id);
                    const diffs = getStatDiff(upgrade.item_id);
                    const isSelected = selectedUpgrade === upgrade.id;

                    return (
                      <div
                        key={upgrade.id}
                        onClick={() => !alreadyApplied && isCompat && setSelectedUpgrade(isSelected ? null : upgrade.id)}
                        style={{
                          padding: '10px 14px',
                          background: isSelected ? 'rgba(74,124,89,0.15)' : 'rgba(20,20,20,0.8)',
                          border: `1px solid ${alreadyApplied ? '#2a4a2a' : isCompat ? '#4a7c59' : '#333'}`,
                          cursor: isCompat && !alreadyApplied ? 'pointer' : 'default',
                          opacity: !isCompat || alreadyApplied ? 0.5 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20 }}>{def?.emoji || '⚙️'}</span>
                            <div>
                              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#fff' }}>{upgrade.item_name}</div>
                              <div style={{ fontSize: 9, color: '#555', fontFamily: "'Share Tech Mono', monospace', marginTop: 2" }}>
                                {alreadyApplied ? '✓ Já instalado' : !isCompat ? '✕ Incompatível' : 'Compatível ✓'}
                              </div>
                            </div>
                          </div>

                          {/* Bônus de stats */}
                          <div style={{ display: 'flex', gap: 8 }}>
                            {diffs.map(({ label, value }) => (
                              <div key={label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 7, color: '#555', fontFamily: "'Share Tech Mono', monospace" }}>{label}</div>
                                <div style={{ fontSize: 10, color: value > 0 ? '#22c55e' : '#dc2626', fontFamily: "'Press Start 2P', monospace" }}>
                                  {value > 0 ? '+' : ''}{value}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Botão de instalar (quando selecionado) */}
                        {isSelected && isCompat && !alreadyApplied && (
                          <div className="flex justify-end mt-3">
                            <button
                              className="btn-retro btn-retro-green"
                              onClick={(e) => { e.stopPropagation(); applyUpgrade(upgrade); }}
                              style={{ fontSize: 8, padding: '6px 16px' }}
                            >
                              INSTALAR
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
