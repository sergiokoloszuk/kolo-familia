-- ============================================================
-- 0020 — Ayla v2: ETL longitudinal automático
--
-- Popula `ayla_eventos_longitudinais` (criada em 0019) a partir das tabelas
-- já existentes: `ayla_messages`, `diarios`, `check_ins_diarios`.
--
-- DESIGN:
--   - Triggers AFTER INSERT em cada source table → insere evento derivado
--   - Idempotência via `source_key` UNIQUE: re-inserções do mesmo source
--     row são no-op (ON CONFLICT DO NOTHING)
--   - Sem LLM, sem inferência semântica — apenas mapeamentos determinísticos
--   - NÃO altera comportamento ativo da Ayla v1
--
-- ROLLBACK seguro:
--   - DROP TRIGGER <name> ON <source_table>
--   - DROP FUNCTION fn_ayla_evento_from_*
--   - Eventos derivados podem ser deletados via:
--       DELETE FROM ayla_eventos_longitudinais WHERE source_key IS NOT NULL;
--   - O ALTER TABLE pode ser revertido com:
--       ALTER TABLE ayla_eventos_longitudinais DROP COLUMN source_key;
--
-- BACKFILL histórico: ver apps/web/scripts/ayla-eventos-backfill.mjs.
--   Os triggers só pegam INSERTs futuros — backfill cuida do passado.
-- ============================================================


-- ============================================================
-- 1) source_key UNIQUE pra idempotência
--    Identifica univocamente cada evento derivado pra evitar duplicação.
--    Formato: <source>:<source_id>:<campo>  (campo = '_' quando único)
-- ============================================================
ALTER TABLE ayla_eventos_longitudinais
  ADD COLUMN IF NOT EXISTS source_key text;

-- Postgres permite múltiplos NULLs em UNIQUE — eventos criados manualmente
-- pela API v2 no futuro podem ter source_key = NULL sem conflito.
-- Guard manual: ADD CONSTRAINT não aceita IF NOT EXISTS direto.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ayla_eventos_source_key_uq'
      AND conrelid = 'ayla_eventos_longitudinais'::regclass
  ) THEN
    ALTER TABLE ayla_eventos_longitudinais
      ADD CONSTRAINT ayla_eventos_source_key_uq UNIQUE (source_key);
  END IF;
END $$;


-- ============================================================
-- 2) Função: ayla_messages → ayla_eventos_longitudinais
--
-- Regras:
--   - SÓ inbound vira evento (outbound é a Ayla falando, não evento sobre a família)
--   - Tipo é 'check_in_resposta' se houve outbound proativa nas últimas 24h
--     antes; caso contrário 'conversa_turno'
--   - texto_livre = NEW.texto
--   - ocorreu_em = COALESCE(recebida_em, created_at)
--   - metadados.source = 'ayla_messages', metadados.source_id = NEW.id
-- ============================================================
CREATE OR REPLACE FUNCTION fn_ayla_evento_from_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_ocorreu_em timestamptz;
BEGIN
  -- Só inbound vira evento
  IF NEW.direcao IS DISTINCT FROM 'inbound' THEN
    RETURN NEW;
  END IF;

  v_ocorreu_em := COALESCE(NEW.recebida_em, NEW.created_at, now());

  -- Inferir tipo: check_in_resposta se há outbound proativa nas últimas 24h
  IF EXISTS (
    SELECT 1
    FROM ayla_messages prev
    WHERE prev.family_account_id = NEW.family_account_id
      AND prev.direcao = 'outbound'
      AND prev.category = 'proativa'
      AND prev.created_at < NEW.created_at
      AND prev.created_at > (NEW.created_at - interval '24 hours')
    LIMIT 1
  ) THEN
    v_tipo := 'check_in_resposta';
  ELSE
    v_tipo := 'conversa_turno';
  END IF;

  INSERT INTO ayla_eventos_longitudinais (
    family_account_id,
    membro_atipico_id,
    tipo,
    dominios,
    intensidade,
    ocorreu_em,
    texto_livre,
    metadados,
    source_key
  ) VALUES (
    NEW.family_account_id,
    NEW.membro_atipico_id,
    v_tipo,
    '{}'::text[],     -- domínios ficam vazios até classifier ativar
    NULL,              -- intensidade idem
    v_ocorreu_em,
    NEW.texto,
    jsonb_build_object(
      'source', 'ayla_messages',
      'source_id', NEW.id::text,
      'direcao', NEW.direcao,
      'category', NEW.category,
      'tipo_v1', NEW.tipo
    ),
    'ayla_messages:' || NEW.id::text || ':_'
  )
  ON CONFLICT (source_key) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- INVARIANTE: ETL nunca pode bloquear a v1. Logamos no postgres log
  -- (WARNING) e retornamos NEW pra deixar o INSERT original continuar.
  RAISE WARNING 'fn_ayla_evento_from_message falhou em msg=% : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ayla_evento_from_message ON ayla_messages;
CREATE TRIGGER trg_ayla_evento_from_message
  AFTER INSERT ON ayla_messages
  FOR EACH ROW
  EXECUTE FUNCTION fn_ayla_evento_from_message();


-- ============================================================
-- 3) Função: diarios → ayla_eventos_longitudinais
--
-- Regras: uma linha de diário pode gerar 1-3 eventos (conquista, desafio,
-- observacao_livre). Cada campo tem source_key distinto.
--
--   - conquista → tipo='conquista_relatada'
--   - desafio → tipo='registro_explicito' (futuro classifier pode upgrades)
--   - observacao_livre → tipo='registro_explicito'
--
-- Por que desafio NÃO vira crise_relatada automaticamente: sem análise de
-- intensidade, "desafio do dia" pode ser pequeno (resistência ao banho) ou
-- grande (meltdown na escola). Classifier v2 fará o upgrade quando rodar.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_ayla_evento_from_diario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ocorreu_em timestamptz;
BEGIN
  -- Diário tem `data` (date) — convertemos pra timestamptz no meio-dia
  -- pra evitar ambiguidade de fuso. Ordenação cronológica preservada.
  v_ocorreu_em := (NEW.data::text || ' 12:00:00')::timestamptz;

  -- Evento de conquista
  IF NEW.conquista IS NOT NULL AND length(trim(NEW.conquista)) > 0 THEN
    INSERT INTO ayla_eventos_longitudinais (
      family_account_id, membro_atipico_id, tipo, dominios, intensidade,
      ocorreu_em, texto_livre, metadados, source_key
    ) VALUES (
      NEW.family_account_id,
      NEW.membro_atipico_id,
      'conquista_relatada',
      '{}'::text[],
      NULL,
      v_ocorreu_em,
      NEW.conquista,
      jsonb_build_object(
        'source', 'diarios',
        'source_id', NEW.id::text,
        'campo', 'conquista',
        'origem_v1', NEW.origem
      ),
      'diarios:' || NEW.id::text || ':conquista'
    )
    ON CONFLICT (source_key) DO NOTHING;
  END IF;

  -- Evento de desafio (neutro — sem inferir intensidade)
  IF NEW.desafio IS NOT NULL AND length(trim(NEW.desafio)) > 0 THEN
    INSERT INTO ayla_eventos_longitudinais (
      family_account_id, membro_atipico_id, tipo, dominios, intensidade,
      ocorreu_em, texto_livre, metadados, source_key
    ) VALUES (
      NEW.family_account_id,
      NEW.membro_atipico_id,
      'registro_explicito',
      '{}'::text[],
      NULL,
      v_ocorreu_em,
      NEW.desafio,
      jsonb_build_object(
        'source', 'diarios',
        'source_id', NEW.id::text,
        'campo', 'desafio',
        'possivel_gatilho', NEW.possivel_gatilho,
        'origem_v1', NEW.origem
      ),
      'diarios:' || NEW.id::text || ':desafio'
    )
    ON CONFLICT (source_key) DO NOTHING;
  END IF;

  -- Evento de observação livre
  IF NEW.observacao_livre IS NOT NULL AND length(trim(NEW.observacao_livre)) > 0 THEN
    INSERT INTO ayla_eventos_longitudinais (
      family_account_id, membro_atipico_id, tipo, dominios, intensidade,
      ocorreu_em, texto_livre, metadados, source_key
    ) VALUES (
      NEW.family_account_id,
      NEW.membro_atipico_id,
      'registro_explicito',
      '{}'::text[],
      NULL,
      v_ocorreu_em,
      NEW.observacao_livre,
      jsonb_build_object(
        'source', 'diarios',
        'source_id', NEW.id::text,
        'campo', 'observacao_livre',
        'origem_v1', NEW.origem
      ),
      'diarios:' || NEW.id::text || ':observacao_livre'
    )
    ON CONFLICT (source_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ayla_evento_from_diario ON diarios;
CREATE TRIGGER trg_ayla_evento_from_diario
  AFTER INSERT ON diarios
  FOR EACH ROW
  EXECUTE FUNCTION fn_ayla_evento_from_diario();


-- ============================================================
-- 4) Função: check_ins_diarios → ayla_eventos_longitudinais
--
-- check_ins_diarios é o registro manual da mãe no app. Mapeamento:
--   - tipo = 'registro_explicito'
--   - texto_livre = "Check-in diário: <escala_emocional_mae>"
--   - intensidade derivada da escala (carga emocional, não da criança):
--       muito_bem/bem → baixa
--       neutro → media
--       dificil/muito_dificil → alta
--   - membro_atipico_id geralmente null (check-in é da mãe, não da criança)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_ayla_evento_from_check_in_diario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ocorreu_em timestamptz;
  v_intensidade text;
  v_texto text;
BEGIN
  v_ocorreu_em := (NEW.data::text || ' 12:00:00')::timestamptz;

  v_intensidade := CASE NEW.escala_emocional_mae
    WHEN 'muito_bem' THEN 'baixa'
    WHEN 'bem' THEN 'baixa'
    WHEN 'neutro' THEN 'media'
    WHEN 'dificil' THEN 'alta'
    WHEN 'muito_dificil' THEN 'alta'
    ELSE NULL
  END;

  v_texto := 'Check-in diário (mãe): ' || COALESCE(NEW.escala_emocional_mae, 'sem escala');

  INSERT INTO ayla_eventos_longitudinais (
    family_account_id,
    membro_atipico_id,
    tipo,
    dominios,
    intensidade,
    ocorreu_em,
    texto_livre,
    metadados,
    source_key
  ) VALUES (
    NEW.family_account_id,
    NULL,                     -- check-in da mãe — não vinculado a membro
    'registro_explicito',
    ARRAY['auto_cuidado_mae']::text[],   -- domínio óbvio aqui (estado da mãe)
    v_intensidade,
    v_ocorreu_em,
    v_texto,
    jsonb_build_object(
      'source', 'check_ins_diarios',
      'source_id', NEW.id::text,
      'escala_emocional_mae', NEW.escala_emocional_mae,
      'campo', 'check_in_mae'
    ),
    'check_ins_diarios:' || NEW.id::text || ':_'
  )
  ON CONFLICT (source_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ayla_evento_from_check_in_diario ON check_ins_diarios;
CREATE TRIGGER trg_ayla_evento_from_check_in_diario
  AFTER INSERT ON check_ins_diarios
  FOR EACH ROW
  EXECUTE FUNCTION fn_ayla_evento_from_check_in_diario();


-- ============================================================
-- 5) Índices auxiliares pro source_key
-- ============================================================
-- Filtros frequentes por source — útil pra dashboards/debug
CREATE INDEX IF NOT EXISTS idx_ayla_eventos_source
  ON ayla_eventos_longitudinais ((metadados->>'source'))
  WHERE source_key IS NOT NULL;
