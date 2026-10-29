import * as XLSX from 'xlsx'

export interface ItemPdf {
  str: string
  x: number
  y: number
  largura: number
}

export interface PaginaPdf {
  itens: ItemPdf[]
  linhas: string[]
}

export interface Documento {
  nome: string
  /** Texto linha a linha; colunas separadas por tabulação. */
  linhas: string[]
  /** Só para planilhas: células como texto. */
  tabela: string[][] | null
  /** Só para PDFs: texto com posição, página a página (para fluxogramas e quadros de horário). */
  paginas: PaginaPdf[] | null
}

/** Junta os pedaços de texto de uma página PDF em linhas (mesma altura) e colunas (espaço grande). */
export function agruparLinhas(itens: ItemPdf[]): string[] {
  const ordenados = itens.filter((i) => i.str.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x)
  const grupos: ItemPdf[][] = []
  for (const it of ordenados) {
    const g = grupos[grupos.length - 1]
    if (g && Math.abs(g[0].y - it.y) <= 3) g.push(it)
    else grupos.push([it])
  }
  return grupos.map((g) => {
    g.sort((a, b) => a.x - b.x)
    let linha = ''
    let fim = 0
    g.forEach((it, i) => {
      const folga = it.x - fim
      if (i > 0) linha += folga > 14 ? '\t' : folga > 1 && !linha.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : ''
      linha += it.str
      fim = it.x + it.largura
    })
    return linha.replace(/[ ]{2,}/g, ' ').trim()
  })
}

async function lerPdf(buf: ArrayBuffer): Promise<PaginaPdf[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
  const paginas: PaginaPdf[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n)
    const conteudo = await pagina.getTextContent()
    const itens = (conteudo.items as { str?: string; transform?: number[]; width?: number }[])
      .filter((i) => typeof i.str === 'string' && i.transform)
      .map((i) => ({ str: i.str!.trim(), x: i.transform![4], y: i.transform![5], largura: i.width ?? 0 }))
      .filter((i) => i.str !== '')
    paginas.push({ itens, linhas: agruparLinhas(itens) })
  }
  return paginas
}

export function documentoDeTexto(nome: string, texto: string): Documento {
  return { nome, linhas: texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean), tabela: null, paginas: null }
}

export async function lerDocumento(arquivo: File): Promise<Documento> {
  const ext = arquivo.name.split('.').pop()?.toLowerCase()
  const buf = await arquivo.arrayBuffer()

  if (ext === 'pdf') {
    const paginas = await lerPdf(buf)
    const linhas = paginas.flatMap((p) => p.linhas)
    if (!linhas.length) throw new Error('Esse PDF não tem texto selecionável (parece ser uma foto/escaneado). Tente a versão digital ou cole o texto.')
    return { nome: arquivo.name, linhas, tabela: null, paginas }
  }

  if (ext === 'txt') return documentoDeTexto(arquivo.name, new TextDecoder().decode(buf))

  if (['xlsx', 'xls', 'ods', 'csv'].includes(ext ?? '')) {
    const wb = XLSX.read(buf, { codepage: 65001 })
    const tabela: string[][] = []
    for (const nome of wb.SheetNames) {
      const dados = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome], { header: 1, defval: '', blankrows: false })
      for (const l of dados) tabela.push(l.map((c) => String(c ?? '').trim()))
    }
    const cheias = tabela.filter((l) => l.some(Boolean))
    return { nome: arquivo.name, linhas: cheias.map((l) => l.join('\t').replace(/\t+$/, '')), tabela: cheias, paginas: null }
  }

  throw new Error('Formato não suportado. Envie PDF, planilha (xlsx, xls, ods, csv) ou texto (.txt).')
}
