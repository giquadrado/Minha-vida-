import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useCurso, useLista, useTabela } from '../lib/db'
import { dataIso } from '../lib/calculos'
import { supabase } from '../lib/supabase'
import { ORDEM_BACKUP, analisarDuplicatas, executarLimpeza, restaurarBackup } from '../lib/backup'
import { temDuplicatas, type PlanoLimpeza } from '../lib/duplicatas'
import { Botao, Campo, Card, Pagina, lerForm, numOuNull } from '../components/ui'

const TABELAS = ORDEM_BACKUP

export default function Config() {
  const curso = useCurso()
  const cursos = useLista('cursos')
  const encerradas = (useLista('turmas').data ?? []).filter((t) => !t.ativa)
  const turmas = useTabela('turmas')
  const { salvar } = useTabela('cursos')
  const [email, setEmail] = useState('')
  const [salvo, setSalvo] = useState(false)
  const qc = useQueryClient()
  const [apagarAntes, setApagarAntes] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const [msgBackup, setMsgBackup] = useState<{ ok: boolean; texto: string } | null>(null)

  const [plano, setPlano] = useState<PlanoLimpeza | null>(null)
  const [limpando, setLimpando] = useState(false)
  const [msgLimpeza, setMsgLimpeza] = useState<{ ok: boolean; texto: string } | null>(null)

  async function procurarDuplicadas() {
    setMsgLimpeza(null)
    setPlano(null)
    setLimpando(true)
    try {
      const p = await analisarDuplicatas()
      setPlano(p)
      if (!temDuplicatas(p)) setMsgLimpeza({ ok: true, texto: 'Não encontrei nada repetido. Tudo certo! ✅' })
    } catch (e) {
      setMsgLimpeza({ ok: false, texto: `Não consegui analisar (${e instanceof Error ? e.message : String(e)}).` })
    } finally {
      setLimpando(false)
    }
  }

  async function removerDuplicadas() {
    if (!plano) return
    setLimpando(true)
    try {
      await executarLimpeza(plano)
      await qc.invalidateQueries()
      setMsgLimpeza({
        ok: true,
        texto: `Pronto! Removi ${plano.disciplinasRemover.length} matéria(s) da grade, ${plano.turmasRemover.length} matéria(s) do semestre e ${plano.ofertasRemover.length} horário(s) repetidos.`,
      })
      setPlano(null)
    } catch (e) {
      setMsgLimpeza({ ok: false, texto: `Parei no meio (${e instanceof Error ? e.message : String(e)}). Clique em “Procurar duplicadas” de novo para ver o que falta.` })
    } finally {
      setLimpando(false)
    }
  }

  async function restaurar(arquivo: File) {
    setMsgBackup(null)
    let dados: Record<string, unknown>
    try {
      dados = JSON.parse(await arquivo.text())
    } catch {
      return setMsgBackup({ ok: false, texto: 'Esse arquivo não é um backup válido (JSON).' })
    }
    const resumo = ORDEM_BACKUP.filter((t) => Array.isArray(dados[t]) && (dados[t] as unknown[]).length).map((t) => `${t}: ${(dados[t] as unknown[]).length}`)
    if (!resumo.length) return setMsgBackup({ ok: false, texto: 'O arquivo não tem dados do Minha Faculdade.' })
    const aviso = apagarAntes
      ? 'ATENÇÃO: vou APAGAR os dados atuais dessas tabelas (e o que depende delas, como presenças e notas) antes de carregar o arquivo.'
      : 'Os dados do arquivo serão adicionados à sua conta (o que já existe com o mesmo id é atualizado).'
    if (!confirm(`${aviso}\n\nConteúdo: ${resumo.join(' · ')}\n\nContinuar?`)) return
    setRestaurando(true)
    try {
      const log = await restaurarBackup(dados, apagarAntes)
      await qc.invalidateQueries()
      setMsgBackup({ ok: true, texto: `Pronto! Carreguei ${log.join(' · ')}.` })
    } catch (e) {
      setMsgBackup({ ok: false, texto: `Não consegui carregar (${e instanceof Error ? e.message : String(e)}). Se disser que a tabela não existe, rode o supabase/migracao-2.sql no Supabase.` })
    } finally {
      setRestaurando(false)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  async function salvarCurso(e: React.FormEvent<HTMLFormElement>) {
    const f = lerForm(e)
    await salvar.mutateAsync({
      linha: {
        ...(curso.id ? { id: curso.id } : {}),
        nome: f.nome,
        carga_obrigatoria: Number(f.carga_obrigatoria || 0),
        horas_optativas: Number(f.horas_optativas || 0),
        horas_estagio: Number(f.horas_estagio || 0),
        horas_complementares: Number(f.horas_complementares || 0),
        freq_minima: (numOuNull(f.freq_minima) ?? 75) / 100,
        media_aprovacao: numOuNull(f.media_aprovacao) ?? 6,
      },
      conflito: 'user_id',
    })
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  async function exportar() {
    const backup: Record<string, unknown> = { exportado_em: new Date().toISOString() }
    for (const t of TABELAS) backup[t] = (await supabase.from(t).select('*')).data
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `minha-faculdade-${dataIso()}.json` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Pagina titulo="Configurações">
      <nav className="grid grid-cols-2 gap-2 md:hidden">
        <Link to="/semestre"><Botao variante="secundario" className="w-full">📚 Matérias</Botao></Link>
        <Link to="/sugestoes"><Botao variante="secundario" className="w-full">🧭 Montar semestre</Botao></Link>
        <Link to="/grade"><Botao variante="secundario" className="w-full">🎓 Grade</Botao></Link>
        <Link to="/horas"><Botao variante="secundario" className="w-full">⏱️ Horas</Botao></Link>
        <Link to="/importar" className="col-span-2"><Botao variante="secundario" className="w-full">📥 Enviar documentos</Botao></Link>
      </nav>

      <Card titulo="Regras do curso">
        {!cursos.isLoading && (
          <form key={curso.id || 'novo'} onSubmit={salvarCurso} className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome do curso" name="nome" defaultValue={curso.nome} className="sm:col-span-2" />
            <Campo rotulo="Carga de obrigatórias (h) — 0 = somar a grade" name="carga_obrigatoria" type="number" defaultValue={curso.carga_obrigatoria} />
            <Campo rotulo="Horas optativas exigidas" name="horas_optativas" type="number" defaultValue={curso.horas_optativas} />
            <Campo rotulo="Horas de estágio exigidas" name="horas_estagio" type="number" defaultValue={curso.horas_estagio} />
            <Campo rotulo="Horas complementares exigidas" name="horas_complementares" type="number" defaultValue={curso.horas_complementares} />
            <Campo rotulo="Frequência mínima (%)" name="freq_minima" defaultValue={Math.round(Number(curso.freq_minima) * 100)} />
            <Campo rotulo="Média para aprovação" name="media_aprovacao" defaultValue={String(curso.media_aprovacao)} />
            <div className="flex items-center gap-3 sm:col-span-2">
              <Botao type="submit" disabled={salvar.isPending}>Salvar</Botao>
              {salvo && <span className="text-sm text-emerald-700">Salvo ✓</span>}
            </div>
          </form>
        )}
      </Card>

      {encerradas.length > 0 && (
        <Card titulo="Matérias encerradas">
          <ul className="divide-y divide-slate-100 text-sm">
            {encerradas.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span>{t.nome} <span className="text-slate-500">· {t.semestre}</span></span>
                <Botao variante="fantasma" onClick={() => turmas.atualizar.mutate({ id: t.id, ativa: true })}>Reabrir</Botao>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card titulo="Conta e dados">
        <p className="mb-3 text-sm text-slate-600">Conectado como <b>{email}</b>. Seus dados ficam sincronizados em todos os aparelhos em que você entrar.</p>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={exportar}>Baixar backup (JSON)</Botao>
          <Botao variante="secundario" onClick={() => supabase.auth.signOut()}>Sair</Botao>
        </div>
      </Card>

      <Card titulo="🧹 Limpar matérias duplicadas">
        <p className="mb-3 text-sm text-slate-600">
          Procura matérias repetidas na grade (mesmo código), matérias do semestre repetidas e horários do quadro repetidos. Antes de apagar,
          mostro o que encontrei. Fica a cópia mais usada, com a situação mais avançada (por exemplo, “aprovada”), e as turmas e horários ligados às
          outras cópias passam para ela.
        </p>
        <Botao variante="secundario" onClick={procurarDuplicadas} disabled={limpando}>
          {limpando && !plano ? 'Procurando…' : 'Procurar duplicadas'}
        </Botao>

        {plano && temDuplicatas(plano) && (
          <div className="mt-4 rounded-2xl bg-amber-100 p-4 text-sm text-amber-900">
            <div className="mb-2 font-semibold">Encontrei repetições. Vou apagar:</div>
            <ul className="mb-3 list-disc pl-5">
              <li><b>{plano.disciplinasRemover.length}</b> matéria(s) da grade curricular repetida(s)</li>
              <li><b>{plano.turmasRemover.length}</b> matéria(s) do semestre repetida(s)</li>
              <li><b>{plano.ofertasRemover.length}</b> horário(s) do quadro repetido(s)</li>
            </ul>
            {plano.turmasPreservadas > 0 && (
              <p className="mb-3 text-xs">Mantive {plano.turmasPreservadas} matéria(s) do semestre repetida(s) porque têm faltas, notas ou horários lançados. Você pode apagá-las manualmente.</p>
            )}
            <div className="flex gap-2">
              <Botao variante="perigo" onClick={removerDuplicadas} disabled={limpando}>{limpando ? 'Removendo…' : 'Remover agora'}</Botao>
              <Botao variante="secundario" onClick={() => setPlano(null)} disabled={limpando}>Cancelar</Botao>
            </div>
          </div>
        )}
        {msgLimpeza && <p className={`mt-3 text-sm ${msgLimpeza.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msgLimpeza.texto}</p>}
      </Card>

      <Card titulo="📦 Carregar dados de um arquivo">
        <p className="mb-3 text-sm text-slate-600">
          Escolha um arquivo de backup (.json) para colocar na sua conta: grade, matérias cursadas, regras do curso e quadro de horários.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className={`cursor-pointer rounded-xl bg-linear-to-r from-[#6d4aff] to-[#b24fe6] px-4 py-2.5 text-sm font-semibold text-white ${restaurando ? 'pointer-events-none opacity-50' : ''}`}>
            {restaurando ? 'Carregando…' : 'Escolher arquivo .json'}
            <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && restaurar(e.target.files[0])} />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={apagarAntes} onChange={(e) => setApagarAntes(e.target.checked)} />
            Apagar antes os dados atuais dessas tabelas
          </label>
        </div>
        {msgBackup && <p className={`mt-3 text-sm ${msgBackup.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msgBackup.texto}</p>}
      </Card>
    </Pagina>
  )
}
