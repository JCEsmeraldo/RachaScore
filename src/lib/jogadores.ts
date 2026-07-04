import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export async function obterOuCriarJogadorProprio(session: Session): Promise<string> {
  const { data: existente } = await supabase
    .from('jogadores')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (existente) return existente.id

  const { data: perfil } = await supabase
    .from('profiles')
    .select('nome')
    .eq('id', session.user.id)
    .single()

  const { data: novo, error } = await supabase
    .from('jogadores')
    .insert({ nome: perfil?.nome ?? session.user.email ?? 'Jogador', user_id: session.user.id })
    .select('id')
    .single()

  if (error || !novo) {
    throw error ?? new Error('Erro ao criar jogador')
  }

  return novo.id
}
