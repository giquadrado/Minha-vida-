/** Tira espaços, quebras de linha e aspas que vêm junto quando o valor é colado de um arquivo .env. */
export const limpar = (v: unknown): string => (typeof v === 'string' ? v.trim().replace(/^["'`]+|["'`]+$/g, '').trim() : '')

/**
 * Deixa só "https://projeto.supabase.co". Corrige o que costuma vir colado junto:
 * barra no fim, "/**" (padrão de Redirect URLs), "/rest/v1/", espaços…
 */
export function normalizarUrlSupabase(valor: unknown): string {
  const v = limpar(valor)
  const achou = v.match(/^https?:\/\/[a-z0-9-]+\.supabase\.(?:co|in)/i)
  return achou ? achou[0] : v
}
