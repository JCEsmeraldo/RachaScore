import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { compartilhar, gerarTextoCompartilhar } from '../lib/compartilhar'
import type { ConfigFutebol, ConfigVolei, PresencaComJogador, Racha } from '../lib/types'

function resumoConfig(racha: Racha) {
  if (racha.modalidade === 'futebol') {
    const c = racha.config as ConfigFutebol
    const partes = []
    if (c.minutos) partes.push(`${c.minutos} min`)
    if (c.gols) partes.push(`${c.gols} gols`)
    return partes.length === 2 ? `${partes.join(' ou ')} (o que vier primeiro)` : partes[0]
  }
  const c = racha.config as ConfigVolei
  return `${c.num_sets} sets até ${c.pontos_set}`
}

export function RachaDetailPage() {
  const { grupoId, rachaId } = useParams<{ grupoId: string; rachaId: string }>()

  const [racha, setRacha] = useState<Racha | null>(null)
  const [totalConfirmados, setTotalConfirmados] = useState(0)
  const [totalEspera, setTotalEspera] = useState(0)
  const [totalTimes, setTotalTimes] = useState(0)
  const [totalPartidas, setTotalPartidas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erroFatal, setErroFatal] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    async function carregar() {
      if (!rachaId) return
      setLoading(true)

      const { data: rachaData, error: erroRacha } = await supabase
        .from('rachas')
        .select('*')
        .eq('id', rachaId)
        .single()

      if (erroRacha || !rachaData) {
        setErroFatal(erroRacha?.message ?? 'Racha não encontrado')
        setLoading(false)
        return
      }

      setRacha(rachaData)

      const [
        { count: countConfirmados },
        { count: countEspera },
        { count: countTimes },
        { count: countPartidas },
      ] = await Promise.all([
        supabase
          .from('presencas_racha')
          .select('*', { count: 'exact', head: true })
          .eq('racha_id', rachaId)
          .eq('status', 'confirmado'),
        supabase
          .from('presencas_racha')
          .select('*', { count: 'exact', head: true })
          .eq('racha_id', rachaId)
          .eq('status', 'espera'),
        supabase.from('times').select('*', { count: 'exact', head: true }).eq('racha_id', rachaId),
        supabase.from('partidas').select('*', { count: 'exact', head: true }).eq('racha_id', rachaId),
      ])

      setTotalConfirmados(countConfirmados ?? 0)
      setTotalEspera(countEspera ?? 0)
      setTotalTimes(countTimes ?? 0)
      setTotalPartidas(countPartidas ?? 0)
      setLoading(false)
    }

    carregar()
  }, [rachaId])

  async function handleCompartilhar() {
    if (!rachaId || !racha) return
    setErro(null)

    const [{ data: presencasData, error: erroPresencas }, { data: grupoData, error: erroGrupo }] =
      await Promise.all([
        supabase
          .from('presencas_racha')
          .select('jogador_id, status, time_id, pediu_vaga_em, jogadores(id, nome, user_id, email, created_at)')
          .eq('racha_id', rachaId),
        supabase.from('grupos').select('convite_token').eq('id', racha.grupo_id).single(),
      ])

    if (erroPresencas || erroGrupo) {
      setErro(erroPresencas?.message ?? erroGrupo?.message ?? 'Erro ao gerar compartilhamento')
      return
    }

    const presencas = (presencasData ?? []) as unknown as PresencaComJogador[]
    const confirmados = presencas.filter((p) => p.status === 'confirmado')
    const espera = presencas
      .filter((p) => p.status === 'espera')
      .sort((a, b) => a.pediu_vaga_em.localeCompare(b.pediu_vaga_em))

    const linkConvite = grupoData
      ? `${window.location.origin}${import.meta.env.BASE_URL}convite/${grupoData.convite_token}?racha=${rachaId}`
      : null

    const texto = gerarTextoCompartilhar(racha, confirmados, espera, linkConvite)
    const resultado = await compartilhar(texto)

    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }

    if (resultado.copiado) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }
  }

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1">
          <Link to={`/grupos/${grupoId}/rachas`} className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Rachas
          </Link>
        </header>

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : erroFatal || !racha ? (
          <p className="text-red-400">{erroFatal ?? 'Racha não encontrado'}</p>
        ) : (
          <>
            <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl font-semibold capitalize">
                  {racha.modalidade} — {racha.modo === 'torneio' ? 'Torneio' : 'Jogo rápido'}
                </h1>
                <button
                  onClick={handleCompartilhar}
                  className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:border-neutral-600"
                >
                  {copiado ? 'Copiado!' : 'Compartilhar'}
                </button>
              </div>
              <p className="text-sm text-neutral-400">
                {new Date(racha.data_hora).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
                {racha.local && ` · ${racha.local}`}
              </p>
              <p className="text-sm text-neutral-300">Times de {racha.tamanho_equipe} jogadores</p>
              <p className="text-sm text-neutral-300">{resumoConfig(racha)}</p>
            </div>

            {erro && <p className="text-sm text-red-400">{erro}</p>}

            <div className="space-y-2">
              <Link
                to={`/grupos/${grupoId}/rachas/${rachaId}/presenca`}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 hover:border-neutral-700"
              >
                <span className="font-medium">Presença</span>
                <span className="text-sm text-neutral-500">
                  {totalConfirmados}
                  {racha.limite_jogadores && `/${racha.limite_jogadores}`}
                  {totalEspera > 0 && ` · ${totalEspera} na espera`}
                </span>
              </Link>

              <Link
                to={`/grupos/${grupoId}/rachas/${rachaId}/times`}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 hover:border-neutral-700"
              >
                <span className="font-medium">Times</span>
                <span className="text-sm text-neutral-500">{totalTimes}</span>
              </Link>

              <Link
                to={`/grupos/${grupoId}/rachas/${rachaId}/partidas`}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 hover:border-neutral-700"
              >
                <span className="font-medium">Partidas</span>
                <span className="text-sm text-neutral-500">{totalPartidas}</span>
              </Link>

              <Link
                to={`/grupos/${grupoId}/rachas/${rachaId}/estatisticas`}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 hover:border-neutral-700"
              >
                <span className="font-medium">Estatísticas</span>
              </Link>

              <Link
                to={`/grupos/${grupoId}/rachas/${rachaId}/avaliar`}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 hover:border-neutral-700"
              >
                <span className="font-medium">Avaliar jogadores</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
