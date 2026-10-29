import { gerarIcs } from '../src/lib/ics'

/**
 * Link de assinatura da agenda: https://SEU-SITE/api/calendario.ics?token=…
 * (o vercel.json leva /api/calendario.ics até esta função).
 * O Google Agenda e o Outlook consultam este endereço de tempos em tempos.
 * Lê os eventos pela função `calendario_por_token` do Supabase (precisa do token secreto).
 *
 * Usa só a API padrão da web (Request/Response), sem tipos do Node.
 */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!/^[0-9a-f]{20,64}$/i.test(token)) return new Response('Link inválido.', { status: 404 })

  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
  const base = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const chave = env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY
  if (!base || !chave) return new Response('Servidor sem configuração do Supabase.', { status: 500 })

  const r = await fetch(`${base.trim()}/rest/v1/rpc/calendario_por_token`, {
    method: 'POST',
    headers: { apikey: chave.trim(), Authorization: `Bearer ${chave.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  })
  if (!r.ok) return new Response('Não consegui ler a agenda.', { status: 502 })

  const hoje = new Date()
  const ano = hoje.getFullYear()
  const primeiro = hoje.getMonth() < 6
  const ics = gerarIcs(await r.json(), {
    inicio: primeiro ? `${ano}-02-01` : `${ano}-08-01`,
    fim: primeiro ? `${ano}-07-15` : `${ano}-12-20`,
    agora: hoje,
  })

  return new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=900' } })
}
