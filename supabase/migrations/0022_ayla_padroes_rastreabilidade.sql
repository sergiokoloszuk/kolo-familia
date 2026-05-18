-- ============================================================
-- 0022 — Ayla v2: rastreabilidade + revisão de padrões
--
-- Amplia `ayla_padroes` (criada em 0019) com:
--   - motivo_hipotese: qual heurística determinística disparou
--   - sinais_correlacionados: lista descritiva de sinais que pesaram
--   - janela_analisada: janela temporal usada na detecção
--   - relevancia_karina: ajuste manual (-1 = irrelevante, 0..5 escala)
--   - revisado_em / revisado_por: trilha de revisão humana
--
-- Princípio: "não quero caixa preta" — toda hipótese deve poder ser
-- auditada (de onde veio, com que evidências, em que janela).
--
-- Sem isso, padrões viram afirmações opacas. Com isso, viram observações
-- rastreáveis que a Karina aprova/rejeita com contexto.
-- ============================================================

ALTER TABLE ayla_padroes
  ADD COLUMN IF NOT EXISTS motivo_hipotese text,
  ADD COLUMN IF NOT EXISTS sinais_correlacionados text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS janela_analisada text,
  ADD COLUMN IF NOT EXISTS relevancia_karina smallint
    CHECK (relevancia_karina IS NULL OR (relevancia_karina BETWEEN -1 AND 5)),
  ADD COLUMN IF NOT EXISTS revisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revisado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index pra busca rápida do painel admin (hipóteses pendentes de revisão)
CREATE INDEX IF NOT EXISTS idx_ayla_padroes_pendentes_revisao
  ON ayla_padroes (estado, ultima_evidencia DESC)
  WHERE estado IN ('hipotese', 'observado') AND revisado_em IS NULL;

-- Index pra dashboards (top relevância)
CREATE INDEX IF NOT EXISTS idx_ayla_padroes_relevancia
  ON ayla_padroes (relevancia_karina DESC NULLS LAST, ultima_evidencia DESC)
  WHERE relevancia_karina IS NOT NULL;

-- ============================================================
-- Política RLS: admins (controle_acessos.ativo = true) podem revisar
-- padrões cross-família. Membros donos veem apenas os seus.
-- ============================================================
DROP POLICY IF EXISTS ayla_padroes_admin_read ON ayla_padroes;
CREATE POLICY ayla_padroes_admin_read ON ayla_padroes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controle_acessos
      WHERE user_id = auth.uid() AND ativo = true
    )
  );

DROP POLICY IF EXISTS ayla_padroes_admin_update ON ayla_padroes;
CREATE POLICY ayla_padroes_admin_update ON ayla_padroes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM controle_acessos
      WHERE user_id = auth.uid() AND ativo = true
    )
  );
