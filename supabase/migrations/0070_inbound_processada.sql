-- ============================================================
-- Kolo Família — Migração 0070
--   CONTROLE DE TURNO da Ayla: marca qual mensagem recebida já foi atendida.
--
--   O problema (medido em conversas reais, 29/07/2026): o webhook faz
--   `after(processInbound)` POR MENSAGEM. Quando a mãe manda 4 mensagens
--   seguidas — que é como se escreve no WhatsApp —, rodam 4 Aylas em paralelo,
--   cada uma lendo o histórico antes de as outras responderem. O resultado
--   apareceu na conversa do Pietro: a MESMA pergunta feita 3 vezes no mesmo
--   minuto, resposta acolhendo uma conquista que não existia, e balões que
--   respondiam mensagens diferentes ao mesmo tempo.
--
--   O conserto é agrupar: esperar alguns segundos de silêncio e responder UMA
--   vez, com tudo junto. Pra isso o processamento precisa CLAIMAR o lote de
--   forma atômica — senão duas execuções concorrentes pegam as mesmas
--   mensagens e a duplicidade volta por outro caminho.
--
--   `processada_em` é esse claim: um UPDATE ... WHERE processada_em IS NULL
--   RETURNING só devolve linhas pra QUEM chegou primeiro. Quem perde a corrida
--   recebe zero linhas e desiste em silêncio.
-- ============================================================

alter table public.ayla_messages
  add column if not exists processada_em timestamptz;

comment on column public.ayla_messages.processada_em is
  'Quando esta mensagem recebida entrou num lote já respondido. NULL = ainda aguardando resposta. Usado como claim atômico do controle de turno.';

-- Só as recebidas entram na fila; índice parcial mantém a busca barata mesmo
-- com a tabela crescendo (a varredura é sempre "o que falta responder").
create index if not exists idx_ayla_messages_inbound_pendente
  on public.ayla_messages (family_account_id, created_at)
  where direcao = 'inbound' and processada_em is null;

-- Backfill: tudo que já existe está respondido (ou perdido no tempo). Sem isto
-- o primeiro lote de cada família varreria a conversa inteira desde o começo.
update public.ayla_messages
   set processada_em = coalesce(recebida_em, created_at)
 where direcao = 'inbound'
   and processada_em is null;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0070.
-- Verificação (deve devolver 0 — nada pendente de antes do deploy):
--   select count(*) from public.ayla_messages
--    where direcao = 'inbound' and processada_em is null;
-- ============================================================
