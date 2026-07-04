import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const CHAVE_CONVITE_PENDENTE = 'convite_pendente'

export function ConvitePage() {
  const { token } = useParams<{ token: string }>()
  const { session, loading: loadingAuth } = useAuth()
  const navigate = useNavigate()

  const [grupoNome, setGrupoNome] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  useEffect(() => {
    async function buscarPreview() {
      if (!token) return
      setLoading(true)

      const { data, error } = await supabase.rpc('preview_convite', { p_token: token })

      if (error || !data || data.length === 0) {
        setErro('Convite inválido ou expirado.')
      } else {
        setGrupoNome(data[0].grupo_nome)
      }

      setLoading(false)
    }

    buscarPreview()
  }, [token])

  async function handleEntrar() {
    if (!token) return
    setEntrando(true)
    setErro(null)

    const { data, error } = await supabase.rpc('entrar_no_grupo', { p_token: token })

    setEntrando(false)

    if (error) {
      setErro(error.message)
      return
    }

    localStorage.removeItem(CHAVE_CONVITE_PENDENTE)
    navigate(`/grupos/${data}`)
  }

  function handleIrParaLogin() {
    localStorage.setItem(CHAVE_CONVITE_PENDENTE, token ?? '')
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
            <p className="text-neutral-400">Você foi convidado pro grupo</p>
            <h1 className="text-xl font-semibold">{grupoNome}</h1>

            {session ? (
              <button
                onClick={handleEntrar}
                disabled={entrando}
                className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950 disabled:opacity-50"
              >
                {entrando ? 'Entrando...' : 'Entrar no grupo'}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleIrParaLogin}
                  className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950"
                >
                  Entrar ou criar conta pra participar
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

export { CHAVE_CONVITE_PENDENTE }
