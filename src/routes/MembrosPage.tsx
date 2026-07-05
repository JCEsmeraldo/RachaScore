import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Grupo, MembroComJogador } from '../lib/types'

export function MembrosPage() {
  const { grupoId } = useParams<{ grupoId: string }>()
  const { session } = useAuth()

  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [membros, setMembros] = useState<MembroComJogador[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [nomeNovoMembro, setNomeNovoMembro] = useState('')
  const [emailNovoMembro, setEmailNovoMembro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)

  const souDono = !!grupo && !!session && grupo.dono_id === session.user.id
  const propriaMembresia = membros.find((m) => m.jogadores?.user_id === session?.user.id)
  const souOrganizador = souDono || propriaMembresia?.is_admin === true

  async function carregar() {
    if (!grupoId) return
    setLoading(true)

    const [{ data: grupoData, error: erroGrupo }, { data: membrosData, error: erroMembros }] =
      await Promise.all([
        supabase.from('grupos').select('*').eq('id', grupoId).single(),
        supabase
          .from('membros_grupo')
          .select('jogador_id, is_admin, jogadores(id, nome, user_id, email, created_at)')
          .eq('grupo_id', grupoId),
      ])

    if (erroGrupo) {
      setErro(erroGrupo.message)
    } else {
      setGrupo(grupoData)
    }

    if (erroMembros) {
      setErro(erroMembros.message)
    } else {
      setMembros((membrosData as unknown as MembroComJogador[]) ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId])

  async function handleAdicionarMembro(e: FormEvent) {
    e.preventDefault()
    if (!grupoId || !nomeNovoMembro.trim()) return

    setSalvando(true)
    setErro(null)

    const { error } = await supabase.rpc('adicionar_membro_grupo', {
      p_grupo_id: grupoId,
      p_nome: nomeNovoMembro.trim(),
      p_email: emailNovoMembro.trim() || null,
    })

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setNomeNovoMembro('')
    setEmailNovoMembro('')
    carregar()
  }

  async function handleRemoverMembro(jogadorId: string) {
    if (!grupoId) return
    setErro(null)

    const { error } = await supabase
      .from('membros_grupo')
      .delete()
      .eq('grupo_id', grupoId)
      .eq('jogador_id', jogadorId)

    if (error) {
      setErro(error.message)
      return
    }

    carregar()
  }

  async function handleAlternarAdmin(jogadorId: string, novoValor: boolean) {
    if (!grupoId) return
    setErro(null)

    const { error } = await supabase
      .from('membros_grupo')
      .update({ is_admin: novoValor })
      .eq('grupo_id', grupoId)
      .eq('jogador_id', jogadorId)

    if (error) {
      setErro(error.message)
      return
    }

    carregar()
  }

  async function handleGerarNovoLink() {
    if (!grupoId) return
    setErro(null)

    const { error } = await supabase
      .from('grupos')
      .update({ convite_token: crypto.randomUUID() })
      .eq('id', grupoId)

    if (error) {
      setErro(error.message)
      return
    }

    carregar()
  }

  function handleCopiarLink() {
    if (!grupo) return
    const url = `${window.location.origin}${import.meta.env.BASE_URL}convite/${grupo.convite_token}`
    navigator.clipboard.writeText(url)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1">
          <Link to={`/grupos/${grupoId}`} className="text-sm text-neutral-400 hover:text-neutral-200">
            ← {grupo?.nome ?? 'Voltar'}
          </Link>
          <h1 className="text-xl font-semibold">Membros</h1>
        </header>

        {souOrganizador && grupo && (
          <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Link de convite — qualquer pessoa com o link entra no grupo</p>
            <div className="flex gap-2">
              <button
                onClick={handleCopiarLink}
                className="flex-1 truncate rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-left text-sm text-neutral-300"
              >
                {linkCopiado ? 'Copiado!' : `${window.location.origin}${import.meta.env.BASE_URL}convite/${grupo.convite_token}`}
              </button>
              <button
                onClick={handleGerarNovoLink}
                className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600"
              >
                Gerar novo
              </button>
            </div>
          </div>
        )}

        {souOrganizador && (
          <form onSubmit={handleAdicionarMembro} className="space-y-2">
            <input
              type="text"
              placeholder="Nome do jogador"
              value={nomeNovoMembro}
              onChange={(e) => setNomeNovoMembro(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 placeholder-neutral-500 outline-none focus:border-emerald-500"
            />
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="E-mail (opcional — linka a conta quando a pessoa se cadastrar)"
                value={emailNovoMembro}
                onChange={(e) => setEmailNovoMembro(e.target.value)}
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm placeholder-neutral-500 outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-neutral-950 disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </form>
        )}

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : membros.length === 0 ? (
          <p className="text-neutral-400">Nenhum membro fixo ainda.</p>
        ) : (
          <ul className="space-y-2">
            {membros.map((membro) => (
              <li
                key={membro.jogador_id}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
              >
                <Link
                  to={`/grupos/${grupoId}/jogadores/${membro.jogador_id}`}
                  className="hover:text-emerald-400"
                >
                  {membro.jogadores?.nome ?? '(sem nome)'}
                  {membro.is_admin && (
                    <span className="ml-2 text-xs text-emerald-400">admin</span>
                  )}
                  {membro.jogadores?.email && !membro.jogadores?.user_id && (
                    <span className="ml-2 text-xs text-amber-400">
                      convite pendente ({membro.jogadores.email})
                    </span>
                  )}
                </Link>
                {souOrganizador && membro.jogadores?.user_id !== grupo?.dono_id && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAlternarAdmin(membro.jogador_id, !membro.is_admin)}
                      className="text-sm text-neutral-400 hover:text-neutral-200"
                    >
                      {membro.is_admin ? 'Remover admin' : 'Tornar admin'}
                    </button>
                    <button
                      onClick={() => handleRemoverMembro(membro.jogador_id)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
