-- Complemento da 0090 para ambientes onde ela já foi aplicada antes do grant.
-- Sem privilégio de tabela, o JWT service_role atravessa a RLS mas o PostgREST
-- ainda recusa INSERT/UPDATE antes de a política ser avaliada.

grant select, insert, update, delete
  on table public.ayla_aprofundamento_ofertas
  to service_role;

notify pgrst, 'reload schema';
