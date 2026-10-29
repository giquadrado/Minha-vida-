import { createClient } from '@supabase/supabase-js'

/** Tira espaços e aspas que costumam vir junto quando o valor é colado de um arquivo .env. */
const limpar = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : '')

const url = limpar(import.meta.env.VITE_SUPABASE_URL)
const key = limpar(import.meta.env.VITE_SUPABASE_ANON_KEY)

export const supabaseConfigurado = Boolean(url && key)

/** O que este build encontrou (sem mostrar os valores), para a tela de aviso. */
export const diagnosticoSupabase = {
  url: Boolean(url),
  urlFormatoOk: /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url),
  chave: Boolean(key),
  chaveFormatoOk: /^(sb_publishable_|eyJ)/.test(key),
}

export const supabase = createClient(url || 'http://localhost', key || 'sem-chave')
