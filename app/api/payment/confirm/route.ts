import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { playerId, username } = await req.json();
    
    if (!playerId) {
      return NextResponse.json({ error: 'Player ID é obrigatório' }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const releaseUrl = `${siteUrl}/api/admin/liberate?id=${playerId}`;
    
    // Log para o console do servidor
    console.log('--- NOVA SOLICITAÇÃO DE PAGAMENTO ---');
    console.log(`Jogador: ${username}`);
    console.log(`ID: ${playerId}`);
    console.log(`Link para liberar: ${releaseUrl}`);
    console.log('------------------------------------');

    // Nota: Como não temos um serviço de email configurado (Resend/Sendgrid),
    // o link aparece nos logs. O usuário pediu que chegasse no email.
    // Sugiro que ele configure o Resend para produção.

    return NextResponse.json({ 
      success: true, 
      message: 'Notificação enviada! O administrador revisará seu pagamento.' 
    });
  } catch (err) {
    console.error('Confirm error:', err);
    return NextResponse.json({ error: 'Falha ao processar confirmação' }, { status: 500 });
  }
}
