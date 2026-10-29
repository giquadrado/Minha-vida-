import type { Disciplina, StatusDisciplina } from './types'

export type CampoImport = 'codigo' | 'nome' | 'carga_horaria' | 'periodo' | 'tipo' | 'pre_requisitos' | 'status'

export const CAMPOS: [CampoImport, string][] = [
  ['codigo', 'Código'],
  ['nome', 'Nome'],
  ['carga_horaria', 'Carga horária'],
  ['periodo', 'Período'],
  ['tipo', 'Tipo (obrigatória/optativa)'],
  ['pre_requisitos', 'Pré-requisitos'],
  ['status', 'Situação'],
]

const PALAVRAS: Record<CampoImport, string[]> = {
  codigo: ['codigo', 'cod', 'sigla'],
  nome: ['nome', 'disciplina', 'componente', 'materia'],
  carga_horaria: ['carga', 'ch', 'horas', 'carga horaria'],
  periodo: ['periodo', 'semestre', 'etapa', 'fase', 'serie'],
  tipo: ['tipo', 'natureza', 'categoria'],
  pre_requisitos: ['pre', 'requisito', 'prerequisito'],
  status: ['status', 'situacao', 'resultado'],
}

export const normalizar = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Descobre qual coluna corresponde a cada campo pelo nome do cabeçalho. */
export function detectarColunas(cabecalho: unknown[]): Partial<Record<CampoImport, number>> {
  const cab = cabecalho.map(normalizar)
  const res: Partial<Record<CampoImport, number>> = {}
  const usadas = new Set<number>()
  // pré-requisitos antes de nome/código para "Código pré-requisito" não roubar a coluna errada
  for (const campo of ['pre_requisitos', 'carga_horaria', 'codigo', 'nome', 'periodo', 'tipo', 'status'] as CampoImport[]) {
    const i = cab.findIndex((c, idx) => !usadas.has(idx) && PALAVRAS[campo].some((p) => c === p || c.startsWith(p + ' ') || c.includes(p)))
    if (i >= 0) {
      res[campo] = i
      usadas.add(i)
    }
  }
  return res
}

function status(v: unknown): StatusDisciplina {
  const s = normalizar(v)
  if (!s) return 'pendente'
  if (s.includes('disp') || s.includes('aproveit') || s.includes('equival')) return 'dispensada'
  if (s.includes('reprov')) return 'reprovada'
  if (s.includes('aprov') || s === 'ap') return 'aprovada'
  if (s.includes('cursa') || s.includes('matric')) return 'cursando'
  return 'pendente'
}

export function converterLinha(linha: unknown[], mapa: Partial<Record<CampoImport, number>>): Omit<Disciplina, 'id'> | null {
  const v = (c: CampoImport) => (mapa[c] == null ? '' : linha[mapa[c]!])
  const nome = String(v('nome') ?? '').trim()
  if (!nome) return null
  const num = (x: unknown) => {
    const m = String(x ?? '').replace(',', '.').match(/\d+(\.\d+)?/)
    return m ? Number(m[0]) : null
  }
  return {
    codigo: String(v('codigo') ?? '').trim(),
    nome,
    carga_horaria: num(v('carga_horaria')) ?? 0,
    periodo: num(v('periodo')),
    tipo: normalizar(v('tipo')).startsWith('opt') || normalizar(v('tipo')).includes('eletiv') ? 'optativa' : 'obrigatoria',
    pre_requisitos: String(v('pre_requisitos') ?? '')
      .split(/[;,/|]|\s+e\s+/)
      .map((s) => s.trim())
      .filter((s) => s && normalizar(s) !== 'nenhum' && s !== '-'),
    status: status(v('status')),
    nota_final: null,
  }
}
