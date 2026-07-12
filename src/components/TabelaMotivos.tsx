import { useState } from 'react'
import { COLUNAS_MOTIVO, LABEL_MOTIVO, type LinhaMotivo } from '../lib/estatisticas'
import { compartilharImagem, gerarImagemTabelaMotivos } from '../lib/exportarImagem'

type Coluna = 'nome' | 'jogos' | 'vitorias' | 'total' | (typeof COLUNAS_MOTIVO)[number]

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
  const [ordenarPor, setOrdenarPor] = useState<Coluna>('total')
  const [ordemAsc, setOrdemAsc] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [baixado, setBaixado] = useState(false)

  if (linhas.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum ponto registrado ainda.</p>
  }

  function valorDaColuna(linha: LinhaMotivo, coluna: Coluna) {
    if (coluna === 'nome') return linha.nome
    if (coluna === 'jogos') return linha.jogos
    if (coluna === 'vitorias') return linha.vitorias
    if (coluna === 'total') return linha.total
    return linha.porMotivo[coluna] ?? 0
  }

  function alternarOrdenacao(coluna: Coluna) {
    if (ordenarPor === coluna) {
      setOrdemAsc((asc) => !asc)
    } else {
      setOrdenarPor(coluna)
      setOrdemAsc(coluna === 'nome')
    }
  }

  // MVP = maior Total entre jogadores de verdade, sem depender da ordenação atual da tabela
  const mvpNome = mostrarMvp
    ? [...linhas].filter((l) => l.nome !== 'Sem autor').sort((a, b) => b.total - a.total)[0]?.nome
    : undefined

  // "Sem autor" não representa um jogador de verdade — fica sempre no fim, fora da ordenação
  const linhasOrdenadas = [...linhas]
    .sort((a, b) => {
      const va = valorDaColuna(a, ordenarPor)
      const vb = valorDaColuna(b, ordenarPor)
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return ordemAsc ? cmp : -cmp
    })
    .sort((a, b) => Number(a.nome === 'Sem autor') - Number(b.nome === 'Sem autor'))

  async function handleExportar() {
    setExportando(true)
    try {
      // mesma ordem que a pessoa tá vendo na tela, incluindo a ordenação que ela escolheu
      const blob = await gerarImagemTabelaMotivos(linhasOrdenadas, mvpNome)
      const resultado = await compartilharImagem(blob, 'estatisticas.png')
      if (resultado.baixado) {
        setBaixado(true)
        setTimeout(() => setBaixado(false), 2000)
      }
    } finally {
      setExportando(false)
    }
  }

  function Cabecalho({ coluna, label }: { coluna: Coluna; label: string }) {
    return (
      <th className="px-2 py-2">
        <button
          type="button"
          onClick={() => alternarOrdenacao(coluna)}
          className="flex w-full items-center justify-center gap-1 hover:text-neutral-200"
        >
          {label}
          {ordenarPor === coluna && <span className="text-xs">{ordemAsc ? '▲' : '▼'}</span>}
        </button>
      </th>
    )
  }

  return (
    <div className="space-y-2">
      {mostrarExportar && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleExportar}
            disabled={exportando}
            className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-50"
          >
            {exportando ? 'Gerando...' : baixado ? 'Baixado!' : 'Exportar imagem'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
              {mostrarJogador && <Cabecalho coluna="nome" label="Jogador" />}
              {mostrarJogos && <Cabecalho coluna="jogos" label="Jogos" />}
              {mostrarVitorias && <Cabecalho coluna="vitorias" label="Vitórias" />}
              {COLUNAS_MOTIVO.map((m) => (
                <Cabecalho key={m} coluna={m} label={LABEL_MOTIVO[m]} />
              ))}
              <Cabecalho coluna="total" label="Total" />
            </tr>
          </thead>
          <tbody>
            {linhasOrdenadas.map((linha) => (
              <tr
                key={linha.nome}
                className={`border-b border-neutral-800 last:border-0 ${linha.nome === jogadorSelecionado ? 'bg-neutral-800/60' : ''}`}
              >
                {mostrarJogador && (
                  <td className="whitespace-nowrap px-2 py-2 text-left">
                    {aoClicarJogador && linha.nome !== 'Sem autor' ? (
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
                  </td>
                )}
                {mostrarJogos && <td className="px-2 py-2 text-center">{linha.jogos}</td>}
                {mostrarVitorias && (
                  <td className="px-2 py-2 text-center">{linha.nome === 'Sem autor' ? '-' : linha.vitorias}</td>
                )}
                {COLUNAS_MOTIVO.map((m) => (
                  <td key={m} className="px-2 py-2 text-center">
                    {linha.porMotivo[m] ?? 0}
                  </td>
                ))}
                <td className="px-2 py-2 text-center font-medium">{linha.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
