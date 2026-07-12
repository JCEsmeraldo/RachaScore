import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { contarJogosEVitorias, montarTabelaMotivos, type LinhaMotivo } from '../lib/estatisticas'
import { TabelaMotivos } from '../components/TabelaMotivos'
import type { ClassificacaoTime, Racha } from '../lib/types'

type EventoComPartida = { partida_id: string; jogador_id: string | null; jogadores: { nome: string } | null }

export function EstatisticasRachaPage() {
  const { grupoId, rachaId } = useParams<{ grupoId: string; rachaId: string }>()

  const [racha, setRacha] = useState<Racha | null>(null)
  const [classificacao, setClassificacao] = useState<ClassificacaoTime[]>([])
  const [pontuadores, setPontuadores] = useState<{ nome: string; total: number }[]>([])
  const [motivos, setMotivos] = useState<LinhaMotivo[]>([])
  const [eventos, setEventos] = useState<EventoComPartida[]>([])
  const [partidaIdsOrdenadas, setPartidaIdsOrdenadas] = useState<string[]>([])
  const [jogadorAberto, setJogadorAberto] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      if (!rachaId) return
      setLoading(true)

      const { data: rachaData, error: erroRacha } = await supabase
        .from('rachas')
        .select('*')
        .eq('id', rachaId)
        .single()

      if (erroRacha || !rachaData) {
        setErro(erroRacha?.message ?? 'Racha não encontrado')
        setLoading(false)
        return
      }

      setRacha(rachaData)

      const [{ data: partidasData }, { data: classificacaoData, error: erroClass }] = await Promise.all([
        supabase
          .from('partidas')
          .select('id, racha_id, time_a_id, time_b_id, vencedor_id, status, created_at')
          .eq('racha_id', rachaId)
          .order('created_at', { ascending: true }),
        rachaData.modo === 'torneio'
          ? supabase
              .from('classificacao_racha')
              .select('*')
              .eq('racha_id', rachaId)
              .order('pontos', { ascending: false })
              .order('saldo', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ])

      if (erroClass) setErro(erroClass.message)
      setClassificacao((classificacaoData as ClassificacaoTime[]) ?? [])

      const partidas = partidasData ?? []
      const partidaIds = partidas.map((p) => p.id)
      setPartidaIdsOrdenadas(partidaIds)

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
              .select('jogador_id, time_id, jogadores(nome)')
              .eq('racha_id', rachaId)
              .eq('status', 'confirmado'),
          ])

        if (erroEventos) {
          setErro(erroEventos.message)
        } else {
          const eventos = (eventosData ?? []) as unknown as {
            partida_id: string
            jogador_id: string | null
            motivo: string | null
            jogadores: { nome: string } | null
          }[]

          setEventos(eventos)

          const porJogador = new Map<string, number>()
          for (const ev of eventos) {
            if (!ev.jogador_id || !ev.jogadores) continue
            porJogador.set(ev.jogadores.nome, (porJogador.get(ev.jogadores.nome) ?? 0) + 1)
          }
          setPontuadores(
            [...porJogador.entries()]
              .map(([nome, total]) => ({ nome, total }))
              .sort((a, b) => b.total - a.total),
          )

          if (rachaData.modalidade === 'volei') {
            const presencas = (presencasData ?? []) as unknown as {
              jogador_id: string
              time_id: string | null
              jogadores: { nome: string } | null
            }[]

            const statsPorJogadorId = contarJogosEVitorias(
              partidas,
              escalacoesData ?? [],
              presencas.map((p) => ({ racha_id: rachaId, jogador_id: p.jogador_id, time_id: p.time_id })),
            )

            const nomePorJogadorId = new Map(presencas.map((p) => [p.jogador_id, p.jogadores?.nome ?? '?']))
            const statsPorNome = new Map<string, { jogos: number; vitorias: number }>()
            for (const [jogadorId, stats] of statsPorJogadorId) {
              const nome = nomePorJogadorId.get(jogadorId)
              if (!nome) continue
              const atual = statsPorNome.get(nome) ?? { jogos: 0, vitorias: 0 }
              statsPorNome.set(nome, { jogos: atual.jogos + stats.jogos, vitorias: atual.vitorias + stats.vitorias })
            }

            setMotivos(
              montarTabelaMotivos(eventos).map((linha) =>
                linha.nome === 'Sem autor'
                  ? linha
                  : { ...linha, ...(statsPorNome.get(linha.nome) ?? { jogos: 0, vitorias: 0 }) },
              ),
            )
          }
        }
      }

      setLoading(false)
    }

    carregar()
  }, [rachaId])

  const labelPontuador = racha?.modalidade === 'volei' ? 'Maiores pontuadores' : 'Artilheiros'

  const evolucaoPorPartida = useMemo(() => {
    if (!jogadorAberto) return []
    const porPartida = new Map<string, number>()
    for (const ev of eventos) {
      if (ev.jogadores?.nome !== jogadorAberto) continue
      porPartida.set(ev.partida_id, (porPartida.get(ev.partida_id) ?? 0) + 1)
    }
    return partidaIdsOrdenadas
      .map((id, i) => ({ partida: `P${i + 1}`, pontos: porPartida.get(id) ?? 0 }))
      .filter((p) => p.pontos > 0)
  }, [jogadorAberto, eventos, partidaIdsOrdenadas])

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header>
          <Link
            to={`/grupos/${grupoId}/rachas/${rachaId}`}
            className="text-sm text-neutral-400 hover:text-neutral-200"
          >
            ← Voltar
          </Link>
          <h1 className="text-xl font-semibold">Estatísticas</h1>
        </header>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : (
          <>
            {racha?.modo === 'torneio' && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-neutral-400">Classificação</h2>
                {classificacao.length === 0 ? (
                  <p className="text-sm text-neutral-500">Nenhuma partida finalizada ainda.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-800 text-neutral-500">
                          <th className="px-2 py-2 text-left">Time</th>
                          <th className="px-2 py-2">J</th>
                          <th className="px-2 py-2">V</th>
                          <th className="px-2 py-2">E</th>
                          <th className="px-2 py-2">D</th>
                          <th className="px-2 py-2">SG</th>
                          <th className="px-2 py-2">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classificacao.map((c) => (
                          <tr key={c.time_id} className="border-b border-neutral-800 last:border-0">
                            <td className="px-2 py-2 text-left">{c.time_nome}</td>
                            <td className="px-2 py-2 text-center">{c.jogos}</td>
                            <td className="px-2 py-2 text-center">{c.vitorias}</td>
                            <td className="px-2 py-2 text-center">{c.empates}</td>
                            <td className="px-2 py-2 text-center">{c.derrotas}</td>
                            <td className="px-2 py-2 text-center">{c.saldo}</td>
                            <td className="px-2 py-2 text-center font-medium">{c.pontos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {racha?.modalidade !== 'volei' && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-neutral-400">{labelPontuador}</h2>
                {pontuadores.length === 0 ? (
                  <p className="text-sm text-neutral-500">Nenhum ponto com autor registrado ainda.</p>
                ) : (
                  <ul className="space-y-1 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                    {pontuadores.map((p) => (
                      <li key={p.nome} className="flex items-center justify-between text-sm">
                        <span>{p.nome}</span>
                        <span className="text-neutral-400">{p.total}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {racha?.modalidade === 'volei' && (
              <div className="space-y-2">
                <TabelaMotivos
                  linhas={motivos}
                  mostrarMvp
                  mostrarExportar
                  aoClicarJogador={(nome) => setJogadorAberto((atual) => (atual === nome ? null : nome))}
                  jogadorSelecionado={jogadorAberto}
                />

                {jogadorAberto && (
                  <div className="space-y-1 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                    <p className="text-sm text-neutral-400">Pontos por partida — {jogadorAberto}</p>
                    {evolucaoPorPartida.length === 0 ? (
                      <p className="text-sm text-neutral-500">Nenhum ponto registrado.</p>
                    ) : (
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={evolucaoPorPartida} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                            <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="partida" stroke="#737373" fontSize={12} tickLine={false} />
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
          </>
        )}
      </div>
    </div>
  )
}
