import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidas (.env)')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// PostgREST limita quantas linhas volta numa unica resposta (max-rows do
// projeto, geralmente 1000) — query sem paginacao corta o final do resultado
// em silencio quando o grupo acumula historico grande (ex: eventos_ponto de
// varios rachas em modo torneio). Busca em paginas ate a resposta vir menor
// que o tamanho da pagina, concatenando tudo.
export async function buscarTudo<T>(
  factory: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> },
  tamanhoPagina = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const todos: T[] = []
  let offset = 0

  while (true) {
    const { data, error } = await factory().range(offset, offset + tamanhoPagina - 1)
    if (error) return { data: todos, error }

    const pagina = data ?? []
    todos.push(...pagina)

    if (pagina.length < tamanhoPagina) break
    offset += tamanhoPagina
  }

  return { data: todos, error: null }
}
