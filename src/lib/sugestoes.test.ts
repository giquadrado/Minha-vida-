import { describe, expect, it } from 'vitest'
import { bloqueiosDe, disponibilidade, gerarPlanos, proximoSemestre, ranking, secoesDe, type Preferencias } from './sugestoes'
import type { Disciplina, Horario, Oferta } from './types'

const disc = (id: string, extra: Partial<Disciplina> = {}): Disciplina => ({
  id, codigo: id.toUpperCase(), nome: id, carga_horaria: 60, periodo: 1, tipo: 'obrigatoria',
  pre_requisitos: [], status: 'pendente', nota_final: null, ...extra,
})
const of = (disciplina_id: string, dia: number, inicio: string, fim: string, turma: string | null = null): Oferta => ({
  id: `${disciplina_id}${dia}${inicio}${turma}`, disciplina_id, codigo: '', nome: disciplina_id, dia_semana: dia, inicio, fim, local: null, turma,
})
const trabalho = (dia: number, inicio: string, fim: string): Horario => ({
  id: `t${dia}`, turma_id: null, tipo: 'trabalho', titulo: 'Trabalho', dia_semana: dia, inicio, fim, aulas: 1, local: null,
})
const prefs = (extra: Partial<Preferencias> = {}): Preferencias => ({
  turnos: [], maxDisciplinas: 5, maxHorasSemana: null, diasEvitar: [], incluirOptativas: true, folgaMin: 0, meiosDiasLivres: 0, ...extra,
})

describe('turmas alternativas', () => {
  it('separa duas turmas da mesma matéria', () => {
    const s = secoesDe([
      { dia: 1, inicio: '08:00', fim: '10:00', local: null }, { dia: 1, inicio: '19:00', fim: '21:00', local: null },
      { dia: 3, inicio: '08:00', fim: '10:00', local: null }, { dia: 3, inicio: '19:00', fim: '21:00', local: null },
    ])
    expect(s).toHaveLength(2)
    expect(s[0].map((r) => r.inicio)).toEqual(['08:00', '08:00'])
  })
})

describe('gerarPlanos', () => {
  const grade = [disc('a'), disc('b'), disc('c', { periodo: 6 })]

  it('evita conflito entre matérias e com o trabalho', () => {
    const ofertas = [of('a', 1, '08:00', '10:00'), of('b', 1, '09:00', '11:00'), of('c', 2, '08:00', '10:00')]
    const { planos } = gerarPlanos(grade, ofertas, bloqueiosDe([trabalho(2, '07:00', '12:00')]), prefs())
    const ids = planos[0].secoes.map((s) => s.disciplina.id)
    expect(ids).not.toContain('c') // trabalha terça de manhã
    expect(ids.includes('a') && ids.includes('b')).toBe(false) // a e b se sobrepõem
  })

  it('respeita a folga de deslocamento', () => {
    const ofertas = [of('a', 1, '17:30', '19:00')]
    const livre = gerarPlanos(grade, ofertas, bloqueiosDe([trabalho(1, '08:00', '17:00')]), prefs({ folgaMin: 0 }))
    const apertado = gerarPlanos(grade, ofertas, bloqueiosDe([trabalho(1, '08:00', '17:00')]), prefs({ folgaMin: 60 }))
    expect(livre.planos).toHaveLength(1)
    expect(apertado.planos).toHaveLength(0)
    expect(apertado.semEncaixe.map((d) => d.id)).toEqual(['a'])
  })

  it('prefere o turno escolhido entre as turmas da matéria', () => {
    const ofertas = [of('a', 1, '08:00', '10:00'), of('a', 1, '19:00', '21:00')]
    const noite = gerarPlanos([disc('a')], ofertas, [], prefs({ turnos: ['noite'] })).planos[0]
    const manha = gerarPlanos([disc('a')], ofertas, [], prefs({ turnos: ['manha'] })).planos[0]
    expect(noite.secoes[0].reunioes[0].inicio).toBe('19:00')
    expect(manha.secoes[0].reunioes[0].inicio).toBe('08:00')
    expect(noite.pctTurno).toBe(1)
  })

  it('evita dias e limita a quantidade', () => {
    const ofertas = [of('a', 1, '08:00', '10:00'), of('b', 2, '08:00', '10:00'), of('c', 3, '08:00', '10:00')]
    const r = gerarPlanos(grade, ofertas, [], prefs({ diasEvitar: [2], maxDisciplinas: 1 }))
    expect(r.planos[0].secoes).toHaveLength(1)
    expect(r.planos[0].secoes[0].disciplina.id).not.toBe('b')
  })

  it('prioriza o que destrava outras matérias e informa as não ofertadas', () => {
    const g = [disc('a', { periodo: 2 }), disc('b', { periodo: 2 }), disc('x', { pre_requisitos: ['B'], periodo: 3 })]
    const ofertas = [of('a', 1, '08:00', '10:00'), of('b', 1, '08:00', '10:00')]
    const r = gerarPlanos(g, ofertas, [], prefs({ maxDisciplinas: 1 }))
    expect(r.planos[0].secoes[0].disciplina.id).toBe('b')
    expect(r.planos[0].libera).toBe(1)
    expect(gerarPlanos(g, [of('a', 1, '08:00', '10:00')], [], prefs()).naoOfertadas.map((d) => d.id)).toEqual(['b'])
  })
})

describe('turmas de teoria e prática', () => {
  it('teoria vale para todos e cada grupo de prática é uma opção', () => {
    const ofertas = [
      of('a', 1, '08:00', '10:00', 'V'),
      of('a', 3, '13:00', '15:00', 'VA/VB'),
      of('a', 4, '13:00', '15:00', 'VC'),
    ]
    const r = gerarPlanos([disc('a')], ofertas, [], prefs())
    const s = r.planos[0].secoes[0]
    expect(s.reunioes.map((x) => x.dia).sort()).toEqual([1, 3]) // teoria + 1ª prática que cabe
    expect(s.rotulo).toBe('prática A')
  })

  it('escolhe o grupo de prática que não bate com o trabalho', () => {
    const ofertas = [of('a', 1, '08:00', '10:00', 'V'), of('a', 3, '13:00', '15:00', 'VA'), of('a', 4, '19:00', '21:00', 'VB')]
    const r = gerarPlanos([disc('a')], ofertas, bloqueiosDe([trabalho(3, '08:00', '17:00')]), prefs())
    expect(r.planos[0].secoes[0].rotulo).toBe('prática B')
  })
})

describe('sem quadro de horários', () => {
  it('ranqueia por período e destrava', () => {
    const g = [disc('a', { periodo: 4 }), disc('b', { periodo: 1 }), disc('c', { periodo: 1, status: 'aprovada' })]
    expect(ranking(g, prefs()).map((d) => d.id)).toEqual(['b', 'a'])
  })
})

describe('disponibilidade', () => {
  it('desconta trabalho e folga', () => {
    const d = disponibilidade(bloqueiosDe([trabalho(1, '07:00', '12:00')]), 0)
    expect(d.find((x) => x.dia === 1 && x.turno === 'manha')!.livre).toBe(0)
    expect(d.find((x) => x.dia === 1 && x.turno === 'noite')!.livre).toBe(1)
    expect(d.find((x) => x.dia === 1 && x.turno === 'tarde')!.livre).toBe(1)
    expect(disponibilidade(bloqueiosDe([trabalho(1, '07:00', '12:00')]), 60).find((x) => x.dia === 1 && x.turno === 'tarde')!.livre).toBeCloseTo(300 / 360)
  })
  it('próximo semestre', () => {
    expect(proximoSemestre(new Date(2026, 9, 28))).toBe('2027.1')
    expect(proximoSemestre(new Date(2026, 2, 1))).toBe('2026.2')
  })
})

describe('trabalho flexível (meios-períodos livres)', () => {
  const ofertas = [
    of('a', 1, '08:00', '10:00'), // seg manhã
    of('b', 1, '14:00', '16:00'), // seg tarde
    of('c', 2, '08:00', '10:00'), // ter manhã
    of('d', 2, '14:00', '16:00'), // ter tarde
    of('e', 3, '14:00', '16:00'), // qua tarde
  ]
  const grade = ['a', 'b', 'c', 'd', 'e'].map((id) => disc(id))

  it('sem a regra, cabem todas', () => {
    expect(gerarPlanos(grade, ofertas, [], prefs({ maxDisciplinas: 5 })).planos[0].secoes).toHaveLength(5)
  })

  it('com 6 meios-períodos livres só podem ocupar 4 dos 10', () => {
    const p = gerarPlanos(grade, ofertas, [], prefs({ maxDisciplinas: 5, meiosDiasLivres: 6 })).planos[0]
    expect(p.secoes).toHaveLength(4)
  })

  it('aula à noite não ocupa o horário de trabalho', () => {
    const noite = [of('a', 1, '19:00', '21:00'), of('b', 2, '19:00', '21:00')]
    const p = gerarPlanos([disc('a'), disc('b')], noite, [], prefs({ meiosDiasLivres: 10 })).planos[0]
    expect(p.secoes).toHaveLength(2)
  })
})

describe('projeto individual ("VA~VAS")', () => {
  it('tem horário único para todos, sem virar grupo de prática', () => {
    const r = gerarPlanos([disc('p')], [of('p', 6, '09:50', '11:30', 'VA~VAS')], [], prefs())
    expect(r.planos[0].secoes[0]).toMatchObject({ rotulo: null })
    expect(r.planos[0].secoes[0].reunioes).toHaveLength(1)
  })
})
