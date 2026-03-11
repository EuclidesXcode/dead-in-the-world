'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

export default function Chat() {
  const { showChat, toggleChat, chatMessages, addChatMessage, player } = useGameStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showChat) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, showChat]);

  // Assina o canal de chat realtime
  useEffect(() => {
    const channel = supabase
      .channel('chat_global')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
      }, (payload) => {
        addChatMessage(payload.new as any);
      })
      .subscribe();

    // Carrega histórico recente
    supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) data.reverse().forEach(m => addChatMessage(m as any));
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || !player || sending) return;
    const msg = input.trim().slice(0, 140);
    setInput('');
    setSending(true);
    try {
      await supabase.from('chat_messages').insert({
        player_id: player.id,
        player_name: player.username,
        message: msg,
        msg_type: 'global',
      });
    } catch { }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Evita que o Enter propague para o game
    e.stopPropagation();
  };

  const getMsgColor = (type: string) => {
    if (type === 'system') return '#f59e0b';
    if (type === 'action') return '#8b5cf6';
    return '#fff';
  };

  const getTimeStr = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (!showChat) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: 12,
        zIndex: 300,
        width: 'min(340px, calc(100vw - 24px))',
      }}
    >
      <div className="retro-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b"
          style={{ borderColor: '#1a1a1a' }}
        >
          <div className="pixel-font" style={{ fontSize: 8, color: '#dc2626' }}>💬 CHAT GLOBAL</div>
          <button
            onClick={toggleChat}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14 }}
          >✕</button>
        </div>

        {/* Mensagens */}
        <div style={{ height: 200, overflowY: 'auto', padding: '8px 12px' }}>
          {chatMessages.length === 0 && (
            <div style={{ color: '#333', fontSize: 9, fontFamily: "'Share Tech Mono', monospace", textAlign: 'center', paddingTop: 20 }}>
              Nenhuma mensagem ainda...
            </div>
          )}
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className="chat-message"
              style={{
                marginBottom: 6,
                fontSize: 10,
                fontFamily: "'Share Tech Mono', monospace",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: '#444' }}>{getTimeStr(msg.created_at)} </span>
              <span
                style={{
                  color: msg.player_id === player?.id ? '#39ff14' : '#3b82f6',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 8,
                }}
              >
                {msg.player_name}
              </span>
              <span style={{ color: '#555' }}>: </span>
              <span style={{ color: getMsgColor(msg.msg_type) }}>{msg.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="flex gap-2 p-2 border-t"
          style={{ borderColor: '#1a1a1a' }}
          onKeyDown={e => e.stopPropagation()}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            maxLength={140}
            style={{
              flex: 1,
              background: '#0d0d0d',
              border: '1px solid #333',
              color: '#fff',
              padding: '6px 8px',
              fontSize: 10,
              fontFamily: "'Share Tech Mono', monospace",
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#8b0000'; }}
            onBlur={e => { e.target.style.borderColor = '#333'; }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            style={{
              background: 'rgba(139,0,0,0.4)',
              border: '1px solid #8b0000',
              color: input.trim() ? '#fff' : '#555',
              padding: '6px 10px',
              fontSize: 12,
              cursor: input.trim() ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
