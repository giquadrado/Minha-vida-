import { describe, expect, it } from 'vitest'
import { planejarLimpeza, temDuplicatas, type DadosParaLimpar } from './duplicatas'
import type { Disciplina, Oferta, Turma } from './types'

const disc = (id: string, codigo: string, extra: Partial<Disciplina> = {}): Disciplina => ({
  id, codigo, nome: 'Matéria ' + codigo, carga_horaria: 60, periodo: 1, tipo: 'obrigatoria', pre_requisitos: [], status: 'pendente', nota_final: null, ...extra,
})
const turma = (id: string, disciplina_id: string | null, extra: Partial<Turma> = {}): Turma => ({
  id, disciplina_id, nome: 'T ' + id, semestre: '2026.2', professor: null, sala: null, total_aulas: 60, ativa: true, ...extra,
})
const oferta = (id: string, disciplina_id: string, dia = 1): Oferta => ({
  id, disciplina_id, codigo: '', nome: 'x', dia_semana: dia, inicio: '08:00:00', fim: '10:00:00', local: null, turma: 'V',
})
const base = (e: Partial<DadosParaLimpar>): DadosParaLimpar => ({ disciplinas: [], turmas: [], ofertas: [], presencas: [], avaliacoes: [], horarios: [], ...e })

describe('limpeza de duplicadas', () => {
  it('sem repetidas não faz nada', () => {
    expect(temDuplicatas(planejarLimpeza(base({ disciplinas: [disc('a', 'MAT1'), disc('b', 'MAT2')] })))).toBe(false)
  })

  it('mantém a cópia mais usada, herda a situação mais avançada e repõe as ligações', () => {
    const p = planejarLimpeza(
      base({
        disciplinas: [disc('velha', 'MAT1', { status: 'aprovada' }), disc('nova', 'MAT1')],
        turmas: [turma('t1', 'nova')],
        ofertas: [oferta('o1', 'nova'), oferta('o2', 'nova', 2)],
      }),
    )
    expect(p.disciplinasRemover).toEqual(['velha'])
    expect(p.repontar).toEqual([{ de: ['velha'], para: 'nova' }])
    expect(p.statusAtualizar).toEqual([{ id: 'nova', status: 'aprovada', nota_final: null }])
  })

  it('apaga ofertas repetidas, inclusive as de cópias de disciplina', () => {
    const p = planejarLimpeza(
      base({
        disciplinas: [disc('a', 'MAT1'), disc('b', 'MAT1')],
        ofertas: [oferta('o1', 'a'), oferta('o2', 'b'), oferta('o3', 'a', 3)],
      }),
    )
    expect(p.ofertasRemover).toEqual(['o2'])
  })

  it('apaga turma repetida vazia e preserva a que tem faltas', () => {
    const presenca = { id: 'p', turma_id: 't2', data: '2026-10-01', aulas: 2, presente: false, obs: null }
    const dados = base({ disciplinas: [disc('a', 'MAT1')], turmas: [turma('t1', 'a'), turma('t2', 'a'), turma('t3', 'a')], presencas: [presenca] })
    const p = planejarLimpeza(dados)
    expect(p.turmasRemover.sort()).toEqual(['t1', 't3'])
    expect(planejarLimpeza({ ...dados, turmas: [turma('t1', 'a'), turma('t4', 'a', { semestre: '2027.1' })] }).turmasRemover).toEqual([])
  })

  it('sem código usa o nome', () => {
    const p = planejarLimpeza(base({ disciplinas: [disc('a', '', { nome: 'Cálculo I' }), disc('b', '', { nome: 'CALCULO i' })] }))
    expect(p.disciplinasRemover).toHaveLength(1)
  })
})
