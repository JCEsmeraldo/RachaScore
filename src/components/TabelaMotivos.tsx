import { useState } from 'react'
import { COLUNAS_MOTIVO, LABEL_MOTIVO, type LinhaMotivo } from '../lib/estatisticas'

type Coluna = 'nome' | 'jogos' | 'total' | (typeof COLUNAS_MOTIVO)[number]

export function TabelaMotivos({
  linhas,
  mostrarJogador = true,
  mostrarJogos = true,
}: {
  linhas: LinhaMotivo[]
  mostrarJogador?: boolean
  mostrarJogos?: boolean
}) {
  const [ordenarPor, setOrdenarPor] = useState<Coluna>('total')
  const [ordemAsc, setOrdemAsc] = useState(false)

  if (linhas.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum ponto registrado ainda.</p>
  }

  function valorDaColuna(linha: LinhaMotivo, coluna: Coluna) {
    if (coluna === 'nome') return linha.nome
    if (coluna === 'jogos') return linha.jogos
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

  // "Sem autor" não representa um jogador de verdade — fica sempre no fim, fora da ordenação
  const linhasOrdenadas = [...linhas]
    .sort((a, b) => {
      const va = valorDaColuna(a, ordenarPor)
      const vb = valorDaColuna(b, ordenarPor)
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return ordemAsc ? cmp : -cmp
    })
    .sort((a, b) => Number(a.nome === 'Sem autor') - Number(b.nome === 'Sem autor'))

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
    <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-neutral-500">
            {mostrarJogador && <Cabecalho coluna="nome" label="Jogador" />}
            {mostrarJogos && <Cabecalho coluna="jogos" label="Jogos" />}
            {COLUNAS_MOTIVO.map((m) => (
              <Cabecalho key={m} coluna={m} label={LABEL_MOTIVO[m]} />
            ))}
            <Cabecalho coluna="total" label="Total" />
          </tr>
        </thead>
        <tbody>
          {linhasOrdenadas.map((linha) => (
            <tr key={linha.nome} className="border-b border-neutral-800 last:border-0">
              {mostrarJogador && <td className="px-2 py-2 text-left">{linha.nome}</td>}
              {mostrarJogos && <td className="px-2 py-2 text-center">{linha.jogos}</td>}
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
  )
}
