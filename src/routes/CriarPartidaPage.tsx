import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { PresencaComJogador, Racha, Time } from '../lib/types'

const CUSTOM = 'custom'

export function CriarPartidaPage() {
  const { grupoId, rachaId } = useParams<{ grupoId: string; rachaId: string }>()
  const navigate = useNavigate()

  const [racha, setRacha] = useState<Racha | null>(null)
  const [times, setTimes] = useState<Time[]>([])
  const [timeA, setTimeA] = useState('')
  const [timeB, setTimeB] = useState('')
  const [confirmados, setConfirmados] = useState<PresencaComJogador[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // modo rápido: dropdown reaproveita time já sorteado, ou monta um personalizado na hora
  const [ladoASelecao, setLadoASelecao] = useState('')
  const [ladoBSelecao, setLadoBSelecao] = useState('')
  const [customNomeA, setCustomNomeA] = useState('')
  const [customNomeB, setCustomNomeB] = useState('')
  const [customJogadoresA, setCustomJogadoresA] = useState<string[]>([])
  const [customJogadoresB, setCustomJogadoresB] = useState<string[]>([])

  const modoRapido = racha?.modo === 'rapido'

  // só oferece no dropdown os times que têm jogador vinculado agora — times
  // travados em partidas passadas ficam de fora, sem poluir a lista
  const idsComJogador = new Set(confirmados.map((p) => p.time_id).filter(Boolean))
  const timesAtivos = times.filter((t) => idsComJogador.has(t.id))

  useEffect(() => {
    async function carregar() {
      if (!rachaId) return

      const [{ data: rachaData }, { data: timesData }, { data: presencasData }] = await Promise.all([
        supabase.from('rachas').select('*').eq('id', rachaId).single(),
        supabase.from('times').select('*').eq('racha_id', rachaId).order('created_at', { ascending: false }),
        supabase
          .from('presencas_racha')
          .select('jogador_id, status, time_id, pediu_vaga_em, jogadores(id, nome, user_id, email, created_at)')
          .eq('racha_id', rachaId)
          .eq('status', 'confirmado'),
      ])

      setRacha(rachaData)
      setTimes(timesData ?? [])
      setConfirmados((presencasData ?? []) as unknown as PresencaComJogador[])

      if (timesData && timesData.length >= 2) {
        setTimeA(timesData[0].id)
        setTimeB(timesData[1].id)
      }
    }

    carregar()
  }, [rachaId])

  function toggleCustomA(jogadorId: string) {
    setCustomJogadoresA((prev) => {
      if (prev.includes(jogadorId)) return prev.filter((id) => id !== jogadorId)

      const limite = racha?.tamanho_equipe
      if (limite && prev.length >= limite) {
        setErro(`Máximo ${limite} jogadores por time`)
        return prev
      }

      setErro(null)
      return [...prev, jogadorId]
    })
  }

  function toggleCustomB(jogadorId: string) {
    setCustomJogadoresB((prev) => {
      if (prev.includes(jogadorId)) return prev.filter((id) => id !== jogadorId)

      const limite = racha?.tamanho_equipe
      if (limite && prev.length >= limite) {
        setErro(`Máximo ${limite} jogadores por time`)
        return prev
      }

      setErro(null)
      return [...prev, jogadorId]
    })
  }

  async function handleSubmitRapido(e: FormEvent) {
    e.preventDefault()
    if (!rachaId || !racha) return

    if (!ladoASelecao || !ladoBSelecao) {
      setErro('Escolhe os dois times')
      return
    }

    if (ladoASelecao !== CUSTOM && ladoASelecao === ladoBSelecao) {
      setErro('Escolhe dois times diferentes')
      return
    }

    const jogadoresA =
      ladoASelecao === CUSTOM
        ? customJogadoresA
        : confirmados.filter((p) => p.time_id === ladoASelecao).map((p) => p.jogador_id)
    const jogadoresB =
      ladoBSelecao === CUSTOM
        ? customJogadoresB
        : confirmados.filter((p) => p.time_id === ladoBSelecao).map((p) => p.jogador_id)

    if (jogadoresA.length === 0 || jogadoresB.length === 0) {
      setErro('Cada time precisa de pelo menos 1 jogador')
      return
    }

    if (jogadoresA.some((id) => jogadoresB.includes(id))) {
      setErro('Um jogador não pode estar nos dois times')
      return
    }

    if (ladoASelecao === CUSTOM && !customNomeA.trim()) {
      setErro('Dá um nome pro time personalizado')
      return
    }

    if (ladoBSelecao === CUSTOM && !customNomeB.trim()) {
      setErro('Dá um nome pro time personalizado')
      return
    }

    if (
      ladoASelecao === CUSTOM &&
      ladoBSelecao === CUSTOM &&
      customNomeA.trim().toLowerCase() === customNomeB.trim().toLowerCase()
    ) {
      setErro('Os times precisam ter nomes diferentes')
      return
    }

    setSalvando(true)
    setErro(null)

    let timeAId = ladoASelecao
    let timeBId = ladoBSelecao

    if (ladoASelecao === CUSTOM) {
      const { data, error } = await supabase
        .from('times')
        .insert({ racha_id: rachaId, nome: customNomeA.trim() })
        .select()
        .single()

      if (error || !data) {
        setSalvando(false)
        setErro(error?.message ?? 'Erro ao criar time')
        return
      }
      timeAId = data.id
    }

    if (ladoBSelecao === CUSTOM) {
      const { data, error } = await supabase
        .from('times')
        .insert({ racha_id: rachaId, nome: customNomeB.trim() })
        .select()
        .single()

      if (error || !data) {
        setSalvando(false)
        setErro(error?.message ?? 'Erro ao criar time')
        return
      }
      timeBId = data.id
    }

    // mantém presencas_racha.time_id em sincronia — é o que a tela Times e o
    // próprio dropdown desta página usam pra saber "o time atual" de cada jogador
    await supabase.from('presencas_racha').update({ time_id: timeAId }).eq('racha_id', rachaId).in('jogador_id', jogadoresA)
    await supabase.from('presencas_racha').update({ time_id: timeBId }).eq('racha_id', rachaId).in('jogador_id', jogadoresB)

    const { data: partida, error: erroPartida } = await supabase
      .from('partidas')
      .insert({ racha_id: rachaId, time_a_id: timeAId, time_b_id: timeBId, status: 'em_andamento' })
      .select()
      .single()

    if (erroPartida || !partida) {
      setSalvando(false)
      setErro(erroPartida?.message ?? 'Erro ao criar partida')
      return
    }

    if (racha.modalidade === 'volei') {
      const { error: erroSet } = await supabase.from('sets').insert({ partida_id: partida.id, numero: 1 })
      if (erroSet) {
        setSalvando(false)
        setErro(erroSet.message)
        return
      }
    }

    const escalacoes = [
      ...jogadoresA.map((jogador_id) => ({ partida_id: partida.id, jogador_id, time_id: timeAId })),
      ...jogadoresB.map((jogador_id) => ({ partida_id: partida.id, jogador_id, time_id: timeBId })),
    ]

    const { error: erroEscalacao } = await supabase.from('escalacoes_partida').insert(escalacoes)

    setSalvando(false)

    if (erroEscalacao) {
      setErro(erroEscalacao.message)
      return
    }

    navigate(`/grupos/${grupoId}/rachas/${rachaId}/partidas/${partida.id}`)
  }

  async function handleSubmitTorneio(e: FormEvent) {
    e.preventDefault()
    if (!rachaId || !racha || !timeA || !timeB) return

    if (timeA === timeB) {
      setErro('Escolhe dois times diferentes')
      return
    }

    setSalvando(true)
    setErro(null)

    const { data: partida, error: erroPartida } = await supabase
      .from('partidas')
      .insert({ racha_id: rachaId, time_a_id: timeA, time_b_id: timeB, status: 'em_andamento' })
      .select()
      .single()

    if (erroPartida || !partida) {
      setSalvando(false)
      setErro(erroPartida?.message ?? 'Erro ao criar partida')
      return
    }

    if (racha.modalidade === 'volei') {
      const { error: erroSet } = await supabase.from('sets').insert({ partida_id: partida.id, numero: 1 })

      if (erroSet) {
        setSalvando(false)
        setErro(erroSet.message)
        return
      }
    }

    setSalvando(false)
    navigate(`/grupos/${grupoId}/rachas/${rachaId}/partidas/${partida.id}`)
  }

  function opcoesTime(selecaoAtual: string, outraSelecao: string) {
    return (
      <>
        <option value="">Selecione</option>
        {timesAtivos.map((t) => (
          <option key={t.id} value={t.id} disabled={t.id === outraSelecao && outraSelecao !== CUSTOM}>
            {t.nome}
          </option>
        ))}
        <option value={CUSTOM}>+ Time personalizado</option>
      </>
    )
  }

  function rosterDoTime(timeId: string) {
    return confirmados.filter((p) => p.time_id === timeId).map((p) => p.jogadores?.nome ?? '?')
  }

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1">
          <Link
            to={`/grupos/${grupoId}/rachas/${rachaId}`}
            className="text-sm text-neutral-400 hover:text-neutral-200"
          >
            ← Voltar
          </Link>
          <h1 className="text-xl font-semibold">Nova partida</h1>
        </header>

        {modoRapido ? (
          <form onSubmit={handleSubmitRapido} className="space-y-4">
            <p className="text-sm text-neutral-500">
              Escolhe os times pra essa partida — pode variar a cada jogo, sem afetar as outras. Nome de time só
              muda na tela Times.
            </p>

            <div>
              <label className="mb-1 block text-sm text-neutral-400">Time A</label>
              <select
                value={ladoASelecao}
                onChange={(e) => setLadoASelecao(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
              >
                {opcoesTime(ladoASelecao, ladoBSelecao)}
              </select>

              {ladoASelecao && ladoASelecao !== CUSTOM && (
                <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-400">
                  {rosterDoTime(ladoASelecao).join(', ')}
                </div>
              )}

              {ladoASelecao === CUSTOM && (
                <div className="mt-2 space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <input
                    type="text"
                    value={customNomeA}
                    onChange={(e) => setCustomNomeA(e.target.value)}
                    placeholder="Nome do novo time"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                  <div className="space-y-1">
                    {confirmados.map((p) => (
                      <label key={p.jogador_id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={customJogadoresA.includes(p.jogador_id)}
                          onChange={() => toggleCustomA(p.jogador_id)}
                        />
                        {p.jogadores?.nome}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-400">Time B</label>
              <select
                value={ladoBSelecao}
                onChange={(e) => setLadoBSelecao(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
              >
                {opcoesTime(ladoBSelecao, ladoASelecao)}
              </select>

              {ladoBSelecao && ladoBSelecao !== CUSTOM && (
                <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-400">
                  {rosterDoTime(ladoBSelecao).join(', ')}
                </div>
              )}

              {ladoBSelecao === CUSTOM && (
                <div className="mt-2 space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <input
                    type="text"
                    value={customNomeB}
                    onChange={(e) => setCustomNomeB(e.target.value)}
                    placeholder="Nome do novo time"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                  <div className="space-y-1">
                    {confirmados.map((p) => (
                      <label key={p.jogador_id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={customJogadoresB.includes(p.jogador_id)}
                          onChange={() => toggleCustomB(p.jogador_id)}
                        />
                        {p.jogadores?.nome}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {erro && <p className="text-sm text-red-400">{erro}</p>}

            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950 disabled:opacity-50"
            >
              {salvando ? 'Criando...' : 'Iniciar partida'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmitTorneio} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-neutral-400">Time A</label>
              <select
                value={timeA}
                onChange={(e) => setTimeA(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
              >
                {times.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-400">Time B</label>
              <select
                value={timeB}
                onChange={(e) => setTimeB(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
              >
                {times.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>

            {erro && <p className="text-sm text-red-400">{erro}</p>}

            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950 disabled:opacity-50"
            >
              {salvando ? 'Criando...' : 'Iniciar partida'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
