import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Grupo } from '../lib/types'

export function GruposPage() {
  const { session, signOut } = useAuth()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [nomeNovoGrupo, setNomeNovoGrupo] = useState('')
  const [criando, setCriando] = useState(false)

  async function carregarGrupos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('grupos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setErro(error.message)
    } else {
      setGrupos(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    carregarGrupos()
  }, [])

  async function handleCriarGrupo(e: FormEvent) {
    e.preventDefault()
    if (!session || !nomeNovoGrupo.trim()) return

    setCriando(true)
    setErro(null)

    const { error } = await supabase.rpc('criar_grupo', { p_nome: nomeNovoGrupo.trim() })

    setCriando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setNomeNovoGrupo('')
    carregarGrupos()
  }

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Meus grupos</h1>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/instalar" className="text-neutral-400 hover:text-neutral-200">
              📲 Instalar
            </Link>
            <button onClick={signOut} className="text-neutral-400 hover:text-neutral-200">
              Sair
            </button>
          </div>
        </header>

        <form onSubmit={handleCriarGrupo} className="flex gap-2">
          <input
            type="text"
            placeholder="Nome do grupo"
            value={nomeNovoGrupo}
            onChange={(e) => setNomeNovoGrupo(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 placeholder-neutral-500 outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={criando}
            className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-neutral-950 disabled:opacity-50"
          >
            Criar
          </button>
        </form>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : grupos.length === 0 ? (
          <p className="text-neutral-400">Nenhum grupo ainda. Crie o primeiro acima.</p>
        ) : (
          <ul className="space-y-2">
            {grupos.map((grupo) => (
              <li key={grupo.id}>
                <Link
                  to={`/grupos/${grupo.id}`}
                  className="block rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-neutral-700"
                >
                  {grupo.nome}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
