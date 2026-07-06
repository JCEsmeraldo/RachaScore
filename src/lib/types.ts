export type Grupo = {
  id: string
  nome: string
  dono_id: string
  convite_token: string
  created_at: string
}

export type Jogador = {
  id: string
  nome: string
  user_id: string | null
  email: string | null
  created_at: string
}

export type MembroComJogador = {
  jogador_id: string
  is_admin: boolean
  jogadores: Jogador | null
}

// Ao menos um dos dois deve ser definido. Se os dois estiverem, a partida
// termina no que bater primeiro (tempo ou gols).
export type ConfigFutebol = {
  minutos?: number
  gols?: number
}

export type ConfigVolei = {
  num_sets: number
  pontos_set: number
}

export type Racha = {
  id: string
  grupo_id: string
  modalidade: 'futebol' | 'volei'
  modo: 'torneio' | 'rapido'
  tamanho_equipe: number
  config: ConfigFutebol | ConfigVolei
  data_hora: string
  local: string | null
  limite_jogadores: number | null
  created_at: string
}

export type Time = {
  id: string
  racha_id: string
  nome: string
  sorteio: boolean
  created_at: string
}

export type StatusPresenca = 'confirmado' | 'espera' | 'ausente'

export type PresencaComJogador = {
  jogador_id: string
  status: StatusPresenca
  time_id: string | null
  pediu_vaga_em: string
  jogadores: Jogador | null
}

export type StatusPartida = 'agendada' | 'em_andamento' | 'finalizada'

export type Partida = {
  id: string
  racha_id: string
  time_a_id: string
  time_b_id: string
  status: StatusPartida
  placar_a: number
  placar_b: number
  vencedor_id: string | null
  cronometro_segundos: number
  cronometro_rodando: boolean
  cronometro_atualizado_em: string | null
  created_at: string
}

export type SetPartida = {
  id: string
  partida_id: string
  numero: number
  placar_a: number
  placar_b: number
  vencedor_id: string | null
  created_at: string
}

export type MotivoPonto = 'ataque' | 'bloqueio' | 'saque' | 'erro_adversario' | 'outro'

export type TipoCartao = 'amarelo' | 'vermelho'

export type Cartao = {
  id: string
  partida_id: string
  jogador_id: string
  tipo: TipoCartao
  created_at: string
}

export type EscalacaoComJogador = {
  jogador_id: string
  time_id: string
  jogadores: { nome: string } | null
}

export type Avaliacao = {
  racha_id: string
  avaliador_jogador_id: string
  avaliado_jogador_id: string
  nota: number
  created_at: string
}

export type MediaAvaliacao = {
  jogador_id: string
  modalidade: 'futebol' | 'volei'
  nota_media: number
  total_avaliacoes: number
}

export type ClassificacaoTime = {
  racha_id: string
  time_id: string
  time_nome: string
  jogos: number
  vitorias: number
  empates: number
  derrotas: number
  feitos: number
  sofridos: number
  saldo: number
  pontos: number
}
