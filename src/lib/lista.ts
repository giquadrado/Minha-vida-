import { chaveDe, codigosEm, nomeCanonico, type DiscDetectada } from './analise'
import type { StatusDisciplina } from './types'

export interface ItemLista {
  /** texto como o aluno escreveu: nome da matéria, com ou sem código */
  texto: string
  status: StatusDisciplina
}

const CABECALHOS: [RegExp, StatusDisciplina][] = [
  [/fiz|feit|conclu|aprov|cursei/i, 'aprovada'],
  [/cursand|andamento|matricul/i, 'cursando'],
  [/pend|falta|devo|reprov|ainda/i, 'pendente'],
]

/**
 * Lê uma lista de matérias, uma por linha. Linhas começadas por "#" mudam a situação
 * das seguintes ("# já fiz", "# cursando", "# pendentes"); sem cabeçalho vale "já fiz".
 */
export function lerLista(texto: string): ItemLista[] {
  const itens: ItemLista[] = []
  let status: StatusDisciplina = 'aprovada'
  for (const bruta of texto.split(/\r?\n/)) {
    const l = bruta.trim()
    if (!l) continue
    if (l.startsWith('#')) {
      const novo = CABECALHOS.find(([re]) => re.test(l))
      if (novo) status = novo[1]
      continue
    }
    itens.push({ texto: l.replace(/^([-•*]|\d+[.)])\s*/, ''), status })
  }
  return itens
}

/** Forma comparável: sem acento/pontuação, "p/" = "para", plural simplificado, "psico." = "psicol.". */
function forma(s: string): string {
  return nomeCanonico(s)
    .replace(/\bp\b/g, 'para')
    .replace(/\bpsico\b/g, 'psicol')
    .replace(/\botica\b/g, 'optica')
    .split(' ')
    .map((w) => (w.length > 3 ? w.replace(/s$/, '') : w))
    .join(' ')
}

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

export interface Casamento {
  /** chave da disciplina na grade → situação informada */
  aplicar: Map<string, StatusDisciplina>
  naoReconhecidas: string[]
}

/** Liga cada item da lista a uma disciplina da grade (cada disciplina é usada uma vez). */
export function casar(itens: ItemLista[], grade: DiscDetectada[], tolerancia = 0.28): Casamento {
  const nomes = grade.map((d) => forma(d.nome))
  const pares: { i: number; j: number; custo: number }[] = []
  itens.forEach((it, i) => {
    const codigos = codigosEm(it.texto).map((c) => c.codigo.toLowerCase())
    const f = forma(it.texto.replace(/[A-Z]{2,6}\s?-?\d{2,5}[A-Z]?/g, ' '))
    grade.forEach((d, j) => {
      if (d.codigo && codigos.includes(d.codigo.replace(/\s/g, '').toLowerCase())) return void pares.push({ i, j, custo: -1 })
      if (!f) return
      const custo = distancia(f, nomes[j]) / Math.max(f.length, nomes[j].length)
      if (custo <= tolerancia) pares.push({ i, j, custo })
    })
  })

  const aplicar = new Map<string, StatusDisciplina>()
  const itemUsado = new Set<number>()
  const discUsada = new Set<number>()
  for (const p of pares.sort((a, b) => a.custo - b.custo)) {
    if (itemUsado.has(p.i) || discUsada.has(p.j)) continue
    itemUsado.add(p.i)
    discUsada.add(p.j)
    aplicar.set(chaveDe(grade[p.j]), itens[p.i].status)
  }
  return { aplicar, naoReconhecidas: itens.filter((_, i) => !itemUsado.has(i)).map((x) => x.texto) }
}
