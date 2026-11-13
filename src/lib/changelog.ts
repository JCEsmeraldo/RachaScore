import { useSyncExternalStore } from 'react'

// Novidades do app, em linguagem de usuário (não é o git log). Mais recente primeiro.
// Cada publicação visível = versão nova (semver: novidade → minor, só correção → patch).
// Ao publicar: subir "version" no package.json, adicionar a entrada aqui no topo com a
// mesma versão e criar a tag git vX.Y.Z. Versões até 1.5.0 foram reconstruídas pelo histórico.

export type ChangeKind = 'new' | 'improved' | 'fix'

export type ChangelogEntry = { version: string; date: string; items: { kind: ChangeKind; text: string }[] }

export const APP_VERSION = __APP_VERSION__

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.6.1',
    date: '2026-11-13',
    items: [
      {
        kind: 'improved',
        text: 'Na aba "Média por jogo", os erros agora aparecem por tipo (Saque, Ataque fora, Ataque na rede, Passe, Toque na rede, Condução e Outro), uma coluna pra cada, no lugar do total de erros. A aba "Total" continua com o total.',
      },
      {
        kind: 'fix',
        text: 'Na aba "Média por jogo", a coluna Jogos aparecia com casa decimal (6.0). Agora mostra o total de jogos (6).',
      },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-11-13',
    items: [
      {
        kind: 'new',
        text: 'Erros do vôlei agora têm tipo: ao tocar em "Erro", escolha Saque, Ataque fora, Ataque na rede, Passe, Toque na rede, Condução ou Outro. Marque erro só quando o adversário não fez nada pra ganhar o ponto.',
      },
      {
        kind: 'improved',
        text: 'Tabela de estatísticas: o Saldo (total − erros) agora é a última coluna e é ele que define a ordem do ranking. Nas estatísticas os erros continuam somados num valor só.',
      },
      {
        kind: 'new',
        text: 'Seletor "Média por jogo" na tabela de estatísticas: pontos, erros e saldo por jogo, e aproveitamento de vitórias. Quem tem menos de 3 jogos aparece esmaecido.',
      },
      {
        kind: 'improved',
        text: 'Ao tocar no nome de um jogador nas estatísticas, o resumo agora mostra os erros dele por tipo, com a quantidade e a porcentagem de cada um.',
      },
      { kind: 'new', text: 'Nova tela de Novidades (✨ na tela de grupos), com o que mudou no app a cada versão.' },
      { kind: 'improved', text: 'Os erros registrados antes desta versão foram zerados, pra começar já com os tipos.' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-09-14',
    items: [
      { kind: 'new', text: 'Vôlei agora é a modalidade padrão ao criar um racha.' },
      { kind: 'new', text: 'Coluna Saldo (total − erros) na tabela de estatísticas.' },
      { kind: 'new', text: 'Time personalizado de dupla já vem com o nome sugerido ("Nome S. e Nome S.").' },
      {
        kind: 'improved',
        text: 'Não deixa criar um time personalizado com os mesmos jogadores de outro time do racha.',
      },
      { kind: 'improved', text: 'Os botões de marcar ponto mostram "Salvando..." enquanto gravam.' },
      { kind: 'fix', text: 'A súmula da partida agora aparece em tempo real, não só ao finalizar.' },
      { kind: 'fix', text: 'Jogo de um set só mostra o placar real ao finalizar, em vez de zero.' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-20',
    items: [
      {
        kind: 'new',
        text: 'Vôlei: os pontos agora são Pinga, Lob ou Corte (no lugar de "Ataque"), e o botão "Erro" dá o ponto pro adversário e conta na coluna Erros de quem errou.',
      },
      { kind: 'improved', text: 'O MVP agora considera o saldo (pontos − erros), e o maior pontuador ganha o selo TOP.' },
      {
        kind: 'improved',
        text: 'Resumo do jogador mais completo: comparação com a média do grupo, sequência de vitórias/derrotas e melhor parceiro.',
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-10',
    items: [
      {
        kind: 'new',
        text: 'Nas estatísticas, tocar no nome de um jogador abre o resumo dele: média de pontos, aproveitamento e tipos de ponto.',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-07-29',
    items: [
      { kind: 'new', text: 'Exportar a classificação, e a classificação com as estatísticas, como imagem.' },
      { kind: 'new', text: 'Renomear times, inclusive os sorteados.' },
      { kind: 'new', text: 'Apagar uma partida não finalizada direto na lista.' },
      { kind: 'improved', text: 'No modo torneio, ao escolher um time na nova partida aparecem os jogadores dele.' },
      {
        kind: 'fix',
        text: 'Estatísticas de grupos com muito histórico não perdem mais os rachas mais recentes.',
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-07-20',
    items: [
      {
        kind: 'new',
        text: 'Convite pessoal: quem organiza gera um link pra pessoa assumir um jogador que já existe, mantendo todo o histórico e as estatísticas dele.',
      },
      { kind: 'new', text: 'Botão "Inverter lados" na partida, pra bater com o lado da quadra de quem está assistindo.' },
      { kind: 'new', text: 'Tela "Instalar" explicando como instalar o app no celular.' },
      { kind: 'improved', text: 'O cadastro agora pede nome e sobrenome.' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-07-12',
    items: [
      { kind: 'new', text: 'Grupos de amigos com convite por link, membros fixos e administradores.' },
      { kind: 'new', text: 'Rachas de futebol e vôlei, nos modos Torneio e Rápido, com lista de presença e fila de espera.' },
      { kind: 'new', text: 'Sorteio de times e escalação por partida.' },
      {
        kind: 'new',
        text: 'Placar ao vivo, sincronizado entre aparelhos: cronômetro, assistências e cartões no futebol; sets no vôlei.',
      },
      {
        kind: 'new',
        text: 'Estatísticas por racha, grupo e jogador, com MVP, gráficos de evolução e exportação em imagem.',
      },
      { kind: 'new', text: 'Avaliação dos jogadores depois de cada racha.' },
      { kind: 'new', text: 'App instalável no celular (PWA).' },
    ],
  },
]

const SEEN_KEY = 'rachascore:changelog-seen'
const latest = CHANGELOG[0]?.version ?? ''

if (import.meta.env.DEV && latest !== APP_VERSION)
  console.warn(`Changelog (${latest}) e package.json (${APP_VERSION}) com versões diferentes`)

// compara "1.10.0" > "1.9.2" numericamente
function newerThan(a: string, b: string) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  return false
}

// Bolinha de "novidade" até a pessoa abrir a página. localStorage pode falhar (aba privada).
export function hasUnseenChanges() {
  try {
    const seen = localStorage.getItem(SEEN_KEY) ?? ''
    return !/^\d+\.\d+\.\d+$/.test(seen) || newerThan(latest, seen)
  } catch {
    return false
  }
}

export function markChangesSeen() {
  try {
    localStorage.setItem(SEEN_KEY, latest)
  } catch {
    // sem storage: a bolinha só não some
  }
  window.dispatchEvent(new Event(SEEN_KEY))
}

function subscribe(onChange: () => void) {
  window.addEventListener(SEEN_KEY, onChange)
  return () => window.removeEventListener(SEEN_KEY, onChange)
}

// O link do menu perde a bolinha assim que a página de Novidades é aberta.
export function useUnseenChanges() {
  return useSyncExternalStore(subscribe, hasUnseenChanges)
}
