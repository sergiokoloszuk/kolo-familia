-- REVERSÃO da 0073 (`perfil_fatos`, o fact store do Perfil Vivo).
--
-- A 0073 só acrescenta: uma tabela, dez índices, três policies e um comentário.
-- Nenhuma tabela preexistente é tocada.
--
-- DEPENDÊNCIAS VERIFICADAS, não presumidas:
--
--   - `perfil_fatos` referencia `family_accounts` e `membros_atipicos`. A seta
--     aponta DAQUI para lá; derrubar esta tabela não deixa órfão naquelas.
--   - `perfil_fatos` referencia a SI MESMA (superseded_by_id, supersedes_fact_id,
--     correction_of_fact_id, invalidates_fact_id). São auto-referências, e
--     somem com a própria tabela — é por isso que não é preciso quebrar ciclo
--     antes do drop.
--   - `extracao_lotes` (0074) NÃO tem foreign key para cá: o vínculo é o texto
--     `source_content_id = 'extracao_lote:<uuid>'`, de propósito, para que a
--     evidência sobreviva à ausência da origem. Logo a 0073 é revertível sem a
--     0074 estar fora — embora a ordem inversa continue sendo a recomendada.
--
-- ⚠️ O QUE SE PERDE: TODOS OS FATOS COLETADOS. Não há como recriá-los — o
-- Kolo Vivo guarda o texto colado, não a unidade com data, proveniência e
-- contexto. Antes de rodar isto em ambiente com coleta real, exportar:
--
--   \copy (select * from public.perfil_fatos) to 'perfil_fatos.csv' csv header
--
-- Enquanto a escrita sombra estiver desligada (ou a família fora da lista de
-- `PERFIL_FATOS_FAMILIAS`), a tabela está vazia e a reversão não perde nada.
--
-- Idempotente: roda em banco que nunca teve a tabela sem reclamar.

drop policy if exists perfil_fatos_admin on public.perfil_fatos;
drop policy if exists perfil_fatos_insert_familia on public.perfil_fatos;
drop policy if exists perfil_fatos_familia on public.perfil_fatos;

drop index if exists public.perfil_fatos_familia_idx;
drop index if exists public.perfil_fatos_origem_idx;
drop index if exists public.perfil_fatos_escopo_idx;
drop index if exists public.perfil_fatos_conceito_idx;
drop index if exists public.perfil_fatos_conteudo_idx;
drop index if exists public.perfil_fatos_run_idx;
drop index if exists public.perfil_fatos_sensivel_idx;
drop index if exists public.perfil_fatos_quarentena_idx;
drop index if exists public.perfil_fatos_membro_idx;
drop index if exists public.perfil_fatos_idempotency_uk;

drop table if exists public.perfil_fatos;
