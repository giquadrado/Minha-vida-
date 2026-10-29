import { describe, expect, it } from 'vitest'
import { limpar, normalizarUrlSupabase } from './ambiente'

describe('valores de ambiente colados com sujeira', () => {
  it('tira espaços, quebras de linha e aspas', () => {
    expect(limpar('  "sb_publishable_abc"\r\n')).toBe('sb_publishable_abc')
    expect(limpar('sb_publishable_abc\n')).toBe('sb_publishable_abc')
    expect(limpar(undefined)).toBe('')
  })

  it('reduz a URL ao endereço do projeto', () => {
    const certa = 'https://hhwowytvsnrxyccqqjfi.supabase.co'
    expect(normalizarUrlSupabase(certa)).toBe(certa)
    expect(normalizarUrlSupabase('https://hhwowytvsnrxyccqqjfi.supabase.co/**\n')).toBe(certa) // o caso real
    expect(normalizarUrlSupabase(' "https://hhwowytvsnrxyccqqjfi.supabase.co/" ')).toBe(certa)
    expect(normalizarUrlSupabase('https://hhwowytvsnrxyccqqjfi.supabase.co/rest/v1/')).toBe(certa)
  })

  it('não mexe no que não é do Supabase', () => {
    expect(normalizarUrlSupabase('http://localhost:54321')).toBe('http://localhost:54321')
    expect(normalizarUrlSupabase('')).toBe('')
  })
})
