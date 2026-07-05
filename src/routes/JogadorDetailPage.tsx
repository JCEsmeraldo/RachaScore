import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { montarTabelaMotivos, type LinhaMotivo } from '../lib/estatisticas'
import { TabelaMotivos } from '../components/TabelaMotivos'

type StatsModalidade = {
  jogos: number
  vitorias: number
  empates: number
  derrotas: number
  pontos: number
  motivos: LinhaMotivo[]
}

function statsVazio(): StatsModalidade {
  return { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, pontos: 0, motivos: [] }
}

export function JogadorDetailPage() {
  const { grupoId, jogadorId } = useParams<{ grupoId: string; jogadorId: string }>()

  const [nome, setNome] = useState<string | null>(null)
  const [futebol, setFutebol] = useState<StatsModalidade>(statsVazio())
  const [volei, setVolei] = useState<StatsModalidade>(statsVazio())
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      if (!grupoId || !jogadorId) return
      setLoading(true)

      const [{ data: jogadorData, error: erroJogador }, { data: rachasData, error: erroRachas }] =
        await Promise.all([
          supabase.from('jogadores').select('nome').eq('id', jogadorId).single(),
          supabase.from('rachas').select('id, modalidade').eq('grupo_id', grupoId),
        ])

      if (erroJogador || erroRachas) {
        setErro(erroJogador?.message ?? erroRachas?.message ?? 'Erro ao carregar jogador')
        setLoading(false)
        return
      }

      setNome(jogadorData?.nome ?? null)

      const rachas = rachasData ?? []
      const rachaModalidade = new Map(rachas.map((r) => [r.id, r.modalidade]))
      const rachaIds = rachas.map((r) => r.id)

      if (rachaIds.length === 0) {
        setLoading(false)
        return
      }

      const [{ data: presencasData }, { data: partidasData }] = await Promise.all([
        supabase
          .from('presencas_racha')
          .select('racha_id, time_id')
          .eq('jogador_id', jogadorId)
          .in('racha_id', rachaIds),
        supabase.from('partidas').select('*').in('racha_id', rachaIds),
      ])

      const timePorRacha = new Map((presencasData ?? []).map((p) => [p.racha_id, p.time_id]))
      const partidas = partidasData ?? []

      const contadores = {
        futebol: statsVazio(),
        volei: statsVazio(),
      }

      // pontos/gols contam de qualquer partida que o jogador integrou (mesmo em andamento);
      // jogos/vitórias/derrotas só fazem sentido pra partida finalizada.
      const partidaIdsDoJogador: string[] = []

      for (const partida of partidas) {
        const meuTimeId = timePorRacha.get(partida.racha_id)
        if (!meuTimeId) continue
        if (partida.time_a_id !== meuTimeId && partida.time_b_id !== meuTimeId) continue

        const modalidade = rachaModalidade.get(partida.racha_id) as 'futebol' | 'volei' | undefined
        if (!modalidade) continue

        partidaIdsDoJogador.push(partida.id)

        if (partida.status !== 'finalizada') continue

        const c = contadores[modalidade]
        c.jogos += 1
        if (partida.vencedor_id === meuTimeId) c.vitorias += 1
        else if (partida.vencedor_id === null) c.empates += 1
        else c.derrotas += 1
      }

      if (partidaIdsDoJogador.length > 0) {
        const { data: eventosData, error: erroEventos } = await supabase
          .from('eventos_ponto')
          .select('partida_id, jogador_id, motivo, jogadores(nome)')
          .eq('jogador_id', jogadorId)
          .in('partida_id', partidaIdsDoJogador)

        if (erroEventos) {
          setErro(erroEventos.message)
        } else {
          const eventos = (eventosData ?? []) as unknown as {
            partida_id: string
            jogador_id: string | null
            motivo: string | null
            jogadores: { nome: string } | null
          }[]

          const partidaRacha = new Map(partidas.map((p) => [p.id, p.racha_id]))

          const eventosFutebol = eventos.filter(
            (ev) => rachaModalidade.get(partidaRacha.get(ev.partida_id) ?? '') === 'futebol',
          )
          const eventosVolei = eventos.filter(
            (ev) => rachaModalidade.get(partidaRacha.get(ev.partida_id) ?? '') === 'volei',
          )

          contadores.futebol.pontos = eventosFutebol.length
          contadores.volei.pontos = eventosVolei.length
          contadores.volei.motivos = montarTabelaMotivos(eventosVolei)
        }
      }

      setFutebol(contadores.futebol)
      setVolei(contadores.volei)
      setLoading(false)
    }

    carregar()
  }, [grupoId, jogadorId])

  function renderModalidade(nomeModalidade: string, stats: StatsModalidade, labelPontos: string, mostrarMotivo: boolean) {
    if (stats.jogos === 0) return null

    return (
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-lg font-semibold">{nomeModalidade}</h2>

        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div>
            <p className="text-neutral-500">Jogos</p>
            <p className="text-lg font-medium">{stats.jogos}</p>
          </div>
          <div>
            <p className="text-neutral-500">Vitórias</p>
            <p className="text-lg font-medium">{stats.vitorias}</p>
          </div>
          {nomeModalidade === 'Futebol' && (
            <div>
              <p className="text-neutral-500">Empates</p>
              <p className="text-lg font-medium">{stats.empates}</p>
            </div>
          )}
          <div>
            <p className="text-neutral-500">Derrotas</p>
            <p className="text-lg font-medium">{stats.derrotas}</p>
          </div>
          <div>
            <p className="text-neutral-500">{labelPontos}</p>
            <p className="text-lg font-medium">{stats.pontos}</p>
          </div>
        </div>

        {mostrarMotivo && (
          <div className="space-y-1">
            <TabelaMotivos linhas={stats.motivos} mostrarJogador={false} mostrarJogos={false} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <header>
          <Link to={`/grupos/${grupoId}/membros`} className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Voltar
          </Link>
          <h1 className="text-xl font-semibold">{nome ?? '...'}</h1>
        </header>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : futebol.jogos === 0 && volei.jogos === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma partida jogada ainda.</p>
        ) : (
          <>
            {renderModalidade('Futebol', futebol, 'Gols', false)}
            {renderModalidade('Vôlei', volei, 'Pontos', true)}
          </>
        )}
      </div>
    </div>
  )
}
