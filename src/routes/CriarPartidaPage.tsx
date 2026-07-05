import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Racha, Time } from '../lib/types'

export function CriarPartidaPage() {
  const { grupoId, rachaId } = useParams<{ grupoId: string; rachaId: string }>()
  const navigate = useNavigate()

  const [racha, setRacha] = useState<Racha | null>(null)
  const [times, setTimes] = useState<Time[]>([])
  const [timeA, setTimeA] = useState('')
  const [timeB, setTimeB] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      if (!rachaId) return

      const [{ data: rachaData }, { data: timesData }] = await Promise.all([
        supabase.from('rachas').select('*').eq('id', rachaId).single(),
        supabase.from('times').select('*').eq('racha_id', rachaId),
      ])

      setRacha(rachaData)
      setTimes(timesData ?? [])

      if (timesData && timesData.length >= 2) {
        setTimeA(timesData[0].id)
        setTimeB(timesData[1].id)
      }
    }

    carregar()
  }, [rachaId])

  async function handleSubmit(e: FormEvent) {
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
      .insert({
        racha_id: rachaId,
        time_a_id: timeA,
        time_b_id: timeB,
        status: 'em_andamento',
      })
      .select()
      .single()

    if (erroPartida || !partida) {
      setSalvando(false)
      setErro(erroPartida?.message ?? 'Erro ao criar partida')
      return
    }

    if (racha.modalidade === 'volei') {
      const { error: erroSet } = await supabase
        .from('sets')
        .insert({ partida_id: partida.id, numero: 1 })

      if (erroSet) {
        setSalvando(false)
        setErro(erroSet.message)
        return
      }
    }

    setSalvando(false)
    navigate(`/grupos/${grupoId}/rachas/${rachaId}/partidas/${partida.id}`)
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

        <form onSubmit={handleSubmit} className="space-y-4">
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
      </div>
    </div>
  )
}
