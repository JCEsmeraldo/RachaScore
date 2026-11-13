-- Erros do vôlei tipificados (coluna eventos_ponto.tipo_erro) + zera os erros antigos.
-- Rodar no SQL Editor do Supabase, passo a passo.
--
-- Antes de rodar: finalize partidas de vôlei em andamento. O "Desfazer último
-- ponto" lê o último evento do set; apagar erros de um set aberto faria ele
-- desfazer o ponto errado.

-- 0. conferir o que vai ser apagado
select count(*) as erros, count(distinct partida_id) as partidas
from eventos_ponto
where motivo = 'erro_adversario';

-- 1. backup (apagar depois que confirmar que está tudo certo)
create table if not exists eventos_ponto_erros_bkp as
  select * from eventos_ponto where motivo = 'erro_adversario';

-- 2. coluna nova — nullable de propósito: o app antigo (até o deploy) ainda grava erro sem tipo
alter table eventos_ponto
  add column if not exists tipo_erro text
  check (tipo_erro in ('saque', 'ataque_fora', 'ataque_rede', 'passe', 'toque_rede', 'conducao', 'outro'));

-- 3. zera os erros antigos
-- Obs.: sets.placar_a/b já somaram esses pontos e não são recalculados — o placar
-- das partidas antigas continua o mesmo, só some a atribuição do erro ao jogador.
delete from eventos_ponto where motivo = 'erro_adversario';
