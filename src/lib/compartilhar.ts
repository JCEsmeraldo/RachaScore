import type { PresencaComJogador, Racha } from './types'

export function gerarTextoCompartilhar(
  racha: Racha,
  confirmados: PresencaComJogador[],
  espera: PresencaComJogador[],
  linkConvite: string | null,
) {
  const emoji = racha.modalidade === 'volei' ? '🏐' : '⚽'
  const linhas = [
    `${emoji} ${racha.modalidade === 'volei' ? 'Vôlei' : 'Futebol'} — ${racha.modo === 'torneio' ? 'Torneio' : 'Jogo rápido'}`,
    `📅 ${new Date(racha.data_hora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`,
  ]

  if (racha.local) linhas.push(`📍 ${racha.local}`)

  linhas.push('')
  linhas.push(
    `Confirmados (${confirmados.length}${racha.limite_jogadores ? `/${racha.limite_jogadores}` : ''}):`,
  )
  linhas.push(
    ...(confirmados.length > 0
      ? confirmados.map((p, i) => `${i + 1}. ${p.jogadores?.nome ?? '(sem nome)'}`)
      : ['(ninguém confirmado ainda)']),
  )

  if (espera.length > 0) {
    linhas.push('')
    linhas.push('Na fila de espera:')
    linhas.push(...espera.map((p, i) => `${i + 1}. ${p.jogadores?.nome ?? '(sem nome)'}`))
  }

  if (linkConvite) {
    linhas.push('')
    linhas.push(`🔗 Confirme presença ou entre no grupo: ${linkConvite}`)
  }

  return linhas.join('\n')
}

// tenta o share nativo (abre direto o WhatsApp em mobile); sem suporte, cai pro
// clipboard e quem chamou decide como avisar que copiou
export async function compartilhar(texto: string): Promise<{ copiado: boolean; erro: string | null }> {
  if (navigator.share) {
    try {
      await navigator.share({ text: texto })
    } catch {
      // usuário cancelou o share, não faz nada
    }
    return { copiado: false, erro: null }
  }

  try {
    await navigator.clipboard.writeText(texto)
    return { copiado: true, erro: null }
  } catch {
    return { copiado: false, erro: 'Não foi possível copiar. Copia manual: ' + texto }
  }
}
