import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

/** Primeiro nome, tirado do e-mail da conta (ex.: giovana.borges@… → "Giovana"). */
export function useNome(): string {
  const { data } = useQuery({
    queryKey: ['usuario'],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.email ?? '',
    staleTime: Infinity,
  })
  const base = (data ?? '').split('@')[0].split(/[._\-\d]/)[0]
  return base ? base[0].toUpperCase() + base.slice(1).toLowerCase() : ''
}

export function saudacao(agora = new Date()): string {
  const h = agora.getHours()
  return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}
