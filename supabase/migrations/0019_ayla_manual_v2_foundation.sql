-- ============================================================
-- 0019 — Ayla Manual Operacional v2: fundação longitudinal
--
-- Manual Operacional da Ayla (Karina, 18/05/2026) §12, §13, §14.
--
-- Cria 4 tabelas mínimas pra suportar a camada v2:
--   - ayla_eventos_longitudinais  — eventos granulares (§14)
--   - ayla_padroes                — padrões emergentes (§13)
--   - ayla_silencio_estado        — estado de "saber desaparecer" (§10)
--   - ayla_proativo_log           — histórico de check-ins v2
--
-- NÃO mexe em tabelas existentes:
--   - ayla_messages (continua sendo o append-only oficial de turnos)
--   - ayla_preferences (consentimento, horário, frequência — já em prod)
--   - sugestao_perfil_vivos (a v2 reutiliza pra sugerir atualizações)
--   - ayla_daily_checkins, ayla_send_log, ayla_insights — tudo da v1
--
-- Esta migração é puramente ADITIVA. Não há comportamento ativo nestas
-- tabelas até a fase de implementação. Schema preparado pra ser populado.
-- ============================================================


-- ============================================================
-- Tabela: ayla_eventos_longitudinais
--   Eventos granulares por membro/família com tipos e domínios.
--   Ver lib/ayla/manual/memory.ts — EventoLongitudinal.
-- ============================================================
CREATE TABLE ayla_eventos_longitudinais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_account_id uuid NOT NULL REFERENCES family_accounts(id) ON DELETE CASCADE,
  membro_atipico_id uuid REFERENCES membros_atipicos(id) ON DELETE SET NULL,

  -- Vocabulário fechado — ver TipoEvento em /lib/ayla/manual/memory.ts
  tipo text NOT NULL CHECK (tipo IN (
    'conversa_turno',
    'check_in_resposta',
    'crise_relatada',
    'meltdown_relatado',
    'shutdown_relatado',
    'conquista_relatada',
    'mudanca_observada',
    'estrategia_testada',
    'follow_up_resposta',
    'registro_explicito'
  )),

  dominios text[] NOT NULL DEFAULT '{}',  -- ver DominioKolo em /lib/ayla/manual/types.ts
  intensidade text CHECK (intensidade IS NULL OR intensidade IN ('baixa', 'media', 'alta')),
  ocorreu_em timestamptz NOT NULL DEFAULT now(),
  texto_livre text,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ayla_eventos_membro_data
  ON ayla_eventos_longitudinais (membro_atipico_id, ocorreu_em DESC)
  WHERE membro_atipico_id IS NOT NULL;

CREATE INDEX idx_ayla_eventos_familia_data
  ON ayla_eventos_longitudinais (family_account_id, ocorreu_em DESC);

CREATE INDEX idx_ayla_eventos_dominios
  ON ayla_eventos_longitudinais USING gin (dominios);

ALTER TABLE ayla_eventos_longitudinais ENABLE ROW LEVEL SECURITY;

CREATE POLICY ayla_eventos_owner_read ON ayla_eventos_longitudinais
  FOR SELECT
  USING (
    family_account_id IN (
      SELECT id FROM family_accounts WHERE user_id = auth.uid()
    )
  );

-- Escrita só via service_role / RPC. Mãe não escreve direto.
CREATE POLICY ayla_eventos_service_write ON ayla_eventos_longitudinais
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ============================================================
-- Tabela: ayla_padroes
--   Hipóteses de padrão emergente, com estado e confiança.
--   Ver lib/ayla/manual/memory.ts — PadraoHipotetico.
-- ============================================================
CREATE TABLE ayla_padroes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_account_id uuid NOT NULL REFERENCES family_accounts(id) ON DELETE CASCADE,
  membro_atipico_id uuid NOT NULL REFERENCES membros_atipicos(id) ON DELETE CASCADE,

  -- Chave canônica do padrão — vocabulário emergente
  padrao_key text NOT NULL,
  descricao text NOT NULL,

  evidencias_count int NOT NULL DEFAULT 0,
  confianca numeric(3,2) NOT NULL DEFAULT 0.00 CHECK (confianca >= 0 AND confianca <= 1),

  -- Estado: hipotese → observado → confirmado_mae / descartado
  estado text NOT NULL DEFAULT 'hipotese'
    CHECK (estado IN ('hipotese', 'observado', 'confirmado_mae', 'descartado')),

  primeira_evidencia timestamptz NOT NULL DEFAULT now(),
  ultima_evidencia timestamptz NOT NULL DEFAULT now(),
  evidencias_evento_ids uuid[] NOT NULL DEFAULT '{}',
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),

  -- Um padrão por (membro, padrao_key) — unicidade lógica
  UNIQUE (membro_atipico_id, padrao_key)
);

CREATE INDEX idx_ayla_padroes_membro_estado
  ON ayla_padroes (membro_atipico_id, estado);

CREATE INDEX idx_ayla_padroes_familia
  ON ayla_padroes (family_account_id);

ALTER TABLE ayla_padroes ENABLE ROW LEVEL SECURITY;

CREATE POLICY ayla_padroes_owner_read ON ayla_padroes
  FOR SELECT
  USING (
    family_account_id IN (
      SELECT id FROM family_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY ayla_padroes_service_write ON ayla_padroes
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ============================================================
-- Tabela: ayla_silencio_estado
--   Estado de "saber desaparecer" por família (§10).
--   Ver lib/ayla/manual/proactive.ts — EstadoSilencio.
-- ============================================================
CREATE TABLE ayla_silencio_estado (
  family_account_id uuid PRIMARY KEY REFERENCES family_accounts(id) ON DELETE CASCADE,
  ultima_resposta_em timestamptz,
  respostas_curtas_seguidas int NOT NULL DEFAULT 0,

  -- Estado emocional inferido (do último classifier output v2)
  estado_emocional_inferido text
    CHECK (estado_emocional_inferido IS NULL OR estado_emocional_inferido IN (
      'estavel', 'cansada', 'frustrada', 'culpada',
      'sobrecarregada', 'aliviada', 'feliz'
    )),

  -- Pausa leve — não envia proativas, mas responde se mãe falar
  reduzir_ate timestamptz,

  -- Pausa total — não envia nada
  -- (Convive com ayla_preferences.desativada/pausada_ate da v1)
  pausa_completa_ate timestamptz,

  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ayla_silencio_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY ayla_silencio_owner_read ON ayla_silencio_estado
  FOR SELECT
  USING (
    family_account_id IN (
      SELECT id FROM family_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY ayla_silencio_service_write ON ayla_silencio_estado
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ============================================================
-- Tabela: ayla_proativo_log
--   Histórico de check-ins proativos da v2, com classificação.
--   Diferente de ayla_messages (que é o log universal de turnos da v1).
--   Esta tabela registra a DECISÃO + intenção do scheduler v2.
--   Ver lib/ayla/manual/proactive.ts — TipoCheckIn.
-- ============================================================
CREATE TABLE ayla_proativo_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_account_id uuid NOT NULL REFERENCES family_accounts(id) ON DELETE CASCADE,
  membro_atipico_id uuid REFERENCES membros_atipicos(id) ON DELETE SET NULL,

  -- Tipo do check-in v2 (§9)
  tipo_check_in text NOT NULL CHECK (tipo_check_in IN (
    'ancorado_evento',
    'follow_up_estrategia',
    'observacao_leve',
    'percepcao_evolutiva'
  )),

  texto text NOT NULL,
  canal text NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp', 'app')),

  -- Referência cruzada — qual ayla_messages id foi gerada por este envio
  ayla_message_id uuid REFERENCES ayla_messages(id) ON DELETE SET NULL,

  enviado_em timestamptz DEFAULT now(),
  resposta_em timestamptz,           -- preenchido quando a mãe responde
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_ayla_proativo_familia_data
  ON ayla_proativo_log (family_account_id, enviado_em DESC);

CREATE INDEX idx_ayla_proativo_tipo
  ON ayla_proativo_log (tipo_check_in, enviado_em DESC);

ALTER TABLE ayla_proativo_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ayla_proativo_owner_read ON ayla_proativo_log
  FOR SELECT
  USING (
    family_account_id IN (
      SELECT id FROM family_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY ayla_proativo_service_write ON ayla_proativo_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
