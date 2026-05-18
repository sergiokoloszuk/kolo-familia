-- ============================================================
-- 0021 — Ayla v2: tipos de evento extras
--
-- Expande o CHECK constraint de `ayla_eventos_longitudinais.tipo` pra cobrir
-- a taxonomia ampliada do Manual Operacional + feedback do produto:
--
--   - melhora_relatada       (mudança positiva clara)
--   - regressao_observada    (perda de capacidade já estabelecida)
--   - sensibilidade_evidenciada (evidência de perfil sensorial/alimentar)
--   - hiperfoco_evidenciado  (evidência de hiperfoco / interesse intenso)
--   - preferencia_revelada   (gosta de / evita algo concreto)
--   - mudanca_fase           (transição estrutural — saiu/entrou de uma fase)
--
-- Junto com os já existentes em 0019:
--   conversa_turno, check_in_resposta, crise_relatada, meltdown_relatado,
--   shutdown_relatado, conquista_relatada, mudanca_observada,
--   estrategia_testada, follow_up_resposta, registro_explicito
--
-- NÃO altera dados existentes nem o vocabulário do TypeScript — só amplia
-- o set permitido pelo banco. O lado TS é atualizado em
-- lib/ayla/manual/memory.ts.
-- ============================================================

ALTER TABLE ayla_eventos_longitudinais
  DROP CONSTRAINT IF EXISTS ayla_eventos_longitudinais_tipo_check;

ALTER TABLE ayla_eventos_longitudinais
  ADD CONSTRAINT ayla_eventos_longitudinais_tipo_check
  CHECK (tipo IN (
    -- Eventos de manifestação aguda
    'crise_relatada',
    'meltdown_relatado',
    'shutdown_relatado',

    -- Eventos de progresso
    'conquista_relatada',
    'melhora_relatada',         -- NOVO

    -- Eventos de retrocesso
    'regressao_observada',      -- NOVO

    -- Eventos de revelação de perfil
    'sensibilidade_evidenciada',-- NOVO (sensorial / alimentar / etc)
    'hiperfoco_evidenciado',    -- NOVO
    'preferencia_revelada',     -- NOVO (gosta de / evita)

    -- Eventos de mudança estrutural
    'mudanca_observada',
    'mudanca_fase',             -- NOVO (transição estrutural saiu/entrou)

    -- Eventos de interação com estratégia
    'estrategia_testada',

    -- Eventos de conversa
    'conversa_turno',
    'check_in_resposta',
    'follow_up_resposta',

    -- Captura genérica neutra
    'registro_explicito'
  ));
