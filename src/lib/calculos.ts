import type { Avaliacao, Curso, Disciplina, Horario, HorasRegistro, Presenca } from './types'

/** "HH:MM" ou "HH:MM:SS" -> minutos desde 00:00 */
export function minutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function hhmm(hora: string): string {
  return hora.slice(0, 5)
}

// ---------- Frequência ----------

export function faltasPermitidas(totalAulas: number, freqMinima: number): number {
  // Arredonda para evitar 40 * 0.25 = 9.999...
  return Math.floor(Math.round(totalAulas * (1 - freqMinima) * 1000) / 1000)
}

export interface ResumoFrequencia {
  faltas: number
  presencas: number
  permitidas: number
  restantes: number
  /** frequência sobre as aulas já registradas (1 = 100%) */
  freqAtual: number
  situacao: 'ok' | 'atencao' | 'reprovado'
}

export function resumoFrequencia(registros: Presenca[], totalAulas: number, freqMinima: number): ResumoFrequencia {
  let faltas = 0
  let presencas = 0
  for (const r of registros) {
    if (r.presente) presencas += r.aulas
    else faltas += r.aulas
  }
  const permitidas = faltasPermitidas(totalAulas, freqMinima)
  const restantes = permitidas - faltas
  const registradas = faltas + presencas
  const freqAtual = registradas ? presencas / registradas : 1
  // sem total de aulas informado não dá para alertar nada
  const situacao = !totalAulas ? 'ok' : restantes < 0 ? 'reprovado' : restantes <= Math.max(1, Math.ceil(permitidas * 0.25)) ? 'atencao' : 'ok'
  return { faltas, presencas, permitidas, restantes, freqAtual, situacao }
}

// ---------- Notas ----------

/** Média ponderada só das avaliações já com nota. null se nenhuma nota lançada. */
export function mediaParcial(avaliacoes: Avaliacao[]): number | null {
  const lancadas = avaliacoes.filter((a) => a.nota != null)
  const pesos = lancadas.reduce((s, a) => s + a.peso, 0)
  if (!pesos) return null
  return lancadas.reduce((s, a) => s + (a.nota as number) * a.peso, 0) / pesos
}

/** Média final considerando todos os pesos (pendentes contam como 0). */
export function mediaFinalAtual(avaliacoes: Avaliacao[]): number {
  const pesos = avaliacoes.reduce((s, a) => s + a.peso, 0)
  if (!pesos) return 0
  return avaliacoes.reduce((s, a) => s + (a.nota ?? 0) * a.peso, 0) / pesos
}

/**
 * Nota mínima (igual em todas as avaliações pendentes) para atingir a média.
 * null = não há avaliações pendentes. Valor <= 0 = já está aprovada(o) por nota.
 */
export function notaNecessaria(avaliacoes: Avaliacao[], mediaAprovacao: number): number | null {
  const pendentes = avaliacoes.filter((a) => a.nota == null)
  const pesoPendente = pendentes.reduce((s, a) => s + a.peso, 0)
  if (!pesoPendente) return null
  const pesoTotal = avaliacoes.reduce((s, a) => s + a.peso, 0)
  const somaFeita = avaliacoes.reduce((s, a) => s + (a.nota ?? 0) * a.peso, 0)
  return (mediaAprovacao * pesoTotal - somaFeita) / pesoPendente
}

// ---------- Progresso do curso ----------

export interface ItemProgresso {
  feito: number
  exigido: number
  falta: number
  pct: number
}

function item(feito: number, exigido: number): ItemProgresso {
  return {
    feito,
    exigido,
    falta: Math.max(0, exigido - feito),
    pct: exigido ? Math.min(1, feito / exigido) : 1,
  }
}

const concluida = (d: Disciplina) => d.status === 'aprovada' || d.status === 'dispensada'

export interface Progresso {
  obrigatorias: ItemProgresso
  optativas: ItemProgresso
  estagio: ItemProgresso
  complementares: ItemProgresso
  disciplinasRestantes: number
  obrigatoriasRestantes: Disciplina[]
  geral: number
}

export function progresso(curso: Curso, disciplinas: Disciplina[], horas: HorasRegistro[]): Progresso {
  const somaHoras = (tipo: HorasRegistro['tipo']) =>
    horas.filter((h) => h.tipo === tipo).reduce((s, h) => s + Number(h.horas), 0)

  const obrig = disciplinas.filter((d) => d.tipo === 'obrigatoria')
  const exigidoObrig = curso.carga_obrigatoria || obrig.reduce((s, d) => s + d.carga_horaria, 0)
  const feitoObrig = obrig.filter(concluida).reduce((s, d) => s + d.carga_horaria, 0)
  const feitoOpt =
    disciplinas.filter((d) => d.tipo === 'optativa' && concluida(d)).reduce((s, d) => s + d.carga_horaria, 0) +
    somaHoras('optativa')

  const p = {
    obrigatorias: item(feitoObrig, exigidoObrig),
    optativas: item(feitoOpt, curso.horas_optativas),
    estagio: item(somaHoras('estagio'), curso.horas_estagio),
    complementares: item(somaHoras('complementar'), curso.horas_complementares),
  }
  const exigidoTotal = p.obrigatorias.exigido + p.optativas.exigido + p.estagio.exigido + p.complementares.exigido
  const feitoTotal =
    Math.min(p.obrigatorias.feito, p.obrigatorias.exigido) +
    Math.min(p.optativas.feito, p.optativas.exigido) +
    Math.min(p.estagio.feito, p.estagio.exigido) +
    Math.min(p.complementares.feito, p.complementares.exigido)
  const obrigatoriasRestantes = obrig.filter((d) => !concluida(d))
  return {
    ...p,
    obrigatoriasRestantes,
    disciplinasRestantes: obrigatoriasRestantes.length,
    geral: exigidoTotal ? feitoTotal / exigidoTotal : 0,
  }
}

/** Disciplinas ainda não concluídas cujos pré-requisitos já foram cumpridos. */
export function disponiveisParaCursar(disciplinas: Disciplina[]): Disciplina[] {
  const concluidas = disciplinas.filter(concluida)
  const feitas = new Set(concluidas.map((d) => d.codigo.trim().toUpperCase()))
  const horasFeitas = concluidas.reduce((s, d) => s + d.carga_horaria, 0)
  return disciplinas.filter(
    (d) =>
      (d.status === 'pendente' || d.status === 'reprovada') &&
      d.pre_requisitos.every((p) => {
        const minimo = p.trim().toUpperCase().match(/^CH(\d+)$/) // "CH2700" = precisa de 2700 h já cursadas
        return minimo ? horasFeitas >= Number(minimo[1]) : feitas.has(p.trim().toUpperCase())
      }),
  )
}

/** "CH2700" -> "2.700 h já cursadas"; códigos de disciplina ficam como estão. */
export function rotuloPreRequisito(p: string): string {
  const m = p.match(/^CH(\d+)$/i)
  return m ? `${Number(m[1]).toLocaleString('pt-BR')} h cursadas` : p
}

// ---------- Horários ----------

export function sobrepoe(a: Pick<Horario, 'dia_semana' | 'inicio' | 'fim'>, b: Pick<Horario, 'dia_semana' | 'inicio' | 'fim'>): boolean {
  return a.dia_semana === b.dia_semana && minutos(a.inicio) < minutos(b.fim) && minutos(b.inicio) < minutos(a.fim)
}

/** Pares de horários que se sobrepõem. */
export function conflitos(horarios: Horario[]): [Horario, Horario][] {
  const res: [Horario, Horario][] = []
  for (let i = 0; i < horarios.length; i++)
    for (let j = i + 1; j < horarios.length; j++) if (sobrepoe(horarios[i], horarios[j])) res.push([horarios[i], horarios[j]])
  return res
}

/** Minutos livres entre o fim de um compromisso e o início do próximo no mesmo dia. */
export function intervalosDoDia(horarios: Horario[], dia: number): { depois: Horario; antes: Horario; minutos: number }[] {
  const doDia = horarios.filter((h) => h.dia_semana === dia).sort((a, b) => minutos(a.inicio) - minutos(b.inicio))
  const res = []
  for (let i = 0; i + 1 < doDia.length; i++) {
    const gap = minutos(doDia[i + 1].inicio) - minutos(doDia[i].fim)
    if (gap >= 0) res.push({ depois: doDia[i], antes: doDia[i + 1], minutos: gap })
  }
  return res
}

export function horasSemanais(horarios: Horario[], tipo: Horario['tipo']): number {
  return horarios.filter((h) => h.tipo === tipo).reduce((s, h) => s + minutos(h.fim) - minutos(h.inicio), 0) / 60
}

/** Data local no formato AAAA-MM-DD (toISOString usaria UTC e erraria o dia à noite). */
export function dataIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Semestre letivo corrente no formato 2026.2 */
export function semestreAtual(d = new Date()): string {
  return `${d.getFullYear()}.${d.getMonth() < 6 ? 1 : 2}`
}

export const dataBr =(iso: string) => iso.split('-').reverse().join('/')

export const fmt =(n: number, casas = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
export const pct = (n: number) => `${Math.round(n * 100)}%`
