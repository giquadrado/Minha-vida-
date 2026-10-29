import { describe, expect, it } from 'vitest'
import { situacaoEm } from './campus'
import type { Horario } from './types'

const h = (tipo: Horario['tipo'], titulo: string, dia: number, inicio: string, fim: string): Horario => ({
  id: titulo + dia + inicio, turma_id: null, tipo, titulo, dia_semana: dia, inicio, fim, aulas: 1, local: null,
})

const semana = [
  h('trabalho', 'Escritório', 1, '08:00', '17:00'),
  h('aula', 'Cálculo II', 1, '19:00', '22:00'),
  h('outro', 'Estágio', 3, '13:00', '17:00'),
]
const m = (hh: number, mm = 0) => hh * 60 + mm

describe('situacaoEm', () => {
  it('no trabalho e na faculdade', () => {
    expect(situacaoEm(semana, 1, m(10))).toEqual({ lugar: 'trabalho', detalhe: 'Escritório', ate: '17:00' })
    expect(situacaoEm(semana, 1, m(20))).toEqual({ lugar: 'faculdade', detalhe: 'Cálculo II', ate: '22:00' })
  })
  it('estágio conta como trabalho', () => {
    expect(situacaoEm(semana, 3, m(14)).lugar).toBe('trabalho')
  })
  it('a caminho perto do próximo compromisso', () => {
    expect(situacaoEm(semana, 1, m(18, 30))).toMatchObject({ lugar: 'caminho', detalhe: 'Indo para Cálculo II', ate: '19:00' })
  })
  it('em casa quando livre ou de madrugada', () => {
    expect(situacaoEm(semana, 1, m(17, 30))).toMatchObject({ lugar: 'casa', detalhe: 'Livre até 19:00' })
    expect(situacaoEm(semana, 2, m(15))).toMatchObject({ lugar: 'casa', detalhe: 'Livre pelo resto do dia' })
    expect(situacaoEm(semana, 2, m(2))).toMatchObject({ lugar: 'casa', detalhe: 'Dormindo 💤' })
  })
  it('aula vence trabalho quando há choque', () => {
    expect(situacaoEm([h('trabalho', 'T', 1, '08:00', '12:00'), h('aula', 'A', 1, '09:00', '10:00')], 1, m(9, 30)).lugar).toBe('faculdade')
  })
})
