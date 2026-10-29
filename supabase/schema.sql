-- Minha Faculdade — esquema do banco
-- Cole tudo no Supabase > SQL Editor > New query e clique em Run.

create table if not exists cursos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null default 'Meu curso',
  carga_obrigatoria int not null default 0,      -- horas de disciplinas obrigatórias
  horas_optativas int not null default 0,        -- horas optativas exigidas
  horas_estagio int not null default 0,          -- horas de estágio exigidas
  horas_complementares int not null default 0,   -- atividades complementares exigidas
  freq_minima numeric not null default 0.75,     -- 0.75 = 75%
  media_aprovacao numeric not null default 6,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists disciplinas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  codigo text not null default '',
  nome text not null,
  carga_horaria int not null default 0,
  periodo int,
  tipo text not null default 'obrigatoria' check (tipo in ('obrigatoria', 'optativa')),
  pre_requisitos text[] not null default '{}',
  status text not null default 'pendente'
    check (status in ('pendente', 'cursando', 'aprovada', 'reprovada', 'dispensada')),
  nota_final numeric,
  created_at timestamptz not null default now()
);

create table if not exists turmas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  disciplina_id uuid references disciplinas on delete set null,
  nome text not null,
  semestre text not null,
  professor text,
  sala text,
  total_aulas int not null default 0,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists horarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  turma_id uuid references turmas on delete cascade,
  tipo text not null default 'aula' check (tipo in ('aula', 'trabalho', 'outro')),
  titulo text not null default '',
  dia_semana int not null check (dia_semana between 0 and 6), -- 0 = domingo
  inicio time not null,
  fim time not null,
  aulas int not null default 1,  -- quantas aulas (créditos de presença) esse encontro vale
  local text,
  created_at timestamptz not null default now()
);

create table if not exists presencas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  turma_id uuid not null references turmas on delete cascade,
  data date not null,
  aulas int not null default 1,
  presente boolean not null,
  obs text,
  created_at timestamptz not null default now(),
  unique (turma_id, data)
);

create table if not exists avaliacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  turma_id uuid not null references turmas on delete cascade,
  nome text not null,
  peso numeric not null default 1,
  data date,
  nota numeric,
  created_at timestamptz not null default now()
);

create table if not exists horas_registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tipo text not null check (tipo in ('estagio', 'optativa', 'complementar')),
  descricao text not null,
  data date not null default current_date,
  horas numeric not null,
  comprovante text,
  created_at timestamptz not null default now()
);

-- Quadro de horários ofertados pela faculdade (usado para sugerir a próxima grade)
create table if not exists ofertas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  disciplina_id uuid references disciplinas on delete cascade,
  codigo text not null default '',
  nome text not null,
  dia_semana int not null check (dia_semana between 0 and 6),
  inicio time not null,
  fim time not null,
  local text,
  created_at timestamptz not null default now()
);

-- turma/grupo da aula no quadro: "V" (teoria), "VA", "VA/VB"…
alter table ofertas add column if not exists turma text;

-- Perfil do personagem do Campus. local_atual/detalhe_atual existem para a futura rede de amigos.
create table if not exists perfis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  apelido text,
  avatar jsonb not null default '{}'::jsonb,
  local_atual text,
  detalhe_atual text,
  atualizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- Segurança: cada usuário só enxerga e altera os próprios dados.
do $$
declare t text;
begin
  foreach t in array array['cursos','disciplinas','turmas','horarios','presencas','avaliacoes','horas_registros','ofertas','perfis']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "dono" on %I', t);
    execute format(
      'create policy "dono" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

create table if not exists estagios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  empresa text not null,
  inicio date,
  fim date,                      -- vazio = em andamento
  horas numeric,
  relatorio text not null default 'nao_iniciado'
    check (relatorio in ('nao_iniciado', 'escrevendo', 'pronto', 'entregue')),
  relatorio_arquivo text,        -- caminho do arquivo anexado no Storage
  relatorio_nome text,           -- nome original do arquivo
  observacoes text,
  created_at timestamptz not null default now()
);

alter table estagios enable row level security;
drop policy if exists "dono" on estagios;
create policy "dono" on estagios for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pasta privada para os relatórios: cada pessoa só enxerga a própria subpasta (<id do usuário>/…)
insert into storage.buckets (id, name, public)
values ('relatorios', 'relatorios', false)
on conflict (id) do nothing;

drop policy if exists "relatorios_dono" on storage.objects;
create policy "relatorios_dono" on storage.objects for all to authenticated
  using (bucket_id = 'relatorios' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'relatorios' and (storage.foldername(name))[1] = auth.uid()::text);

-- Novos tipos de evento além de aula/trabalho
alter table horarios drop constraint if exists horarios_tipo_check;
alter table horarios add constraint horarios_tipo_check
  check (tipo in ('aula', 'trabalho', 'reuniao', 'estudo', 'pessoal', 'outro'));

-- data preenchida = evento de um dia só; vazia = repete toda semana
alter table horarios add column if not exists data date;
-- id do evento na agenda de origem (Google/Outlook), usado para não duplicar ao importar de novo
alter table horarios add column if not exists origem_uid text;
create index if not exists horarios_origem_uid on horarios (user_id, origem_uid) where origem_uid is not null;

-- Link secreto para assinar a agenda do app no Google Calendar / Outlook
create table if not exists calendario_tokens (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  token text not null default encode(gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now()
);
alter table calendario_tokens enable row level security;
drop policy if exists "dono" on calendario_tokens;
create policy "dono" on calendario_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Quem tem o link secreto lê os eventos (só leitura). A função do site chama isto para montar o .ics.
create or replace function calendario_por_token(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(h) order by h.dia_semana, h.inicio), '[]'::jsonb)
  from horarios h
  join calendario_tokens t on t.user_id = h.user_id
  where t.token = p_token
    and h.origem_uid is null
    and (h.turma_id is null or exists (select 1 from turmas tu where tu.id = h.turma_id and tu.ativa));
$$;
grant execute on function calendario_por_token(text) to anon, authenticated;
