import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type {
  Cartao,
  ConfigFutebol,
  ConfigVolei,
  EscalacaoComJogador,
  MotivoPonto,
  Partida,
  Racha,
  SetPartida,
  TipoCartao,
  Time,
} from '../lib/types'

type JogadorTime = { jogador_id: string; nome: string }

const MOTIVOS: { valor: MotivoPonto; label: string }[] = [
  { valor: 'ataque', label: 'Ataque' },
  { valor: 'bloqueio', label: 'Bloqueio' },
  { valor: 'saque', label: 'Saque' },
  { valor: 'outro', label: 'Outro' },
]

function formatarCronometro(segundos: number) {
  const m = Math.floor(segundos / 60)
    .toString()
    .padStart(2, '0')
  const s = (segundos % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// segundos acumulados + tempo real decorrido desde a última atualização, se rodando
function segundosAoVivo(partida: Partida, agora: number) {
  if (!partida.cronometro_rodando || !partida.cronometro_atualizado_em) {
    return partida.cronometro_segundos
  }
  const decorrido = Math.floor((agora - new Date(partida.cronometro_atualizado_em).getTime()) / 1000)
  return partida.cronometro_segundos + Math.max(decorrido, 0)
}

export function PartidaDetailPage() {
  const { grupoId, rachaId, partidaId } = useParams<{
    grupoId: string
    rachaId: string
    partidaId: string
  }>()
  const { session } = useAuth()

  const [partida, setPartida] = useState<Partida | null>(null)
  const [racha, setRacha] = useState<Racha | null>(null)
  const [timeA, setTimeA] = useState<Time | null>(null)
  const [timeB, setTimeB] = useState<Time | null>(null)
  const [jogadoresA, setJogadoresA] = useState<JogadorTime[]>([])
  const [jogadoresB, setJogadoresB] = useState<JogadorTime[]>([])
  const [setAtual, setSetAtual] = useState<SetPartida | null>(null)
  const [setsAnteriores, setSetsAnteriores] = useState<SetPartida[]>([])
  const [souOrganizador, setSouOrganizador] = useState(false)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const [cartoes, setCartoes] = useState<Cartao[]>([])

  async function carregar() {
    if (!partidaId || !rachaId) return
    setLoading(true)

    const { data: partidaData, error: erroPartida } = await supabase
      .from('partidas')
      .select('*')
      .eq('id', partidaId)
      .single()

    if (erroPartida || !partidaData) {
      setErro(erroPartida?.message ?? 'Partida não encontrada')
      setLoading(false)
      return
    }

    setPartida(partidaData)

    const { data: rachaData } = await supabase.from('rachas').select('*').eq('id', rachaId).single()
    setRacha(rachaData)

    const [
      { data: grupoData },
      { data: membrosData },
      { data: timeAData },
      { data: timeBData },
      { data: presencasAData },
      { data: presencasBData },
      { data: setsData },
      { data: escalacaoData },
      { data: cartoesData },
    ] = await Promise.all([
      supabase.from('grupos').select('*').eq('id', rachaData.grupo_id).single(),
      supabase
        .from('membros_grupo')
        .select('is_admin, jogadores(user_id)')
        .eq('grupo_id', rachaData.grupo_id),
      supabase.from('times').select('*').eq('id', partidaData.time_a_id).single(),
      supabase.from('times').select('*').eq('id', partidaData.time_b_id).single(),
      supabase
        .from('presencas_racha')
        .select('jogador_id, jogadores(nome)')
        .eq('racha_id', rachaId)
        .eq('time_id', partidaData.time_a_id)
        .eq('status', 'confirmado'),
      supabase
        .from('presencas_racha')
        .select('jogador_id, jogadores(nome)')
        .eq('racha_id', rachaId)
        .eq('time_id', partidaData.time_b_id)
        .eq('status', 'confirmado'),
      supabase.from('sets').select('*').eq('partida_id', partidaId).order('numero', { ascending: true }),
      supabase
        .from('escalacoes_partida')
        .select('jogador_id, time_id, jogadores(nome)')
        .eq('partida_id', partidaId),
      supabase.from('cartoes').select('*').eq('partida_id', partidaId),
    ])

    setTimeA(timeAData)
    setTimeB(timeBData)
    setCartoes(cartoesData ?? [])

    const escalacao = (escalacaoData ?? []) as unknown as EscalacaoComJogador[]

    if (escalacao.length > 0) {
      setJogadoresA(
        escalacao
          .filter((e) => e.time_id === partidaData.time_a_id)
          .map((e) => ({ jogador_id: e.jogador_id, nome: e.jogadores?.nome ?? '?' })),
      )
      setJogadoresB(
        escalacao
          .filter((e) => e.time_id === partidaData.time_b_id)
          .map((e) => ({ jogador_id: e.jogador_id, nome: e.jogadores?.nome ?? '?' })),
      )
    } else {
      setJogadoresA(
        (presencasAData ?? []).map((p: any) => ({ jogador_id: p.jogador_id, nome: p.jogadores?.nome ?? '?' })),
      )
      setJogadoresB(
        (presencasBData ?? []).map((p: any) => ({ jogador_id: p.jogador_id, nome: p.jogadores?.nome ?? '?' })),
      )
    }

    if (setsData) {
      const abertos = setsData.filter((s) => !s.vencedor_id)
      setSetAtual(abertos[abertos.length - 1] ?? null)
      setSetsAnteriores(setsData.filter((s) => s.vencedor_id))
    }

    if (grupoData && session) {
      const membros = (membrosData ?? []) as unknown as { is_admin: boolean; jogadores: { user_id: string | null } | null }[]
      const propria = membros.find((m) => m.jogadores?.user_id === session.user.id)
      setSouOrganizador(grupoData.dono_id === session.user.id || propria?.is_admin === true)
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaId, rachaId])

  // sincroniza com outros dispositivos vendo a mesma partida (placar, cronômetro, sets)
  useEffect(() => {
    if (!partidaId) return

    const canal = supabase
      .channel(`partida-${partidaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partidas', filter: `id=eq.${partidaId}` },
        () => carregar(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sets', filter: `partida_id=eq.${partidaId}` },
        () => carregar(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaId])

  // tique local só pra atualizar o mostrador — não escreve no banco a cada segundo
  useEffect(() => {
    if (!partida?.cronometro_rodando) return
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [partida?.cronometro_rodando])

  function handleClicarJogador(jogadorId: string) {
    setExpandido((atual) => (atual === jogadorId ? null : jogadorId))
  }

  function handleEscolherMotivo(timeId: string, jogadorId: string, motivo: MotivoPonto) {
    setExpandido(null)
    handlePonto(timeId, jogadorId, motivo)
  }

  function handleEscolherAssistencia(timeId: string, jogadorId: string, assistenciaJogadorId: string | null) {
    setExpandido(null)
    handlePonto(timeId, jogadorId, null, assistenciaJogadorId)
  }

  async function handlePonto(
    timeId: string,
    jogadorId: string | null,
    motivo: MotivoPonto | null,
    assistenciaJogadorId: string | null = null,
  ) {
    if (!partidaId || !partida || !racha) return
    setErro(null)

    const ehVolei = racha.modalidade === 'volei'
    const ehTimeA = timeId === partida.time_a_id

    const { error: erroEvento } = await supabase.from('eventos_ponto').insert({
      partida_id: partidaId,
      set_id: ehVolei ? setAtual?.id ?? null : null,
      time_id: timeId,
      jogador_id: jogadorId,
      assistencia_jogador_id: assistenciaJogadorId,
      motivo,
    })

    if (erroEvento) {
      setErro(erroEvento.message)
      return
    }

    if (ehVolei && setAtual) {
      const campo = ehTimeA ? 'placar_a' : 'placar_b'
      await supabase
        .from('sets')
        .update({ [campo]: setAtual[campo] + 1 })
        .eq('id', setAtual.id)
    } else {
      const campo = ehTimeA ? 'placar_a' : 'placar_b'
      await supabase
        .from('partidas')
        .update({ [campo]: partida[campo] + 1 })
        .eq('id', partidaId)
    }

    carregar()
  }

  async function handleCartao(jogadorId: string, tipo: TipoCartao) {
    if (!partidaId) return
    setErro(null)

    const { error } = await supabase.from('cartoes').insert({ partida_id: partidaId, jogador_id: jogadorId, tipo })

    if (error) {
      setErro(error.message)
      return
    }

    carregar()
  }

  function cartoesDoJogador(jogadorId: string) {
    const doJogador = cartoes.filter((c) => c.jogador_id === jogadorId)
    return {
      amarelo: doJogador.filter((c) => c.tipo === 'amarelo').length,
      vermelho: doJogador.filter((c) => c.tipo === 'vermelho').length,
    }
  }

  async function handleFecharSet() {
    if (!partida || !racha || !setAtual) return
    setErro(null)

    const vencedorId =
      setAtual.placar_a > setAtual.placar_b
        ? partida.time_a_id
        : setAtual.placar_b > setAtual.placar_a
          ? partida.time_b_id
          : null

    if (!vencedorId) {
      setErro('Set empatado — ajusta o placar antes de fechar')
      return
    }

    await supabase.from('sets').update({ vencedor_id: vencedorId }).eq('id', setAtual.id)

    const ehTimeA = vencedorId === partida.time_a_id
    const campo = ehTimeA ? 'placar_a' : 'placar_b'
    const novoPlacar = partida[campo] + 1

    await supabase
      .from('partidas')
      .update({ [campo]: novoPlacar })
      .eq('id', partida.id)

    const config = racha.config as ConfigVolei
    const setsPraVencer = Math.floor(config.num_sets / 2) + 1

    if (novoPlacar >= setsPraVencer) {
      await supabase
        .from('partidas')
        .update({ status: 'finalizada', vencedor_id: vencedorId })
        .eq('id', partida.id)
    } else {
      await supabase.from('sets').insert({ partida_id: partida.id, numero: setAtual.numero + 1 })
    }

    carregar()
  }

  async function handleEncerrarPartida() {
    if (!partida) return
    setErro(null)

    const vencedorId =
      partida.placar_a > partida.placar_b
        ? partida.time_a_id
        : partida.placar_b > partida.placar_a
          ? partida.time_b_id
          : null

    await supabase
      .from('partidas')
      .update({ status: 'finalizada', vencedor_id: vencedorId })
      .eq('id', partida.id)

    carregar()
  }

  async function handleIniciarPausarCronometro() {
    if (!partida) return

    if (partida.cronometro_rodando) {
      // pausar: consolida o tempo decorrido em cronometro_segundos
      const segundos = segundosAoVivo(partida, Date.now())
      await supabase
        .from('partidas')
        .update({ cronometro_segundos: segundos, cronometro_rodando: false, cronometro_atualizado_em: new Date().toISOString() })
        .eq('id', partida.id)
    } else {
      await supabase
        .from('partidas')
        .update({ cronometro_rodando: true, cronometro_atualizado_em: new Date().toISOString() })
        .eq('id', partida.id)
    }

    carregar()
  }

  async function handleZerarCronometro() {
    if (!partida) return

    await supabase
      .from('partidas')
      .update({ cronometro_segundos: 0, cronometro_rodando: false, cronometro_atualizado_em: new Date().toISOString() })
      .eq('id', partida.id)

    carregar()
  }

  if (loading) {
    return <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">Carregando...</div>
  }

  if (erro || !partida || !racha || !timeA || !timeB) {
    return (
      <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
        <p className="text-red-400">{erro ?? 'Partida não encontrada'}</p>
      </div>
    )
  }

  const ehVolei = racha.modalidade === 'volei'
  const placarA = ehVolei ? (setAtual?.placar_a ?? 0) : partida.placar_a
  const placarB = ehVolei ? (setAtual?.placar_b ?? 0) : partida.placar_b
  const finalizada = partida.status === 'finalizada'
  const cronometroSegundos = segundosAoVivo(partida, agora)

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header>
          <Link
            to={`/grupos/${grupoId}/rachas/${rachaId}`}
            className="text-sm text-neutral-400 hover:text-neutral-200"
          >
            ← Voltar pro racha
          </Link>
        </header>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center">
          {finalizada && <p className="mb-2 text-sm font-medium text-emerald-400">Partida finalizada</p>}
          {ehVolei && (
            <p className="mb-1 text-sm text-neutral-400">
              Sets: {partida.placar_a} - {partida.placar_b}
              {setAtual && ` · Set ${setAtual.numero}`}
            </p>
          )}

          {!ehVolei && (() => {
            const minutos = (racha.config as ConfigFutebol).minutos
            const limiteSegundos = minutos ? minutos * 60 : null
            const emAcrescimo = limiteSegundos !== null && cronometroSegundos >= limiteSegundos

            return (
              <div className="mb-3 space-y-1">
                <p className={`text-2xl font-mono ${emAcrescimo ? 'text-amber-400' : 'text-neutral-200'}`}>
                  {formatarCronometro(cronometroSegundos)}
                  {limiteSegundos !== null && (
                    <span className="text-sm text-neutral-500"> / {formatarCronometro(limiteSegundos)}</span>
                  )}
                </p>
                {emAcrescimo && <p className="text-xs text-amber-400">Acréscimos</p>}
                {souOrganizador && !finalizada && (
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={handleIniciarPausarCronometro}
                      className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-600"
                    >
                      {partida.cronometro_rodando ? 'Pausar' : 'Iniciar'}
                    </button>
                    <button
                      onClick={handleZerarCronometro}
                      className="rounded-lg border border-neutral-800 px-3 py-1 text-xs text-neutral-500 hover:border-neutral-600"
                    >
                      Zerar
                    </button>
                  </div>
                )}
              </div>
            )
          })()}
          <div className="flex items-center justify-center gap-6">
            <div className="flex-1">
              <p className="truncate text-sm text-neutral-400">{timeA.nome}</p>
              <p className="text-4xl font-bold">{placarA}</p>
            </div>
            <span className="text-2xl text-neutral-600">x</span>
            <div className="flex-1">
              <p className="truncate text-sm text-neutral-400">{timeB.nome}</p>
              <p className="text-4xl font-bold">{placarB}</p>
            </div>
          </div>
        </div>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {souOrganizador && !finalizada && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-neutral-400">{timeA.nome}</h3>
                {jogadoresA.map((j) => {
                  const cartoesJ = cartoesDoJogador(j.jogador_id)
                  return (
                    <div key={j.jogador_id}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleClicarJogador(j.jogador_id)}
                          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm hover:border-emerald-500"
                        >
                          +1 {j.nome}
                          {cartoesJ.amarelo > 0 && ` 🟨${cartoesJ.amarelo > 1 ? cartoesJ.amarelo : ''}`}
                          {cartoesJ.vermelho > 0 && ' 🟥'}
                        </button>
                        {!ehVolei && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCartao(j.jogador_id, 'amarelo')}
                              title="Cartão amarelo"
                              className="rounded-lg border border-neutral-800 px-2 text-sm hover:border-amber-400"
                            >
                              🟨
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCartao(j.jogador_id, 'vermelho')}
                              title="Cartão vermelho"
                              className="rounded-lg border border-neutral-800 px-2 text-sm hover:border-red-400"
                            >
                              🟥
                            </button>
                          </>
                        )}
                      </div>
                      {expandido === j.jogador_id && (
                        <div className="mt-1 flex flex-wrap gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2">
                          {ehVolei
                            ? MOTIVOS.map((m) => (
                                <button
                                  key={m.valor}
                                  type="button"
                                  onClick={() => handleEscolherMotivo(partida.time_a_id, j.jogador_id, m.valor)}
                                  className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-emerald-500/20 hover:text-emerald-400"
                                >
                                  {m.label}
                                </button>
                              ))
                            : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleEscolherAssistencia(partida.time_a_id, j.jogador_id, null)}
                                    className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-emerald-500/20 hover:text-emerald-400"
                                  >
                                    Sem assistência
                                  </button>
                                  {jogadoresA
                                    .filter((t) => t.jogador_id !== j.jogador_id)
                                    .map((t) => (
                                      <button
                                        key={t.jogador_id}
                                        type="button"
                                        onClick={() => handleEscolherAssistencia(partida.time_a_id, j.jogador_id, t.jogador_id)}
                                        className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-emerald-500/20 hover:text-emerald-400"
                                      >
                                        {t.nome}
                                      </button>
                                    ))}
                                </>
                              )}
                        </div>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={() => handlePonto(partida.time_a_id, null, null)}
                  className="w-full rounded-lg border border-neutral-800 px-2 py-2 text-xs text-neutral-500 hover:border-neutral-600"
                >
                  +1 sem autor
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-neutral-400">{timeB.nome}</h3>
                {jogadoresB.map((j) => {
                  const cartoesJ = cartoesDoJogador(j.jogador_id)
                  return (
                    <div key={j.jogador_id}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleClicarJogador(j.jogador_id)}
                          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm hover:border-emerald-500"
                        >
                          +1 {j.nome}
                          {cartoesJ.amarelo > 0 && ` 🟨${cartoesJ.amarelo > 1 ? cartoesJ.amarelo : ''}`}
                          {cartoesJ.vermelho > 0 && ' 🟥'}
                        </button>
                        {!ehVolei && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCartao(j.jogador_id, 'amarelo')}
                              title="Cartão amarelo"
                              className="rounded-lg border border-neutral-800 px-2 text-sm hover:border-amber-400"
                            >
                              🟨
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCartao(j.jogador_id, 'vermelho')}
                              title="Cartão vermelho"
                              className="rounded-lg border border-neutral-800 px-2 text-sm hover:border-red-400"
                            >
                              🟥
                            </button>
                          </>
                        )}
                      </div>
                      {expandido === j.jogador_id && (
                        <div className="mt-1 flex flex-wrap gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2">
                          {ehVolei
                            ? MOTIVOS.map((m) => (
                                <button
                                  key={m.valor}
                                  type="button"
                                  onClick={() => handleEscolherMotivo(partida.time_b_id, j.jogador_id, m.valor)}
                                  className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-emerald-500/20 hover:text-emerald-400"
                                >
                                  {m.label}
                                </button>
                              ))
                            : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleEscolherAssistencia(partida.time_b_id, j.jogador_id, null)}
                                    className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-emerald-500/20 hover:text-emerald-400"
                                  >
                                    Sem assistência
                                  </button>
                                  {jogadoresB
                                    .filter((t) => t.jogador_id !== j.jogador_id)
                                    .map((t) => (
                                      <button
                                        key={t.jogador_id}
                                        type="button"
                                        onClick={() => handleEscolherAssistencia(partida.time_b_id, j.jogador_id, t.jogador_id)}
                                        className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-emerald-500/20 hover:text-emerald-400"
                                      >
                                        {t.nome}
                                      </button>
                                    ))}
                                </>
                              )}
                        </div>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={() => handlePonto(partida.time_b_id, null, null)}
                  className="w-full rounded-lg border border-neutral-800 px-2 py-2 text-xs text-neutral-500 hover:border-neutral-600"
                >
                  +1 sem autor
                </button>
              </div>
            </div>

            {ehVolei ? (
              <button
                onClick={handleFecharSet}
                className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950"
              >
                Fechar set
              </button>
            ) : (
              <button
                onClick={handleEncerrarPartida}
                className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950"
              >
                Encerrar partida
              </button>
            )}
          </>
        )}

        {setsAnteriores.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-neutral-400">Sets anteriores</h3>
            {setsAnteriores.map((s) => (
              <p key={s.id} className="text-sm text-neutral-500">
                Set {s.numero}: {s.placar_a} - {s.placar_b}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
