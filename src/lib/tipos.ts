import type { TipoHorario } from './types'

export interface InfoTipo {
  rotulo: string
  icone: string
  /** descrição sugerida ao criar */
  padrao: string
  /** classes do bloco na grade */
  cor: string
}

export const TIPOS: Record<TipoHorario, InfoTipo> = {
  aula: { rotulo: 'Aula', icone: '📖', padrao: '', cor: 'bg-indigo-100 border-indigo-400 text-indigo-900' },
  trabalho: { rotulo: 'Trabalho', icone: '💼', padrao: 'Trabalho', cor: 'bg-amber-100 border-amber-400 text-amber-900' },
  reuniao: { rotulo: 'Reunião', icone: '🤝', padrao: 'Reunião', cor: 'bg-rose-100 border-rose-500 text-rose-800' },
  estudo: { rotulo: 'Estudo', icone: '✏️', padrao: 'Estudo', cor: 'bg-emerald-100 border-emerald-400 text-emerald-800' },
  pessoal: { rotulo: 'Compromisso pessoal', icone: '🌿', padrao: 'Compromisso', cor: 'bg-slate-100 border-slate-300 text-slate-800' },
  outro: { rotulo: 'Outro (deslocamento, curso…)', icone: '🚶', padrao: '', cor: 'bg-slate-100 border-slate-400 text-slate-800' },
}

export const ORDEM_TIPOS: TipoHorario[] = ['aula', 'trabalho', 'reuniao', 'estudo', 'pessoal', 'outro']
