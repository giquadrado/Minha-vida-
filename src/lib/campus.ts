import { hhmm, minutos } from './calculos'
import type { AvatarCfg, Horario } from './types'

export type Lugar = 'faculdade' | 'trabalho' | 'casa' | 'caminho'

export interface Situacao {
  lugar: Lugar
  detalhe: string
  /** hora em que o compromisso atual termina */
  ate: string | null
}

export const LUGARES: Record<Lugar, { nome: string; icone: string }> = {
  faculdade: { nome: 'Faculdade', icone: '🏫' },
  trabalho: { nome: 'Trabalho', icone: '💼' },
  casa: { nome: 'Casa', icone: '🏠' },
  caminho: { nome: 'A caminho', icone: '🚶' },
}

export const AVATAR_PADRAO: AvatarCfg = { pele: '#f1c9a5', cabelo: '#3b2a20', estilo: 0, camisa: '#7c5cff', calca: '#2f3a68' }

/** Onde a pessoa está num dado dia da semana e minuto do dia, segundo a grade de horários. */
export function situacaoEm(horarios: Horario[], dia: number, min: number): Situacao {
  const hoje = horarios.filter((h) => h.dia_semana === dia)
  const agora = hoje.filter((h) => minutos(h.inicio) <= min && min < minutos(h.fim))
  const atual = agora.find((h) => h.tipo === 'aula') ?? agora.find((h) => h.tipo === 'trabalho') ?? agora[0]

  if (atual) {
    const lugar: Lugar =
      atual.tipo === 'aula'
        ? 'faculdade'
        : atual.tipo === 'trabalho' || atual.tipo === 'reuniao' || /est[aá]gio/i.test(atual.titulo)
          ? 'trabalho'
          : atual.tipo === 'estudo'
            ? 'casa'
            : 'caminho'
    const padrao =
      lugar === 'faculdade' ? 'Em aula' : atual.tipo === 'reuniao' ? 'Em reunião' : lugar === 'trabalho' ? 'Trabalhando' : atual.tipo === 'estudo' ? 'Estudando' : 'Compromisso'
    return { lugar, detalhe: atual.titulo || padrao, ate: hhmm(atual.fim) }
  }

  const proximo = hoje.filter((h) => minutos(h.inicio) > min).sort((a, b) => minutos(a.inicio) - minutos(b.inicio))[0]
  if (proximo && minutos(proximo.inicio) - min <= 45)
    return { lugar: 'caminho', detalhe: `Indo para ${proximo.titulo || 'o próximo compromisso'}`, ate: hhmm(proximo.inicio) }
  if (min >= 23 * 60 || min < 6 * 60) return { lugar: 'casa', detalhe: 'Dormindo 💤', ate: null }
  return { lugar: 'casa', detalhe: proximo ? `Livre até ${hhmm(proximo.inicio)}` : 'Livre pelo resto do dia', ate: null }
}

export function chaveDe(s: Situacao): string {
  return `${s.lugar}|${s.detalhe}`
}
