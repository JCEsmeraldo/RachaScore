import type { MotivoPonto } from './types'

export const LABEL_MOTIVO: Record<MotivoPonto, string> = {
  ataque: 'Ataque',
  bloqueio: 'Bloqueio',
  saque: 'Saque',
  erro_adversario: 'Erro adversário',
  outro: 'Outro',
}

export const COLUNAS_MOTIVO: MotivoPonto[] = ['ataque', 'bloqueio', 'saque', 'outro']

export type LinhaMotivo = {
  nome: string
  jogos: number
  vitorias: number
  porMotivo: Partial<Record<MotivoPonto, number>>
  total: number
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
  const partidasPorNome = new Map<string, Set<string>>()

  for (const ev of eventos) {
    const nome = ev.jogador_id && ev.jogadores ? ev.jogadores.nome : 'Sem autor'
    const motivo = (ev.motivo ?? undefined) as MotivoPonto | undefined

    totais.set(nome, (totais.get(nome) ?? 0) + 1)

    if (!partidasPorNome.has(nome)) partidasPorNome.set(nome, new Set())
    partidasPorNome.get(nome)!.add(ev.partida_id)

    if (motivo) {
      if (!porMotivo.has(nome)) porMotivo.set(nome, {})
      const registro = porMotivo.get(nome)!
      registro[motivo] = (registro[motivo] ?? 0) + 1
    }
  }

  return [...totais.entries()]
    .map(([nome, total]) => ({
      nome,
      total,
      jogos: partidasPorNome.get(nome)?.size ?? 0,
      vitorias: 0, // sobrescrito por quem chama, com contarJogosEVitorias
      porMotivo: porMotivo.get(nome) ?? {},
    }))
    .sort((a, b) => b.total - a.total)
}
