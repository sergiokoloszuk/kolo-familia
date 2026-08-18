-- Reversão da 0071 (BIA).
--
-- ⚠️ NÃO é uma migração da sequência. Não rode isto em ordem; é o botão de
-- desfazer da 0071, para ser colado à mão se a aplicação der errado.
--
-- É seguro porque a 0071 só ACRESCENTA: uma tabela nova (`bia_chunks`), seus
-- índices, seu trigger e suas policies. Ela não altera nenhuma tabela existente,
-- não cria extensão, não mexe em `handle_new_user` e não toca em dado de
-- família. Portanto derrubar a tabela devolve o banco exatamente ao estado
-- anterior — o único dado perdido são os próprios chunks da BIA, que são
-- conteúdo curado reimportável a partir de `scripts/bia/importar-bia.mjs`.
--
-- Antes de rodar, EXPORTE os chunks se já houver importação que você não queira
-- refazer:
--   copy (select * from public.bia_chunks) to stdout with (format csv, header);
--
-- Índices, trigger e policies caem junto com a tabela (dependência); ficam
-- listados abaixo apenas como registro do que a 0071 criou.
--
--   índices : bia_chunks_busca_idx, bia_chunks_situacoes_idx,
--             bia_chunks_habilidades_idx, bia_chunks_nucleo_tipo_idx,
--             bia_chunks_ordem_idx
--   trigger : bia_chunks_set_updated_at
--   policies: bia_chunks_read, bia_chunks_admin
--
-- `public.set_updated_at()` e `public.is_admin()` são da 0001 e continuam de pé:
-- outras tabelas dependem delas. NÃO derrube.

begin;

drop table if exists public.bia_chunks cascade;

commit;

-- Verificação (deve devolver 0):
--   select count(*) from information_schema.tables
--    where table_schema = 'public' and table_name = 'bia_chunks';
