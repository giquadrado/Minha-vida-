import { describe, expect, it } from 'vitest'
import {
  conflitos,
  disponiveisParaCursar,
  faltasPermitidas,
  intervalosDoDia,
  mediaParcial,
  notaNecessaria,
  progresso,
  resumoFrequencia,
} from './calculos'
import type { Avaliacao, Curso, Disciplina, Horario, Presenca } from './types'

const pres = (presente: boolean, aulas = 2): Presenca => ({ id: '', turma_id: 't', data: '', aulas, presente, obs: null })
const av = (peso: number, nota: number | null): Avaliacao => ({ id: '', turma_id: 't', nome: '', peso, data: null, nota })
const disc = (codigo: string, extra: Partial<Disciplina> = {}): Disciplina => ({
  id: codigo, codigo, nome: codigo, carga_horaria: 60, periodo: 1, tipo: 'obrigatoria',
  pre_requisitos: [], status: 'pendente', nota_final: null, ...extra,
})
const hor = (dia: number, inicio: string, fim: string, tipo: Horario['tipo'] = 'aula'): Horario => ({
  id: `${dia}${inicio}`, turma_id: null, tipo, titulo: '', dia_semana: dia, inicio, fim, aulas: 1, local: null,
})

describe('frequência', () => {
  it('calcula faltas permitidas com 75%', () => {
    expect(faltasPermitidas(80, 0.75)).toBe(20)
    expect(faltasPermitidas(36, 0.75)).toBe(9)
    expect(faltasPermitidas(30, 0.75)).toBe(7)
  })

  it('resume faltas e restantes', () => {
    const r = resumoFrequencia([pres(false), pres(false), pres(true)], 40, 0.75)
    expect(r.faltas).toBe(4)
    expect(r.permitidas).toBe(10)
    expect(r.restantes).toBe(6)
    expect(r.situacao).toBe('ok')
  })

  it('marca reprovação por falta', () => {
    const r = resumoFrequencia(Array.from({ length: 6 }, () => pres(false)), 40, 0.75)
    expect(r.restantes).toBe(-2)
    expect(r.situacao).toBe('reprovado')
  })
})

describe('notas', () => {
  it('média parcial ignora pendentes', () => {
    expect(mediaParcial([av(1, 8), av(2, null)])).toBe(8)
    expect(mediaParcial([av(1, null)])).toBeNull()
  })

  it('nota necessária nas pendentes', () => {
    // P1 peso 4 nota 5; P2 peso 6 pendente; média 6 -> (60 - 20) / 6 = 6.67
    expect(notaNecessaria([av(4, 5), av(6, null)], 6)).toBeCloseTo(6.667, 2)
    expect(notaNecessaria([av(1, 7)], 6)).toBeNull()
  })
})

describe('progresso', () => {
  const curso: Curso = {
    id: '', nome: '', carga_obrigatoria: 0, horas_optativas: 120, horas_estagio: 300,
    horas_complementares: 0, freq_minima: 0.75, media_aprovacao: 6,
  }
  it('soma obrigatórias concluídas, optativas e estágio', () => {
    const p = progresso(
      curso,
      [disc('A', { status: 'aprovada' }), disc('B'), disc('C', { tipo: 'optativa', status: 'aprovada' })],
      [{ id: '', tipo: 'estagio', descricao: '', data: '', horas: 150, comprovante: null }],
    )
    expect(p.obrigatorias).toMatchObject({ feito: 60, exigido: 120, falta: 60 })
    expect(p.optativas).toMatchObject({ feito: 60, falta: 60 })
    expect(p.estagio.pct).toBe(0.5)
    expect(p.disciplinasRestantes).toBe(1)
  })

  it('libera disciplinas com pré-requisitos cumpridos', () => {
    const lista = [disc('A', { status: 'aprovada' }), disc('B', { pre_requisitos: ['a'] }), disc('C', { pre_requisitos: ['B'] })]
    expect(disponiveisParaCursar(lista).map((d) => d.codigo)).toEqual(['B'])
  })
})

describe('horários', () => {
  it('detecta conflito entre aula e trabalho', () => {
    const lista = [hor(1, '08:00', '12:00', 'trabalho'), hor(1, '11:00', '13:00'), hor(1, '12:00', '14:00'), hor(2, '11:00', '12:00')]
    expect(conflitos(lista)).toHaveLength(2)
  })

  it('calcula intervalo livre', () => {
    const r = intervalosDoDia([hor(3, '19:00', '22:00'), hor(3, '08:00', '17:30', 'trabalho')], 3)
    expect(r[0].minutos).toBe(90)
  })
})

describe('pré-requisito de carga horária', () => {
  it('"CH2700" só libera com 2700 h já cursadas', () => {
    const base = [disc('A', { status: 'aprovada', carga_horaria: 2000 }), disc('P', { pre_requisitos: ['CH2700'] })]
    expect(disponiveisParaCursar(base).map((d) => d.codigo)).toEqual([])
    const mais = [...base, disc('B', { status: 'aprovada', carga_horaria: 700 })]
    expect(disponiveisParaCursar(mais).map((d) => d.codigo)).toEqual(['P'])
  })
})

describe('frequência sem total de aulas', () => {
  it('não gera alerta quando o total de aulas não foi informado', () => {
    expect(resumoFrequencia([], 0, 0.75).situacao).toBe('ok')
  })
})
