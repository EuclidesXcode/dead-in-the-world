'use client';
import React, { useState } from 'react';
import { useGameStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { ITEM_DATABASE, RARITY_CONFIG } from '@/lib/loot';
import { InventoryItem } from '@/lib/supabase';

const UPGRADE_ITEMS = ['silencer', 'extended_mag', 'scope', 'grip'];

export default function WeaponUpgrade() {
  const { showWeaponUpgrade, toggleWeaponUpgrade, inventory, equippedWeapon, updateInventoryItem, removeInventoryItem, addNotification } = useGameStore();
  const [activeTab, setActiveTab] = useState<'attachments' | 'refine' | 'fuse'>('attachments');
  const [selectedUpgrade, setSelectedUpgrade] = useState<string | null>(null);

  if (!showWeaponUpgrade) return null;

  const weapon = equippedWeapon;
  const availableUpgrades = inventory.filter(i => UPGRADE_ITEMS.includes(i.item_id));
  const currentUpgrades: string[] = weapon?.upgrades || [];

  const materials = {
    scrap: inventory.find(i => i.item_id === 'scrap_metal'),
    electronics: inventory.find(i => i.item_id === 'electronics'),
  };

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

    const newUpgrades = [...currentUpgrades, upgradeItem.item_id];
    const newStats = { ...weapon.stats };

    if (upDef.stats?.damage_mod) newStats.damage = (newStats.damage || 0) + upDef.stats.damage_mod;
    if (upDef.stats?.range_mod) newStats.range = (newStats.range || 0) + upDef.stats.range_mod;
    if (upDef.stats?.precision_mod) newStats.precision = (newStats.precision || 0) + upDef.stats.precision_mod;
    if (upDef.stats?.magazine_mod) newStats.magazine = (newStats.magazine || 0) + upDef.stats.magazine_mod;

    updateInventoryItem(weapon.id, { upgrades: newUpgrades, stats: newStats });
    if (upgradeItem.quantity <= 1) removeInventoryItem(upgradeItem.id);
    else updateInventoryItem(upgradeItem.id, { quantity: upgradeItem.quantity - 1 });

    await supabase.from('inventory').update({ upgrades: newUpgrades, stats: newStats }).eq('id', weapon.id);
    addNotification(`${upDef.item_name} instalado em ${weapon.item_name}!`, 'success');
  };

  const handleRefine = async (stat: 'damage' | 'fire_rate' | 'range') => {
    if (!weapon) return;

    const refineLevel = (weapon.stats?.refine_level || 0);
    const scrapCost = 5 + (refineLevel * 3);
    const electronicCost = refineLevel >= 3 ? Math.floor(refineLevel / 2) : 0;

    if ((materials.scrap?.quantity || 0) < scrapCost) {
      addNotification(`Sucata insuficiente! Precisa de ${scrapCost}`, 'warning');
      return;
    }
    if (electronicCost > 0 && (materials.electronics?.quantity || 0) < electronicCost) {
      addNotification(`Eletrônicos insuficientes! Precisa de ${electronicCost}`, 'warning');
      return;
    }

    const newStats = { ...weapon.stats };
    newStats.refine_level = refineLevel + 1;

    if (stat === 'damage') {
      newStats.damage = (newStats.damage || 0) + 5;
      newStats.projectile_size = (newStats.projectile_size || 3) + 0.5;
    } else if (stat === 'fire_rate') {
      newStats.fire_rate = (newStats.fire_rate || 1) + 0.2;
    } else if (stat === 'range') {
      newStats.range = (newStats.range || 100) + 25;
    }

    // Consumir materiais
    if (materials.scrap) {
       if (materials.scrap.quantity <= scrapCost) removeInventoryItem(materials.scrap.id);
       else updateInventoryItem(materials.scrap.id, { quantity: materials.scrap.quantity - scrapCost });
    }
    if (electronicCost > 0 && materials.electronics) {
       if (materials.electronics.quantity <= electronicCost) removeInventoryItem(materials.electronics.id);
       else updateInventoryItem(materials.electronics.id, { quantity: materials.electronics.quantity - electronicCost });
    }

    updateInventoryItem(weapon.id, { stats: newStats });
    await supabase.from('inventory').update({ stats: newStats }).eq('id', weapon.id);
    addNotification(`${weapon.item_name} refinado! +Level de ${stat}`, 'success');
  };

  const handleFuse = async (consumedWeapon: InventoryItem) => {
    if (!weapon) return;
    
    const newStats = { ...weapon.stats };
    newStats.refine_level = (newStats.refine_level || 0) + 1;
    newStats.damage = (newStats.damage || 0) + 10;
    newStats.fire_rate = (newStats.fire_rate || 1) + 0.5;
    newStats.range = (newStats.range || 100) + 50;
    newStats.magazine = (newStats.magazine || 0) + 2;

    updateInventoryItem(weapon.id, { stats: newStats });
    removeInventoryItem(consumedWeapon.id);

    await supabase.from('inventory').update({ stats: newStats }).eq('id', weapon.id);
    await supabase.from('inventory').delete().eq('id', consumedWeapon.id);

    addNotification(`${weapon.item_name} FUNDIDO COM SUCESSO! Status massivamente aumentados.`, 'success');
  };

  return (
    <div className="modal-overlay" onClick={toggleWeaponUpgrade}>
      <div
        className="modal-content retro-panel"
        style={{ width: 'min(580px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#8b000033]">
          <div className="pixel-font text-yellow-500" style={{ fontSize: 11 }}>⚙️ BANCADA DE ARMAS</div>
          <button className="btn-retro btn-retro-red" onClick={toggleWeaponUpgrade} style={{ padding: '4px 8px', fontSize: 9 }}>✕</button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-2 bg-black/40">
           <button 
             onClick={() => setActiveTab('attachments')}
             className={`flex-1 py-2 pixel-font text-[9px] transition-all border ${activeTab === 'attachments' ? 'border-[#f59e0b] text-[#f59e0b] bg-[#f59e0b11]' : 'border-white/10 text-white/40'}`}
           >ACESSÓRIOS</button>
           <button 
             onClick={() => setActiveTab('refine')}
             className={`flex-1 py-2 pixel-font text-[9px] transition-all border ${activeTab === 'refine' ? 'border-[#39ff14] text-[#39ff14] bg-[#39ff1411]' : 'border-white/10 text-white/40'}`}
           >REFINO TÉCNICO</button>
           <button 
             onClick={() => setActiveTab('fuse')}
             className={`flex-1 py-2 pixel-font text-[9px] transition-all border ${activeTab === 'fuse' ? 'border-[#a855f7] text-[#a855f7] bg-[#a855f711]' : 'border-white/10 text-white/40'}`}
           >FUSÃO (DUPLICATAS)</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {!weapon ? (
            <div className="text-center py-12 opacity-40 pixel-font text-[9px]">EQUIPE UMA ARMA PRIMEIRO</div>
          ) : (
            <>
              {/* Weapon Info Header */}
              <div className="retro-panel-green p-4 mb-6 border-l-4 border-l-[#39ff14]">
                 <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                       <span className="text-4xl">{weapon.item_id === 'rocket_launcher' ? '🚀' : '🔫'}</span>
                       <div>
                          <div className="pixel-font text-white text-[12px] mb-1">{weapon.item_name.toUpperCase()}</div>
                          <div className="flex gap-2">
                             <span className="px-2 py-0.5 bg-black/50 text-[8px] text-[#f59e0b] border border-[#f59e0b33] rounded">LVL {weapon.stats?.refine_level || 0}</span>
                             <span className="px-2 py-0.5 bg-black/50 text-[8px] text-[#aaa] border border-white/10 rounded">{RARITY_CONFIG[weapon.rarity].label}</span>
                          </div>
                       </div>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'DANO', val: weapon.stats?.damage, color: '#ff4444' },
                      { label: 'RANGE', val: weapon.stats?.range + 'm', color: '#3b82f6' },
                      { label: 'FIRE-RATE', val: weapon.stats?.fire_rate, color: '#39ff14' },
                      { label: 'PROJ-SIZE', val: (weapon.stats?.projectile_size || 3).toFixed(1), color: '#00f2ff' }
                    ].map(s => (
                      <div key={s.label} className="bg-black/30 p-2 rounded">
                         <div className="text-[7px] text-white/40 mb-1">{s.label}</div>
                         <div className="pixel-font text-[10px]" style={{ color: s.color }}>{s.val}</div>
                      </div>
                    ))}
                 </div>
              </div>

              {activeTab === 'attachments' ? (
                <div className="space-y-3">
                   {availableUpgrades.length === 0 ? (
                     <div className="text-center py-8 text-white/20 text-[10px]">ENCONTRE ACESSÓRIOS (MIRAS, PENTES) NO MAPA</div>
                   ) : (
                     availableUpgrades.map(up => (
                       <div key={up.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 hover:border-[#f59e0b] transition-all group">
                          <div className="flex items-center gap-3">
                             <span className="text-2xl">{ITEM_DATABASE[up.item_id]?.emoji}</span>
                             <div>
                                <div className="text-white text-[10px] font-bold">{up.item_name}</div>
                                <div className="text-[8px] text-white/30 uppercase">{ITEM_DATABASE[up.item_id]?.description}</div>
                             </div>
                          </div>
                          <button 
                            className="bg-[#f59e0b] text-black px-4 py-1.5 pixel-font text-[8px] hover:scale-105 active:scale-95 transition-all"
                            onClick={() => applyUpgrade(up)}
                          >INSTALAR</button>
                       </div>
                     ))
                   )}
                </div>
              ) : activeTab === 'refine' ? (
                <div className="space-y-4">
                   <div className="flex gap-4 p-3 bg-[#39ff1408] border border-[#39ff1422] justify-center">
                      <div className="text-center">
                         <div className="text-[7px] text-white/40 mb-1">SUCATA</div>
                         <div className="pixel-font text-[#39ff14] text-[10px]">{materials.scrap?.quantity || 0}</div>
                      </div>
                      <div className="w-[1px] bg-white/10" />
                      <div className="text-center">
                         <div className="text-[7px] text-white/40 mb-1">ELETRÔNICOS</div>
                         <div className="pixel-font text-[#00f2ff] text-[10px]">{materials.electronics?.quantity || 0}</div>
                      </div>
                   </div>

                   <div className="space-y-2">
                      {[
                        { id: 'damage' as const, label: 'REFORÇAR CANO', sub: 'Aumenta Dano e Tamanho do Projétil', icon: '🔥' },
                        { id: 'fire_rate' as const, label: 'SISTEMA DE GATILHO', sub: 'Melhora Cadência de Disparo', icon: '⚡' },
                        { id: 'range' as const, label: 'MIRA LASER', sub: 'Aumenta Alcance Efetivo', icon: '🔭' },
                      ].map(r => {
                        const cost = 5 + ((weapon.stats?.refine_level || 0) * 3);
                        const eCost = (weapon.stats?.refine_level || 0) >= 3 ? Math.floor((weapon.stats?.refine_level || 0) / 2) : 0;
                        return (
                          <div key={r.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 hover:border-[#39ff14] transition-all">
                             <div className="flex items-center gap-4">
                                <span className="text-2xl">{r.icon}</span>
                                <div>
                                   <div className="text-white text-[10px] font-bold">{r.label}</div>
                                   <div className="text-[8px] text-white/30">{r.sub}</div>
                                </div>
                             </div>
                             <button 
                               onClick={() => handleRefine(r.id)}
                               className="bg-[#39ff14] text-black p-2 pixel-font text-[8px] flex flex-col items-center gap-1 min-w-[80px]"
                             >
                                <span>REFINAR</span>
                                <span className="text-[7px] opacity-70">-{cost}🔩{eCost > 0 ? ` -${eCost}💾` : ''}</span>
                             </button>
                          </div>
                        )
                      })}
                   </div>
                </div>
              ) : activeTab === 'fuse' ? (
                 <div className="space-y-4">
                    <div className="text-center text-[10px] text-[#a855f7] pixel-font mb-4">SACRIFIQUE UMA ARMA IGUAL PARA UM BOOST MASSIVO</div>
                    
                    {inventory.filter(i => i.item_id === weapon.item_id && i.id !== weapon.id).length === 0 ? (
                       <div className="text-center py-8 text-white/20 text-[10px] uppercase">
                         Você não tem outra {weapon.item_name} no inventário para fundir.
                       </div>
                    ) : (
                       inventory.filter(i => i.item_id === weapon.item_id && i.id !== weapon.id).map(dup => (
                          <div key={dup.id} className="flex items-center justify-between p-4 bg-[#a855f70a] border border-[#a855f733] hover:border-[#a855f7] transition-all group">
                             <div className="flex items-center gap-4">
                                <span className="text-3xl grayscale group-hover:grayscale-0 transition-all opacity-50">{ITEM_DATABASE[dup.item_id]?.emoji}</span>
                                <div>
                                   <div className="text-white text-[10px] font-bold">{dup.item_name} <span className="text-[#a855f7]">LVL {dup.stats?.refine_level || 0}</span></div>
                                   <div className="text-[8px] text-white/30 truncate max-w-[150px]">Será destruída no processo (+Dano, +Cadência, +Alcance)</div>
                                </div>
                             </div>
                             <button 
                               className="bg-red-600 text-white px-4 py-2 pixel-font text-[8px] hover:bg-red-500 font-bold transition-all shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                               onClick={() => handleFuse(dup)}
                             >FUNDIR - DESTRUIR</button>
                          </div>
                       ))
                    )}
                 </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
