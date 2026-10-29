import { Link } from 'react-router-dom'
import { useCurso, useLista } from '../lib/db'
import { horariosAtivos, horariosDaData, horariosDaSemana, inicioDaSemana } from '../lib/semana'
import { conflitos, dataIso, fmt, hhmm, minutos, pct, progresso, type ItemProgresso } from '../lib/calculos'
import { useResumoTurmas } from '../lib/resumo'
import { saudacao, useNome } from '../lib/usuario'
import { Anel, Barra, Botao, Card, Numero, Selo, Vazio } from '../components/ui'
import { DIAS_CURTOS } from '../lib/types'

function LinhaProgresso({ rotulo, item }: { rotulo: string; item: ItemProgresso }) {
  if (!item.exigido) return null
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-medium">{rotulo}</span>
        <span className="text-slate-500">
          {fmt(item.feito, 0)} / {fmt(item.exigido, 0)} h · faltam <b className="text-slate-800">{fmt(item.falta, 0)} h</b>
        </span>
      </div>
      <Barra valor={item.pct} cor={item.pct >= 1 ? 'verde' : 'indigo'} />
    </div>
  )
}

function Tile({ icone, valor, rotulo, sufixo = '', atraso }: { icone: string; valor: number; rotulo: string; sufixo?: string; atraso: number }) {
  return (
    <div
      className="vidro animate-subir rounded-2xl p-4 transition hover:-translate-y-1"
      style={{ animationDelay: `${atraso}ms` }}
    >
      <div className="text-xl">{icone}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">
        <Numero valor={valor} sufixo={sufixo} />
      </div>
      <div className="text-xs text-slate-500">{rotulo}</div>
    </div>
  )
}

function mensagem(p: number, temDados: boolean) {
  if (!temDados) return 'Vamos montar a sua jornada? Leva só alguns minutos.'
  if (p >= 0.95) return 'Reta final! Falta quase nada para a formatura. 🎓'
  if (p >= 0.7) return 'Você já passou da maior parte do caminho. Orgulho de você! 💜'
  if (p >= 0.4) return 'Metade da jornada ficou para trás — e você segue firme. 🚀'
  if (p >= 0.15) return 'Cada disciplina concluída é uma vitória. Continue assim! ✨'
  return 'Todo grande caminho começa com um passo. Você já começou. 🌱'
}

export default function Painel() {
  const curso = useCurso()
  const nome = useNome()
  const disciplinas = useLista('disciplinas').data ?? []
  const horas = useLista('horas_registros').data ?? []
  const todosHorarios = useLista('horarios').data ?? []
  const turmasTodas = useLista('turmas').data ?? []
  const horarios = horariosAtivos(todosHorarios, turmasTodas)
  const { resumos } = useResumoTurmas()
  const p = progresso(curso, disciplinas, horas)

  const hojeIso = dataIso()
  const em14 = dataIso(new Date(Date.now() + 14 * 864e5))
  const proximas = resumos
    .flatMap((r) => r.avaliacoes.filter((a) => a.nota == null && a.data && a.data >= hojeIso && a.data <= em14).map((a) => ({ a, r })))
    .sort((x, y) => x.a.data!.localeCompare(y.a.data!))

  const alertas = resumos.flatMap((r) => {
    const lista: { texto: string; cor: 'ambar' | 'vermelho' }[] = []
    const f = r.frequencia
    if (f.situacao === 'reprovado') lista.push({ texto: `${r.turma.nome}: passou do limite de faltas (${f.faltas}/${f.permitidas})`, cor: 'vermelho' })
    else if (f.situacao === 'atencao' && r.turma.total_aulas)
      lista.push({ texto: `${r.turma.nome}: só pode faltar mais ${f.restantes} aula(s)`, cor: 'ambar' })
    if (r.necessaria != null && r.necessaria > 10)
      lista.push({ texto: `${r.turma.nome}: precisaria de ${fmt(r.necessaria)} nas próximas avaliações — inviável sem recuperação`, cor: 'vermelho' })
    else if (r.necessaria != null && r.necessaria > Number(curso.media_aprovacao))
      lista.push({ texto: `${r.turma.nome}: precisa tirar ${fmt(r.necessaria)} nas próximas avaliações`, cor: 'ambar' })
    return lista
  })

  const choques = conflitos(horariosDaSemana(horarios, inicioDaSemana(new Date())))
  const semDados = !disciplinas.length && !resumos.length

  const agora = new Date()
  const minAgora = agora.getHours() * 60 + agora.getMinutes()
  const proxima = horariosDaData(horarios, dataIso())
    .filter((h) => minutos(h.fim) > minAgora)
    .sort((a, b) => minutos(a.inicio) - minutos(b.inicio))[0]
  const faltaMin = proxima ? minutos(proxima.inicio) - minAgora : 0

  const faltas = resumos.reduce((s, r) => s + Math.max(0, r.frequencia.restantes), 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-32 md:px-8 md:pb-10">
      <header className="animate-subir mb-6">
        <p className="text-sm text-slate-500">{saudacao()}{nome ? `, ${nome}` : ''} 👋</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">
          <span className="texto-brilho">{curso.nome}</span>
        </h1>
        <p className="mt-2 max-w-xl text-slate-600">{mensagem(p.geral, !semDados)}</p>
      </header>

      {semDados ? (
        <Card className="relative overflow-hidden">
          <div className="animate-flutuar pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-violet-600/30 blur-3xl" />
          <div className="relative">
            <div className="mb-2 text-4xl">📥</div>
            <h2 className="text-xl font-bold">Comece enviando seus documentos</h2>
            <p className="mb-4 mt-1 max-w-lg text-sm text-slate-600">
              Mande a grade curricular do seu curso e o seu horário. Eu leio os dois, e você só confirma quais matérias já fez — o resto eu
              calculo para você.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/importar"><Botao>Enviar grade e horários ✨</Botao></Link>
              <Link to="/config"><Botao variante="secundario">Ajustar regras do curso</Botao></Link>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="mb-4" atraso={60}>
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <Anel valor={p.geral}>
                <span className="text-4xl font-extrabold"><Numero valor={p.geral * 100} sufixo="%" /></span>
                <span className="text-xs text-slate-500">da jornada</span>
              </Anel>
              <div className="w-full flex-1 space-y-4">
                <LinhaProgresso rotulo="Obrigatórias" item={p.obrigatorias} />
                <LinhaProgresso rotulo="Optativas" item={p.optativas} />
                <LinhaProgresso rotulo="Estágio" item={p.estagio} />
                <LinhaProgresso rotulo="Complementares" item={p.complementares} />
                {!p.optativas.exigido && !p.estagio.exigido && (
                  <p className="text-xs text-slate-500">
                    Dica: informe as horas de optativas e estágio em <Link to="/config" className="text-indigo-700 underline">Configurações</Link> para ver tudo aqui.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile icone="📚" valor={p.disciplinasRestantes} rotulo="disciplinas obrigatórias faltando" atraso={120} />
            <Tile icone="🧩" valor={p.optativas.falta} sufixo=" h" rotulo="de optativas faltando" atraso={180} />
            <Tile icone="💼" valor={p.estagio.falta} sufixo=" h" rotulo="de estágio faltando" atraso={240} />
            <Tile icone="🍀" valor={faltas} rotulo="faltas ainda disponíveis" atraso={300} />
          </div>
        </>
      )}

      {proxima && (
        <Card className="mb-4" atraso={140}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {minAgora >= minutos(proxima.inicio) ? 'Acontecendo agora' : 'Próximo compromisso de hoje'}
              </div>
              <div className="mt-1 text-lg font-bold">
                {proxima.tipo === 'trabalho' ? '💼' : '📖'} {proxima.titulo}
              </div>
              <div className="text-sm text-slate-500">
                {hhmm(proxima.inicio)}–{hhmm(proxima.fim)}
                {proxima.local ? ` · ${proxima.local}` : ''}
              </div>
            </div>
            {faltaMin > 0 && (
              <Selo cor="indigo">em {faltaMin >= 60 ? `${Math.floor(faltaMin / 60)} h ${faltaMin % 60} min` : `${faltaMin} min`}</Selo>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card titulo="Alertas" atraso={160}>
          {alertas.length || choques.length ? (
            <ul className="space-y-2 text-sm">
              {alertas.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <Selo cor={a.cor}>{a.cor === 'vermelho' ? '!' : 'atenção'}</Selo>
                  {a.texto}
                </li>
              ))}
              {choques.map(([a, b], i) => (
                <li key={`c${i}`} className="flex gap-2">
                  <Selo cor="vermelho">conflito</Selo>
                  {DIAS_CURTOS[a.dia_semana]}: {a.titulo} ({hhmm(a.inicio)}–{hhmm(a.fim)}) × {b.titulo} ({hhmm(b.inicio)}–{hhmm(b.fim)})
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>Tudo em paz por aqui 🌿</Vazio>
          )}
        </Card>

        <Card titulo="Avaliações nos próximos 14 dias" atraso={220}>
          {proximas.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {proximas.map(({ a, r }) => (
                <li key={a.id} className="flex justify-between py-2">
                  <span>
                    <b>{a.nome}</b> · {r.turma.nome}
                  </span>
                  <span className="text-slate-500">{a.data!.split('-').reverse().slice(0, 2).join('/')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>Nenhuma avaliação marcada. Respira! 😮‍💨</Vazio>
          )}
        </Card>
      </div>

      {resumos.length > 0 && (
        <Card titulo="Matérias do semestre" className="mt-4" atraso={280}>
          <div className="divide-y divide-slate-100">
            {resumos.map((r) => (
              <div key={r.turma.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-3 text-sm">
                <span className="font-semibold">{r.turma.nome}</span>
                <span className="text-right text-slate-500">média {r.media == null ? '—' : fmt(r.media)}</span>
                <Barra
                  valor={r.frequencia.permitidas ? r.frequencia.faltas / r.frequencia.permitidas : 0}
                  cor={r.frequencia.situacao === 'ok' ? 'verde' : r.frequencia.situacao === 'atencao' ? 'ambar' : 'vermelho'}
                />
                <span className="text-right text-xs text-slate-500">
                  {r.frequencia.faltas}/{r.frequencia.permitidas} faltas · {pct(r.frequencia.freqAtual)} de presença
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
