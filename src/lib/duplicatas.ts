import { nomeCanonico } from './analise'
import type { Avaliacao, Disciplina, Horario, Oferta, Presenca, StatusDisciplina, Turma } from './types'

export interface DadosParaLimpar {
  disciplinas: Disciplina[]
  turmas: Turma[]
  ofertas: Oferta[]
  presencas: Presenca[]
  avaliacoes: Avaliacao[]
  horarios: Horario[]
}

export interface PlanoLimpeza {
  /** disciplinas repetidas a apagar */
  disciplinasRemover: string[]
  /** turmas/ofertas das cópias passam a apontar para a disciplina que fica */
  repontar: { de: string[]; para: string }[]
  /** a que fica herda a situação mais avançada entre as cópias */
  statusAtualizar: { id: string; status: StatusDisciplina; nota_final: number | null }[]
  ofertasRemover: string[]
  turmasRemover: string[]
  /** turmas repetidas que não foram apagadas porque têm faltas, notas ou horários */
  turmasPreservadas: number
}

const RANK: Record<StatusDisciplina, number> = { pendente: 0, reprovada: 1, cursando: 2, dispensada: 3, aprovada: 3 }

const chaveDisciplina = (d: Disciplina) => (d.codigo.trim() ? 'c:' + d.codigo.replace(/\s/g, '').toLowerCase() : 'n:' + nomeCanonico(d.nome))

export function planejarLimpeza(d: DadosParaLimpar): PlanoLimpeza {
  const plano: PlanoLimpeza = { disciplinasRemover: [], repontar: [], statusAtualizar: [], ofertasRemover: [], turmasRemover: [], turmasPreservadas: 0 }

  // ---- disciplinas repetidas (mesmo código, ou mesmo nome quando não há código)
  const grupos = new Map<string, Disciplina[]>()
  for (const x of d.disciplinas) grupos.set(chaveDisciplina(x), [...(grupos.get(chaveDisciplina(x)) ?? []), x])

  const refs = (id: string) => d.turmas.filter((t) => t.disciplina_id === id).length + d.ofertas.filter((o) => o.disciplina_id === id).length
  const paraQuem = new Map<string, string>()
  for (const lista of grupos.values()) {
    if (lista.length < 2) continue
    const fica = lista.reduce((m, x) => (refs(x.id) > refs(m.id) ? x : m), lista[0])
    const outras = lista.filter((x) => x.id !== fica.id)
    const melhor = lista.reduce((m, x) => (RANK[x.status] > RANK[m.status] ? x : m), fica)
    if (melhor.status !== fica.status || (fica.nota_final == null && melhor.nota_final != null))
      plano.statusAtualizar.push({ id: fica.id, status: melhor.status, nota_final: fica.nota_final ?? melhor.nota_final })
    plano.repontar.push({ de: outras.map((x) => x.id), para: fica.id })
    for (const x of outras) {
      plano.disciplinasRemover.push(x.id)
      paraQuem.set(x.id, fica.id)
    }
  }
  const efetiva = (id: string | null) => (id ? (paraQuem.get(id) ?? id) : null)

  // ---- ofertas repetidas (mesma disciplina, dia, horário e turma)
  const vistasOferta = new Set<string>()
  for (const o of d.ofertas) {
    const k = [efetiva(o.disciplina_id) ?? 'n:' + o.nome, o.dia_semana, o.inicio.slice(0, 5), o.fim.slice(0, 5), o.turma ?? ''].join('|')
    if (vistasOferta.has(k)) plano.ofertasRemover.push(o.id)
    else vistasOferta.add(k)
  }

  // ---- matérias do semestre repetidas (mesma disciplina e semestre)
  const filhos = (id: string) =>
    d.presencas.filter((p) => p.turma_id === id).length + d.avaliacoes.filter((a) => a.turma_id === id).length + d.horarios.filter((h) => h.turma_id === id).length
  const porTurma = new Map<string, Turma[]>()
  for (const t of d.turmas) {
    const k = `${efetiva(t.disciplina_id) ?? 'n:' + nomeCanonico(t.nome)}|${t.semestre}`
    porTurma.set(k, [...(porTurma.get(k) ?? []), t])
  }
  for (const lista of porTurma.values()) {
    if (lista.length < 2) continue
    const fica = lista.reduce((m, x) => (filhos(x.id) > filhos(m.id) ? x : m), lista[0])
    for (const t of lista) {
      if (t.id === fica.id) continue
      if (filhos(t.id) === 0) plano.turmasRemover.push(t.id)
      else plano.turmasPreservadas++
    }
  }
  return plano
}

export const temDuplicatas = (p: PlanoLimpeza) => p.disciplinasRemover.length + p.ofertasRemover.length + p.turmasRemover.length > 0
