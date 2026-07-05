import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useSouOrganizador } from '../lib/useSouOrganizador'
import { compartilhar, gerarTextoCompartilhar } from '../lib/compartilhar'
import type { MembroComJogador, PresencaComJogador, Racha } from '../lib/types'

export function PresencaPage() {
  const { grupoId, rachaId } = useParams<{ grupoId: string; rachaId: string }>()
  const { session } = useAuth()
  const souOrganizador = useSouOrganizador(grupoId)

  const [racha, setRacha] = useState<Racha | null>(null)
  const [presencas, setPresencas] = useState<PresencaComJogador[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [mostrarCompartilhar, setMostrarCompartilhar] = useState(false)

  async function carregar() {
    if (!rachaId || !grupoId) return
    setLoading(true)

    const [
      { data: rachaData },
      { data: membrosData, error: erroMembros },
      { data: presencasData, error: erroPresencas },
    ] = await Promise.all([
      supabase.from('rachas').select('*').eq('id', rachaId).single(),
      supabase
        .from('membros_grupo')
        .select('jogador_id, is_admin, jogadores(id, nome, user_id, email, created_at)')
        .eq('grupo_id', grupoId),
      supabase
        .from('presencas_racha')
        .select('jogador_id, status, time_id, pediu_vaga_em, jogadores(id, nome, user_id, email, created_at)')
        .eq('racha_id', rachaId),
    ])

    if (erroMembros || erroPresencas) {
      setErro(erroMembros?.message ?? erroPresencas?.message ?? 'Erro ao carregar presença')
      setLoading(false)
      return
    }

    setRacha(rachaData)

    const membros = (membrosData ?? []) as unknown as MembroComJogador[]
    const existentes = (presencasData ?? []) as unknown as PresencaComJogador[]

    const combinado: PresencaComJogador[] = membros.map((m) => {
      const presenca = existentes.find((p) => p.jogador_id === m.jogador_id)
      return (
        presenca ?? {
          jogador_id: m.jogador_id,
          status: 'ausente' as const,
          time_id: null,
          pediu_vaga_em: '',
          jogadores: m.jogadores,
        }
      )
    })

    setPresencas(combinado)
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

    // convida a compartilhar só quando a própria pessoa confirma a própria presença
    const ehProprioJogador = presencas.find((p) => p.jogador_id === jogadorId)?.jogadores?.user_id === session?.user.id
    if (querJogar && ehProprioJogador) {
      setMostrarCompartilhar(true)
    }

    carregar()
  }

  async function handleCompartilharLista() {
    if (!rachaId || !racha) return
    setErro(null)

    const { data: grupoData } = await supabase.from('grupos').select('convite_token').eq('id', racha.grupo_id).single()

    const confirmados = presencas.filter((p) => p.status === 'confirmado')
    const espera = presencas
      .filter((p) => p.status === 'espera')
      .sort((a, b) => a.pediu_vaga_em.localeCompare(b.pediu_vaga_em))

    const linkConvite = grupoData
      ? `${window.location.origin}${import.meta.env.BASE_URL}convite/${grupoData.convite_token}?racha=${rachaId}`
      : null

    const texto = gerarTextoCompartilhar(racha, confirmados, espera, linkConvite)
    const resultado = await compartilhar(texto)

    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }

    if (resultado.copiado) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }

    setMostrarCompartilhar(false)
  }

  const confirmados = presencas.filter((p) => p.status === 'confirmado')
  const espera = presencas
    .filter((p) => p.status === 'espera')
    .sort((a, b) => a.pediu_vaga_em.localeCompare(b.pediu_vaga_em))

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
          <h1 className="text-xl font-semibold">
            Presença — {confirmados.length} confirmado{confirmados.length === 1 ? '' : 's'}
            {espera.length > 0 && ` · ${espera.length} na espera`}
          </h1>
        </header>

        {mostrarCompartilhar && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3">
            <p className="text-sm text-emerald-400">Presença confirmada! Atualiza a lista no grupo do WhatsApp?</p>
            <button
              onClick={handleCompartilharLista}
              className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-neutral-950"
            >
              {copiado ? 'Copiado!' : 'Compartilhar'}
            </button>
          </div>
        )}

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : (
          <ul className="space-y-2">
            {presencas.map((p) => {
              const podeMexer = souOrganizador || p.jogadores?.user_id === session?.user.id
              const querJogar = p.status !== 'ausente'

              return (
                <li
                  key={p.jogador_id}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2"
                >
                  <span>{p.jogadores?.nome ?? '(sem nome)'}</span>
                  <button
                    type="button"
                    disabled={!podeMexer}
                    onClick={() => handleAlternarPresenca(p.jogador_id, !querJogar)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-40 ${
                      p.status === 'confirmado'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : p.status === 'espera'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {p.status === 'confirmado'
                      ? 'Confirmado ✓'
                      : p.status === 'espera'
                        ? `Na fila (${espera.findIndex((e) => e.jogador_id === p.jogador_id) + 1}º)`
                        : 'Confirmar'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
