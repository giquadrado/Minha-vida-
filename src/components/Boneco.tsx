import type { AvatarCfg } from '../lib/types'
import { AVATAR_PADRAO } from '../lib/campus'

const TRACO = '#1c1530'

export const CABELOS = ['Curto', 'Longo', 'Moicano', 'Coque', 'Careca']

function Cabelo({ estilo, cor }: { estilo: number; cor: string }) {
  const p = { fill: cor, stroke: TRACO, strokeWidth: 1 }
  switch (estilo) {
    case 1: // longo
      return (
        <g {...p}>
          <rect x={5} y={0} width={14} height={6} rx={2} />
          <rect x={4} y={1} width={3} height={19} rx={1} />
          <rect x={17} y={1} width={3} height={19} rx={1} />
        </g>
      )
    case 2: // moicano
      return (
        <g {...p}>
          <rect x={6} y={2} width={12} height={3} />
          <polygon points="8,2 10,-4 12,2" />
          <polygon points="11,2 13,-5 15,2" />
          <polygon points="14,2 16,-4 18,2" />
        </g>
      )
    case 3: // coque
      return (
        <g {...p}>
          <rect x={5} y={0} width={14} height={6} rx={2} />
          <rect x={5} y={0} width={2} height={8} />
          <rect x={17} y={0} width={2} height={8} />
          <circle cx={12} cy={-2} r={3.6} />
        </g>
      )
    case 4: // careca
      return <rect x={6} y={1} width={12} height={2} rx={1} fill={cor} opacity={0.35} />
    default: // curto
      return (
        <g {...p}>
          <rect x={5} y={0} width={14} height={6} rx={2} />
          <rect x={5} y={0} width={2.5} height={9} />
          <rect x={16.5} y={0} width={2.5} height={9} />
        </g>
      )
  }
}

/** Boneco pixelado de frente, 24×40 (pés em 12,40). Use dentro de um <svg>. */
export function BonecoCorpo({ cfg, andando = false, parado = false }: { cfg: AvatarCfg; andando?: boolean; parado?: boolean }) {
  const forma = { stroke: TRACO, strokeWidth: 1, shapeRendering: 'crispEdges' as const }
  const perna = (x: number, anim: string) => (
    <g style={andando ? { animation: `${anim} 0.5s ease-in-out infinite` } : undefined}>
      <rect x={x} y={28} width={5} height={10} fill={cfg.calca} {...forma} />
      <rect x={x - 1} y={37} width={6} height={3} fill={TRACO} />
    </g>
  )
  return (
    <g style={{ animation: andando ? 'balancar 0.5s ease-in-out infinite' : parado ? undefined : 'respirar 3s ease-in-out infinite' }}>
      {perna(7, 'passo-a')}
      {perna(12, 'passo-b')}
      <rect x={2} y={16} width={3} height={11} fill={cfg.camisa} {...forma} />
      <rect x={19} y={16} width={3} height={11} fill={cfg.camisa} {...forma} />
      <rect x={2} y={26} width={3} height={3} fill={cfg.pele} {...forma} />
      <rect x={19} y={26} width={3} height={3} fill={cfg.pele} {...forma} />
      <rect x={5} y={15} width={14} height={14} rx={1} fill={cfg.camisa} {...forma} />
      <rect x={5} y={15} width={14} height={2.5} fill="rgba(255,255,255,0.22)" />
      <rect x={6} y={2} width={12} height={13} rx={2} fill={cfg.pele} {...forma} />
      <rect x={9} y={8} width={2} height={3} fill={TRACO} />
      <rect x={14} y={8} width={2} height={3} fill={TRACO} />
      <rect x={11} y={12} width={3} height={1} fill="rgba(120,50,50,0.7)" />
      <Cabelo estilo={cfg.estilo} cor={cfg.cabelo} />
    </g>
  )
}

/** Plaquinha com o nome, estilo Habbo. */
export function Plaquinha({ texto, y }: { texto: string; y: number }) {
  const larg = texto.length * 6 + 10
  return (
    <g transform={`translate(0 ${y})`}>
      <rect x={-larg / 2} y={-8} width={larg} height={12} rx={3} fill="rgba(12,10,30,0.86)" stroke="rgba(255,255,255,0.25)" />
      <text textAnchor="middle" y={1} fontSize={6} fill="#fff" style={{ fontFamily: 'var(--font-pixel)' }}>
        {texto}
      </text>
    </g>
  )
}

function quebrar(texto: string, max = 22): string[] {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of texto.split(' ')) {
    if ((atual + ' ' + palavra).trim().length > max) {
      linhas.push(atual)
      atual = palavra
    } else atual = (atual + ' ' + palavra).trim()
  }
  if (atual) linhas.push(atual)
  return linhas.slice(0, 3)
}

/** Balão de fala com rabinho apontando para baixo. */
export function Balao({ texto, y }: { texto: string; y: number }) {
  const linhas = quebrar(texto)
  const larg = Math.max(...linhas.map((l) => l.length)) * 5.6 + 14
  const alt = linhas.length * 9 + 8
  return (
    // a posição fica no <g> de fora; a animação CSS (que mexe em transform) no de dentro
    <g transform={`translate(0 ${y})`}>
      <g style={{ animation: 'balao 0.3s ease-out both' }}>
        <rect x={-larg / 2} y={-alt} width={larg} height={alt} rx={5} fill="#fff" stroke={TRACO} strokeWidth={1.2} />
        <polygon points="-3,0 3,0 0,5" fill="#fff" stroke={TRACO} strokeWidth={1.2} />
        <rect x={-3.5} y={-1.6} width={7} height={3} fill="#fff" />
        {linhas.map((l, i) => (
          <text key={i} textAnchor="middle" x={0} y={-alt + 11 + i * 9} fontSize={6} fill={TRACO} style={{ fontFamily: 'var(--font-pixel)' }}>
            {l}
          </text>
        ))}
      </g>
    </g>
  )
}

/** Boneco posicionado: (x, y) = ponto dos pés. Plaquinha e balão ficam em tamanho fixo. */
export function Boneco({
  cfg, x, y, escala = 1, andando = false, direita = true, nome, fala, transicao, semRotulos = false,
}: {
  cfg: AvatarCfg
  x: number
  y: number
  escala?: number
  andando?: boolean
  direita?: boolean
  nome?: string
  fala?: string
  transicao?: string
  /** desenha só o corpo; use <Rotulos> numa camada acima de todo o cenário */
  semRotulos?: boolean
}) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: transicao }}>
      <ellipse cx={0} cy={0} rx={10 * escala} ry={3.2 * escala} fill="rgba(0,0,0,0.3)" />
      <g transform={`scale(${direita ? escala : -escala} ${escala}) translate(-12 -40)`}>
        <BonecoCorpo cfg={cfg} andando={andando} />
      </g>
      {!semRotulos && nome && <Plaquinha texto={nome} y={-40 * escala - 6} />}
      {!semRotulos && fala && <Balao texto={fala} y={-40 * escala - 20} />}
    </g>
  )
}

/** Plaquinha + balão, para desenhar por cima dos móveis. */
export function Rotulos({ x, y, escala = 1, nome, fala, transicao }: { x: number; y: number; escala?: number; nome?: string; fala?: string; transicao?: string }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: transicao }} pointerEvents="none">
      {nome && <Plaquinha texto={nome} y={-40 * escala - 6} />}
      {fala && <Balao texto={fala} y={-40 * escala - 20} />}
    </g>
  )
}

/** Retrato para HUD/personalização. */
export function BonecoIcone({ cfg = AVATAR_PADRAO, tamanho = 56 }: { cfg?: AvatarCfg; tamanho?: number }) {
  return (
    <svg width={tamanho * 0.7} height={tamanho} viewBox="-2 -7 28 49" style={{ overflow: 'visible' }}>
      <BonecoCorpo cfg={cfg} parado />
    </svg>
  )
}
