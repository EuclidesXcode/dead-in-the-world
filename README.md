# 🧟 DeadWorld

> Sobreviva. Explore. Domine.

Jogo de sobrevivência zumbi online multiplayer com mapa gerado pela localização real do jogador.

## 🎮 Como Jogar

| Plataforma | Movimento | Ataque |
|---|---|---|
| **PC** | WASD / setas | Clique no mapa |
| **Mobile** | Joystick virtual (toque e arraste) | Botão 🔫 |

**Atalhos:**
- `I` — Inventário
- `M` — Mapa
- `C` — Personalizar personagem
- `U` — Upgrades de arma
- `T` — Chat global
- `L` — Ranking

## 🏗️ Tech Stack

- **Frontend:** Next.js 14 + React + TypeScript
- **Estilo:** Tailwind CSS + CSS puro (pixel art)
- **Backend/DB:** Supabase (PostgreSQL + Realtime + Auth)
- **Autenticação:** Google OAuth via Supabase
- **Mapa:** Geolocalização real + geração procedural por seed

## 🚀 Setup local

```bash
# 1. Instale dependências
npm install

# 2. Configure variáveis de ambiente
cp .env.local.example .env.local
# Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Execute o schema no Supabase
# Cole o conteúdo de supabase/schema.sql no Supabase SQL Editor

# 4. Configure Google OAuth no Supabase
# Dashboard → Authentication → Providers → Google

# 5. Rode em dev
npm run dev
```

## 📁 Estrutura

```
app/
  page.tsx              → Landing page / Login
  game/page.tsx         → Jogo principal
  auth/callback/page.tsx → OAuth callback
components/
  GameCanvas.tsx        → Canvas + game loop
  PlayerSprite.tsx      → Personagem em CSS pixel art
  ZombieSprite.tsx      → 4 tipos de zumbi em CSS
  HUD.tsx               → Interface durante o jogo
  Inventory.tsx         → Inventário com itens
  Leaderboard.tsx       → Ranking global
  CharacterCustomizer.tsx → Personalização do personagem
  WeaponUpgrade.tsx     → Upgrades de arma
  Chat.tsx              → Chat global em tempo real
  TouchControls.tsx     → Controles mobile (joystick)
  Notifications.tsx     → Sistema de notificações
lib/
  supabase.ts           → Cliente Supabase + tipos
  store.ts              → State global (Zustand)
  mapGenerator.ts       → Geração procedural de mapa
  combat.ts             → Sistema de combate
  loot.ts               → Sistema de loot e itens
  version.ts            → Controle de versão (SemVer)
supabase/
  schema.sql            → Schema completo do banco
```

## 🗺️ Sistema de Mapa

- Cada **tile = 50m × 50m** no mundo real
- Gerado via **seed determinístico** baseado em lat/lng
- Tipos de tile: `rua`, `prédio`, `hospital`, `mercado`, `base militar`, `floresta`, `rio`, `ruínas`, `abandonado`
- Cada tipo tem tabela de loot própria
- Tiles explorados ficam **permanentes no banco** — visíveis para todos

## 🧟 Tipos de Zumbi

| Tipo | HP | Dano | Velocidade | XP |
|---|---|---|---|---|
| **Walker** | 50 | 8 | Lento | 10 |
| **Runner** | 30 | 12 | Rápido | 18 |
| **Tank** | 250 | 25 | Muito lento | 50 |
| **Screamer** | 40 | 5 | Médio | 30 |

## 📦 Versioning

Usando **Semantic Versioning**: `MAJOR.MINOR.PATCH`

| Tipo | Quando | Exemplo |
|---|---|---|
| `PATCH` | Bug fix, ajuste visual | `0.1.0 → 0.1.1` |
| `MINOR` | Nova feature, novo sistema | `0.1.0 → 0.2.0` |
| `MAJOR` | Mudança grande / lançamento | `0.x.x → 1.0.0` |

Versão atual: **v0.1.0 Alpha** — ver [`lib/version.ts`](lib/version.ts)
