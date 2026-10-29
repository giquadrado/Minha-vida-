-- Minha Faculdade — migração 4 (novos tipos de evento, eventos de um dia só e agenda externa)
-- Cole no Supabase > SQL Editor > New query e clique em Run. Pode rodar mais de uma vez.

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
