import { useState } from 'react'
import { useLista, useTabela } from '../lib/db'
import { supabase } from '../lib/supabase'
import { dataBr } from '../lib/calculos'
import { MODELO_RELATORIO } from '../lib/modelos'
import { Botao, Campo, Card, Selecao, Selo, Vazio, lerForm, numOuNull } from './ui'
import type { Estagio, StatusRelatorio } from '../lib/types'

const RELATORIO: [StatusRelatorio, string][] = [
  ['nao_iniciado', 'Ainda não comecei'],
  ['escrevendo', 'Estou escrevendo'],
  ['pronto', 'Pronto, falta entregar'],
  ['entregue', 'Entregue ✅'],
]
const COR_RELATORIO = { nao_iniciado: 'vermelho', escrevendo: 'ambar', pronto: 'indigo', entregue: 'verde' } as const

const MAX_MB = 15

function periodo(e: Estagio) {
  if (!e.inicio && !e.fim) return 'datas não informadas'
  return `${e.inicio ? dataBr(e.inicio) : '?'} → ${e.fim ? dataBr(e.fim) : 'em andamento'}`
}

export function Estagios() {
  const consulta = useLista('estagios')
  const estagios = consulta.data ?? []
  const { inserir, atualizar, remover } = useTabela('estagios')
  const [editando, setEditando] = useState<Estagio | 'novo' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)

  const atual = editando && editando !== 'novo' ? editando : null

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    const f = lerForm(e)
    const linha = {
      empresa: f.empresa.trim(),
      inicio: f.inicio || null,
      fim: f.fim || null,
      horas: numOuNull(f.horas),
      relatorio: f.relatorio as StatusRelatorio,
      observacoes: f.observacoes.trim() || null,
    }
    if (linha.inicio && linha.fim && linha.fim < linha.inicio) return setMsg({ ok: false, texto: 'A data de finalização é antes da data de início.' })
    if (atual) await atualizar.mutateAsync({ id: atual.id, ...linha })
    else await inserir.mutateAsync(linha)
    setEditando(null)
    setMsg(null)
  }

  async function anexar(est: Estagio, arquivo: File) {
    setMsg(null)
    if (arquivo.size > MAX_MB * 1024 * 1024) return setMsg({ ok: false, texto: `Arquivo grande demais (máximo ${MAX_MB} MB).` })
    setEnviando(est.id)
    try {
      const { data: u } = await supabase.auth.getUser()
      if (!u.user) throw new Error('Você precisa estar logado.')
      const caminho = `${u.user.id}/${est.id}/${Date.now()}-${arquivo.name.replace(/[^\w.\-]+/g, '_')}`
      const { error } = await supabase.storage.from('relatorios').upload(caminho, arquivo)
      if (error) throw error
      if (est.relatorio_arquivo) await supabase.storage.from('relatorios').remove([est.relatorio_arquivo])
      await atualizar.mutateAsync({
        id: est.id,
        relatorio_arquivo: caminho,
        relatorio_nome: arquivo.name,
        relatorio: est.relatorio === 'nao_iniciado' ? 'escrevendo' : est.relatorio,
      })
      setMsg({ ok: true, texto: `“${arquivo.name}” anexado.` })
    } catch (e) {
      const m = e instanceof Error ? e.message : (e as { message?: string }).message ?? String(e)
      setMsg({ ok: false, texto: `Não consegui anexar (${m}). Se falar de “bucket”, rode o supabase/migracao-3.sql no Supabase.` })
    } finally {
      setEnviando(null)
    }
  }

  async function baixar(est: Estagio) {
    if (!est.relatorio_arquivo) return
    const { data, error } = await supabase.storage.from('relatorios').createSignedUrl(est.relatorio_arquivo, 120, { download: est.relatorio_nome ?? true })
    if (error || !data) return setMsg({ ok: false, texto: `Não consegui abrir o arquivo (${error?.message ?? 'erro'}).` })
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function removerAnexo(est: Estagio) {
    if (!est.relatorio_arquivo || !confirm('Remover o arquivo anexado?')) return
    await supabase.storage.from('relatorios').remove([est.relatorio_arquivo])
    await atualizar.mutateAsync({ id: est.id, relatorio_arquivo: null, relatorio_nome: null })
  }

  return (
    <>
      <Card titulo="📄 Modelo do relatório de estágio">
        {MODELO_RELATORIO ? (
          <div className="flex flex-wrap items-center gap-3">
            <a href={MODELO_RELATORIO.arquivo} download={MODELO_RELATORIO.nome}>
              <Botao>⬇️ Baixar o modelo (.doc)</Botao>
            </a>
            <span className="text-sm text-slate-500">{MODELO_RELATORIO.descricao}</span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">O modelo ainda não foi anexado ao app.</p>
        )}
        <p className="mt-2 text-xs text-slate-500">Use como base para escrever o seu relatório e anexe o seu arquivo pronto no estágio abaixo.</p>
      </Card>

      <Card
        titulo="🏢 Meu estágio"
        className={editando ? 'border-indigo-400/40' : ''}
      >
        {consulta.isError && (
          <p className="mb-3 rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
            A tabela de estágios ainda não existe no Supabase. Rode o arquivo <code>supabase/migracao-3.sql</code> no SQL Editor e atualize a página.
          </p>
        )}

        {estagios.length === 0 && !editando && !consulta.isError && <Vazio>Nenhum estágio cadastrado ainda.</Vazio>}

        <ul className="space-y-3">
          {estagios.map((est) => (
            <li key={est.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold">{est.empresa}</div>
                  <div className="text-sm text-slate-500">
                    {periodo(est)}
                    {est.horas != null ? ` · ${est.horas} h` : ''}
                  </div>
                </div>
                <Selo cor={COR_RELATORIO[est.relatorio]}>
                  Relatório: {RELATORIO.find(([v]) => v === est.relatorio)?.[1]}
                </Selo>
              </div>
              {est.observacoes && <p className="mt-2 text-sm text-slate-600">{est.observacoes}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {est.relatorio_arquivo ? (
                  <>
                    <Botao variante="secundario" className="px-3 py-1.5 text-xs" onClick={() => baixar(est)}>📎 {est.relatorio_nome ?? 'relatório'}</Botao>
                    <Botao variante="fantasma" className="px-2 py-1 text-xs" onClick={() => removerAnexo(est)}>Remover anexo</Botao>
                  </>
                ) : (
                  <span className="text-xs text-slate-500">Nenhum relatório anexado.</span>
                )}
                <label className={`cursor-pointer rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 ${enviando === est.id ? 'pointer-events-none opacity-50' : ''}`}>
                  {enviando === est.id ? 'Enviando…' : est.relatorio_arquivo ? 'Trocar arquivo' : '📎 Anexar relatório'}
                  <input type="file" hidden accept=".pdf,.doc,.docx,.odt" onChange={(e) => e.target.files?.[0] && anexar(est, e.target.files[0])} />
                </label>
                <span className="flex-1" />
                <Botao variante="fantasma" className="px-2 py-1 text-xs" onClick={() => { setMsg(null); setEditando(est) }}>✏️ Editar</Botao>
                <Botao variante="fantasma" className="px-2 py-1 text-xs text-rose-600" onClick={() => confirm(`Excluir o estágio em ${est.empresa}?`) && remover.mutate(est.id)}>Excluir</Botao>
              </div>
            </li>
          ))}
        </ul>

        {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.texto}</p>}

        {editando ? (
          <form key={atual?.id ?? 'novo'} onSubmit={salvar} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
            <Campo rotulo="Empresa" name="empresa" required defaultValue={atual?.empresa} className="sm:col-span-2" />
            <Campo rotulo="Data de início" name="inicio" type="date" defaultValue={atual?.inicio ?? ''} />
            <Campo rotulo="Data de finalização (vazio = em andamento)" name="fim" type="date" defaultValue={atual?.fim ?? ''} />
            <Campo rotulo="Horas totais do estágio" name="horas" inputMode="decimal" defaultValue={atual?.horas ?? ''} placeholder="ex.: 180" />
            <Selecao rotulo="Relatório" name="relatorio" defaultValue={atual?.relatorio ?? 'nao_iniciado'} opcoes={RELATORIO} />
            <Campo rotulo="Observações (supervisor, setor, atividades…)" name="observacoes" defaultValue={atual?.observacoes ?? ''} className="sm:col-span-2" />
            <div className="flex gap-2 sm:col-span-2">
              <Botao type="submit" disabled={inserir.isPending || atualizar.isPending}>Salvar estágio</Botao>
              <Botao type="button" variante="secundario" onClick={() => { setEditando(null); setMsg(null) }}>Cancelar</Botao>
            </div>
          </form>
        ) : (
          <Botao className="mt-4" onClick={() => { setMsg(null); setEditando('novo') }}>+ Cadastrar estágio</Botao>
        )}
      </Card>
    </>
  )
}
