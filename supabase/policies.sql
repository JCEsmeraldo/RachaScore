-- RachaScore — RLS policies
-- Rodar depois de schema.sql. Todas as tabelas exigem usuário autenticado (role authenticated).

-- ============================================================
-- Funções auxiliares (security definer p/ evitar recursão de RLS
-- entre grupos/membros_grupo/jogadores)
-- ============================================================

create or replace function public.is_dono_grupo(p_grupo_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from grupos g
    where g.id = p_grupo_id and g.dono_id = auth.uid()
  );
$$;

create or replace function public.is_membro_grupo(p_grupo_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_dono_grupo(p_grupo_id)
    or exists (
      select 1
      from membros_grupo mg
      join jogadores j on j.id = mg.jogador_id
      where mg.grupo_id = p_grupo_id and j.user_id = auth.uid()
    );
$$;

-- Organizador = dono OU membro marcado como admin. Tem os mesmos poderes do
-- dono em tudo, exceto apagar o grupo (fica travado em is_dono_grupo direto).
create or replace function public.is_organizador_grupo(p_grupo_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_dono_grupo(p_grupo_id)
    or exists (
      select 1
      from membros_grupo mg
      join jogadores j on j.id = mg.jogador_id
      where mg.grupo_id = p_grupo_id and j.user_id = auth.uid() and mg.is_admin
    );
$$;

create or replace function public.grupo_da_racha(p_racha_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select grupo_id from rachas where id = p_racha_id;
$$;

create or replace function public.grupo_da_partida(p_partida_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select r.grupo_id
  from partidas p
  join rachas r on r.id = p.racha_id
  where p.id = p_partida_id;
$$;

-- ============================================================
-- Trigger: cria profile automaticamente no signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email));

  -- linka convites pendentes: jogador cadastrado por e-mail antes da pessoa ter conta
  update jogadores
  set user_id = new.id
  where email = new.email and user_id is null;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RPC: adicionar membro avulso (jogador sem conta) ao grupo
-- ============================================================
-- Um INSERT com RETURNING (o .select() do supabase-js) reaplica a policy de
-- SELECT na linha recém-criada. Jogador avulso ainda não tem user_id nem
-- membros_grupo no momento do insert, então a policy de SELECT nega a
-- visibilidade — e o Postgres transforma isso no mesmo erro de RLS do INSERT.
-- Função security definer resolve inserindo jogador + vínculo atomicamente,
-- sem passar pelas policies (mesma lógica das funções is_dono_grupo etc.).

-- Assinatura antiga (2 args) fica de fora do overload novo (3 args) — remove.
drop function if exists public.adicionar_membro_grupo(uuid, text);

create or replace function public.adicionar_membro_grupo(p_grupo_id uuid, p_nome text, p_email text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jogador_id uuid;
  v_user_id uuid;
begin
  if not public.is_organizador_grupo(p_grupo_id) then
    raise exception 'Somente o dono ou admin do grupo pode adicionar membros';
  end if;

  if p_email is not null then
    -- e-mail já tem conta? linka na hora em vez de esperar o trigger de signup
    select id into v_user_id from auth.users where email = p_email limit 1;
    -- reaproveita jogador existente se o e-mail já foi convidado antes (em outro grupo, por ex)
    select id into v_jogador_id from jogadores where email = p_email limit 1;
  end if;

  if v_jogador_id is not null then
    if v_user_id is not null then
      update jogadores set user_id = v_user_id where id = v_jogador_id and user_id is null;
    end if;
  else
    insert into jogadores (nome, email, user_id) values (p_nome, p_email, v_user_id)
    returning id into v_jogador_id;
  end if;

  insert into membros_grupo (grupo_id, jogador_id) values (p_grupo_id, v_jogador_id)
  on conflict do nothing;

  return v_jogador_id;
end;
$$;

grant execute on function public.adicionar_membro_grupo(uuid, text, text) to authenticated;

-- ============================================================
-- RPC: link de convite (compartilhar grupo em vez de convidar 1 a 1)
-- ============================================================

-- Pré-visualização do convite: precisa funcionar pra quem ainda não tem
-- login (vê "convite pra grupo X" antes de criar conta), por isso libera pro
-- role anon também. Só devolve id+nome, nada sensível.
create or replace function public.preview_convite(p_token uuid)
returns table(grupo_id uuid, grupo_nome text)
language sql
security definer
set search_path = public
stable
as $$
  select id, nome from grupos where convite_token = p_token;
$$;

grant execute on function public.preview_convite(uuid) to anon, authenticated;

-- Entrar no grupo via link: cria (ou reaproveita) o jogador do usuário logado
-- e vincula ao grupo. Roda como security definer pq quem entra ainda não é
-- organizador — só o token válido autoriza a entrada, não a policy normal
-- de membros_grupo.
create or replace function public.entrar_no_grupo(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id uuid;
  v_jogador_id uuid;
  v_nome text;
begin
  if auth.uid() is null then
    raise exception 'Precisa estar logado pra entrar no grupo';
  end if;

  select id into v_grupo_id from grupos where convite_token = p_token;

  if v_grupo_id is null then
    raise exception 'Convite inválido';
  end if;

  select id into v_jogador_id from jogadores where user_id = auth.uid();

  if v_jogador_id is null then
    select nome into v_nome from profiles where id = auth.uid();
    insert into jogadores (nome, user_id) values (coalesce(v_nome, 'Jogador'), auth.uid())
    returning id into v_jogador_id;
  end if;

  insert into membros_grupo (grupo_id, jogador_id) values (v_grupo_id, v_jogador_id)
  on conflict do nothing;

  return v_grupo_id;
end;
$$;

grant execute on function public.entrar_no_grupo(uuid) to authenticated;

-- ============================================================
-- profiles
-- ============================================================

drop policy if exists "usuario ve proprio perfil" on profiles;
create policy "usuario ve proprio perfil" on profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "usuario atualiza proprio perfil" on profiles;
create policy "usuario atualiza proprio perfil" on profiles
  for update to authenticated
  using (id = auth.uid());

-- ============================================================
-- grupos
-- ============================================================

drop policy if exists "membros veem grupo" on grupos;
create policy "membros veem grupo" on grupos
  for select to authenticated
  using (public.is_membro_grupo(id));

drop policy if exists "autenticado cria grupo" on grupos;
create policy "autenticado cria grupo" on grupos
  for insert to authenticated
  with check (dono_id = auth.uid());

drop policy if exists "dono edita grupo" on grupos;
create policy "dono edita grupo" on grupos
  for update to authenticated
  using (public.is_organizador_grupo(id));

drop policy if exists "dono apaga grupo" on grupos;
create policy "dono apaga grupo" on grupos
  for delete to authenticated
  using (dono_id = auth.uid());

-- Admin pode editar o grupo (via policy acima), mas não transferir a posse:
-- só o dono atual pode mudar dono_id.
create or replace function public.proteger_dono_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.dono_id <> old.dono_id and old.dono_id <> auth.uid() then
    raise exception 'Somente o dono atual pode transferir a posse do grupo';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_dono_grupo_trigger on grupos;
create trigger proteger_dono_grupo_trigger
  before update on grupos
  for each row execute function public.proteger_dono_grupo();

-- ============================================================
-- jogadores
-- ============================================================

drop policy if exists "ve jogadores dos proprios grupos" on jogadores;
create policy "ve jogadores dos proprios grupos" on jogadores
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from membros_grupo mg
      where mg.jogador_id = jogadores.id and public.is_membro_grupo(mg.grupo_id)
    )
    or exists (
      select 1 from presencas_racha pr
      join rachas r on r.id = pr.racha_id
      where pr.jogador_id = jogadores.id and public.is_membro_grupo(r.grupo_id)
    )
  );

drop policy if exists "autenticado cria jogador" on jogadores;
create policy "autenticado cria jogador" on jogadores
  for insert to authenticated
  with check (true);

drop policy if exists "dono ou proprio atualiza jogador" on jogadores;
create policy "dono ou proprio atualiza jogador" on jogadores
  for update to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from membros_grupo mg
      where mg.jogador_id = jogadores.id and public.is_organizador_grupo(mg.grupo_id)
    )
  );

drop policy if exists "dono remove jogador" on jogadores;
create policy "dono remove jogador" on jogadores
  for delete to authenticated
  using (
    exists (
      select 1 from membros_grupo mg
      where mg.jogador_id = jogadores.id and public.is_organizador_grupo(mg.grupo_id)
    )
  );

-- ============================================================
-- membros_grupo
-- ============================================================

drop policy if exists "membros veem lista do grupo" on membros_grupo;
create policy "membros veem lista do grupo" on membros_grupo
  for select to authenticated
  using (public.is_membro_grupo(grupo_id));

drop policy if exists "dono adiciona membro" on membros_grupo;
create policy "dono adiciona membro" on membros_grupo
  for insert to authenticated
  with check (public.is_organizador_grupo(grupo_id));

drop policy if exists "dono remove membro" on membros_grupo;
create policy "dono remove membro" on membros_grupo
  for delete to authenticated
  using (public.is_organizador_grupo(grupo_id));

drop policy if exists "organizador promove/rebaixa admin" on membros_grupo;
create policy "organizador promove/rebaixa admin" on membros_grupo
  for update to authenticated
  using (public.is_organizador_grupo(grupo_id))
  with check (public.is_organizador_grupo(grupo_id));

-- ============================================================
-- rachas
-- ============================================================

drop policy if exists "membros veem racha" on rachas;
create policy "membros veem racha" on rachas
  for select to authenticated
  using (public.is_membro_grupo(grupo_id));

drop policy if exists "dono cria racha" on rachas;
create policy "dono cria racha" on rachas
  for insert to authenticated
  with check (public.is_organizador_grupo(grupo_id));

drop policy if exists "dono edita racha" on rachas;
create policy "dono edita racha" on rachas
  for update to authenticated
  using (public.is_organizador_grupo(grupo_id));

drop policy if exists "dono apaga racha" on rachas;
create policy "dono apaga racha" on rachas
  for delete to authenticated
  using (public.is_organizador_grupo(grupo_id));

-- ============================================================
-- times
-- ============================================================

drop policy if exists "membros veem times" on times;
create policy "membros veem times" on times
  for select to authenticated
  using (public.is_membro_grupo(public.grupo_da_racha(racha_id)));

drop policy if exists "dono gerencia times (insert)" on times;
create policy "dono gerencia times (insert)" on times
  for insert to authenticated
  with check (public.is_organizador_grupo(public.grupo_da_racha(racha_id)));

drop policy if exists "dono gerencia times (update)" on times;
create policy "dono gerencia times (update)" on times
  for update to authenticated
  using (public.is_organizador_grupo(public.grupo_da_racha(racha_id)));

drop policy if exists "dono gerencia times (delete)" on times;
create policy "dono gerencia times (delete)" on times
  for delete to authenticated
  using (public.is_organizador_grupo(public.grupo_da_racha(racha_id)));

-- ============================================================
-- presencas_racha
-- ============================================================

drop policy if exists "membros veem presenca" on presencas_racha;
create policy "membros veem presenca" on presencas_racha
  for select to authenticated
  using (public.is_membro_grupo(public.grupo_da_racha(racha_id)));

drop policy if exists "dono marca presenca (insert)" on presencas_racha;
create policy "dono marca presenca (insert)" on presencas_racha
  for insert to authenticated
  with check (public.is_organizador_grupo(public.grupo_da_racha(racha_id)));

drop policy if exists "dono marca presenca (update)" on presencas_racha;
create policy "dono marca presenca (update)" on presencas_racha
  for update to authenticated
  using (public.is_organizador_grupo(public.grupo_da_racha(racha_id)));

drop policy if exists "dono marca presenca (delete)" on presencas_racha;
create policy "dono marca presenca (delete)" on presencas_racha
  for delete to authenticated
  using (public.is_organizador_grupo(public.grupo_da_racha(racha_id)));

-- ============================================================
-- partidas
-- ============================================================

drop policy if exists "membros veem partidas" on partidas;
create policy "membros veem partidas" on partidas
  for select to authenticated
  using (public.is_membro_grupo(public.grupo_da_racha(racha_id)));

drop policy if exists "dono gerencia partidas (insert)" on partidas;
create policy "dono gerencia partidas (insert)" on partidas
  for insert to authenticated
  with check (public.is_organizador_grupo(public.grupo_da_racha(racha_id)));

drop policy if exists "dono gerencia partidas (update)" on partidas;
create policy "dono gerencia partidas (update)" on partidas
  for update to authenticated
  using (public.is_organizador_grupo(public.grupo_da_racha(racha_id)));

drop policy if exists "dono gerencia partidas (delete)" on partidas;
create policy "dono gerencia partidas (delete)" on partidas
  for delete to authenticated
  using (public.is_organizador_grupo(public.grupo_da_racha(racha_id)));

-- ============================================================
-- sets
-- ============================================================

drop policy if exists "membros veem sets" on sets;
create policy "membros veem sets" on sets
  for select to authenticated
  using (public.is_membro_grupo(public.grupo_da_partida(partida_id)));

drop policy if exists "dono gerencia sets (insert)" on sets;
create policy "dono gerencia sets (insert)" on sets
  for insert to authenticated
  with check (public.is_organizador_grupo(public.grupo_da_partida(partida_id)));

drop policy if exists "dono gerencia sets (update)" on sets;
create policy "dono gerencia sets (update)" on sets
  for update to authenticated
  using (public.is_organizador_grupo(public.grupo_da_partida(partida_id)));

drop policy if exists "dono gerencia sets (delete)" on sets;
create policy "dono gerencia sets (delete)" on sets
  for delete to authenticated
  using (public.is_organizador_grupo(public.grupo_da_partida(partida_id)));

-- ============================================================
-- eventos_ponto
-- ============================================================

drop policy if exists "membros veem eventos de ponto" on eventos_ponto;
create policy "membros veem eventos de ponto" on eventos_ponto
  for select to authenticated
  using (public.is_membro_grupo(public.grupo_da_partida(partida_id)));

drop policy if exists "dono lanca ponto (insert)" on eventos_ponto;
create policy "dono lanca ponto (insert)" on eventos_ponto
  for insert to authenticated
  with check (public.is_organizador_grupo(public.grupo_da_partida(partida_id)));

drop policy if exists "dono lanca ponto (update)" on eventos_ponto;
create policy "dono lanca ponto (update)" on eventos_ponto
  for update to authenticated
  using (public.is_organizador_grupo(public.grupo_da_partida(partida_id)));

drop policy if exists "dono lanca ponto (delete)" on eventos_ponto;
create policy "dono lanca ponto (delete)" on eventos_ponto
  for delete to authenticated
  using (public.is_organizador_grupo(public.grupo_da_partida(partida_id)));
