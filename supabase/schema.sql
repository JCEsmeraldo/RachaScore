-- RachaScore — schema Supabase (Postgres)
-- Modalidades: futebol, volei | Modos: torneio, rapido

create extension if not exists "pgcrypto";

-- Perfis de usuário (espelha auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

-- Grupo fixo de amigos
create table grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dono_id uuid not null references profiles(id),
  convite_token uuid not null default gen_random_uuid() unique, -- link de convite; regenerar invalida o link antigo
  created_at timestamptz not null default now()
);

-- Jogador: pode ou não ter conta vinculada
create table jogadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  user_id uuid references profiles(id),
  email text, -- convite pendente: linkado ao user_id automaticamente no signup (ver handle_new_user)
  created_at timestamptz not null default now()
);

-- Vínculo permanente jogador <-> grupo (fixo)
create table membros_grupo (
  grupo_id uuid not null references grupos(id) on delete cascade,
  jogador_id uuid not null references jogadores(id) on delete cascade,
  is_admin boolean not null default false, -- mesmos poderes do dono, exceto apagar o grupo
  created_at timestamptz not null default now(),
  primary key (grupo_id, jogador_id)
);

-- Racha (evento)
create table rachas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  modalidade text not null check (modalidade in ('futebol', 'volei')),
  modo text not null check (modo in ('torneio', 'rapido')),
  tamanho_equipe int not null check (tamanho_equipe > 0),
  -- config flexível por modalidade:
  -- futebol: {"minutos": 10, "gols": 5} — ao menos um; com os dois, vale o que bater primeiro
  -- volei:   {"num_sets": 3, "pontos_set": 25}
  config jsonb not null default '{}',
  data_hora timestamptz not null,
  local text,
  limite_jogadores int, -- null = sem limite; acima disso, presença entra em lista de espera
  created_at timestamptz not null default now()
);

-- Times formados dentro de um racha (recriados a cada racha)
create table times (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references rachas(id) on delete cascade,
  nome text not null,
  sorteio boolean not null default false, -- time gerado pelo "Sortear" (não pode ser apagado na tela Times)
  created_at timestamptz not null default now()
);

-- Presença por racha (fixo confirma presença / avulso entra só aqui) + time do dia
create table presencas_racha (
  racha_id uuid not null references rachas(id) on delete cascade,
  jogador_id uuid not null references jogadores(id) on delete cascade,
  status text not null default 'confirmado' check (status in ('confirmado', 'espera', 'ausente')),
  time_id uuid references times(id),
  created_at timestamptz not null default now(),
  pediu_vaga_em timestamptz not null default now(), -- atualizado toda vez que pede presença; ordena a fila de espera
  primary key (racha_id, jogador_id)
);

-- Partida dentro do racha
create table partidas (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references rachas(id) on delete cascade,
  time_a_id uuid not null references times(id),
  time_b_id uuid not null references times(id),
  status text not null default 'agendada' check (status in ('agendada', 'em_andamento', 'finalizada')),
  placar_a int not null default 0,
  placar_b int not null default 0,
  vencedor_id uuid references times(id),
  -- cronômetro do futebol: segundos acumulados até cronometro_atualizado_em, mais o
  -- tempo real decorrido desde então se cronometro_rodando (calculado no cliente)
  cronometro_segundos int not null default 0,
  cronometro_rodando boolean not null default false,
  cronometro_atualizado_em timestamptz,
  created_at timestamptz not null default now()
);

-- Sets (só volei)
create table sets (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references partidas(id) on delete cascade,
  numero int not null,
  placar_a int not null default 0,
  placar_b int not null default 0,
  vencedor_id uuid references times(id),
  created_at timestamptz not null default now(),
  unique (partida_id, numero)
);

-- Evento de ponto/gol (granular)
create table eventos_ponto (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references partidas(id) on delete cascade,
  set_id uuid references sets(id) on delete cascade, -- só volei
  time_id uuid not null references times(id), -- time que ganhou o ponto
  jogador_id uuid references jogadores(id), -- opcional: nem todo ponto tem autor (ex: erro adversário no vôlei)
  assistencia_jogador_id uuid references jogadores(id), -- opcional, só futebol
  motivo text check (motivo in ('ataque', 'bloqueio', 'saque', 'erro_adversario', 'outro')),
  created_at timestamptz not null default now()
);

-- Cartão (só futebol) — registro avulso, não afeta placar nem escalação
create table cartoes (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references partidas(id) on delete cascade,
  jogador_id uuid not null references jogadores(id) on delete cascade,
  tipo text not null check (tipo in ('amarelo', 'vermelho')),
  created_at timestamptz not null default now()
);

-- Avaliação de jogador por jogador, por racha (1 a 5). Só quem confirmou
-- presença pode avaliar, só de quem também confirmou, nunca de si mesmo — tudo
-- validado na RPC avaliar_jogadores (ver policies.sql), não direto na tabela.
create table avaliacoes (
  racha_id uuid not null references rachas(id) on delete cascade,
  avaliador_jogador_id uuid not null references jogadores(id) on delete cascade,
  avaliado_jogador_id uuid not null references jogadores(id) on delete cascade,
  nota int not null check (nota between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (racha_id, avaliador_jogador_id, avaliado_jogador_id),
  check (avaliador_jogador_id <> avaliado_jogador_id)
);

-- Escalação por partida (só modo rápido): quem joga em qual time NAQUELA
-- partida específica, sem prender o jogador ao time do racha inteiro (torneio
-- continua usando presencas_racha.time_id, fixo pro racha, pra classificação
-- fazer sentido).
create table escalacoes_partida (
  partida_id uuid not null references partidas(id) on delete cascade,
  jogador_id uuid not null references jogadores(id) on delete cascade,
  time_id uuid not null references times(id),
  primary key (partida_id, jogador_id)
);

-- View: classificação do torneio (calculada, não armazenada)
-- security_invoker: sem isso a view roda com privilégio de quem criou (postgres),
-- ignorando RLS das tabelas base — vazaria classificação de racha de outros grupos.
create view classificacao_racha
with (security_invoker = true)
as
select
  p.racha_id,
  t.id as time_id,
  t.nome as time_nome,
  count(*) filter (where p.status = 'finalizada') as jogos,
  count(*) filter (where p.vencedor_id = t.id) as vitorias,
  count(*) filter (
    where p.status = 'finalizada'
      and p.vencedor_id is null
      and r.modalidade = 'futebol'
  ) as empates,
  count(*) filter (
    where p.status = 'finalizada'
      and p.vencedor_id is not null
      and p.vencedor_id <> t.id
  ) as derrotas,
  sum(case when t.id = p.time_a_id then p.placar_a else p.placar_b end) as feitos,
  sum(case when t.id = p.time_a_id then p.placar_b else p.placar_a end) as sofridos,
  sum(case when t.id = p.time_a_id then p.placar_a else p.placar_b end)
    - sum(case when t.id = p.time_a_id then p.placar_b else p.placar_a end) as saldo,
  (
    count(*) filter (where p.vencedor_id = t.id) * 3
    + count(*) filter (
        where p.status = 'finalizada'
          and p.vencedor_id is null
          and r.modalidade = 'futebol'
      ) * 1
  ) as pontos
from times t
join rachas r on r.id = t.racha_id
join partidas p on p.racha_id = t.racha_id
  and (p.time_a_id = t.id or p.time_b_id = t.id)
  and p.status = 'finalizada'
group by p.racha_id, t.id, t.nome;

-- RLS: habilitar em todas (policies detalhadas ficam pra próxima etapa, junto com fluxo de auth)
alter table profiles enable row level security;
alter table grupos enable row level security;
alter table jogadores enable row level security;
alter table membros_grupo enable row level security;
alter table rachas enable row level security;
alter table times enable row level security;
alter table presencas_racha enable row level security;
alter table partidas enable row level security;
alter table sets enable row level security;
alter table eventos_ponto enable row level security;
alter table escalacoes_partida enable row level security;
alter table avaliacoes enable row level security;
alter table cartoes enable row level security;

-- Tabelas criadas via SQL Editor não ganham GRANT automático pros roles do PostgREST
-- (diferente de tabelas criadas pelo Table Editor). RLS restringe linhas, mas sem
-- esse GRANT o acesso é negado por completo antes mesmo da RLS entrar em jogo.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Realtime: placar/cronômetro precisam sincronizar entre dispositivos vendo a
-- mesma partida ao vivo. Sem isso o client não recebe updates de outro device.
alter publication supabase_realtime add table partidas;
alter publication supabase_realtime add table sets;
