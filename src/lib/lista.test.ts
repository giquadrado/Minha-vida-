import { describe, expect, it } from 'vitest'
import { casar, lerLista } from './lista'
import type { DiscDetectada } from './analise'

const d = (codigo: string, nome: string): DiscDetectada => ({
  codigo, nome, carga_horaria: 60, periodo: 1, tipo: 'obrigatoria', pre_requisitos: [], status: 'pendente', nota_final: null,
})

const grade = [
  d('INFIS49021', 'FÍSICA EXPERIMENTAL I'),
  d('INFIS49031', 'FÍSICA EXPERIMENTAL'),
  d('IPUFU49050', 'PSICOL. APLICADA AO TRABALHO'),
  d('FEMEC42031', 'INTRODUÇÃO À CIÊNCIAS DOS MATERIAIS'),
  d('INFIS49061', 'LABORATÓRIO DE ÓPTICA'),
  d('FEELT49050', 'CIRCUITOS ELÉTRICOS PARA MECATRÔNICA'),
  d('FEMEC41040', 'DINÂMICA'),
  d('FEMEC41061', 'DINÂMICA DE MÁQUINAS'),
]

describe('lista de matérias', () => {
  it('lê cabeçalhos e marcadores', () => {
    expect(lerLista('# já fiz\n- Dinâmica\n1. Estática\n\n# cursando\nRedes Industriais\n# pendentes\nÓptica')).toEqual([
      { texto: 'Dinâmica', status: 'aprovada' },
      { texto: 'Estática', status: 'aprovada' },
      { texto: 'Redes Industriais', status: 'cursando' },
      { texto: 'Óptica', status: 'pendente' },
    ])
    expect(lerLista('Dinâmica')[0].status).toBe('aprovada')
  })

  it('reconhece nomes escritos de outro jeito', () => {
    const r = casar(
      lerLista('Psico. Aplicada ao Trabalho\nIntrodução à Ciência dos Materiais\nLaboratório de Ótica\nCircuitos Elétricos p/ Mecatrônica\nDinâmica'),
      grade,
    )
    expect([...r.aplicar.keys()].sort()).toEqual(['feelt49050', 'femec41040', 'femec42031', 'infis49061', 'ipufu49050'])
    expect(r.naoReconhecidas).toEqual([])
  })

  it('não confunde "Dinâmica" com "Dinâmica de Máquinas" nem "Experimental I" com "II"', () => {
    const r = casar(lerLista('Física Experimental I\nFísica Experimental II\nDinâmica'), grade)
    expect(r.aplicar.has('infis49021')).toBe(true)
    expect(r.aplicar.has('infis49031')).toBe(true)
    expect(r.aplicar.has('femec41040')).toBe(true)
    expect(r.aplicar.has('femec41061')).toBe(false)
  })

  it('aceita código e informa o que não reconheceu', () => {
    const r = casar(lerLista('FEMEC41061 qualquer coisa\nMatéria que não existe'), grade)
    expect(r.aplicar.has('femec41061')).toBe(true)
    expect(r.naoReconhecidas).toEqual(['Matéria que não existe'])
  })
})
