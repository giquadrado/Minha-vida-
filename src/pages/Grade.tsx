import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLista, useTabela } from '../lib/db'
import { disponiveisParaCursar, fmt, rotuloPreRequisito, semestreAtual } from '../lib/calculos'
import { Botao, Campo, Card, Pagina, Selecao, Selo, Vazio, lerForm, numOuNull } from '../components/ui'
import type { Disciplina, StatusDisciplina } from '../lib/types'

export const STATUS: [StatusDisciplina, string][] = [
  ['pendente', 'Pendente'],
  ['cursando', 'Cursando'],
  ['aprovada', 'Aprovada'],
  ['reprovada', 'Reprovada'],
  ['dispensada', 'Dispensada'],
]
const COR_STATUS = { pendente: 'cinza', cursando: 'indigo', aprovada: 'verde', reprovada: 'vermelho', dispensada: 'verde' } as const

function FormDisciplina({ d, fechar }: { d?: Disciplina; fechar: () => void }) {
  const { inserir, atualizar } = useTabela('disciplinas')
  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    const f = lerForm(e)
    const linha = {
      codigo: f.codigo.trim(),
      nome: f.nome.trim(),
      carga_horaria: Number(f.carga_horaria || 0),
      periodo: numOuNull(f.periodo),
      tipo: f.tipo as Disciplina['tipo'],
      status: f.status as StatusDisciplina,
      pre_requisitos: f.pre_requisitos.split(/[;,]/).map((s) => s.trim()).filter(Boolean),
    }
    if (d) await atualizar.mutateAsync({ id: d.id, ...linha })
    else await inserir.mutateAsync(linha)
    fechar()
  }
  return (
    <Card titulo={d ? 'Editar disciplina' : 'Nova disciplina'}>
      <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Código" name="codigo" defaultValue={d?.codigo} />
        <Campo rotulo="Nome" name="nome" required defaultValue={d?.nome} className="sm:col-span-2" />
        <Campo rotulo="Carga horária (h)" name="carga_horaria" type="number" defaultValue={d?.carga_horaria ?? 60} />
        <Campo rotulo="Período" name="periodo" type="number" defaultValue={d?.periodo ?? ''} />
        <Selecao rotulo="Tipo" name="tipo" defaultValue={d?.tipo} opcoes={[['obrigatoria', 'Obrigatória'], ['optativa', 'Optativa']]} />
        <Selecao rotulo="Situação" name="status" defaultValue={d?.status} opcoes={STATUS} />
        <Campo rotulo="Pré-requisitos (códigos separados por vírgula)" name="pre_requisitos" defaultValue={d?.pre_requisitos.join(', ')} className="sm:col-span-2" />
        <div className="flex gap-2 sm:col-span-3">
          <Botao type="submit">Salvar</Botao>
          <Botao type="button" variante="secundario" onClick={fechar}>Cancelar</Botao>
        </div>
      </form>
    </Card>
  )
}

export default function Grade() {
  const disciplinas = useLista('disciplinas').data ?? []
  const { atualizar, remover } = useTabela('disciplinas')
  const [editando, setEditando] = useState<Disciplina | 'nova' | null>(null)
  const [filtro, setFiltro] = useState<'todas' | 'faltam' | 'disponiveis' | 'cursando'>('faltam')
  const turmas = useLista('turmas').data ?? []
  const turmasTab = useTabela('turmas')

  const cursando = disciplinas.filter((d) => d.status === 'cursando')
  const horasCursando = cursando.reduce((s, d) => s + d.carga_horaria, 0)
  const disponiveis = new Set(disponiveisParaCursar(disciplinas).map((d) => d.id))
  const visiveis = disciplinas.filter((d) =>
    filtro === 'todas'
      ? true
      : filtro === 'disponiveis'
        ? disponiveis.has(d.id)
        : filtro === 'cursando'
          ? d.status === 'cursando'
          : d.status !== 'aprovada' && d.status !== 'dispensada' && d.status !== 'cursando',
  )

  /** Passei/reprovei: muda a situação e encerra a matéria do semestre ligada a ela. */
  function concluir(d: Disciplina, status: StatusDisciplina) {
    atualizar.mutate({ id: d.id, status })
    if (status === 'aprovada' || status === 'reprovada' || status === 'pendente')
      for (const t of turmas.filter((x) => x.ativa && x.disciplina_id === d.id)) turmasTab.atualizar.mutate({ id: t.id, ativa: false })
  }

  function criarTurma(d: Disciplina) {
    turmasTab.inserir.mutate({ disciplina_id: d.id, nome: d.nome, semestre: semestreAtual(), total_aulas: d.carga_horaria, ativa: true })
  }
  const periodos = [...new Set(visiveis.map((d) => d.periodo ?? 0))].sort((a, b) => (a || 99) - (b || 99))

  return (
    <Pagina
      titulo="Grade curricular"
      acao={
        <div className="flex gap-2">
          <Link to="/importar"><Botao variante="secundario">Importar</Botao></Link>
          <Botao onClick={() => setEditando('nova')}>+ Disciplina</Botao>
        </div>
      }
    >
      {editando && <FormDisciplina key={editando === 'nova' ? 'nova' : editando.id} d={editando === 'nova' ? undefined : editando} fechar={() => setEditando(null)} />}

      {cursando.length > 0 && (
        <Card titulo={`📖 Cursando agora · ${cursando.length} matéria(s) · ${fmt(horasCursando, 0)} h`} className="border-indigo-400/40">
          <ul className="divide-y divide-slate-100">
            {cursando.map((d) => {
              const turma = turmas.find((t) => t.ativa && t.disciplina_id === d.id)
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditando(d)}>
                    <span className="mr-1 text-slate-400">{d.codigo}</span>
                    <span className="font-medium">{d.nome}</span>
                    <span className="ml-1 text-slate-500">
                      · {d.carga_horaria ? `${d.carga_horaria} h` : 'sem carga'}
                      {d.periodo ? ` · ${d.periodo}º período` : ''}
                    </span>
                    {d.tipo === 'optativa' && <> <Selo cor="ambar">optativa</Selo></>}
                    {turma ? <span className="block text-xs text-slate-400">{turma.semestre}{turma.professor ? ` · ${turma.professor}` : ''} — faltas e notas em Matérias</span> : null}
                  </button>
                  {!turma && (
                    <Botao variante="fantasma" className="px-2 py-1 text-xs" onClick={() => criarTurma(d)} title="Cria a matéria em Matérias do semestre para lançar faltas e notas">
                      + Matérias do semestre
                    </Botao>
                  )}
                  <Botao variante="secundario" className="px-2.5 py-1 text-xs" onClick={() => concluir(d, 'aprovada')}>✅ Passei</Botao>
                  <Botao variante="secundario" className="px-2.5 py-1 text-xs" onClick={() => concluir(d, 'reprovada')}>❌ Reprovei</Botao>
                  <Botao variante="fantasma" className="px-2 py-1 text-xs" onClick={() => concluir(d, 'pendente')} title="Não estou mais cursando">↩</Botao>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {([['faltam', 'O que falta'], ['cursando', `Cursando (${cursando.length})`], ['disponiveis', `Posso cursar (${disponiveis.size})`], ['todas', 'Todas']] as const).map(([v, t]) => (
          <Botao key={v} variante={filtro === v ? 'primario' : 'secundario'} onClick={() => setFiltro(v)}>{t}</Botao>
        ))}
      </div>
      {filtro === 'disponiveis' && (
        <p className="text-sm text-slate-500">
          Disciplinas pendentes cujos pré-requisitos você já cumpriu. Compare com a aba Semana para ver se o horário encaixa no trabalho.
        </p>
      )}

      {!disciplinas.length && <Card><Vazio>Nenhuma disciplina. Importe a grade ou adicione manualmente.</Vazio></Card>}

      {periodos.map((per) => {
        const lista = visiveis.filter((d) => (d.periodo ?? 0) === per)
        return (
          <Card key={per} titulo={`${per ? `${per}º período` : 'Sem período'} · ${fmt(lista.reduce((s, d) => s + d.carga_horaria, 0), 0)} h`}>
            <ul className="divide-y divide-slate-100">
              {lista.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditando(d)}>
                    <span className="mr-1 text-slate-400">{d.codigo}</span>
                    <span className="font-medium">{d.nome}</span>
                    <span className="ml-1 text-slate-500">· {d.carga_horaria} h</span>
                    {d.tipo === 'optativa' && <Selo cor="ambar">optativa</Selo>}
                    {d.pre_requisitos.length > 0 && <span className="block text-xs text-slate-400">pré: {d.pre_requisitos.map(rotuloPreRequisito).join(', ')}</span>}
                  </button>
                  {disponiveis.has(d.id) && <Selo cor="indigo">liberada</Selo>}
                  <select
                    value={d.status}
                    onChange={(e) => atualizar.mutate({ id: d.id, status: e.target.value as StatusDisciplina })}
                    className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${
                      { cinza: 'bg-slate-100', indigo: 'bg-indigo-100', verde: 'bg-emerald-100', vermelho: 'bg-rose-100' }[COR_STATUS[d.status]]
                    }`}
                  >
                    {STATUS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                  <Botao variante="fantasma" className="px-2 py-1" onClick={() => confirm(`Excluir ${d.nome}?`) && remover.mutate(d.id)}>✕</Botao>
                </li>
              ))}
            </ul>
          </Card>
        )
      })}
    </Pagina>
  )
}
