import { disponiveisParaCursar, minutos } from './calculos'
import type { Disciplina, Horario, Oferta } from './types'

export type Turno = 'manha' | 'tarde' | 'noite'

export const TURNOS: Record<Turno, { rotulo: string; icone: string; de: number; ate: number }> = {
  manha: { rotulo: 'Manhã', icone: '🌅', de: 7 * 60, ate: 12 * 60 },
  tarde: { rotulo: 'Tarde', icone: '☀️', de: 12 * 60, ate: 18 * 60 },
  noite: { rotulo: 'Noite', icone: '🌙', de: 18 * 60, ate: 22 * 60 + 30 },
}

export interface Reuniao {
  dia: number
  inicio: string
  fim: string
  local: string | null
}

export interface Secao {
  disciplina: Disciplina
  /** 0 = primeira turma/opção de horário encontrada */
  opcao: number
  reunioes: Reuniao[]
  /** ex.: "prática VA" — qual grupo de prática esta opção usa */
  rotulo: string | null
}

export interface OpcaoHorario {
  reunioes: Reuniao[]
  rotulo: string | null
}

export interface Bloqueio {
  dia: number
  inicio: string
  fim: string
  titulo: string
}

export interface Preferencias {
  turnos: Turno[]
  maxDisciplinas: number
  maxHorasSemana: number | null
  diasEvitar: number[]
  incluirOptativas: boolean
  /** minutos de folga ao redor do trabalho para deslocamento */
  folgaMin: number
  /**
   * Para quem tem trabalho flexível: quantas manhãs/tardes de segunda a sexta precisam
   * ficar sem aula para dar para trabalhar (cada uma conta ~4 h). 0 = não exigir.
   */
  meiosDiasLivres: number
}

/** Manhã = 07:00–12:30, tarde = 12:30–18:30; depois disso (noite) não ocupa o horário de trabalho. */
const FIM_MANHA = 12 * 60 + 30
const FIM_TARDE = 18 * 60 + 30

/** Bits dos meios-períodos de seg–sex tocados pelas aulas: bit 2*(dia-1) = manhã, 2*(dia-1)+1 = tarde. */
function meiosOcupados(rs: Reuniao[]): number {
  let mask = 0
  for (const r of rs) {
    if (r.dia < 1 || r.dia > 5) continue
    const ini = minutos(r.inicio)
    const fim = minutos(r.fim)
    if (ini < FIM_MANHA) mask |= 1 << (2 * (r.dia - 1))
    if (fim > FIM_MANHA && ini < FIM_TARDE) mask |= 1 << (2 * (r.dia - 1) + 1)
  }
  return mask
}

const bits = (n: number) => n.toString(2).replace(/0/g, '').length

export interface Plano {
  secoes: Secao[]
  pontuacao: number
  horasSemana: number
  /** fração (0–1) do tempo de aula dentro dos turnos preferidos */
  pctTurno: number
  /** quantas matérias novas ficam liberadas (pré-requisitos) depois deste semestre */
  libera: number
  cargaTotal: number
}

interface Intervalo {
  dia: number
  ini: number
  fim: number
}

const norm = (s: string) => s.replace(/\s/g, '').toLowerCase()
const concluida = (d: Disciplina) => d.status === 'aprovada' || d.status === 'dispensada'

export const turnoDe = (min: number): Turno => (min < 12 * 60 ? 'manha' : min < 18 * 60 ? 'tarde' : 'noite')

/** Separa as reuniões de uma disciplina em turmas alternativas (uma reunião por dia em cada turma). */
export function secoesDe(reunioes: Reuniao[]): Reuniao[][] {
  const ord = [...reunioes].sort((a, b) => a.dia - b.dia || minutos(a.inicio) - minutos(b.inicio))
  const grupos: Reuniao[][] = []
  for (const r of ord) {
    const g = grupos.find((x) => !x.some((y) => y.dia === r.dia))
    if (g) g.push(r)
    else grupos.push([r])
  }
  return grupos
}

type ReuniaoTurma = Reuniao & { turma: string | null }

/** "V", "V*" e faixas de projeto individual ("VA~VAS"): valem para todos, não são grupos de prática. */
const TEORIA = /^[VU]\*?$|~/

/**
 * Com turma informada: a parte teórica ("V", "V*") vale para todos e cada grupo de
 * prática ("VA", "VB"…, ou "VA/VB" = os dois grupos nesse horário) é uma opção diferente.
 */
function opcoesPorTurma(rs: ReuniaoTurma[]): OpcaoHorario[] {
  const sem = ({ turma: _t, ...r }: ReuniaoTurma): Reuniao => r
  const teoria = rs.filter((r) => !r.turma || TEORIA.test(r.turma)).map(sem)
  const grupos = new Map<string, Reuniao[]>()
  for (const r of rs) {
    if (!r.turma || TEORIA.test(r.turma)) continue
    for (const parte of r.turma.split('/')) {
      const m = parte.match(/^[VU]([A-Z]{1,2})\*?$/)
      if (m) grupos.set(m[1], [...(grupos.get(m[1]) ?? []), sem(r)])
    }
  }
  if (!grupos.size) return teoria.length ? [{ reunioes: teoria, rotulo: null }] : []
  return [...grupos].sort(([a], [b]) => a.localeCompare(b)).map(([letra, g]) => ({ reunioes: [...teoria, ...g], rotulo: `prática ${letra}` }))
}

export function ofertasPorDisciplina(ofertas: Oferta[]): Map<string, OpcaoHorario[]> {
  const mapa = new Map<string, ReuniaoTurma[]>()
  for (const o of ofertas) {
    if (!o.disciplina_id) continue
    const lista = mapa.get(o.disciplina_id) ?? []
    const r = { dia: o.dia_semana, inicio: o.inicio.slice(0, 5), fim: o.fim.slice(0, 5), local: o.local, turma: o.turma ?? null }
    if (!lista.some((x) => x.dia === r.dia && x.inicio === r.inicio && x.fim === r.fim && x.turma === r.turma)) lista.push(r)
    mapa.set(o.disciplina_id, lista)
  }
  return new Map(
    [...mapa].map(([id, rs]) => [
      id,
      rs.some((r) => r.turma) ? opcoesPorTurma(rs) : secoesDe(rs).map((reunioes): OpcaoHorario => ({ reunioes, rotulo: null })),
    ]),
  )
}

/** Quanto vale cursar a matéria agora: obrigatória, período baixo, reprovada e o que ela destrava. */
export function prioridade(d: Disciplina, todas: Disciplina[]): number {
  const destrava = todas.filter((x) => !concluida(x) && x.pre_requisitos.some((p) => norm(p) === norm(d.codigo))).length
  return (d.tipo === 'obrigatoria' ? 30 : 8) + (d.periodo != null ? Math.max(0, 14 - d.periodo) * 2 : 0) + (d.status === 'reprovada' ? 15 : 0) + destrava * 12 // quem destrava outras vem antes: atrasar uma delas atrasa a formatura
}

export function motivos(d: Disciplina, todas: Disciplina[]): string[] {
  const destrava = todas.filter((x) => !concluida(x) && x.pre_requisitos.some((p) => norm(p) === norm(d.codigo))).length
  const m: string[] = []
  if (d.status === 'reprovada') m.push('refazer')
  if (d.periodo != null) m.push(`${d.periodo}º período`)
  if (destrava) m.push(`destrava ${destrava}`)
  if (d.tipo === 'optativa') m.push('optativa')
  return m
}

const horasDe = (rs: Reuniao[]) => rs.reduce((s, r) => s + minutos(r.fim) - minutos(r.inicio), 0) / 60

function pctNosTurnos(rs: Reuniao[], turnos: Turno[]): number {
  const total = rs.reduce((s, r) => s + minutos(r.fim) - minutos(r.inicio), 0)
  if (!total || !turnos.length) return 0
  let dentro = 0
  for (const r of rs)
    for (const t of turnos) {
      const { de, ate } = TURNOS[t]
      dentro += Math.max(0, Math.min(minutos(r.fim), ate) - Math.max(minutos(r.inicio), de))
    }
  return Math.min(1, dentro / total)
}

const sobrepoe = (a: Intervalo, b: Intervalo) => a.dia === b.dia && a.ini < b.fim && b.ini < a.fim

function bloqueiosComoIntervalos(bloqueios: Bloqueio[], folga: number): Intervalo[] {
  return bloqueios.map((b) => ({ dia: b.dia, ini: minutos(b.inicio) - folga, fim: minutos(b.fim) + folga }))
}

function cabe(ocupados: Intervalo[], rs: Reuniao[], prefs: Preferencias): boolean {
  return rs.every((r) => {
    if (prefs.diasEvitar.includes(r.dia)) return false
    const i = { dia: r.dia, ini: minutos(r.inicio), fim: minutos(r.fim) }
    return !ocupados.some((o) => sobrepoe(o, i))
  })
}

export interface Resultado {
  planos: Plano[]
  /** matérias liberadas mas que não aparecem no quadro de horários enviado */
  naoOfertadas: Disciplina[]
  /** matérias que só não entraram por conflito com trabalho/dias evitados */
  semEncaixe: Disciplina[]
}

const LARGURA = 80

export function gerarPlanos(disciplinas: Disciplina[], ofertas: Oferta[], bloqueios: Bloqueio[], prefs: Preferencias, limite = 3): Resultado {
  const porDisc = ofertasPorDisciplina(ofertas)
  const liberadas = disponiveisParaCursar(disciplinas)
    .filter((d) => prefs.incluirOptativas || d.tipo === 'obrigatoria')
    .sort((a, b) => prioridade(b, disciplinas) - prioridade(a, disciplinas))

  const candidatas = liberadas.filter((d) => porDisc.get(d.id)?.length)
  const naoOfertadas = liberadas.filter((d) => !porDisc.get(d.id)?.length)
  const base = bloqueiosComoIntervalos(bloqueios, prefs.folgaMin)
  const usaTurno = prefs.turnos.length > 0 && prefs.turnos.length < 3

  interface Estado { secoes: Secao[]; ocupados: Intervalo[]; pont: number; horas: number; ch: number; meios: number }
  let estados: Estado[] = [{ secoes: [], ocupados: base, pont: 0, horas: 0, ch: 0, meios: 0 }]
  const cabeAlguma = new Set<string>()

  for (const d of candidatas) {
    const opcoes = porDisc.get(d.id)!
    const novos: Estado[] = [...estados]
    for (const e of estados) {
      if (e.secoes.length >= prefs.maxDisciplinas) continue
      opcoes.forEach(({ reunioes, rotulo }, i) => {
        if (!cabe(e.ocupados, reunioes, prefs)) return
        const h = horasDe(reunioes)
        if (prefs.maxHorasSemana && e.horas + h > prefs.maxHorasSemana) return
        const meios = e.meios | meiosOcupados(reunioes)
        if (10 - bits(meios) < prefs.meiosDiasLivres) return // sobraria pouca manhã/tarde para trabalhar
        cabeAlguma.add(d.id)
        const bonus = usaTurno ? pctNosTurnos(reunioes, prefs.turnos) * 12 : 0
        novos.push({
          secoes: [...e.secoes, { disciplina: d, opcao: i, reunioes, rotulo }],
          ocupados: [...e.ocupados, ...reunioes.map((r) => ({ dia: r.dia, ini: minutos(r.inicio), fim: minutos(r.fim) }))],
          pont: e.pont + prioridade(d, disciplinas) + bonus,
          horas: e.horas + h,
          ch: e.ch + d.carga_horaria,
          meios,
        })
      })
    }
    const unicos = new Map<string, Estado>()
    for (const e of novos.sort((a, b) => b.pont - a.pont)) {
      const k = e.secoes.map((s) => `${s.disciplina.id}:${s.opcao}`).sort().join('|')
      if (!unicos.has(k)) unicos.set(k, e)
    }
    estados = [...unicos.values()].slice(0, LARGURA)
  }

  const antes = new Set(disponiveisParaCursar(disciplinas).map((d) => d.id))
  const vistos = new Set<string>()
  const planos: Plano[] = []
  for (const e of estados.filter((x) => x.secoes.length).sort((a, b) => b.pont - a.pont)) {
    const chave = e.secoes.map((s) => s.disciplina.id).sort().join('|')
    if (vistos.has(chave)) continue
    vistos.add(chave)

    const feitas = new Set(e.secoes.map((s) => s.disciplina.id))
    const depois = disponiveisParaCursar(disciplinas.map((d) => (feitas.has(d.id) ? { ...d, status: 'aprovada' as const } : d)))
    const todos = e.secoes.flatMap((s) => s.reunioes)
    planos.push({
      secoes: e.secoes,
      pontuacao: e.pont,
      horasSemana: e.horas,
      pctTurno: pctNosTurnos(todos, prefs.turnos),
      libera: depois.filter((d) => !antes.has(d.id)).length,
      cargaTotal: e.ch,
    })
    if (planos.length === limite) break
  }

  return { planos, naoOfertadas, semEncaixe: candidatas.filter((d) => !cabeAlguma.has(d.id)) }
}

/** Sem quadro de horários: só ranqueia o que vale cursar. */
export function ranking(disciplinas: Disciplina[], prefs: Preferencias): Disciplina[] {
  return disponiveisParaCursar(disciplinas)
    .filter((d) => prefs.incluirOptativas || d.tipo === 'obrigatoria')
    .sort((a, b) => prioridade(b, disciplinas) - prioridade(a, disciplinas))
    .slice(0, prefs.maxDisciplinas)
}

export function bloqueiosDe(horarios: Horario[]): Bloqueio[] {
  return horarios
    .filter((h) => h.tipo !== 'aula' && !h.data)
    .map((h) => ({ dia: h.dia_semana, inicio: h.inicio.slice(0, 5), fim: h.fim.slice(0, 5), titulo: h.titulo }))
}

/** Fração livre (0–1) de cada turno em cada dia, descontando trabalho e folga de deslocamento. */
export function disponibilidade(bloqueios: Bloqueio[], folga: number): { dia: number; turno: Turno; livre: number }[] {
  const res: { dia: number; turno: Turno; livre: number }[] = []
  for (const dia of [1, 2, 3, 4, 5, 6]) {
    const ocupado = new Uint8Array(1440)
    for (const b of bloqueiosComoIntervalos(bloqueios.filter((x) => x.dia === dia), folga))
      for (let m = Math.max(0, b.ini); m < Math.min(1440, b.fim); m++) ocupado[m] = 1
    for (const turno of Object.keys(TURNOS) as Turno[]) {
      const { de, ate } = TURNOS[turno]
      let livres = 0
      for (let m = de; m < ate; m++) if (!ocupado[m]) livres++
      res.push({ dia, turno, livre: livres / (ate - de) })
    }
  }
  return res
}

export function proximoSemestre(d = new Date()): string {
  return d.getMonth() < 6 ? `${d.getFullYear()}.2` : `${d.getFullYear() + 1}.1`
}
