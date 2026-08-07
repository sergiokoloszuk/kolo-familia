-- ============================================================
-- Kolo Família — Migração 0076
--   Versionamento mínimo do Plano Kolo: um plano pode ser a EVOLUÇÃO de outro.
--
-- POR QUE:
--   Hoje um plano novo sobre o mesmo objetivo nasce órfão. A mãe conta que o
--   filho passou a começar a tarefa com lembrete (antes precisava dela do
--   lado), pedimos um plano novo — e ele recomeça do zero, propondo de novo o
--   degrau que ela já subiu. O acervo de resultados (`resultado`,
--   `resultado_nota`) existe desde a 0037 e não tinha como ser amarrado ao
--   plano seguinte.
--
-- A REGRA DE PRODUTO (o schema só a sustenta):
--   MESMO objetivo funcional + ajuste de estratégia/progressão  → `revisao`
--   Objetivo funcional DIFERENTE                                → `novo`
--   Assunto vizinho que ajuda a ler o outro                     → `relacionado`
--
--   Exemplo: "iniciar tarefas com menos ajuda" que evolui de presença → lembrete
--   → autonomia é UMA linha de plano, versões 1, 2, 3. Se aparecer dificuldade
--   de socialização na escola, é plano NOVO — não a versão 4 do outro.
--
-- POR QUE NÃO É MAIS QUE ISSO:
--   Nada de árvore de revisões, diff, merge ou histórico navegável. Três
--   colunas respondem as únicas perguntas que o produto faz hoje: "existe um
--   anterior?", "qual a ordem?" e "que tipo de relação é?". O resto seria
--   arquitetura para um uso que ainda não existe.
--
-- IMPACTO: aditiva. Três colunas anuláveis (`versao` com default 1) e um
--   índice. Nenhuma linha existente muda de sentido: todo plano de hoje fica
--   `plano_pai_id = null`, `versao = 1`, `tipo_relacao = null`, que é
--   exatamente "plano solto", o que eles são.
--
-- ⚠️ NÃO APLICAR ainda. A fila de migrações tem a 0075 (Rotina) pendente, e a
--   ordem importa: 0075 primeiro.
--
-- ROLLBACK:
--   drop index if exists public.planos_pai_idx;
--   alter table public.planos
--     drop column if exists plano_pai_id,
--     drop column if exists versao,
--     drop column if exists tipo_relacao;
-- ============================================================

alter table public.planos
  -- `on delete set null`, não cascade: apagar o plano v1 não pode levar junto
  -- a v2, que é o que a família está usando hoje.
  add column if not exists plano_pai_id uuid references public.planos(id) on delete set null,
  add column if not exists versao int not null default 1,
  add column if not exists tipo_relacao text
    check (tipo_relacao in ('novo', 'revisao', 'relacionado'));

-- Buscar a linha de um plano: "quais são as versões deste?"
create index if not exists planos_pai_idx
  on public.planos (plano_pai_id, versao)
  where plano_pai_id is not null;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0076.
-- ============================================================
