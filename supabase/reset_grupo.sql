-- Reseta um grupo: apaga todos os rachas (e cascata: times, presencas_racha,
-- partidas, sets, eventos_ponto, escalacoes_partida). Mantém intocado: grupos,
-- membros_grupo, jogadores, profiles.
-- Troca v_grupo_id abaixo e roda no SQL Editor do Supabase.

do $$
declare
  v_grupo_id uuid := '00000000-0000-0000-0000-000000000000'; -- <-- troca aqui
begin
  delete from eventos_ponto
  where partida_id in (
    select id from partidas where racha_id in (
      select id from rachas where grupo_id = v_grupo_id
    )
  );

  delete from escalacoes_partida
  where partida_id in (
    select id from partidas where racha_id in (
      select id from rachas where grupo_id = v_grupo_id
    )
  );

  delete from sets
  where partida_id in (
    select id from partidas where racha_id in (
      select id from rachas where grupo_id = v_grupo_id
    )
  );

  delete from partidas
  where racha_id in (select id from rachas where grupo_id = v_grupo_id);

  delete from presencas_racha
  where racha_id in (select id from rachas where grupo_id = v_grupo_id);

  delete from times
  where racha_id in (select id from rachas where grupo_id = v_grupo_id);

  delete from rachas
  where grupo_id = v_grupo_id;
end $$;
