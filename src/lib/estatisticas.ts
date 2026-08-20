import type { MotivoPonto } from './types'

export const LABEL_MOTIVO: Record<MotivoPonto, string> = {
  pinga: 'Pinga',
  lob: 'Lob',
  corte: 'Corte',
  bloqueio: 'Bloqueio',
  saque: 'Saque',
  erro_adversario: 'Erro',
  outro: 'Outro',
}

export const COLUNAS_MOTIVO: MotivoPonto[] = ['pinga', 'lob', 'corte', 'bloqueio', 'saque', 'outro']

export type LinhaMotivo = {
  nome: string
  jogos: number
  vitorias: number
  porMotivo: Partial<Record<MotivoPonto, number>>
  total: number
  erros: number
}

type EventoParaMotivo = {
  partida_id: string
  jogador_id: string | null
  motivo: string | null
  jogadores: { nome: string } | null
}

export type PartidaParaJogos = {
  id: string
  racha_id: string
  time_a_id: string
  time_b_id: string
  vencedor_id: string | null
  status: string
}

export type EscalacaoParaJogos = { partida_id: string; jogador_id: string; time_id: string }

export type PresencaParaJogos = { racha_id: string; jogador_id: string; time_id: string | null }

export type PartidaComData = PartidaParaJogos & { created_at: string }

export type ResultadoPartida = { partidaId: string; timeId: string; createdAt: string; resultado: 'V' | 'D' | 'E' }

// mesmos mapas de elegibilidade do contarJogosEVitorias, reaproveitados pelas
// funções de sequência/parceiro abaixo
function construirMapasElegibilidade(escalacoes: EscalacaoParaJogos[], presencas: PresencaParaJogos[]) {
  const escalacaoPorPartida = new Map<string, Map<string, string>>()
  for (const e of escalacoes) {
    if (!escalacaoPorPartida.has(e.partida_id)) escalacaoPorPartida.set(e.partida_id, new Map())
    escalacaoPorPartida.get(e.partida_id)!.set(e.jogador_id, e.time_id)
  }

  const presencaPorRacha = new Map<string, Map<string, string | null>>()
  for (const p of presencas) {
    if (!presencaPorRacha.has(p.racha_id)) presencaPorRacha.set(p.racha_id, new Map())
    presencaPorRacha.get(p.racha_id)!.set(p.jogador_id, p.time_id)
  }

  return { escalacaoPorPartida, presencaPorRacha }
}

function timeDoJogadorNaPartida(
  partida: PartidaComData,
  escalacaoPorPartida: Map<string, Map<string, string>>,
  presencaPorRacha: Map<string, Map<string, string | null>>,
  jogadorId: string,
): string | null {
  const timeEscalado = escalacaoPorPartida.get(partida.id)?.get(jogadorId)
  if (timeEscalado) return timeEscalado

  const timePresenca = presencaPorRacha.get(partida.racha_id)?.get(jogadorId)
  if (timePresenca && (timePresenca === partida.time_a_id || timePresenca === partida.time_b_id)) return timePresenca

  return null
}

// sequência cronológica de resultados (V/D/E) de um jogador — base pro streak
export function partidasDoJogador(
  partidas: PartidaComData[],
  escalacoes: EscalacaoParaJogos[],
  presencas: PresencaParaJogos[],
  jogadorId: string,
): ResultadoPartida[] {
  const { escalacaoPorPartida, presencaPorRacha } = construirMapasElegibilidade(escalacoes, presencas)

  const resultados: ResultadoPartida[] = []
  for (const partida of partidas) {
    if (partida.status !== 'finalizada') continue

    const timeId = timeDoJogadorNaPartida(partida, escalacaoPorPartida, presencaPorRacha, jogadorId)
    if (!timeId) continue

    const resultado: ResultadoPartida['resultado'] =
      partida.vencedor_id === timeId ? 'V' : partida.vencedor_id === null ? 'E' : 'D'

    resultados.push({ partidaId: partida.id, timeId, createdAt: partida.created_at, resultado })
  }

  return resultados.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// sequência atual (V ou D seguidas, a partir da partida mais recente) —
// empate quebra a sequência, não conta pra nenhum dos dois lados
export function calcularStreak(resultados: ResultadoPartida[]): { tipo: 'V' | 'D'; contagem: number } | null {
  const semEmpate = resultados.filter((r) => r.resultado !== 'E')
  if (semEmpate.length === 0) return null

  const ultimo = semEmpate[semEmpate.length - 1].resultado as 'V' | 'D'
  let contagem = 0
  for (let i = semEmpate.length - 1; i >= 0; i--) {
    if (semEmpate[i].resultado !== ultimo) break
    contagem++
  }

  return { tipo: ultimo, contagem }
}

// parceiro de time com mais vitórias juntos (empate técnico desempata por
// menos jogos juntos — parceria mais "eficiente")
export function melhorParceiro(
  partidas: PartidaComData[],
  escalacoes: EscalacaoParaJogos[],
  presencas: PresencaParaJogos[],
  jogadorId: string,
  nomePorJogadorId: Map<string, string>,
): { nome: string; vitorias: number; jogos: number } | null {
  const { escalacaoPorPartida, presencaPorRacha } = construirMapasElegibilidade(escalacoes, presencas)

  const jogosPorParceiro = new Map<string, number>()
  const vitoriasPorParceiro = new Map<string, number>()

  for (const partida of partidas) {
    if (partida.status !== 'finalizada') continue

    const meuTimeId = timeDoJogadorNaPartida(partida, escalacaoPorPartida, presencaPorRacha, jogadorId)
    if (!meuTimeId) continue

    const escalados = escalacaoPorPartida.get(partida.id)
    const companheiros: string[] = []

    if (escalados && escalados.size > 0) {
      for (const [outroId, timeId] of escalados) {
        if (outroId !== jogadorId && timeId === meuTimeId) companheiros.push(outroId)
      }
    } else {
      const mapaRacha = presencaPorRacha.get(partida.racha_id)
      if (mapaRacha) {
        for (const [outroId, timeId] of mapaRacha) {
          if (outroId !== jogadorId && timeId === meuTimeId) companheiros.push(outroId)
        }
      }
    }

    const venceu = partida.vencedor_id === meuTimeId
    for (const c of companheiros) {
      jogosPorParceiro.set(c, (jogosPorParceiro.get(c) ?? 0) + 1)
      if (venceu) vitoriasPorParceiro.set(c, (vitoriasPorParceiro.get(c) ?? 0) + 1)
    }
  }

  let melhor: { jogadorId: string; vitorias: number; jogos: number } | null = null
  for (const [id, vitorias] of vitoriasPorParceiro) {
    const jogos = jogosPorParceiro.get(id) ?? 0
    if (!melhor || vitorias > melhor.vitorias || (vitorias === melhor.vitorias && jogos < melhor.jogos)) {
      melhor = { jogadorId: id, vitorias, jogos }
    }
  }

  if (!melhor || melhor.vitorias === 0) return null
  return { nome: nomePorJogadorId.get(melhor.jogadorId) ?? '?', vitorias: melhor.vitorias, jogos: melhor.jogos }
}

export type ResumoExtra = {
  streak: { tipo: 'V' | 'D'; contagem: number } | null
  parceiro: { nome: string; vitorias: number; jogos: number } | null
  ultimos5: ('V' | 'D' | 'E')[]
}

// junta streak + melhor parceiro + últimos 5 resultados numa chamada só —
// usado tanto na tela do racha quanto na do grupo (mesmo cálculo, dados só
// mudam de escopo)
export function calcularResumoExtra(
  partidas: PartidaComData[],
  escalacoes: EscalacaoParaJogos[],
  presencas: PresencaParaJogos[],
  jogadorId: string,
  nomePorJogadorId: Map<string, string>,
): ResumoExtra {
  const resultados = partidasDoJogador(partidas, escalacoes, presencas, jogadorId)
  return {
    streak: calcularStreak(resultados),
    parceiro: melhorParceiro(partidas, escalacoes, presencas, jogadorId, nomePorJogadorId),
    // já vem ordenado do mais antigo pro mais recente (mesma ordem cronológica
    // do partidasDoJogador) — mantém a leitura esquerda→direita = passado→hoje
    ultimos5: resultados.slice(-5).map((r) => r.resultado),
  }
}

// "jogos"/"vitórias" de verdade = partidas finalizadas em que o jogador
// realmente jogou/ganhou (escalação daquela partida no modo rápido, ou time
// fixo do racha no torneio) — diferente de contar por eventos_ponto, que
// subestima quem jogou mas não pontuou naquele jogo.
export function contarJogosEVitorias(
  partidas: PartidaParaJogos[],
  escalacoes: EscalacaoParaJogos[],
  presencas: PresencaParaJogos[],
): Map<string, { jogos: number; vitorias: number }> {
  const escalacaoPorPartida = new Map<string, Map<string, string>>()
  for (const e of escalacoes) {
    if (!escalacaoPorPartida.has(e.partida_id)) escalacaoPorPartida.set(e.partida_id, new Map())
    escalacaoPorPartida.get(e.partida_id)!.set(e.jogador_id, e.time_id)
  }

  const presencaPorRacha = new Map<string, Map<string, string | null>>()
  for (const p of presencas) {
    if (!presencaPorRacha.has(p.racha_id)) presencaPorRacha.set(p.racha_id, new Map())
    presencaPorRacha.get(p.racha_id)!.set(p.jogador_id, p.time_id)
  }

  const jogosPorJogador = new Map<string, Set<string>>()
  const vitoriasPorJogador = new Map<string, Set<string>>()

  function marcar(mapa: Map<string, Set<string>>, jogadorId: string, partidaId: string) {
    if (!mapa.has(jogadorId)) mapa.set(jogadorId, new Set())
    mapa.get(jogadorId)!.add(partidaId)
  }

  function processar(jogadorId: string, timeId: string | null, partida: PartidaParaJogos) {
    marcar(jogosPorJogador, jogadorId, partida.id)
    if (partida.vencedor_id && timeId === partida.vencedor_id) {
      marcar(vitoriasPorJogador, jogadorId, partida.id)
    }
  }

  for (const partida of partidas) {
    if (partida.status !== 'finalizada') continue

    const escalados = escalacaoPorPartida.get(partida.id)

    if (escalados && escalados.size > 0) {
      for (const [jogadorId, timeId] of escalados) processar(jogadorId, timeId, partida)
    } else {
      const mapaRacha = presencaPorRacha.get(partida.racha_id)
      if (!mapaRacha) continue
      for (const [jogadorId, timeId] of mapaRacha) {
        if (timeId === partida.time_a_id || timeId === partida.time_b_id) processar(jogadorId, timeId, partida)
      }
    }
  }

  const resultado = new Map<string, { jogos: number; vitorias: number }>()
  for (const jogadorId of new Set([...jogosPorJogador.keys(), ...vitoriasPorJogador.keys()])) {
    resultado.set(jogadorId, {
      jogos: jogosPorJogador.get(jogadorId)?.size ?? 0,
      vitorias: vitoriasPorJogador.get(jogadorId)?.size ?? 0,
    })
  }
  return resultado
}

export function montarTabelaMotivos(eventos: EventoParaMotivo[]): LinhaMotivo[] {
  const porMotivo = new Map<string, Partial<Record<MotivoPonto, number>>>()
  const totais = new Map<string, number>()
  const errosPorNome = new Map<string, number>()
  const partidasPorNome = new Map<string, Set<string>>()

  for (const ev of eventos) {
    const nome = ev.jogador_id && ev.jogadores ? ev.jogadores.nome : 'Sem autor'
    const motivo = (ev.motivo ?? undefined) as MotivoPonto | undefined

    if (!partidasPorNome.has(nome)) partidasPorNome.set(nome, new Set())
    partidasPorNome.get(nome)!.add(ev.partida_id)

    // erro é do jogador que ERROU (perdeu o ponto pro adversário), não uma
    // pontuação dele — fica fora do Total e das colunas de motivo, em coluna
    // própria (Erros), senão infla a estatística ofensiva de quem errou
    if (motivo === 'erro_adversario') {
      errosPorNome.set(nome, (errosPorNome.get(nome) ?? 0) + 1)
      continue
    }

    totais.set(nome, (totais.get(nome) ?? 0) + 1)

    if (motivo) {
      if (!porMotivo.has(nome)) porMotivo.set(nome, {})
      const registro = porMotivo.get(nome)!
      registro[motivo] = (registro[motivo] ?? 0) + 1
    }
  }

  const nomes = new Set([...totais.keys(), ...errosPorNome.keys()])

  return [...nomes]
    .map((nome) => ({
      nome,
      total: totais.get(nome) ?? 0,
      jogos: partidasPorNome.get(nome)?.size ?? 0,
      vitorias: 0, // sobrescrito por quem chama, com contarJogosEVitorias
      porMotivo: porMotivo.get(nome) ?? {},
      erros: errosPorNome.get(nome) ?? 0,
    }))
    .sort((a, b) => b.total - a.total)
}
