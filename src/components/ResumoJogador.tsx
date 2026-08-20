import { COLUNAS_MOTIVO, LABEL_MOTIVO, type LinhaMotivo } from '../lib/estatisticas'

// resumo rápido de um jogador: médias (pontos, erros, aproveitamento), % de
// cada motivo — todos comparados com a média do grupo/racha —, sequência
// atual de vitórias/derrotas e melhor parceiro de time
export function ResumoJogador({
  linha,
  todasLinhas,
  streak,
  parceiro,
}: {
  linha: LinhaMotivo
  todasLinhas: LinhaMotivo[]
  streak?: { tipo: 'V' | 'D'; contagem: number } | null
  parceiro?: { nome: string; vitorias: number; jogos: number } | null
}) {
  const mediaPontos = linha.jogos > 0 ? linha.total / linha.jogos : null
  const mediaErros = linha.jogos > 0 ? linha.erros / linha.jogos : null
  const aproveitamento = linha.jogos > 0 ? Math.round((linha.vitorias / linha.jogos) * 100) : null

  // médias do grupo/racha pra comparação — mesma exclusão de "Sem autor" do MVP
  const jogadoresDeVerdade = todasLinhas.filter((l) => l.nome !== 'Sem autor')
  const somaJogos = jogadoresDeVerdade.reduce((acc, l) => acc + l.jogos, 0)
  const somaTotal = jogadoresDeVerdade.reduce((acc, l) => acc + l.total, 0)
  const somaVitorias = jogadoresDeVerdade.reduce((acc, l) => acc + l.vitorias, 0)

  const mediaGrupoPontos = somaJogos > 0 ? somaTotal / somaJogos : null
  const aproveitamentoGrupo = somaJogos > 0 ? Math.round((somaVitorias / somaJogos) * 100) : null

  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-medium text-neutral-200">{linha.nome}</p>

      <div className="grid grid-cols-2 gap-2 text-center text-sm">
        <div>
          <p className="text-neutral-500">Pontos/partida</p>
          <p className="text-lg font-medium">{mediaPontos === null ? '-' : mediaPontos.toFixed(1)}</p>
          {mediaGrupoPontos !== null && (
            <p className="text-xs text-neutral-600">grupo {mediaGrupoPontos.toFixed(1)}</p>
          )}
        </div>
        <div>
          <p className="text-neutral-500">Aproveitamento</p>
          <p className="text-lg font-medium">{aproveitamento === null ? '-' : `${aproveitamento}%`}</p>
          {aproveitamentoGrupo !== null && <p className="text-xs text-neutral-600">grupo {aproveitamentoGrupo}%</p>}
        </div>
        {mediaErros !== null && (
          <div className="col-span-2">
            <p className="text-neutral-500">Erros/partida</p>
            <p className="text-lg font-medium">{mediaErros.toFixed(1)}</p>
          </div>
        )}
      </div>

      {(linha.total > 0 || linha.erros > 0) && (
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-neutral-400">
          {COLUNAS_MOTIVO.map((m) => {
            const qtd = linha.porMotivo[m] ?? 0
            if (qtd === 0 || linha.total === 0) return null
            const pct = Math.round((qtd / linha.total) * 100)

            const somaMotivoGrupo = jogadoresDeVerdade.reduce((acc, l) => acc + (l.porMotivo[m] ?? 0), 0)
            const pctGrupo = somaTotal > 0 ? Math.round((somaMotivoGrupo / somaTotal) * 100) : null

            return (
              <span key={m}>
                {LABEL_MOTIVO[m]} {pct}%{pctGrupo !== null && <span className="text-neutral-600"> (grupo {pctGrupo}%)</span>}
              </span>
            )
          })}
          {linha.erros > 0 && <span className="text-red-400">Erros {linha.erros}</span>}
        </div>
      )}

      {(streak || parceiro) && (
        <div className="space-y-1 border-t border-neutral-800 pt-2 text-center text-xs text-neutral-400">
          {streak && streak.contagem > 1 && (
            <p>
              {streak.tipo === 'V' ? '🔥' : '❄️'} {streak.contagem} {streak.tipo === 'V' ? 'vitórias' : 'derrotas'}{' '}
              seguidas
            </p>
          )}
          {parceiro && (
            <p>
              Melhor parceiro: <span className="text-neutral-200">{parceiro.nome}</span> ({parceiro.vitorias}V
              juntos)
            </p>
          )}
        </div>
      )}
    </div>
  )
}
