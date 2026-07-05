import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSouOrganizador } from '../lib/useSouOrganizador'
import { sortearTimes } from '../lib/sortearTimes'
import type { PresencaComJogador, Racha, Time } from '../lib/types'

export function TimesPage() {
  const { grupoId, rachaId } = useParams<{ grupoId: string; rachaId: string }>()
  const souOrganizador = useSouOrganizador(grupoId)

  const [racha, setRacha] = useState<Racha | null>(null)
  const [presencas, setPresencas] = useState<PresencaComJogador[]>([])
  const [times, setTimes] = useState<Time[]>([])
  const [loading, setLoading] = useState(true)
  const [sorteando, setSorteando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    if (!rachaId) return
    setLoading(true)

    const [{ data: rachaData }, { data: presencasData, error: erroPresencas }, { data: timesData, error: erroTimes }] =
      await Promise.all([
        supabase.from('rachas').select('*').eq('id', rachaId).single(),
        supabase
          .from('presencas_racha')
          .select('jogador_id, status, time_id, pediu_vaga_em, jogadores(id, nome, user_id, email, created_at)')
          .eq('racha_id', rachaId)
          .eq('status', 'confirmado'),
        supabase.from('times').select('*').eq('racha_id', rachaId),
      ])

    setRacha(rachaData)

    if (erroPresencas || erroTimes) {
      setErro(erroPresencas?.message ?? erroTimes?.message ?? 'Erro ao carregar times')
    } else {
      setPresencas((presencasData ?? []) as unknown as PresencaComJogador[])
      setTimes(timesData ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rachaId])

  async function handleSortear() {
    if (!rachaId || !racha) return

    setSorteando(true)
    setErro(null)

    const confirmados = presencas.map((p) => p.jogador_id)
    const { erro: erroSorteio } = await sortearTimes(rachaId, racha, confirmados, times)

    setSorteando(false)
    if (erroSorteio) {
      setErro(erroSorteio)
      return
    }

    carregar()
  }

  async function handleMoverJogador(jogadorId: string, novoTimeId: string | null) {
    if (!rachaId) return
    setErro(null)

    const { error } = await supabase
      .from('presencas_racha')
      .update({ time_id: novoTimeId })
      .eq('racha_id', rachaId)
      .eq('jogador_id', jogadorId)

    if (error) {
      setErro(error.message)
      return
    }

    carregar()
  }

  async function handleApagarTime(timeId: string) {
    if (!rachaId) return
    if (!confirm('Apagar esse time?')) return
    setErro(null)

    await supabase.from('presencas_racha').update({ time_id: null }).eq('racha_id', rachaId).eq('time_id', timeId)

    const { error } = await supabase.from('times').delete().eq('id', timeId)

    if (error) {
      setErro('Esse time já foi usado numa partida e não pode ser apagado')
      return
    }

    carregar()
  }

  const semTime = presencas.filter((p) => !p.time_id)
  const timesSorteio = times.filter((t) => t.sorteio)
  const timesPersonalizados = times.filter((t) => !t.sorteio)

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
            <h1 className="text-xl font-semibold">Times</h1>
          </div>
          {souOrganizador && (
            <button
              onClick={handleSortear}
              disabled={sorteando}
              className="text-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
            >
              {sorteando ? 'Sorteando...' : times.length > 0 ? 'Sortear de novo' : 'Sortear times'}
            </button>
          )}
        </header>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : times.length === 0 ? (
          <p className="text-sm text-neutral-500">Times ainda não sorteados.</p>
        ) : (
          <div className="space-y-6">
            {timesSorteio.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-neutral-400">Sorteio</h2>
                {timesSorteio.map((time) => (
                  <div key={time.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                    <h3 className="mb-2 text-sm font-medium">{time.nome}</h3>
                    <ul className="space-y-1">
                      {presencas
                        .filter((p) => p.time_id === time.id)
                        .map((p) => (
                          <li key={p.jogador_id} className="flex items-center justify-between text-sm">
                            <span>{p.jogadores?.nome}</span>
                            {souOrganizador && (
                              <select
                                value={time.id}
                                onChange={(e) => handleMoverJogador(p.jogador_id, e.target.value || null)}
                                className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-xs"
                              >
                                {times.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.nome}
                                  </option>
                                ))}
                                <option value="">Fora</option>
                              </select>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {timesPersonalizados.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-neutral-400">Times personalizados</h2>
                {timesPersonalizados.map((time) => (
                  <div key={time.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium">{time.nome}</h3>
                      {souOrganizador && (
                        <button
                          onClick={() => handleApagarTime(time.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Apagar
                        </button>
                      )}
                    </div>
                    <ul className="space-y-1">
                      {presencas
                        .filter((p) => p.time_id === time.id)
                        .map((p) => (
                          <li key={p.jogador_id} className="flex items-center justify-between text-sm">
                            <span>{p.jogadores?.nome}</span>
                            {souOrganizador && (
                              <select
                                value={time.id}
                                onChange={(e) => handleMoverJogador(p.jogador_id, e.target.value || null)}
                                className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-xs"
                              >
                                {times.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.nome}
                                  </option>
                                ))}
                                <option value="">Fora</option>
                              </select>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {semTime.length > 0 && (
              <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                <h3 className="mb-2 text-sm font-medium text-neutral-400">De fora</h3>
                <ul className="space-y-1">
                  {semTime.map((p) => (
                    <li key={p.jogador_id} className="flex items-center justify-between text-sm">
                      <span>{p.jogadores?.nome}</span>
                      {souOrganizador && (
                        <select
                          value=""
                          onChange={(e) => handleMoverJogador(p.jogador_id, e.target.value || null)}
                          className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-xs"
                        >
                          <option value="">Fora</option>
                          {times.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nome}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
