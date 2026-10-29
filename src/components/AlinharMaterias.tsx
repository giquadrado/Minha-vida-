import { useState } from 'react'
import { useTabela } from '../lib/db'
import { alinhar, conflitosDaOpcao, linhasDeHorario, opcoesDaTurma, type Ocupado } from '../lib/semana'
import type { OpcaoHorario } from '../lib/sugestoes'
import { DIAS_CURTOS, type Oferta, type Turma } from '../lib/types'
import { Botao, Card } from './ui'

const textoOpcao = (o: OpcaoHorario) => o.reunioes.map((r) => `${DIAS_CURTOS[r.dia]} ${r.inicio}–${r.fim}`).join(' · ')

/** Escolhe, no quadro de horários, a turma de cada matéria em andamento que ainda não tem aula na semana. */
export function AlinharMaterias({ pendentes, ofertas, ocupados }: { pendentes: Turma[]; ofertas: Oferta[]; ocupados: Ocupado[] }) {
  const { inserir } = useTabela('horarios')
  const [escolha, setEscolha] = useState<Record<string, number>>({})
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  async function usar(turma: Turma, opcao: OpcaoHorario) {
    setErro('')
    setOcupadoId(turma.id)
    try {
      await inserir.mutateAsync(linhasDeHorario(turma, opcao))
    } catch (e) {
      setErro((e as { message?: string }).message ?? String(e))
    } finally {
      setOcupadoId(null)
    }
  }

  async function alinharTudo() {
    setErro('')
    setOcupadoId('todas')
    try {
      for (const e of alinhar(pendentes, ofertas, ocupados)) await inserir.mutateAsync(linhasDeHorario(e.turma, e.opcao))
    } catch (e) {
      setErro((e as { message?: string }).message ?? String(e))
    } finally {
      setOcupadoId(null)
    }
  }

  const comOpcoes = pendentes.filter((t) => opcoesDaTurma(t, ofertas).length)

  return (
    <Card titulo="📚 Alinhar a semana com as matérias que estou cursando" className="border-indigo-400/40">
      <p className="mb-3 text-sm text-slate-600">
        Estas matérias estão em andamento, mas ainda não têm aula na sua semana. Escolha a turma de cada uma no quadro de horários, ou deixe que eu
        escolho a que menos bate com o que você já tem.
      </p>
      {comOpcoes.length > 1 && (
        <Botao className="mb-3" onClick={alinharTudo} disabled={ocupadoId !== null}>
          {ocupadoId === 'todas' ? 'Alinhando…' : '✨ Alinhar todas automaticamente'}
        </Botao>
      )}
      <ul className="divide-y divide-slate-100">
        {pendentes.map((t) => {
          const opcoes = opcoesDaTurma(t, ofertas)
          if (!opcoes.length)
            return (
              <li key={t.id} className="py-3 text-sm">
                <b>{t.nome}</b> <span className="text-slate-500">— não aparece no quadro de horários. Cadastre manualmente em “+ Horário”.</span>
              </li>
            )
          const pontuadas = opcoes.map((o, i) => ({ o, i, c: conflitosDaOpcao(o, ocupados) }))
          const melhor = pontuadas.reduce((m, x) => (x.c.length < m.c.length ? x : m), pontuadas[0]).i
          const i = escolha[t.id] ?? melhor
          const atual = pontuadas[i]
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
              <div className="min-w-0 flex-1 basis-48">
                <div className="font-semibold">{t.nome}</div>
                {atual.c.length > 0 && <div className="text-xs text-amber-700">⚠️ bate com {[...new Set(atual.c.map((x) => x.titulo))].join(', ')}</div>}
              </div>
              <select
                value={i}
                onChange={(e) => setEscolha({ ...escolha, [t.id]: Number(e.target.value) })}
                className="max-w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                {pontuadas.map((p) => (
                  <option key={p.i} value={p.i}>
                    {p.o.rotulo ?? 'turma única'} — {textoOpcao(p.o)}
                    {p.c.length ? ' ⚠️' : ''}
                  </option>
                ))}
              </select>
              <Botao variante="secundario" className="px-3 py-2 text-xs" disabled={ocupadoId !== null} onClick={() => usar(t, atual.o)}>
                {ocupadoId === t.id ? 'Salvando…' : 'Usar este horário'}
              </Botao>
            </li>
          )
        })}
      </ul>
      {erro && <p className="mt-2 text-sm text-rose-600">{erro}</p>}
    </Card>
  )
}
