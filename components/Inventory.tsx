'use client';
import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store';
import { ITEM_DATABASE, RARITY_CONFIG, calculateInventoryWeight, MAX_INVENTORY_WEIGHT } from '@/lib/loot';
import { supabase } from '@/lib/supabase';

export default function Inventory() {
  const {
    showInventory, toggleInventory,
    inventory, removeInventoryItem, updateInventoryItem,
    player, updatePlayerStats,
    equippedWeapon, setEquippedWeapon,
    addNotification, addDamageNumber, viewportX, viewportY,
    playerPixelX, playerPixelY,
  } = useGameStore();

  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'weapon' | 'heal' | 'ammo' | 'upgrade' | 'food'>('all');

  if (!showInventory || !player) return null;

  const totalWeight = calculateInventoryWeight(inventory);
  const weightPercent = (totalWeight / MAX_INVENTORY_WEIGHT) * 100;
  const weightColor = weightPercent > 90 ? '#dc2626' : weightPercent > 70 ? '#f59e0b' : '#39ff14';

  const filtered = activeTab === 'all'
    ? inventory
    : inventory.filter(i => i.item_type === activeTab || (activeTab === 'food' && (i.item_type === 'food' || i.item_type === 'water')));

  const selected = inventory.find(i => i.id === selectedItem);

  const useItem = async (item: typeof selected) => {
    if (!item || !player) return;

    if (item.item_type === 'heal') {
      const heal = item.stats?.heal_amount || 15;
      const newHealth = Math.min(player.max_health, player.current_health + heal);
      updatePlayerStats({ current_health: newHealth });
      addDamageNumber({ x: playerPixelX - viewportX, y: playerPixelY - viewportY - 30, damage: heal, isCrit: false, isHeal: true });
      addNotification(`+${heal} HP recuperado com ${item.item_name}`, 'success');

      if (item.quantity <= 1) {
        removeInventoryItem(item.id);
        await supabase.from('inventory').delete().eq('id', item.id);
        setSelectedItem(null);
      } else {
        updateInventoryItem(item.id, { quantity: item.quantity - 1 });
        await supabase.from('inventory').update({ quantity: item.quantity - 1 }).eq('id', item.id);
      }
    } else if (item.item_type === 'food' || item.item_type === 'water') {
      const restore = item.stats?.stamina_restore || 20;
      const newStamina = Math.min(player.max_stamina, player.current_stamina + restore);
      updatePlayerStats({ current_stamina: newStamina });
      addNotification(`+${restore} Stamina com ${item.item_name}`, 'info');

      if (item.quantity <= 1) {
        removeInventoryItem(item.id);
        await supabase.from('inventory').delete().eq('id', item.id);
        setSelectedItem(null);
      } else {
        updateInventoryItem(item.id, { quantity: item.quantity - 1 });
      }
    } else if (item.item_type === 'weapon') {
      // Equipa arma
      if (equippedWeapon?.id === item.id) {
        setEquippedWeapon(null);
        updateInventoryItem(item.id, { equipped: false });
        addNotification(`${item.item_name} desequipada`, 'info');
      } else {
        if (equippedWeapon) updateInventoryItem(equippedWeapon.id, { equipped: false });
        setEquippedWeapon({ ...item, equipped: true });
        updateInventoryItem(item.id, { equipped: true });
        addNotification(`${item.item_name} equipada!`, 'success');
      }
    }
  };

  const dropItem = async (item: typeof selected) => {
    if (!item) return;
    removeInventoryItem(item.id);
    await supabase.from('inventory').delete().eq('id', item.id);
    setSelectedItem(null);
    addNotification(`Descartou ${item.item_name}`, 'info');
  };

  const tabs = [
    { key: 'all', label: 'TODOS', icon: '📦' },
    { key: 'weapon', label: 'ARMAS', icon: '🔫' },
    { key: 'heal', label: 'CURA', icon: '🩹' },
    { key: 'ammo', label: 'MUNIÇÃO', icon: '🔶' },
    { key: 'food', label: 'COMIDA', icon: '🥫' },
    { key: 'upgrade', label: 'UPGRADES', icon: '⚙️' },
  ] as const;

  return (
    <div className="modal-overlay" onClick={toggleInventory}>
      <div
        className="modal-content retro-panel"
        style={{
          width: 'min(680px, 96vw)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#8b0000' }}>
          <div className="pixel-font text-red-500" style={{ fontSize: 11 }}>🎒 INVENTÁRIO</div>
          <div className="flex items-center gap-4">
            {/* Peso */}
            <div style={{ minWidth: 120 }}>
              <div className="flex justify-between mb-1" style={{ fontSize: 9, color: '#666', fontFamily: "'Share Tech Mono', monospace" }}>
                <span>PESO</span>
                <span style={{ color: weightColor }}>{totalWeight.toFixed(1)}/{MAX_INVENTORY_WEIGHT}kg</span>
              </div>
              <div className="bar-container" style={{ height: 6 }}>
                <div style={{ width: `${weightPercent}%`, height: '100%', background: weightColor, transition: 'all 0.2s' }} />
              </div>
            </div>
            <button className="btn-retro btn-retro-red" onClick={toggleInventory} style={{ padding: '4px 8px', fontSize: 9 }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto" style={{ borderColor: '#222' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 12px',
                fontSize: 8,
                fontFamily: "'Press Start 2P', monospace",
                background: activeTab === tab.key ? 'rgba(139,0,0,0.3)' : 'transparent',
                color: activeTab === tab.key ? '#dc2626' : '#555',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #dc2626' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ marginRight: 4 }}>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
          {/* Lista de itens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: '#333', fontFamily: "'Press Start 2P', monospace", fontSize: 9 }}>
                INVENTÁRIO VAZIO
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
              {filtered.map(item => {
                const rarityConf = RARITY_CONFIG[item.rarity];
                const isSelected = selectedItem === item.id;
                const isEquipped = equippedWeapon?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(isSelected ? null : item.id)}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      background: isSelected ? `rgba(139,0,0,0.25)` : 'rgba(20,20,20,0.8)',
                      border: `2px solid ${isSelected ? '#dc2626' : rarityConf.color}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      boxShadow: isSelected ? `0 0 12px rgba(220,38,38,0.4)` : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* Emoji do item */}
                    <span style={{ fontSize: 22 }}>{getItemEmoji(item.item_id)}</span>
                    {/* Quantidade */}
                    {item.quantity > 1 && (
                      <div style={{
                        position: 'absolute', bottom: 2, right: 4,
                        fontSize: 9, color: '#fff', fontFamily: "'Share Tech Mono', monospace",
                        textShadow: '1px 1px 0 #000',
                      }}>
                        x{item.quantity}
                      </div>
                    )}
                    {/* Equipado */}
                    {isEquipped && (
                      <div style={{ position: 'absolute', top: 2, left: 2, width: 8, height: 8, background: '#39ff14', boxShadow: '0 0 4px #39ff14' }} />
                    )}
                    {/* Raridade */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: rarityConf.color }} />
                    {/* Nome truncado */}
                    <div style={{ fontSize: 6, color: '#888', fontFamily: "'Share Tech Mono', monospace", textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', padding: '0 2px' }}>
                      {item.item_name.slice(0, 10)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detalhe do item selecionado */}
          {selected && (
            <div
              style={{
                width: 'min(200px, 42vw)',
                borderLeft: '1px solid #222',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                overflowY: 'auto',
              }}
            >
              {/* Item info */}
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>{getItemEmoji(selected.item_id)}</div>
                <div className="pixel-font" style={{ fontSize: 8, color: '#fff', marginBottom: 4 }}>{selected.item_name}</div>
                <div style={{ fontSize: 9, color: RARITY_CONFIG[selected.rarity].color, fontFamily: "'Share Tech Mono', monospace" }}>
                  {RARITY_CONFIG[selected.rarity].label.toUpperCase()}
                </div>
              </div>

              {/* Separador */}
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #333, transparent)' }} />

              {/* Stats */}
              <div style={{ fontSize: 9, color: '#888', fontFamily: "'Share Tech Mono', monospace", lineHeight: 1.8 }}>
                {selected.item_type === 'weapon' && (
                  <>
                    <StatLine label="DANO" value={selected.stats?.damage} />
                    <StatLine label="ALCANCE" value={selected.stats?.range} suffix="m" />
                    <StatLine label="PRECISÃO" value={selected.stats?.precision} />
                    <StatLine label="CADÊNCIA" value={selected.stats?.fire_rate} suffix="/s" />
                    {selected.stats?.magazine && <StatLine label="PENTE" value={selected.stats.magazine} />}
                    <div style={{ marginTop: 4, height: 1, background: '#222' }} />
                    <div style={{ marginTop: 4 }}>
                      DURABILIDADE:
                      <div className="bar-container mt-1" style={{ height: 5 }}>
                        <div style={{ width: `${selected.durability || 100}%`, height: '100%', background: '#f59e0b' }} />
                      </div>
                    </div>
                  </>
                )}
                {(selected.item_type === 'heal') && (
                  <StatLine label="+HP" value={selected.stats?.heal_amount} />
                )}
                {(selected.item_type === 'food' || selected.item_type === 'water') && (
                  <StatLine label="+STAMINA" value={selected.stats?.stamina_restore} />
                )}
                {selected.item_type === 'ammo' && (
                  <StatLine label="QUANTIDADE" value={selected.quantity} />
                )}
                <div style={{ marginTop: 4 }}>
                  <span>PESO: </span><span style={{ color: '#fff' }}>{(selected.weight * selected.quantity).toFixed(1)}kg</span>
                </div>
                <div>
                  <span>QTD: </span><span style={{ color: '#fff' }}>x{selected.quantity}</span>
                </div>
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
                {(selected.item_type === 'weapon') && (
                  <button
                    className="btn-retro btn-retro-yellow"
                    onClick={() => useItem(selected)}
                    style={{ fontSize: 8, padding: '8px 4px', width: '100%' }}
                  >
                    {equippedWeapon?.id === selected.id ? 'DESEQUIPAR' : 'EQUIPAR'}
                  </button>
                )}
                {(selected.item_type === 'heal' || selected.item_type === 'food' || selected.item_type === 'water') && (
                  <button
                    className="btn-retro btn-retro-green"
                    onClick={() => useItem(selected)}
                    style={{ fontSize: 8, padding: '8px 4px', width: '100%' }}
                  >
                    USAR
                  </button>
                )}
                <button
                  className="btn-retro btn-retro-red"
                  onClick={() => dropItem(selected)}
                  style={{ fontSize: 8, padding: '8px 4px', width: '100%' }}
                >
                  DESCARTAR
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats rápidos do player */}
        <div className="flex gap-3 px-4 py-2 border-t flex-wrap" style={{ borderColor: '#222' }}>
          {[
            { label: 'FORÇA', value: player.strength, color: '#dc2626' },
            { label: 'AGIL', value: player.agility, color: '#3b82f6' },
            { label: 'PREC', value: player.precision_stat, color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 7, color: '#555', fontFamily: "'Share Tech Mono', monospace" }}>{label}</span>
              <span style={{ fontSize: 10, color, fontFamily: "'Press Start 2P', monospace" }}>{value}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 7, color: '#555', fontFamily: "'Share Tech Mono', monospace" }}>
            {inventory.length} ITENS · {totalWeight.toFixed(1)}kg
          </div>
        </div>
      </div>
    </div>
  );
}

function StatLine({ label, value, suffix = '' }: { label: string; value: any; suffix?: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}:</span>
      <span style={{ color: '#fff' }}>{value}{suffix}</span>
    </div>
  );
}

function getItemEmoji(id: string): string {
  const emojis: Record<string, string> = {
    pistol: '🔫', shotgun: '🔫', rifle: '🔫', sniper: '🔭',
    knife: '🔪', machete: '🗡️', bat: '⚾',
    bandage: '🩹', medkit: '🧰', pain_meds: '💊', morphine: '💉',
    canned_food: '🥫', water_bottle: '💧', energy_bar: '🍫',
    ammo_9mm: '🔶', ammo_shotgun: '🔶', ammo_rifle: '🔷',
    silencer: '🔇', extended_mag: '📦', scope: '🔭', grip: '🖐️',
    scrap_metal: '🔩', cloth: '🧵',
  };
  return emojis[id] || '📦';
}
