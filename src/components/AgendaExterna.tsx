import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { dataIso } from '../lib/calculos'
import { gerarIcs, lerIcs, type ResultadoIcs } from '../lib/ics'
import { ORDEM_TIPOS, TIPOS } from '../lib/tipos'
import type { Horario, TipoHorario } from '../lib/types'
import { Botao, Campo, Card, Selecao } from './ui'

/** Fim do semestre letivo corrente (aproximado): 15/07 no 1º semestre, 20/12 no 2º. */
function fimDoSemestre(d = new Date()) {
  return d.getMonth() < 6 ? `${d.getFullYear()}-07-15` : `${d.getFullYear()}-12-20`
}

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nome })
  a.click()
  URL.revokeObjectURL(url)
}

const msgErro = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string }).message ?? String(e))

export function AgendaExterna({ horarios }: { horarios: Horario[] }) {
  const qc = useQueryClient()
  const [de, setDe] = useState(dataIso())
  const [ate, setAte] = useState(fimDoSemestre())
  const [lido, setLido] = useState<ResultadoIcs | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [tipoImport, setTipoImport] = useState<TipoHorario>('reuniao')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [token, setToken] = useState<string | null | 'erro'>(null)

  const nEventos = (gerarIcs(horarios, { inicio: de, fim: ate }).match(/BEGIN:VEVENT/g) ?? []).length

  useEffect(() => {
    supabase
      .from('calendario_tokens')
      .select('token')
      .maybeSingle()
      .then(({ data, error }) => setToken(error ? 'erro' : (data?.token ?? null)))
  }, [])

  function exportar() {
    baixar(`minha-faculdade-${de}.ics`, gerarIcs(horarios, { inicio: de, fim: ate }), 'text/calendar')
    setMsg({ ok: true, texto: `Baixei ${nEventos} evento(s). Agora importe o arquivo no Google Agenda ou no Outlook (passo a passo abaixo).` })
  }

  async function escolherArquivo(arquivo: File) {
    setMsg(null)
    setNomeArquivo(arquivo.name)
    const r = lerIcs(await arquivo.text())
    setLido(r)
    if (!r.eventos.length) setMsg({ ok: false, texto: 'Não encontrei eventos para importar nesse arquivo.' })
  }

  async function importar() {
    if (!lido?.eventos.length) return
    setOcupado(true)
    setMsg(null)
    try {
      const { data: existentes, error } = await supabase.from('horarios').select('id, origem_uid').not('origem_uid', 'is', null)
      if (error) throw error
      const idPorOrigem = new Map((existentes ?? []).map((x) => [x.origem_uid as string, x.id as string]))

      const novos = []
      let atualizados = 0
      for (const e of lido.eventos) {
        const campos = { tipo: tipoImport, titulo: e.titulo, dia_semana: e.dia_semana, inicio: e.inicio, fim: e.fim, local: e.local, data: e.data, aulas: 1, turma_id: null }
        const id = idPorOrigem.get(e.origem)
        if (id) {
          const { error: e2 } = await supabase.from('horarios').update(campos).eq('id', id)
          if (e2) throw e2
          atualizados++
        } else novos.push({ ...campos, origem_uid: e.origem })
      }
      for (let i = 0; i < novos.length; i += 100) {
        const { error: e3 } = await supabase.from('horarios').insert(novos.slice(i, i + 100))
        if (e3) throw e3
      }
      await qc.invalidateQueries({ queryKey: ['horarios'] })
      setMsg({ ok: true, texto: `Pronto! ${novos.length} evento(s) novo(s)${atualizados ? ` e ${atualizados} atualizado(s)` : ''}. Importar o mesmo arquivo de novo não duplica.` })
      setLido(null)
      setNomeArquivo('')
    } catch (e) {
      setMsg({ ok: false, texto: `Não consegui importar (${msgErro(e)}). Se falar de coluna ou tipo, rode o supabase/migracao-4.sql no Supabase.` })
    } finally {
      setOcupado(false)
    }
  }

  async function gerarLink(trocar = false) {
    setOcupado(true)
    setMsg(null)
    try {
      if (trocar) {
        const { error } = await supabase.from('calendario_tokens').delete().not('user_id', 'is', null)
        if (error) throw error
      }
      const { data, error } = await supabase.from('calendario_tokens').insert({}).select('token').single()
      if (error) throw error
      setToken(data.token)
    } catch (e) {
      setMsg({ ok: false, texto: `Não consegui gerar o link (${msgErro(e)}). Rode o supabase/migracao-4.sql no Supabase.` })
    } finally {
      setOcupado(false)
    }
  }

  const link = token && token !== 'erro' ? `${location.origin}/api/calendario.ics?token=${token}` : ''
  const local = /^(localhost|127\.|192\.168\.)/.test(location.hostname)

  return (
    <Card titulo="🔄 Agenda do Google e do Outlook">
      <p className="mb-4 text-sm text-slate-600">
        Leve seus horários para o Google Agenda ou Outlook, e traga de lá as suas reuniões. Funciona com os dois, pelo formato padrão <b>.ics</b>.
      </p>

      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold">⬆️ Levar o app para a agenda</h3>
          <div className="flex flex-wrap items-end gap-3">
            <Campo rotulo="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            <Campo rotulo="Até (fim das repetições)" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            <Botao onClick={exportar} disabled={!nEventos}>⬇️ Baixar agenda (.ics) · {nEventos} evento(s)</Botao>
          </div>
          <details className="mt-2 text-xs text-slate-500">
            <summary className="cursor-pointer">Como importar o arquivo</summary>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><b>Google Agenda</b> (no computador): ⚙️ Configurações → Importar e exportar → Importar → escolha o arquivo.</li>
              <li><b>Outlook</b>: Adicionar calendário → Carregar de um arquivo → escolha o arquivo.</li>
              <li>Os eventos que vieram de outra agenda não são devolvidos para ela, para não duplicar.</li>
            </ul>
          </details>
        </section>

        <section className="border-t border-slate-200 pt-4">
          <h3 className="mb-2 text-sm font-semibold">⬇️ Trazer reuniões da agenda para o app</h3>
          <p className="mb-2 text-xs text-slate-500">
            No Google Agenda: ⚙️ Configurações → Importar e exportar → Exportar. No Outlook: Calendário → Compartilhar/Publicar → Exportar .ics. Depois escolha o
            arquivo aqui.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100">
              {nomeArquivo || 'Escolher arquivo .ics'}
              <input type="file" accept=".ics,text/calendar" hidden onChange={(e) => e.target.files?.[0] && escolherArquivo(e.target.files[0])} />
            </label>
            <Selecao
              rotulo="Tratar como"
              value={tipoImport}
              onChange={(e) => setTipoImport(e.target.value as TipoHorario)}
              opcoes={ORDEM_TIPOS.filter((t) => t !== 'aula').map((t): [string, string] => [t, `${TIPOS[t].icone} ${TIPOS[t].rotulo}`])}
            />
          </div>
          {lido && lido.eventos.length > 0 && (
            <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm">
              Encontrei <b>{lido.eventos.filter((e) => !e.data).length}</b> evento(s) que repetem toda semana e{' '}
              <b>{lido.eventos.filter((e) => e.data).length}</b> de um dia só.
              {(lido.ignorados.todoDia > 0 || lido.ignorados.passados > 0 || lido.ignorados.invalidos > 0) && (
                <span className="text-slate-500">
                  {' '}Deixei de fora: {lido.ignorados.todoDia} de dia inteiro, {lido.ignorados.passados} já passado(s), {lido.ignorados.invalidos} inválido(s).
                </span>
              )}
              <div className="mt-2">
                <Botao onClick={importar} disabled={ocupado}>{ocupado ? 'Importando…' : `Importar ${lido.eventos.length} evento(s)`}</Botao>
              </div>
            </div>
          )}
        </section>

        <section className="border-t border-slate-200 pt-4">
          <h3 className="mb-2 text-sm font-semibold">🔗 Manter a agenda sempre atualizada (assinatura)</h3>
          <p className="mb-2 text-xs text-slate-500">
            Em vez de importar arquivos, você assina um link e a agenda se atualiza sozinha quando você muda algo aqui (o Google pode levar até um dia; o
            Outlook, algumas horas). É de mão única: do app para a agenda.
          </p>
          {local && (
            <p className="mb-2 rounded-xl bg-amber-100 p-2 text-xs text-amber-900">
              Este endereço ({location.host}) só existe no seu computador. O Google e o Outlook só conseguem assinar depois que o app for publicado na
              internet (por exemplo, na Vercel). Quando publicar, o link muda para o endereço do site.
            </p>
          )}
          {token === 'erro' && <p className="text-xs text-rose-600">Recurso indisponível: rode o supabase/migracao-4.sql no Supabase.</p>}
          {token === null && <Botao variante="secundario" onClick={() => gerarLink()} disabled={ocupado}>Gerar link de assinatura</Botao>}
          {link && (
            <div className="space-y-2">
              <input readOnly value={link} onFocus={(e) => e.target.select()} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs" />
              <div className="flex flex-wrap gap-2">
                <Botao variante="secundario" className="px-3 py-1.5 text-xs" onClick={() => navigator.clipboard.writeText(link).then(() => setMsg({ ok: true, texto: 'Link copiado.' }))}>Copiar link</Botao>
                <Botao variante="fantasma" className="px-3 py-1.5 text-xs" disabled={ocupado} onClick={() => confirm('O link antigo para de funcionar. Gerar um novo?') && gerarLink(true)}>Gerar um novo link</Botao>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
                <li><b>Google Agenda</b>: “Outras agendas” (+) → Por URL → cole o link.</li>
                <li><b>Outlook</b>: Adicionar calendário → Assinar da Web → cole o link.</li>
                <li>Quem tiver o link vê os seus horários. Não compartilhe.</li>
              </ul>
            </div>
          )}
        </section>
      </div>

      {msg && <p className={`mt-4 text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.texto}</p>}
    </Card>
  )
}
