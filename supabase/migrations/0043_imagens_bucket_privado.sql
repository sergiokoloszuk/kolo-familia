-- ============================================================
-- Kolo Família — Migração 0043
--   Bucket `imagens` PRIVADO + signed URLs.
--
--   Motivo (segurança): o bucket era público — desenhos, fotos e avatares
--   de criança eram acessíveis por qualquer um que tivesse a URL, sem login.
--   O app já passou a gerar URL ASSINADA de curta duração na leitura
--   (lib/storage/imagens.ts), então fechar o bucket não quebra nada.
--
--   De quebra: adiciona `application/pdf` aos MIME aceitos — o PDF do plano
--   da Ayla subia como application/pdf num bucket que só aceitava imagem, e
--   por isso a entrega falhava em silêncio.
--
--   PRÉ-REQUISITO: o deploy com as URLs assinadas (commit 966029b) já tem
--   que estar no ar ANTES de aplicar isto. Reversível: ver rollback no fim.
-- ============================================================

-- 1) Bucket privado + aceita PDF (plano) além das imagens.
update storage.buckets
  set public = false,
      allowed_mime_types = array[
        'image/png','image/jpeg','image/webp','image/gif','application/pdf'
      ]
  where id = 'imagens';

-- 2) Remove a leitura pública (o furo).
drop policy if exists "imagens_public_read" on storage.objects;

-- 3) Leitura só autenticada e só da PRÓPRIA família.
--    Path convention: {family_account_id}/{tipo}/{uuid.ext} →
--    foldername(name)[1] = family_account_id.
drop policy if exists "imagens_owner_read" on storage.objects;
create policy "imagens_owner_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'imagens'
    and (storage.foldername(name))[1] = (
      select id::text from public.family_accounts
      where user_id = auth.uid()
      limit 1
    )
  );

-- 4) Escrita escopada por família (endurece o insert amplo de 0005).
--    Geração via service role bypassa RLS; upload de desenho usa o cliente
--    de sessão com path {family.id}/desenho/... → satisfaz o check.
drop policy if exists "imagens_authenticated_insert" on storage.objects;
create policy "imagens_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'imagens'
    and (storage.foldername(name))[1] = (
      select id::text from public.family_accounts
      where user_id = auth.uid()
      limit 1
    )
  );

-- (delete escopado por família já existe de 0005: "imagens_owner_delete")

-- ============================================================
-- ROLLBACK (se algo de imagem quebrar e precisar reabrir rápido):
--   update storage.buckets set public = true where id = 'imagens';
--   create policy "imagens_public_read" on storage.objects
--     for select using (bucket_id = 'imagens');
-- ============================================================
