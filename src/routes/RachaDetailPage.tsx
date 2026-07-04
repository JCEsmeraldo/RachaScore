import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type {
  ConfigFutebol,
  ConfigVolei,
  Grupo,
  MembroComJogador,
  PresencaComJogador,
  Racha,
  Time,
} from '../lib/types'

function resumoConfig(racha: Racha) {
  if (racha.modalidade === 'futebol') {
    const c = racha.config as ConfigFutebol
    const partes = []
    if (c.minutos) partes.push(`${c.minutos} min`)
    if (c.gols) partes.push(`${c.gols} gols`)
    return partes.length === 2 ? `${partes.join(' ou ')} (o que vier primeiro)` : partes[0]
  }
  const c = racha.config as ConfigVolei
  return `${c.num_sets} sets até ${c.pontos_set}`
}

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

export function RachaDetailPage() {
  const { grupoId, rachaId } = useParams<{ grupoId: string; rachaId: string }>()
  const { session } = useAuth()

  const [racha, setRacha] = useState<Racha | null>(null)
  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [presencas, setPresencas] = useState<PresencaComJogador[]>([])
  const [times, setTimes] = useState<Time[]>([])
  const [loading, setLoading] = useState(true)
  const [sorteando, setSorteando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const souOrganizador =
    !!grupo &&
    !!session &&
    (grupo.dono_id === session.user.id ||
      presencas.find((p) => p.jogadores?.user_id === session.user.id) !== undefined)

  async function carregar() {
    if (!rachaId || !grupoId) return
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

    const [
      { data: grupoData, error: erroGrupo },
      { data: membrosData, error: erroMembros },
      { data: presencasData, error: erroPresencas },
      { data: timesData, error: erroTimes },
    ] = await Promise.all([
      supabase.from('grupos').select('*').eq('id', grupoId).single(),
      supabase
        .from('membros_grupo')
        .select('jogador_id, is_admin, jogadores(id, nome, user_id, email, created_at)')
        .eq('grupo_id', grupoId),
      supabase
        .from('presencas_racha')
        .select('jogador_id, status, time_id, created_at, jogadores(id, nome, user_id, email, created_at)')
        .eq('racha_id', rachaId),
      supabase.from('times').select('*').eq('racha_id', rachaId),
    ])

    if (erroGrupo) setErro(erroGrupo.message)
    else setGrupo(grupoData)

    if (erroTimes) setErro(erroTimes.message)
    else setTimes(timesData ?? [])

    if (!erroMembros && !erroPresencas) {
      const membros = (membrosData ?? []) as unknown as MembroComJogador[]
      const existentes = (presencasData ?? []) as unknown as PresencaComJogador[]

      const combinado: PresencaComJogador[] = membros.map((m) => {
        const presenca = existentes.find((p) => p.jogador_id === m.jogador_id)
        return (
          presenca ?? {
            jogador_id: m.jogador_id,
            status: 'ausente' as const,
            time_id: null,
            created_at: '',
            jogadores: m.jogadores,
          }
        )
      })

      setPresencas(combinado)
    } else {
      setErro(erroMembros?.message ?? erroPresencas?.message ?? 'Erro ao carregar presença')
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId, rachaId])

  async function handleAlternarPresenca(jogadorId: string, querJogar: boolean) {
    if (!rachaId) return
    setErro(null)

    const { error } = await supabase.rpc('atualizar_presenca', {
      p_racha_id: rachaId,
      p_jogador_id: jogadorId,
      p_quer_jogar: querJogar,
    })

    if (error) {
      setErro(error.message)
      return
    }

    carregar()
  }

  async function handleSortear() {
    if (!rachaId || !racha) return

    const confirmados = presencas.filter((p) => p.status === 'confirmado').map((p) => p.jogador_id)
    const numTimes = Math.floor(confirmados.length / racha.tamanho_equipe)

    if (numTimes < 2) {
      setErro(
        `Precisa de pelo menos ${racha.tamanho_equipe * 2} confirmados pra sortear 2 times (times de ${racha.tamanho_equipe})`,
      )
      return
    }

    setSorteando(true)
    setErro(null)

    await supabase.from('presencas_racha').update({ time_id: null }).eq('racha_id', rachaId)
    await supabase.from('times').delete().eq('racha_id', rachaId)

    const { data: novosTimes, error: erroTimes } = await supabase
      .from('times')
      .insert(
        Array.from({ length: numTimes }, (_, i) => ({ racha_id: rachaId, nome: `Time ${i + 1}` })),
      )
      .select()

    if (erroTimes || !novosTimes) {
      setSorteando(false)
      setErro(erroTimes?.message ?? 'Erro ao criar times')
      return
    }

    const sorteados = embaralhar(confirmados)
    const gruposDeTimes: string[][] = Array.from({ length: numTimes }, () => [])

    if (racha.modo === 'torneio') {
      // torneio não deixa ninguém de fora — sobra se distribui entre os times (fica desigual)
      sorteados.forEach((jogadorId, i) => {
        gruposDeTimes[i % numTimes].push(jogadorId)
      })
    } else {
      // rapido: só preenche times completos, sobra fica de fora
      sorteados.slice(0, numTimes * racha.tamanho_equipe).forEach((jogadorId, i) => {
        gruposDeTimes[Math.floor(i / racha.tamanho_equipe)].push(jogadorId)
      })
    }

    for (let i = 0; i < numTimes; i++) {
      const { error } = await supabase
        .from('presencas_racha')
        .update({ time_id: novosTimes[i].id })
        .eq('racha_id', rachaId)
        .in('jogador_id', gruposDeTimes[i])

      if (error) {
        setErro(error.message)
        break
      }
    }

    setSorteando(false)
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

  const confirmados = presencas.filter((p) => p.status === 'confirmado')
  const espera = presencas
    .filter((p) => p.status === 'espera')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const semTime = confirmados.filter((p) => !p.time_id)

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1">
          <Link to={`/grupos/${grupoId}/rachas`} className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Rachas
          </Link>
        </header>

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : erro || !racha ? (
          <p className="text-red-400">{erro ?? 'Racha não encontrado'}</p>
        ) : (
          <>
            <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <h1 className="text-xl font-semibold capitalize">
                {racha.modalidade} — {racha.modo === 'torneio' ? 'Torneio' : 'Jogo rápido'}
              </h1>
              <p className="text-sm text-neutral-400">
                {new Date(racha.data_hora).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
                {racha.local && ` · ${racha.local}`}
              </p>
              <p className="text-sm text-neutral-300">Times de {racha.tamanho_equipe} jogadores</p>
              <p className="text-sm text-neutral-300">{resumoConfig(racha)}</p>
            </div>

            {erro && <p className="text-sm text-red-400">{erro}</p>}

            <div className="space-y-2">
              <h2 className="text-sm font-medium text-neutral-400">
                Presença — {confirmados.length} confirmado{confirmados.length === 1 ? '' : 's'}
                {racha.limite_jogadores && ` de ${racha.limite_jogadores}`}
                {espera.length > 0 && ` · ${espera.length} na espera`}
              </h2>
              <ul className="space-y-2">
                {presencas.map((p) => (
                  <li
                    key={p.jogador_id}
                    className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2"
                  >
                    <span>
                      {p.jogadores?.nome ?? '(sem nome)'}
                      {p.status === 'espera' && (
                        <span className="ml-2 text-xs text-amber-400">na fila</span>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={p.status !== 'ausente'}
                      disabled={!souOrganizador}
                      onChange={(e) => handleAlternarPresenca(p.jogador_id, e.target.checked)}
                      className="accent-emerald-500"
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-neutral-400">Times</h2>
                {souOrganizador && (
                  <button
                    onClick={handleSortear}
                    disabled={sorteando}
                    className="text-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                  >
                    {sorteando ? 'Sorteando...' : times.length > 0 ? 'Sortear de novo' : 'Sortear times'}
                  </button>
                )}
              </div>

              {times.length === 0 ? (
                <p className="text-sm text-neutral-500">Times ainda não sorteados.</p>
              ) : (
                <div className="space-y-3">
                  {times.map((time) => (
                    <div key={time.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                      <h3 className="mb-2 text-sm font-medium">{time.nome}</h3>
                      <ul className="space-y-1">
                        {confirmados
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

            <p className="text-sm text-neutral-500">Partidas e placar entram na próxima etapa.</p>
          </>
        )}
      </div>
    </div>
  )
}
