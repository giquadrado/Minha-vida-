import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../../api/calendario'

// importar a função aqui também faz o TypeScript do projeto conferir o arquivo da pasta api/
const token = 'a'.repeat(36)
const pedido = (t: string) => new Request(`https://site.vercel.app/api/calendario.ics?token=${t}`)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('função do link de assinatura da agenda', () => {
  it('rejeita token inválido sem chamar o banco', async () => {
    const buscar = vi.fn()
    vi.stubGlobal('fetch', buscar)
    const r = await GET(pedido('curto'))
    expect(r.status).toBe(404)
    expect(buscar).not.toHaveBeenCalled()
  })

  it('devolve 500 se o servidor não tem as chaves do Supabase', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect((await GET(pedido(token))).status).toBe(500)
  })

  it('lê os eventos pelo token e responde um .ics', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co ')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_x')
    const buscar = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'h1', tipo: 'reuniao', titulo: 'Reunião', dia_semana: 2, inicio: '13:30:00', fim: '15:00:00', aulas: 1, local: null, turma_id: null }])),
    )
    vi.stubGlobal('fetch', buscar)
    const r = await GET(pedido(token))
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('text/calendar')
    const texto = await r.text()
    expect(texto).toContain('BEGIN:VCALENDAR')
    expect(texto).toContain('SUMMARY:Reunião')
    expect(buscar).toHaveBeenCalledWith('https://abc.supabase.co/rest/v1/rpc/calendario_por_token', expect.objectContaining({ method: 'POST' }))
  })

  it('devolve 502 se o banco falhar', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'k')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('erro', { status: 500 })))
    expect((await GET(pedido(token))).status).toBe(502)
  })
})
