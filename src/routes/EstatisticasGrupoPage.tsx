import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { montarTabelaMotivos, type LinhaMotivo } from '../lib/estatisticas'
import { TabelaMotivos } from '../components/TabelaMotivos'

type EventoParaMotivo = {
  partida_id: string
  jogador_id: string | null
  motivo: string | null
  jogadores: { nome: string } | null
}

type StatsModalidade = {
  totalRachas: number
  totalPartidas: number
  pontuadores: { nome: string; total: number }[]
  motivos: LinhaMotivo[]
}

function statsVazio(): StatsModalidade {
  return { totalRachas: 0, totalPartidas: 0, pontuadores: [], motivos: [] }
}

export function EstatisticasGrupoPage() {
  const { grupoId } = useParams<{ grupoId: string }>()

  const [futebol, setFutebol] = useState<StatsModalidade>(statsVazio())
  const [volei, setVolei] = useState<StatsModalidade>(statsVazio())
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      if (!grupoId) return
      setLoading(true)

      const { data: rachasData, error: erroRachas } = await supabase
        .from('rachas')
        .select('id, modalidade')
        .eq('grupo_id', grupoId)

      if (erroRachas) {
        setErro(erroRachas.message)
        setLoading(false)
        return
      }

      const rachas = rachasData ?? []
      const rachaModalidade = new Map(rachas.map((r) => [r.id, r.modalidade]))
      const rachaIds = rachas.map((r) => r.id)

      if (rachaIds.length === 0) {
        setLoading(false)
        return
      }

      const { data: partidasData, error: erroPartidas } = await supabase
        .from('partidas')
        .select('id, racha_id, status')
        .in('racha_id', rachaIds)

      if (erroPartidas) {
        setErro(erroPartidas.message)
        setLoading(false)
        return
      }

      const partidas = partidasData ?? []
      const partidaModalidade = new Map(partidas.map((p) => [p.id, rachaModalidade.get(p.racha_id)]))
      const partidaIds = partidas.map((p) => p.id)

      const contadores = {
        futebol: { rachas: new Set<string>(), partidasFinalizadas: 0, pontuadores: new Map<string, number>() },
        volei: {
          rachas: new Set<string>(),
          partidasFinalizadas: 0,
          pontuadores: new Map<string, number>(),
          eventos: [] as EventoParaMotivo[],
        },
      }

      for (const racha of rachas) {
        const modalidade = racha.modalidade as 'futebol' | 'volei'
        contadores[modalidade].rachas.add(racha.id)
      }

      for (const partida of partidas) {
        if (partida.status !== 'finalizada') continue
        const modalidade = partidaModalidade.get(partida.id) as 'futebol' | 'volei' | undefined
        if (modalidade) contadores[modalidade].partidasFinalizadas += 1
      }

      if (partidaIds.length > 0) {
        const { data: eventosData, error: erroEventos } = await supabase
          .from('eventos_ponto')
          .select('partida_id, jogador_id, motivo, jogadores!eventos_ponto_jogador_id_fkey(nome)')
          .in('partida_id', partidaIds)

        if (erroEventos) {
          setErro(erroEventos.message)
        } else {
          const eventos = (eventosData ?? []) as unknown as EventoParaMotivo[]

          for (const ev of eventos) {
            const modalidade = partidaModalidade.get(ev.partida_id) as 'futebol' | 'volei' | undefined
            if (!modalidade) continue

            if (ev.jogador_id && ev.jogadores) {
              const mapa = contadores[modalidade].pontuadores
              mapa.set(ev.jogadores.nome, (mapa.get(ev.jogadores.nome) ?? 0) + 1)
            }

            if (modalidade === 'volei') {
              contadores.volei.eventos.push(ev)
            }
          }
        }
      }

      setFutebol({
        totalRachas: contadores.futebol.rachas.size,
        totalPartidas: contadores.futebol.partidasFinalizadas,
        pontuadores: [...contadores.futebol.pontuadores.entries()]
          .map(([nome, total]) => ({ nome, total }))
          .sort((a, b) => b.total - a.total),
        motivos: [],
      })

      setVolei({
        totalRachas: contadores.volei.rachas.size,
        totalPartidas: contadores.volei.partidasFinalizadas,
        pontuadores: [...contadores.volei.pontuadores.entries()]
          .map(([nome, total]) => ({ nome, total }))
          .sort((a, b) => b.total - a.total),
        motivos: montarTabelaMotivos(contadores.volei.eventos),
      })

      setLoading(false)
    }

    carregar()
  }, [grupoId])

  function renderModalidade(nome: string, stats: StatsModalidade, labelPontuador: string, mostrarMotivo: boolean) {
    if (stats.totalRachas === 0) return null

    return (
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div>
          <h2 className="text-lg font-semibold">{nome}</h2>
          <p className="text-sm text-neutral-400">
            {stats.totalRachas} racha{stats.totalRachas === 1 ? '' : 's'} · {stats.totalPartidas} partida
            {stats.totalPartidas === 1 ? '' : 's'} finalizada{stats.totalPartidas === 1 ? '' : 's'}
          </p>
        </div>

        {!mostrarMotivo && (
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-neutral-400">{labelPontuador}</h3>
            {stats.pontuadores.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhum ponto com autor registrado ainda.</p>
            ) : (
              <ul className="space-y-1">
                {stats.pontuadores.map((p) => (
                  <li key={p.nome} className="flex items-center justify-between text-sm">
                    <span>{p.nome}</span>
                    <span className="text-neutral-400">{p.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mostrarMotivo && (
          <div className="space-y-1">
            <TabelaMotivos linhas={stats.motivos} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header>
          <Link to={`/grupos/${grupoId}`} className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Voltar
          </Link>
          <h1 className="text-xl font-semibold">Estatísticas do grupo</h1>
        </header>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : futebol.totalRachas === 0 && volei.totalRachas === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum racha ainda.</p>
        ) : (
          <>
            {renderModalidade('Futebol', futebol, 'Artilheiros', false)}
            {renderModalidade('Vôlei', volei, 'Maiores pontuadores', true)}
          </>
        )}
      </div>
    </div>
  )
}
