-- Minha Faculdade — migração 3 (cadastro de estágio + anexo do relatório)
-- Cole no Supabase > SQL Editor > New query e clique em Run. Pode rodar mais de uma vez.

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
