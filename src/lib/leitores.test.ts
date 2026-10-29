import { describe, expect, it } from 'vitest'
import { agruparLinhas, type Documento, type ItemPdf, type PaginaPdf } from './documentos'
import { extrairGrade, extrairHorarios } from './analise'
import { extrairRegras, lerFluxograma, lerQuadroSemanal } from './leitores'

const it_ = (str: string, x: number, y: number, largura = 20): ItemPdf => ({ str, x, y, largura })
const pagina = (itens: ItemPdf[]): PaginaPdf => ({ itens, linhas: agruparLinhas(itens) })
const doc = (paginas: PaginaPdf[]): Documento => ({ nome: 'x.pdf', linhas: paginas.flatMap((p) => p.linhas), tabela: null, paginas })

/** Fluxograma sintético no estilo UFU: texto girado, caixas em colunas, períodos de baixo para cima. */
function fluxograma(): PaginaPdf {
  const itens: ItemPdf[] = []
  for (const n of [1, 2, 3]) {
    const P = 80 * n
    itens.push(it_('Per', 60, P, 9), it_(String(n), 60, P - 7, 3))
    ;[102, 137, 172, 207, 241, 276, 311, 408].forEach((col, c) => {
      const codigo = `MAT${n}${c}000`
      itens.push(it_('0', col, P, 2), it_('4', col, P + 15, 2), it_('0', col, P - 16, 2))
      itens.push(it_(codigo, col - 6, P - 13, 26))
      // nome em duas linhas girado: a 1ª linha fica mais à esquerda (x menor)
      itens.push(it_('PARTE', col - 20, P - 10, 25), it_('LINHA', col - 14, P - 9, 12))
      if (n === 2 && c === 0) itens.push(it_('MAT', col - 12, P - 45, 15), it_('10000', col - 6, P - 45, 13)) // pré-requisito em 2 pedaços
    })
  }
  itens.push(it_('OBRIGATÓRIAS - 3.690 horas', 212, 32, 70), it_('OPTATIVAS - Mínimo de 180 horas', 486, 32, 84))
  itens.push(it_('CURSO DE GRADUAÇÃO EM ENGENHARIA TESTE - VERSÃO 2013/1 [ 4.170 horas ]', 50, 269, 300))
  return pagina(itens)
}

describe('fluxograma', () => {
  const g = lerFluxograma(fluxograma())!

  it('lê períodos, créditos (×15 h), nomes na ordem das linhas e tipo pela coluna', () => {
    expect(g).toHaveLength(24)
    const d = g.find((x) => x.codigo === 'MAT20000')!
    expect(d).toMatchObject({ periodo: 2, carga_horaria: 60, tipo: 'obrigatoria', nome: 'PARTE LINHA' })
    expect(g.find((x) => x.codigo === 'MAT27000')).toMatchObject({ tipo: 'optativa', periodo: null })
    expect(g.find((x) => x.codigo === 'MAT10000')).toMatchObject({ periodo: 1 })
  })

  it('junta o pré-requisito escrito em dois pedaços ("MAT" + "10000")', () => {
    expect(g.find((x) => x.codigo === 'MAT20000')!.pre_requisitos).toEqual(['MAT10000'])
    expect(g.find((x) => x.codigo === 'MAT21000')!.pre_requisitos).toEqual([])
  })

  it('extrairGrade usa o leitor de fluxograma', () => {
    expect(extrairGrade(doc([fluxograma()]))).toHaveLength(24)
  })

  it('lê as regras do curso', () => {
    const r = extrairRegras([fluxograma()])
    expect(r).toMatchObject({ nome: 'ENGENHARIA TESTE', versao: '2013/1', total: 4170, obrigatorias: 3690, optativas: 180 })
  })
})

/** Quadro semanal sintético: cabeçalho com dias, faixas de horário e legenda no rodapé. */
function quadro(): PaginaPdf {
  const itens: ItemPdf[] = [
    it_('SEGUNDA', 187, 527, 50), it_('TERÇA', 319, 527, 34), it_('QUARTA', 440, 527, 43),
    it_('07:10', 55, 514, 25), it_('08:00', 97, 514, 25), it_('A', 138, 514, 7),
    it_('08:00', 55, 502, 25), it_('08:50', 97, 502, 25), it_('B', 138, 502, 7),
    it_('FAMAT31011', 168, 514, 63), it_('V', 255, 514, 7),
    it_('FAMAT31011', 168, 502, 63), it_('V', 255, 502, 7),
    it_('FEMEC31040', 416, 514, 63), it_('VA', 503, 514, 14),
    it_('FEMEC31040', 416, 502, 63), it_('VA', 503, 502, 14),
    it_('FEMEC31040', 287, 502, 63), it_('V', 375, 502, 7),
  ]
  const p = pagina(itens)
  p.linhas.push(
    'PRIMEIRO PERÍODO (NOVO CURRÍCULO – VERSÃO 2025-1)',
    'AULAS NO CAMPUS SANTA MÔNICA',
    'CÓDIGO\tLEGENDA',
    'FAMAT31011\tCálculo Diferencial e Integral I\t1BCG 202\t6\t0\tV(30)',
    'FEMEC31040\tMecânica dos Sólidos (T1)\t1BCG 203\t5\t1\tV(24)',
  )
  return p
}

describe('quadro semanal', () => {
  it('liga cada código ao dia pela coluna e à faixa pelo horário, com a turma', () => {
    const q = lerQuadroSemanal([quadro()])!
    const f = (codigo: string, dia: number) => q.entradas.filter((e) => e.codigo === codigo && e.dia === dia)
    expect(f('FAMAT31011', 1).map((e) => [e.inicio, e.fim, e.turma])).toEqual([['07:10', '08:00', 'V'], ['08:00', '08:50', 'V']])
    expect(f('FEMEC31040', 3)[0]).toMatchObject({ turma: 'VA', inicio: '07:10' })
    expect(f('FEMEC31040', 2)).toHaveLength(1)
    expect(q.legenda.get('FAMAT31011')).toMatchObject({ nome: 'Cálculo Diferencial e Integral I', sala: '1BCG 202' })
  })

  it('liga o horário à disciplina da grade pelo nome quando o código é de outro currículo', () => {
    const grade = extrairGrade(doc([fluxograma()]))
    grade[0] = { ...grade[0], codigo: 'FAMAT49010', nome: 'CÁLCULO DIFERENCIAL E INTEGRAL I' }
    const r = extrairHorarios(doc([quadro()]), grade)
    const h = r.horarios.filter((x) => x.chave === 'famat49010')
    expect(h).toEqual([{ chave: 'famat49010', dia: 1, inicio: '07:10', fim: '08:50', local: '1BCG 202', turma: 'V' }])
    expect(r.ignoradas).toEqual(['FEMEC31040']) // não está na grade
  })
})
