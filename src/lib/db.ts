import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Curso, Tabelas } from './types'

type Nome = keyof Tabelas
type Novo<T> = Partial<Omit<T, 'id'>>

const ORDEM: Record<Nome, string> = {
  cursos: 'created_at',
  disciplinas: 'periodo',
  turmas: 'created_at',
  horarios: 'inicio',
  presencas: 'data',
  avaliacoes: 'created_at',
  horas_registros: 'data',
  ofertas: 'inicio',
  perfis: 'created_at',
  estagios: 'inicio',
}

/** Lista todas as linhas da tabela (o RLS já filtra pelo usuário logado). */
export function useLista<N extends Nome>(tabela: N) {
  return useQuery({
    queryKey: [tabela],
    queryFn: async () => {
      const { data, error } = await supabase.from(tabela).select('*').order(ORDEM[tabela], { nullsFirst: false })
      if (error) throw error
      return data as Tabelas[N][]
    },
  })
}

/** Operações de escrita para uma tabela; invalida o cache ao terminar. */
export function useTabela<N extends Nome>(tabela: N) {
  const qc = useQueryClient()
  const onSuccess = () => qc.invalidateQueries({ queryKey: [tabela] })
  const run = async <R,>(p: PromiseLike<{ data: R; error: unknown }>) => {
    const { data, error } = await p
    if (error) throw error
    return data
  }

  const inserir = useMutation({
    mutationFn: (linhas: Novo<Tabelas[N]> | Novo<Tabelas[N]>[]) => run(supabase.from(tabela).insert(linhas as never)),
    onSuccess,
  })
  const atualizar = useMutation({
    mutationFn: ({ id, ...campos }: { id: string } & Novo<Tabelas[N]>) =>
      run(supabase.from(tabela).update(campos as never).eq('id', id)),
    onSuccess,
  })
  const salvar = useMutation({
    mutationFn: ({ linha, conflito }: { linha: Novo<Tabelas[N]> & { id?: string }; conflito?: string }) =>
      run(supabase.from(tabela).upsert(linha as never, conflito ? { onConflict: conflito } : undefined)),
    onSuccess,
  })
  const remover = useMutation({
    mutationFn: (id: string) => run(supabase.from(tabela).delete().eq('id', id)),
    onSuccess,
  })
  return { inserir, atualizar, salvar, remover }
}

export const CURSO_PADRAO: Omit<Curso, 'id'> = {
  nome: 'Meu curso',
  carga_obrigatoria: 0,
  horas_optativas: 0,
  horas_estagio: 0,
  horas_complementares: 0,
  freq_minima: 0.75,
  media_aprovacao: 6,
}

/** Curso do usuário; valores padrão até ser salvo em Configurações. */
export function useCurso(): Curso {
  const { data } = useLista('cursos')
  return data?.[0] ?? { id: '', ...CURSO_PADRAO }
}
