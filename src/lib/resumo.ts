import { useCurso, useLista } from './db'
import { mediaParcial, notaNecessaria, resumoFrequencia, type ResumoFrequencia } from './calculos'
import type { Avaliacao, Presenca, Turma } from './types'

export interface ResumoTurma {
  turma: Turma
  frequencia: ResumoFrequencia
  avaliacoes: Avaliacao[]
  presencas: Presenca[]
  media: number | null
  necessaria: number | null
}

/** Junta frequência e notas de cada turma ativa. */
export function useResumoTurmas(): { resumos: ResumoTurma[]; carregando: boolean } {
  const curso = useCurso()
  const turmas = useLista('turmas')
  const presencas = useLista('presencas')
  const avaliacoes = useLista('avaliacoes')

  const resumos = (turmas.data ?? [])
    .filter((t) => t.ativa)
    .map((turma) => {
      const p = (presencas.data ?? []).filter((x) => x.turma_id === turma.id)
      const a = (avaliacoes.data ?? []).filter((x) => x.turma_id === turma.id)
      return {
        turma,
        presencas: p,
        avaliacoes: a,
        frequencia: resumoFrequencia(p, turma.total_aulas, Number(curso.freq_minima)),
        media: mediaParcial(a),
        necessaria: notaNecessaria(a, Number(curso.media_aprovacao)),
      }
    })
  return { resumos, carregando: turmas.isLoading || presencas.isLoading || avaliacoes.isLoading }
}
