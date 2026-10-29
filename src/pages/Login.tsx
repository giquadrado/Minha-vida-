import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Botao, Campo, Orbe, lerForm } from '../components/ui'

export default function Login() {
  const [estado, setEstado] = useState<'form' | 'enviando' | 'enviado'>('form')
  const [erro, setErro] = useState('')

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    const { email } = lerForm(e)
    setEstado('enviando')
    setErro('')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) {
      setErro(error.message)
      setEstado('form')
    } else setEstado('enviado')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="animate-flutuar pointer-events-none absolute -top-10 left-[10%] h-56 w-56 rounded-full bg-violet-600/25 blur-3xl" />
      <div className="animate-flutuar pointer-events-none absolute bottom-0 right-[8%] h-64 w-64 rounded-full bg-orange-400/15 blur-3xl" style={{ animationDelay: '-3s' }} />

      <div className="vidro animate-subir relative w-full max-w-sm rounded-3xl p-7">
        <Orbe tamanho={56} />
        <h1 className="texto-brilho mt-5 text-3xl font-extrabold tracking-tight">Minha Faculdade</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-slate-500">
          Seu cantinho para organizar a faculdade sem perder o fôlego: faltas, notas, horários e o caminho até a formatura. 💜
        </p>
        {estado === 'enviado' ? (
          <div className="animate-subir rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="mb-1 text-2xl">📬</div>
            Pronto! Enviamos um link de acesso para o seu e-mail. Abra-o neste aparelho para entrar.
          </div>
        ) : (
          <form onSubmit={entrar} className="space-y-4">
            <Campo rotulo="Seu e-mail" name="email" type="email" required autoComplete="email" placeholder="voce@email.com" />
            {erro && <p className="text-sm text-rose-600">{erro}</p>}
            <Botao className="w-full py-3" disabled={estado === 'enviando'}>
              {estado === 'enviando' ? 'Enviando…' : 'Entrar com link mágico ✨'}
            </Botao>
            <p className="text-center text-xs text-slate-400">Sem senha: a gente manda um link para o seu e-mail.</p>
          </form>
        )}
      </div>
    </div>
  )
}
