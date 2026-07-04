import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { CHAVE_CONVITE_PENDENTE } from './ConvitePage'

function destinoAposLogin() {
  const token = localStorage.getItem(CHAVE_CONVITE_PENDENTE)
  return token ? `/convite/${token}` : '/'
}

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { session, loading, signInWithPassword, signUp } = useAuth()
  const navigate = useNavigate()

  if (!loading && session) {
    return <Navigate to={destinoAposLogin()} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    const result =
      mode === 'login'
        ? await signInWithPassword(email, password)
        : await signUp(email, password, nome)

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (mode === 'signup') {
      setInfo('Conta criada. Confirme o e-mail e faça login.')
      setMode('login')
      return
    }

    navigate(destinoAposLogin())
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-neutral-950 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6 shadow-lg"
      >
        <h1 className="text-xl font-semibold text-white">
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </h1>

        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white placeholder-neutral-500 outline-none focus:border-emerald-500"
          />
        )}

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white placeholder-neutral-500 outline-none focus:border-emerald-500"
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white placeholder-neutral-500 outline-none focus:border-emerald-500"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}
        {info && <p className="text-sm text-emerald-400">{info}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950 transition disabled:opacity-50"
        >
          {submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null)
            setInfo(null)
            setMode(mode === 'login' ? 'signup' : 'login')
          }}
          className="w-full text-sm text-neutral-400 hover:text-neutral-200"
        >
          {mode === 'login' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </div>
  )
}
