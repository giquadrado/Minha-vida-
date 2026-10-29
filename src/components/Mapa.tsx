import type { ReactNode } from 'react'
import type { AvatarCfg } from '../lib/types'
import { LUGARES, type Lugar } from '../lib/campus'
import { Boneco, Rotulos } from './Boneco'
import { Caixa, Painel, proj, tom } from './iso'

const FONTE = { fontFamily: 'var(--font-pixel)' }

/** Onde o boneco fica parado no mapa, em coordenadas de tile. */
const PONTOS: Record<Lugar, [number, number]> = {
  faculdade: [2.2, 4.75],
  trabalho: [7.7, 4.75],
  casa: [7.95, 7.3],
  caminho: [5, 5],
}

interface Item {
  prof: number
  el: ReactNode
}

/** Uma fileira de janelas numa face do prédio. */
function Janelas({ plano, fixo, inicio, cols, passo, z, noite }: { plano: 'x' | 'y'; fixo: number; inicio: number; cols: number; passo: number; z: number; noite: boolean }) {
  const cor = noite ? '#ffe9a0' : '#bfe6ff'
  return (
    <>
      {Array.from({ length: cols }, (_, c) => (
        <Painel key={c} plano={plano} fixo={fixo} de={inicio + c * passo} ate={inicio + c * passo + 0.45} z={z} alt={13} cor={cor} />
      ))}
    </>
  )
}

function Placa({ gx, gy, h, texto, ativa }: { gx: number; gy: number; h: number; texto: string; ativa: boolean }) {
  const p = proj(gx, gy)
  const larg = texto.length * 7 + 14
  return (
    <g transform={`translate(${p.x} ${p.y - h - 16})`}>
      <rect x={-larg / 2} y={-10} width={larg} height={15} rx={3} fill={ativa ? '#7c5cff' : 'rgba(12,10,30,0.85)'} stroke="rgba(255,255,255,0.4)" />
      <text textAnchor="middle" y={1} fontSize={7} fill="#fff" style={FONTE}>{texto}</text>
    </g>
  )
}

function Arvore({ gx, gy }: { gx: number; gy: number }): Item {
  const c = proj(gx + 0.15, gy + 0.15)
  return {
    prof: gx + gy + 0.6,
    el: (
      <g key={`arv${gx}-${gy}`}>
        <Caixa gx={gx} gy={gy} w={0.3} d={0.3} h={12} cor="#6b4a3a" />
        <circle cx={c.x} cy={c.y - 24} r={14} fill="#3f9b5a" stroke="#1c1530" strokeOpacity={0.5} />
        <circle cx={c.x - 4} cy={c.y - 28} r={7} fill="#57b873" opacity={0.7} />
      </g>
    ),
  }
}

export function Mapa({
  lugar, cfg, apelido, fala, noite, movendo, onEscolher,
}: {
  lugar: Lugar
  cfg: AvatarCfg
  apelido: string
  fala: string
  noite: boolean
  movendo: boolean
  onEscolher: (l: Exclude<Lugar, 'caminho'>) => void
}) {
  const clicavel = (l: Exclude<Lugar, 'caminho'>) => ({ onClick: () => onEscolher(l), style: { cursor: 'pointer' } })
  const ponto = PONTOS[lugar]
  const pos = proj(ponto[0], ponto[1])

  const itens: Item[] = [
    {
      prof: 7.8,
      el: (
        <g key="faculdade" {...clicavel('faculdade')}>
          <Caixa gx={0.6} gy={1} w={3.2} d={3} h={70} cor="#b86f50" />
          <Caixa gx={0.5} gy={0.9} w={3.4} d={3.2} h={6} z={70} cor="#6a4a3a" />
          <Painel plano="y" fixo={4} de={1.7} ate={2.7} z={0} alt={24} cor="#3a2a22" />
          <Janelas plano="y" fixo={4} inicio={0.95} cols={1} passo={1} z={34} noite={noite} />
          <Janelas plano="y" fixo={4} inicio={3} cols={1} passo={1} z={34} noite={noite} />
          <Janelas plano="y" fixo={4} inicio={0.95} cols={1} passo={1} z={54} noite={noite} />
          <Janelas plano="y" fixo={4} inicio={1.8} cols={1} passo={1} z={54} noite={noite} />
          <Janelas plano="y" fixo={4} inicio={3} cols={1} passo={1} z={54} noite={noite} />
          <Janelas plano="x" fixo={3.8} inicio={1.4} cols={2} passo={0.9} z={34} noite={noite} />
          <Janelas plano="x" fixo={3.8} inicio={1.4} cols={2} passo={0.9} z={54} noite={noite} />
          <Placa gx={2.2} gy={2.5} h={86} texto="FACULDADE" ativa={lugar === 'faculdade'} />
        </g>
      ),
    },
    {
      prof: 13.2,
      el: (
        <g key="trabalho" {...clicavel('trabalho')}>
          <Caixa gx={6} gy={0.8} w={3.2} d={3.2} h={96} cor="#4f7fa3" />
          <Caixa gx={5.9} gy={0.7} w={3.4} d={3.4} h={5} z={96} cor="#2d4b66" />
          <Painel plano="y" fixo={4} de={7.3} ate={8.1} z={0} alt={22} cor="#22384d" />
          {[34, 52, 70].map((z) => <Janelas key={z} plano="y" fixo={4} inicio={6.3} cols={3} passo={0.9} z={z} noite={noite} />)}
          {[34, 52, 70].map((z) => <Janelas key={`x${z}`} plano="x" fixo={9.2} inicio={1.3} cols={3} passo={0.9} z={z} noite={noite} />)}
          <Placa gx={7.6} gy={2.4} h={110} texto="TRABALHO" ativa={lugar === 'trabalho'} />
        </g>
      ),
    },
    {
      prof: 15.8,
      el: (
        <g key="casa" {...clicavel('casa')}>
          <Caixa gx={5} gy={6} w={2.2} d={2.6} h={38} cor="#e9b79a" />
          <Caixa gx={4.8} gy={5.8} w={2.6} d={3} h={12} z={38} cor="#b5483f" />
          <Painel plano="x" fixo={7.2} de={6.9} ate={7.7} z={0} alt={20} cor="#7a4a3a" />
          <Janelas plano="y" fixo={8.6} inicio={5.4} cols={2} passo={0.9} z={16} noite={noite} />
          <Placa gx={6.1} gy={7.3} h={58} texto="CASA" ativa={lugar === 'casa'} />
        </g>
      ),
    },
    Arvore({ gx: 0.5, gy: 6.4 }), Arvore({ gx: 1.7, gy: 8 }), Arvore({ gx: 2.8, gy: 6.9 }), Arvore({ gx: 9.3, gy: 7 }), Arvore({ gx: 9.1, gy: 9.1 }),
  ]
  itens.sort((a, b) => a.prof - b.prof)

  const pol = (...ps: [number, number][]) => ps.map(([a, b]) => `${proj(a, b).x},${proj(a, b).y}`).join(' ')
  const centro = (a: [number, number], b: [number, number]) => ({ x1: proj(...a).x, y1: proj(...a).y, x2: proj(...b).x, y2: proj(...b).y })

  return (
    <svg viewBox="-335 -150 670 500" className="moldura-pixel block w-full bg-[#0f1330]" role="img" aria-label={`Mapa do campus. Você está: ${LUGARES[lugar].nome}`}>
      <polygon points={`${proj(0, 10).x},${proj(0, 10).y} ${proj(10, 10).x},${proj(10, 10).y} ${proj(10, 10).x},${proj(10, 10).y + 12} ${proj(0, 10).x},${proj(0, 10).y + 12}`} fill="#2a6a43" />
      <polygon points={`${proj(10, 0).x},${proj(10, 0).y} ${proj(10, 10).x},${proj(10, 10).y} ${proj(10, 10).x},${proj(10, 10).y + 12} ${proj(10, 0).x},${proj(10, 0).y + 12}`} fill="#1f5233" />
      <polygon points={pol([0, 0], [10, 0], [10, 10], [0, 10])} fill="#4aa56a" />
      {Array.from({ length: 10 }, (_, i) => Array.from({ length: 10 }, (_, j) => ((i + j) % 2 ? <polygon key={`${i}-${j}`} points={pol([i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1])} fill="rgba(0,0,0,0.05)" /> : null)))}
      <polygon points={pol([0, 4.3], [10, 4.3], [10, 5.7], [0, 5.7])} fill="#4a4f6a" />
      <polygon points={pol([7.3, 5.7], [8.7, 5.7], [8.7, 10], [7.3, 10])} fill="#4a4f6a" />
      <line {...centro([0, 5], [10, 5])} stroke="#e8e8f5" strokeWidth={1.4} strokeDasharray="8 7" opacity={0.7} />
      <line {...centro([8, 5.7], [8, 10])} stroke="#e8e8f5" strokeWidth={1.4} strokeDasharray="8 7" opacity={0.7} />
      {itens.map((i) => i.el)}
      {/* o boneco fica sempre por cima dos prédios, para você achar onde está */}
      <Boneco cfg={cfg} x={pos.x} y={pos.y} escala={0.78} andando={movendo} semRotulos transicao="transform 1.8s ease-in-out" />
      {noite &&<rect x={-335} y={-150} width={670} height={500} fill="#0a1040" opacity={0.4} pointerEvents="none" />}
      <Rotulos x={pos.x} y={pos.y} escala={0.78} nome={apelido} fala={fala} transicao="transform 1.8s ease-in-out" />
      <text x={-325} y={-132} fontSize={7} fill={tom('#ffffff', -0.25)} style={FONTE}>TOQUE NOS PRÉDIOS</text>
    </svg>
  )
}
