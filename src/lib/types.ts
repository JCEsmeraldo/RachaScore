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
  created_at: string
}

export type StatusPresenca = 'confirmado' | 'espera' | 'ausente'

export type PresencaComJogador = {
  jogador_id: string
  status: StatusPresenca
  time_id: string | null
  created_at: string
  jogadores: Jogador | null
}
