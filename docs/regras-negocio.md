# RachaScore — Regras de Negócio

## 1. Modalidades

O app suporta duas modalidades, com possibilidade de extensão futura:

- **Futebol**
- **Vôlei**

## 2. Configuração do Racha

Cada racha (evento) é criado dentro de um grupo e define:

- **Modalidade**: futebol ou vôlei
- **Tamanho da equipe**: número configurável (padrão: 5 no futebol, 2 no vôlei)
- **Modo**:
  - `Torneio` — vários times fixos disputam várias partidas no mesmo racha, com tabela de classificação
  - `Rápido` — os times são montados partida a partida (ver seção 5), sem tabela de classificação
- **Critério de fim de partida** (configurável na criação do racha):
  - Futebol: por tempo cronometrado e/ou por gols-alvo. Pode combinar os dois (ex.: 10min **ou** 2 gols) — a partida termina no critério que for atingido primeiro
  - Vôlei: número de sets (1, melhor-de-3, melhor-de-5) + pontos por set (configurável)
- **Limite de jogadores** (opcional): acima do limite, quem confirma presença entra numa lista de espera, em ordem de chegada

## 3. Grupo e Jogadores

- Um **grupo** representa um conjunto fixo de amigos que jogam recorrentemente.
- Jogadores podem ser:
  - **Fixos**: vinculados permanentemente ao grupo (`membros_grupo`). Continuam no grupo mesmo que faltem em vários rachas.
  - **Avulsos**: adicionados diretamente à lista de presença de um racha específico, sem vínculo permanente com o grupo.
- **Convite por link**: cada grupo tem um `convite_token` único; o link `/convite/:token` deixa qualquer pessoa entrar no grupo como membro fixo. Regenerar o token invalida links antigos.
- Um link de convite pode carregar também o id de um racha (`?racha=...`) — quem entra pelo link já cai direto na tela de presença daquele racha.
- Membros podem ter `is_admin`: mesmos poderes do dono do grupo, exceto apagar o grupo.
- **Convite pessoal (assumir jogador)**: jogador fixo sem conta vinculada (`user_id is null`) pode receber um convite individual (`jogadores.convite_token`, link `/assumir/:token`) pra pessoa de verdade logar e assumir aquele jogador específico, preservando todo o histórico/estatísticas já registrado — em vez de entrar como jogador novo do zero. Só o dono/admin do grupo gera esse convite. Uma conta pode assumir jogadores de grupos diferentes sem problema; só é bloqueada se já for membro DESSE MESMO grupo com outro jogador (evita duplicar identidade dentro do grupo).

## 4. Presença por Racha

- Cada racha tem sua própria lista de presença (`presencas_racha`), com status `confirmado`, `espera` ou `ausente`.
- Jogadores fixos do grupo aparecem automaticamente na lista; cada um confirma a própria presença (organizador pode confirmar por qualquer um).
- Jogadores avulsos são adicionados diretamente à lista de presença do racha em que vão jogar.
- Se o racha tem `limite_jogadores` e já bateu o limite, novas confirmações entram como `espera`, ordenadas por `pediu_vaga_em` (fila).
- Ao confirmar a própria presença, a pessoa pode compartilhar a lista atualizada (confirmados + fila + link do racha) direto pro WhatsApp — usa o share nativo do navegador quando disponível, senão copia o texto pra área de transferência.
- Somente jogadores confirmados entram no sorteio/formação de times daquele racha.

## 5. Times

Times (`times`) pertencem a um racha e nunca são fixos entre rachas diferentes. Como são formados depende do modo:

- **Torneio**: os times do racha são sorteados de uma vez (tela Times → "Sortear times"), distribuindo os confirmados em grupos de `tamanho_equipe`. O sorteio grava `time_id` em cada presença (`presencas_racha.time_id`) — esse vínculo é o que fica valendo durante todo o racha, pra classificação fazer sentido entre partidas.
- **Rápido**: ao criar uma partida, o organizador escolhe pra cada lado um time já sorteado (reaproveitando a composição atual) ou monta um **time personalizado** na hora (nome + jogadores escolhidos avulsamente). O mesmo jogador não pode estar nos dois lados da mesma partida. A composição de cada partida fica registrada em `escalacoes_partida`, sem prender ninguém a um time fixo pro racha inteiro — o objetivo é permitir que times mudem a cada jogo (ex.: vôlei de 6 revezando parceiros).
- **Re-sortear** (torneio) não apaga times que já têm partida registrada (histórico); só limpa e recria os times "livres" (sem nenhuma partida associada). Se não houver nenhum time sorteado ainda quando o organizador for criar a primeira partida, o sorteio roda automaticamente antes de abrir a tela de nova partida.
- Times marcados como `sorteio = true` (gerados pelo botão Sortear) não podem ser apagados manualmente — só os personalizados (criados na hora de montar uma partida) podem, contanto que não tenham partida registrada.

## 6. Partida e Placar

- Cada partida pertence a um racha e envolve dois times.
- O placar é registrado de forma granular: cada ponto/gol é um evento próprio (`eventos_ponto`), não apenas um número final.
- **Autoria do ponto/gol é opcional**:
  - Futebol: o gol normalmente tem um autor. Em caso de gol contra, o evento pode ficar sem autor. Marcar o gol pode opcionalmente registrar uma **assistência** (um companheiro de time, ou "sem assistência").
  - Vôlei: pontos podem não ter autor (ex.: erro de saque do adversário). Cada evento pode registrar um **motivo**: `ataque`, `bloqueio`, `saque`, `erro_adversario` ou `outro`.
- Vôlei possui a camada extra de **sets**: cada set tem seu próprio placar, e a partida é decidida pelo número de sets vencidos por cada time.
- Futebol tem **cronômetro** persistido no banco (não é só um timer local): pode ser iniciado/pausado/zerado, sincroniza entre dispositivos vendo a mesma partida ao vivo, e não encerra sozinho ao bater o tempo configurado (só sinaliza "acréscimos") — quem encerra é o organizador.
- Futebol permite registrar **cartões** (amarelo/vermelho) por jogador — é um registro avulso, não afeta placar nem escalação, só estatística.
- Placar e cronômetro sincronizam em tempo real entre dispositivos (Supabase Realtime) — útil quando mais de uma pessoa acompanha a mesma partida ao vivo.

## 7. Pontuação do Torneio

No modo torneio, cada partida finalizada gera pontos para a tabela de classificação:

| Resultado | Futebol | Vôlei |
|---|---|---|
| Vitória | 3 pontos | 3 pontos |
| Empate | 1 ponto | não existe (sets sempre decidem um vencedor) |
| Derrota | 0 pontos | 0 pontos |

## 8. Critério de Desempate na Tabela

Quando times empatam em pontos na classificação, o desempate segue esta ordem:

1. **Pontos** (vitórias/empates/derrotas)
2. **Saldo** (gols ou pontos feitos − sofridos)
3. **Confronto direto** (resultado entre os times empatados)

## 9. Estatísticas

- Por racha e por grupo (acumulado entre rachas da mesma modalidade), e por jogador individual.
- Tabela de pontos por motivo (vôlei): quantos pontos cada jogador fez de ataque/bloqueio/saque/outro, mais quantos jogos disputou. Pontos sem autor ficam agrupados numa linha "Sem autor" fixada por último.

## 10. Resumo das Entidades

- **Grupo**: conjunto fixo de amigos, com link de convite próprio
- **Jogador**: pessoa que joga, fixa (vinculada a um grupo) ou avulsa
- **Racha**: evento com modalidade, modo, regras de fim de partida e limite de jogadores (opcional)
- **Presença**: status do jogador num racha (confirmado / espera / ausente)
- **Time**: formado a cada racha — fixo pro racha inteiro (torneio) ou por partida (rápido)
- **Partida**: confronto entre dois times dentro de um racha, com placar granular e cronômetro (futebol)
- **Set**: subdivisão da partida (somente vôlei)
- **Evento de Ponto/Gol**: registro individual de cada ponto, com time, autor opcional e motivo opcional (vôlei)
- **Escalação de Partida**: quem jogou em qual time numa partida específica (modo rápido)
- **Classificação**: calculada a partir das partidas finalizadas do racha (não é um dado armazenado, é derivado)
