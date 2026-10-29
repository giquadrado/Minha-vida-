import { minutos } from '../lib/calculos'
import { DIAS_CURTOS } from '../lib/types'

export interface BlocoGrade {
  dia: number
  inicio: string
  fim: string
  rotulo: string
  tom: 'aula' | 'trabalho' | 'novo'
}

const COR = {
  aula: 'bg-indigo-100 border-indigo-400 text-indigo-900',
  trabalho: 'bg-amber-100 border-amber-400 text-amber-900',
  novo: 'bg-emerald-100 border-emerald-400 text-emerald-800',
}
const DIAS = [1, 2, 3, 4, 5, 6]
const PX = 26

/** Semana compacta, só leitura. */
export function MiniGrade({ blocos }: { blocos: BlocoGrade[] }) {
  const ini = Math.min(8, ...blocos.map((b) => Math.floor(minutos(b.inicio) / 60)))
  const fim = Math.max(22, ...blocos.map((b) => Math.ceil(minutos(b.fim) / 60)))
  const alt = (fim - ini) * PX
  const dias = DIAS.filter((d) => d !== 6 || blocos.some((b) => b.dia === 6))

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[420px]" style={{ gridTemplateColumns: `28px repeat(${dias.length}, 1fr)` }}>
        <div />
        {dias.map((d) => (
          <div key={d} className="pb-1 text-center text-[10px] font-semibold text-slate-500">{DIAS_CURTOS[d]}</div>
        ))}
        <div className="relative" style={{ height: alt }}>
          {Array.from({ length: fim - ini }, (_, i) =>
            i % 2 === 0 ? (
              <div key={i} className="absolute right-1 text-[9px] text-slate-400" style={{ top: i * PX - 5 }}>{ini + i}h</div>
            ) : null,
          )}
        </div>
        {dias.map((d) => (
          <div key={d} className="relative border-l border-slate-100" style={{ height: alt }}>
            {Array.from({ length: fim - ini }, (_, i) => (
              <div key={i} className="absolute inset-x-0 border-t border-slate-100" style={{ top: i * PX }} />
            ))}
            {blocos
              .filter((b) => b.dia === d)
              .map((b, i) => (
                <div
                  key={i}
                  className={`absolute inset-x-0.5 overflow-hidden rounded border-l-[3px] px-1 text-[9px] font-semibold leading-tight ${COR[b.tom]}`}
                  style={{ top: ((minutos(b.inicio) - ini * 60) / 60) * PX, height: Math.max(((minutos(b.fim) - minutos(b.inicio)) / 60) * PX, 14) }}
                  title={`${b.rotulo} ${b.inicio}–${b.fim}`}
                >
                  {b.rotulo}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}
