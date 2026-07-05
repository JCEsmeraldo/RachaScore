import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { ConfigFutebol, ConfigVolei } from '../lib/types'

export function CriarRachaPage() {
  const { grupoId } = useParams<{ grupoId: string }>()
  const navigate = useNavigate()

  const [modalidade, setModalidade] = useState<'futebol' | 'volei'>('futebol')
  const [modo, setModo] = useState<'torneio' | 'rapido'>('rapido')
  const [tamanhoEquipe, setTamanhoEquipe] = useState(5)
  const [dataHora, setDataHora] = useState('')
  const [local, setLocal] = useState('')
  const [limiteJogadores, setLimiteJogadores] = useState('')

  const [usarTempo, setUsarTempo] = useState(true)
  const [minutos, setMinutos] = useState(10)
  const [usarGols, setUsarGols] = useState(false)
  const [gols, setGols] = useState(5)

  const [numSets, setNumSets] = useState(1)
  const [pontosSet, setPontosSet] = useState(15)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!grupoId || !dataHora) return

    if (modalidade === 'futebol' && !usarTempo && !usarGols) {
      setErro('Escolhe pelo menos um critério de fim de partida (tempo ou gols)')
      return
    }

    setSalvando(true)
    setErro(null)

    const config: ConfigFutebol | ConfigVolei =
      modalidade === 'futebol'
        ? {
            ...(usarTempo ? { minutos } : {}),
            ...(usarGols ? { gols } : {}),
          }
        : { num_sets: numSets, pontos_set: pontosSet }

    const { data, error } = await supabase
      .from('rachas')
      .insert({
        grupo_id: grupoId,
        modalidade,
        modo,
        tamanho_equipe: tamanhoEquipe,
        config,
        data_hora: new Date(dataHora).toISOString(),
        local: local.trim() || null,
        limite_jogadores: limiteJogadores ? Number(limiteJogadores) : null,
      })
      .select()
      .single()

    setSalvando(false)

    if (error || !data) {
      setErro(error?.message ?? 'Erro ao criar racha')
      return
    }

    navigate(`/grupos/${grupoId}/rachas/${data.id}`)
  }

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1">
          <Link to={`/grupos/${grupoId}`} className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Voltar
          </Link>
          <h1 className="text-xl font-semibold">Criar racha</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-neutral-400">Modalidade</label>
            <div className="flex gap-2">
              {(['futebol', 'volei'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setModalidade(m)
                    setTamanhoEquipe(m === 'volei' ? 2 : 5)
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                    modalidade === m
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-300'
                  }`}
                >
                  {m === 'volei' ? 'Vôlei' : 'Futebol'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-400">Modo</label>
            <div className="flex gap-2">
              {(['rapido', 'torneio'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                    modo === m
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-300'
                  }`}
                >
                  {m === 'rapido' ? 'Jogo rápido' : 'Torneio'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-400">Jogadores por time</label>
            <input
              type="number"
              min={1}
              value={tamanhoEquipe}
              onChange={(e) => setTamanhoEquipe(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          {modalidade === 'futebol' ? (
            <div className="space-y-3 rounded-lg border border-neutral-800 p-3">
              <label className="block text-sm text-neutral-400">
                Fim de partida — marca um ou os dois; o que bater primeiro encerra
              </label>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={usarTempo}
                    onChange={(e) => setUsarTempo(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  Limitar por tempo
                </label>
                {usarTempo && (
                  <input
                    type="number"
                    min={1}
                    value={minutos}
                    onChange={(e) => setMinutos(Number(e.target.value))}
                    placeholder="Minutos por partida"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={usarGols}
                    onChange={(e) => setUsarGols(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  Limitar por gols
                </label>
                {usarGols && (
                  <input
                    type="number"
                    min={1}
                    value={gols}
                    onChange={(e) => setGols(Number(e.target.value))}
                    placeholder="Gols pra vencer"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-neutral-800 p-3">
              <label className="block text-sm text-neutral-400">Sets</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">Nº de sets</label>
                  <input
                    type="number"
                    min={1}
                    value={numSets}
                    onChange={(e) => setNumSets(Number(e.target.value))}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">Pontos/set</label>
                  <input
                    type="number"
                    min={1}
                    value={pontosSet}
                    onChange={(e) => setPontosSet(Number(e.target.value))}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-neutral-400">Data e hora</label>
            <input
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
              required
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-400">Local (opcional)</label>
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-400">
              Limite de jogadores (opcional — acima disso entra em lista de espera)
            </label>
            <input
              type="number"
              min={1}
              value={limiteJogadores}
              onChange={(e) => setLimiteJogadores(e.target.value)}
              placeholder="Sem limite"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          <button
            type="submit"
            disabled={salvando}
            className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950 disabled:opacity-50"
          >
            {salvando ? 'Criando...' : 'Criar racha'}
          </button>
        </form>
      </div>
    </div>
  )
}
