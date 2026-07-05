import { supabase } from './supabaseClient'
import type { Racha, Time } from './types'

export function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

export async function sortearTimes(
  rachaId: string,
  racha: Pick<Racha, 'tamanho_equipe' | 'modo'>,
  confirmadosIds: string[],
  timesAtuais: Time[],
): Promise<{ erro: string | null }> {
  const numTimes = Math.floor(confirmadosIds.length / racha.tamanho_equipe)

  if (numTimes < 2) {
    return {
      erro: `Precisa de pelo menos ${racha.tamanho_equipe * 2} confirmados pra sortear 2 times (times de ${racha.tamanho_equipe})`,
    }
  }

  await supabase.from('presencas_racha').update({ time_id: null }).eq('racha_id', rachaId)

  // times com partida (mesmo finalizada) são histórico — não mexe, não apaga, não
  // reaproveita. Só limpa os times "livres" (sem nenhuma partida) e recria o pool.
  const { data: partidasData } = await supabase
    .from('partidas')
    .select('time_a_id, time_b_id')
    .eq('racha_id', rachaId)

  const idsEmUso = new Set((partidasData ?? []).flatMap((p) => [p.time_a_id, p.time_b_id]))
  const livres = timesAtuais.filter((t) => !idsEmUso.has(t.id))

  if (livres.length > 0) {
    await supabase
      .from('times')
      .delete()
      .in(
        'id',
        livres.map((t) => t.id),
      )
  }

  const { data: novosTimes, error: erroTimes } = await supabase
    .from('times')
    .insert(
      Array.from({ length: numTimes }, (_, i) => ({ racha_id: rachaId, nome: `Time ${i + 1}`, sorteio: true })),
    )
    .select()

  if (erroTimes || !novosTimes) {
    return { erro: erroTimes?.message ?? 'Erro ao criar times' }
  }

  const sorteados = embaralhar(confirmadosIds)
  const gruposDeTimes: string[][] = Array.from({ length: numTimes }, () => [])

  if (racha.modo === 'torneio') {
    sorteados.forEach((jogadorId, i) => {
      gruposDeTimes[i % numTimes].push(jogadorId)
    })
  } else {
    sorteados.slice(0, numTimes * racha.tamanho_equipe).forEach((jogadorId, i) => {
      gruposDeTimes[Math.floor(i / racha.tamanho_equipe)].push(jogadorId)
    })
  }

  for (let i = 0; i < numTimes; i++) {
    const { error } = await supabase
      .from('presencas_racha')
      .update({ time_id: novosTimes[i].id })
      .eq('racha_id', rachaId)
      .in('jogador_id', gruposDeTimes[i])

    if (error) {
      return { erro: error.message }
    }
  }

  return { erro: null }
}
