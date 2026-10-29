import { dataIso, minutos, sobrepoe } from './calculos'
import { ofertasPorDisciplina, type OpcaoHorario } from './sugestoes'
import type { Horario, Oferta, Turma } from './types'

/** Só as aulas das matérias em andamento (e todo o resto: trabalho, deslocamento…). */
export function horariosAtivos(horarios: Horario[], turmas: Turma[]): Horario[] {
  const ativas = new Set(turmas.filter((t) => t.ativa).map((t) => t.id))
  return horarios.filter((h) => h.tipo !== 'aula' || !h.turma_id || ativas.has(h.turma_id))
}

/** Matérias em andamento que ainda não têm nenhuma aula na semana. */
export function turmasSemHorario(turmas: Turma[], horarios: Horario[]): Turma[] {
  const comAula = new Set(horarios.filter((h) => h.tipo === 'aula' && h.turma_id).map((h) => h.turma_id))
  return turmas.filter((t) => t.ativa && !comAula.has(t.id))
}

export interface Ocupado {
  dia_semana: number
  inicio: string
  fim: string
  titulo: string
}

/** Opções de horário que o quadro oferece para a disciplina ligada à matéria. */
export function opcoesDaTurma(turma: Turma, ofertas: Oferta[]): OpcaoHorario[] {
  if (!turma.disciplina_id) return []
  return ofertasPorDisciplina(ofertas.filter((o) => o.disciplina_id === turma.disciplina_id)).get(turma.disciplina_id) ?? []
}

/** Com o que a opção bate na semana (trabalho, outras aulas…). */
export function conflitosDaOpcao(opcao: OpcaoHorario, ocupados: Ocupado[]): Ocupado[] {
  const achados = new Set<Ocupado>()
  for (const r of opcao.reunioes)
    for (const o of ocupados) if (sobrepoe({ dia_semana: r.dia, inicio: r.inicio, fim: r.fim }, o)) achados.add(o)
  return [...achados]
}

export interface Escolha {
  turma: Turma
  opcao: OpcaoHorario
  indice: number
  conflitos: Ocupado[]
}

/**
 * Escolhe uma opção para cada matéria sem horário, dando preferência à que menos bate com o
 * que já está na semana. Começa pelas matérias com menos opções (são as mais difíceis de encaixar).
 */
export function alinhar(pendentes: Turma[], ofertas: Oferta[], ocupadosIniciais: Ocupado[]): Escolha[] {
  const ocupados = [...ocupadosIniciais]
  const comOpcoes = pendentes
    .map((turma) => ({ turma, opcoes: opcoesDaTurma(turma, ofertas) }))
    .filter((x) => x.opcoes.length)
    .sort((a, b) => a.opcoes.length - b.opcoes.length)
  const res: Escolha[] = []
  for (const { turma, opcoes } of comOpcoes) {
    const pontuadas = opcoes.map((opcao, indice) => ({ opcao, indice, conflitos: conflitosDaOpcao(opcao, ocupados) }))
    const melhor = pontuadas.reduce((m, x) => (x.conflitos.length < m.conflitos.length ? x : m), pontuadas[0])
    res.push({ turma, ...melhor })
    for (const r of melhor.opcao.reunioes) ocupados.push({ dia_semana: r.dia, inicio: r.inicio, fim: r.fim, titulo: turma.nome })
  }
  return res
}

/** Linhas prontas para gravar na tabela de horários. */
export function linhasDeHorario(turma: Turma, opcao: OpcaoHorario) {
  return opcao.reunioes.map((r) => ({
    turma_id: turma.id,
    tipo: 'aula' as const,
    titulo: turma.nome,
    dia_semana: r.dia,
    inicio: r.inicio,
    fim: r.fim,
    aulas: Math.max(1, Math.round((minutos(r.fim) - minutos(r.inicio)) / 50)),
    local: r.local,
  }))
}

// ---------------------------------------------------------------- arrastar e repetir eventos

export const horaDeMinutos = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/**
 * Para onde vai um evento arrastado: novo dia e novo início (arredondado de 15 em 15 min),
 * mantendo a duração e sem passar da meia-noite.
 */
export function moverPara(h: Pick<Horario, 'inicio' | 'fim'>, dia: number, inicioMin: number, passo = 15): { dia: number; inicio: string; fim: string } {
  const duracao = minutos(h.fim) - minutos(h.inicio)
  const ini = Math.max(0, Math.min(24 * 60 - duracao, Math.round(inicioMin / passo) * passo))
  return { dia, inicio: horaDeMinutos(ini), fim: horaDeMinutos(ini + duracao) }
}

const hhmm5 = (s: string) => s.slice(0, 5)

/** Os "mesmos" eventos em outros dias (mesma matéria/descrição e mesmo horário). */
export function irmaos(h: Horario, todos: Horario[]): Horario[] {
  if (h.data) return [] // eventos de um dia só não têm "outros dias iguais"
  return todos.filter(
    (x) => !x.data && x.id !== h.id && x.tipo === h.tipo && x.turma_id === h.turma_id && x.titulo === h.titulo && hhmm5(x.inicio) === hhmm5(h.inicio) && hhmm5(x.fim) === hhmm5(h.fim),
  )
}

// ---------------------------------------------------------------- semanas e datas

export const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** Segunda-feira (00:00) da semana de `ref`. */
export function inicioDaSemana(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  return somarDias(d, -((d.getDay() + 6) % 7))
}

/** Data de um dia da semana (0 = domingo … 6 = sábado) dentro da semana que começa em `segunda`. */
export const dataDoDia = (segunda: Date, dia: number) => somarDias(segunda, (dia + 6) % 7)

/** O que vale numa semana: eventos semanais + os de um dia só que caem nela (com o dia da semana ajustado). */
export function horariosDaSemana(horarios: Horario[], segunda: Date): Horario[] {
  const de = dataIso(segunda)
  const ate = dataIso(somarDias(segunda, 6))
  return horarios
    .filter((h) => !h.data || (h.data >= de && h.data <= ate))
    .map((h) => (h.data ? { ...h, dia_semana: new Date(`${h.data}T12:00:00`).getDay() } : h))
}

/** O que vale numa data: eventos semanais daquele dia da semana + os marcados exatamente nessa data. */
export function horariosDaData(horarios: Horario[], data: string): Horario[] {
  const dia = new Date(`${data}T12:00:00`).getDay()
  return horarios.filter((h) => (h.data ? h.data === data : h.dia_semana === dia))
}
