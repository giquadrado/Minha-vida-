import { useEffect, useMemo, useRef, useState } from 'react'
import { useLista, useTabela } from '../lib/db'
import { horariosAtivos, horariosDaSemana, inicioDaSemana } from '../lib/semana'
import { hhmm, minutos } from '../lib/calculos'
import { AVATAR_PADRAO, LUGARES, chaveDe, situacaoEm, type Lugar } from '../lib/campus'
import { useNome } from '../lib/usuario'
import { Boneco, BonecoIcone, CABELOS } from '../components/Boneco'
import { Mapa } from '../components/Mapa'
import { NOMES_SALA, Sala, type TipoSala } from '../components/Salas'
import { Botao, Campo, Card, Pagina, Selecao, Selo } from '../components/ui'
import { DIAS, type AvatarCfg } from '../lib/types'

type Aba = 'mapa' | TipoSala

const PELE = ['#f8d9bf', '#f1c9a5', '#d9a273', '#b27a4f', '#8a5a3a', '#5e3b25']
const CABELO = ['#1c1530', '#3b2a20', '#7a4a24', '#c9a24a', '#d9d9e8', '#d9645c', '#7c5cff', '#34d399']
const ROUPA = ['#7c5cff', '#22d3ee', '#fb7185', '#fbbf24', '#34d399', '#f4f6ff', '#2f3a68', '#1c1530']

const CHAVE_LOCAL = 'campus.avatar'
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

function Cores({ rotulo, opcoes, valor, onChange }: { rotulo: string; opcoes: string[]; valor: string; onChange: (c: string) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-slate-600">{rotulo}</div>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${rotulo} ${c}`}
            onClick={() => onChange(c)}
            className={`h-8 w-8 cursor-pointer rounded-lg border-2 transition active:scale-90 ${valor === c ? 'scale-110 border-white' : 'border-transparent'}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  )
}

function lerLocal(): { apelido?: string; cfg?: Partial<AvatarCfg> } {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_LOCAL) ?? '{}')
  } catch {
    return {}
  }
}

export default function Campus() {
  const nome = useNome()
  const todosHorarios = useLista('horarios').data ?? []
  const turmasTodas = useLista('turmas').data ?? []
  const horarios = horariosDaSemana(horariosAtivos(todosHorarios, turmasTodas), inicioDaSemana(new Date()))
  const perfis = useLista('perfis')
  const { salvar } = useTabela('perfis')
  const perfil = perfis.data?.[0]

  const [aba, setAba] = useState<Aba>('mapa')
  const [agora, setAgora] = useState(() => new Date())
  const [viagem, setViagem] = useState<{ dia: number; min: number } | null>(null)
  const [apelido, setApelido] = useState(() => lerLocal().apelido ?? '')
  const [cfg, setCfg] = useState<AvatarCfg>(() => ({ ...AVATAR_PADRAO, ...lerLocal().cfg }))
  const [editando, setEditando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [movendo, setMovendo] = useState(false)
  const carregouPerfil = useRef(false)

  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (carregouPerfil.current || !perfil) return
    carregouPerfil.current = true
    if (perfil.apelido) setApelido(perfil.apelido)
    setCfg((c) => ({ ...c, ...perfil.avatar }))
  }, [perfil])

  const nomeExibido = apelido || nome || 'Eu'
  const real = situacaoEm(horarios, agora.getDay(), agora.getHours() * 60 + agora.getMinutes())
  const momento = viagem ?? { dia: agora.getDay(), min: agora.getHours() * 60 + agora.getMinutes() }
  const situacao = viagem ? situacaoEm(horarios, viagem.dia, viagem.min) : real
  const noite = momento.min < 6 * 60 || momento.min >= 18 * 60 + 30

  // anima a caminhada pelo mapa quando o lugar muda
  const lugarAnterior = useRef<Lugar>(situacao.lugar)
  useEffect(() => {
    if (lugarAnterior.current === situacao.lugar) return
    lugarAnterior.current = situacao.lugar
    setMovendo(true)
    const t = window.setTimeout(() => setMovendo(false), 1900)
    return () => window.clearTimeout(t)
  }, [situacao.lugar])

  // Ponto de ligação com a futura rede: publica onde você está de verdade (não o horário "viajado").
  const publicado = useRef('')
  useEffect(() => {
    if (perfis.isLoading || perfis.isError) return
    const k = chaveDe(real)
    if (publicado.current === k) return
    publicado.current = k
    salvar.mutate({
      linha: { apelido: nomeExibido, avatar: cfg, local_atual: real.lugar, detalhe_atual: real.detalhe, atualizado_em: new Date().toISOString() },
      conflito: 'user_id',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfis.isLoading, perfis.isError, real.lugar, real.detalhe])

  const fala = situacao.ate && situacao.lugar !== 'casa' ? `${situacao.detalhe} · até ${situacao.ate}` : situacao.detalhe

  const quadro = useMemo(() => {
    const doDia = (tipo: 'aula' | 'trabalho') =>
      horarios
        .filter((h) => h.dia_semana === momento.dia && (tipo === 'aula' ? h.tipo === 'aula' : h.tipo !== 'aula'))
        .sort((a, b) => minutos(a.inicio) - minutos(b.inicio))
        .map((h) => `${hhmm(h.inicio)} ${h.titulo}`)
    return { faculdade: doDia('aula'), trabalho: doDia('trabalho') }
  }, [horarios, momento.dia])

  function guardar() {
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ apelido: nomeExibido, cfg }))
    } catch {
      /* segue sem armazenamento local */
    }
    salvar.mutate({ linha: { apelido: nomeExibido, avatar: cfg }, conflito: 'user_id' })
    setSalvo(true)
    window.setTimeout(() => setSalvo(false), 2000)
  }

  const abas: [Aba, string][] = [['mapa', '🗺️ Mapa'], ['faculdade', '🏫 Faculdade'], ['trabalho', '💼 Trabalho'], ['casa', '🏠 Casa']]

  return (
    <Pagina titulo="Campus" acao={<Selo cor="cinza">📡 rede offline · em breve</Selo>}>
      <Card className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-16 items-end justify-center rounded-2xl bg-slate-50 pb-1">
          <BonecoIcone cfg={cfg} tamanho={64} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {viagem ? `Simulando ${DIAS[viagem.dia]} ${hm(viagem.min)}` : 'Agora'}
          </div>
          <div className="text-xl font-bold">{LUGARES[situacao.lugar].icone} {LUGARES[situacao.lugar].nome}</div>
          <div className="text-sm text-slate-600">{fala}</div>
        </div>
        <Botao variante="secundario" onClick={() => setEditando(!editando)}>{editando ? 'Fechar' : '🎨 Personalizar'}</Botao>
      </Card>

      <div className="flex flex-wrap gap-2">
        {abas.map(([v, t]) => (
          <Botao key={v} variante={aba === v ? 'primario' : 'secundario'} onClick={() => setAba(v)}>{t}</Botao>
        ))}
      </div>

      {aba === 'mapa' ? (
        <Mapa lugar={situacao.lugar} cfg={cfg} apelido={nomeExibido} fala={fala} noite={noite} movendo={movendo} onEscolher={(l) => setAba(l)} />
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">{NOMES_SALA[aba]}</span>
            {situacao.lugar === aba ? <Selo cor="verde">você está aqui</Selo> : <Selo>vazio agora</Selo>}
          </div>
          <Sala tipo={aba} cfg={cfg} apelido={nomeExibido} aqui={situacao.lugar === aba} fala={fala} quadro={quadro[aba === 'casa' ? 'faculdade' : aba]} noite={noite} />
        </div>
      )}

      <Card titulo="⏱️ Ver em outro horário">
        <div className="flex flex-wrap items-end gap-3">
          <Selecao
            rotulo="Dia"
            value={String(momento.dia)}
            onChange={(e) => setViagem({ dia: Number(e.target.value), min: momento.min })}
            opcoes={[1, 2, 3, 4, 5, 6, 0].map((d): [string, string] => [String(d), DIAS[d]])}
          />
          <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-600">Hora: {hm(momento.min)}</span>
            <input type="range" min={0} max={1425} step={15} value={momento.min} onChange={(e) => setViagem({ dia: momento.dia, min: Number(e.target.value) })} className="accent-indigo-500" />
          </label>
          <Botao variante="fantasma" disabled={!viagem} onClick={() => setViagem(null)}>Voltar para agora</Botao>
        </div>
        <p className="mt-2 text-xs text-slate-500">O boneco vai para onde a sua grade diz que você estaria. Útil para conferir a semana inteira.</p>
      </Card>

      {editando && (
        <Card titulo="🎨 Meu personagem">
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-2">
              <svg viewBox="-60 -60 120 130" width={150} className="rounded-2xl bg-slate-50">
                <Boneco cfg={cfg} x={0} y={50} escala={1.9} nome={nomeExibido} />
              </svg>
            </div>
            <div className="space-y-4">
              <Campo rotulo="Apelido" value={apelido} placeholder={nome || 'Como você quer aparecer'} maxLength={14} onChange={(e) => setApelido(e.target.value)} />
              <div>
                <div className="mb-1.5 text-sm font-medium text-slate-600">Cabelo</div>
                <div className="flex flex-wrap gap-2">
                  {CABELOS.map((n, i) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCfg({ ...cfg, estilo: i })}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition ${cfg.estilo === i ? 'border-indigo-400 bg-indigo-100 text-indigo-900' : 'border-slate-300 text-slate-500'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <Cores rotulo="Pele" opcoes={PELE} valor={cfg.pele} onChange={(pele) => setCfg({ ...cfg, pele })} />
              <Cores rotulo="Cor do cabelo" opcoes={CABELO} valor={cfg.cabelo} onChange={(cabelo) => setCfg({ ...cfg, cabelo })} />
              <Cores rotulo="Camisa" opcoes={ROUPA} valor={cfg.camisa} onChange={(camisa) => setCfg({ ...cfg, camisa })} />
              <Cores rotulo="Calça" opcoes={ROUPA} valor={cfg.calca} onChange={(calca) => setCfg({ ...cfg, calca })} />
              <div className="flex items-center gap-3">
                <Botao onClick={guardar}>Salvar personagem</Botao>
                {salvo && <span className="text-sm text-emerald-700">Salvo ✓</span>}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card titulo="👥 Amigos">
        <p className="text-sm text-slate-600">
          Quando a rede for ligada, os seus amigos vão aparecer aqui, nos mesmos prédios, mostrando onde cada um está agora. O seu local já é
          guardado a cada mudança (<code>perfis.local_atual</code>), então só falta conectar.
        </p>
        <div className="mt-3 flex gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-16 w-14 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-xl text-slate-400">?</div>
          ))}
        </div>
      </Card>
    </Pagina>
  )
}
