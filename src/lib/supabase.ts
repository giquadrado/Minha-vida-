import { createClient } from '@supabase/supabase-js'
import { limpar, normalizarUrlSupabase } from './ambiente'

// Os valores vêm das variáveis de ambiente; aceitamos o que foi colado com sujeira (aspas, quebra de linha, "/**").
const url = normalizarUrlSupabase(import.meta.env.VITE_SUPABASE_URL)
const key = limpar(import.meta.env.VITE_SUPABASE_ANON_KEY)

export const supabaseConfigurado = Boolean(url && key)

/** O que este build encontrou (sem mostrar os valores), para a tela de aviso. */
export const diagnosticoSupabase = {
  url: Boolean(url),
  urlFormatoOk: /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url),
  chave: Boolean(key),
  chaveFormatoOk: /^(sb_publishable_|eyJ)/.test(key),
}

export const supabase = createClient(url || 'http://localhost', key || 'sem-chave')
