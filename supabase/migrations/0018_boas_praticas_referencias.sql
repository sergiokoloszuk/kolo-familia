-- ============================================================
-- Kolo Família — Migração 0018
--   Adiciona 2 colunas a `boas_praticas` para o import do XLSX da
--   Karina (368 BPs curadas, fonte: Fase 3).
--
--   1. `codigo_externo` (text, unique nullable)
--      Código da BP no XLSX da fundadora (ex: "BP-APR-01").
--      Permite re-import idempotente e referência cruzada com a
--      planilha fonte. NULL para BPs criadas direto pela UI.
--      Postgres permite múltiplos NULL em coluna UNIQUE, então não
--      precisa de unique index parcial.
--
--   2. `referencia_bibliografica` (text)
--      Fonte epistêmica da BP — nome do PDF/livro/autor de origem
--      (ex: "Cérebro da Criança - Siegel & Bryson"). Uso interno
--      em revisão e auditoria. NÃO aparece nas respostas das skills
--      (autores ficam no veto absoluto).
-- ============================================================

alter table public.boas_praticas
  add column if not exists codigo_externo text unique,
  add column if not exists referencia_bibliografica text;

create index if not exists boas_praticas_codigo_externo_idx
  on public.boas_praticas(codigo_externo)
  where codigo_externo is not null;

notify pgrst, 'reload schema';
