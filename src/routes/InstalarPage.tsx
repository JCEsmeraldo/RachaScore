import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type Plataforma = 'ios' | 'android' | 'outro'

function detectarPlataforma(): Plataforma {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'outro'
}

function jaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export function InstalarPage() {
  const [plataforma] = useState(detectarPlataforma)
  const [instalado] = useState(jaInstalado)
  const [promptEvent, setPromptEvent] = useState<Event | null>(null)

  useEffect(() => {
    function aoDispararPrompt(e: Event) {
      e.preventDefault()
      setPromptEvent(e)
    }
    window.addEventListener('beforeinstallprompt', aoDispararPrompt)
    return () => window.removeEventListener('beforeinstallprompt', aoDispararPrompt)
  }, [])

  async function instalarAgora() {
    if (!promptEvent) return
    // beforeinstallprompt não tem tipo padrão no lib.dom, então acessa via cast pontual
    await (promptEvent as unknown as { prompt: () => Promise<void> }).prompt()
    setPromptEvent(null)
  }

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header>
          <Link to="/" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Voltar
          </Link>
          <h1 className="text-xl font-semibold">Instalar no celular</h1>
        </header>

        {instalado ? (
          <p className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
            Já instalado — você está usando o app direto da tela inicial.
          </p>
        ) : (
          <>
            <p className="text-sm text-neutral-400">
              Instala o RachaScore como app: ícone na tela inicial, tela cheia, sem a barra do navegador.
            </p>

            {promptEvent && (
              <button
                type="button"
                onClick={instalarAgora}
                className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-medium text-neutral-950"
              >
                Instalar agora
              </button>
            )}

            {plataforma === 'ios' && (
              <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                <h2 className="text-sm font-medium">No iPhone (Safari)</h2>
                <ol className="list-decimal space-y-1 pl-4 text-sm text-neutral-300">
                  <li>
                    Toque no ícone de compartilhar <span className="text-neutral-500">(quadrado com seta pra cima)</span>{' '}
                    na barra do navegador.
                  </li>
                  <li>Role e toque em "Adicionar à Tela de Início".</li>
                  <li>Toque em "Adicionar" no canto superior direito.</li>
                </ol>
                <p className="text-xs text-neutral-500">Só funciona no Safari — não abre em outros navegadores no iPhone.</p>
              </div>
            )}

            {plataforma === 'android' && !promptEvent && (
              <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                <h2 className="text-sm font-medium">No Android (Chrome)</h2>
                <ol className="list-decimal space-y-1 pl-4 text-sm text-neutral-300">
                  <li>Toque nos três pontinhos no canto superior direito.</li>
                  <li>Toque em "Instalar app" ou "Adicionar à tela inicial".</li>
                </ol>
              </div>
            )}

            {plataforma === 'outro' && !promptEvent && (
              <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                <h2 className="text-sm font-medium">No computador</h2>
                <p className="text-sm text-neutral-300">
                  Procura um ícone de instalar na barra de endereço do navegador (geralmente um ⊕ ou tela com seta),
                  ou abre esse link direto no celular pra instalar lá.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
