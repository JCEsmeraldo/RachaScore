import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { CHAVE_CONVITE_PENDENTE } from './ConvitePage'

export function AssumirPerfilPage() {
  const { token } = useParams<{ token: string }>()
  const { session, loading: loadingAuth } = useAuth()
  const navigate = useNavigate()

  const [jogadorNome, setJogadorNome] = useState<string | null>(null)
  const [grupoNome, setGrupoNome] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  useEffect(() => {
    async function buscarPreview() {
      if (!token) return
      setLoading(true)

      const { data, error } = await supabase.rpc('preview_convite_jogador', { p_token: token })

      if (error || !data || data.length === 0) {
        setErro('Convite inválido, expirado ou já usado.')
      } else {
        setJogadorNome(data[0].jogador_nome)
        setGrupoNome(data[0].grupo_nome)
      }

      setLoading(false)
    }

    buscarPreview()
  }, [token])

  async function handleAssumir() {
    if (!token) return
    setEntrando(true)
    setErro(null)

    const { data, error } = await supabase.rpc('associar_conta_jogador', { p_token: token })

    setEntrando(false)

    if (error) {
      setErro(error.message)
      return
    }

    localStorage.removeItem(CHAVE_CONVITE_PENDENTE)
    navigate(`/grupos/${data}`)
  }

  function handleIrParaLogin() {
    if (token) {
      localStorage.setItem(CHAVE_CONVITE_PENDENTE, `assumir:${token}`)
    }
    navigate('/login')
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-neutral-950 px-4 text-white">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6 text-center">
        {loading || loadingAuth ? (
          <p className="text-neutral-400">Carregando convite...</p>
        ) : erro ? (
          <p className="text-red-400">{erro}</p>
        ) : (
          <>
            <p className="text-neutral-400">Assumir o perfil de</p>
            <h1 className="text-xl font-semibold">{jogadorNome}</h1>
            <p className="text-sm text-neutral-500">
              no grupo <span className="text-neutral-300">{grupoNome}</span> — mantém todo o histórico e estatísticas já
              registrados
            </p>

            {session ? (
              <button
                onClick={handleAssumir}
                disabled={entrando}
                className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950 disabled:opacity-50"
              >
                {entrando ? 'Assumindo...' : 'Assumir esse perfil'}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleIrParaLogin}
                  className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950"
                >
                  Entrar ou criar conta pra assumir
                </button>
                <Link to="/" className="block text-sm text-neutral-400 hover:text-neutral-200">
                  Agora não
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
