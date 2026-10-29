import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useLista } from '../lib/db'
import { supabase } from '../lib/supabase'
import { fmt, minutos, pct } from '../lib/calculos'
import {
  TURNOS, bloqueiosDe, disponibilidade, gerarPlanos, motivos, proximoSemestre, ranking,
  type Plano, type Preferencias, type Turno,
} from '../lib/sugestoes'
import { MiniGrade, type BlocoGrade } from '../components/MiniGrade'
import { Botao, Card, Confete, Pagina, Selecao, Selo, Vazio } from '../components/ui'
import { DIAS_CURTOS } from '../lib/types'

const CHAVE = 'sugestoes.prefs'
const PADRAO: Preferencias = { turnos: [], maxDisciplinas: 5, maxHorasSemana: null, diasEvitar: [], incluirOptativas: false, folgaMin: 30, meiosDiasLivres: 0 }

function carregar(): Preferencias {
  try {
    return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) ?? '{}') }
  } catch {
    return PADRAO
  }
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-95 ${
        ativo ? 'border-indigo-400 bg-indigo-100 text-indigo-900' : 'border-slate-300 text-slate-500 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

export default function Sugestoes() {
  const qc = useQueryClient()
  const disciplinas = useLista('disciplinas').data ?? []
  const ofertas = useLista('ofertas').data ?? []
  const horarios = useLista('horarios').data ?? []
  const turmas = useLista('turmas').data ?? []

  const [prefs, setPrefs] = useState<Preferencias>(carregar)
  const [aplicando, setAplicando] = useState<number | null>(null)
  const [feito, setFeito] = useState(false)
  const [erro, setErro] = useState('')

  function mudar(p: Partial<Preferencias>) {
    const novo = { ...prefs, ...p }
    setPrefs(novo)
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo))
    } catch {
      /* sem armazenamento local: segue sem lembrar */
    }
  }

  const bloqueios = useMemo(() => bloqueiosDe(horarios), [horarios])
  const disp = useMemo(() => disponibilidade(bloqueios, prefs.folgaMin), [bloqueios, prefs.folgaMin])
  const resultado = useMemo(() => gerarPlanos(disciplinas, ofertas, bloqueios, prefs), [disciplinas, ofertas, bloqueios, prefs])
  const semOfertas = ofertas.length === 0
  const sugeridas = useMemo(() => (semOfertas ? ranking(disciplinas, prefs) : []), [semOfertas, disciplinas, prefs])
  const restanteObrig = disciplinas.filter((d) => d.tipo === 'obrigatoria' && d.status !== 'aprovada' && d.status !== 'dispensada').reduce((s, d) => s + d.carga_horaria, 0)

  const blocosTrabalho: BlocoGrade[] = bloqueios.map((b) => ({ dia: b.dia, inicio: b.inicio, fim: b.fim, rotulo: b.titulo || 'Trabalho', tom: 'trabalho' }))

  async function usar(plano: Plano, indice: number) {
    if (!confirm(`Usar esta grade? Vou criar ${plano.secoes.length} matéria(s) do semestre ${proximoSemestre()} com os horários.`)) return
    setAplicando(indice)
    setErro('')
    try {
      const novas = plano.secoes.filter((s) => !turmas.some((t) => t.ativa && t.disciplina_id === s.disciplina.id))
      const { data: ts, error } = await supabase
        .from('turmas')
        .insert(novas.map((s) => ({ disciplina_id: s.disciplina.id, nome: s.disciplina.nome, semestre: proximoSemestre(), total_aulas: s.disciplina.carga_horaria, ativa: true })))
        .select('id')
      if (error) throw error
      const linhas = novas.flatMap((s, i) =>
        s.reunioes.map((r) => ({
          turma_id: ts![i].id, tipo: 'aula', titulo: s.disciplina.nome, dia_semana: r.dia, inicio: r.inicio, fim: r.fim,
          aulas: Math.max(1, Math.round((minutos(r.fim) - minutos(r.inicio)) / 50)), local: r.local,
        })),
      )
      if (linhas.length) {
        const { error: e2 } = await supabase.from('horarios').insert(linhas)
        if (e2) throw e2
      }
      const { error: e3 } = await supabase.from('disciplinas').update({ status: 'cursando' }).in('id', plano.secoes.map((s) => s.disciplina.id))
      if (e3) throw e3
      await qc.invalidateQueries()
      setFeito(true)
    } catch (e) {
      setErro((e as { message?: string }).message ?? String(e))
    } finally {
      setAplicando(null)
    }
  }

  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v])

  return (
    <Pagina titulo="Montar semestre 🧭">
      {feito && <Confete />}
      <p className="-mt-2 text-sm text-slate-500">
        Eu olho o que ainda falta, o seu trabalho e o turno que você prefere, e monto grades possíveis para o próximo semestre.
      </p>

      {erro && <div className="rounded-2xl bg-rose-100 p-3 text-sm text-rose-800">⚠️ {erro}</div>}
      {feito && (
        <Card className="text-center">
          <div className="text-3xl">🎉</div>
          <p className="mt-1 font-semibold">Grade criada! Veja em <Link className="text-indigo-700 underline" to="/semana">Semana</Link> e <Link className="text-indigo-700 underline" to="/semestre">Matérias</Link>.</p>
        </Card>
      )}

      <Card titulo="Minhas preferências">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium text-slate-600">Prefiro estudar de…</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TURNOS) as Turno[]).map((t) => (
                <Chip key={t} ativo={prefs.turnos.includes(t)} onClick={() => mudar({ turnos: alternar(prefs.turnos, t) })}>
                  {TURNOS[t].icone} {TURNOS[t].rotulo}
                </Chip>
              ))}
              <span className="self-center text-xs text-slate-500">{prefs.turnos.length === 0 ? 'sem preferência' : ''}</span>
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-slate-600">Quero evitar aulas em…</div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <Chip key={d} ativo={prefs.diasEvitar.includes(d)} onClick={() => mudar({ diasEvitar: alternar(prefs.diasEvitar, d) })}>
                  {DIAS_CURTOS[d]}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Selecao
              rotulo="Quantas matérias"
              value={String(prefs.maxDisciplinas)}
              onChange={(e) => mudar({ maxDisciplinas: Number(e.target.value) })}
              opcoes={[2, 3, 4, 5, 6, 7].map((n): [string, string] => [String(n), `até ${n}`])}
            />
            <Selecao
              rotulo="Tempo de deslocamento do trabalho"
              value={String(prefs.folgaMin)}
              onChange={(e) => mudar({ folgaMin: Number(e.target.value) })}
              opcoes={[['0', 'nenhum'], ['30', '30 min'], ['60', '1 hora'], ['90', '1h30']]}
            />
            <Selecao
              rotulo="Horas de aula por semana"
              value={String(prefs.maxHorasSemana ?? '')}
              onChange={(e) => mudar({ maxHorasSemana: e.target.value ? Number(e.target.value) : null })}
              opcoes={[['', 'sem limite'], ['10', 'até 10 h'], ['15', 'até 15 h'], ['20', 'até 20 h'], ['25', 'até 25 h']]}
            />
          </div>
          <div>
            <Selecao
              rotulo="Trabalho flexível: manhãs/tardes livres (seg–sex) para trabalhar"
              value={String(prefs.meiosDiasLivres)}
              onChange={(e) => mudar({ meiosDiasLivres: Number(e.target.value) })}
              opcoes={[['0', 'não preciso reservar'], ...[2, 3, 4, 5, 6, 7, 8].map((n): [string, string] => [String(n), `${n} (≈ ${n * 4} h de trabalho)`])]}
            />
            <p className="mt-1 text-xs text-slate-500">
              Cada manhã ou tarde sem aula conta como uma chance de trabalhar (~4 h). Assim eu agrupo as aulas em poucos turnos, do jeito que você faz.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prefs.incluirOptativas} onChange={(e) => mudar({ incluirOptativas: e.target.checked })} />
            Incluir optativas nas sugestões
          </label>
        </div>
      </Card>

      <Card titulo="Meu tempo livre (já descontando o trabalho)">
        {bloqueios.length === 0 && (
          <p className="mb-3 rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
            Você ainda não cadastrou horário fixo de trabalho/estágio. Se for fixo, cadastre em <Link className="underline" to="/semana">Semana → + Horário</Link>; se for flexível, use “manhãs/tardes livres” nas preferências acima.
          </p>
        )}
        <div className="grid grid-cols-[auto_repeat(6,1fr)] gap-1.5 text-center text-xs">
          <div />
          {[1, 2, 3, 4, 5, 6].map((d) => <div key={d} className="font-semibold text-slate-500">{DIAS_CURTOS[d]}</div>)}
          {(Object.keys(TURNOS) as Turno[]).map((t) => (
            <div key={t} className="contents">
              <div className="flex items-center pr-1 text-slate-500">{TURNOS[t].icone}</div>
              {[1, 2, 3, 4, 5, 6].map((d) => {
                const livre = disp.find((x) => x.dia === d && x.turno === t)!.livre
                const evitado = prefs.diasEvitar.includes(d)
                return (
                  <div
                    key={d}
                    className="rounded-lg py-2 font-semibold"
                    style={{ background: evitado ? 'rgb(255 255 255 / 0.04)' : `rgb(45 212 160 / ${0.08 + livre * 0.5})`, color: evitado ? '#8a92b8' : '#e7fff6' }}
                    title={`${TURNOS[t].rotulo} de ${DIAS_CURTOS[d]}: ${pct(livre)} livre`}
                  >
                    {evitado ? '–' : pct(livre)}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </Card>

      {semOfertas ? (
        <Card titulo="Matérias que eu priorizaria">
          <p className="mb-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
            Ainda não tenho o <b>quadro de horários da faculdade</b>, então não consigo montar a semana. Em{' '}
            <Link className="underline" to="/importar">Enviar documentos</Link> mande o horário com todas as turmas e marque “quadro de ofertas”.
            Enquanto isso, esta é a ordem do que vale cursar:
          </p>
          {sugeridas.length ? (
            <ol className="space-y-2">
              {sugeridas.map((d, i) => (
                <li key={d.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <b>{d.nome}</b> <span className="text-slate-500">{d.codigo} · {d.carga_horaria} h</span>
                  </span>
                  <span className="flex flex-wrap justify-end gap-1">{motivos(d, disciplinas).map((m) => <Selo key={m} cor="indigo">{m}</Selo>)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <Vazio>Nenhuma matéria liberada. Importe a grade curricular e marque o que já cursou.</Vazio>
          )}
        </Card>
      ) : (
        <>
          <p className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
            ℹ️ Os horários vêm do último quadro que você enviou. Algumas matérias mudam de turma ou só são oferecidas uma vez por ano, então
            confira no quadro do próximo semestre quando ele sair (é só enviar de novo).
          </p>
          {resultado.planos.length === 0 && (
            <Card>
              <Vazio>
                Nenhuma combinação coube nas suas preferências. Tente liberar algum dia, reduzir o deslocamento ou aumentar o limite de horas.
              </Vazio>
            </Card>
          )}
          {resultado.planos.map((p, i) => {
            const blocos: BlocoGrade[] = [
              ...blocosTrabalho,
              ...p.secoes.flatMap((s) => s.reunioes.map((r): BlocoGrade => ({ dia: r.dia, inicio: r.inicio, fim: r.fim, rotulo: s.disciplina.nome, tom: 'novo' }))),
            ]
            const semestres = p.cargaTotal ? Math.ceil(restanteObrig / p.cargaTotal) : null
            return (
              <Card key={i} atraso={i * 90}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">{['Opção A', 'Opção B', 'Opção C'][i]} {i === 0 && <span className="text-sm font-medium text-emerald-700">· melhor encaixe</span>}</h2>
                  <div className="flex flex-wrap gap-1.5">
                    <Selo cor="indigo">{p.secoes.length} matérias</Selo>
                    <Selo cor="cinza">{fmt(p.horasSemana)} h/semana</Selo>
                    {prefs.turnos.length > 0 && prefs.turnos.length < 3 && <Selo cor="verde">{pct(p.pctTurno)} no seu turno</Selo>}
                    {p.libera > 0 && <Selo cor="ambar">libera {p.libera} depois</Selo>}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-[1fr_1.3fr]">
                  <ul className="space-y-1.5 text-sm">
                    {p.secoes.map((s) => (
                      <li key={s.disciplina.id} className="rounded-xl bg-slate-50 p-2.5">
                        <div className="font-semibold">
                          {s.disciplina.nome} {s.rotulo && <span className="text-xs font-medium text-indigo-700">({s.rotulo})</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.reunioes.map((r) => `${DIAS_CURTOS[r.dia]} ${r.inicio}–${r.fim}`).join(' · ')}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <MiniGrade blocos={blocos} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Botao onClick={() => usar(p, i)} disabled={aplicando !== null}>{aplicando === i ? 'Criando…' : 'Usar esta grade ✨'}</Botao>
                  {semestres != null && restanteObrig > 0 && (
                    <span className="text-xs text-slate-500">No ritmo desta grade, as obrigatórias que faltam levariam ~{semestres} semestre(s).</span>
                  )}
                </div>
              </Card>
            )
          })}

          {(resultado.semEncaixe.length > 0 || resultado.naoOfertadas.length > 0) && (
            <Card titulo="De fora das sugestões">
              {resultado.semEncaixe.length > 0 && (
                <p className="mb-2 text-sm text-slate-600">
                  <b>Sem encaixe no seu trabalho/preferências:</b> {resultado.semEncaixe.map((d) => d.nome).join(', ')}.
                </p>
              )}
              {resultado.naoOfertadas.length > 0 && (
                <p className="text-sm text-slate-600">
                  <b>Não aparecem no quadro de horários enviado:</b> {resultado.naoOfertadas.map((d) => d.nome).join(', ')}.
                </p>
              )}
            </Card>
          )}
        </>
      )}
    </Pagina>
  )
}
