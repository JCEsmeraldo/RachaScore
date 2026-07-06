import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Avaliacao, PresencaComJogador } from '../lib/types'

const NOTAS = [1, 2, 3, 4, 5]

export function AvaliarPage() {
  const { grupoId, rachaId } = useParams<{ grupoId: string; rachaId: string }>()
  const { session } = useAuth()

  const [confirmados, setConfirmados] = useState<PresencaComJogador[]>([])
  const [meuJogadorId, setMeuJogadorId] = useState<string | null>(null)
  const [notas, setNotas] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      if (!rachaId || !session) return
      setLoading(true)

      const [{ data: jogadorData }, { data: confirmadosData, error: erroConfirmados }] = await Promise.all([
        supabase.from('jogadores').select('id').eq('user_id', session.user.id).single(),
        supabase
          .from('presencas_racha')
          .select('jogador_id, status, time_id, pediu_vaga_em, jogadores(id, nome, user_id, email, created_at)')
          .eq('racha_id', rachaId)
          .eq('status', 'confirmado'),
      ])

      if (erroConfirmados) {
        setErro(erroConfirmados.message)
        setLoading(false)
        return
      }

      const meuId = jogadorData?.id ?? null
      setMeuJogadorId(meuId)
      setConfirmados((confirmadosData ?? []) as unknown as PresencaComJogador[])

      if (meuId) {
        const { data: avaliacoesData } = await supabase
          .from('avaliacoes')
          .select('*')
          .eq('racha_id', rachaId)
          .eq('avaliador_jogador_id', meuId)

        const iniciais: Record<string, number> = {}
        ;(avaliacoesData as Avaliacao[] | null)?.forEach((a) => {
          iniciais[a.avaliado_jogador_id] = a.nota
        })
        setNotas(iniciais)
      }

      setLoading(false)
    }

    carregar()
  }, [rachaId, session])

  function handleEscolherNota(jogadorId: string, nota: number) {
    setNotas((prev) => ({ ...prev, [jogadorId]: prev[jogadorId] === nota ? 0 : nota }))
    setSalvo(false)
  }

  async function handleSalvar() {
    if (!rachaId) return
    setSalvando(true)
    setErro(null)
    setSalvo(false)

    const payload = Object.entries(notas)
      .filter(([, nota]) => nota > 0)
      .map(([jogador_id, nota]) => ({ jogador_id, nota }))

    const { error } = await supabase.rpc('avaliar_jogadores', {
      p_racha_id: rachaId,
      p_notas: payload,
    })

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setSalvo(true)
  }

  const outrosConfirmados = confirmados.filter((p) => p.jogador_id !== meuJogadorId)
  const souConfirmado = confirmados.some((p) => p.jogador_id === meuJogadorId)

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
          <h1 className="text-xl font-semibold">Avaliar jogadores</h1>
        </header>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : !souConfirmado ? (
          <p className="text-sm text-neutral-500">
            Você precisa ter confirmado presença nesse racha pra avaliar os outros jogadores.
          </p>
        ) : outrosConfirmados.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum outro jogador confirmado ainda.</p>
        ) : (
          <>
            <p className="text-sm text-neutral-500">Dá uma nota de 1 a 5 pra quem jogou com você.</p>

            <ul className="space-y-2">
              {outrosConfirmados.map((p) => (
                <li
                  key={p.jogador_id}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
                >
                  <span className="text-sm">{p.jogadores?.nome ?? '(sem nome)'}</span>
                  <div className="flex gap-1">
                    {NOTAS.map((nota) => (
                      <button
                        key={nota}
                        type="button"
                        onClick={() => handleEscolherNota(p.jogador_id, nota)}
                        className={`h-8 w-8 rounded-full text-sm font-medium transition ${
                          notas[p.jogador_id] === nota
                            ? 'bg-emerald-500 text-neutral-950'
                            : 'border border-neutral-700 text-neutral-400'
                        }`}
                      >
                        {nota}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            <button
              onClick={handleSalvar}
              disabled={salvando}
              className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : salvo ? 'Salvo ✓' : 'Salvar avaliações'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
