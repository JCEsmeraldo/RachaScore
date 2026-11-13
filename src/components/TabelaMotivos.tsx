import { useState } from 'react'
import {
  COLUNAS_MOTIVO,
  MIN_JOGOS_MEDIA,
  SEM_AUTOR,
  calcularMvpEPontuador,
  formatarValorColuna,
  labelColuna,
  ordenarLinhas,
  valorColuna,
  type ColunaTabela,
  type LinhaMotivo,
  type VisaoTabela,
} from '../lib/estatisticas'
import { compartilharImagem, gerarImagemTabelaMotivos } from '../lib/exportarImagem'

export function TabelaMotivos({
  linhas,
  mostrarJogador = true,
  mostrarJogos = true,
  mostrarVitorias = true,
  mostrarMvp = false,
  mostrarExportar = false,
  aoClicarJogador,
  jogadorSelecionado,
}: {
  linhas: LinhaMotivo[]
  mostrarJogador?: boolean
  mostrarJogos?: boolean
  mostrarVitorias?: boolean
  mostrarMvp?: boolean
  mostrarExportar?: boolean
  aoClicarJogador?: (nome: string) => void
  jogadorSelecionado?: string | null
}) {
  // a última coluna é sempre o Saldo e é ela que ordena por padrão
  const [ordenarPor, setOrdenarPor] = useState<ColunaTabela>('saldo')
  const [ordemAsc, setOrdemAsc] = useState(false)
  const [visao, setVisao] = useState<VisaoTabela>('total')
  const [exportando, setExportando] = useState(false)
  const [baixado, setBaixado] = useState(false)

  if (linhas.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum ponto registrado ainda.</p>
  }

  // média por jogo só faz sentido onde a tabela mostra a coluna de jogos
  // (súmula de uma partida e tela do jogador não têm "por jogo")
  const permiteVisao = mostrarJogos
  const visaoAtiva: VisaoTabela = permiteVisao ? visao : 'total'

  function alternarOrdenacao(coluna: ColunaTabela) {
    if (ordenarPor === coluna) {
      setOrdemAsc((asc) => !asc)
    } else {
      setOrdenarPor(coluna)
      setOrdemAsc(coluna === 'nome')
    }
  }

  const { mvpNome, pontuadorNome } = mostrarMvp
    ? calcularMvpEPontuador(linhas)
    : { mvpNome: undefined, pontuadorNome: undefined }

  const linhasOrdenadas = ordenarLinhas(linhas, ordenarPor, ordemAsc, visaoAtiva)

  async function handleExportar() {
    setExportando(true)
    try {
      // mesma ordem e mesma visão que a pessoa tá vendo na tela
      const blob = await gerarImagemTabelaMotivos(linhasOrdenadas, mvpNome, pontuadorNome, visaoAtiva)
      const resultado = await compartilharImagem(blob, 'estatisticas.png')
      if (resultado.baixado) {
        setBaixado(true)
        setTimeout(() => setBaixado(false), 2000)
      }
    } finally {
      setExportando(false)
    }
  }

  function Cabecalho({ coluna }: { coluna: ColunaTabela }) {
    return (
      <th className="px-2 py-2">
        <button
          type="button"
          onClick={() => alternarOrdenacao(coluna)}
          className="flex w-full items-center justify-center gap-1 hover:text-neutral-200"
        >
          {labelColuna(coluna, visaoAtiva)}
          {ordenarPor === coluna && <span className="text-xs">{ordemAsc ? '▲' : '▼'}</span>}
        </button>
      </th>
    )
  }

  function Celula({ linha, coluna, forte = false }: { linha: LinhaMotivo; coluna: ColunaTabela; forte?: boolean }) {
    return (
      <td className={`px-2 py-2 text-center ${forte ? 'font-medium' : ''}`}>
        {formatarValorColuna(valorColuna(linha, coluna, visaoAtiva), coluna, visaoAtiva)}
      </td>
    )
  }

  return (
    <div className="space-y-2">
      {(permiteVisao || mostrarExportar) && (
        <div className="flex items-center justify-between gap-2">
          {permiteVisao ? (
            <div className="flex rounded-lg border border-neutral-700 p-0.5 text-xs">
              {(
                [
                  ['total', 'Total'],
                  ['porJogo', 'Média por jogo'],
                ] as const
              ).map(([valor, label]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setVisao(valor)}
                  className={`rounded-md px-2 py-1 ${
                    visaoAtiva === valor ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          {mostrarExportar && (
            <button
              type="button"
              onClick={handleExportar}
              disabled={exportando}
              className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-50"
            >
              {exportando ? 'Gerando...' : baixado ? 'Baixado!' : 'Exportar imagem'}
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
              {mostrarJogador && <Cabecalho coluna="nome" />}
              {mostrarJogos && <Cabecalho coluna="jogos" />}
              {mostrarVitorias && <Cabecalho coluna="vitorias" />}
              {COLUNAS_MOTIVO.map((m) => (
                <Cabecalho key={m} coluna={m} />
              ))}
              <Cabecalho coluna="total" />
              <Cabecalho coluna="erros" />
              <Cabecalho coluna="saldo" />
            </tr>
          </thead>
          <tbody>
            {linhasOrdenadas.map((linha) => {
              // poucos jogos: média pouco confiável, esmaece
              const poucosJogos = visaoAtiva === 'porJogo' && linha.nome !== SEM_AUTOR && linha.jogos < MIN_JOGOS_MEDIA

              return (
                <tr
                  key={linha.nome}
                  title={poucosJogos ? `Menos de ${MIN_JOGOS_MEDIA} jogos — média pouco confiável` : undefined}
                  className={`border-b border-neutral-800 last:border-0 ${linha.nome === jogadorSelecionado ? 'bg-neutral-800/60' : ''} ${poucosJogos ? 'opacity-50' : ''}`}
                >
                  {mostrarJogador && (
                    <td className="whitespace-nowrap px-2 py-2 text-left">
                      {aoClicarJogador && linha.nome !== SEM_AUTOR ? (
                        <button
                          type="button"
                          onClick={() => aoClicarJogador(linha.nome)}
                          className="text-left text-neutral-100 hover:text-emerald-400"
                        >
                          {linha.nome}
                        </button>
                      ) : (
                        linha.nome
                      )}
                      {linha.nome === mvpNome && (
                        <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-400">
                          MVP
                        </span>
                      )}
                      {linha.nome === pontuadorNome && linha.nome !== mvpNome && (
                        <span className="ml-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-xs text-sky-400">
                          TOP
                        </span>
                      )}
                    </td>
                  )}
                  {mostrarJogos && <Celula linha={linha} coluna="jogos" />}
                  {mostrarVitorias && <Celula linha={linha} coluna="vitorias" />}
                  {COLUNAS_MOTIVO.map((m) => (
                    <Celula key={m} linha={linha} coluna={m} />
                  ))}
                  <Celula linha={linha} coluna="total" />
                  <Celula linha={linha} coluna="erros" />
                  <Celula linha={linha} coluna="saldo" forte />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
