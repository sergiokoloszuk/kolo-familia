-- ============================================================
-- Kolo Família — Migração 0028
--   Histórias ilustradas: o responsável descreve, a IA escreve em
--   páginas e ilustra cada uma usando o avatar da criança como
--   referência (consistência do personagem).
--   Estende public.historias (já existe do 0001) + nova historia_paginas.
-- ============================================================

alter table public.historias
  add column if not exists descricao_input text,
  add column if not exists estilo text,
  add column if not exists status text not null default 'pronta'
    check (status in ('gerando','pronta','erro')),
  add column if not exists erro text,
  add column if not exists capa_url text,
  add column if not exists leituras int not null default 0;

-- conteudo é NOT NULL no schema legado; na geração nova preenchemos com o
-- texto corrido das páginas pra satisfazer a constraint.

create table if not exists public.historia_paginas (
  id uuid primary key default gen_random_uuid(),
  historia_id uuid not null references public.historias(id) on delete cascade,
  ordem int not null,
  texto text,
  fala text,
  imagem_url text,
  created_at timestamptz not null default now()
);
create index if not exists historia_paginas_idx
  on public.historia_paginas(historia_id, ordem);

alter table public.historia_paginas enable row level security;
create policy historia_paginas_self on public.historia_paginas
  for all to authenticated
  using (
    exists (
      select 1 from public.historias h
      where h.id = historia_id
        and h.family_account_id = public.current_family_account_id()
    )
  )
  with check (
    exists (
      select 1 from public.historias h
      where h.id = historia_id
        and h.family_account_id = public.current_family_account_id()
    )
  );

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0028.
-- ============================================================
