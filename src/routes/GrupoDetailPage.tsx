import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Grupo } from '../lib/types'

export function GrupoDetailPage() {
  const { grupoId } = useParams<{ grupoId: string }>()

  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [totalMembros, setTotalMembros] = useState(0)
  const [totalRachas, setTotalRachas] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      if (!grupoId) return

      const [
        { data: grupoData, error: erroGrupo },
        { count: countMembros },
        { count: countRachas },
      ] = await Promise.all([
        supabase.from('grupos').select('*').eq('id', grupoId).single(),
        supabase
          .from('membros_grupo')
          .select('*', { count: 'exact', head: true })
          .eq('grupo_id', grupoId),
        supabase
          .from('rachas')
          .select('*', { count: 'exact', head: true })
          .eq('grupo_id', grupoId),
      ])

      if (erroGrupo) {
        setErro(erroGrupo.message)
        return
      }

      setGrupo(grupoData)
      setTotalMembros(countMembros ?? 0)
      setTotalRachas(countRachas ?? 0)
    }

    carregar()
  }, [grupoId])

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1">
          <Link to="/" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Meus grupos
          </Link>
          <h1 className="text-xl font-semibold">{grupo?.nome ?? '...'}</h1>
        </header>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="space-y-2">
          <Link
            to={`/grupos/${grupoId}/rachas`}
            className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 hover:border-neutral-700"
          >
            <span className="font-medium">Rachas</span>
            <span className="text-sm text-neutral-500">{totalRachas}</span>
          </Link>

          <Link
            to={`/grupos/${grupoId}/membros`}
            className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 hover:border-neutral-700"
          >
            <span className="font-medium">Membros</span>
            <span className="text-sm text-neutral-500">{totalMembros}</span>
          </Link>

          <Link
            to={`/grupos/${grupoId}/estatisticas`}
            className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 hover:border-neutral-700"
          >
            <span className="font-medium">Estatísticas</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
