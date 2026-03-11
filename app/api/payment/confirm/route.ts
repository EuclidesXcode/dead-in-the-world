import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  try {
    const { playerId, username } = await req.json();
    
    if (!playerId) {
      return NextResponse.json({ error: 'Player ID é obrigatório' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const releaseUrl = `${siteUrl}/api/admin/liberate?id=${playerId}`;
    
    // 1. Log para o console
    console.log('--- NOVA SOLICITAÇÃO DE PAGAMENTO ---');
    console.log(`Jogador: ${username}`);
    console.log(`Link: ${releaseUrl}`);

    // 2. Insere na tabela de eventos para notificação em tempo real no jogo
    await supabase.from('game_events').insert({
      event_type: 'payment_request',
      player_id: playerId,
      payload: { 
        username, 
        releaseUrl,
        message: `O jogador ${username} solicitou liberação de CSS Expert.`
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Notificação enviada!' 
    });
  } catch (err) {
    console.error('Confirm error:', err);
    return NextResponse.json({ error: 'Falha' }, { status: 500 });
  }
}
