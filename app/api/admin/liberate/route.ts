import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos as chaves do servidor (Service Role) para ignorar RLS se necessário,
// mas aqui o .env tem apenas a anon key. 
// Para produção, o ideal é usar a SERVICE_ROLE_KEY no env.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Usando a anon por enquanto

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get('id');

  if (!playerId) {
    return new Response('ID do player não fornecido', { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // No mundo ideal, isso teria uma proteção de senha ou JWT de admin
  const { error } = await supabase
    .from('players')
    .update({ has_css_access: true })
    .eq('id', playerId);

  if (error) {
    console.error('Liberate error:', error);
    return new Response(`Erro ao liberar: ${error.message}`, { status: 500 });
  }

  return new Response(`
    <html>
      <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0a0a0a; color: #39ff14; text-align: center;">
        <div>
          <h1>✅ SUCESSO!</h1>
          <p>O acesso CSS Expert foi liberado para o ID: <b>${playerId}</b></p>
          <p>O jogador já pode usar o editor de CSS Customizado.</p>
        </div>
      </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' },
  });
}
