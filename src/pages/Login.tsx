import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Botao, Campo, Orbe, lerForm } from '../components/ui'

/** Mensagens do Supabase em português, com o que fazer em cada caso. */
function traduzir(msg: string): string {
  if (/rate limit|too many|only request this after|security purposes/i.test(msg))
    return 'Foram pedidos e-mails demais em pouco tempo (o Supabase limita isso). Espere cerca de 1 hora e tente de novo. Se já chegou algum e-mail, use o código ou o link dele.'
  if (/redirect|not allowed|url/i.test(msg)) return 'Este endereço ainda não foi liberado no Supabase (Authentication → URL Configuration).'
  if (/expired|invalid|token/i.test(msg)) return 'Código inválido ou vencido. Peça um novo e use o mais recente.'
  return msg
}

const ESPERA_REENVIO = 60

export default function Login() {
  const [estado, setEstado] = useState<'form' | 'enviando' | 'enviado' | 'entrando'>('form')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [espera, setEspera] = useState(0)

  useEffect(() => {
    if (espera <= 0) return
    const t = window.setTimeout(() => setEspera(espera - 1), 1000)
    return () => window.clearTimeout(t)
  }, [espera])

  async function enviar(para: string) {
    setEstado('enviando')
    setErro('')
    const { error } = await supabase.auth.signInWithOtp({ email: para, options: { emailRedirectTo: window.location.origin } })
    if (error) {
      setErro(traduzir(error.message))
      setEstado(email && estadoAnteriorEnviado ? 'enviado' : 'form')
    } else {
      setEmail(para)
      setEstado('enviado')
      setEspera(ESPERA_REENVIO)
    }
  }
  const estadoAnteriorEnviado = estado === 'enviado'

  async function entrarComCodigo(e: React.FormEvent) {
    e.preventDefault()
    setEstado('entrando')
    setErro('')
    const { error } = await supabase.auth.verifyOtp({ email, token: codigo.replace(/\s/g, ''), type: 'email' })
    if (error) {
      setErro(traduzir(error.message))
      setEstado('enviado')
    }
    // sucesso: o App percebe a sessão e troca de tela sozinho
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

        {estado === 'enviado' || estado === 'entrando' ? (
          <div className="animate-subir space-y-4">
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="mb-1 text-2xl">📬</div>
              Enviamos um e-mail para <b>{email}</b>. Veja também a caixa de <b>spam</b>.
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                <li>Se o e-mail trouxer um <b>código</b>, digite abaixo.</li>
                <li>Se trouxer um <b>link</b>, abra-o no mesmo navegador em que você está aqui (no celular, toque em “abrir no navegador”, não no leitor do app de e-mail).</li>
              </ul>
            </div>
            <form onSubmit={entrarComCodigo} className="space-y-3">
              <Campo
                rotulo="Código do e-mail"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={12}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/[^\d\s]/g, ''))}
              />
              {erro && <p className="text-sm text-rose-600">{erro}</p>}
              <Botao className="w-full py-3" disabled={estado === 'entrando' || codigo.replace(/\s/g, '').length < 6}>
                {estado === 'entrando' ? 'Entrando…' : 'Entrar com o código'}
              </Botao>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <button className="cursor-pointer underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60" disabled={espera > 0} onClick={() => enviar(email)}>
                {espera > 0 ? `Reenviar em ${espera}s` : 'Reenviar e-mail'}
              </button>
              <button className="cursor-pointer underline" onClick={() => { setEstado('form'); setErro(''); setCodigo('') }}>
                Usar outro e-mail
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              const f = lerForm(e)
              enviar(f.email.trim())
            }}
            className="space-y-4"
          >
            <Campo rotulo="Seu e-mail" name="email" type="email" required autoComplete="email" placeholder="voce@email.com" defaultValue={email} />
            {erro && <p className="text-sm text-rose-600">{erro}</p>}
            <Botao className="w-full py-3" disabled={estado === 'enviando'}>
              {estado === 'enviando' ? 'Enviando…' : 'Receber acesso por e-mail ✨'}
            </Botao>
            <p className="text-center text-xs text-slate-400">Sem senha: a gente manda um link (e um código) para o seu e-mail.</p>
          </form>
        )}
      </div>
    </div>
  )
}
