import { describe, expect, it } from 'vitest'
import { converterLinha, detectarColunas } from './importacao'

describe('importação da grade', () => {
  const cab = ['Período', 'Código', 'Disciplina', 'CH', 'Natureza', 'Pré-requisitos', 'Situação']
  const mapa = detectarColunas(cab)

  it('detecta colunas pelo cabeçalho', () => {
    expect(mapa).toEqual({ periodo: 0, codigo: 1, nome: 2, carga_horaria: 3, tipo: 4, pre_requisitos: 5, status: 6 })
  })

  it('converte uma linha', () => {
    expect(converterLinha(['3º', 'MAT201', 'Cálculo II', '60h', 'Optativa', 'MAT101; FIS101', 'Aprovado'], mapa)).toMatchObject({
      codigo: 'MAT201', periodo: 3, carga_horaria: 60, tipo: 'optativa', pre_requisitos: ['MAT101', 'FIS101'], status: 'aprovada',
    })
  })

  it('ignora linha sem nome e trata "nenhum"', () => {
    expect(converterLinha(['', '', '', '', '', '', ''], mapa)).toBeNull()
    expect(converterLinha(['1', 'X', 'Y', '30', '', 'Nenhum', ''], mapa)?.pre_requisitos).toEqual([])
  })
})
