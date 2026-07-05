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
  porMotivo: Partial<Record<MotivoPonto, number>>
  total: number
}

type EventoParaMotivo = {
  partida_id: string
  jogador_id: string | null
  motivo: string | null
  jogadores: { nome: string } | null
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
      porMotivo: porMotivo.get(nome) ?? {},
    }))
    .sort((a, b) => b.total - a.total)
}
