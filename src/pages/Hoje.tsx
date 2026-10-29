import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLista, useTabela } from '../lib/db'
import { horariosAtivos, horariosDaData } from '../lib/semana'
import { TIPOS } from '../lib/tipos'
import { dataIso, hhmm, minutos } from '../lib/calculos'
import { useResumoTurmas } from '../lib/resumo'
import { Botao, Card, Pagina, Selo, Vazio } from '../components/ui'
import { DIAS } from '../lib/types'

export default function Hoje() {
  const [data, setData] = useState(dataIso())
  const todosHorarios = useLista('horarios').data ?? []
  const turmasTodas = useLista('turmas').data ?? []
  const horarios = horariosAtivos(todosHorarios, turmasTodas)
  const presencas = useLista('presencas').data ?? []
  const { resumos } = useResumoTurmas()
  const { salvar, remover } = useTabela('presencas')

  const dia = new Date(`${data}T12:00:00`).getDay()
  const doDia = horariosDaData(horarios, data).sort((a, b) => minutos(a.inicio) - minutos(b.inicio))

  function mudarDia(delta: number) {
    const d = new Date(`${data}T12:00:00`)
    d.setDate(d.getDate() + delta)
    setData(dataIso(d))
  }

  return (
    <Pagina titulo="Presença">
      <Card>
        <div className="flex items-center justify-between gap-2">
          <Botao variante="secundario" onClick={() => mudarDia(-1)}>‹</Botao>
          <div className="text-center">
            <div className="font-medium">{DIAS[dia]}</div>
            <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} className="text-sm text-slate-500" />
          </div>
          <Botao variante="secundario" onClick={() => mudarDia(1)}>›</Botao>
        </div>
      </Card>

      {doDia.length === 0 && (
        <Card>
          <Vazio>
            Nada neste dia. Cadastre seus horários em <Link className="text-indigo-600 underline" to="/semana">Semana</Link>.
          </Vazio>
        </Card>
      )}

      {doDia.map((h) => {
        if (h.tipo !== 'aula' || !h.turma_id)
          return (
            <Card key={h.id} className="opacity-70">
              <div className="flex items-center justify-between text-sm">
                <span>
                  <Selo cor={h.tipo === 'trabalho' ? 'ambar' : h.tipo === 'reuniao' ? 'vermelho' : h.tipo === 'estudo' ? 'verde' : 'cinza'}>{TIPOS[h.tipo].icone} {TIPOS[h.tipo].rotulo.split(' (')[0]}</Selo> {h.titulo}
                </span>
                <span className="text-slate-500">
                  {hhmm(h.inicio)}–{hhmm(h.fim)}
                </span>
              </div>
            </Card>
          )

        const registro = presencas.find((p) => p.turma_id === h.turma_id && p.data === data)
        const resumo = resumos.find((r) => r.turma.id === h.turma_id)
        const marcar = (presente: boolean) =>
          salvar.mutate({
            linha: { id: registro?.id, turma_id: h.turma_id!, data, aulas: h.aulas, presente },
            conflito: 'turma_id,data',
          })

        return (
          <Card key={h.id}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{resumo?.turma.nome ?? h.titulo}</div>
                <div className="text-sm text-slate-500">
                  {hhmm(h.inicio)}–{hhmm(h.fim)} · {h.aulas} aula(s){h.local ? ` · ${h.local}` : ''}
                </div>
              </div>
              {resumo && resumo.turma.total_aulas > 0 && (
                <Selo cor={resumo.frequencia.situacao === 'ok' ? 'verde' : resumo.frequencia.situacao === 'atencao' ? 'ambar' : 'vermelho'}>
                  pode faltar {Math.max(0, resumo.frequencia.restantes)}
                </Selo>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Botao
                variante={registro?.presente === true ? 'primario' : 'secundario'}
                onClick={() => marcar(true)}
                disabled={salvar.isPending}
              >
                ✅ Fui
              </Botao>
              <Botao
                variante={registro?.presente === false ? 'perigo' : 'secundario'}
                onClick={() => marcar(false)}
                disabled={salvar.isPending}
              >
                ❌ Faltei
              </Botao>
              <Botao variante="fantasma" disabled={!registro} onClick={() => registro && remover.mutate(registro.id)}>
                Sem aula
              </Botao>
            </div>
          </Card>
        )
      })}
    </Pagina>
  )
}
