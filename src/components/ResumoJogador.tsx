import { COLUNAS_MOTIVO, LABEL_MOTIVO, type LinhaMotivo } from '../lib/estatisticas'

// resumo rápido de um jogador: média de pontos por partida, aproveitamento
// (vitórias/jogos) e % de cada motivo dentro do total de pontos dele
export function ResumoJogador({ linha }: { linha: LinhaMotivo }) {
  const mediaPontos = linha.jogos > 0 ? (linha.total / linha.jogos).toFixed(1) : '-'
  const aproveitamento = linha.jogos > 0 ? Math.round((linha.vitorias / linha.jogos) * 100) : null

  return (
    <div className="space-y-2">
      <p className="text-center text-sm font-medium text-neutral-200">{linha.nome}</p>
      <div className="grid grid-cols-2 gap-2 text-center text-sm">
        <div>
          <p className="text-neutral-500">Pontos/partida</p>
          <p className="text-lg font-medium">{mediaPontos}</p>
        </div>
        <div>
          <p className="text-neutral-500">Aproveitamento</p>
          <p className="text-lg font-medium">{aproveitamento === null ? '-' : `${aproveitamento}%`}</p>
        </div>
        {linha.total > 0 && (
          <div className="col-span-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-neutral-400">
            {COLUNAS_MOTIVO.map((m) => {
              const qtd = linha.porMotivo[m] ?? 0
              if (qtd === 0) return null
              const pct = Math.round((qtd / linha.total) * 100)
              return (
                <span key={m}>
                  {LABEL_MOTIVO[m]} {pct}%
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
