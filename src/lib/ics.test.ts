import { describe, expect, it } from 'vitest'
import { dobrarLinha, escaparTexto, gerarIcs, lerIcs, primeiraOcorrencia } from './ics'
import type { Horario } from './types'

const hor = (extra: Partial<Horario> = {}): Horario => ({
  id: 'h1', turma_id: null, tipo: 'reuniao', titulo: 'Reunião do TCC', dia_semana: 2, inicio: '13:30:00', fim: '15:00:00', aulas: 1, local: 'Sala 12, bloco B', ...extra,
})
const agora = new Date(Date.UTC(2026, 9, 28, 12, 0, 0))

describe('gerar .ics', () => {
  it('evento semanal vira RRULE até o fim, com horário flutuante', () => {
    const ics = gerarIcs([hor()], { inicio: '2026-10-28', fim: '2026-12-15', agora })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART:20261103T133000') // primeira terça a partir de 28/10/2026
    expect(ics).toContain('DTEND:20261103T150000')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T235959')
    expect(ics).toContain('SUMMARY:Reunião do TCC')
    expect(ics).toContain('LOCATION:Sala 12\\, bloco B')
    expect(ics).toContain('DTSTAMP:20261028T120000Z')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('evento de um dia só não repete e respeita o período', () => {
    const dentro = gerarIcs([hor({ id: 'x', data: '2026-11-10' })], { inicio: '2026-10-28', fim: '2026-12-15', agora })
    expect(dentro).toContain('DTSTART:20261110T133000')
    expect(dentro).not.toContain('RRULE')
    expect(gerarIcs([hor({ id: 'x', data: '2027-02-01' })], { inicio: '2026-10-28', fim: '2026-12-15', agora })).not.toContain('VEVENT')
  })

  it('não devolve para a agenda de origem o que veio dela', () => {
    expect(gerarIcs([hor({ origem_uid: 'abc@google' })], { inicio: '2026-10-28', fim: '2026-12-15', agora })).not.toContain('VEVENT')
  })

  it('escapa texto e quebra linhas longas', () => {
    expect(escaparTexto('a;b,c\nd\\e')).toBe('a\\;b\\,c\\nd\\\\e')
    const longa = dobrarLinha('SUMMARY:' + 'ç'.repeat(80))
    for (const l of longa.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(primeiraOcorrencia('2026-10-28', 3)).toBe('2026-10-28') // 28/10/2026 é quarta
  })
})

const ics = (...eventos: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...eventos, 'END:VCALENDAR'].join('\r\n')
const evento = (...l: string[]) => ['BEGIN:VEVENT', ...l, 'END:VEVENT'].join('\r\n')
const hoje = new Date(2026, 9, 28, 9, 0)

describe('ler .ics', () => {
  it('evento único com TZID: vale a hora escrita', () => {
    const r = lerIcs(ics(evento('UID:a1', 'SUMMARY:Reunião de projeto', 'DTSTART;TZID=America/Sao_Paulo:20261105T140000', 'DTEND;TZID=America/Sao_Paulo:20261105T153000', 'LOCATION:Sala 3')), { hoje })
    expect(r.eventos).toEqual([
      { titulo: 'Reunião de projeto', local: 'Sala 3', data: '2026-11-05', dia_semana: 4, inicio: '14:00', fim: '15:30', origem: 'a1@2026-11-05' },
    ])
  })

  it('horário em UTC (Z) é convertido para o relógio local', () => {
    const r = lerIcs(ics(evento('UID:z', 'SUMMARY:Call', 'DTSTART:20261105T170000Z', 'DTEND:20261105T180000Z')), { hoje })
    const esperado = new Date(Date.UTC(2026, 10, 5, 17, 0))
    expect(r.eventos[0].inicio).toBe(`${String(esperado.getHours()).padStart(2, '0')}:${String(esperado.getMinutes()).padStart(2, '0')}`)
  })

  it('repetição semanal com vários dias vira um evento por dia da semana', () => {
    const r = lerIcs(ics(evento('UID:s', 'SUMMARY:Plantão', 'DTSTART:20261026T080000', 'DTEND:20261026T120000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE')), { hoje })
    expect(r.eventos.map((e) => [e.dia_semana, e.data, e.origem])).toEqual([[1, null, 's#1'], [3, null, 's#3']])
  })

  it('repetição que já acabou não entra; dia inteiro e cancelado são ignorados', () => {
    const r = lerIcs(
      ics(
        evento('UID:o', 'SUMMARY:Velho', 'DTSTART:20250101T080000', 'DTEND:20250101T090000', 'RRULE:FREQ=WEEKLY;UNTIL=20250601T000000Z'),
        evento('UID:d', 'SUMMARY:Feriado', 'DTSTART;VALUE=DATE:20261112'),
        evento('UID:c', 'SUMMARY:Cancelada', 'DTSTART:20261112T100000', 'STATUS:CANCELLED'),
        evento('UID:p', 'SUMMARY:Passado', 'DTSTART:20260101T100000', 'DTEND:20260101T110000'),
      ),
      { hoje },
    )
    expect(r.eventos).toHaveLength(0)
    expect(r.ignorados).toMatchObject({ todoDia: 1, passados: 2 })
  })

  it('repetição a cada 2 semanas e diária com COUNT viram eventos de um dia só', () => {
    const quinzenal = lerIcs(ics(evento('UID:q', 'SUMMARY:Quinzenal', 'DTSTART:20261029T100000', 'DTEND:20261029T110000', 'RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=3')), { hoje })
    expect(quinzenal.eventos.map((e) => e.data)).toEqual(['2026-10-29', '2026-11-12', '2026-11-26'])
    const diario = lerIcs(ics(evento('UID:t', 'SUMMARY:Daily', 'DTSTART:20261028T090000', 'DTEND:20261028T093000', 'RRULE:FREQ=DAILY;COUNT=3')), { hoje })
    expect(diario.eventos.map((e) => e.data)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30'])
  })

  it('une linhas dobradas, desfaz escapes e usa DURATION', () => {
    const texto = 'BEGIN:VEVENT\r\nUID:f\r\nSUMMARY:Reunião\\, com\r\n  espaço\r\nDTSTART:20261105T100000\r\nDURATION:PT1H30M\r\nEND:VEVENT'
    const r = lerIcs(texto, { hoje })
    expect(r.eventos[0]).toMatchObject({ titulo: 'Reunião, com espaço', inicio: '10:00', fim: '11:30' })
  })

  it('o que a gente gera, a gente lê de volta', () => {
    const gerado = gerarIcs([hor({ id: 'r' }), hor({ id: 's', data: '2026-11-10', titulo: 'Defesa' })], { inicio: '2026-10-28', fim: '2026-12-15', agora })
    const lido = lerIcs(gerado, { hoje })
    expect(lido.eventos.map((e) => [e.titulo, e.data, e.inicio, e.fim, e.dia_semana])).toEqual([
      ['Reunião do TCC', null, '13:30', '15:00', 2],
      ['Defesa', '2026-11-10', '13:30', '15:00', 2],
    ])
  })
})
