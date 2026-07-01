-- ============================================================
-- Kolo Família — Migração 0053
--   Idempotência do inbound da Ayla (planos/respostas duplicados).
--
--   Bug: a Z-API entrega o mesmo webhook mais de uma vez (entrega
--   "ao-menos-uma-vez") e o processamento roda em background sem deduplicar —
--   duas execuções geravam DOIS planos idênticos (2 PDFs) pra a mesma mensagem.
--
--   Fix: guardar o id da mensagem da Z-API e usar um índice ÚNICO como trava.
--   O primeiro insert vence; o reenvio (ou execução concorrente) vira no-op.
--   NULL é distinto no unique do Postgres → payloads sem id ainda inserem,
--   só não deduplicam (caso raro).
-- ============================================================

alter table public.ayla_messages
  add column if not exists zaap_message_id text;

create unique index if not exists ayla_messages_zaap_message_id_uidx
  on public.ayla_messages(zaap_message_id);
