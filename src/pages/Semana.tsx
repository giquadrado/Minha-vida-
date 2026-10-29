import { useRef, useState } from 'react'
import { useLista, useTabela } from '../lib/db'
import { conflitos, dataBr, dataIso, fmt, hhmm, horasSemanais, intervalosDoDia, minutos } from '../lib/calculos'
import { Botao, Campo, Card, Pagina, Selecao, Selo, lerForm } from '../components/ui'
import { AlinharMaterias } from '../components/AlinharMaterias'
import { AgendaExterna } from '../components/AgendaExterna'
import { DIAS, DIAS_CURTOS, type Horario } from '../lib/types'
import { ORDEM_TIPOS, TIPOS } from '../lib/tipos'
import { dataDoDia, horariosAtivos, horariosDaSemana, inicioDaSemana, irmaos, moverPara, somarDias, turmasSemHorario } from '../lib/semana'

const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]
const PX_HORA = 44

const Chip = ({ ativo, onClick, children, titulo }: { ativo: boolean; onClick: () => void; children: React.ReactNode; titulo?: string }) => (
  <button
    type="button"
    title={titulo}
    aria-pressed={ativo}
    onClick={onClick}
    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition active:scale-95 ${
      ativo ? 'border-indigo-400 bg-indigo-100 text-indigo-900' : 'border-slate-300 text-slate-500 hover:bg-slate-100'
    }`}
  >
    {children}
  </button>
)

export default function Semana() {
  const todosHorarios = useLista('horarios').data ?? []
  const todasTurmas = useLista('turmas').data ?? []
  const ofertas = useLista('ofertas').data ?? []
  const { inserir, atualizar, remover } = useTabela('horarios')

  const [segunda, setSegunda] = useState(() => inicioDaSemana(new Date()))
  const todosAtivos = horariosAtivos(todosHorarios, todasTurmas)
  const recorrentes = todosAtivos.filter((h) => !h.data)
  const horarios = horariosDaSemana(todosAtivos, segunda) // o que vale na semana exibida
  const ocultos = todosHorarios.length - todosAtivos.length
  const turmas = todasTurmas.filter((t) => t.ativa)
  const semAula = turmasSemHorario(todasTurmas, recorrentes)

  const [editando, setEditando] = useState<Horario | 'novo' | null>(null)
  const [tipo, setTipo] = useState<Horario['tipo']>('aula')
  const [modo, setModo] = useState<'semanal' | 'data'>('semanal')
  const [dataEvento, setDataEvento] = useState('')
  const [diasSel, setDiasSel] = useState<number[]>([1])
  const [aplicarIrmaos, setAplicarIrmaos] = useState(true)
  const [erroForm, setErroForm] = useState('')
  const [previa, setPrevia] = useState<{ id: string; dia: number; inicio: string; fim: string } | null>(null)
  const [apagando, setApagando] = useState<Horario | null>(null)
  const colRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const arrasto = useRef<{ id: string; x0: number; y0: number; offY: number; moveu: boolean } | null>(null)

  const emConflito = new Set(conflitos(horarios).flat().map((h) => h.id))
  const inicioGrade = Math.min(7, ...horarios.map((h) => Math.floor(minutos(h.inicio) / 60)))
  const fimGrade = Math.max(23, ...horarios.map((h) => Math.ceil(minutos(h.fim) / 60)))
  const dias = ORDEM_DIAS.filter((d) => d !== 0 || horarios.some((h) => h.dia_semana === 0))
  const hoje = dataIso()
  const outrosHoras = horarios.filter((h) => h.tipo !== 'aula' && h.tipo !== 'trabalho').reduce((s, h) => s + (minutos(h.fim) - minutos(h.inicio)), 0) / 60

  function abrir(h: Horario | 'novo') {
    setEditando(h)
    setErroForm('')
    setTipo(h === 'novo' ? 'aula' : h.tipo)
    setModo(h !== 'novo' && h.data ? 'data' : 'semanal')
    setDataEvento(h !== 'novo' && h.data ? h.data : dataIso(dataDoDia(segunda, 1)))
    setDiasSel(h === 'novo' ? [1] : [h.dia_semana])
    setAplicarIrmaos(true)
  }

  async function apagar(lista: Horario[]) {
    for (const h of lista) await remover.mutateAsync(h.id)
    setApagando(null)
  }

  const alternarDia = (d: number) =>
    setDiasSel((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d].sort((a, b) => ORDEM_DIAS.indexOf(a) - ORDEM_DIAS.indexOf(b))))

  // ---- arrastar um evento para outro dia/horário (mouse ou toque); um clique sem mover abre a edição
  function iniciarArrasto(e: React.PointerEvent<HTMLDivElement>, h: Horario) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    arrasto.current = { id: h.id, x0: e.clientX, y0: e.clientY, offY: e.clientY - e.currentTarget.getBoundingClientRect().top, moveu: false }
  }

  function moverArrasto(e: React.PointerEvent<HTMLDivElement>, h: Horario) {
    const a = arrasto.current
    if (!a || a.id !== h.id) return
    if (!a.moveu && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 6) return
    a.moveu = true
    let dia = h.dia_semana
    let menor = Infinity
    for (const d of dias) {
      const el = colRefs.current[d]
      if (!el) continue
      const r = el.getBoundingClientRect()
      const dist = e.clientX < r.left ? r.left - e.clientX : e.clientX > r.right ? e.clientX - r.right : 0
      if (dist < menor) {
        menor = dist
        dia = d
      }
    }
    const topo = colRefs.current[dia]!.getBoundingClientRect().top
    setPrevia({ id: h.id, ...moverPara(h, dia, inicioGrade * 60 + ((e.clientY - topo - a.offY) / PX_HORA) * 60) })
  }

  function terminarArrasto(h: Horario) {
    const a = arrasto.current
    arrasto.current = null
    if (!a) return
    if (!a.moveu) return abrir(h)
    if (previa && previa.id === h.id && (previa.dia !== h.dia_semana || previa.inicio !== hhmm(h.inicio))) {
      // evento de um dia só muda de data; evento semanal muda o dia da semana
      const nova = h.data ? { data: dataIso(dataDoDia(segunda, previa.dia)) } : {}
      atualizar.mutate({ id: h.id, ...nova, dia_semana: previa.dia, inicio: previa.inicio, fim: previa.fim })
    }
    setPrevia(null)
  }

  function cancelarArrasto() {
    arrasto.current = null
    setPrevia(null)
  }

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    const f = lerForm(e)
    setErroForm('')
    const turma = turmas.find((t) => t.id === f.turma_id)
    const linha = {
      tipo,
      turma_id: tipo === 'aula' ? f.turma_id || null : null,
      titulo: tipo === 'aula' ? turma?.nome ?? f.titulo : f.titulo || TIPOS[tipo].padrao,
      inicio: f.inicio,
      fim: f.fim,
      aulas: Number(f.aulas || 1),
      local: f.local || null,
    }
    if (modo === 'semanal' && !diasSel.length) return setErroForm('Escolha pelo menos um dia da semana.')
    if (modo === 'data' && !dataEvento) return setErroForm('Escolha a data do evento.')
    if (minutos(linha.fim) <= minutos(linha.inicio)) return setErroForm('O horário de fim precisa ser depois do início.')

    try {
      if (modo === 'data') {
        const dia = new Date(`${dataEvento}T12:00:00`).getDay()
        const campos = { ...linha, dia_semana: dia, data: dataEvento }
        if (editando && editando !== 'novo') await atualizar.mutateAsync({ id: editando.id, ...campos })
        else await inserir.mutateAsync(campos)
      } else if (editando && editando !== 'novo') {
        // o evento fica no mesmo dia (se continuar marcado) ou vai para o primeiro dia marcado; os demais dias viram cópias
        const dia = diasSel.includes(editando.dia_semana) ? editando.dia_semana : diasSel[0]
        const limpaData = editando.data ? { data: null } : {} // vinha de um dia só e agora repete toda semana
        const outros = aplicarIrmaos ? irmaos(editando, horarios) : []
        await atualizar.mutateAsync({ id: editando.id, ...linha, ...limpaData, dia_semana: dia })
        for (const o of outros) await atualizar.mutateAsync({ id: o.id, ...linha, dia_semana: o.dia_semana })
        const jaTem = new Set(outros.map((o) => o.dia_semana))
        const novos = diasSel.filter((d) => d !== dia && !jaTem.has(d))
        if (novos.length) await inserir.mutateAsync(novos.map((d) => ({ ...linha, dia_semana: d })))
      } else await inserir.mutateAsync(diasSel.map((d) => ({ ...linha, dia_semana: d })))
      setEditando(null)
    } catch (err) {
      const m = (err as { message?: string }).message ?? String(err)
      setErroForm(`Não consegui salvar (${m}). Se falar de “horarios_tipo_check” ou da coluna “data”, rode o supabase/migracao-4.sql no Supabase.`)
    }
  }

  const atual = editando && editando !== 'novo' ? editando : null
  const semanaTexto = `${dataBr(dataIso(segunda))} – ${dataBr(dataIso(somarDias(segunda, 6)))}`
  const ehEstaSemana = dataIso(segunda) === dataIso(inicioDaSemana(new Date()))

  return (
    <Pagina titulo="Semana" acao={<Botao onClick={() => abrir('novo')}>+ Evento</Botao>}>
      <div className="flex flex-wrap gap-2 text-sm">
        <Selo cor="indigo">Aulas: {fmt(horasSemanais(horarios, 'aula'))} h</Selo>
        <Selo cor="ambar">Trabalho: {fmt(horasSemanais(horarios, 'trabalho'))} h</Selo>
        {outrosHoras > 0 && <Selo cor="verde">Outros: {fmt(outrosHoras)} h</Selo>}
        {emConflito.size > 0 && <Selo cor="vermelho">{conflitos(horarios).length} conflito(s)</Selo>}
        {ocultos > 0 && <Selo>{ocultos} aula(s) de matérias encerradas ocultas</Selo>}
      </div>

      {semAula.length > 0 && (
        <AlinharMaterias
          pendentes={semAula}
          ofertas={ofertas}
          ocupados={recorrentes.map((h) => ({ dia_semana: h.dia_semana, inicio: h.inicio, fim: h.fim, titulo: h.titulo }))}
        />
      )}

      {editando && (
        <Card titulo={atual ? 'Editar evento' : 'Novo evento'}>
          <form key={atual?.id ?? 'novo'} onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
            <Selecao
              rotulo="Tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Horario['tipo'])}
              opcoes={ORDEM_TIPOS.map((t): [string, string] => [t, `${TIPOS[t].icone} ${TIPOS[t].rotulo}`])}
            />
            {tipo === 'aula' ? (
              turmas.length ? (
                <Selecao rotulo="Matéria" name="turma_id" defaultValue={atual?.turma_id ?? ''} opcoes={turmas.map((t) => [t.id, t.nome])} />
              ) : (
                <p className="text-sm text-amber-700">Cadastre primeiro as matérias do semestre em “Matérias”.</p>
              )
            ) : (
              <Campo key={tipo} rotulo="Descrição" name="titulo" required defaultValue={atual && atual.tipo === tipo ? atual.titulo : TIPOS[tipo].padrao} />
            )}

            <div className="sm:col-span-2">
              <div className="mb-1.5 text-sm font-medium text-slate-600">Repetição</div>
              <div className="flex flex-wrap gap-2">
                <Chip ativo={modo === 'semanal'} onClick={() => setModo('semanal')}>🔁 Toda semana</Chip>
                <Chip ativo={modo === 'data'} onClick={() => setModo('data')}>📅 Só em uma data</Chip>
              </div>
            </div>

            {modo === 'data' ? (
              <Campo rotulo="Data" type="date" required value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} />
            ) : (
              <div className="sm:col-span-2">
                <div className="mb-1.5 text-sm font-medium text-slate-600">
                  Dias da semana <span className="font-normal text-slate-500">— marque vários para repetir o evento</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ORDEM_DIAS.map((d) => (
                    <Chip key={d} titulo={DIAS[d]} ativo={diasSel.includes(d)} onClick={() => alternarDia(d)}>
                      {DIAS_CURTOS[d]}
                    </Chip>
                  ))}
                </div>
                {atual && irmaos(atual, horarios).length > 0 && (
                  <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={aplicarIrmaos} onChange={(e) => setAplicarIrmaos(e.target.checked)} />
                    Aplicar também aos outros {irmaos(atual, horarios).length} dia(s) com este mesmo horário ({irmaos(atual, horarios).map((o) => DIAS_CURTOS[o.dia_semana]).join(', ')})
                  </label>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Início" name="inicio" type="time" required defaultValue={atual ? hhmm(atual.inicio) : ''} />
              <Campo rotulo="Fim" name="fim" type="time" required defaultValue={atual ? hhmm(atual.fim) : ''} />
            </div>
            {tipo === 'aula' && (
              <Campo rotulo="Quantas aulas conta na chamada" name="aulas" type="number" min={1} defaultValue={atual?.aulas ?? 2} />
            )}
            <Campo rotulo="Local / sala" name="local" defaultValue={atual?.local ?? ''} />
            {erroForm && <p className="text-sm text-rose-600 sm:col-span-2">{erroForm}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <Botao type="submit">Salvar</Botao>
              <Botao type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
              {atual && (
                <Botao type="button" variante="fantasma" className="ml-auto text-rose-600" onClick={() => { setApagando(atual); setEditando(null) }}>
                  Excluir
                </Botao>
              )}
            </div>
          </form>
        </Card>
      )}

      {apagando && (
        <Card titulo="🗑️ Apagar evento" className="border-rose-500/40">
          <p className="mb-3 text-sm">
            Apagar <b>{apagando.titulo}</b> de {apagando.data ? dataBr(apagando.data) : DIAS[apagando.dia_semana]}, {hhmm(apagando.inicio)}–{hhmm(apagando.fim)}?
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao variante="perigo" onClick={() => apagar([apagando])}>
              {irmaos(apagando, horarios).length ? 'Só este dia' : 'Apagar'}
            </Botao>
            {irmaos(apagando, horarios).length > 0 && (
              <Botao variante="perigo" onClick={() => apagar([apagando, ...irmaos(apagando, horarios)])}>
                Todos os dias iguais ({irmaos(apagando, horarios).length + 1}: {[apagando, ...irmaos(apagando, horarios)].map((x) => DIAS_CURTOS[x.dia_semana]).join(', ')})
              </Botao>
            )}
            <Botao variante="secundario" onClick={() => setApagando(null)}>Cancelar</Botao>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="secundario" className="px-3" onClick={() => setSegunda(somarDias(segunda, -7))} aria-label="Semana anterior">‹</Botao>
        <Botao variante="secundario" className="px-3" onClick={() => setSegunda(somarDias(segunda, 7))} aria-label="Próxima semana">›</Botao>
        <span className="text-sm font-semibold">{semanaTexto}</span>
        {ehEstaSemana ? <Selo cor="verde">esta semana</Selo> : <Botao variante="fantasma" className="px-2 py-1 text-xs" onClick={() => setSegunda(inicioDaSemana(new Date()))}>Voltar para hoje</Botao>}
      </div>

      <Card className="overflow-x-auto p-2">
        <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `40px repeat(${dias.length}, 1fr)` }}>
          <div />
          {dias.map((d) => {
            const data = dataDoDia(segunda, d)
            const ehHoje = dataIso(data) === hoje
            return (
              <div key={d} className={`pb-2 text-center text-xs font-medium ${ehHoje ? 'text-indigo-700' : 'text-slate-600'}`}>
                {DIAS_CURTOS[d]} <span className={ehHoje ? 'rounded-full bg-indigo-600 px-1.5 py-0.5 text-white' : 'text-slate-400'}>{data.getDate()}</span>
              </div>
            )
          })}
          <div className="relative" style={{ height: (fimGrade - inicioGrade) * PX_HORA }}>
            {Array.from({ length: fimGrade - inicioGrade }, (_, i) => (
              <div key={i} className="absolute right-1 text-[10px] text-slate-400" style={{ top: i * PX_HORA - 6 }}>
                {inicioGrade + i}h
              </div>
            ))}
          </div>
          {dias.map((d) => (
            <div
              key={d}
              ref={(el) => { colRefs.current[d] = el }}
              className={`relative border-l border-slate-100 ${dataIso(dataDoDia(segunda, d)) === hoje ? 'bg-indigo-50' : ''}`}
              style={{ height: (fimGrade - inicioGrade) * PX_HORA }}
            >
              {Array.from({ length: fimGrade - inicioGrade }, (_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-slate-100" style={{ top: i * PX_HORA }} />
              ))}
              {horarios
                .map((h) => (previa && previa.id === h.id ? { ...h, dia_semana: previa.dia, inicio: previa.inicio, fim: previa.fim } : h))
                .filter((h) => h.dia_semana === d)
                .map((h) => {
                  const original = horarios.find((x) => x.id === h.id)!
                  const top = ((minutos(h.inicio) - inicioGrade * 60) / 60) * PX_HORA
                  const alt = ((minutos(h.fim) - minutos(h.inicio)) / 60) * PX_HORA
                  const arrastando = previa?.id === h.id
                  return (
                    <div
                      key={h.id}
                      role="button"
                      tabIndex={0}
                      title="Clique para editar · arraste para mudar de dia ou horário"
                      onPointerDown={(e) => iniciarArrasto(e, original)}
                      onPointerMove={(e) => moverArrasto(e, original)}
                      onPointerUp={() => terminarArrasto(original)}
                      onPointerCancel={cancelarArrasto}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          abrir(original)
                        } else if (e.key === 'Delete' || e.key === 'Backspace') {
                          e.preventDefault()
                          setApagando(original)
                        }
                      }}
                      className={`group absolute inset-x-0.5 cursor-grab select-none overflow-hidden rounded-md border-l-4 px-1 text-left text-[11px] leading-tight transition-shadow ${TIPOS[h.tipo].cor} ${emConflito.has(h.id) ? 'ring-2 ring-rose-500' : ''} ${arrastando ? 'z-20 cursor-grabbing opacity-90 shadow-xl ring-2 ring-indigo-400' : ''}`}
                      style={{ top, height: Math.max(alt, 18), touchAction: 'none' }}
                    >
                      <button
                        type="button"
                        aria-label={`Apagar ${h.titulo}`}
                        title="Apagar este evento"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          setApagando(original)
                        }}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded bg-black/40 text-[10px] leading-none text-white opacity-0 transition hover:bg-rose-600 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-80"
                      >
                        ✕
                      </button>
                      <b>{TIPOS[h.tipo].icone} {h.titulo}</b>
                      <div>{h.data && '📅 '}{hhmm(h.inicio)}–{hhmm(h.fim)}</div>
                      {h.local && <div className="opacity-70">{h.local}</div>}
                    </div>
                  )
                })}
            </div>
          ))}
        </div>
      </Card>

      <Card titulo="Intervalos entre compromissos">
        <ul className="space-y-1 text-sm">
          {ORDEM_DIAS.flatMap((d) =>
            intervalosDoDia(horarios, d).map((g, i) => (
              <li key={`${d}-${i}`} className="flex justify-between gap-2">
                <span>
                  {DIAS_CURTOS[d]}: {g.depois.titulo} → {g.antes.titulo}
                </span>
                <Selo cor={g.minutos < 30 ? 'vermelho' : g.minutos < 60 ? 'ambar' : 'verde'}>
                  {g.minutos >= 60 ? `${fmt(g.minutos / 60)} h` : `${g.minutos} min`}
                </Selo>
              </li>
            )),
          )}
        </ul>
        <p className="mt-2 text-xs text-slate-500">Vermelho = menos de 30 min para se deslocar entre um compromisso e outro.</p>
      </Card>

      <AgendaExterna horarios={todosAtivos} />
    </Pagina>
  )
}
