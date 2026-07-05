import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export function useSouOrganizador(grupoId: string | undefined) {
  const { session } = useAuth()
  const [souOrganizador, setSouOrganizador] = useState(false)

  useEffect(() => {
    async function verificar() {
      if (!grupoId || !session) return

      const [{ data: grupo }, { data: membros }] = await Promise.all([
        supabase.from('grupos').select('dono_id').eq('id', grupoId).single(),
        supabase
          .from('membros_grupo')
          .select('is_admin, jogadores(user_id)')
          .eq('grupo_id', grupoId),
      ])

      if (!grupo) return

      const propria = ((membros ?? []) as unknown as { is_admin: boolean; jogadores: { user_id: string | null } | null }[]).find(
        (m) => m.jogadores?.user_id === session.user.id,
      )

      setSouOrganizador(grupo.dono_id === session.user.id || propria?.is_admin === true)
    }

    verificar()
  }, [grupoId, session])

  return souOrganizador
}
