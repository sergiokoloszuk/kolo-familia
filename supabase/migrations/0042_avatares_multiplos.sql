-- 0042: múltiplos avatares por membro + seleção
--
-- Antes: avatares_membros_atipicos.membro_atipico_id era PRIMARY KEY → no
-- máximo 1 avatar por pessoa. Agora: id próprio como PK, vários avatares por
-- membro, e um marcado como `selecionado` (o usado nas Histórias/Rotinas/etc).
--
-- Idempotente. RLS não muda (políticas filtram por family_account_id, não pela PK).

alter table public.avatares_membros_atipicos
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.avatares_membros_atipicos
  add column if not exists selecionado boolean not null default false;

-- Troca a PK (membro_atipico_id -> id). O nome do constraint pode variar entre
-- ambientes, então descobrimos e dropamos a PK atual antes de criar a nova.
do $$
declare pk_name text;
begin
  select conname into pk_name
  from pg_constraint
  where conrelid = 'public.avatares_membros_atipicos'::regclass and contype = 'p';
  if pk_name is not null then
    execute format('alter table public.avatares_membros_atipicos drop constraint %I', pk_name);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.avatares_membros_atipicos'::regclass and contype = 'p'
  ) then
    alter table public.avatares_membros_atipicos add primary key (id);
  end if;
end $$;

-- Linhas existentes viram o avatar selecionado do seu membro.
update public.avatares_membros_atipicos set selecionado = true where selecionado = false;

-- Garante no máximo UM selecionado por membro.
create unique index if not exists avatares_um_selecionado_por_membro
  on public.avatares_membros_atipicos (membro_atipico_id)
  where selecionado;

-- Busca por membro (agora não-única).
create index if not exists avatares_por_membro
  on public.avatares_membros_atipicos (membro_atipico_id);
