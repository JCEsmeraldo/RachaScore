import { COLUNAS_MOTIVO, LABEL_MOTIVO, type LinhaMotivo } from './estatisticas'
import type { ClassificacaoTime } from './types'

const COR_FUNDO = '#0a0a0a'
const COR_LINHA = '#171717'
const COR_BORDA = '#262626'
const COR_TEXTO = '#ffffff'
const COR_TEXTO_FRACO = '#a3a3a3'
const COR_CABECALHO = '#737373'
const COR_MVP_BG = '#78350f'
const COR_MVP_TEXTO = '#fbbf24'
const COR_TOP_BG = '#0c4a6e'
const COR_TOP_TEXTO = '#38bdf8'

const FONTE_TITULO = '600 16px -apple-system, BlinkMacSystemFont, sans-serif'
const FONTE_CABECALHO = '600 15px -apple-system, BlinkMacSystemFont, sans-serif'
const FONTE_CELULA = '15px -apple-system, BlinkMacSystemFont, sans-serif'
const FONTE_CELULA_BOLD = '600 15px -apple-system, BlinkMacSystemFont, sans-serif'
const FONTE_BADGE = '600 11px -apple-system, BlinkMacSystemFont, sans-serif'

const PADDING_CELULA = 16
const ALTURA_LINHA = 44
const ALTURA_CABECALHO = 40
const ESCALA = 2 // retina, fica nítido

const medindo = () => document.createElement('canvas').getContext('2d')!

function largura(ctx: CanvasRenderingContext2D, texto: string, fonte: string) {
  ctx.font = fonte
  return ctx.measureText(texto).width
}

// larguras de coluna: cabe o maior entre cabeçalho e todas as células daquela
// coluna, mais o espaço extra pros selos MVP/TOP na primeira coluna quando precisa
function calcularLargurasColuna(colunas: string[], linhasTexto: string[][], comBadges: boolean) {
  const ctx = medindo()
  return colunas.map((label, i) => {
    const larguraCabecalho = largura(ctx, label, FONTE_CABECALHO)
    const larguraMax = Math.max(
      larguraCabecalho,
      ...linhasTexto.map((linha) => largura(ctx, linha[i], i === 0 ? FONTE_CELULA_BOLD : FONTE_CELULA)),
    )
    // reserva espaço pros dois selos (MVP + TOP) — mesmo quando só um aparece
    // por linha, a coluna precisa caber a linha mais "cheia"
    const larguraBadge = i === 0 && comBadges ? 90 : 0
    return larguraMax + PADDING_CELULA * 2 + larguraBadge
  })
}

// desenha cabeçalho + linhas de uma tabela dentro do card (fundo COR_LINHA já
// desenhado por quem chama), começando em (0, y0) — devolve a altura usada
function desenharTabela(
  ctx: CanvasRenderingContext2D,
  y0: number,
  larguraTotal: number,
  colunas: string[],
  largurasColuna: number[],
  linhasTexto: string[][],
  opts: { mvpNome?: string; pontuadorNome?: string; nomesLinha?: string[] } = {},
): number {
  let x = 0
  ctx.font = FONTE_CABECALHO
  ctx.fillStyle = COR_CABECALHO
  ctx.textBaseline = 'middle'
  colunas.forEach((label, i) => {
    ctx.textAlign = i === 0 ? 'left' : 'center'
    const cx = i === 0 ? x + PADDING_CELULA : x + largurasColuna[i] / 2
    ctx.fillText(label, cx, y0 + ALTURA_CABECALHO / 2)
    x += largurasColuna[i]
  })

  ctx.strokeStyle = COR_BORDA
  ctx.beginPath()
  ctx.moveTo(0, y0 + ALTURA_CABECALHO)
  ctx.lineTo(larguraTotal, y0 + ALTURA_CABECALHO)
  ctx.stroke()

  linhasTexto.forEach((linha, linhaIdx) => {
    const y = y0 + ALTURA_CABECALHO + linhaIdx * ALTURA_LINHA
    const nomeLinha = opts.nomesLinha?.[linhaIdx]
    const badges: { texto: string; corBg: string; corTexto: string }[] = []
    if (nomeLinha && nomeLinha === opts.mvpNome) badges.push({ texto: 'MVP', corBg: COR_MVP_BG, corTexto: COR_MVP_TEXTO })
    if (nomeLinha && nomeLinha === opts.pontuadorNome && nomeLinha !== opts.mvpNome) {
      badges.push({ texto: 'TOP', corBg: COR_TOP_BG, corTexto: COR_TOP_TEXTO })
    }

    x = 0
    linha.forEach((valor, i) => {
      ctx.font = i === 0 ? FONTE_CELULA_BOLD : FONTE_CELULA
      ctx.fillStyle = i === 0 ? COR_TEXTO : COR_TEXTO_FRACO
      ctx.textAlign = i === 0 ? 'left' : 'center'

      if (i === 0 && badges.length > 0 && nomeLinha) {
        ctx.fillStyle = COR_TEXTO
        ctx.fillText(nomeLinha, x + PADDING_CELULA, y + ALTURA_LINHA / 2)
        const larguraNome = largura(ctx, nomeLinha, FONTE_CELULA_BOLD)

        let badgeX = x + PADDING_CELULA + larguraNome + 8
        for (const badge of badges) {
          const badgeLargura = largura(ctx, badge.texto, FONTE_BADGE) + 14
          ctx.fillStyle = badge.corBg
          ctx.beginPath()
          ;(ctx as any).roundRect(badgeX, y + ALTURA_LINHA / 2 - 10, badgeLargura, 20, 10)
          ctx.fill()
          ctx.font = FONTE_BADGE
          ctx.fillStyle = badge.corTexto
          ctx.textAlign = 'left'
          ctx.fillText(badge.texto, badgeX + 7, y + ALTURA_LINHA / 2 + 1)
          badgeX += badgeLargura + 6
        }
      } else {
        const cx = i === 0 ? x + PADDING_CELULA : x + largurasColuna[i] / 2
        ctx.fillText(valor, cx, y + ALTURA_LINHA / 2)
      }

      x += largurasColuna[i]
    })

    if (linhaIdx < linhasTexto.length - 1) {
      ctx.strokeStyle = COR_BORDA
      ctx.beginPath()
      ctx.moveTo(0, y + ALTURA_LINHA)
      ctx.lineTo(larguraTotal, y + ALTURA_LINHA)
      ctx.stroke()
    }
  })

  return ALTURA_CABECALHO + linhasTexto.length * ALTURA_LINHA
}

function linhasMotivosParaTexto(linhas: LinhaMotivo[], mvpNome?: string, pontuadorNome?: string) {
  const colunas = ['Jogador', 'Jogos', 'Vitórias', ...COLUNAS_MOTIVO.map((m) => LABEL_MOTIVO[m]), 'Erros', 'Total']
  const linhasTexto = linhas.map((l) => [
    l.nome,
    String(l.jogos),
    l.nome === 'Sem autor' ? '-' : String(l.vitorias),
    ...COLUNAS_MOTIVO.map((m) => String(l.porMotivo[m] ?? 0)),
    l.nome === 'Sem autor' ? '-' : String(l.erros),
    String(l.total),
  ])
  return { colunas, linhasTexto, nomesLinha: linhas.map((l) => l.nome), comBadges: !!mvpNome || !!pontuadorNome }
}

function classificacaoParaTexto(classificacao: ClassificacaoTime[]) {
  const colunas = ['Time', 'J', 'V', 'E', 'D', 'SG', 'Pts']
  const linhasTexto = classificacao.map((c) => [
    c.time_nome,
    String(c.jogos),
    String(c.vitorias),
    String(c.empates),
    String(c.derrotas),
    String(c.saldo),
    String(c.pontos),
  ])
  return { colunas, linhasTexto, comBadgeMvp: false }
}

function finalizarCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Erro ao gerar imagem'))), 'image/png')
  })
}

// desenha a tabela num canvas (sem libs externas) e devolve um PNG — assim
// dá pra compartilhar/baixar a imagem inteira, sem cortar coluna como o print
// de tela cortava quando a tabela era mais larga que a viewport
export async function gerarImagemTabelaMotivos(
  linhas: LinhaMotivo[],
  mvpNome?: string,
  pontuadorNome?: string,
): Promise<Blob> {
  const { colunas, linhasTexto, nomesLinha, comBadges } = linhasMotivosParaTexto(linhas, mvpNome, pontuadorNome)
  const largurasColuna = calcularLargurasColuna(colunas, linhasTexto, comBadges)
  const larguraTotal = largurasColuna.reduce((a, b) => a + b, 0)
  const alturaTabela = ALTURA_CABECALHO + linhasTexto.length * ALTURA_LINHA
  const alturaTotal = alturaTabela + 24

  const canvas = document.createElement('canvas')
  canvas.width = larguraTotal * ESCALA
  canvas.height = alturaTotal * ESCALA
  const ctx = canvas.getContext('2d')!
  ctx.scale(ESCALA, ESCALA)

  ctx.fillStyle = COR_FUNDO
  ctx.fillRect(0, 0, larguraTotal, alturaTotal)
  ctx.fillStyle = COR_LINHA
  ctx.fillRect(0, 12, larguraTotal, alturaTotal - 24)

  desenharTabela(ctx, 12, larguraTotal, colunas, largurasColuna, linhasTexto, { mvpNome, pontuadorNome, nomesLinha })

  return finalizarCanvas(canvas)
}

// tabela de classificação do campeonato (torneio)
export async function gerarImagemClassificacao(classificacao: ClassificacaoTime[]): Promise<Blob> {
  const { colunas, linhasTexto } = classificacaoParaTexto(classificacao)
  const largurasColuna = calcularLargurasColuna(colunas, linhasTexto, false)
  const larguraTotal = largurasColuna.reduce((a, b) => a + b, 0)
  const alturaTabela = ALTURA_CABECALHO + linhasTexto.length * ALTURA_LINHA
  const alturaTotal = alturaTabela + 24

  const canvas = document.createElement('canvas')
  canvas.width = larguraTotal * ESCALA
  canvas.height = alturaTotal * ESCALA
  const ctx = canvas.getContext('2d')!
  ctx.scale(ESCALA, ESCALA)

  ctx.fillStyle = COR_FUNDO
  ctx.fillRect(0, 0, larguraTotal, alturaTotal)
  ctx.fillStyle = COR_LINHA
  ctx.fillRect(0, 12, larguraTotal, alturaTotal - 24)

  desenharTabela(ctx, 12, larguraTotal, colunas, largurasColuna, linhasTexto)

  return finalizarCanvas(canvas)
}

// classificação + estatísticas empilhadas numa imagem só, cada uma com seu
// título — pra compartilhar as duas tabelas do campeonato de uma vez
export async function gerarImagemCombinada(
  classificacao: ClassificacaoTime[],
  linhasMotivos: LinhaMotivo[],
  mvpNome?: string,
  pontuadorNome?: string,
): Promise<Blob> {
  const class_ = classificacaoParaTexto(classificacao)
  const motivos = linhasMotivosParaTexto(linhasMotivos, mvpNome, pontuadorNome)

  const largurasClass = calcularLargurasColuna(class_.colunas, class_.linhasTexto, false)
  const largurasMotivos = calcularLargurasColuna(motivos.colunas, motivos.linhasTexto, motivos.comBadges)

  const larguraTotal = Math.max(
    largurasClass.reduce((a, b) => a + b, 0),
    largurasMotivos.reduce((a, b) => a + b, 0),
  )

  const ALTURA_TITULO = 32
  const GAP_ENTRE_TABELAS = 20

  const alturaClass = ALTURA_CABECALHO + class_.linhasTexto.length * ALTURA_LINHA
  const alturaMotivos = ALTURA_CABECALHO + motivos.linhasTexto.length * ALTURA_LINHA

  const alturaTotal =
    12 + ALTURA_TITULO + alturaClass + 12 + GAP_ENTRE_TABELAS + 12 + ALTURA_TITULO + alturaMotivos + 12 + 12

  const canvas = document.createElement('canvas')
  canvas.width = larguraTotal * ESCALA
  canvas.height = alturaTotal * ESCALA
  const ctx = canvas.getContext('2d')!
  ctx.scale(ESCALA, ESCALA)

  ctx.fillStyle = COR_FUNDO
  ctx.fillRect(0, 0, larguraTotal, alturaTotal)

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = FONTE_TITULO
  ctx.fillStyle = COR_TEXTO

  let y = 0

  ctx.fillText('Classificação', 0, y + ALTURA_TITULO / 2)
  y += ALTURA_TITULO

  ctx.fillStyle = COR_LINHA
  ctx.fillRect(0, y + 12, larguraTotal, alturaClass)
  desenharTabela(ctx, y + 12, larguraTotal, class_.colunas, largurasClass, class_.linhasTexto)
  y += 12 + alturaClass + 12 + GAP_ENTRE_TABELAS

  ctx.font = FONTE_TITULO
  ctx.fillStyle = COR_TEXTO
  ctx.fillText('Estatísticas', 0, y + ALTURA_TITULO / 2)
  y += ALTURA_TITULO

  ctx.fillStyle = COR_LINHA
  ctx.fillRect(0, y + 12, larguraTotal, alturaMotivos)
  desenharTabela(ctx, y + 12, larguraTotal, motivos.colunas, largurasMotivos, motivos.linhasTexto, {
    mvpNome,
    pontuadorNome,
    nomesLinha: motivos.nomesLinha,
  })

  return finalizarCanvas(canvas)
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
