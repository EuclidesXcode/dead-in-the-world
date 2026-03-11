// ──────────────────────────────────────────────────────
//  DeadWorld — Controle de Versão
//  Usando Semantic Versioning: MAJOR.MINOR.PATCH
//
//  MAJOR → mudança arquitetural grande ou lançamento oficial
//  MINOR → nova feature (mapa, tipo de zumbi, sistema novo)
//  PATCH → bug fix, ajuste visual, melhoria pequena
// ──────────────────────────────────────────────────────

export const VERSION = '0.3.1';
export const VERSION_LABEL = 'Alpha';

export const CHANGELOG: { version: string; date: string; changes: string[] }[] = [
  {
    version: '0.3.1',
    date: '2026-03-11',
    changes: [
      'Sistema de Upgrades: Refino de armas usando Sucata e Eletrônicos (Dano, Cadência, Alcance)',
      'Armas Avançadas: Fuzil de Plasma, Magnum .44, RPG e Railgun',
      'Evolução Visual: Projéteis crescem conforme o upgrade de dano da arma',
      'Dual-Wielding: Personagem agora atira com ambas as armas equipadas simultaneamente',
      'Customização de Perfil: Adicionada opção de mudar a cor do nome de exibição',
      'Sistema de Doação PIX: Implementado na tela de login para suporte ao projeto',
      'Melhoria de UI: Aumento de fontes no inventário para melhor legibilidade',
      'Mecânica de Dano: Splash damage (explosivos) e tiros atravessantes (railgun)',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-03-11',
    changes: [
      'Mapa vetorial SVG baseado na geometria real das ruas (Overpass API)',
      'Visual procedural apocalíptico: rachaduras, poças, matos e carros enferrujados',
      'Expansão massiva automática de mapa (cobertura estendida para 40km² ao redor)',
      'Descarte de renderização SVG fora do campo de visão (Culling) para FPS alto',
      'Last Lat/Lng atualizado no db e gerador de tile procedural inteligente sem reload',
      'Refatoramento de mapa para não instanciar tiles OSM mortos',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-03-11',
    changes: [
      'Auto-aim + auto-fire: atira no zumbi mais próximo automaticamente',
      'Sistema de spawn progressivo baseado no nível dos jogadores',
      'Mapa global na landing page (onde o mundo está sendo explorado)',
      'Stats reais na landing: zumbis mortos, tiles, players online',
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
