import { describe, expect, it } from 'vitest'
import { alinhar, conflitosDaOpcao, dataDoDia, horariosAtivos, horariosDaData, horariosDaSemana, inicioDaSemana, irmaos, linhasDeHorario, moverPara, opcoesDaTurma, turmasSemHorario } from './semana'
import type { Horario, Oferta, Turma } from './types'

const turma = (id: string, disciplina_id: string | null, ativa = true): Turma => ({
  id, disciplina_id, nome: 'Matéria ' + id, semestre: '2026.2', professor: null, sala: null, total_aulas: 60, ativa,
})
const hor = (id: string, turma_id: string | null, tipo: Horario['tipo'] = 'aula', dia = 1): Horario => ({
  id, turma_id, tipo, titulo: id, dia_semana: dia, inicio: '08:00', fim: '10:00', aulas: 2, local: null,
})
const of = (id: string, disciplina_id: string, dia: number, inicio: string, fim: string, turma: string): Oferta => ({
  id, disciplina_id, codigo: '', nome: 'x', dia_semana: dia, inicio, fim, local: '1BCG 101', turma,
})

describe('semana alinhada com o que está cursando', () => {
  it('esconde aulas de matérias encerradas e mantém trabalho', () => {
    const turmas = [turma('a', 'da'), turma('b', 'db', false)]
    const r = horariosAtivos([hor('h1', 'a'), hor('h2', 'b'), hor('h3', null, 'trabalho'), hor('h4', null, 'aula')], turmas)
    expect(r.map((h) => h.id)).toEqual(['h1', 'h3', 'h4'])
  })

  it('lista as matérias ativas sem aula na semana', () => {
    const turmas = [turma('a', 'da'), turma('b', 'db'), turma('c', 'dc', false)]
    expect(turmasSemHorario(turmas, [hor('h1', 'a')]).map((t) => t.id)).toEqual(['b'])
  })

  it('oferece as turmas do quadro e aponta com o que cada uma bate', () => {
    const ofertas = [of('1', 'db', 1, '08:00', '10:00', 'V'), of('2', 'db', 3, '09:00', '11:00', 'VA'), of('3', 'db', 3, '14:00', '16:00', 'VB')]
    const opcoes = opcoesDaTurma(turma('b', 'db'), ofertas)
    expect(opcoes.map((o) => o.rotulo)).toEqual(['prática A', 'prática B'])
    const trabalho = { dia_semana: 3, inicio: '08:00', fim: '12:00', titulo: 'Trabalho' }
    expect(conflitosDaOpcao(opcoes[0], [trabalho])).toHaveLength(1)
    expect(conflitosDaOpcao(opcoes[1], [trabalho])).toHaveLength(0)
  })

  it('alinhar escolhe a opção sem conflito e considera as matérias já escolhidas', () => {
    const ofertas = [
      of('1', 'da', 1, '08:00', '10:00', 'V'), // da: única opção
      of('2', 'db', 1, '09:00', '11:00', 'VA'), // db opção A bate com da
      of('3', 'db', 2, '09:00', '11:00', 'VB'), // db opção B livre
    ]
    const r = alinhar([turma('b', 'db'), turma('a', 'da')], ofertas, [])
    expect(r.map((x) => [x.turma.id, x.opcao.rotulo, x.conflitos.length])).toEqual([['a', null, 0], ['b', 'prática B', 0]])
  })

  it('gera as linhas de horário com a quantidade de aulas', () => {
    const [op] = opcoesDaTurma(turma('a', 'da'), [of('1', 'da', 1, '08:00', '09:40', 'V')])
    expect(linhasDeHorario(turma('a', 'da'), op)).toEqual([
      { turma_id: 'a', tipo: 'aula', titulo: 'Matéria a', dia_semana: 1, inicio: '08:00', fim: '09:40', aulas: 2, local: '1BCG 101' },
    ])
  })
})

describe('arrastar eventos', () => {
  const h = hor('x', 'a')
  it('mantém a duração e arredonda para 15 min', () => {
    expect(moverPara({ inicio: '08:00', fim: '10:00' }, 3, 9 * 60 + 7)).toEqual({ dia: 3, inicio: '09:00', fim: '11:00' })
    expect(moverPara({ inicio: '08:00', fim: '10:00' }, 2, 9 * 60 + 8)).toEqual({ dia: 2, inicio: '09:15', fim: '11:15' })
  })
  it('não deixa passar da meia-noite nem ficar antes das 00:00', () => {
    expect(moverPara({ inicio: '08:00', fim: '10:00' }, 1, 23 * 60)).toEqual({ dia: 1, inicio: '22:00', fim: '24:00' })
    expect(moverPara({ inicio: '08:00', fim: '10:00' }, 1, -300)).toEqual({ dia: 1, inicio: '00:00', fim: '02:00' })
  })
  it('acha o mesmo evento em outros dias', () => {
    const outros = [{ ...h, id: 'y', dia_semana: 3 }, { ...h, id: 'z', dia_semana: 4, fim: '11:00' }, { ...h, id: 'w', turma_id: 'b' }]
    expect(irmaos(h, [h, ...outros]).map((x) => x.id)).toEqual(['y'])
  })
})

describe('semanas e eventos de um dia só', () => {
  it('acha a segunda-feira e a data de cada dia', () => {
    const segunda = inicioDaSemana(new Date(2026, 9, 28, 15)) // quarta, 28/10/2026
    expect(segunda.getDate()).toBe(26)
    expect(inicioDaSemana(new Date(2026, 10, 1)).getDate()).toBe(26) // domingo ainda é da semana que começou na segunda 26/10
    expect(dataDoDia(segunda, 3).getDate()).toBe(28) // quarta
    expect(dataDoDia(segunda, 0).getDate()).toBe(1) // domingo = 01/11
  })

  it('mostra eventos de um dia só apenas na semana deles', () => {
    const semanal = hor('s', null, 'trabalho', 1)
    const unico = { ...hor('u', null, 'reuniao', 1), data: '2026-10-29' } // quinta
    const nestaSemana = horariosDaSemana([semanal, unico], new Date(2026, 9, 26))
    expect(nestaSemana.map((h) => [h.id, h.dia_semana])).toEqual([['s', 1], ['u', 4]])
    expect(horariosDaSemana([semanal, unico], new Date(2026, 10, 2)).map((h) => h.id)).toEqual(['s'])
  })

  it('numa data, junta o semanal daquele dia com o marcado na data', () => {
    const lista = [hor('seg', null, 'aula', 1), hor('qui', null, 'aula', 4), { ...hor('u', null, 'reuniao', 1), data: '2026-10-29' }]
    expect(horariosDaData(lista, '2026-10-29').map((h) => h.id)).toEqual(['qui', 'u'])
  })

  it('eventos de um dia só não têm outros dias iguais', () => {
    const a = { ...hor('a', null, 'reuniao', 1), data: '2026-10-29' }
    expect(irmaos(a, [a, { ...hor('b', null, 'reuniao', 2), data: '2026-10-30' }])).toEqual([])
  })
})
