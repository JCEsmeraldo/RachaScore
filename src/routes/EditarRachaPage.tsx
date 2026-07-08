import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { ConfigFutebol, ConfigVolei, Racha } from '../lib/types'

// só o organizador chega aqui (link só aparece pra ele); modalidade/modo ficam
// travados — trocar isso no meio do racha quebraria partidas/escalações já criadas
export function EditarRachaPage() {
  const { grupoId, rachaId } = useParams<{ grupoId: string; rachaId: string }>()
  const navigate = useNavigate()

  const [racha, setRacha] = useState<Racha | null>(null)
  const [tamanhoEquipe, setTamanhoEquipe] = useState(5)
  const [dataHora, setDataHora] = useState('')
  const [local, setLocal] = useState('')
  const [limiteJogadores, setLimiteJogadores] = useState('')
  const [finalizado, setFinalizado] = useState(false)

  const [usarTempo, setUsarTempo] = useState(true)
  const [minutos, setMinutos] = useState(10)
  const [usarGols, setUsarGols] = useState(false)
  const [gols, setGols] = useState(5)

  const [numSets, setNumSets] = useState(1)
  const [pontosSet, setPontosSet] = useState(15)

  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      if (!rachaId) return
      setLoading(true)

      const { data, error } = await supabase.from('rachas').select('*').eq('id', rachaId).single()

      if (error || !data) {
        setErro(error?.message ?? 'Racha não encontrado')
        setLoading(false)
        return
      }

      setRacha(data)
      setTamanhoEquipe(data.tamanho_equipe)
      setLocal(data.local ?? '')
      setLimiteJogadores(data.limite_jogadores ? String(data.limite_jogadores) : '')
      setFinalizado(data.finalizado)

      // datetime-local precisa de "YYYY-MM-DDTHH:mm" no horário local
      const d = new Date(data.data_hora)
      const offset = d.getTimezoneOffset()
      const local_iso = new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16)
      setDataHora(local_iso)

      if (data.modalidade === 'futebol') {
        const c = data.config as ConfigFutebol
        setUsarTempo(!!c.minutos)
        setMinutos(c.minutos ?? 10)
        setUsarGols(!!c.gols)
        setGols(c.gols ?? 5)
      } else {
        const c = data.config as ConfigVolei
        setNumSets(c.num_sets)
        setPontosSet(c.pontos_set)
      }

      setLoading(false)
    }

    carregar()
  }, [rachaId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!rachaId || !racha || !dataHora) return

    if (racha.modalidade === 'futebol' && !usarTempo && !usarGols) {
      setErro('Escolhe pelo menos um critério de fim de partida (tempo ou gols)')
      return
    }

    setSalvando(true)
    setErro(null)

    const config: ConfigFutebol | ConfigVolei =
      racha.modalidade === 'futebol'
        ? {
            ...(usarTempo ? { minutos } : {}),
            ...(usarGols ? { gols } : {}),
          }
        : { num_sets: numSets, pontos_set: pontosSet }

    const { error } = await supabase
      .from('rachas')
      .update({
        tamanho_equipe: tamanhoEquipe,
        config,
        data_hora: new Date(dataHora).toISOString(),
        local: local.trim() || null,
        limite_jogadores: limiteJogadores ? Number(limiteJogadores) : null,
        finalizado,
      })
      .eq('id', rachaId)

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    navigate(`/grupos/${grupoId}/rachas/${rachaId}`)
  }

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1">
          <Link to={`/grupos/${grupoId}/rachas/${rachaId}`} className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Voltar
          </Link>
          <h1 className="text-xl font-semibold">Editar racha</h1>
        </header>

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : !racha ? (
          <p className="text-red-400">{erro ?? 'Racha não encontrado'}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-neutral-500 capitalize">
              {racha.modalidade} · {racha.modo === 'torneio' ? 'Torneio' : 'Jogo rápido'}
            </p>

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

            {racha.modalidade === 'futebol' ? (
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

            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={finalizado}
                onChange={(e) => setFinalizado(e.target.checked)}
                className="accent-emerald-500"
              />
              Marcar racha como finalizado
            </label>

            {erro && <p className="text-sm text-red-400">{erro}</p>}

            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
