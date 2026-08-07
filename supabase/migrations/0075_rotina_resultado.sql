-- ============================================================
-- Kolo Família — Migração 0075
--   A rotina passa a ter RESULTADO, como o plano já tem.
--
-- POR QUE, e por que não deu pra evitar:
--   A Ayla precisa (a) perguntar UMA vez só se a sequência ajudou e (b) mudar
--   a próxima orientação com o que a família responder. Nada no schema atual
--   sustenta as duas coisas.
--
--   A alternativa mais próxima que existe é `transicoes[].funcionou`, no perfil
--   do membro (Kolo Vivo). Ela não serve aqui por dois motivos concretos:
--     1. é indexada por "momento" ("banho"), não pela rotina — com duas
--        sequências criadas não dá pra saber de qual a família falou;
--     2. não guarda se JÁ perguntamos. Sem isso, "no máximo uma retomada" vira
--        promessa que o código não pode cumprir, e a mãe recebe cobrança.
--
--   Então são as MESMAS quatro colunas de `planos` (0037), de propósito: o
--   fluxo de feedback e follow-up já existe lá e passa a valer nos dois
--   artefatos sem inventar um segundo vocabulário.
--
-- IMPACTO: aditivo. Quatro colunas anuláveis e um índice parcial. Nenhuma
--   linha existente muda; toda rotina de hoje fica com resultado nulo, que é
--   exatamente "ainda não perguntamos". Nenhum código atual lê estas colunas,
--   então aplicar antes do deploy é seguro.
--
-- ROLLBACK:
--   drop index if exists public.rotinas_seguimento_idx;
--   alter table public.rotinas
--     drop column if exists resultado,
--     drop column if exists resultado_nota,
--     drop column if exists resultado_em,
--     drop column if exists seguimento_enviado_em;
--
-- NUMERAÇÃO: nasceu como 0071 e virou 0075. Os números 0071-0074 já estão
--   reivindicados por branches que ainda não entraram na main (0071/0072 =
--   BIA, 0073/0074 = Memória Viva) e nenhum deles foi aplicado em produção.
--   Pegar 0071 criaria duas migrações com o mesmo número dependendo da ordem
--   de merge. 0075 fica acima de todas e é seguro em qualquer ordem.
-- ============================================================

alter table public.rotinas
  add column if not exists resultado text
    check (resultado in ('funcionou', 'parcial', 'nao_funcionou', 'nao_testou')),
  add column if not exists resultado_nota text,
  add column if not exists resultado_em timestamptz,
  add column if not exists seguimento_enviado_em timestamptz;

-- Candidatos ao follow-up: sem resultado e ainda não perguntados. Índice
-- parcial pelo mesmo motivo do de `planos` — a busca só olha essa fatia.
create index if not exists rotinas_seguimento_idx
  on public.rotinas (family_account_id, created_at)
  where resultado is null and seguimento_enviado_em is null;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0075.
-- ============================================================
