-- ============================================================
-- Kolo Família — Migração 0005
-- Bucket de Storage 'imagens' para avatares e galeria.
--
-- Path convention: imagens/{family_account_id}/{tipo}/{uuid}.png
--   - family_account_id no path simplifica RLS e cleanup.
--
-- Public read (URLs permanentes pro app/galeria) — escrita só admin/service.
-- Famílias só leem URLs públicas via SELECT em galeria_imagens (que ainda
-- tem RLS por family_account_id), nunca diretamente do storage.
-- ============================================================

-- Cria o bucket. Idempotente (insert ... on conflict).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imagens',
  'imagens',
  true,                         -- leitura pública
  10 * 1024 * 1024,             -- 10MB max por arquivo
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies em storage.objects:
-- - Leitura pública pra qualquer um (URL é o controle de acesso de fato).
-- - Escrita só pelo service role (gerador chama via service role da Ayla/IA).
-- O Supabase já cria a policy default "Public Access" pra buckets públicos
-- mas garantimos explicitamente:

drop policy if exists "imagens_public_read" on storage.objects;
create policy "imagens_public_read"
  on storage.objects
  for select
  using (bucket_id = 'imagens');

drop policy if exists "imagens_authenticated_insert" on storage.objects;
create policy "imagens_authenticated_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'imagens');

drop policy if exists "imagens_owner_delete" on storage.objects;
create policy "imagens_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'imagens'
    and (storage.foldername(name))[1] = (
      select id::text from public.family_accounts
      where user_id = auth.uid()
      limit 1
    )
  );

-- ============================================================
-- FIM da migração 0005.
-- ============================================================
