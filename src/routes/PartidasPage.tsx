import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSouOrganizador } from '../lib/useSouOrganizador'
import { sortearTimes } from '../lib/sortearTimes'
import type { Partida, PresencaComJogador, Racha, Time } from '../lib/types'

export function PartidasPage() {
  const { grupoId, rachaId } = useParams<{ grupoId: string; rachaId: string }>()
  const navigate = useNavigate()
  const souOrganizador = useSouOrganizador(grupoId)

  const [racha, setRacha] = useState<Racha | null>(null)
  const [presencas, setPresencas] = useState<PresencaComJogador[]>([])
  const [times, setTimes] = useState<Time[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [loading, setLoading] = useState(true)
  const [sorteando, setSorteando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    if (!rachaId) return
    setLoading(true)

    const [
      { data: rachaData },
      { data: presencasData },
      { data: timesData, error: erroTimes },
      { data: partidasData, error: erroPartidas },
    ] = await Promise.all([
      supabase.from('rachas').select('*').eq('id', rachaId).single(),
      supabase
        .from('presencas_racha')
        .select('jogador_id, status, time_id, pediu_vaga_em, jogadores(id, nome, user_id, email, created_at)')
        .eq('racha_id', rachaId)
        .eq('status', 'confirmado'),
      supabase.from('times').select('*').eq('racha_id', rachaId),
      supabase.from('partidas').select('*').eq('racha_id', rachaId).order('created_at', { ascending: true }),
    ])

    setRacha(rachaData)
    setPresencas((presencasData ?? []) as unknown as PresencaComJogador[])

    if (erroTimes || erroPartidas) {
      setErro(erroTimes?.message ?? erroPartidas?.message ?? 'Erro ao carregar partidas')
    } else {
      setTimes(timesData ?? [])
      setPartidas(partidasData ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rachaId])

  async function handleNovaPartida() {
    if (!rachaId || !racha) return

    // só pula o sorteio se já existe pool de times COM jogador vinculado agora —
    // times órfãos (de partidas antigas, sem ninguém current) não contam
    const idsComJogador = new Set(presencas.map((p) => p.time_id).filter(Boolean))
    const timesAtivos = times.filter((t) => idsComJogador.has(t.id))

    if (timesAtivos.length >= 2) {
      navigate(`/grupos/${grupoId}/rachas/${rachaId}/partidas/nova`)
      return
    }

    setSorteando(true)
    setErro(null)

    const confirmados = presencas.map((p) => p.jogador_id)
    const { erro: erroSorteio } = await sortearTimes(rachaId, racha, confirmados, times)

    setSorteando(false)

    if (erroSorteio) {
      setErro(erroSorteio)
      return
    }

    navigate(`/grupos/${grupoId}/rachas/${rachaId}/partidas/nova`)
  }

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
            <button
              onClick={handleNovaPartida}
              disabled={sorteando}
              className="text-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
            >
              {sorteando ? 'Sorteando...' : '+ Nova partida'}
            </button>
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
                      {partida.placar_a} - {partida.placar_b}
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
