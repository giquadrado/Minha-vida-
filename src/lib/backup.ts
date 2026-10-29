import { supabase } from './supabase'
import { planejarLimpeza, type PlanoLimpeza } from './duplicatas'
import type { Avaliacao, Disciplina, Horario, Oferta, Presenca, Turma } from './types'

/** Ordem que respeita as chaves estrangeiras (turmas dependem de disciplinas etc.). */
export const ORDEM_BACKUP = ['cursos', 'disciplinas', 'turmas', 'horarios', 'presencas', 'avaliacoes', 'horas_registros', 'estagios', 'ofertas'] as const

type Linha = Record<string, unknown>

/**
 * Se o arquivo traz a mesma matéria que já existe na conta (mesmo código) com outro id,
 * usa o id que já existe: assim carregar o arquivo nunca duplica matérias nem turmas.
 */
async function reaproveitarIds(dados: Record<string, unknown>): Promise<Record<string, unknown>> {
  const copia = structuredClone(dados) as Record<string, Linha[] | undefined>

  const idsDisc = new Map<string, string>() // id do arquivo -> id já existente
  if (copia.disciplinas?.length) {
    const { data } = await supabase.from('disciplinas').select('id, codigo, nome')
    const existentes = new Map((data ?? []).filter((d) => d.codigo).map((d) => [String(d.codigo).replace(/\s/g, '').toLowerCase(), d.id as string]))
    for (const l of copia.disciplinas) {
      const achado = existentes.get(String(l.codigo ?? '').replace(/\s/g, '').toLowerCase())
      if (achado && achado !== l.id) {
        idsDisc.set(l.id as string, achado)
        l.id = achado
      }
    }
    for (const t of ['turmas', 'ofertas'] as const)
      for (const l of copia[t] ?? []) if (typeof l.disciplina_id === 'string' && idsDisc.has(l.disciplina_id)) l.disciplina_id = idsDisc.get(l.disciplina_id)
  }

  const idsTurma = new Map<string, string>()
  if (copia.turmas?.length) {
    const { data } = await supabase.from('turmas').select('id, disciplina_id, semestre')
    const existentes = new Map((data ?? []).filter((t) => t.disciplina_id).map((t) => [`${t.disciplina_id}|${t.semestre}`, t.id as string]))
    for (const l of copia.turmas) {
      const achado = existentes.get(`${l.disciplina_id}|${l.semestre}`)
      if (achado && achado !== l.id) {
        idsTurma.set(l.id as string, achado)
        l.id = achado
      }
    }
    for (const t of ['horarios', 'presencas', 'avaliacoes'] as const)
      for (const l of copia[t] ?? []) if (typeof l.turma_id === 'string' && idsTurma.has(l.turma_id)) l.turma_id = idsTurma.get(l.turma_id)
  }
  return copia
}

/**
 * Carrega um arquivo de backup na conta de quem está logado. Cada linha é gravada com
 * "upsert" pelo id, então repetir a importação não duplica nada. user_id é descartado:
 * o banco coloca o da conta atual.
 */
export async function restaurarBackup(dadosOriginais: Record<string, unknown>, apagarAntes: boolean): Promise<string[]> {
  const log: string[] = []
  const dados = apagarAntes ? dadosOriginais : await reaproveitarIds(dadosOriginais)

  if (apagarAntes) {
    for (const t of [...ORDEM_BACKUP].reverse()) {
      if (!Array.isArray(dados[t])) continue
      const { error } = await supabase.from(t).delete().not('id', 'is', null)
      if (error) throw new Error(`${t}: ${error.message}`)
    }
  } else if (Array.isArray(dados.ofertas) && dados.ofertas.length) {
    // o quadro de horários é sempre substituído por inteiro
    const { error } = await supabase.from('ofertas').delete().not('id', 'is', null)
    if (error) throw new Error(`ofertas: ${error.message}`)
  }

  for (const t of ORDEM_BACKUP) {
    const linhas = dados[t]
    if (!Array.isArray(linhas) || !linhas.length) continue
    const limpas = linhas.map((l) => {
      const { user_id: _u, created_at: _c, ...resto } = l as Linha
      return resto
    })
    for (let i = 0; i < limpas.length; i += 200) {
      const { error } = await supabase.from(t).upsert(limpas.slice(i, i + 200), { onConflict: t === 'cursos' ? 'user_id' : 'id' })
      if (error) throw new Error(`${t}: ${error.message}`)
    }
    log.push(`${t}: ${limpas.length}`)
  }
  return log
}

// ---------------------------------------------------------------- limpeza de duplicadas

async function ler<T>(tabela: string, opcional = false): Promise<T[]> {
  const { data, error } = await supabase.from(tabela).select('*')
  if (error) {
    if (opcional) return []
    throw new Error(`${tabela}: ${error.message}`)
  }
  return (data ?? []) as T[]
}

/** Lê a conta e diz o que está repetido, sem apagar nada. */
export async function analisarDuplicatas(): Promise<PlanoLimpeza> {
  const [disciplinas, turmas, ofertas, presencas, avaliacoes, horarios] = await Promise.all([
    ler<Disciplina>('disciplinas'),
    ler<Turma>('turmas'),
    ler<Oferta>('ofertas', true),
    ler<Presenca>('presencas'),
    ler<Avaliacao>('avaliacoes'),
    ler<Horario>('horarios'),
  ])
  return planejarLimpeza({ disciplinas, turmas, ofertas, presencas, avaliacoes, horarios })
}

const lotes = <T,>(lista: T[], n = 100) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n))

/** Aplica o plano: primeiro religa o que depende das cópias, depois apaga as cópias. */
export async function executarLimpeza(plano: PlanoLimpeza): Promise<void> {
  const falha = (t: string, e: { message: string } | null) => {
    if (e) throw new Error(`${t}: ${e.message}`)
  }

  for (const g of plano.repontar)
    for (const lote of lotes(g.de)) {
      falha('turmas', (await supabase.from('turmas').update({ disciplina_id: g.para }).in('disciplina_id', lote)).error)
      const o = await supabase.from('ofertas').update({ disciplina_id: g.para }).in('disciplina_id', lote)
      if (o.error && !/schema cache|does not exist/i.test(o.error.message)) falha('ofertas', o.error)
    }

  for (const s of plano.statusAtualizar)
    falha('disciplinas', (await supabase.from('disciplinas').update({ status: s.status, nota_final: s.nota_final }).eq('id', s.id)).error)

  for (const lote of lotes(plano.ofertasRemover)) falha('ofertas', (await supabase.from('ofertas').delete().in('id', lote)).error)
  for (const lote of lotes(plano.turmasRemover)) falha('turmas', (await supabase.from('turmas').delete().in('id', lote)).error)
  for (const lote of lotes(plano.disciplinasRemover)) falha('disciplinas', (await supabase.from('disciplinas').delete().in('id', lote)).error)
}
