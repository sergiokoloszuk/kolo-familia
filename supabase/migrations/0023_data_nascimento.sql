-- ============================================================
-- Kolo Família — Migração 0023
--   Data de nascimento substitui idade.
--   - family_profiles: + data_nascimento_mae (date)
--   - membros_atipicos: + data_nascimento (date), idade vira opcional
--   A idade passa a ser SEMPRE derivada da data_nascimento no app
--   (helper apps/web/src/lib/idade.ts). As colunas `idade`/`idade_mae`
--   ficam como legado (não mais escritas) e podem ser removidas depois.
-- ============================================================

alter table public.family_profiles
  add column if not exists data_nascimento_mae date;

alter table public.membros_atipicos
  add column if not exists data_nascimento date;

-- Backfill aproximado a partir da idade existente (se houver linhas).
update public.family_profiles
  set data_nascimento_mae = (current_date - make_interval(years => idade_mae))
  where data_nascimento_mae is null and idade_mae is not null;

update public.membros_atipicos
  set data_nascimento = (current_date - make_interval(years => idade))
  where data_nascimento is null and idade is not null;

-- idade deixa de ser obrigatória (novos cadastros gravam só data_nascimento).
alter table public.membros_atipicos alter column idade drop not null;

-- ============================================================
-- FIM da migração 0023.
-- ============================================================
