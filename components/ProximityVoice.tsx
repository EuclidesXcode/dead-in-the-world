'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

export default function ProximityVoice() {
  const { player, onlinePlayers, addNotification } = useGameStore();
  const [micEnabled, setMicEnabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<{ [playerId: string]: RTCPeerConnection }>({});
  const audioElements = useRef<{ [playerId: string]: HTMLAudioElement }>({});
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!player) return;

    const channel = supabase.channel('voice-signaling', {
      config: { broadcast: { self: false } }
    });
    channelRef.current = channel;

    channel.on('broadcast', { event: 'webrtc_signaling' }, async (payload) => {
      const { targetId, senderId, type, data } = payload.payload;
      if (targetId !== player.id) return;

      let pc = peers.current[senderId];

      try {
        if (type === 'offer') {
          if (!pc) pc = createPeerConnection(senderId);
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'webrtc_signaling',
            payload: { targetId: senderId, senderId: player.id, type: 'answer', data: answer }
          });
        } else if (type === 'answer') {
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data));
        } else if (type === 'ice-candidate') {
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(data));
        }
      } catch (err) {
        console.error('WebRTC Error:', err);
      }
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(peers.current).forEach(pc => pc.close());
      Object.values(audioElements.current).forEach(a => {
         a.pause();
         a.srcObject = null;
      });
      if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    };
  }, [player?.id]);

  const createPeerConnection = (targetId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peers.current[targetId] = pc;

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'webrtc_signaling',
          payload: { targetId, senderId: player!.id, type: 'ice-candidate', data: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      let audio = audioElements.current[targetId];
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        document.body.appendChild(audio); // Append to body so it stays active
        audioElements.current[targetId] = audio;
      }
      audio.srcObject = event.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
         if (audioElements.current[targetId]) {
             audioElements.current[targetId].pause();
             audioElements.current[targetId].srcObject = null;
             audioElements.current[targetId].remove();
             delete audioElements.current[targetId];
         }
         delete peers.current[targetId];
      }
    };

    return pc;
  };

  const connectToPeers = async () => {
    for (const op of onlinePlayers) {
      if (op.id !== player!.id && !peers.current[op.id]) {
        try {
          const pc = createPeerConnection(op.id);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channelRef.current?.send({
            type: 'broadcast',
            event: 'webrtc_signaling',
            payload: { targetId: op.id, senderId: player!.id, type: 'offer', data: offer }
          });
        } catch (e) {
          console.log('Error creating WebRTC offer', e);
        }
      }
    }
  };

  useEffect(() => {
    if (micEnabled && player) {
      connectToPeers();
    }
  }, [onlinePlayers.length]);

  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      onlinePlayers.forEach(op => {
        const audio = audioElements.current[op.id];
        if (audio) {
          const dx = (op.last_lng - player.last_lng) * 111320 * Math.cos(player.last_lat * Math.PI / 180);
          const dy = (op.last_lat - player.last_lat) * 111320;
          const distMeters = Math.sqrt(dx*dx + dy*dy);
          
          const maxDist = 60; // Max 60 meters
          let vol = 1 - (distMeters / maxDist);
          if (vol < 0) vol = 0;
          if (vol > 1) vol = 1;

          // Soften the volume curve (inverse square-ish logic)
          audio.volume = Math.pow(vol, 2); 
        }
      });
    }, 500);
    return () => clearInterval(interval);
  }, [player, onlinePlayers]);

  const toggleMic = async () => {
    if (micEnabled) {
      if (localStream.current) {
        localStream.current.getTracks().forEach(t => t.stop());
        localStream.current = null;
      }
      
      Object.values(peers.current).forEach(pc => pc.close());
      peers.current = {};
      Object.values(audioElements.current).forEach(a => {
         a.pause();
         a.remove();
      });
      audioElements.current = {};
      
      setMicEnabled(false);
      addNotification('Voz por proximidade DESATIVADA', 'info');
    } else {
      setIsConnecting(true);
      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setMicEnabled(true);
        addNotification('Voz por proximidade ATIVADA', 'success');
        connectToPeers();
      } catch (err) {
        console.error('Mic access denied', err);
        addNotification('Acesso ao microfone negado', 'danger');
      }
      setIsConnecting(false);
    }
  };

  if (!player) return null;

  return (
    <button
      onClick={toggleMic}
      disabled={isConnecting}
      className={`fixed top-20 right-4 retro-panel p-2 flex items-center justify-center gap-2 z-50 transition-all shadow-lg ${micEnabled ? 'border-[#39ff14] shadow-[#39ff14]/20' : 'border-white/20'}`}
      style={{
        background: micEnabled ? 'rgba(57,255,20,0.1)' : 'rgba(0,0,0,0.85)',
        width: 48,
        height: 48,
        borderRadius: 8,
        cursor: 'pointer'
      }}
      title="Voz por Proximidade"
    >
      <span style={{ fontSize: 22 }}>
         {isConnecting ? '⏳' : micEnabled ? '🗣️' : '🔇'}
      </span>
      {micEnabled && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#39ff14] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#39ff14]"></span>
        </span>
      )}
    </button>
  );
}
