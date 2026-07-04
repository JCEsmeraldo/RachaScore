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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- profiles
-- ============================================================

create policy "usuario ve proprio perfil" on profiles
  for select to authenticated
  using (id = auth.uid());

create policy "usuario atualiza proprio perfil" on profiles
  for update to authenticated
  using (id = auth.uid());

-- ============================================================
-- grupos
-- ============================================================

create policy "membros veem grupo" on grupos
  for select to authenticated
  using (public.is_membro_grupo(id));

create policy "autenticado cria grupo" on grupos
  for insert to authenticated
  with check (dono_id = auth.uid());

create policy "dono edita grupo" on grupos
  for update to authenticated
  using (dono_id = auth.uid());

create policy "dono apaga grupo" on grupos
  for delete to authenticated
  using (dono_id = auth.uid());

-- ============================================================
-- jogadores
-- ============================================================

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

create policy "autenticado cria jogador" on jogadores
  for insert to authenticated
  with check (true);

create policy "dono ou proprio atualiza jogador" on jogadores
  for update to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from membros_grupo mg
      where mg.jogador_id = jogadores.id and public.is_dono_grupo(mg.grupo_id)
    )
  );

create policy "dono remove jogador" on jogadores
  for delete to authenticated
  using (
    exists (
      select 1 from membros_grupo mg
      where mg.jogador_id = jogadores.id and public.is_dono_grupo(mg.grupo_id)
    )
  );

-- ============================================================
-- membros_grupo
-- ============================================================

create policy "membros veem lista do grupo" on membros_grupo
  for select to authenticated
  using (public.is_membro_grupo(grupo_id));

create policy "dono adiciona membro" on membros_grupo
  for insert to authenticated
  with check (public.is_dono_grupo(grupo_id));

create policy "dono remove membro" on membros_grupo
  for delete to authenticated
  using (public.is_dono_grupo(grupo_id));

-- ============================================================
-- rachas
-- ============================================================

create policy "membros veem racha" on rachas
  for select to authenticated
  using (public.is_membro_grupo(grupo_id));

create policy "dono cria racha" on rachas
  for insert to authenticated
  with check (public.is_dono_grupo(grupo_id));

create policy "dono edita racha" on rachas
  for update to authenticated
  using (public.is_dono_grupo(grupo_id));

create policy "dono apaga racha" on rachas
  for delete to authenticated
  using (public.is_dono_grupo(grupo_id));

-- ============================================================
-- times
-- ============================================================

create policy "membros veem times" on times
  for select to authenticated
  using (public.is_membro_grupo(public.grupo_da_racha(racha_id)));

create policy "dono gerencia times (insert)" on times
  for insert to authenticated
  with check (public.is_dono_grupo(public.grupo_da_racha(racha_id)));

create policy "dono gerencia times (update)" on times
  for update to authenticated
  using (public.is_dono_grupo(public.grupo_da_racha(racha_id)));

create policy "dono gerencia times (delete)" on times
  for delete to authenticated
  using (public.is_dono_grupo(public.grupo_da_racha(racha_id)));

-- ============================================================
-- presencas_racha
-- ============================================================

create policy "membros veem presenca" on presencas_racha
  for select to authenticated
  using (public.is_membro_grupo(public.grupo_da_racha(racha_id)));

create policy "dono marca presenca (insert)" on presencas_racha
  for insert to authenticated
  with check (public.is_dono_grupo(public.grupo_da_racha(racha_id)));

create policy "dono marca presenca (update)" on presencas_racha
  for update to authenticated
  using (public.is_dono_grupo(public.grupo_da_racha(racha_id)));

create policy "dono marca presenca (delete)" on presencas_racha
  for delete to authenticated
  using (public.is_dono_grupo(public.grupo_da_racha(racha_id)));

-- ============================================================
-- partidas
-- ============================================================

create policy "membros veem partidas" on partidas
  for select to authenticated
  using (public.is_membro_grupo(public.grupo_da_racha(racha_id)));

create policy "dono gerencia partidas (insert)" on partidas
  for insert to authenticated
  with check (public.is_dono_grupo(public.grupo_da_racha(racha_id)));

create policy "dono gerencia partidas (update)" on partidas
  for update to authenticated
  using (public.is_dono_grupo(public.grupo_da_racha(racha_id)));

create policy "dono gerencia partidas (delete)" on partidas
  for delete to authenticated
  using (public.is_dono_grupo(public.grupo_da_racha(racha_id)));

-- ============================================================
-- sets
-- ============================================================

create policy "membros veem sets" on sets
  for select to authenticated
  using (public.is_membro_grupo(public.grupo_da_partida(partida_id)));

create policy "dono gerencia sets (insert)" on sets
  for insert to authenticated
  with check (public.is_dono_grupo(public.grupo_da_partida(partida_id)));

create policy "dono gerencia sets (update)" on sets
  for update to authenticated
  using (public.is_dono_grupo(public.grupo_da_partida(partida_id)));

create policy "dono gerencia sets (delete)" on sets
  for delete to authenticated
  using (public.is_dono_grupo(public.grupo_da_partida(partida_id)));

-- ============================================================
-- eventos_ponto
-- ============================================================

create policy "membros veem eventos de ponto" on eventos_ponto
  for select to authenticated
  using (public.is_membro_grupo(public.grupo_da_partida(partida_id)));

create policy "dono lanca ponto (insert)" on eventos_ponto
  for insert to authenticated
  with check (public.is_dono_grupo(public.grupo_da_partida(partida_id)));

create policy "dono lanca ponto (update)" on eventos_ponto
  for update to authenticated
  using (public.is_dono_grupo(public.grupo_da_partida(partida_id)));

create policy "dono lanca ponto (delete)" on eventos_ponto
  for delete to authenticated
  using (public.is_dono_grupo(public.grupo_da_partida(partida_id)));
