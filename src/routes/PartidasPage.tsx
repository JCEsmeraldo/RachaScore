import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSouOrganizador } from '../lib/useSouOrganizador'
import type { ConfigVolei, Partida, SetPartida, Time } from '../lib/types'

export function PartidasPage() {
  const { grupoId, rachaId } = useParams<{ grupoId: string; rachaId: string }>()
  const souOrganizador = useSouOrganizador(grupoId)

  const [times, setTimes] = useState<Time[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [sets, setSets] = useState<SetPartida[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    if (!rachaId) return
    setLoading(true)

    const [
      { data: rachaData },
      { data: timesData, error: erroTimes },
      { data: partidasData, error: erroPartidas },
    ] = await Promise.all([
      supabase.from('rachas').select('*').eq('id', rachaId).single(),
      supabase.from('times').select('*').eq('racha_id', rachaId),
      supabase.from('partidas').select('*').eq('racha_id', rachaId).order('created_at', { ascending: true }),
    ])

    if (erroTimes || erroPartidas) {
      setErro(erroTimes?.message ?? erroPartidas?.message ?? 'Erro ao carregar partidas')
      setLoading(false)
      return
    }

    setTimes(timesData ?? [])
    setPartidas(partidasData ?? [])

    // vôlei com 1 set só: o "placar" da partida na lista é o placar do set, não
    // a contagem de sets ganhos (que sempre fica 1-0 ou 0-0, sem informação)
    const umSetSo = rachaData?.modalidade === 'volei' && (rachaData.config as ConfigVolei).num_sets === 1
    const partidaIds = (partidasData ?? []).map((p) => p.id)

    if (umSetSo && partidaIds.length > 0) {
      const { data: setsData } = await supabase.from('sets').select('*').in('partida_id', partidaIds)
      setSets(setsData ?? [])
    } else {
      setSets([])
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rachaId])

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Link
              to={`/grupos/${grupoId}/rachas/${rachaId}`}
              className="text-sm text-neutral-400 hover:text-neutral-200"
            >
              ← Voltar
            </Link>
            <h1 className="text-xl font-semibold">Partidas</h1>
          </div>
          {souOrganizador && (
            <Link
              to={`/grupos/${grupoId}/rachas/${rachaId}/partidas/nova`}
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              + Nova partida
            </Link>
          )}
        </header>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : partidas.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma partida ainda.</p>
        ) : (
          <ul className="space-y-2">
            {partidas.map((partida) => {
              const timeA = times.find((t) => t.id === partida.time_a_id)
              const timeB = times.find((t) => t.id === partida.time_b_id)
              const setUnico = sets.find((s) => s.partida_id === partida.id)
              const placarA = setUnico ? setUnico.placar_a : partida.placar_a
              const placarB = setUnico ? setUnico.placar_b : partida.placar_b
              return (
                <li key={partida.id}>
                  <Link
                    to={`/grupos/${grupoId}/rachas/${rachaId}/partidas/${partida.id}`}
                    className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-neutral-700"
                  >
                    <span>
                      {timeA?.nome ?? '?'} x {timeB?.nome ?? '?'}
                    </span>
                    <span className="text-neutral-400">
                      {placarA} - {placarB}
                      {partida.status === 'em_andamento' && (
                        <span className="ml-2 text-xs text-emerald-400">ao vivo</span>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
