-- Massa fake de DEMO: 1 grupo, 5 jogadores, 1 racha de vôlei (modo rápido,
-- 1 set de 15) e 3 partidas finalizadas, com pontos, "sem autor" e erros por tipo.
-- Rodar no SQL Editor do Supabase. Troque v_email pelo e-mail da sua conta —
-- o grupo fica no seu nome (você é o dono) e aparece na tela "Meus grupos".
--
-- Jogos por jogador: Ana 3, Bruno 3, Davi 3, Carla 2, Eva 1 (Carla e Eva
-- aparecem esmaecidas na Média por jogo, por terem menos de 3 jogos).
-- Dados aleatórios, mas fixos (setseed): rodar de novo gera os mesmos números.
-- Rode UMA vez: de novo duplica o grupo (veja a limpeza no fim do arquivo).

do $$
declare
  v_email    text := 'SEU-EMAIL-AQUI';
  v_dono     uuid;
  v_grupo    uuid;
  v_racha    uuid;
  v_nomes    text[] := array['Ana Demo', 'Bruno Demo', 'Carla Demo', 'Davi Demo', 'Eva Demo'];
  v_jog      uuid[] := '{}';
  -- por partida: índices (em v_nomes) da dupla A (cols 1-2) e da dupla B (cols 3-4)
  v_duplas   int[][] := array[[1, 2, 3, 4], [1, 3, 2, 4], [1, 4, 2, 5]];
  -- placar do set por partida: {pontos A, pontos B}
  v_placares int[][] := array[[15, 12], [13, 15], [15, 9]];
  v_motivos  text[] := array['pinga', 'lob', 'corte', 'bloqueio', 'saque', 'outro'];
  v_tipos    text[] := array['saque', 'ataque_fora', 'ataque_rede', 'passe', 'toque_rede', 'conducao', 'outro'];
  v_id       uuid;
  v_time_a   uuid;
  v_time_b   uuid;
  v_time_pt  uuid;
  v_partida  uuid;
  v_set      uuid;
  v_venc     uuid;
  v_pa       int;
  v_pb       int;
  v_r        double precision;
  i int; p int; lado int; n int; e int;
begin
  select id into v_dono from auth.users where email = v_email;
  if v_dono is null then
    raise exception 'E-mail % não encontrado em auth.users — troque v_email', v_email;
  end if;

  perform setseed(0.42);

  insert into grupos (nome, dono_id) values ('DEMO - Grupo fake', v_dono) returning id into v_grupo;

  for i in 1 .. array_length(v_nomes, 1) loop
    insert into jogadores (nome) values (v_nomes[i]) returning id into v_id;
    v_jog := v_jog || v_id;
    insert into membros_grupo (grupo_id, jogador_id) values (v_grupo, v_id);
  end loop;

  insert into rachas (grupo_id, modalidade, modo, tamanho_equipe, config, data_hora, local, finalizado)
  values (v_grupo, 'volei', 'rapido', 2, '{"num_sets": 1, "pontos_set": 15}'::jsonb,
          now() - interval '4 days', 'Quadra demo', true)
  returning id into v_racha;

  insert into presencas_racha (racha_id, jogador_id, status)
  select v_racha, unnest(v_jog), 'confirmado';

  for p in 1 .. 3 loop
    v_pa := v_placares[p][1];
    v_pb := v_placares[p][2];

    insert into times (racha_id, nome)
    values (v_racha, split_part(v_nomes[v_duplas[p][1]], ' ', 1) || ' e ' || split_part(v_nomes[v_duplas[p][2]], ' ', 1))
    returning id into v_time_a;

    insert into times (racha_id, nome)
    values (v_racha, split_part(v_nomes[v_duplas[p][3]], ' ', 1) || ' e ' || split_part(v_nomes[v_duplas[p][4]], ' ', 1))
    returning id into v_time_b;

    v_venc := case when v_pa > v_pb then v_time_a else v_time_b end;

    insert into partidas (racha_id, time_a_id, time_b_id, status, placar_a, placar_b, vencedor_id, created_at)
    values (v_racha, v_time_a, v_time_b, 'finalizada',
            (v_pa > v_pb)::int, (v_pb > v_pa)::int, v_venc,
            now() - make_interval(hours => 4 - p))
    returning id into v_partida;

    insert into escalacoes_partida (partida_id, jogador_id, time_id) values
      (v_partida, v_jog[v_duplas[p][1]], v_time_a),
      (v_partida, v_jog[v_duplas[p][2]], v_time_a),
      (v_partida, v_jog[v_duplas[p][3]], v_time_b),
      (v_partida, v_jog[v_duplas[p][4]], v_time_b);

    insert into sets (partida_id, numero, placar_a, placar_b, vencedor_id)
    values (v_partida, 1, v_pa, v_pb, v_venc)
    returning id into v_set;

    -- um evento por ponto do set (placar = nº de eventos de cada lado):
    -- ~5% sem autor, ~25% erro de alguém do time que perdeu o ponto, resto ponto de quem ganhou
    for lado in 1 .. 2 loop
      n := case when lado = 1 then v_pa else v_pb end;
      v_time_pt := case when lado = 1 then v_time_a else v_time_b end;

      for e in 1 .. n loop
        v_r := random();

        if v_r < 0.05 then
          insert into eventos_ponto (partida_id, set_id, time_id, jogador_id, motivo)
          values (v_partida, v_set, v_time_pt, null, 'outro');
        elsif v_r < 0.30 then
          insert into eventos_ponto (partida_id, set_id, time_id, jogador_id, motivo, tipo_erro)
          values (v_partida, v_set, v_time_pt,
                  v_jog[v_duplas[p][(case when lado = 1 then 3 else 1 end) + floor(random() * 2)::int]],
                  'erro_adversario',
                  v_tipos[1 + floor(random() * 7)::int]);
        else
          insert into eventos_ponto (partida_id, set_id, time_id, jogador_id, motivo)
          values (v_partida, v_set, v_time_pt,
                  v_jog[v_duplas[p][(case when lado = 1 then 1 else 3 end) + floor(random() * 2)::int]],
                  v_motivos[1 + floor(random() * 6)::int]);
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- LIMPEZA (rode quando acabar a demo; o grupo leva junto racha, times,
-- partidas, sets, pontos e escalações):
-- delete from grupos where nome = 'DEMO - Grupo fake';
-- delete from jogadores where nome like '% Demo' and user_id is null;
