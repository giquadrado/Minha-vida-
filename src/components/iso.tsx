import type { ReactNode } from 'react'

/** Projeção isométrica 2:1 (como nos quartos do Habbo). */
export const TW = 64
export const TH = 32

export interface Pt {
  x: number
  y: number
}

export const proj = (gx: number, gy: number): Pt => ({ x: ((gx - gy) * TW) / 2, y: ((gx + gy) * TH) / 2 })
const sobe = (p: Pt, h: number): Pt => ({ x: p.x, y: p.y - h })
const pts = (ps: Pt[]) => ps.map((p) => `${p.x},${p.y}`).join(' ')

/** Clareia (f > 0) ou escurece (f < 0) uma cor #rrggbb. */
export function tom(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))
  return `rgb(${c.join(',')})`
}

const CONTORNO = 'rgba(20,12,40,0.45)'

/** Bloco isométrico: gx/gy em tiles, w/d largura e profundidade, h altura e z elevação em pixels. */
export function Caixa({ gx, gy, w, d, h, z = 0, cor, id }: { gx: number; gy: number; w: number; d: number; h: number; z?: number; cor: string; id?: string }) {
  const topo = z + h
  const A = proj(gx, gy), B = proj(gx + w, gy), C = proj(gx + w, gy + d), D = proj(gx, gy + d)
  return (
    <g data-id={id} stroke={CONTORNO} strokeWidth={1} strokeLinejoin="round">
      <polygon points={pts([sobe(D, z), sobe(C, z), sobe(C, topo), sobe(D, topo)])} fill={tom(cor, -0.16)} />
      <polygon points={pts([sobe(C, z), sobe(B, z), sobe(B, topo), sobe(C, topo)])} fill={tom(cor, -0.34)} />
      <polygon points={pts([sobe(A, topo), sobe(B, topo), sobe(C, topo), sobe(D, topo)])} fill={cor} />
    </g>
  )
}

/**
 * Retângulo colado numa parede/face:
 * plano "y" = parede de gy fixo (corre ao longo de gx); plano "x" = gx fixo (corre ao longo de gy).
 */
export function Painel({
  plano, fixo, de, ate, z, alt, cor, children,
}: { plano: 'x' | 'y'; fixo: number; de: number; ate: number; z: number; alt: number; cor: string; children?: ReactNode }) {
  const P = (t: number) => (plano === 'y' ? proj(t, fixo) : proj(fixo, t))
  return (
    <g>
      <polygon points={pts([sobe(P(de), z), sobe(P(ate), z), sobe(P(ate), z + alt), sobe(P(de), z + alt)])} fill={cor} stroke={CONTORNO} strokeWidth={1} />
      {children}
    </g>
  )
}

/** Origem + matriz para escrever texto "colado" num plano isométrico. */
export function textoNoPlano(plano: 'x' | 'y', fixo: number, de: number, ate: number, z: number): string {
  if (plano === 'y') {
    const o = proj(de, fixo)
    return `translate(${o.x} ${o.y - z}) matrix(1 0.5 0 1 0 0)`
  }
  // plano x: o texto lê da esquerda p/ direita no sentido em que gy diminui
  const o = proj(fixo, ate)
  return `translate(${o.x} ${o.y - z}) matrix(1 -0.5 0 1 0 0)`
}

export function Piso({ n, m, cores, espessura = 9 }: { n: number; m: number; cores: [string, string]; espessura?: number }) {
  const tiles = []
  for (let gx = 0; gx < n; gx++)
    for (let gy = 0; gy < m; gy++)
      tiles.push(
        <polygon
          key={`${gx}-${gy}`}
          points={pts([proj(gx, gy), proj(gx + 1, gy), proj(gx + 1, gy + 1), proj(gx, gy + 1)])}
          fill={cores[(gx + gy) % 2]}
          stroke="rgba(0,0,0,0.12)"
          strokeWidth={0.8}
        />,
      )
  const esp = (p: Pt): Pt => ({ x: p.x, y: p.y + espessura })
  return (
    <g>
      <polygon points={pts([proj(0, m), proj(n, m), esp(proj(n, m)), esp(proj(0, m))])} fill={tom(cores[0], -0.45)} />
      <polygon points={pts([proj(n, 0), proj(n, m), esp(proj(n, m)), esp(proj(n, 0))])} fill={tom(cores[0], -0.6)} />
      {tiles}
    </g>
  )
}

export function Paredes({ n, m, altura, cor }: { n: number; m: number; altura: number; cor: string }) {
  return (
    <g stroke={CONTORNO} strokeWidth={1}>
      <polygon points={pts([proj(0, 0), proj(0, m), sobe(proj(0, m), altura), sobe(proj(0, 0), altura)])} fill={tom(cor, -0.18)} />
      <polygon points={pts([proj(0, 0), proj(n, 0), sobe(proj(n, 0), altura), sobe(proj(0, 0), altura)])} fill={cor} />
      <polygon points={pts([proj(0, 0), proj(0, m), sobe(proj(0, m), 7), sobe(proj(0, 0), 7)])} fill={tom(cor, -0.5)} />
      <polygon points={pts([proj(0, 0), proj(n, 0), sobe(proj(n, 0), 7), sobe(proj(0, 0), 7)])} fill={tom(cor, -0.4)} />
    </g>
  )
}
