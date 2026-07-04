# RachaScore — Regras de Negócio

## 1. Modalidades

O app suporta duas modalidades, com possibilidade de extensão futura:

- **Futebol**
- **Vôlei**

## 2. Configuração do Racha

Cada racha (evento) é criado dentro de um grupo e define:

- **Modalidade**: futebol ou vôlei
- **Tamanho da equipe**: número configurável (ex.: futebol 5, 6, 7, 11; vôlei 2, 4, 6)
- **Modo**:
  - `Torneio` — várias partidas no mesmo racha, com tabela de classificação
  - `Rápido` — uma partida avulsa, sem tabela
- **Critério de fim de partida** (configurável na criação do racha):
  - Futebol: por tempo cronometrado e/ou por gols-alvo. Pode combinar os dois (ex.: 10min **ou** 2 gols) — a partida termina no critério que for atingido primeiro
  - Vôlei: número de sets (1, melhor-de-3, melhor-de-5) + pontos por set (configurável, ex.: 25 — todos os sets valem o mesmo, sem set decisivo reduzido)

## 3. Grupo e Jogadores

- Um **grupo** representa um conjunto fixo de amigos que jogam recorrentemente.
- Jogadores podem ser:
  - **Fixos**: vinculados permanentemente ao grupo. Continuam no grupo mesmo que faltem em vários rachas.
  - **Avulsos**: convidados que participam de um racha específico, sem vínculo permanente com o grupo. Não aparecem automaticamente em rachas futuros.

## 4. Presença por Racha

- Cada racha tem sua própria lista de presença.
- Jogadores fixos do grupo aparecem automaticamente na lista do racha; o organizador marca quem está **presente** naquele dia.
- Jogadores avulsos são adicionados diretamente à lista de presença do racha em que vão jogar.
- Somente jogadores marcados como presentes entram no sorteio/formação de times daquele racha.
- Times são formados a cada racha (não são fixos entre rachas diferentes).

## 5. Partida e Placar

- Cada partida pertence a um racha e envolve dois times.
- O placar é registrado de forma granular: cada ponto/gol é um evento próprio, não apenas um número final.
- **Autoria do ponto/gol é opcional**:
  - Futebol: o gol normalmente tem um autor. Em caso de gol contra, o evento pode ficar sem autor ou ser marcado com motivo específico.
  - Vôlei: pontos podem não ter autor (ex.: erro de saque do adversário, invasão de rede). Cada evento de ponto pode registrar um **motivo**: `ataque`, `bloqueio`, `saque`, `erro_adversario` ou `outro`.
- Vôlei possui a camada extra de **sets**: cada set tem seu próprio placar, e a partida é decidida pelo número de sets vencidos por cada time.

## 6. Pontuação do Torneio

No modo torneio, cada partida finalizada gera pontos para a tabela de classificação:

| Resultado | Futebol | Vôlei |
|---|---|---|
| Vitória | 3 pontos | 3 pontos |
| Empate | 1 ponto | não existe (sets sempre decidem um vencedor) |
| Derrota | 0 pontos | 0 pontos |

## 7. Critério de Desempate na Tabela

Quando times empatam em pontos na classificação, o desempate segue esta ordem:

1. **Pontos** (vitórias/empates/derrotas)
2. **Saldo** (gols ou pontos feitos − sofridos)
3. **Confronto direto** (resultado entre os times empatados)

## 8. Resumo das Entidades

- **Grupo**: conjunto fixo de amigos
- **Jogador**: pessoa que joga, fixa ou avulsa
- **Racha**: evento com modalidade, modo e regras de fim de partida definidas
- **Time**: formado a cada racha
- **Partida**: confronto entre dois times dentro de um racha
- **Set**: subdivisão da partida (somente vôlei)
- **Evento de Ponto/Gol**: registro individual de cada ponto, com time, autor opcional e motivo opcional (vôlei)
- **Classificação**: calculada a partir das partidas finalizadas do racha (não é um dado armazenado, é derivado)
