import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { contarJogosEVitorias, montarTabelaMotivos, type LinhaMotivo } from '../lib/estatisticas'
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
  const [eventosVolei, setEventosVolei] = useState<EventoParaMotivo[]>([])
  const [partidaRacha, setPartidaRacha] = useState<Map<string, string>>(new Map())
  const [rachaDataHora, setRachaDataHora] = useState<Map<string, string>>(new Map())
  const [jogadorAberto, setJogadorAberto] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      if (!grupoId) return
      setLoading(true)

      const { data: rachasData, error: erroRachas } = await supabase
        .from('rachas')
        .select('id, modalidade, data_hora')
        .eq('grupo_id', grupoId)

      if (erroRachas) {
        setErro(erroRachas.message)
        setLoading(false)
        return
      }

      const rachas = rachasData ?? []
      const rachaModalidade = new Map(rachas.map((r) => [r.id, r.modalidade]))
      const rachaIds = rachas.map((r) => r.id)
      setRachaDataHora(new Map(rachas.map((r) => [r.id, r.data_hora])))

      if (rachaIds.length === 0) {
        setLoading(false)
        return
      }

      const { data: partidasData, error: erroPartidas } = await supabase
        .from('partidas')
        .select('id, racha_id, time_a_id, time_b_id, vencedor_id, status')
        .in('racha_id', rachaIds)

      if (erroPartidas) {
        setErro(erroPartidas.message)
        setLoading(false)
        return
      }

      const partidas = partidasData ?? []
      const partidaModalidade = new Map(partidas.map((p) => [p.id, rachaModalidade.get(p.racha_id)]))
      const partidaIds = partidas.map((p) => p.id)
      setPartidaRacha(new Map(partidas.map((p) => [p.id, p.racha_id])))

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

      let motivosVolei: LinhaMotivo[] = []

      if (partidaIds.length > 0) {
        const [{ data: eventosData, error: erroEventos }, { data: escalacoesData }, { data: presencasData }] =
          await Promise.all([
            supabase
              .from('eventos_ponto')
              .select('partida_id, jogador_id, motivo, jogadores!eventos_ponto_jogador_id_fkey(nome)')
              .in('partida_id', partidaIds),
            supabase
              .from('escalacoes_partida')
              .select('partida_id, jogador_id, time_id')
              .in('partida_id', partidaIds),
            supabase
              .from('presencas_racha')
              .select('racha_id, jogador_id, time_id, jogadores(nome)')
              .in('racha_id', rachaIds)
              .eq('status', 'confirmado'),
          ])

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

          // "jogos" real (partida em que o jogador jogou) em vez de "partida em
          // que pontuou" — só precisa pro vôlei, que é quem mostra essa coluna
          const partidasVolei = partidas.filter((p) => partidaModalidade.get(p.id) === 'volei')
          const rachasVolei = new Set(rachas.filter((r) => r.modalidade === 'volei').map((r) => r.id))
          const presencas = ((presencasData ?? []) as unknown as {
            racha_id: string
            jogador_id: string
            time_id: string | null
            jogadores: { nome: string } | null
          }[]).filter((p) => rachasVolei.has(p.racha_id))

          const statsPorJogadorId = contarJogosEVitorias(
            partidasVolei,
            (escalacoesData ?? []).filter((e) => partidasVolei.some((p) => p.id === e.partida_id)),
            presencas,
          )

          const nomePorJogadorId = new Map(presencas.map((p) => [p.jogador_id, p.jogadores?.nome ?? '?']))
          const statsPorNome = new Map<string, { jogos: number; vitorias: number }>()
          for (const [jogadorId, stats] of statsPorJogadorId) {
            const nome = nomePorJogadorId.get(jogadorId)
            if (!nome) continue
            const atual = statsPorNome.get(nome) ?? { jogos: 0, vitorias: 0 }
            statsPorNome.set(nome, { jogos: atual.jogos + stats.jogos, vitorias: atual.vitorias + stats.vitorias })
          }

          motivosVolei = montarTabelaMotivos(contadores.volei.eventos).map((linha) =>
            linha.nome === 'Sem autor'
              ? linha
              : { ...linha, ...(statsPorNome.get(linha.nome) ?? { jogos: 0, vitorias: 0 }) },
          )

          setEventosVolei(contadores.volei.eventos)
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
        motivos: motivosVolei,
      })

      setLoading(false)
    }

    carregar()
  }, [grupoId])

  const evolucaoPorRacha = useMemo(() => {
    if (!jogadorAberto) return []
    const porRacha = new Map<string, number>()
    for (const ev of eventosVolei) {
      if (ev.jogadores?.nome !== jogadorAberto) continue
      const rachaId = partidaRacha.get(ev.partida_id)
      if (!rachaId) continue
      porRacha.set(rachaId, (porRacha.get(rachaId) ?? 0) + 1)
    }
    return [...porRacha.entries()]
      .map(([rachaId, pontos]) => ({ pontos, dataHora: rachaDataHora.get(rachaId) ?? '' }))
      .sort((a, b) => a.dataHora.localeCompare(b.dataHora))
      .map((r) => ({
        data: new Date(r.dataHora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        pontos: r.pontos,
      }))
  }, [jogadorAberto, eventosVolei, partidaRacha, rachaDataHora])

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
            <TabelaMotivos
              linhas={stats.motivos}
              mostrarExportar
              aoClicarJogador={(jogadorNome) => setJogadorAberto((atual) => (atual === jogadorNome ? null : jogadorNome))}
              jogadorSelecionado={jogadorAberto}
            />

            {jogadorAberto && (
              <div className="space-y-1 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                <p className="text-sm text-neutral-400">Pontos por racha — {jogadorAberto}</p>
                {evolucaoPorRacha.length === 0 ? (
                  <p className="text-sm text-neutral-500">Nenhum ponto registrado.</p>
                ) : (
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evolucaoPorRacha} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                        <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="data" stroke="#737373" fontSize={12} tickLine={false} />
                        <YAxis stroke="#737373" fontSize={12} allowDecimals={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: 8 }}
                          labelStyle={{ color: '#a3a3a3' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="pontos"
                          name="Pontos"
                          stroke="#34d399"
                          strokeWidth={2}
                          dot={{ fill: '#34d399', r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
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
