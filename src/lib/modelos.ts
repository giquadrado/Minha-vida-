/**
 * Documentos de base que acompanham o app (ficam na pasta public/modelos e são baixados do próprio site).
 */
export interface ModeloDocumento {
  /** caminho público, ex.: '/modelos/relatorio-estagio.doc' */
  arquivo: string
  /** nome do arquivo ao baixar */
  nome: string
  /** texto curto sobre o documento */
  descricao: string
}

export const MODELO_RELATORIO: ModeloDocumento | null = {
  arquivo: '/modelos/relatorio-estagio.doc',
  nome: 'emt_05_01_modelo_relatorio_dezembro_2021.doc',
  descricao: 'Modelo de relatório de estágio (Engenharia Mecatrônica, versão de dezembro/2021), em Word.',
}
