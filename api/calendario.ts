import type { IncomingMessage, ServerResponse } from 'node:http'
import { gerarIcs } from '../src/lib/ics'

/**
 * Link de assinatura da agenda: https://SEU-SITE/api/calendario.ics?token=…
 * O Google Agenda e o Outlook consultam este endereço de tempos em tempos.
 * Lê os eventos pela função `calendario_por_token` do Supabase (precisa do token secreto).
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const token = new URL(req.url ?? '', 'http://localhost').searchParams.get('token') ?? ''
  if (!/^[0-9a-f]{20,64}$/i.test(token)) {
    res.statusCode = 404
    return res.end('Link inválido.')
  }

  const base = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const chave = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!base || !chave) {
    res.statusCode = 500
    return res.end('Servidor sem configuração do Supabase.')
  }

  const r = await fetch(`${base}/rest/v1/rpc/calendario_por_token`, {
    method: 'POST',
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  })
  if (!r.ok) {
    res.statusCode = 502
    return res.end('Não consegui ler a agenda.')
  }

  const hoje = new Date()
  const ano = hoje.getFullYear()
  const primeiro = hoje.getMonth() < 6
  const ics = gerarIcs(await r.json(), {
    inicio: primeiro ? `${ano}-02-01` : `${ano}-08-01`,
    fim: primeiro ? `${ano}-07-15` : `${ano}-12-20`,
    agora: hoje,
  })

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=900')
  res.end(ics)
}
