'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, signInWithGoogle } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Autenticando...');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('Entrando no mundo...');
        setTimeout(() => router.replace('/game'), 500);
      } else {
        router.replace('/');
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="pixel-font text-red-500 text-sm animate-pulse">{status}</div>
      </div>
    </div>
  );
}
