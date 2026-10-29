import { converterLinha, detectarColunas, normalizar } from './importacao'
import { minutos } from './calculos'
import { extrairRegras, lerFluxograma, lerQuadroSemanal, type QuadroLido, type RegrasCurso } from './leitores'
import type { Documento } from './documentos'
import type { Disciplina, StatusDisciplina } from './types'

export type DiscDetectada = Omit<Disciplina, 'id'>

export interface HorarioDetectado {
  /** chave da disciplina na grade (ver chaveDe) */
  chave: string
  dia: number
  inicio: string
  fim: string
  local: string | null
  /** turma/grupo do quadro de horários: "V" (teoria), "VA", "VA/VB"… */
  turma?: string | null
}

/** Horas exigidas pelo curso, quando o documento da grade as informa (fluxograma). */
export function extrairRegrasDoc(doc: Documento): RegrasCurso | null {
  if (!doc.paginas?.length) return null
  const r = extrairRegras(doc.paginas)
  return r.total || r.obrigatorias || r.optativas || r.estagio || r.complementares ? r : null
}

export const chaveDe = (d: Pick<Disciplina, 'codigo' | 'nome'>) => normalizar(d.codigo.replace(/\s/g, '') || d.nome)
const codNorm = (c: string) => normalizar(c.replace(/\s/g, ''))

// ---------------------------------------------------------------- códigos

const NAO_CODIGO = new Set(['CH', 'CR', 'CT', 'CP', 'HA', 'HR', 'HS', 'SALA', 'LAB', 'BLOCO', 'TURMA', 'AULA', 'PRE', 'REQ', 'TOTAL', 'SEM', 'PDF',
  'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII'])

/** Códigos de disciplina no texto: 2–6 letras maiúsculas + 2–5 dígitos (MAT101, ADM 1001, INF-201). */
export function codigosEm(texto: string): { codigo: string; ini: number; fim: number }[] {
  const res: { codigo: string; ini: number; fim: number }[] = []
  for (const m of texto.matchAll(/(?<![A-Za-z0-9])([A-Z]{2,6})[ -]?(\d{2,5}[A-Z]?)(?![A-Za-z0-9])/g)) {
    if (NAO_CODIGO.has(m[1])) continue
    // "LIBRAS 60" é nome + carga horária; com espaço só vale código de 3+ dígitos ("ADM 1001")
    const separador = m[0].slice(m[1].length, m[0].length - m[2].length)
    if (/\s/.test(separador) && m[2].replace(/\D/g, '').length < 3) continue
    res.push({ codigo: m[1] + m[2], ini: m.index!, fim: m.index! + m[0].length })
  }
  return res
}

// ---------------------------------------------------------------- grade

const ORDINAIS: Record<string, number> = {
  primeiro: 1, segundo: 2, terceiro: 3, quarto: 4, quinto: 5, sexto: 6, setimo: 7, oitavo: 8, nono: 9, decimo: 10,
}

export function periodoDe(linha: string): number | null {
  const l = normalizar(linha)
  if (l.length > 45 || codigosEm(linha).length) return null
  let m = l.match(/^\D{0,3}(\d{1,2})\s*[ºo°a]?\s*[-:.]?\s*(periodo|semestre|fase|etapa|serie|modulo)\b/)
  if (m) return Number(m[1])
  m = l.match(/\b(periodo|semestre|fase|etapa|serie|modulo)\s*[:\-]?\s*(\d{1,2})\b/)
  if (m) return Number(m[2])
  m = l.match(/\b(primeiro|segundo|terceiro|quarto|quinto|sexto|setimo|oitavo|nono|decimo)\s+(periodo|semestre|fase|etapa)/)
  return m ? ORDINAIS[m[1]] : null
}

function tipoCabecalho(linha: string): 'optativa' | 'obrigatoria' | null {
  const l = normalizar(linha)
  if (l.length > 50 || codigosEm(linha).length) return null
  if (/^(disciplinas\s+|componentes\s+)?(optativas?|eletivas?)\b/.test(l)) return 'optativa'
  if (/^(disciplinas\s+|componentes\s+)?obrigatorias?\b/.test(l)) return 'obrigatoria'
  return null
}

function linhaDeDisciplina(linha: string): Pick<DiscDetectada, 'codigo' | 'nome' | 'carga_horaria' | 'pre_requisitos' | 'periodo' | 'tipo'> | null {
  const texto = linha.split('\t').map((s) => s.trim()).filter(Boolean).join(' ')
  const codigos = codigosEm(texto)
  if (!codigos.length) return null
  const [primeiro, ...outros] = codigos

  const antes = texto.slice(0, primeiro.ini)
  const pPeriodo = antes.match(/(\d{1,2})\s*[ºo°ª]?\s*[-–.]?\s*$/)
  let resto = texto.slice(primeiro.fim)

  // nome: do código até o primeiro número solto, palavra de tipo/pré-requisito ou outro código
  const cortes = [
    resto.search(/\s\d{2,}/),
    resto.search(/\s(obrig|opt|eletiv|pr[eé][\s-]?req|pr[eé]:)/i),
    outros.length ? outros[0].ini - primeiro.fim : -1,
  ].filter((i) => i > 0)
  const fimNome = cortes.length ? Math.min(...cortes) : resto.length
  const nome = resto
    .slice(0, fimNome)
    .replace(/^[\s\-–:.|]+|[\s\-–:.|]+$/g, '')
    .replace(/\s+/g, ' ')
  if (nome.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 3) return null

  resto = resto.slice(fimNome)
  const ch = [...resto.matchAll(/(?<![\d:.])(\d{2,3})(?:\s*h\b|\b)/g)].map((m) => Number(m[1])).find((n) => n >= 15 && n <= 500)

  return {
    codigo: primeiro.codigo,
    nome,
    carga_horaria: ch ?? 0,
    pre_requisitos: outros.map((o) => o.codigo),
    periodo: pPeriodo ? Number(pPeriodo[1]) : null,
    tipo: /\b(optativa|eletiva)\b/i.test(normalizar(texto)) ? 'optativa' : 'obrigatoria',
  }
}

function gradeDeTexto(linhas: string[]): DiscDetectada[] {
  let periodo: number | null = null
  let tipo: 'obrigatoria' | 'optativa' = 'obrigatoria'
  const res: DiscDetectada[] = []
  for (const linha of linhas) {
    const p = periodoDe(linha)
    if (p != null) {
      periodo = p
      tipo = 'obrigatoria'
      continue
    }
    const t = tipoCabecalho(linha)
    if (t) {
      tipo = t
      if (t === 'optativa') periodo = null
      continue
    }
    const d = linhaDeDisciplina(linha)
    if (!d) continue
    res.push({
      ...d,
      periodo: d.periodo ?? periodo,
      tipo: d.tipo === 'optativa' ? 'optativa' : tipo,
      status: 'pendente',
      nota_final: null,
    })
  }
  return res
}

function gradeDeTabela(tabela: string[][]): DiscDetectada[] {
  for (let i = 0; i < Math.min(tabela.length, 15); i++) {
    const mapa = detectarColunas(tabela[i])
    if (mapa.nome != null && (mapa.codigo != null || mapa.carga_horaria != null)) {
      return tabela.slice(i + 1).map((l) => converterLinha(l, mapa)).filter((d): d is DiscDetectada => d != null)
    }
  }
  return []
}

function semDuplicatas(lista: DiscDetectada[]): DiscDetectada[] {
  const vistas = new Set<string>()
  return lista.filter((d) => {
    const k = chaveDe(d)
    if (vistas.has(k)) return false
    vistas.add(k)
    return true
  })
}

export function extrairGrade(doc: Documento): DiscDetectada[] {
  // fluxograma em PDF (caixas por período): leitor próprio, por posição
  for (const pg of doc.paginas ?? []) {
    const f = lerFluxograma(pg)
    if (f && f.length >= 10) return semDuplicatas(f)
  }
  const viaTabela = doc.tabela ? gradeDeTabela(doc.tabela) : []
  const viaTexto = gradeDeTexto(doc.linhas)
  return semDuplicatas(viaTabela.length >= viaTexto.length ? viaTabela : viaTexto)
}

// ---------------------------------------------------------------- horários

const DIA_POR_SIGLA: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 }

/** Dias da semana citados no texto ("Seg e Qua", "Terça-feira", "3ª"). */
export function diasEm(texto: string): number[] {
  const l = normalizar(texto)
  const achados = new Set<number>()
  for (const m of l.matchAll(/\b(dom(?:ingo)?|seg(?:unda)?|ter(?:ca)?|qua(?:rta)?|qui(?:nta)?|sex(?:ta)?|sab(?:ado)?)\b/g)) {
    achados.add(DIA_POR_SIGLA[m[1].slice(0, 3)])
  }
  for (const m of texto.matchAll(/\b([2-7])\s*(?:ª|º|a\s*-?\s*feira)/gi)) {
    const n = Number(m[1])
    achados.add(n === 7 ? 6 : n - 1)
  }
  return [...achados]
}

const HORA = String.raw`(\d{1,2})\s*(?::|h)\s*(\d{2})?`
const INTERVALO = new RegExp(`${HORA}\\s*(?:às|as|a|-|–|—|até|ate)\\s*${HORA}`, 'i')

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (h: string, m?: string) => `${pad(Number(h))}:${m ?? '00'}`

export function intervaloEm(texto: string): { inicio: string; fim: string; ini: number; fim_: number } | null {
  const m = INTERVALO.exec(texto)
  if (!m) return null
  const inicio = hhmm(m[1], m[2])
  const fim = hhmm(m[3], m[4])
  if (Number(m[1]) > 23 || Number(m[3]) > 23 || minutos(fim) <= minutos(inicio)) return null
  return { inicio, fim, ini: m.index, fim_: m.index + m[0].length }
}

function localEm(texto: string): string | null {
  const m = texto.match(/\b(sala|lab(?:orat[óo]rio)?|bloco|audit[óo]rio)\s*[\w.\-/]+/i)
  return m ? m[0].trim() : null
}

function acharDisciplina(texto: string, grade: DiscDetectada[]): string | null {
  for (const { codigo } of codigosEm(texto)) {
    const d = grade.find((g) => codNorm(g.codigo) === codNorm(codigo))
    if (d) return chaveDe(d)
  }
  const t = normalizar(texto)
  let melhor: DiscDetectada | null = null
  for (const d of grade) {
    const n = normalizar(d.nome)
    if (n.length >= 4 && t.includes(n) && (!melhor || n.length > normalizar(melhor.nome).length)) melhor = d
  }
  return melhor ? chaveDe(melhor) : null
}

/** Texto da linha sem horário/dia/sala, para sobrar só código e nome. */
function limpar(texto: string): string {
  return texto
    .replace(INTERVALO, ' ')
    .replace(/\b(segunda|ter[cç]a|quarta|quinta|sexta|s[áa]bado|domingo)(-feira)?\b/gi, ' ')
    .replace(/\b(seg|ter|qua|qui|sex|s[áa]b|dom)\b\.?/gi, ' ')
    .replace(/\b([2-7])\s*(?:ª|º|a\s*-?\s*feira)(?:\s*-?\s*feira)?/gi, ' ')
    .replace(/\b(sala|lab(?:orat[óo]rio)?|bloco)\s*[\w.\-/]+/gi, ' ')
    .replace(/[\t|;]+/g, ' ')
    .replace(/\s+[eE,/&]\s+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface ResultadoHorarios {
  horarios: HorarioDetectado[]
  /** disciplinas citadas no horário que não existem na grade */
  novas: DiscDetectada[]
  /** códigos do quadro que não pertencem à grade enviada (outro currículo/curso) */
  ignoradas: string[]
}

/** Nome sem acento, sem "(T1)" e sem pontuação, para comparar nomes de grade e de horário. */
export const nomeCanonico = (s: string) =>
  normalizar(s.replace(/\([^)]*\)/g, ' '))
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function horariosDoQuadro(q: QuadroLido, grade: DiscDetectada[]): ResultadoHorarios {
  const res: ResultadoHorarios = { horarios: [], novas: [], ignoradas: [] }
  const porNome = new Map(grade.map((d) => [nomeCanonico(d.nome), d]))
  const ignoradas = new Set<string>()
  for (const e of q.entradas) {
    const leg = q.legenda.get(e.codigo)
    // mesmo código no currículo antigo e no novo; senão tenta pelo nome da disciplina
    const d = grade.find((g) => codNorm(g.codigo) === codNorm(e.codigo)) ?? (leg?.nome ? porNome.get(nomeCanonico(leg.nome)) : undefined)
    if (!d) {
      ignoradas.add(e.codigo)
      continue
    }
    res.horarios.push({ chave: chaveDe(d), dia: e.dia, inicio: e.inicio, fim: e.fim, local: leg?.sala ?? null, turma: e.turma })
  }
  res.ignoradas = [...ignoradas]
  return res
}

function registrar(
  res: ResultadoHorarios,
  grade: DiscDetectada[],
  texto: string,
  dia: number,
  inicio: string,
  fim: string,
  local: string | null,
) {
  const sobra = limpar(texto)
  if (sobra.replace(/[^A-Za-zÀ-ÿ0-9]/g, '').length < 3) return
  let chave = acharDisciplina(sobra, grade) ?? acharDisciplina(sobra, res.novas)
  if (!chave) {
    const cod = codigosEm(sobra)[0]?.codigo ?? ''
    const nome = sobra.replace(cod, '').replace(/^[\s\-–:.]+|[\s\-–:.]+$/g, '').trim() || sobra
    const nova: DiscDetectada = {
      codigo: cod, nome, carga_horaria: 0, periodo: null, tipo: 'obrigatoria', pre_requisitos: [], status: 'pendente', nota_final: null,
    }
    res.novas.push(nova)
    chave = chaveDe(nova)
  }
  res.horarios.push({ chave, dia, inicio, fim, local })
}

/** Junta faixas coladas da mesma matéria no mesmo dia (ex.: 19:00–19:50 + 19:50–20:40). */
function unirFaixas(lista: HorarioDetectado[]): HorarioDetectado[] {
  const ord = [...lista].sort(
    (a, b) => a.chave.localeCompare(b.chave) || (a.turma ?? '').localeCompare(b.turma ?? '') || a.dia - b.dia || minutos(a.inicio) - minutos(b.inicio),
  )
  const res: HorarioDetectado[] = []
  for (const h of ord) {
    const ult = res[res.length - 1]
    if (ult && ult.chave === h.chave && (ult.turma ?? null) === (h.turma ?? null) && ult.dia === h.dia && minutos(h.inicio) - minutos(ult.fim) <= 30 && minutos(h.inicio) >= minutos(ult.inicio)) {
      if (minutos(h.fim) > minutos(ult.fim)) ult.fim = h.fim
      ult.local = ult.local ?? h.local
    } else res.push({ ...h })
  }
  return res
}

function horariosDeGrade(tabela: string[][], grade: DiscDetectada[], res: ResultadoHorarios): boolean {
  const iCab = tabela.findIndex((l) => l.filter((c) => c.length < 25 && diasEm(c).length === 1).length >= 3)
  if (iCab < 0) return false
  const colunas = new Map<number, number>()
  tabela[iCab].forEach((c, i) => {
    const d = c.length < 25 ? diasEm(c) : []
    if (d.length === 1) colunas.set(i, d[0])
  })

  const faixas: { inicio: string; fim: string | null; linha: string[] }[] = []
  for (const linha of tabela.slice(iCab + 1)) {
    const celulaHora = linha.slice(0, 2).find((c) => /\d\s*(:|h)\s*\d{0,2}/i.test(c))
    if (!celulaHora) continue
    const iv = intervaloEm(celulaHora)
    if (iv) faixas.push({ inicio: iv.inicio, fim: iv.fim, linha })
    else {
      const m = celulaHora.match(new RegExp(HORA, 'i'))
      if (m) faixas.push({ inicio: hhmm(m[1], m[2]), fim: null, linha })
    }
  }
  faixas.forEach((f, i) => {
    const fim = f.fim ?? (faixas[i + 1] ? faixas[i + 1].inicio : `${pad(Math.min(23, Math.floor((minutos(f.inicio) + 50) / 60)))}:${pad((minutos(f.inicio) + 50) % 60)}`)
    if (minutos(fim) <= minutos(f.inicio)) return
    for (const [col, dia] of colunas) {
      const celula = f.linha[col]
      if (celula && celula.trim() && celula.trim() !== '-') registrar(res, grade, celula, dia, f.inicio, fim, localEm(celula))
    }
  })
  return res.horarios.length > 0
}

export function extrairHorarios(doc: Documento, grade: DiscDetectada[]): ResultadoHorarios {
  // quadro semanal em PDF (colunas = dias, linhas = faixas): leitor próprio, por posição
  if (doc.paginas) {
    const q = lerQuadroSemanal(doc.paginas)
    if (q) {
      const r = horariosDoQuadro(q, grade)
      r.horarios = unirFaixas(r.horarios)
      return r
    }
  }

  const res: ResultadoHorarios = { horarios: [], novas: [], ignoradas: [] }

  if (!(doc.tabela && horariosDeGrade(doc.tabela, grade, res))) {
    let diaAtual: number | null = null
    let ultimaLinhaComCodigo = ''
    for (const bruta of doc.linhas) {
      const linha = bruta.replace(/\t/g, '  ')
      const iv = intervaloEm(linha)
      const dias = diasEm(linha)
      if (!iv) {
        if (dias.length === 1 && limpar(linha).length < 3) diaAtual = dias[0] // linha só com o dia: "Segunda-feira"
        else if (codigosEm(linha).length) ultimaLinhaComCodigo = linha
        continue
      }
      const alvo = dias.length ? dias : diaAtual != null ? [diaAtual] : []
      if (!alvo.length) continue
      const texto = limpar(linha).length >= 3 ? linha : ultimaLinhaComCodigo
      for (const dia of alvo) registrar(res, grade, texto, dia, iv.inicio, iv.fim, localEm(linha))
    }
  }

  res.horarios = unirFaixas(res.horarios)
  return res
}

// ---------------------------------------------------------------- cruzamento

export interface Sugestao {
  status: Record<string, StatusDisciplina>
  motivo: Record<string, string>
  periodoAtual: number | null
}

/**
 * Sugere o que já foi cursado:
 *  - matérias que aparecem no horário enviado → cursando;
 *  - pré-requisitos (diretos e indiretos) dessas matérias → já cursadas;
 *  - matérias de períodos anteriores ao período atual → já cursadas.
 */
export function cruzar(grade: DiscDetectada[], horarios: HorarioDetectado[]): Sugestao {
  const status: Record<string, StatusDisciplina> = {}
  const motivo: Record<string, string> = {}
  for (const d of grade) status[chaveDe(d)] = d.status

  const porCodigo = new Map(grade.filter((d) => d.codigo).map((d) => [codNorm(d.codigo), d]))
  const cursando = new Set(horarios.map((h) => h.chave).filter((k) => k in status))

  for (const k of cursando) {
    if (status[k] === 'pendente' || status[k] === 'reprovada') {
      status[k] = 'cursando'
      motivo[k] = 'Está no horário que você enviou'
    }
  }

  const marcar = (d: DiscDetectada, porque: string) => {
    const k = chaveDe(d)
    if (status[k] === 'pendente') {
      status[k] = 'aprovada'
      motivo[k] = porque
    }
  }

  const visitadas = new Set<string>()
  const descer = (d: DiscDetectada) => {
    for (const cod of d.pre_requisitos) {
      const pre = porCodigo.get(codNorm(cod))
      if (!pre || visitadas.has(chaveDe(pre))) continue
      visitadas.add(chaveDe(pre))
      marcar(pre, `É pré-requisito de ${d.nome}`)
      descer(pre)
    }
  }
  for (const d of grade) if (cursando.has(chaveDe(d))) descer(d)

  const periodos = grade.filter((d) => cursando.has(chaveDe(d)) && d.periodo != null).map((d) => d.periodo!)
  const periodoAtual = periodos.length ? Math.min(...periodos) : null
  if (periodoAtual != null)
    for (const d of grade) if (d.periodo != null && d.periodo < periodoAtual && d.tipo === 'obrigatoria') marcar(d, `Vem antes do ${periodoAtual}º período`)

  return { status, motivo, periodoAtual }
}
