'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Autenticando...');
  const [dots, setDots] = useState('');

  // Animação de loading
  useEffect(() => {
    const interval = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Supabase v2 com OAuth implícito devolve tokens no hash (#access_token=...)
    // onAuthStateChange detecta e processa automaticamente o hash fragment
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setStatus('Login confirmado! Entrando no mundo');
        subscription.unsubscribe();
        setTimeout(() => router.replace('/game'), 800);
      } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        // Ignora outros eventos
      }
    });

    // Fallback: verifica sessão existente (ex: refresh da página)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('Sessão encontrada! Entrando no mundo');
        subscription.unsubscribe();
        setTimeout(() => router.replace('/game'), 500);
      }
    });

    // Timeout de segurança — se demorar demais, volta ao login
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      router.replace('/');
    }, 15000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div
      style={{
        width: '100vw', height: '100vh',
        background: '#050505',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 24, fontFamily: "'Share Tech Mono', monospace",
      }}
    >
      {/* Spinner retro */}
      <div style={{
        width: 48, height: 48,
        border: '3px solid #1a1a1a',
        borderTop: '3px solid #8b0000',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 10, color: '#8b0000', marginBottom: 8,
        }}>
          DEAD WORLD
        </div>
        <div style={{ fontSize: 11, color: '#555' }}>
          {status}{dots}
        </div>
      </div>
    </div>
  );
}
