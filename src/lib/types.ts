export type StatusDisciplina = 'pendente' | 'cursando' | 'aprovada' | 'reprovada' | 'dispensada'
export type TipoDisciplina = 'obrigatoria' | 'optativa'
export type TipoHorario = 'aula' | 'trabalho' | 'reuniao' | 'estudo' | 'pessoal' | 'outro'
export type TipoHoras = 'estagio' | 'optativa' | 'complementar'

export interface Curso {
  id: string
  nome: string
  carga_obrigatoria: number
  horas_optativas: number
  horas_estagio: number
  horas_complementares: number
  freq_minima: number
  media_aprovacao: number
}

export interface Disciplina {
  id: string
  codigo: string
  nome: string
  carga_horaria: number
  periodo: number | null
  tipo: TipoDisciplina
  pre_requisitos: string[]
  status: StatusDisciplina
  nota_final: number | null
}

export interface Turma {
  id: string
  disciplina_id: string | null
  nome: string
  semestre: string
  professor: string | null
  sala: string | null
  total_aulas: number
  ativa: boolean
}

export interface Horario {
  id: string
  turma_id: string | null
  tipo: TipoHorario
  titulo: string
  dia_semana: number
  inicio: string
  fim: string
  aulas: number
  local: string | null
  /** preenchida = evento de um dia só; vazia = repete toda semana */
  data?: string | null
  /** id do evento na agenda externa de onde foi importado */
  origem_uid?: string | null
}

export interface Presenca {
  id: string
  turma_id: string
  data: string
  aulas: number
  presente: boolean
  obs: string | null
}

export interface Avaliacao {
  id: string
  turma_id: string
  nome: string
  peso: number
  data: string | null
  nota: number | null
}

export interface HorasRegistro {
  id: string
  tipo: TipoHoras
  descricao: string
  data: string
  horas: number
  comprovante: string | null
}

export interface Oferta {
  id: string
  disciplina_id: string | null
  codigo: string
  nome: string
  dia_semana: number
  inicio: string
  fim: string
  local: string | null
  /** turma/grupo no quadro de horários: "V" (teoria), "VA", "VA/VB"… */
  turma: string | null
}

export interface AvatarCfg {
  pele: string
  cabelo: string
  estilo: number
  camisa: string
  calca: string
}

export interface Perfil {
  id: string
  apelido: string | null
  avatar: Partial<AvatarCfg>
  local_atual: string | null
  detalhe_atual: string | null
  atualizado_em: string
}

export type StatusRelatorio = 'nao_iniciado' | 'escrevendo' | 'pronto' | 'entregue'

export interface Estagio {
  id: string
  empresa: string
  inicio: string | null
  fim: string | null
  horas: number | null
  relatorio: StatusRelatorio
  relatorio_arquivo: string | null
  relatorio_nome: string | null
  observacoes: string | null
}

export interface Tabelas {
  estagios: Estagio
  ofertas: Oferta
  perfis: Perfil
  cursos: Curso
  disciplinas: Disciplina
  turmas: Turma
  horarios: Horario
  presencas: Presenca
  avaliacoes: Avaliacao
  horas_registros: HorasRegistro
}

export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
