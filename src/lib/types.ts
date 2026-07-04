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
