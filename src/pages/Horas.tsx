import { useState } from 'react'
import { useCurso, useLista, useTabela } from '../lib/db'
import { dataBr, dataIso, fmt, progresso } from '../lib/calculos'
import { Barra, Botao, Campo, Card, Pagina, Vazio, lerForm, numOuNull } from '../components/ui'
import { Estagios } from '../components/Estagios'
import type { TipoHoras } from '../lib/types'

const ROTULO: Record<TipoHoras, string> = { estagio: 'Estágio', optativa: 'Optativas (avulsas)', complementar: 'Complementares' }

export default function Horas() {
  const curso = useCurso()
  const registros = useLista('horas_registros').data ?? []
  const disciplinas = useLista('disciplinas').data ?? []
  const { inserir, remover } = useTabela('horas_registros')
  const [aba, setAba] = useState<TipoHoras>('estagio')
  const p = progresso(curso, disciplinas, registros)
  const item = { estagio: p.estagio, optativa: p.optativas, complementar: p.complementares }[aba]
  const lista = registros.filter((r) => r.tipo === aba).sort((a, b) => b.data.localeCompare(a.data))

  return (
    <Pagina titulo="Estágio e horas">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(ROTULO) as TipoHoras[]).map((t) => (
          <Botao key={t} variante={aba === t ? 'primario' : 'secundario'} onClick={() => setAba(t)}>{ROTULO[t]}</Botao>
        ))}
      </div>

      <Card>
        <div className="mb-2 flex items-end justify-between">
          <span className="text-3xl font-bold text-indigo-700">{fmt(item.feito)} h</span>
          <span className="text-sm text-slate-500">
            {item.exigido ? <>de {fmt(item.exigido, 0)} h · faltam <b>{fmt(item.falta)} h</b></> : 'defina o total exigido em Configurações'}
          </span>
        </div>
        <Barra valor={item.pct} cor={item.pct >= 1 ? 'verde' : 'indigo'} />
        {aba === 'optativa' && (
          <p className="mt-2 text-xs text-slate-500">Inclui as disciplinas optativas marcadas como aprovadas na grade curricular.</p>
        )}
      </Card>

      {aba === 'estagio' && <Estagios />}

      <Card titulo="Lançar horas">
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            const f = lerForm(e)
            inserir.mutate({ tipo: aba, descricao: f.descricao, data: f.data, horas: numOuNull(f.horas) ?? 0, comprovante: f.comprovante || null })
            e.currentTarget.reset()
          }}
        >
          <Campo rotulo="Descrição" name="descricao" required placeholder={aba === 'estagio' ? 'Empresa / semana' : 'Curso, palestra…'} className="sm:col-span-2" />
          <Campo rotulo="Data" name="data" type="date" required defaultValue={dataIso()} />
          <Campo rotulo="Horas" name="horas" required inputMode="decimal" />
          <Campo rotulo="Link do comprovante (opcional)" name="comprovante" type="url" className="sm:col-span-3" />
          <Botao type="submit" className="self-end">Adicionar</Botao>
        </form>
      </Card>

      <Card titulo="Registros">
        {lista.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {lista.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-2">
                <span className="w-20 text-slate-500">{dataBr(r.data)}</span>
                <span className="flex-1">
                  {r.descricao}
                  {r.comprovante && <a href={r.comprovante} target="_blank" rel="noreferrer" className="ml-2 text-indigo-600 underline">comprovante</a>}
                </span>
                <b>{fmt(Number(r.horas))} h</b>
                <Botao variante="fantasma" className="px-2 py-1" onClick={() => remover.mutate(r.id)}>✕</Botao>
              </li>
            ))}
          </ul>
        ) : (
          <Vazio>Nenhum registro ainda.</Vazio>
        )}
      </Card>
    </Pagina>
  )
}
