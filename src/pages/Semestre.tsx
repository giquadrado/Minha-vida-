import { useState } from 'react'
import { useCurso, useLista, useTabela } from '../lib/db'
import { dataBr, dataIso, fmt, mediaFinalAtual, pct, semestreAtual } from '../lib/calculos'
import { useResumoTurmas, type ResumoTurma } from '../lib/resumo'
import { Barra, Botao, Campo, Card, Pagina, Selecao, Selo, Vazio, lerForm, numOuNull } from '../components/ui'


function NovaTurma({ fechar }: { fechar: () => void }) {
  const disciplinas = (useLista('disciplinas').data ?? []).filter((d) => d.status !== 'aprovada' && d.status !== 'dispensada')
  const { inserir } = useTabela('turmas')
  const discTab = useTabela('disciplinas')

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    const f = lerForm(e)
    const disc = disciplinas.find((d) => d.id === f.disciplina_id)
    await inserir.mutateAsync({
      disciplina_id: disc?.id ?? null,
      nome: f.nome || disc?.nome || 'Matéria',
      semestre: f.semestre,
      professor: f.professor || null,
      sala: f.sala || null,
      total_aulas: Number(f.total_aulas || 0),
      ativa: true,
    })
    if (disc) discTab.atualizar.mutate({ id: disc.id, status: 'cursando' })
    fechar()
  }

  return (
    <Card titulo="Nova matéria no semestre">
      <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
        <Selecao
          rotulo="Disciplina da grade (opcional)"
          name="disciplina_id"
          opcoes={[['', '— nenhuma / avulsa —'], ...disciplinas.map((d): [string, string] => [d.id, `${d.codigo} ${d.nome}`])]}
        />
        <Campo rotulo="Nome (se avulsa ou para abreviar)" name="nome" />
        <Campo rotulo="Semestre" name="semestre" required defaultValue={semestreAtual()} />
        <Campo rotulo="Total de aulas no semestre" name="total_aulas" type="number" min={0} required placeholder="ex.: 72" />
        <Campo rotulo="Professor(a)" name="professor" />
        <Campo rotulo="Sala" name="sala" />
        <div className="flex gap-2 sm:col-span-2">
          <Botao type="submit" disabled={inserir.isPending}>Salvar</Botao>
          <Botao type="button" variante="secundario" onClick={fechar}>Cancelar</Botao>
        </div>
      </form>
      <p className="mt-2 text-xs text-slate-500">
        Dica: total de aulas = carga horária ÷ duração da aula (ex.: 60 h com aulas de 50 min ≈ 72 aulas). Confira no plano de ensino.
      </p>
    </Card>
  )
}

function EditarTurma({ r, fechar }: { r: ResumoTurma; fechar: () => void }) {
  const disciplinas = useLista('disciplinas').data ?? []
  const { atualizar } = useTabela('turmas')

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    const f = lerForm(e)
    await atualizar.mutateAsync({
      id: r.turma.id,
      nome: f.nome.trim() || r.turma.nome,
      semestre: f.semestre,
      professor: f.professor || null,
      sala: f.sala || null,
      total_aulas: Number(f.total_aulas || 0),
      disciplina_id: f.disciplina_id || null,
    })
    fechar()
  }

  return (
    <form onSubmit={salvar} className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
      <Campo rotulo="Nome da matéria" name="nome" required defaultValue={r.turma.nome} className="sm:col-span-2" />
      <Campo rotulo="Semestre" name="semestre" required defaultValue={r.turma.semestre} />
      <Campo rotulo="Total de aulas no semestre" name="total_aulas" type="number" min={0} required defaultValue={r.turma.total_aulas} />
      <Campo rotulo="Professor(a)" name="professor" defaultValue={r.turma.professor ?? ''} />
      <Campo rotulo="Sala" name="sala" defaultValue={r.turma.sala ?? ''} />
      <Selecao
        rotulo="Disciplina da grade"
        name="disciplina_id"
        defaultValue={r.turma.disciplina_id ?? ''}
        className="sm:col-span-2"
        opcoes={[['', '— nenhuma / avulsa —'], ...disciplinas.map((d): [string, string] => [d.id, `${d.codigo} ${d.nome}`])]}
      />
      <div className="flex gap-2 sm:col-span-2">
        <Botao type="submit" disabled={atualizar.isPending}>{atualizar.isPending ? 'Salvando…' : 'Salvar alterações'}</Botao>
        <Botao type="button" variante="secundario" onClick={fechar}>Cancelar</Botao>
      </div>
    </form>
  )
}

function DetalheTurma({ r }: { r: ResumoTurma }) {
  const curso = useCurso()
  const turmas = useTabela('turmas')
  const presencas = useTabela('presencas')
  const avaliacoes = useTabela('avaliacoes')
  const disciplinas = useTabela('disciplinas')
  const f = r.frequencia
  const media = Number(curso.media_aprovacao)

  async function encerrar() {
    const final = mediaFinalAtual(r.avaliacoes)
    const aprovado = final >= media && f.restantes >= 0
    if (!confirm(`Encerrar ${r.turma.nome} como ${aprovado ? 'APROVADA' : 'REPROVADA'} (média ${fmt(final)})?`)) return
    await turmas.atualizar.mutateAsync({ id: r.turma.id, ativa: false })
    if (r.turma.disciplina_id)
      disciplinas.atualizar.mutate({ id: r.turma.disciplina_id, status: aprovado ? 'aprovada' : 'reprovada', nota_final: final })
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-medium">Frequência</h3>
        <p className="mb-2 text-sm text-slate-600">
          {f.faltas} falta(s) de {f.permitidas} permitidas · frequência atual {pct(f.freqAtual)}
        </p>
        <form
          className="mb-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            const v = lerForm(e)
            presencas.salvar.mutate({
              linha: { turma_id: r.turma.id, data: v.data, aulas: Number(v.aulas), presente: v.presente === 'sim' },
              conflito: 'turma_id,data',
            })
          }}
        >
          <Campo rotulo="Data" name="data" type="date" defaultValue={dataIso()} required />
          <Campo rotulo="Aulas" name="aulas" type="number" min={1} defaultValue={2} className="w-20" />
          <Selecao rotulo="Situação" name="presente" opcoes={[['nao', 'Faltei'], ['sim', 'Fui']]} />
          <Botao type="submit" variante="secundario">Lançar</Botao>
        </form>
        <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
          {[...r.presencas].reverse().map((p) => (
            <li key={p.id} className="flex items-center justify-between py-1">
              <span>
                {dataBr(p.data)} · {p.aulas} aula(s)
              </span>
              <span className="flex items-center gap-1">
                <Selo cor={p.presente ? 'verde' : 'vermelho'}>{p.presente ? 'presente' : 'falta'}</Selo>
                <Botao variante="fantasma" className="px-2 py-1" onClick={() => presencas.remover.mutate(p.id)}>✕</Botao>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Avaliações</h3>
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {r.avaliacoes.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-1">
              <span className="flex-1">
                <b>{a.nome}</b> <span className="text-slate-500">peso {fmt(a.peso)}{a.data ? ` · ${dataBr(a.data)}` : ''}</span>
              </span>
              <input
                type="number"
                step="0.1"
                min={0}
                max={10}
                defaultValue={a.nota ?? ''}
                placeholder="nota"
                className="w-20 rounded border border-slate-300 px-2 py-1"
                onBlur={(e) => {
                  const nota = numOuNull(e.target.value)
                  if (nota !== a.nota) avaliacoes.atualizar.mutate({ id: a.id, nota })
                }}
              />
              <Botao variante="fantasma" className="px-2 py-1" onClick={() => avaliacoes.remover.mutate(a.id)}>✕</Botao>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            const v = lerForm(e)
            avaliacoes.inserir.mutate({ turma_id: r.turma.id, nome: v.nome, peso: numOuNull(v.peso) ?? 1, data: v.data || null, nota: numOuNull(v.nota) })
            e.currentTarget.reset()
          }}
        >
          <Campo rotulo="Avaliação" name="nome" required placeholder="P1" className="w-24" />
          <Campo rotulo="Peso" name="peso" defaultValue="1" className="w-16" />
          <Campo rotulo="Data" name="data" type="date" />
          <Campo rotulo="Nota" name="nota" className="w-16" />
          <Botao type="submit" variante="secundario">+</Botao>
        </form>
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          Média parcial: <b>{r.media == null ? '—' : fmt(r.media)}</b>
          {r.necessaria != null && (
            <>
              {' '}· precisa de{' '}
              <b className={r.necessaria > 10 ? 'text-rose-600' : r.necessaria > media ? 'text-amber-700' : 'text-emerald-700'}>
                {r.necessaria <= 0 ? 'nada — já passou por nota' : fmt(r.necessaria)}
              </b>{' '}
              {r.necessaria > 0 && 'em cada avaliação restante'}
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 md:col-span-2">
        <Botao variante="secundario" onClick={encerrar}>Encerrar matéria</Botao>
        <Botao variante="fantasma" className="text-rose-600"
          onClick={() => confirm(`Excluir ${r.turma.nome} e todos os registros?`) && turmas.remover.mutate(r.turma.id)}>
          Excluir
        </Botao>
      </div>
    </div>
  )
}

export default function Semestre() {
  const { resumos, carregando } = useResumoTurmas()
  const [novo, setNovo] = useState(false)
  const [aberta, setAberta] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  return (
    <Pagina titulo="Matérias do semestre" acao={<Botao onClick={() => setNovo(true)}>+ Matéria</Botao>}>
      {novo && <NovaTurma fechar={() => setNovo(false)} />}
      {!carregando && !resumos.length && !novo && (
        <Card><Vazio>Nenhuma matéria ativa. Clique em “+ Matéria”.</Vazio></Card>
      )}
      {resumos.map((r) => {
        const f = r.frequencia
        return (
          <Card key={r.turma.id}>
            <div className="flex items-start gap-2">
              <button className="min-w-0 flex-1 text-left" onClick={() => setAberta(aberta === r.turma.id ? null : r.turma.id)}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{r.turma.nome}</div>
                    <div className="text-xs text-slate-500">
                      {r.turma.semestre}
                      {r.turma.professor ? ` · ${r.turma.professor}` : ''}
                      {r.turma.sala ? ` · ${r.turma.sala}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Selo cor={f.situacao === 'ok' ? 'verde' : f.situacao === 'atencao' ? 'ambar' : 'vermelho'}>
                      {f.faltas}/{f.permitidas} faltas
                    </Selo>
                    <Selo cor="indigo">média {r.media == null ? '—' : fmt(r.media)}</Selo>
                  </div>
                </div>
                <Barra
                  valor={f.permitidas ? f.faltas / f.permitidas : 0}
                  cor={f.situacao === 'ok' ? 'verde' : f.situacao === 'atencao' ? 'ambar' : 'vermelho'}
                />
              </button>
              <Botao
                variante={editandoId === r.turma.id ? 'primario' : 'secundario'}
                className="shrink-0 px-3 py-1.5 text-xs"
                onClick={() => setEditandoId(editandoId === r.turma.id ? null : r.turma.id)}
              >
                ✏️ Editar
              </Botao>
            </div>
            {editandoId === r.turma.id && <EditarTurma r={r} fechar={() => setEditandoId(null)} />}
            {aberta === r.turma.id && <DetalheTurma r={r} />}
          </Card>
        )
      })}
    </Pagina>
  )
}
