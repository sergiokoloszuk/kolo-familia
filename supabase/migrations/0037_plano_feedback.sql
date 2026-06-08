-- Fase 4 — ciclo de aprendizado.
-- A mãe diz se o plano funcionou; a Kolo guarda e os próximos planos
-- priorizam o que deu certo. A Ayla pode perguntar proativamente (com
-- link pro plano), e marcamos quando perguntou pra não repetir.

alter table public.planos
  add column if not exists resultado text
    check (resultado in ('funcionou', 'parcial', 'nao_funcionou', 'nao_testou')),
  add column if not exists resultado_nota text,
  add column if not exists resultado_em timestamptz,
  add column if not exists seguimento_enviado_em timestamptz;

-- Busca de candidatos ao follow-up (sem resultado, ainda não perguntado).
create index if not exists planos_seguimento_idx
  on public.planos (family_account_id, created_at)
  where resultado is null and seguimento_enviado_em is null;
