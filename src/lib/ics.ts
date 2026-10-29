/**
 * Arquivos de agenda (.ics, formato iCalendar) para trocar eventos com Google Agenda e Outlook.
 * Sem dependências do navegador: também roda na função do servidor que publica o link de assinatura.
 */
import type { Horario, TipoHorario } from './types'

const CRLF = '\r\n'
const DIAS_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const ROTULO_TIPO: Record<TipoHorario, string> = {
  aula: 'Aula', trabalho: 'Trabalho', reuniao: 'Reunião', estudo: 'Estudo', pessoal: 'Compromisso pessoal', outro: 'Outro',
}

const p2 = (n: number) => String(n).padStart(2, '0')
const hhmm = (s: string) => s.slice(0, 5)
const minutosDe = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))

export const escaparTexto = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const desescapar = (s: string) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1')

/** Quebra linhas com mais de 75 bytes, como exige o formato (continuação começa com espaço). */
export function dobrarLinha(linha: string): string {
  const enc = new TextEncoder()
  const partes: string[] = []
  let atual = ''
  let bytes = 0
  for (const ch of linha) {
    const b = enc.encode(ch).length
    if (bytes + b > 75) {
      partes.push(atual)
      atual = ' ' + ch
      bytes = 1 + b
    } else {
      atual += ch
      bytes += b
    }
  }
  partes.push(atual)
  return partes.join(CRLF)
}

const dataSemTracos = (iso: string) => iso.replace(/-/g, '')
const flutuante = (iso: string, hora: string) => `${dataSemTracos(iso)}T${hora.replace(':', '')}00`
const carimboUtc = (d: Date) =>
  `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`

const isoLocal = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

/** Primeiro dia, a partir de `inicioIso`, que cai no dia da semana pedido. */
export function primeiraOcorrencia(inicioIso: string, diaSemana: number): string {
  const d = new Date(`${inicioIso}T12:00:00`)
  while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1)
  return isoLocal(d)
}

export interface OpcoesIcs {
  /** primeiro dia coberto (AAAA-MM-DD) */
  inicio: string
  /** último dia coberto (AAAA-MM-DD): eventos semanais terminam aqui */
  fim: string
  nome?: string
  agora?: Date
  /** inclui eventos que vieram de outra agenda (padrão: não, para não duplicar lá) */
  incluirImportados?: boolean
}

/**
 * Gera o calendário. Horários ficam "flutuantes" (sem fuso): aparecem na mesma hora do relógio
 * em qualquer agenda e fuso. Eventos semanais viram um evento com repetição até `fim`.
 */
export function gerarIcs(horarios: Horario[], op: OpcoesIcs): string {
  const carimbo = carimboUtc(op.agora ?? new Date())
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Minha Faculdade//PT-BR//',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escaparTexto(op.nome ?? 'Minha Faculdade')}`,
  ]

  for (const h of horarios) {
    if (h.origem_uid && !op.incluirImportados) continue
    const ini = hhmm(h.inicio)
    const fim = hhmm(h.fim)
    if (minutosDe(fim) <= minutosDe(ini)) continue

    let dia: string
    let repete: string | null = null
    if (h.data) {
      if (h.data < op.inicio || h.data > op.fim) continue
      dia = h.data
    } else {
      dia = primeiraOcorrencia(op.inicio, h.dia_semana)
      if (dia > op.fim) continue
      repete = `RRULE:FREQ=WEEKLY;BYDAY=${DIAS_ICS[h.dia_semana]};UNTIL=${dataSemTracos(op.fim)}T235959`
    }

    linhas.push(
      'BEGIN:VEVENT',
      `UID:${h.id}${h.data ? `-${h.data}` : ''}@minha-faculdade`,
      `DTSTAMP:${carimbo}`,
      `DTSTART:${flutuante(dia, ini)}`,
      `DTEND:${flutuante(dia, fim)}`,
    )
    if (repete) linhas.push(repete)
    linhas.push(`SUMMARY:${escaparTexto(h.titulo || ROTULO_TIPO[h.tipo])}`)
    if (h.local) linhas.push(`LOCATION:${escaparTexto(h.local)}`)
    linhas.push(`DESCRIPTION:${escaparTexto(ROTULO_TIPO[h.tipo])} — Minha Faculdade`, `CATEGORIES:${escaparTexto(ROTULO_TIPO[h.tipo])}`, 'END:VEVENT')
  }
  linhas.push('END:VCALENDAR')
  return linhas.map(dobrarLinha).join(CRLF) + CRLF
}

// ---------------------------------------------------------------- leitura

export interface EventoIcs {
  titulo: string
  local: string | null
  dia_semana: number
  inicio: string
  fim: string
  /** preenchida = evento de um dia só; null = repete toda semana */
  data: string | null
  /** identificador estável do evento (e do dia/data), para não duplicar ao importar de novo */
  origem: string
}

export interface ResultadoIcs {
  eventos: EventoIcs[]
  ignorados: { todoDia: number; invalidos: number; passados: number }
}

interface Instante {
  data: string
  min: number
}

function lerInstante(valor: string, params: string): Instante | 'todoDia' | null {
  if (/VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(valor)) return 'todoDia'
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!m) return null
  const [, a, mes, d, h, mi, s, z] = m
  if (z) {
    // horário universal: converte para o relógio de quem importa
    const dt = new Date(Date.UTC(+a, +mes - 1, +d, +h, +mi, +(s ?? 0)))
    return { data: isoLocal(dt), min: dt.getHours() * 60 + dt.getMinutes() }
  }
  // com TZID ou sem fuso: vale a hora do relógio como está escrita
  return { data: `${a}-${mes}-${d}`, min: +h * 60 + +mi }
}

const horaDe = (min: number) => `${p2(Math.floor(min / 60))}:${p2(min % 60)}`
const diaDaSemana = (iso: string) => new Date(`${iso}T12:00:00`).getDay()
const somarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return isoLocal(d)
}

function duracaoEmMinutos(v: string): number | null {
  const m = v.match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/)
  if (!m) return null
  return (+(m[1] ?? 0) * 7 + +(m[2] ?? 0)) * 1440 + +(m[3] ?? 0) * 60 + +(m[4] ?? 0)
}

const MAX_OCORRENCIAS = 150

/** Datas de uma repetição que não é "toda semana": diária, a cada N semanas, mensal, anual ou com COUNT. */
function expandir(inicioIso: string, regra: Record<string, string>, de: string, ate: string): string[] {
  const freq = regra.FREQ
  const intervalo = Math.max(1, Number(regra.INTERVAL ?? 1))
  const limite = regra.COUNT ? Number(regra.COUNT) : Infinity
  const fimRegra = regra.UNTIL ? `${regra.UNTIL.slice(0, 4)}-${regra.UNTIL.slice(4, 6)}-${regra.UNTIL.slice(6, 8)}` : null
  const dias = (regra.BYDAY ?? '').split(',').map((x) => DIAS_ICS.indexOf(x.slice(-2))).filter((x) => x >= 0)
  const saida: string[] = []
  let contadas = 0

  const aceitar = (iso: string) => {
    if (contadas >= limite || (fimRegra && iso > fimRegra) || iso > ate) return false
    contadas++
    if (iso >= de && saida.length < MAX_OCORRENCIAS) saida.push(iso)
    return true
  }

  if (freq === 'DAILY') {
    for (let i = 0, d = inicioIso; i < 4000; i++, d = somarDias(d, intervalo)) if (!aceitar(d)) break
  } else if (freq === 'WEEKLY') {
    const alvo = dias.length ? dias : [diaDaSemana(inicioIso)]
    // semana de referência começa na segunda da semana do início
    let segunda = somarDias(inicioIso, -((diaDaSemana(inicioIso) + 6) % 7))
    for (let s = 0; s < 800; s++, segunda = somarDias(segunda, 7 * intervalo)) {
      let parou = false
      for (const dia of [...alvo].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const iso = somarDias(segunda, (dia + 6) % 7)
        if (iso < inicioIso) continue
        if (!aceitar(iso)) {
          parou = true
          break
        }
      }
      if (parou) break
    }
  } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
    const base = new Date(`${inicioIso}T12:00:00`)
    for (let i = 0; i < 600; i++) {
      const d = new Date(base.getFullYear() + (freq === 'YEARLY' ? i * intervalo : 0), base.getMonth() + (freq === 'MONTHLY' ? i * intervalo : 0), base.getDate(), 12)
      if (d.getDate() !== base.getDate()) continue // mês sem esse dia (ex.: 31)
      if (!aceitar(isoLocal(d))) break
    }
  }
  return saida
}

/**
 * Lê eventos de um .ics exportado do Google Agenda ou do Outlook.
 *  - repetição semanal simples vira evento que repete toda semana;
 *  - qualquer outra repetição vira eventos de um dia só (próximos 90 dias, no máximo 150);
 *  - eventos de dia inteiro e exceções de série (EXDATE/RECURRENCE-ID) não são importados.
 */
export function lerIcs(texto: string, opcoes: { hoje?: Date; diasAFrente?: number } = {}): ResultadoIcs {
  const hojeData = opcoes.hoje ?? new Date()
  const hoje = isoLocal(hojeData)
  const limite = somarDias(hoje, opcoes.diasAFrente ?? 90)
  const res: ResultadoIcs = { eventos: [], ignorados: { todoDia: 0, invalidos: 0, passados: 0 } }

  const linhas = texto.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  let atual: { nome: string; params: string; valor: string }[] | null = null
  const blocos: { nome: string; params: string; valor: string }[][] = []
  for (const l of linhas) {
    if (/^BEGIN:VEVENT/i.test(l)) atual = []
    else if (/^END:VEVENT/i.test(l)) {
      if (atual) blocos.push(atual)
      atual = null
    } else if (atual && l.includes(':')) {
      const dois = l.indexOf(':')
      const [nome, ...params] = l.slice(0, dois).split(';')
      atual.push({ nome: nome.toUpperCase(), params: params.join(';'), valor: l.slice(dois + 1) })
    }
  }

  for (const campos of blocos) {
    const get = (n: string) => campos.find((c) => c.nome === n)
    if (get('RECURRENCE-ID') || /CANCELLED/i.test(get('STATUS')?.valor ?? '')) continue
    const ini = get('DTSTART')
    if (!ini) {
      res.ignorados.invalidos++
      continue
    }
    const inicio = lerInstante(ini.valor, ini.params)
    if (inicio === 'todoDia') {
      res.ignorados.todoDia++
      continue
    }
    if (!inicio) {
      res.ignorados.invalidos++
      continue
    }
    const titulo = desescapar(get('SUMMARY')?.valor ?? '').trim() || 'Evento'
    const local = desescapar(get('LOCATION')?.valor ?? '').trim() || null

    let fimMin = inicio.min + 60
    let fimNoMesmoDia = true
    const fim = get('DTEND')
    if (fim) {
      const f = lerInstante(fim.valor, fim.params)
      if (f && f !== 'todoDia') {
        fimNoMesmoDia = f.data === inicio.data
        fimMin = fimNoMesmoDia ? f.min : 24 * 60 - 1
      }
    } else if (get('DURATION')) fimMin = inicio.min + (duracaoEmMinutos(get('DURATION')!.valor) ?? 60)
    fimMin = Math.min(24 * 60 - 1, fimMin)
    if (fimMin <= inicio.min) fimMin = Math.min(24 * 60 - 1, inicio.min + 60)

    const uid = get('UID')?.valor.trim() || `${titulo}-${inicio.data}-${inicio.min}`
    const base = { titulo, local, inicio: horaDe(inicio.min), fim: horaDe(fimMin) }
    const um = (data: string): EventoIcs => ({ ...base, data, dia_semana: diaDaSemana(data), origem: `${uid}@${data}` })

    const rr = get('RRULE')
    if (!rr) {
      if (inicio.data < hoje) res.ignorados.passados++
      else res.eventos.push(um(inicio.data))
      continue
    }

    const regra = Object.fromEntries(rr.valor.split(';').map((p) => p.split('=') as [string, string]))
    const semanalSimples = regra.FREQ === 'WEEKLY' && Number(regra.INTERVAL ?? 1) === 1 && !regra.COUNT
    if (semanalSimples) {
      const fimRegra = regra.UNTIL ? `${regra.UNTIL.slice(0, 4)}-${regra.UNTIL.slice(4, 6)}-${regra.UNTIL.slice(6, 8)}` : null
      if (fimRegra && fimRegra < hoje) {
        res.ignorados.passados++
        continue
      }
      const dias = (regra.BYDAY ?? '').split(',').map((x) => DIAS_ICS.indexOf(x.slice(-2))).filter((x) => x >= 0)
      for (const dia of dias.length ? dias : [diaDaSemana(inicio.data)])
        res.eventos.push({ ...base, data: null, dia_semana: dia, origem: `${uid}#${dia}` })
      continue
    }

    const datas = expandir(inicio.data, regra, hoje, limite)
    if (!datas.length) res.ignorados.passados++
    for (const d of datas) res.eventos.push(um(d))
  }
  return res
}
