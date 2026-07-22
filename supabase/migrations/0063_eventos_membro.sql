-- ============================================================
-- Kolo Família — Migração 0063
--   Linha do tempo de EVENTOS importantes da pessoa (Livro Vivo / fase c).
--   Vale pra qualquer idade (criança, adolescente, adulto). Marcos que ajudam
--   a entender o percurso e a correlacionar mudanças SEM assumir causa: troca
--   de professora, mudança de escola/turma/trabalho, medicação, início de
--   terapia, férias, perda familiar, separação, mudança de rotina, avanço
--   (marco) ou regressão.
--   Alimenta: a "Linha do tempo" do Guia/Resumo, o "mudanças desde a última
--   consulta" (médico) e a detecção de padrões. Auto-registrado pela Ayla
--   (service-role) + editável pela família no app.
-- ============================================================

create table if not exists public.eventos_membro (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid not null references public.membros_atipicos(id) on delete cascade,
  data date not null,                         -- quando o evento aconteceu (ou foi notado)
  tipo text not null default 'outro',         -- troca_professora | mudanca_escola | mudanca_turma | medicacao | inicio_terapia | ferias | perda_familiar | separacao | mudanca_rotina | marco | regressao | outro
  descricao text not null,                    -- o que foi, em 1 frase
  fonte text not null default 'familia',      -- familia | escola | ayla
  created_at timestamptz not null default now()
);

create index if not exists idx_eventos_membro_data
  on public.eventos_membro (membro_atipico_id, data desc);

alter table public.eventos_membro enable row level security;

-- A família gerencia (lê/edita) os eventos dos SEUS membros; admin vê tudo.
-- A escrita da Ayla é via service-role, que ignora RLS.
drop policy if exists eventos_membro_familia on public.eventos_membro;
create policy eventos_membro_familia on public.eventos_membro for all
  using (family_account_id = public.current_family_account_id() or public.is_admin())
  with check (family_account_id = public.current_family_account_id() or public.is_admin());

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0063.
-- ============================================================
