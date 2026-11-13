import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { APP_VERSION, CHANGELOG, markChangesSeen, type ChangeKind } from '../lib/changelog'

const KIND: Record<ChangeKind, { label: string; className: string }> = {
  new: { label: 'Novo', className: 'text-emerald-400' },
  improved: { label: 'Melhoria', className: 'text-sky-400' },
  fix: { label: 'Correção', className: 'text-amber-400' },
}

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))

// Novidades: o que mudou no app, por versão.
export function ChangelogPage() {
  useEffect(() => {
    markChangesSeen()
  }, [])

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header>
          <Link to="/" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Voltar
          </Link>
        </header>

        <div>
          <h1 className="text-xl font-semibold">Novidades</h1>
          <p className="text-sm text-neutral-400">
            O que mudou no RachaScore, do mais recente para o mais antigo. Você está na versão {APP_VERSION}.
          </p>
        </div>

        {CHANGELOG.map((entry) => (
          <section key={entry.version} className="space-y-2">
            <h2 className="flex items-baseline gap-2 text-sm">
              <span className="font-semibold">Versão {entry.version}</span>
              <span className="text-neutral-500">· {dayLabel(entry.date)}</span>
              {entry.version === APP_VERSION && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  atual
                </span>
              )}
            </h2>
            <ul className="divide-y divide-neutral-800 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
              {entry.items.map((item) => (
                <li key={item.text} className="flex gap-3 px-4 py-3 text-sm">
                  <span className={`w-16 shrink-0 text-xs font-medium leading-5 ${KIND[item.kind].className}`}>
                    {KIND[item.kind].label}
                  </span>
                  <span className="text-neutral-200">{item.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
