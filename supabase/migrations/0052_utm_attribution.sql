-- ============================================================
-- Kolo Família — Migração 0052
--   Atribuição de UTM: de qual anúncio/campanha veio a família.
--
--   Espelha a atribuição de afiliado (kolo_ref → afiliado_id). O cliente
--   captura as UTMs da URL nas telas de cadastro e guarda no cookie kolo_utm;
--   o onboarding lê o cookie e grava aqui, uma única vez (utm_atribuido_em).
--
--   Sem PII: são só as etiquetas do anúncio (facebookads, nome da campanha,
--   criativo, posicionamento/keyword). A agência usa UTMs padrão do Meta/Google.
-- ============================================================

alter table public.family_accounts
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists utm_atribuido_em timestamptz;

create index if not exists family_accounts_utm_source_idx
  on public.family_accounts(utm_source)
  where utm_source is not null;
