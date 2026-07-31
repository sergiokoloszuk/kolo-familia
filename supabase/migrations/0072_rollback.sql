-- REVERSÃO da 0072 (`ayla_publicacoes`).
--
-- A 0072 só acrescenta: uma tabela, dois índices, uma policy e um comentário.
-- Nenhuma tabela preexistente é tocada, e nada fora dela depende dela — a
-- referência é `family_accounts`, e a dependência aponta desta tabela PARA lá,
-- nunca ao contrário. Derrubá-la não deixa órfão em lugar nenhum.
--
-- O QUE SE PERDE: o registro de publicações da Ayla, que é a trava de entrega
-- única do ADR 0001. Sem a tabela, o caminho de publicação volta ao
-- comportamento anterior — pode reenviar em corrida. Reverter a 0072 sem
-- reverter o código que a usa é o risco real desta reversão, e por isso ela
-- só faz sentido junto do rollback do deploy.
--
-- Idempotente: roda em banco que nunca teve a tabela sem reclamar.
-- Os índices e a policy caem junto com a tabela; ficam explícitos aqui para
-- que a reversão seja legível sem abrir a migração original.

drop policy if exists ayla_publicacoes_admin on public.ayla_publicacoes;

drop index if exists public.ayla_publicacoes_familia_idx;
drop index if exists public.ayla_publicacoes_source_uk;

drop table if exists public.ayla_publicacoes;
