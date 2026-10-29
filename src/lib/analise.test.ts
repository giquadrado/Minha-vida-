import { describe, expect, it } from 'vitest'
import { agruparLinhas, documentoDeTexto, type Documento } from './documentos'
import { chaveDe, cruzar, diasEm, extrairGrade, extrairHorarios, intervaloEm, periodoDe } from './analise'

const GRADE = `
Matriz Curricular — Ciência da Computação
1º Período
MAT101 Cálculo I 60 -
INF101 Algoritmos 60
2º Período
MAT201 Cálculo II 60 MAT101
INF201\tEstrutura de Dados\t60\tINF101
3º Período
INF301 Banco de Dados 60 INF201
Disciplinas Optativas
OPT001 Tópicos Especiais 30
`

const grade = extrairGrade(documentoDeTexto('grade.pdf', GRADE))

describe('grade curricular', () => {
  it('lê períodos, nomes, carga e pré-requisitos', () => {
    expect(grade.map((d) => d.codigo)).toEqual(['MAT101', 'INF101', 'MAT201', 'INF201', 'INF301', 'OPT001'])
    expect(grade[0]).toMatchObject({ nome: 'Cálculo I', carga_horaria: 60, periodo: 1, tipo: 'obrigatoria' })
    expect(grade[2]).toMatchObject({ nome: 'Cálculo II', periodo: 2, pre_requisitos: ['MAT101'] })
    expect(grade[3]).toMatchObject({ nome: 'Estrutura de Dados', pre_requisitos: ['INF101'] })
    expect(grade[5]).toMatchObject({ tipo: 'optativa', periodo: null, carga_horaria: 30 })
  })

  it('reconhece cabeçalhos de período', () => {
    expect(periodoDe('1º Período')).toBe(1)
    expect(periodoDe('Período 4')).toBe(4)
    expect(periodoDe('Terceiro semestre')).toBe(3)
    expect(periodoDe('MAT101 Cálculo I 60 período 2')).toBeNull()
  })

  it('lê grade em planilha', () => {
    const doc: Documento = {
      nome: 'g.xlsx',
      linhas: [],
      paginas: null,
      tabela: [['Período', 'Código', 'Disciplina', 'CH', 'Pré-requisitos'], ['1', 'MAT101', 'Cálculo I', '60', ''], ['2', 'MAT201', 'Cálculo II', '60', 'MAT101']],
    }
    expect(extrairGrade(doc)).toHaveLength(2)
  })
})

describe('horários', () => {
  it('lê dias e intervalos', () => {
    expect(diasEm('Seg e Qua 19:00')).toEqual([1, 3])
    expect(diasEm('3ª feira')).toEqual([2])
    expect(diasEm('Turma 3 a 5 alunos')).toEqual([])
    expect(intervaloEm('19h às 22h30')).toMatchObject({ inicio: '19:00', fim: '22:30' })
  })

  it('lê horários em linhas de texto', () => {
    const doc = documentoDeTexto(
      'h.pdf',
      ['MAT201 Cálculo II Segunda 19:00 - 20:40 Sala 12', 'Quarta-feira', 'INF201 Estrutura de Dados 19:00 às 22:00'].join('\n'),
    )
    const { horarios, novas } = extrairHorarios(doc, grade)
    expect(novas).toEqual([])
    expect(horarios).toEqual([
      { chave: 'inf201', dia: 3, inicio: '19:00', fim: '22:00', local: null },
      { chave: 'mat201', dia: 1, inicio: '19:00', fim: '20:40', local: 'Sala 12' },
    ])
  })

  it('lê quadro semanal em planilha e junta faixas coladas', () => {
    const doc: Documento = {
      nome: 'h.xlsx',
      linhas: [],
      paginas: null,
      tabela: [
        ['Horário', 'Segunda', 'Terça', 'Quarta'],
        ['19:00 - 19:50', 'MAT201 Cálculo II', '', 'INF201'],
        ['19:50 - 20:40', 'MAT201 Cálculo II', '', 'INF201'],
        ['20:40 - 21:30', '', 'Inglês Instrumental', ''],
      ],
    }
    const { horarios, novas } = extrairHorarios(doc, grade)
    expect(horarios).toContainEqual({ chave: 'mat201', dia: 1, inicio: '19:00', fim: '20:40', local: null })
    expect(horarios).toContainEqual({ chave: 'inf201', dia: 3, inicio: '19:00', fim: '20:40', local: null })
    expect(novas.map((d) => d.nome)).toEqual(['Inglês Instrumental'])
  })
})

describe('cruzamento', () => {
  it('sugere pré-requisitos e períodos anteriores como já cursados', () => {
    const doc = documentoDeTexto('h.pdf', 'INF301 Banco de Dados Terça 19:00-22:00')
    const { horarios } = extrairHorarios(doc, grade)
    const s = cruzar(grade, horarios)
    const st = (cod: string) => s.status[chaveDe(grade.find((d) => d.codigo === cod)!)]
    expect(s.periodoAtual).toBe(3)
    expect(st('INF301')).toBe('cursando')
    expect(st('INF201')).toBe('aprovada') // pré-requisito
    expect(st('INF101')).toBe('aprovada') // pré-requisito indireto
    expect(st('MAT101')).toBe('aprovada') // período anterior
    expect(st('MAT201')).toBe('aprovada') // período anterior
    expect(st('OPT001')).toBe('pendente')
  })
})

describe('leitura de PDF', () => {
  it('agrupa itens da mesma altura em linhas e separa colunas', () => {
    const itens = [
      { str: 'Cálculo', x: 60, y: 700, largura: 40 },
      { str: 'I', x: 102, y: 700, largura: 5 },
      { str: 'MAT101', x: 10, y: 701, largura: 40 },
      { str: '60', x: 300, y: 700, largura: 10 },
      { str: '2º Período', x: 10, y: 730, largura: 60 },
    ]
    expect(agruparLinhas(itens)).toEqual(['2º Período', 'MAT101 Cálculo I\t60'])
  })
})
