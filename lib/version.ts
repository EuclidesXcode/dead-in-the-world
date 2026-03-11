// ──────────────────────────────────────────────────────
//  DeadWorld — Controle de Versão
//  Usando Semantic Versioning: MAJOR.MINOR.PATCH
//
//  MAJOR → mudança arquitetural grande ou lançamento oficial
//  MINOR → nova feature (mapa, tipo de zumbi, sistema novo)
//  PATCH → bug fix, ajuste visual, melhoria pequena
// ──────────────────────────────────────────────────────

export const VERSION = '0.2.0';
export const VERSION_LABEL = 'Alpha';

export const CHANGELOG: { version: string; date: string; changes: string[] }[] = [
  {
    version: '0.2.0',
    date: '2026-03-11',
    changes: [
      'Mapa real via OpenStreetMap tiles (ruas reais da sua cidade)',
      'Auto-aim + auto-fire: atira no zumbi mais próximo automaticamente',
      'Sistema de spawn progressivo baseado no nível dos jogadores',
      'Pre-loading de tiles invisível ao andar (sem loading perceptível)',
      'Mapa global na landing page (onde o mundo está sendo explorado)',
      'Stats reais na landing: zumbis mortos, tiles, players online',
      'Tint de apocalipse sobre o mapa OSM',
      'Marcador de alvo ativo nos zumbis sendo atacados',
    ],
  },
  {
    version: '0.1.1',
    date: '2026-03-11',
    changes: [
      'Fix: redirect OAuth após login Google',
      'Callback processa hash token (#access_token) corretamente',
      'Tela de loading com spinner no callback',
      'Supabase Site URL configurado com https://',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-03-11',
    changes: [
      'Lançamento inicial Alpha',
      'Mapa gerado por geolocalização real',
      'Autenticação Google via Supabase',
      '4 tipos de zumbi (Walker, Runner, Tank, Screamer)',
      'Sistema de inventário e loot por tile',
      'Personalização de personagem',
      'Ranking global em tempo real',
      'Suporte a mobile com joystick virtual',
      'Chat global',
    ],
  },
];
