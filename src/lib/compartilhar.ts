import type { PresencaComJogador, Racha } from './types'

export function gerarTextoCompartilhar(
  racha: Racha,
  confirmados: PresencaComJogador[],
  espera: PresencaComJogador[],
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

  return linhas.join('\n')
}

// tenta o share nativo (abre direto o WhatsApp em mobile); sem suporte, cai pro
// clipboard e quem chamou decide como avisar que copiou.
// texto e url vão em campos separados pro navigator.share: se o link fica
// embutido no meio do texto, o iOS detecta a URL e a extensão de share do
// WhatsApp manda só o link, descartando o resto da mensagem.
export async function compartilhar(texto: string, url?: string): Promise<{ copiado: boolean; erro: string | null }> {
  if (navigator.share) {
    try {
      await navigator.share(url ? { text: texto, url } : { text: texto })
    } catch {
      // usuário cancelou o share, não faz nada
    }
    return { copiado: false, erro: null }
  }

  const textoCompleto = url ? `${texto}\n\n${url}` : texto
  try {
    await navigator.clipboard.writeText(textoCompleto)
    return { copiado: true, erro: null }
  } catch {
    return { copiado: false, erro: 'Não foi possível copiar. Copia manual: ' + textoCompleto }
  }
}
