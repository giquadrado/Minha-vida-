import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useCurso, useLista } from '../lib/db'
import { supabase } from '../lib/supabase'
import { documentoDeTexto, lerDocumento, type Documento } from '../lib/documentos'
import { chaveDe, cruzar, extrairGrade, extrairHorarios, extrairRegrasDoc, type DiscDetectada, type HorarioDetectado } from '../lib/analise'
import type { RegrasCurso } from '../lib/leitores'
import { casar, lerLista } from '../lib/lista'
import { fmt, hhmm, minutos, semestreAtual } from '../lib/calculos'
import { Anel, Botao, Card, Confete, Numero, Selo } from '../components/ui'
import { DIAS_CURTOS, type StatusDisciplina } from '../lib/types'

type Etapa = 'enviar' | 'conferir' | 'marcar' | 'pronto'
const ETAPAS: [Etapa, string][] = [
  ['enviar', 'Enviar'],
  ['conferir', 'Conferir'],
  ['marcar', 'O que já fiz'],
]

function Passos({ atual }: { atual: Etapa }) {
  const i = atual === 'pronto' ? 3 : ETAPAS.findIndex(([e]) => e === atual)
  return (
    <ol className="mb-5 flex items-center gap-2 text-xs font-medium">
      {ETAPAS.map(([e, t], n) => (
        <li key={e} className="flex flex-1 items-center gap-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
              n < i ? 'bg-emerald-500 text-slate-900' : n === i ? 'animate-pulsar bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {n < i ? '✓' : n + 1}
          </span>
          <span className={n <= i ? 'text-slate-800' : 'text-slate-500'}>{t}</span>
          {n < ETAPAS.length - 1 && <span className={`h-px flex-1 transition-colors duration-500 ${n < i ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
        </li>
      ))}
    </ol>
  )
}

function Envio({
  icone, titulo, dica, obrigatorio, doc, onDoc, onErro,
}: {
  icone: string
  titulo: string
  dica: string
  obrigatorio?: boolean
  doc: Documento | null
  onDoc: (d: Documento | null) => void
  onErro: (m: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [sobre, setSobre] = useState(false)
  const [lendo, setLendo] = useState(false)
  const [colar, setColar] = useState(false)

  async function abrir(f: File | undefined) {
    if (!f) return
    setLendo(true)
    onErro('')
    try {
      onDoc(await lerDocumento(f))
    } catch (e) {
      onErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLendo(false)
    }
  }

  return (
    <Card className={`flex flex-col ${doc ? 'border-emerald-500/40' : ''}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl">{icone}</span>
        <h2 className="font-bold">{titulo}</h2>
        {obrigatorio ? <Selo cor="indigo">necessário</Selo> : <Selo>opcional</Selo>}
      </div>

      {doc ? (
        <div className="animate-subir flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-50 p-5 text-center">
          <div className="text-3xl">✅</div>
          <div className="max-w-full truncate text-sm font-semibold">{doc.nome}</div>
          <div className="text-xs text-slate-500">{doc.linhas.length} linhas lidas</div>
          <Botao variante="fantasma" className="mt-1 px-2 py-1 text-xs" onClick={() => onDoc(null)}>Trocar arquivo</Botao>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setSobre(true) }}
          onDragLeave={() => setSobre(false)}
          onDrop={(e) => { e.preventDefault(); setSobre(false); abrir(e.dataTransfer.files[0]) }}
          className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 ${
            sobre ? 'scale-[1.02] border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
          }`}
        >
          <div className={`text-4xl ${lendo ? 'animate-pulse' : 'animate-flutuar'}`}>{lendo ? '🔎' : '📄'}</div>
          <div className="text-sm font-semibold">{lendo ? 'Lendo o documento…' : 'Arraste o arquivo aqui ou toque para escolher'}</div>
          <div className="text-xs text-slate-500">{dica}</div>
          <input ref={input} type="file" hidden accept=".pdf,.xlsx,.xls,.ods,.csv,.txt" onChange={(e) => abrir(e.target.files?.[0])} />
        </div>
      )}

      {!doc && (
        <div className="mt-3">
          <button className="text-xs text-indigo-700 underline" onClick={() => setColar(!colar)}>
            {colar ? 'Fechar' : 'Ou cole o texto aqui'}
          </button>
          {colar && (
            <textarea
              rows={5}
              placeholder="Cole o conteúdo copiado do PDF ou do site da faculdade…"
              className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm"
              onBlur={(e) => e.target.value.trim() && onDoc(documentoDeTexto('texto colado', e.target.value))}
            />
          )}
        </div>
      )}
    </Card>
  )
}

/** "ENGENHARIA MECATRÔNICA" -> "Engenharia Mecatrônica" */
function nomeDoCurso(n: string | null): string | null {
  if (!n) return null
  return n.toLowerCase().replace(/(^|\s)(\S)/g, (_, a: string, b: string) => a + b.toUpperCase()).replace(/\s(D[aeo]s?|E)\s/g, (m) => m.toLowerCase())
}

export default function Importar() {
  const qc = useQueryClient()
  const existentes = useLista('disciplinas').data ?? []
  const turmasExistentes = useLista('turmas').data ?? []

  const [etapa, setEtapa] = useState<Etapa>('enviar')
  const [docGrade, setDocGrade] = useState<Documento | null>(null)
  const [docHorario, setDocHorario] = useState<Documento | null>(null)
  const [erro, setErro] = useState('')
  const [analisando, setAnalisando] = useState('')

  const [grade, setGrade] = useState<DiscDetectada[]>([])
  const [horarios, setHorarios] = useState<HorarioDetectado[]>([])
  const [status, setStatus] = useState<Record<string, StatusDisciplina>>({})
  const [motivo, setMotivo] = useState<Record<string, string>>({})
  const [sugeridas, setSugeridas] = useState<Set<string>>(new Set())
  const [dica, setDica] = useState('')
  const [substituir, setSubstituir] = useState(false)
  const [modo, setModo] = useState<'meu' | 'oferta'>('meu')
  const [aviso, setAviso] = useState('')
  const [regras, setRegras] = useState<RegrasCurso | null>(null)
  const [aplicarRegras, setAplicarRegras] = useState(true)
  const [ignoradas, setIgnoradas] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [listaTexto, setListaTexto] = useState('')
  const [listaMsg, setListaMsg] = useState('')
  const [zerarResto, setZerarResto] = useState(true)
  const curso = useCurso()
  const [resumoFinal, setResumoFinal] = useState({ disciplinas: 0, aulas: 0 })

  const espera = (ms = 450) => new Promise((r) => setTimeout(r, ms))

  async function analisar() {
    if (!docGrade) return
    setErro('')
    try {
      setAnalisando('Lendo a sua grade curricular…')
      await espera()
      const g = extrairGrade(docGrade)
      if (!g.length) throw new Error('Não consegui identificar disciplinas nesse documento. Confira se é o PDF/planilha da grade (com códigos e nomes) ou cole o texto.')

      setRegras(extrairRegrasDoc(docGrade))
      let h: HorarioDetectado[] = []
      let todas = g
      setIgnoradas([])
      if (docHorario) {
        setAnalisando('Procurando suas aulas nos horários…')
        await espera()
        const r = extrairHorarios(docHorario, g)
        h = r.horarios
        todas = [...g, ...r.novas]
        setIgnoradas(r.ignoradas)
      }

      setAnalisando('Cruzando os dois documentos…')
      await espera()
      // quadro com várias turmas/períodos = oferta da faculdade, não as aulas de uma pessoa só
      const periodosNoHorario = new Set(h.map((x) => todas.find((d) => chaveDe(d) === x.chave)?.periodo).filter((p) => p != null))
      const m = periodosNoHorario.size >= 3 ? 'oferta' : 'meu'
      setModo(m)
      const s = cruzar(todas, m === 'meu' ? h : [])
      setGrade(todas)
      setHorarios(h)
      setStatus(s.status)
      setMotivo(s.motivo)
      setSugeridas(new Set(Object.keys(s.motivo)))
      setEtapa('conferir')
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setAnalisando('')
    }
  }

  const porChave = useMemo(() => new Map(grade.map((d) => [chaveDe(d), d])), [grade])
  const porCodigo = useMemo(() => new Map(grade.filter((d) => d.codigo).map((d) => [d.codigo.replace(/\s/g, '').toLowerCase(), d])), [grade])
  const noHorario = useMemo(() => new Set(horarios.map((h) => h.chave)), [horarios])

  function trocarModo(m: 'meu' | 'oferta') {
    setModo(m)
    const s = cruzar(grade, m === 'meu' ? horarios : [])
    setStatus(s.status)
    setMotivo(s.motivo)
    setSugeridas(new Set(Object.keys(s.motivo)))
  }

  function preRequisitosDe(d: DiscDetectada, vistos = new Set<string>()): DiscDetectada[] {
    const res: DiscDetectada[] = []
    for (const c of d.pre_requisitos) {
      const p = porCodigo.get(c.replace(/\s/g, '').toLowerCase())
      if (!p || vistos.has(chaveDe(p))) continue
      vistos.add(chaveDe(p))
      res.push(p, ...preRequisitosDe(p, vistos))
    }
    return res
  }

  function alternarFeita(d: DiscDetectada) {
    const k = chaveDe(d)
    const novo = { ...status }
    if (status[k] === 'aprovada' || status[k] === 'dispensada') {
      novo[k] = noHorario.has(k) && modo === 'meu' ? 'cursando' : 'pendente'
      setDica('')
    } else {
      novo[k] = 'aprovada'
      const extras = preRequisitosDe(d).filter((p) => novo[chaveDe(p)] !== 'aprovada' && novo[chaveDe(p)] !== 'dispensada')
      extras.forEach((p) => (novo[chaveDe(p)] = 'aprovada'))
      setDica(extras.length ? `Também marquei ${extras.length} pré-requisito(s) de ${d.nome} 💡` : '')
    }
    setStatus(novo)
  }

  function alternarCursando(d: DiscDetectada) {
    const k = chaveDe(d)
    setStatus({ ...status, [k]: status[k] === 'cursando' ? 'pendente' : 'cursando' })
  }

  function aplicarLista() {
    const { aplicar, naoReconhecidas } = casar(lerLista(listaTexto), grade)
    const novo = { ...status }
    if (zerarResto) for (const d of grade) if (novo[chaveDe(d)] !== 'cursando') novo[chaveDe(d)] = 'pendente'
    for (const [k, s] of aplicar) novo[k] = s
    setStatus(novo)
    setDica('')
    setListaMsg(
      `Reconheci ${aplicar.size} matéria(s).` + (naoReconhecidas.length ? ` Não reconheci: ${naoReconhecidas.join('; ')}.` : ' Tudo certo! ✅'),
    )
  }

  /** "Estou no Nº período": obrigatórias anteriores ficam como feitas; as demais voltam a pendentes. */
  function marcarAtePeriodo(n: number) {
    const novo = { ...status }
    for (const d of grade) {
      if (d.tipo !== 'obrigatoria' || d.periodo == null || novo[chaveDe(d)] === 'cursando') continue
      novo[chaveDe(d)] = d.periodo < n ? 'aprovada' : 'pendente'
    }
    setStatus(novo)
    setDica(`Marquei as obrigatórias anteriores ao ${n}º período como feitas 💡`)
  }

  function marcarPeriodo(periodo: number | null, feito: boolean) {
    const novo = { ...status }
    for (const d of grade)
      if (d.periodo === periodo && novo[chaveDe(d)] !== 'cursando') novo[chaveDe(d)] = feito ? 'aprovada' : 'pendente'
    setStatus(novo)
  }

  const periodos = useMemo(() => [...new Set(grade.map((d) => d.periodo))].sort((a, b) => (a ?? 99) - (b ?? 99)), [grade])
  const feitas = grade.filter((d) => status[chaveDe(d)] === 'aprovada' || status[chaveDe(d)] === 'dispensada')
  const cursando = grade.filter((d) => status[chaveDe(d)] === 'cursando')
  const horasFeitas = feitas.reduce((s, d) => s + d.carga_horaria, 0)
  const horasObrig = grade.filter((d) => d.tipo === 'obrigatoria').reduce((s, d) => s + d.carga_horaria, 0)
  const progressoObrig = horasObrig
    ? feitas.filter((d) => d.tipo === 'obrigatoria').reduce((s, d) => s + d.carga_horaria, 0) / horasObrig
    : grade.length
      ? feitas.length / grade.length
      : 0

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      if (substituir && existentes.length) {
        const { error } = await supabase.from('disciplinas').delete().in('id', existentes.map((d) => d.id))
        if (error) throw error
      }
      const base = substituir ? [] : existentes.map((d) => chaveDe(d))
      const novas = grade.filter((d) => !base.includes(chaveDe(d)))
      const linhas = novas.map((d) => ({ ...d, status: status[chaveDe(d)] ?? 'pendente' }))
      const { data: ins, error } = await supabase.from('disciplinas').insert(linhas).select('id')
      if (error) throw error
      const idPorChave = new Map<string, string>(novas.map((d, i) => [chaveDe(d), ins![i].id]))
      for (const d of existentes) if (!substituir) idPorChave.set(chaveDe(d), d.id)

      // quadro de ofertas tem várias turmas por matéria: a turma do aluno é escolhida depois (Montar semestre)
      // toda matéria "cursando" vira matéria do semestre (os horários só entram quando o documento é o horário do aluno)
      const turmasNovas = cursando.filter((d) => !turmasExistentes.some((t) => t.ativa && t.nome === d.nome))
      let aulas = 0
      if (turmasNovas.length) {
        const semestre = semestreAtual()
        const { data: ts, error: e2 } = await supabase
          .from('turmas')
          .insert(turmasNovas.map((d) => ({ disciplina_id: idPorChave.get(chaveDe(d)) ?? null, nome: d.nome, semestre, total_aulas: d.carga_horaria, ativa: true })))
          .select('id')
        if (e2) throw e2
        const linhasH = turmasNovas.flatMap((d, i) =>
          (modo === 'oferta' ? [] : horarios)
            .filter((h) => h.chave === chaveDe(d))
            .map((h) => ({
              turma_id: ts![i].id, tipo: 'aula', titulo: d.nome, dia_semana: h.dia, inicio: h.inicio, fim: h.fim,
              aulas: Math.max(1, Math.round((minutos(h.fim) - minutos(h.inicio)) / 50)), local: h.local,
            })),
        )
        if (linhasH.length) {
          const { error: e3 } = await supabase.from('horarios').insert(linhasH)
          if (e3) throw e3
        }
        aulas = linhasH.length
      }

      setAviso('')
      if (modo === 'oferta' && horarios.length) {
        const { error: e4 } = await supabase.from('ofertas').delete().not('id', 'is', null)
        const { error: e5 } = e4
          ? { error: e4 }
          : await supabase.from('ofertas').insert(
              horarios.map((h) => {
                const d = porChave.get(h.chave)
                return { disciplina_id: idPorChave.get(h.chave) ?? null, codigo: d?.codigo ?? '', nome: d?.nome ?? h.chave, dia_semana: h.dia, inicio: h.inicio, fim: h.fim, local: h.local, turma: h.turma ?? null }
              }),
            )
        if (e5) setAviso('Guardei a grade, mas não consegui guardar o quadro de ofertas. Rode o arquivo supabase/migracao-2.sql no Supabase e importe de novo para liberar as sugestões de semestre.')
      }

      if (regras && aplicarRegras) {
        const { error: e6 } = await supabase.from('cursos').upsert(
          {
            ...(curso.id ? { id: curso.id } : {}),
            nome: nomeDoCurso(regras.nome) ?? curso.nome,
            carga_obrigatoria: regras.obrigatorias ?? curso.carga_obrigatoria,
            horas_optativas: (regras.optativas ?? 0) + (regras.humanidades ?? 0) || curso.horas_optativas,
            horas_estagio: regras.estagio ?? curso.horas_estagio,
            horas_complementares: regras.complementares ?? curso.horas_complementares,
          },
          { onConflict: 'user_id' },
        )
        if (e6) setAviso((a) => `${a} Não consegui salvar as regras do curso (${e6.message}); ajuste em Configurações.`.trim())
      }
      await qc.invalidateQueries()
      setResumoFinal({ disciplinas: linhas.length, aulas })
      setEtapa('pronto')
    } catch (e) {
      setErro(e instanceof Error ? e.message : (e as { message?: string }).message ?? String(e))
    } finally {
      setSalvando(false)
    }
  }

  const removerDisciplina = (d: DiscDetectada) => {
    const k = chaveDe(d)
    setGrade(grade.filter((x) => chaveDe(x) !== k))
    setHorarios(horarios.filter((h) => h.chave !== k))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-40 md:px-8 md:pb-10">
      {etapa === 'pronto' && <Confete />}
      <h1 className="animate-subir text-2xl font-bold tracking-tight">Vamos montar a sua jornada ✨</h1>
      <p className="mb-5 mt-1 text-sm text-slate-500">Envie a grade do curso e o seu horário. Eu leio tudo e você só confirma.</p>
      <Passos atual={etapa} />

      {erro && <div className="animate-subir mb-4 rounded-2xl bg-rose-100 p-3 text-sm text-rose-800">⚠️ {erro}</div>}

      {etapa === 'enviar' && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Envio icone="🎓" titulo="Grade curricular" obrigatorio dica="PDF, planilha (xlsx, ods, csv) ou texto" doc={docGrade} onDoc={setDocGrade} onErro={setErro} />
            <Envio icone="🗓️" titulo="Horários do curso" dica="O quadro de aulas do semestre. Com ele eu descubro em que período você está." doc={docHorario} onDoc={setDocHorario} onErro={setErro} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Botao onClick={analisar} disabled={!docGrade || !!analisando} className="px-6 py-3">
              {analisando ? '✨ Analisando…' : 'Analisar meus documentos ✨'}
            </Botao>
            {analisando && <span className="animate-pulse text-sm text-slate-600">{analisando}</span>}
            {!analisando && <span className="text-xs text-slate-500">Seus arquivos são lidos aqui no aparelho e não são enviados para lugar nenhum.</span>}
          </div>
        </>
      )}

      {etapa === 'conferir' && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              ['📚', grade.length, 'disciplinas'],
              ['🧭', periodos.filter((p) => p != null).length, 'períodos'],
              ['🕒', horarios.length, 'horários de aula'],
            ].map(([i, n, t], k) => (
              <div key={t as string} className="vidro animate-subir rounded-2xl p-4 text-center" style={{ animationDelay: `${k * 80}ms` }}>
                <div className="text-xl">{i}</div>
                <div className="text-3xl font-extrabold"><Numero valor={n as number} /></div>
                <div className="text-xs text-slate-500">{t}</div>
              </div>
            ))}
          </div>

          {horarios.length > 0 && (
            <Card titulo="Esse horário é de…" className="mb-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ['meu', '🙋', 'Só das aulas que eu faço', 'Marco essas matérias como “cursando” e coloco na sua semana.'],
                  ['oferta', '🏫', 'De todas as turmas do curso', 'Guardo como quadro de ofertas para sugerir a sua próxima grade.'],
                ] as const).map(([v, ic, t, d]) => (
                  <button
                    key={v}
                    onClick={() => trocarModo(v)}
                    className={`cursor-pointer rounded-2xl border p-3 text-left transition ${modo === v ? 'border-indigo-400 bg-indigo-100' : 'border-slate-200 hover:bg-slate-100'}`}
                  >
                    <div className="font-semibold">{ic} {t}</div>
                    <div className="text-xs text-slate-500">{d}</div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {regras && (
            <Card titulo="📋 Regras do curso encontradas no documento" className="mb-4">
              <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {([
                  ['Curso', regras.nome ? `${nomeDoCurso(regras.nome)}${regras.versao ? ` (versão ${regras.versao})` : ''}` : null],
                  ['Carga total', regras.total ? `${fmt(regras.total, 0)} h` : null],
                  ['Obrigatórias', regras.obrigatorias ? `${fmt(regras.obrigatorias, 0)} h` : null],
                  ['Optativas', regras.optativas ? `mínimo ${regras.optativas} h` : null],
                  ['Optativas de humanidades', regras.humanidades ? `mínimo ${regras.humanidades} h` : null],
                  ['Estágio', regras.estagio ? `mínimo ${regras.estagio} h` : null],
                  ['Atividades complementares', regras.complementares ? `mínimo ${regras.complementares} h` : null],
                ] as const)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-2">
                      <span className="text-slate-500">{k}</span>
                      <b>{v}</b>
                    </li>
                  ))}
              </ul>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={aplicarRegras} onChange={(e) => setAplicarRegras(e.target.checked)} />
                Usar esses valores no meu painel (progresso de optativas, estágio e complementares)
              </label>
            </Card>
          )}

          {ignoradas.length > 0 && (
            <div className="mb-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
              ℹ️ {ignoradas.length} código(s) do quadro de horários não aparecem na sua grade (provavelmente de outro currículo) e foram deixados de fora.
            </div>
          )}

          {docHorario && !horarios.length && (
            <div className="mb-4 rounded-2xl bg-amber-100 p-3 text-sm text-amber-900">
              Não encontrei nenhum horário de aula nesse arquivo. Você pode seguir assim e cadastrar os horários depois em “Semana”, ou voltar e tentar outro arquivo.
            </div>
          )}

          <Card titulo="Isto está certo? Remova o que não for disciplina.">
            <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
              {periodos.map((p) => (
                <div key={p ?? 'sem'}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{p ? `${p}º período` : 'Optativas / sem período'}</div>
                  <ul className="divide-y divide-slate-100 text-sm">
                    {grade.filter((d) => d.periodo === p).map((d) => (
                      <li key={chaveDe(d)} className="flex items-center gap-2 py-1.5">
                        <span className="w-20 shrink-0 text-xs text-slate-400">{d.codigo}</span>
                        <span className="min-w-0 flex-1 truncate">{d.nome}</span>
                        <span className="text-xs text-slate-500">{d.carga_horaria ? `${d.carga_horaria} h` : ''}</span>
                        <button className="rounded-lg px-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600" onClick={() => removerDisciplina(d)} aria-label={`Remover ${d.nome}`}>✕</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          {horarios.length > 0 && (
            <Card titulo="Seus horários encontrados" className="mt-4">
              <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {[...horarios].sort((a, b) => a.dia - b.dia || minutos(a.inicio) - minutos(b.inicio)).map((h, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{porChave.get(h.chave)?.nome ?? h.chave}</span>
                    <span className="shrink-0 text-slate-500">{DIAS_CURTOS[h.dia]} {hhmm(h.inicio)}–{hhmm(h.fim)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="mt-5 flex gap-2">
            <Botao variante="secundario" onClick={() => setEtapa('enviar')}>← Voltar</Botao>
            <Botao onClick={() => setEtapa('marcar')} disabled={!grade.length}>Está certo, continuar →</Botao>
          </div>
        </>
      )}

      {etapa === 'marcar' && (
        <>
          <Card className="mb-4" atraso={0}>
            <p className="text-sm text-slate-700">
              {cursando.length > 0 ? (
                <>
                  Pelo seu horário, você está cursando <b>{cursando.length}</b> matéria(s)
                  {sugeridas.size > cursando.length && <> e deixei <b>marcadas como já feitas</b> as que vêm antes ou são pré-requisitos delas</>}.
                </>
              ) : (
                <>Toque nas matérias que você <b>já concluiu</b>. Se marcar uma, eu marco os pré-requisitos dela também.</>
              )}{' '}
              Ajuste o que estiver diferente da sua realidade.
            </p>
          </Card>

          <Card titulo={`📖 Cursando agora (${cursando.length})`} className="mb-4 border-indigo-400/40">
            {cursando.length ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {cursando.map((d) => (
                  <span key={chaveDe(d)} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 py-1 pl-3 pr-1.5 text-sm font-medium text-indigo-900">
                    {d.nome}
                    <button
                      className="ml-1 cursor-pointer rounded-full px-1.5 text-indigo-700 hover:bg-rose-100 hover:text-rose-800"
                      aria-label={`Tirar ${d.nome} de cursando`}
                      onClick={() => setStatus({ ...status, [chaveDe(d)]: 'pendente' })}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-sm text-slate-500">Nenhuma ainda. Escolha abaixo as matérias que você está fazendo neste semestre.</p>
            )}
            <select
              value=""
              onChange={(e) => e.target.value && setStatus({ ...status, [e.target.value]: 'cursando' })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:w-auto"
            >
              <option value="">+ Adicionar matéria que estou cursando…</option>
              {grade
                .filter((d) => !['cursando', 'aprovada', 'dispensada'].includes(status[chaveDe(d)]))
                .sort((a, b) => (a.periodo ?? 99) - (b.periodo ?? 99) || a.nome.localeCompare(b.nome))
                .map((d) => (
                  <option key={chaveDe(d)} value={chaveDe(d)}>
                    {d.periodo ? `${d.periodo}º · ` : d.tipo === 'optativa' ? 'Optativa · ' : ''}{d.nome}
                  </option>
                ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Elas viram “matérias do semestre”, onde você lança faltas e notas. Quando você passar nelas, as matérias que dependem delas são liberadas.
              Você também pode marcar direto nos cartões abaixo, no botão <b>Cursando</b>.
            </p>
          </Card>

          <Card titulo="📝 Já tenho a lista do que cursei" className="mb-4">
            <p className="mb-2 text-xs text-slate-500">
              Cole os nomes das matérias (uma por linha) ou carregue um arquivo .txt. Use <code>#</code> para separar:{' '}
              <code># já fiz</code>, <code># cursando</code>, <code># pendentes</code>. Escrever “p/”, “Psico.” ou sem acento não tem problema.
            </p>
            <textarea
              rows={5}
              value={listaTexto}
              onChange={(e) => setListaTexto(e.target.value)}
              placeholder={'# já fiz\nCálculo Diferencial e Integral I\nDinâmica\n…'}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
                Carregar .txt
                <input type="file" accept=".txt" hidden onChange={async (e) => e.target.files?.[0] && setListaTexto(await e.target.files[0].text())} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={zerarResto} onChange={(e) => setZerarResto(e.target.checked)} />
                O que não está na lista ainda não foi feito
              </label>
              <Botao variante="secundario" onClick={aplicarLista} disabled={!listaTexto.trim()}>Aplicar lista</Botao>
            </div>
            {listaMsg && <p className="mt-2 text-sm text-slate-700">{listaMsg}</p>}
          </Card>

          {modo === 'oferta' && periodos.some((p) => p != null) && (
            <Card className="mb-4">
              <label className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">Em que período você está agora?</span>
                <select
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  defaultValue=""
                  onChange={(e) => e.target.value && marcarAtePeriodo(Number(e.target.value))}
                >
                  <option value="">escolher…</option>
                  {periodos.filter((p): p is number => p != null).map((p) => <option key={p} value={p}>{p}º período</option>)}
                </select>
                <span className="text-xs text-slate-500">Marco como feitas as obrigatórias dos períodos anteriores. Depois você ajusta o que for diferente.</span>
              </label>
            </Card>
          )}

          <div className="space-y-6">
            {periodos.map((p) => {
              const lista = grade.filter((d) => d.periodo === p)
              const todas = lista.every((d) => status[chaveDe(d)] !== 'pendente' && status[chaveDe(d)] !== 'reprovada')
              return (
                <section key={p ?? 'sem'}>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-bold">{p ? `${p}º período` : 'Optativas / sem período'}</h2>
                    <Botao variante="fantasma" className="px-2 py-1 text-xs" onClick={() => marcarPeriodo(p, !todas)}>
                      {todas ? 'Desmarcar período' : 'Marcar período inteiro'}
                    </Botao>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {lista.map((d) => {
                      const k = chaveDe(d)
                      const s = status[k]
                      const feita = s === 'aprovada' || s === 'dispensada'
                      const cur = s === 'cursando'
                      return (
                        <div
                          key={k}
                          className={`flex items-stretch overflow-hidden rounded-2xl border transition-all duration-300 ${
                            feita ? 'border-emerald-500/50 bg-emerald-50' : cur ? 'border-indigo-400/60 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <button className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 p-3 text-left" onClick={() => alternarFeita(d)}>
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm transition-all duration-300 ${feita ? 'scale-110 border-emerald-400 bg-emerald-500 text-slate-900' : 'border-slate-300'}`}>
                              {feita && '✓'}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">{d.nome}</span>
                              <span className="block truncate text-xs text-slate-500">
                                {d.codigo}{d.carga_horaria ? ` · ${d.carga_horaria} h` : ''}{d.tipo === 'optativa' ? ' · optativa' : ''}
                              </span>
                              {motivo[k] && (feita || cur) && sugeridas.has(k) && <span className="block truncate text-[11px] text-indigo-700">✨ {motivo[k]}</span>}
                            </span>
                          </button>
                          <button
                            onClick={() => alternarCursando(d)}
                            title={cur ? 'Tirar de "cursando"' : 'Estou cursando esta matéria agora'}
                            className={`shrink-0 cursor-pointer border-l px-3 text-xs font-semibold transition ${cur ? 'border-indigo-400/60 bg-indigo-600 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                          >
                            {cur ? '📖 cursando' : 'Cursando'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>

          <div className="vidro sticky bottom-24 z-20 mt-6 rounded-3xl p-3 md:bottom-4" style={{ background: 'rgb(14 18 40 / 0.9)' }}>
            <div className="flex flex-wrap items-center gap-3">
              <Anel valor={progressoObrig} tamanho={52} espessura={6}>
                <span className="text-[11px] font-bold">{Math.round(progressoObrig * 100)}%</span>
              </Anel>
              <div className="min-w-0 flex-1 text-xs text-slate-600">
                <div><b className="text-slate-900">{feitas.length}</b> feitas · <b className="text-slate-900">{cursando.length}</b> cursando · <b className="text-slate-900">{grade.length - feitas.length - cursando.length}</b> faltam</div>
                <div className="truncate text-slate-500">{dica || `${fmt(horasFeitas, 0)} h concluídas`}</div>
              </div>
              {existentes.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} />
                  Substituir a grade atual
                </label>
              )}
              <Botao variante="secundario" onClick={() => setEtapa('conferir')}>←</Botao>
              <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Concluir 🎉'}</Botao>
            </div>
          </div>
        </>
      )}

      {etapa === 'pronto' && (
        <Card className="text-center">
          <div className="animate-flutuar text-6xl">🎉</div>
          <h2 className="mt-3 text-2xl font-extrabold"><span className="texto-brilho">Tudo pronto!</span></h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Guardei {resumoFinal.disciplinas} disciplinas
            {resumoFinal.aulas > 0 && <> e {resumoFinal.aulas} horários de aula na sua semana</>}. Agora é só acompanhar o seu progresso.
          </p>
          {aviso && <p className="mx-auto mt-3 max-w-md rounded-xl bg-amber-100 p-3 text-sm text-amber-900">{aviso}</p>}
          {modo === 'oferta' && !aviso && <p className="mt-2 text-sm text-slate-500">O quadro de ofertas ficou guardado: já dá para usar <Link to="/sugestoes" className="text-indigo-700 underline">Montar semestre</Link>.</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/"><Botao>Ver meu painel ✨</Botao></Link>
            {resumoFinal.aulas > 0 && <Link to="/semana"><Botao variante="secundario">Ver minha semana</Botao></Link>}
            <Link to="/semestre"><Botao variante="secundario">Cadastrar notas e faltas</Botao></Link>
          </div>
        </Card>
      )}
    </div>
  )
}
