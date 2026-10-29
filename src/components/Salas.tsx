import type { ReactNode } from 'react'
import type { AvatarCfg } from '../lib/types'
import { Boneco, Rotulos } from './Boneco'
import { Caixa, Painel, Paredes, Piso, proj, textoNoPlano, tom } from './iso'

export type TipoSala = 'faculdade' | 'trabalho' | 'casa'

const N = 6
const FONTE = { fontFamily: 'var(--font-pixel)' }

interface Item {
  prof: number
  el: ReactNode
}

/** Distância ao observador: o que está mais "à frente" é desenhado depois. */
const caixa = (k: string, gx: number, gy: number, w: number, d: number, h: number, cor: string, z = 0): Item => ({
  prof: gx + w + gy + d + z / 100,
  el: <Caixa key={k} gx={gx} gy={gy} w={w} d={d} h={h} z={z} cor={cor} />,
})

function Quadro({ linhas, cor, titulo }: { linhas: string[]; cor: string; titulo: string }) {
  return (
    <Painel plano="y" fixo={0} de={1.1} ate={4.9} z={30} alt={42} cor={cor}>
      <g transform={textoNoPlano('y', 0, 1.1, 4.9, 30 + 42)}>
        <text x={8} y={12} fontSize={5} fill="#f2f2f2" style={FONTE}>{titulo}</text>
        {linhas.slice(0, 3).map((l, i) => (
          <text key={i} x={8} y={24 + i * 8} fontSize={4.2} fill="rgba(255,255,255,0.85)" style={FONTE}>{l.slice(0, 26)}</text>
        ))}
      </g>
    </Painel>
  )
}

function itensDa(tipo: TipoSala, quadro: string[], noite: boolean): { paredes: ReactNode; itens: Item[]; ponto: [number, number]; cores: [string, string]; parede: string } {
  if (tipo === 'faculdade') {
    const mesa = (k: string, gx: number, gy: number) => [
      caixa(k, gx, gy, 1.2, 0.9, 12, '#b98a5a'),
      caixa(`${k}-livro`, gx + 0.2, gy + 0.2, 0.5, 0.4, 2, '#4f6bd8', 12),
    ]
    return {
      parede: '#e6d9c3',
      cores: ['#c8a98a', '#bf9f7f'],
      ponto: [5, 3.7],
      paredes: (
        <>
          <Quadro titulo="AULA DE HOJE" linhas={quadro} cor="#2f5d50" />
          <circle cx={proj(5.5, 0).x} cy={proj(5.5, 0).y - 62} r={9} fill="#fff" stroke="#1c1530" strokeWidth={1.5} transform="translate(0 0)" />
          <path d={`M${proj(5.5, 0).x} ${proj(5.5, 0).y - 62} v-6 M${proj(5.5, 0).x} ${proj(5.5, 0).y - 62} l5 3`} stroke="#1c1530" strokeWidth={1.4} fill="none" />
        </>
      ),
      itens: [
        caixa('prof', 1.2, 0.5, 2, 0.9, 14, '#a9784a'),
        caixa('prof-pc', 2, 0.7, 0.6, 0.15, 8, '#23233a', 14),
        ...mesa('m1', 1, 2.6), ...mesa('m2', 3.3, 2.6), ...mesa('m3', 1, 4.5), ...mesa('m4', 3.3, 4.5),
        caixa('estante', 0, 2.2, 0.8, 2, 50, '#7a5230'),
        caixa('vaso', 5.2, 0.4, 0.6, 0.6, 10, '#8a5a3c'),
        { prof: 5.8 + 1.1, el: <circle key="folhas" cx={proj(5.5, 0.7).x} cy={proj(5.5, 0.7).y - 22} r={11} fill="#3f9b5a" stroke="#1c1530" strokeWidth={1} /> },
      ],
    }
  }

  if (tipo === 'trabalho') {
    const mesa = (k: string, gx: number, gy: number) => [
      caixa(k, gx, gy, 2, 0.9, 13, '#d8d2c4'),
      caixa(`${k}-tela`, gx + 0.65, gy + 0.15, 0.7, 0.12, 11, '#23233a', 13),
      caixa(`${k}-teclado`, gx + 0.55, gy + 0.5, 0.9, 0.3, 1.5, '#b9b4a8', 13),
    ]
    return {
      parede: '#cfd8e6',
      cores: ['#8c97b3', '#838eaa'],
      ponto: [3.2, 3.7],
      paredes: (
        <>
          <Quadro titulo="TURNO DE HOJE" linhas={quadro} cor="#b58957" />
          <Painel plano="x" fixo={0} de={1.4} ate={3.6} z={28} alt={40} cor={noite ? '#1d2750' : '#a8dcff'} />
        </>
      ),
      itens: [
        ...mesa('mesa1', 1, 1.1),
        ...mesa('mesa2', 3.5, 1.1),
        caixa('cadeira', 2.1, 2.2, 0.6, 0.6, 9, '#e0605a'),
        caixa('impressora', 5, 3.2, 0.9, 0.8, 16, '#eeeeee'),
        caixa('impressora-topo', 5.1, 3.3, 0.7, 0.6, 3, '#9a9a9a', 16),
        caixa('sofa', 5.1, 4.4, 0.9, 1.4, 12, '#d9645c'),
        caixa('sofa-costas', 5.7, 4.4, 0.3, 1.4, 10, '#c2554e', 12),
        caixa('cafe', 4.2, 0.4, 0.5, 0.5, 14, '#6b4a3a'),
      ],
    }
  }

  return {
    parede: '#f1d7cf',
    cores: ['#d9b08c', '#cfa57f'],
    ponto: [3.2, 3.6],
    paredes: (
      <>
        <Painel plano="y" fixo={0} de={3.4} ate={5.2} z={28} alt={38} cor={noite ? '#1d2750' : '#a8dcff'}>
          {noite && <circle cx={proj(4.7, 0).x} cy={proj(4.7, 0).y - 52} r={4} fill="#fff6c7" />}
        </Painel>
        <Painel plano="y" fixo={0} de={3.2} ate={3.5} z={26} alt={42} cor="#d9645c" />
        <Painel plano="y" fixo={0} de={5.1} ate={5.4} z={26} alt={42} cor="#d9645c" />
      </>
    ),
    itens: [
      caixa('cama', 0.6, 0.6, 2.2, 1.5, 12, '#5b7bd5'),
      caixa('cobertor', 1.4, 0.6, 1.4, 1.5, 3, '#8fb0ff', 12),
      caixa('travesseiro', 0.7, 0.9, 0.6, 0.8, 4, '#ffffff', 12),
      { ...caixa('tapete', 2, 2.6, 2.4, 2, 1.2, '#e8a87c'), prof: 0 }, // chão: sempre por baixo do resto
      caixa('tv-base', 0.2, 3.4, 0.5, 1.2, 10, '#7a5230'),
      caixa('tv', 0.2, 3.3, 0.35, 1.4, 18, '#1d1d2b', 10),
      caixa('sofa', 3.7, 4.8, 2, 0.9, 12, '#d9645c'),
      caixa('sofa-costas', 3.7, 5.5, 2, 0.3, 12, '#c2554e', 12),
    ],
  }
}

export const NOMES_SALA: Record<TipoSala, string> = { faculdade: 'Sala de aula', trabalho: 'Escritório', casa: 'Meu quarto' }

export function Sala({
  tipo, cfg, apelido, aqui, fala, quadro, noite,
}: { tipo: TipoSala; cfg: AvatarCfg; apelido: string; aqui: boolean; fala?: string; quadro: string[]; noite: boolean }) {
  const { paredes, itens, ponto, cores, parede } = itensDa(tipo, quadro, noite)
  const p = proj(ponto[0], ponto[1])
  const todos: Item[] = [...itens]
  if (aqui)
    todos.push({
      prof: ponto[0] + ponto[1] + 1,
      el: <Boneco key="eu" cfg={cfg} x={p.x} y={p.y} escala={1.05} semRotulos />,
    })
  todos.sort((a, b) => a.prof - b.prof)

  return (
    <svg viewBox="-205 -125 410 345" className="moldura-pixel block w-full bg-[#14102a]" role="img" aria-label={`${NOMES_SALA[tipo]}${aqui ? ' — você está aqui' : ' — vazio'}`}>
      <rect x={-205} y={-125} width={410} height={345} fill={tom('#14102a', 0.02)} />
      <Paredes n={N} m={N} altura={96} cor={parede} />
      <Piso n={N} m={N} cores={cores} />
      {paredes}
      {todos.map((i) => i.el)}
      {aqui && <Rotulos x={p.x} y={p.y} escala={1.05} nome={apelido} fala={fala} />}
      {noite && <rect x={-205} y={-125} width={410} height={345} fill="#0a1040" opacity={0.28} pointerEvents="none" />}
    </svg>
  )
}
