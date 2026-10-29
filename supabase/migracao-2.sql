-- Minha Faculdade — migração 2 (sugestão de grade + campus/rede)
-- Cole no Supabase > SQL Editor > New query e clique em Run. Pode rodar mais de uma vez.

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

do $$
declare t text;
begin
  foreach t in array array['ofertas','perfis']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "dono" on %I', t);
    execute format(
      'create policy "dono" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
