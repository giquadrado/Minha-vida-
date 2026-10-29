import type { ItemPdf, PaginaPdf } from './documentos'
import type { DiscDetectada } from './analise'

/**
 * Leitores para PDFs com desenho próprio, onde ler "linha por linha" não funciona:
 *  - fluxograma curricular (caixas por período);
 *  - quadro semanal de horários (colunas = dias, linhas = faixas de horário).
 * Eles usam a posição de cada texto na página.
 */

const COD = /^([A-Z]{3,6})\s?(\d{5})\*?$/
const centro = (i: ItemPdf) => i.x + i.largura / 2
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

function codigoDe(s: string): string | null {
  const m = s.match(COD)
  return m ? m[1] + m[2] : null
}

// ------------------------------------------------------------------ regras do curso

export interface RegrasCurso {
  nome: string | null
  versao: string | null
  total: number | null
  obrigatorias: number | null
  optativas: number | null
  humanidades: number | null
  estagio: number | null
  complementares: number | null
}

const numero = (s: string) => Number(s.replace(/\./g, ''))

/** Procura, pelo texto solto de um fluxograma, as horas exigidas em cada categoria. */
export function extrairRegras(paginas: PaginaPdf[]): RegrasCurso {
  const itens = paginas.flatMap((p) => p.itens)
  const texto = paginas.flatMap((p) => p.linhas).join(' ')
  const r: RegrasCurso = { nome: null, versao: null, total: null, obrigatorias: null, optativas: null, humanidades: null, estagio: null, complementares: null }

  r.nome = texto.match(/GRADUA[ÇC][ÃA]O EM (.+?)\s*[-–]\s*VERS/i)?.[1]?.trim() ?? null
  r.versao = texto.match(/VERS[ÃA]O\s*(\d{4}\s*[/-]\s*\d\w?)/i)?.[1]?.replace(/\s/g, '') ?? null
  const total = texto.match(/\[\s*([\d.]+)\s*horas\s*\]/i)
  r.total = total ? numero(total[1]) : null
  const obrig = texto.match(/OBRIGAT[ÓO]RIAS\s*-\s*([\d.]+)\s*horas/i)
  r.obrigatorias = obrig ? numero(obrig[1]) : null

  // cada "mínimo de N horas" vale para a palavra-chave mais próxima
  const chaves: [keyof RegrasCurso, RegExp][] = [
    ['humanidades', /HUMANIDADES/i],
    ['optativas', /^DISCIPLINAS?$|OPTATIVAS/i],
    ['estagio', /EST[ÁA]GIO/i],
    ['complementares', /COMPLEMENTARES/i],
  ]
  for (const m of itens) {
    const horas = m.str.match(/M[ií]n(?:imo|\.)?:?\s*(?:de\s*)?(\d+)\s*h/i)
    if (!horas) continue
    const proxima = itens
      .flatMap((i) => chaves.filter(([, re]) => re.test(semAcento(i.str).toUpperCase())).map(([k]) => ({ k, d: i === m ? 0 : Math.hypot(i.x - m.x, (i.y - m.y) * 2) })))
      .sort((a, b) => a.d - b.d)[0]
    if (proxima && proxima.d < 140 && r[proxima.k] == null) (r[proxima.k] as number | null) = Number(horas[1])
  }
  return r
}

// ------------------------------------------------------------------ fluxograma

const horasPorCredito = 15

/**
 * Fluxograma da UFU: uma caixa por disciplina, um bloco horizontal por período
 * ("Per" + número à esquerda). O código serve de âncora; nome, créditos e
 * pré-requisitos são ligados ao código mais próximo dentro da faixa vertical do período.
 */
export function lerFluxograma(pagina: PaginaPdf): DiscDetectada[] | null {
  const it = pagina.itens
  const pers = it.filter((i) => i.str === 'Per' && i.x < 80).sort((a, b) => b.y - a.y)
  if (pers.length < 3) return null
  if (it.filter((i) => COD.test(i.str)).length < 20) return null

  const periodos = pers.map((p, k) => {
    const n = it.find((i) => /^\d{1,2}$/.test(i.str) && i.x >= 57 && i.x <= 64 && i.y <= p.y - 4 && i.y >= p.y - 16)
    return { y: p.y, n: n ? Number(n.str) : pers.length - k }
  })

  // colunas de caixas: x dos números da linha "prática" de cada período
  const colunasPor = periodos.map((p) => it.filter((i) => /^\d{1,2}$/.test(i.str) && i.x > 90 && Math.abs(i.y - p.y) <= 2).map((i) => i.x))
  const todasX = [...new Set(colunasPor.flat().map((x) => Math.round(x)))].sort((a, b) => a - b)
  let corte = Infinity
  let maiorFolga = 50
  for (let k = 1; k < todasX.length; k++)
    if (todasX[k] - todasX[k - 1] > maiorFolga) {
      maiorFolga = todasX[k] - todasX[k - 1]
      corte = (todasX[k] + todasX[k - 1]) / 2
    }

  const res: DiscDetectada[] = []
  const vistos = new Set<string>()

  periodos.forEach((p, k) => {
    const faixa = (de: number, ate: number) => it.filter((i) => i.y >= p.y + de && i.y <= p.y + ate)
    const nomes = faixa(-28, -2).filter((i) => i.x >= 72)
    const codigos = nomes.filter((i) => COD.test(i.str)).sort((a, b) => a.x - b.x)
    if (!codigos.length) return

    // Todo o texto do fluxograma está girado 90°: a posição da linha de texto é o x
    // (a "largura" corre na vertical). Cada caixa ocupa de col-26 a col+4.
    const colunas = [...new Set(colunasPor[k].map((x) => Math.round(x)))].sort((a, b) => a - b)
    const totais = faixa(10, 20).filter((i) => /^\d{1,2}$/.test(i.str))
    const colDe = (x: number) => {
      let melhor = -1
      let d = 16
      colunas.forEach((c, idx) => {
        const dd = Math.abs(x - (c - 11))
        if (dd <= d) {
          d = dd
          melhor = idx
        }
      })
      return melhor
    }

    const nomesPor: ItemPdf[][] = colunas.map(() => [])
    for (const i of nomes) {
      if (COD.test(i.str) || /^\d{1,2}$/.test(i.str) || /^\d{3,4}\s?h$/i.test(i.str) || /^Min/i.test(i.str)) continue
      const c = colDe(i.x)
      if (c >= 0) nomesPor[c].push(i)
    }

    // pré-requisitos: códigos inteiros ou "FEMEC" + "41040" em duas linhas vizinhas
    const pre = faixa(-50, -29)
    const letras = pre.filter((i) => /^[A-Z]{3,6}$/.test(i.str))
    const digitos = pre.filter((i) => /^\d{5}$/.test(i.str))
    const achados: { codigo: string; x: number }[] = []
    for (const i of pre) {
      const c = codigoDe(i.str)
      if (c) achados.push({ codigo: c, x: i.x })
      // "2700 h": mínimo de horas já cursadas, guardado como "CH2700"
      const horas = i.str.match(/^(\d{3,4})\s?h$/i)
      if (horas) achados.push({ codigo: `CH${horas[1]}`, x: i.x })
    }
    for (const l of letras) {
      const d = digitos.find((x) => Math.abs(x.y - l.y) <= 4 && x.x - l.x >= 2 && x.x - l.x <= 10)
      if (d) achados.push({ codigo: l.str + d.str, x: (l.x + d.x) / 2 })
    }
    const prePor: string[][] = colunas.map(() => [])
    for (const a of achados) {
      const c = colDe(a.x)
      if (c >= 0 && !prePor[c].includes(a.codigo)) prePor[c].push(a.codigo)
    }

    codigos.forEach((c) => {
      const codigo = codigoDe(c.str)!
      if (vistos.has(codigo)) return
      const idx = colDe(c.x)
      if (idx < 0) return
      vistos.add(codigo)
      const total = totais.find((t) => Math.abs(t.x - colunas[idx]) <= 3)
      const optativa = colunas[idx] > corte
      res.push({
        codigo,
        nome: [...nomesPor[idx]].sort((a, b) => a.x - b.x || b.y - a.y).map((n) => n.str).join(' ').replace(/s+/g, ' ').trim(),
        carga_horaria: total ? Number(total.str) * horasPorCredito : 0,
        periodo: optativa ? null : p.n,
        tipo: optativa ? 'optativa' : 'obrigatoria',
        pre_requisitos: prePor[idx],
        status: 'pendente',
        nota_final: null,
      })
    })
  })

  // caixas fora dos blocos de período (ex.: optativas de humanidades, na coluna central)
  for (const c of it.filter((i) => COD.test(i.str) && !vistos.has(codigoDe(i.str)!)).sort((a, b) => b.y - a.y)) {
    const codigo = codigoDe(c.str)!
    const nome = it
      .filter((n) => !COD.test(n.str) && !/^\d{1,4}\s?h?$/i.test(n.str) && !/^DISCIPLINAS|M[ií]nimo/i.test(n.str) && Math.abs(n.y - c.y) <= 18 && n.x >= c.x - 28 && n.x < c.x - 1)
      .sort((a, b) => a.x - b.x || b.y - a.y)
      .map((n) => n.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    // estágio e atividades complementares são horas, não disciplinas
    if (!nome || /EST[ÁA]GIO|COMPLEMENTARES|ACAD[ÊE]MICAS/i.test(nome)) continue
    vistos.add(codigo)
    res.push({ codigo, nome, carga_horaria: 0, periodo: null, tipo: 'optativa', pre_requisitos: [], status: 'pendente', nota_final: null })
  }

  // erros de digitação do próprio PDF (ex.: "FEEELT49070"): troca por um código que existe
  const existentes = new Set(res.map((d) => d.codigo))
  for (const d of res)
    d.pre_requisitos = d.pre_requisitos.map((p) => {
      if (existentes.has(p)) return p
      const letras = p.slice(0, -5)
      const num = p.slice(-5)
      for (let i = 0; i < letras.length; i++) {
        const tentativa = letras.slice(0, i) + letras.slice(i + 1) + num
        if (existentes.has(tentativa)) return tentativa
      }
      return p
    })

  return res
}

// ------------------------------------------------------------------ quadro semanal de horários

export interface EntradaQuadro {
  codigo: string
  turma: string | null
  dia: number
  inicio: string
  fim: string
  pagina: number
}

export interface LegendaDisc {
  nome: string | null
  sala: string | null
  /** ex.: "NOVO CURRÍCULO – VERSÃO 2025-1" */
  curriculo: string | null
}

export interface QuadroLido {
  entradas: EntradaQuadro[]
  legenda: Map<string, LegendaDisc>
}

const DIAS: [RegExp, number][] = [
  [/^SEGUNDA/, 1], [/^TER[CÇ]A/, 2], [/^QUARTA/, 3], [/^QUINTA/, 4], [/^SEXTA/, 5], [/^S[ÁA]BADO/, 6], [/^DOMINGO/, 0],
]
const HORA = /^\d{1,2}:\d{2}$/
const TURMA = /^[VU][A-Z*/~]*$/
const SALA = /^(\d?[A-Z]{1,4}[- ]?[A-Z]?\s?\d{2,3}|LAB\.?|-)(\s*\(.*\))?$/

const pad = (h: string) => (h.length === 4 ? `0${h}` : h)

function legendaDe(pagina: PaginaPdf, curriculo: string | null): Map<string, LegendaDisc> {
  const mapa = new Map<string, LegendaDisc>()
  const ehNome = (s: string | undefined) =>
    !!s && /^[A-Za-zÀ-ÿ]/.test(s) && !/^[VU][A-Z]{1,2}(\s|$)/.test(s) && !/^(AULAS|C\.|LEGENDA|CÓDIGO|SALAS|Teórica|Página|Grade|VA )/i.test(s) && s.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 4
  const linhas = pagina.linhas
  // a legenda começa depois da grade: "AULAS NO CAMPUS…", "C. H. SEMANAL", "CÓDIGO"…
  const inicio = Math.max(0, linhas.findIndex((l) => /^AULAS NO CAMPUS|^C. ?H. SEMANAL|^CÓDIGO|^LEGENDA/i.test(l)))
  linhas.forEach((linha, i) => {
    if (i < inicio) return
    const cel = linha.split('\t').map((c) => c.trim())
    const m = cel[0].match(/^([A-Z]{3,6})\s?(\d{5})\*?(?:\s+(.+))?$/)
    if (!m) return
    const codigo = m[1] + m[2]
    if (mapa.has(codigo)) return
    const resto = cel.slice(1)
    const sala = resto.find((c) => SALA.test(c) && c !== '-') ?? null
    let nome: string | null = m[3] ?? resto.find((c) => ehNome(c) && !SALA.test(c)) ?? null
    if (!nome) {
      const antes = linhas[i - 1]?.split('\t')[0]
      const depois = linhas[i + 1]?.split('\t')[0]
      const partes = [ehNome(antes) && !COD.test(antes!) ? antes : null, ehNome(depois) && !/^[A-Z]{3,6}\s?\d{5}/.test(depois!) ? depois : null].filter((p): p is string => !!p)
      nome = partes.length ? partes.join(' ') : null
    }
    mapa.set(codigo, { nome: nome?.replace(/\s+/g, ' ').trim() ?? null, sala, curriculo })
  })
  return mapa
}

export function lerQuadroSemanal(paginas: PaginaPdf[]): QuadroLido | null {
  const entradas: EntradaQuadro[] = []
  const legenda = new Map<string, LegendaDisc>()

  paginas.forEach((pg, n) => {
    const cab = pg.itens.filter((i) => DIAS.some(([re]) => re.test(semAcento(i.str).toUpperCase().replace(/\*+$/, ''))))
    const porY = new Map<number, ItemPdf[]>()
    for (const c of cab) {
      const y = [...porY.keys()].find((k) => Math.abs(k - c.y) <= 2) ?? c.y
      porY.set(y, [...(porY.get(y) ?? []), c])
    }
    const cabecalho = [...porY.entries()].find(([, v]) => v.length >= 3)
    if (!cabecalho) return
    const [yCab, itensCab] = cabecalho
    const colunas = itensCab.map((c) => ({ dia: DIAS.find(([re]) => re.test(semAcento(c.str).toUpperCase()))![1], cx: centro(c) }))

    // faixas de horário: dois horários (início e fim) na mesma linha, à esquerda
    const horas = pg.itens.filter((i) => HORA.test(i.str) && i.x < 130 && i.y < yCab)
    const faixas: { y: number; inicio: string; fim: string }[] = []
    for (const h of horas.sort((a, b) => b.y - a.y || a.x - b.x)) {
      const f = faixas.find((x) => Math.abs(x.y - h.y) <= 1.5)
      if (f) f.fim = pad(h.str)
      else faixas.push({ y: h.y, inicio: pad(h.str), fim: '' })
    }
    const validas = faixas.filter((f) => f.fim)
    if (!validas.length) return
    const yUltima = Math.min(...validas.map((f) => f.y))

    const titulo = pg.linhas.find((l) => /PER[ÍI]ODO/i.test(l) && /\(/.test(l))
    const curriculo = titulo?.match(/\((.+)\)/)?.[1]?.replace(/\s+/g, ' ') ?? null
    for (const [k, v] of legendaDe(pg, curriculo)) if (!legenda.has(k)) legenda.set(k, v)

    for (const i of pg.itens) {
      const codigo = codigoDe(i.str)
      if (!codigo || i.y > yCab || i.y < yUltima - 8) continue
      const turma = pg.itens
        .filter((t) => TURMA.test(t.str) && Math.abs(t.y - i.y) <= 2 && t.x >= i.x + i.largura - 2 && t.x <= i.x + i.largura + 70)
        .sort((a, b) => a.x - b.x)[0]
      const faixa = validas.reduce((m, f) => (Math.abs(f.y - i.y) < Math.abs(m.y - i.y) ? f : m), validas[0])
      const col = colunas.reduce((m, c) => (Math.abs(c.cx - centro(i)) < Math.abs(m.cx - centro(i)) ? c : m), colunas[0])
      entradas.push({ codigo, turma: turma?.str ?? null, dia: col.dia, inicio: faixa.inicio, fim: faixa.fim, pagina: n + 1 })
    }
  })

  return entradas.length ? { entradas, legenda } : null
}
