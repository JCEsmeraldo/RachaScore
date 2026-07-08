import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Grupo, MembroComJogador, Racha } from '../lib/types'

export function RachasPage() {
  const { grupoId } = useParams<{ grupoId: string }>()
  const { session } = useAuth()

  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [rachas, setRachas] = useState<Racha[]>([])
  const [souOrganizador, setSouOrganizador] = useState(false)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      if (!grupoId) return
      setLoading(true)

      const [
        { data: grupoData, error: erroGrupo },
        { data: membrosData, error: erroMembros },
        { data: rachasData, error: erroRachas },
      ] = await Promise.all([
        supabase.from('grupos').select('*').eq('id', grupoId).single(),
        supabase
          .from('membros_grupo')
          .select('is_admin, jogadores(user_id)')
          .eq('grupo_id', grupoId),
        supabase
          .from('rachas')
          .select('*')
          .eq('grupo_id', grupoId)
          .order('data_hora', { ascending: true }),
      ])

      if (erroGrupo) setErro(erroGrupo.message)
      else setGrupo(grupoData)

      if (erroRachas) setErro(erroRachas.message)
      else setRachas(rachasData ?? [])

      if (!erroMembros && grupoData && session) {
        const membros = (membrosData ?? []) as unknown as MembroComJogador[]
        const propria = membros.find((m) => m.jogadores?.user_id === session.user.id)
        setSouOrganizador(grupoData.dono_id === session.user.id || propria?.is_admin === true)
      }

      setLoading(false)
    }

    carregar()
  }, [grupoId, session])

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1">
          <Link to={`/grupos/${grupoId}`} className="text-sm text-neutral-400 hover:text-neutral-200">
            ← {grupo?.nome ?? 'Voltar'}
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Rachas</h1>
            {souOrganizador && (
              <Link
                to={`/grupos/${grupoId}/rachas/novo`}
                className="text-sm text-emerald-400 hover:text-emerald-300"
              >
                + Criar racha
              </Link>
            )}
          </div>
        </header>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : rachas.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum racha ainda.</p>
        ) : (
          <ul className="space-y-2">
            {rachas.map((racha) => (
              <li key={racha.id}>
                <Link
                  to={`/grupos/${grupoId}/rachas/${racha.id}`}
                  className="block rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-neutral-700"
                >
                  <span className="capitalize">{racha.modalidade}</span>
                  <span className="text-neutral-500"> · {racha.modo === 'torneio' ? 'Torneio' : 'Rápido'} · </span>
                  <span className="text-neutral-400">
                    {new Date(racha.data_hora).toLocaleDateString('pt-BR')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
