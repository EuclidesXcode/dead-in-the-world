-- =====================================================
-- DeadWorld - Schema completo do banco de dados
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABELA: players
-- =====================================================
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  
  -- Stats do personagem
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  xp_to_next INTEGER DEFAULT 100,
  
  -- Atributos
  max_health INTEGER DEFAULT 100,
  current_health INTEGER DEFAULT 100,
  max_stamina INTEGER DEFAULT 100,
  current_stamina INTEGER DEFAULT 100,
  strength INTEGER DEFAULT 5,
  agility INTEGER DEFAULT 5,
  precision_stat INTEGER DEFAULT 5,
  
  -- Personalização do personagem
  skin_color TEXT DEFAULT '#FFDBAC',
  hair_color TEXT DEFAULT '#3D2B1F',
  shirt_color TEXT DEFAULT '#1a1a2e',
  pants_color TEXT DEFAULT '#2d2d44',
  
  -- Posição no mapa
  last_lat DOUBLE PRECISION DEFAULT 0,
  last_lng DOUBLE PRECISION DEFAULT 0,
  tile_x INTEGER DEFAULT 0,
  tile_y INTEGER DEFAULT 0,
  
  -- Estatísticas de jogo
  kills INTEGER DEFAULT 0,
  tiles_explored INTEGER DEFAULT 0,
  items_collected INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  
  -- Status
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: inventory
-- =====================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  
  item_type TEXT NOT NULL, -- 'weapon', 'ammo', 'heal', 'food', 'water', 'upgrade', 'material'
  item_id TEXT NOT NULL,   -- identificador do item (ex: 'pistol', 'bandage', 'rifle')
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  weight FLOAT DEFAULT 1.0,
  
  -- Para armas
  durability INTEGER DEFAULT 100,
  upgrades JSONB DEFAULT '[]'::jsonb, -- lista de upgrades aplicados
  equipped BOOLEAN DEFAULT false,
  
  -- Metadata
  rarity TEXT DEFAULT 'common', -- common, uncommon, rare, epic, legendary
  stats JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: map_tiles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.map_tiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Coordenadas do tile
  tile_x INTEGER NOT NULL,
  tile_y INTEGER NOT NULL,
  
  -- Coordenadas geográficas do centro do tile
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  
  -- Tipo do tile
  tile_type TEXT NOT NULL DEFAULT 'street',
  -- Tipos: street, building, hospital, market, military_base, forest, river, ruins, abandoned
  
  -- Estado do tile
  explored_by UUID REFERENCES public.players(id),
  explored_at TIMESTAMPTZ,
  
  -- Loot do tile
  has_loot BOOLEAN DEFAULT true,
  loot_collected BOOLEAN DEFAULT false,
  last_loot_spawn TIMESTAMPTZ DEFAULT NOW(),
  
  -- Zumbis
  zombie_density INTEGER DEFAULT 1, -- 1-5
  
  -- Metadata procedural
  seed_value BIGINT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tile_x, tile_y)
);

-- =====================================================
-- TABELA: zombies (zumbis ativos no mundo)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.zombies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  tile_x INTEGER NOT NULL,
  tile_y INTEGER NOT NULL,
  
  -- Posição exata dentro do tile
  pos_x FLOAT NOT NULL DEFAULT 0,
  pos_y FLOAT NOT NULL DEFAULT 0,
  
  -- Tipo do zumbi
  zombie_type TEXT NOT NULL DEFAULT 'walker',
  -- Tipos: walker, runner, tank, screamer
  
  -- Stats
  max_health INTEGER NOT NULL,
  current_health INTEGER NOT NULL,
  damage INTEGER NOT NULL,
  speed FLOAT NOT NULL,
  xp_reward INTEGER NOT NULL,
  
  -- Estado
  is_alive BOOLEAN DEFAULT true,
  target_player_id UUID REFERENCES public.players(id),
  
  -- Direção de movimento (em graus)
  direction FLOAT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: world_items (itens no chão do mundo)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.world_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  tile_x INTEGER NOT NULL,
  tile_y INTEGER NOT NULL,
  pos_x FLOAT NOT NULL DEFAULT 0,
  pos_y FLOAT NOT NULL DEFAULT 0,
  
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  weight FLOAT DEFAULT 1.0,
  rarity TEXT DEFAULT 'common',
  stats JSONB DEFAULT '{}'::jsonb,
  
  -- O item desaparece depois de um tempo
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 hours'),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: kill_log (log de mortes)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.kill_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  zombie_type TEXT NOT NULL,
  zombie_id UUID,
  tile_x INTEGER,
  tile_y INTEGER,
  xp_gained INTEGER DEFAULT 0,
  weapon_used TEXT,
  
  killed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: game_events (eventos do jogo em tempo real)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.game_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  event_type TEXT NOT NULL,
  -- Tipos: player_join, player_leave, player_kill, horde_spawn, rare_item, player_death, tile_discovered
  
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  
  tile_x INTEGER,
  tile_y INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: chat_messages
-- =====================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  player_name TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Tipo de mensagem
  msg_type TEXT DEFAULT 'global', -- global, system, action
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: leaderboard (view materializada)
-- =====================================================
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  p.kills,
  p.tiles_explored,
  p.xp,
  p.skin_color,
  p.shirt_color,
  RANK() OVER (ORDER BY p.kills DESC) as kill_rank,
  RANK() OVER (ORDER BY p.level DESC, p.xp DESC) as level_rank,
  RANK() OVER (ORDER BY p.tiles_explored DESC) as explorer_rank
FROM public.players p
ORDER BY p.kills DESC;

-- =====================================================
-- FUNÇÕES E TRIGGERS
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para players
CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger para inventory  
CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger para zombies
CREATE TRIGGER zombies_updated_at
  BEFORE UPDATE ON public.zombies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Função para calcular XP necessário para próximo nível
CREATE OR REPLACE FUNCTION calculate_xp_to_next(level_num INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN FLOOR(100 * POWER(1.5, level_num - 1));
END;
$$ LANGUAGE plpgsql;

-- Função para verificar e subir de nível
CREATE OR REPLACE FUNCTION check_level_up(player_uuid UUID)
RETURNS VOID AS $$
DECLARE
  p RECORD;
BEGIN
  SELECT * INTO p FROM public.players WHERE id = player_uuid;
  
  WHILE p.xp >= p.xp_to_next LOOP
    UPDATE public.players
    SET 
      xp = xp - xp_to_next,
      level = level + 1,
      xp_to_next = calculate_xp_to_next(level + 1),
      max_health = max_health + 10,
      current_health = max_health + 10,
      max_stamina = max_stamina + 5,
      strength = strength + 1,
      agility = agility + 1,
      precision_stat = precision_stat + 1
    WHERE id = player_uuid
    RETURNING * INTO p;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função para spawnar loot baseado no tipo do tile
CREATE OR REPLACE FUNCTION spawn_tile_loot(tile_type_param TEXT, tile_x_param INTEGER, tile_y_param INTEGER)
RETURNS VOID AS $$
DECLARE
  loot_count INTEGER;
  item_data JSONB;
  items_for_type JSONB;
BEGIN
  -- Define quantidade de loot por tipo de tile
  CASE tile_type_param
    WHEN 'hospital' THEN loot_count := 4;
    WHEN 'military_base' THEN loot_count := 5;
    WHEN 'market' THEN loot_count := 3;
    WHEN 'building' THEN loot_count := 2;
    WHEN 'ruins' THEN loot_count := 2;
    WHEN 'forest' THEN loot_count := 1;
    ELSE loot_count := 1;
  END CASE;

  -- Insere itens de loot (simplificado - o frontend gera os detalhes)
  FOR i IN 1..loot_count LOOP
    INSERT INTO public.world_items (
      tile_x, tile_y, pos_x, pos_y,
      item_type, item_id, item_name, quantity, rarity
    ) VALUES (
      tile_x_param, tile_y_param,
      (RANDOM() * 400 + 50)::FLOAT,
      (RANDOM() * 400 + 50)::FLOAT,
      'placeholder', 'placeholder', 'placeholder', 1, 'common'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_tiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zombies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kill_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies para players
CREATE POLICY "Players são visíveis para todos autenticados"
  ON public.players FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Somente o próprio player pode atualizar"
  ON public.players FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Criação de player pelo próprio usuário"
  ON public.players FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policies para inventory
CREATE POLICY "Inventory visível para o dono"
  ON public.inventory FOR ALL
  TO authenticated
  USING (player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid()));

-- Policies para map_tiles (todos podem ver e criar tiles)
CREATE POLICY "Tiles visíveis para todos"
  ON public.map_tiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Qualquer um pode criar tile"
  ON public.map_tiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar tile"
  ON public.map_tiles FOR UPDATE
  TO authenticated
  USING (true);

-- Policies para zombies
CREATE POLICY "Zombies visíveis para todos"
  ON public.zombies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Zombies podem ser criados"
  ON public.zombies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Zombies podem ser atualizados"
  ON public.zombies FOR UPDATE
  TO authenticated
  USING (true);

-- Policies para world_items
CREATE POLICY "Items do mundo visíveis para todos"
  ON public.world_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Items podem ser criados"
  ON public.world_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Items podem ser deletados (coletados)"
  ON public.world_items FOR DELETE
  TO authenticated
  USING (true);

-- Policies para kill_log
CREATE POLICY "Kill log visível para todos"
  ON public.kill_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Kill log inserido pelo próprio player"
  ON public.kill_log FOR INSERT
  TO authenticated
  WITH CHECK (player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid()));

-- Policies para game_events
CREATE POLICY "Eventos visíveis para todos"
  ON public.game_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Eventos inseridos por autenticados"
  ON public.game_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies para chat
CREATE POLICY "Chat visível para todos"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Chat inserido pelo próprio player"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid()));

-- =====================================================
-- HABILITAR REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_tiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.zombies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.world_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_online ON public.players(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_inventory_player ON public.inventory(player_id);
CREATE INDEX IF NOT EXISTS idx_map_tiles_coords ON public.map_tiles(tile_x, tile_y);
CREATE INDEX IF NOT EXISTS idx_zombies_tile ON public.zombies(tile_x, tile_y) WHERE is_alive = true;
CREATE INDEX IF NOT EXISTS idx_world_items_tile ON public.world_items(tile_x, tile_y);
CREATE INDEX IF NOT EXISTS idx_kill_log_player ON public.kill_log(player_id);
CREATE INDEX IF NOT EXISTS idx_game_events_created ON public.game_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_created ON public.chat_messages(created_at DESC);
