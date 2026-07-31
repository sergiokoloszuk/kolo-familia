-- REVERSÃO da 0074.
--
-- Seguro porque a 0074 só acrescenta: nada fora desta tabela é tocado, e
-- nenhuma tabela existente depende dela. `perfil_fatos.source_content_id` é
-- texto livre com prefixo (`extracao_lote:<uuid>`), NÃO uma foreign key — de
-- propósito, para que a evidência sobreviva à ausência da origem e a reversão
-- não precise reescrever fato nenhum.
--
-- O que se perde: a proveniência da rajada. Os fatos gravados enquanto a 0074
-- esteve no ar continuam válidos e legíveis; o que deixa de resolver é o
-- caminho de volta ao insumo — `resolverEvidenciaOriginal` passa a devolver
-- `apagada` para eles, que é exatamente o sinal correto, e não um erro.

drop policy if exists extracao_lotes_admin on public.extracao_lotes;
drop policy if exists extracao_lotes_insert_familia on public.extracao_lotes;
drop policy if exists extracao_lotes_familia on public.extracao_lotes;

drop index if exists public.extracao_lotes_familia_data;
drop index if exists public.extracao_lotes_chave;

drop table if exists public.extracao_lotes;
