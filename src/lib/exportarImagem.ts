import { COLUNAS_MOTIVO, LABEL_MOTIVO, type LinhaMotivo } from './estatisticas'

const COR_FUNDO = '#0a0a0a'
const COR_LINHA = '#171717'
const COR_BORDA = '#262626'
const COR_TEXTO = '#ffffff'
const COR_TEXTO_FRACO = '#a3a3a3'
const COR_CABECALHO = '#737373'
const COR_MVP_BG = '#78350f'
const COR_MVP_TEXTO = '#fbbf24'

const FONTE_CABECALHO = '600 15px -apple-system, BlinkMacSystemFont, sans-serif'
const FONTE_CELULA = '15px -apple-system, BlinkMacSystemFont, sans-serif'
const FONTE_CELULA_BOLD = '600 15px -apple-system, BlinkMacSystemFont, sans-serif'
const FONTE_BADGE = '600 11px -apple-system, BlinkMacSystemFont, sans-serif'

// desenha a tabela num canvas (sem libs externas) e devolve um PNG — assim
// dá pra compartilhar/baixar a imagem inteira, sem cortar coluna como o print
// de tela cortava quando a tabela era mais larga que a viewport
export async function gerarImagemTabelaMotivos(linhas: LinhaMotivo[], mvpNome?: string): Promise<Blob> {
  const colunas = ['Jogador', 'Jogos', 'Vitórias', ...COLUNAS_MOTIVO.map((m) => LABEL_MOTIVO[m]), 'Total']

  const linhasTexto = linhas.map((l) => [
    l.nome + (l.nome === mvpNome ? ' MVP' : ''),
    String(l.jogos),
    l.nome === 'Sem autor' ? '-' : String(l.vitorias),
    ...COLUNAS_MOTIVO.map((m) => String(l.porMotivo[m] ?? 0)),
    String(l.total),
  ])

  const medindo = document.createElement('canvas').getContext('2d')!
  const paddingCelula = 16
  const alturaLinha = 44
  const alturaCabecalho = 40

  function largura(texto: string, fonte: string) {
    medindo.font = fonte
    return medindo.measureText(texto).width
  }

  const largurasColuna = colunas.map((label, i) => {
    const larguraCabecalho = largura(label, FONTE_CABECALHO)
    const larguraMax = Math.max(
      larguraCabecalho,
      ...linhasTexto.map((linha) => largura(linha[i], i === 0 ? FONTE_CELULA_BOLD : FONTE_CELULA)),
    )
    const larguraBadge = i === 0 ? 44 : 0 // espaço extra pro selo MVP
    return larguraMax + paddingCelula * 2 + larguraBadge
  })

  const larguraTotal = largurasColuna.reduce((a, b) => a + b, 0)
  const alturaTotal = alturaCabecalho + linhasTexto.length * alturaLinha + 24

  const escala = 2 // retina, fica nítido
  const canvas = document.createElement('canvas')
  canvas.width = larguraTotal * escala
  canvas.height = alturaTotal * escala
  const ctx = canvas.getContext('2d')!
  ctx.scale(escala, escala)

  ctx.fillStyle = COR_FUNDO
  ctx.fillRect(0, 0, larguraTotal, alturaTotal)

  ctx.fillStyle = COR_LINHA
  ctx.fillRect(0, 12, larguraTotal, alturaTotal - 24)

  // cabeçalho
  let x = 0
  ctx.font = FONTE_CABECALHO
  ctx.fillStyle = COR_CABECALHO
  ctx.textBaseline = 'middle'
  colunas.forEach((label, i) => {
    ctx.textAlign = i === 0 ? 'left' : 'center'
    const cx = i === 0 ? x + paddingCelula : x + largurasColuna[i] / 2
    ctx.fillText(label, cx, 12 + alturaCabecalho / 2)
    x += largurasColuna[i]
  })

  ctx.strokeStyle = COR_BORDA
  ctx.beginPath()
  ctx.moveTo(0, 12 + alturaCabecalho)
  ctx.lineTo(larguraTotal, 12 + alturaCabecalho)
  ctx.stroke()

  // linhas
  linhasTexto.forEach((linha, linhaIdx) => {
    const y = 12 + alturaCabecalho + linhaIdx * alturaLinha
    const ehMvp = linhas[linhaIdx].nome === mvpNome

    x = 0
    linha.forEach((valor, i) => {
      ctx.font = i === 0 ? FONTE_CELULA_BOLD : FONTE_CELULA
      ctx.fillStyle = i === 0 ? COR_TEXTO : COR_TEXTO_FRACO
      ctx.textAlign = i === 0 ? 'left' : 'center'

      if (i === 0 && ehMvp) {
        const nome = linhas[linhaIdx].nome
        ctx.fillStyle = COR_TEXTO
        ctx.fillText(nome, x + paddingCelula, y + alturaLinha / 2)
        const larguraNome = largura(nome, FONTE_CELULA_BOLD)

        const badgeX = x + paddingCelula + larguraNome + 8
        const badgeLargura = largura('MVP', FONTE_BADGE) + 14
        ctx.fillStyle = COR_MVP_BG
        ctx.beginPath()
        ;(ctx as any).roundRect(badgeX, y + alturaLinha / 2 - 10, badgeLargura, 20, 10)
        ctx.fill()
        ctx.font = FONTE_BADGE
        ctx.fillStyle = COR_MVP_TEXTO
        ctx.textAlign = 'left'
        ctx.fillText('MVP', badgeX + 7, y + alturaLinha / 2 + 1)
      } else {
        const cx = i === 0 ? x + paddingCelula : x + largurasColuna[i] / 2
        ctx.fillText(valor, cx, y + alturaLinha / 2)
      }

      x += largurasColuna[i]
    })

    if (linhaIdx < linhasTexto.length - 1) {
      ctx.strokeStyle = COR_BORDA
      ctx.beginPath()
      ctx.moveTo(0, y + alturaLinha)
      ctx.lineTo(larguraTotal, y + alturaLinha)
      ctx.stroke()
    }
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Erro ao gerar imagem'))), 'image/png')
  })
}

// tenta compartilhar o arquivo direto (mobile abre a folha de compartilhar
// com WhatsApp já na lista); sem suporte, baixa o PNG pra compartilhar manual
export async function compartilharImagem(blob: Blob, nomeArquivo: string): Promise<{ baixado: boolean }> {
  const arquivo = new File([blob], nomeArquivo, { type: 'image/png' })

  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo] })
      return { baixado: false }
    } catch {
      // usuário cancelou, não faz nada
      return { baixado: false }
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
  return { baixado: true }
}
