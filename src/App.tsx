import { Suspense, lazy, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigurado } from './lib/supabase'
import { Orbe } from './components/ui'
import Login from './pages/Login'
import Painel from './pages/Painel'
import Hoje from './pages/Hoje'
import Semana from './pages/Semana'
import Semestre from './pages/Semestre'
import Grade from './pages/Grade'
import Horas from './pages/Horas'
import Config from './pages/Config'
import Campus from './pages/Campus'
import Sugestoes from './pages/Sugestoes'

const Importar = lazy(() => import('./pages/Importar'))

const NAV = [
  { to: '/', rotulo: 'Painel', icone: '✨', mobile: true },
  { to: '/campus', rotulo: 'Campus', icone: '🏫', mobile: true },
  { to: '/hoje', rotulo: 'Hoje', icone: '✅', mobile: true },
  { to: '/semana', rotulo: 'Semana', icone: '🗓️', mobile: true },
  { to: '/semestre', rotulo: 'Matérias', icone: '📚', mobile: false },
  { to: '/sugestoes', rotulo: 'Montar semestre', icone: '🧭', mobile: false },
  { to: '/grade', rotulo: 'Grade curricular', icone: '🎓', mobile: false },
  { to: '/horas', rotulo: 'Estágio e horas', icone: '⏱️', mobile: false },
  { to: '/importar', rotulo: 'Enviar documentos', icone: '📥', mobile: false },
  { to: '/config', rotulo: 'Mais', icone: '⚙️', mobile: true },
]

function Carregando() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Orbe tamanho={56} />
    </div>
  )
}

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  const { pathname } = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  if (!supabaseConfigurado)
    return (
      <div className="mx-auto max-w-lg p-6 text-sm">
        <h1 className="mb-2 text-lg font-semibold">Falta configurar o Supabase</h1>
        <p>
          Copie <code>.env.example</code> para <code>.env</code>, preencha <code>VITE_SUPABASE_URL</code> e{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> e reinicie o <code>npm run dev</code>. Veja o README.
        </p>
      </div>
    )
  if (sessao === undefined) return <Carregando />
  if (!sessao) return <Login />

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 p-4 backdrop-blur-xl md:block">
        <div className="mb-6 flex items-center gap-3 px-2 py-2">
          <Orbe tamanho={40} />
          <span className="font-bold leading-tight">
            Minha
            <br />
            Faculdade
          </span>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? 'bg-indigo-100 font-semibold text-indigo-900 shadow-[inset_3px_0_0_#8b6cff]'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`
              }
            >
              <span className="text-base transition group-hover:scale-125">{n.icone}</span>
              {n.to === '/config' ? 'Configurações' : n.rotulo}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/hoje" element={<Hoje />} />
          <Route path="/semana" element={<Semana />} />
          <Route path="/semestre" element={<Semestre />} />
          <Route path="/campus" element={<Campus />} />
          <Route path="/sugestoes" element={<Sugestoes />} />
          <Route path="/grade" element={<Grade />} />
          <Route path="/horas" element={<Horas />} />
          <Route
            path="/importar"
            element={
              <Suspense fallback={<Carregando />}>
                <Importar />
              </Suspense>
            }
          />
          <Route path="/config" element={<Config />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav
        className="vidro fixed inset-x-3 z-30 flex rounded-3xl p-1.5 md:hidden"
        style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))', background: 'rgb(14 18 40 / 0.82)' }}
      >
        {NAV.filter((n) => n.mobile).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center rounded-2xl py-2 text-[11px] font-medium transition ${
                isActive ? 'bg-indigo-100 text-indigo-900' : 'text-slate-500'
              }`
            }
          >
            <span className="text-lg leading-none">{n.icone}</span>
            {n.rotulo}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
