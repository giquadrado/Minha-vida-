import { useEffect, useId, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Pagina({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-32 md:px-8 md:pb-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="animate-subir text-2xl font-bold tracking-tight">{titulo}</h1>
        {acao}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

export function Card({
  titulo,
  children,
  className = '',
  atraso = 0,
}: {
  titulo?: ReactNode
  children: ReactNode
  className?: string
  atraso?: number
}) {
  return (
    <section className={`vidro animate-subir rounded-3xl p-4 md:p-5 ${className}`} style={{ animationDelay: `${atraso}ms` }}>
      {titulo && <h2 className="mb-3 font-semibold text-slate-800">{titulo}</h2>}
      {children}
    </section>
  )
}

const CORES_BARRA = {
  indigo: 'from-indigo-600 to-cyan-400',
  verde: 'from-emerald-500 to-cyan-300',
  ambar: 'from-amber-500 to-orange-400',
  vermelho: 'from-rose-600 to-orange-400',
}

export function Barra({ valor, cor = 'indigo' }: { valor: number; cor?: keyof typeof CORES_BARRA }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t = requestAnimationFrame(() => setV(valor))
    return () => cancelAnimationFrame(t)
  }, [valor])
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full bg-linear-to-r transition-[width] duration-1000 ease-out ${CORES_BARRA[cor]}`}
        style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }}
      />
    </div>
  )
}

export function Botao({
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'perigo' | 'fantasma' }) {
  const estilos = {
    primario:
      'bg-linear-to-r from-[#6d4aff] to-[#b24fe6] text-white shadow-lg shadow-violet-600/25 hover:brightness-110 hover:shadow-violet-500/40',
    secundario: 'border border-slate-300 bg-card text-slate-800 hover:bg-slate-100',
    perigo: 'bg-rose-700 text-white hover:bg-rose-600',
    fantasma: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
  }
  return (
    <button
      className={`cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${estilos[variante]} ${className}`}
      {...props}
    />
  )
}

const ENTRADA =
  'rounded-xl border border-slate-300 px-3 py-2.5 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

export function Campo({ rotulo, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { rotulo: string }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="font-medium text-slate-600">{rotulo}</span>
      <input className={ENTRADA} {...props} />
    </label>
  )
}

export function Selecao({
  rotulo,
  opcoes,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string; opcoes: [string, string][] }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="font-medium text-slate-600">{rotulo}</span>
      <select className={ENTRADA} {...props}>
        {opcoes.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Selo({
  children,
  cor = 'cinza',
}: {
  children: ReactNode
  cor?: 'cinza' | 'verde' | 'ambar' | 'vermelho' | 'indigo'
}) {
  const c = {
    cinza: 'bg-slate-100 text-slate-700',
    verde: 'bg-emerald-100 text-emerald-800',
    ambar: 'bg-amber-100 text-amber-800',
    vermelho: 'bg-rose-100 text-rose-800',
    indigo: 'bg-indigo-100 text-indigo-800',
  }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${c[cor]}`}>{children}</span>
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>
}

/** Logo: orbe com gradiente e chapéu de formatura. */
export function Orbe({ tamanho = 44 }: { tamanho?: number }) {
  return (
    <span
      className="animate-pulsar inline-flex items-center justify-center rounded-2xl bg-linear-to-br from-[#6d4aff] via-[#b24fe6] to-[#ff9d6c]"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.5 }}
    >
      🎓
    </span>
  )
}

/** Número que "sobe" até o valor final. */
export function Numero({ valor, casas = 0, sufixo = '' }: { valor: number; casas?: number; sufixo?: string }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const inicio = performance.now()
    let id = 0
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / 900)
      setV(valor * (1 - Math.pow(1 - p, 3)))
      if (p < 1) id = requestAnimationFrame(passo)
    }
    id = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(id)
  }, [valor])
  return (
    <>
      {v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}
      {sufixo}
    </>
  )
}

/** Anel de progresso animado. */
export function Anel({ valor, tamanho = 168, espessura = 12, children }: { valor: number; tamanho?: number; espessura?: number; children?: ReactNode }) {
  const id = useId()
  const [v, setV] = useState(0)
  useEffect(() => {
    const t = requestAnimationFrame(() => setV(valor))
    return () => cancelAnimationFrame(t)
  }, [valor])
  const r = (tamanho - espessura) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b6cff" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#ffb48a" />
          </linearGradient>
        </defs>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={espessura} />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, v)))}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.2, 0.8, 0.2, 1)', filter: 'drop-shadow(0 0 8px rgb(139 108 255 / 0.55))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

const CORES_CONFETE = ['#8b6cff', '#22d3ee', '#ffb48a', '#34d399', '#fbbf24', '#fb7185']

/** Chuva de confete (decorativa). */
export function Confete() {
  const pecas = Array.from({ length: 36 }, (_, i) => ({
    left: (i * 97) % 100,
    dx: ((i * 53) % 160) - 80,
    atraso: (i % 12) * 80,
    dur: 2200 + ((i * 131) % 1600),
    cor: CORES_CONFETE[i % CORES_CONFETE.length],
  }))
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pecas.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-2 rounded-sm"
          style={
            {
              left: `${p.left}%`,
              background: p.cor,
              '--dx': `${p.dx}px`,
              animation: `confete ${p.dur}ms ${p.atraso}ms ease-in forwards`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** Lê os campos de um <form> como objeto de strings. */
export function lerForm(e: React.FormEvent<HTMLFormElement>): Record<string, string> {
  e.preventDefault()
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
}

export const numOuNull = (v: string | undefined) => (v === undefined || v.trim() === '' ? null : Number(v.replace(',', '.')))
