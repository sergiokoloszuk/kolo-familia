# Prompt para extensão Claude no Chrome — aplicar migrações Supabase

> **Status local em 2026-05-08:** Fase 11 fechada. Nenhuma migração nova
> foi adicionada — Fase 11 só usa tabelas que já estão em
> `0001_init.sql` (`campanhas`, `campanhas_destinatarios`,
> `categorias_optout`, `specialist_prompt_templates`).
>
> **Migrações a aplicar:** `0001` → `0005` (mesmas de antes).
>
> **Stack está caída agora** (HTTP 500 em `/auth/v1/health`,
> `/rest/v1/`, e raiz do host). Antes de rodar este prompt, o Easypanel
> precisa estar saudável — entre no Easypanel e:
> 1. Reinicie os serviços `supabase-db`, `supabase-rest`, `supabase-auth`,
>    `supabase-storage` e `supabase-studio`.
> 2. Confirme que `https://api-supabase.4oydba.easypanel.host/auth/v1/health`
>    retorna 200.
>
> Só depois rode o prompt abaixo.

---

## Como usar

1. Abra o **Supabase Studio** em
   `https://studio-supabase.4oydba.easypanel.host` (ou qualquer URL que
   você tenha pra esse Studio no Easypanel) e faça login com a conta
   admin.
2. Vá em **SQL Editor → New query**.
3. Abra a extensão do Claude no Chrome com o Studio na aba ativa e cole
   o prompt **completo** abaixo (copie do bloco delimitador `===` até o
   próximo).
4. Deixe rodar autonomamente. Cada passo é idempotente — pode rodar
   quantas vezes quiser sem quebrar.

---

## Prompt (copie tudo entre os delimitadores `===`)

```text
===
Você é um agente autônomo aplicando migrações SQL no Supabase Studio
desta aba. As migrações estão no repo local
`d:\Projetos\Kolo Família\supabase\migrations\` mas você NÃO tem acesso
ao filesystem — eu vou colar cada uma como bloco no chat. Para cada
bloco que eu colar:

1. Limpe o SQL Editor da aba ativa (Ctrl+A, Delete).
2. Cole o bloco SQL no editor.
3. Clique em "Run" (ou pressione Ctrl+Enter).
4. Aguarde até a execução terminar. Reporte o resultado: "OK" se não
   houve erros, ou copie a mensagem de erro completa se falhou.
5. Se houver erro contendo "already exists" ou "duplicate key" e a
   migração que estou rodando é uma das declaradas idempotentes
   (0001-0005, todas usam IF NOT EXISTS / ON CONFLICT), trate como OK e
   prossiga.
6. Se houver outro tipo de erro (sintaxe, coluna inexistente,
   dependência circular), pare imediatamente e me devolva a mensagem
   exata sem tentar corrigir.

Antes de aplicar qualquer migração, rode esta verificação no SQL
Editor:

  select table_name
  from information_schema.tables
  where table_schema = 'public'
  order by table_name;

Reporte a lista completa de tabelas que retornar. Se a lista contiver
todas estas 35 tabelas, todas as migrações já estão aplicadas e você
pode parar:

  afiliados, assinaturas, aulas, avaliacao_maes,
  avatares_membros_atipicos, ayla_daily_checkins, ayla_insights,
  ayla_messages, ayla_preferences, ayla_send_log, boas_praticas,
  campanhas, campanhas_destinatarios, categorias_optout,
  check_ins_diarios, check_ins_semanais, configuracao_precos,
  configuracao_vozes, contato_inclusao, controle_acessos, conversas,
  cupons, dass21_aplicacoes, depoimentos, diarios, family_accounts,
  family_profiles, galeria_imagens, historias, links_vivos,
  membros_atipicos, mensagens_skill, output_types, parceiros,
  perfil_vivo_familia, perfil_vivo_membro, reflexoes_semanais,
  relatorios_gerados, sobre_plataforma, specialist_prompt_templates,
  subscription_accesses, sugestao_perfil_vivos, trilhas,
  videos_fundadora.

Caso falte alguma, eu vou colar as migrações 0001 a 0005 em ordem.
Para cada uma, siga o procedimento acima.

Após aplicar todas, rode novamente a query de verificação acima e
também estas duas:

  -- Verifica seeds aplicados
  select count(*) as output_types from public.output_types;
  -- Esperado: 7

  select count(*) as skills from public.specialist_prompt_templates;
  -- Esperado: pelo menos 7 (do seed; pode ter mais se eu criei skills
  -- via /admin/skills depois)

  select count(*) as boas_praticas from public.boas_praticas;
  -- Esperado: pelo menos 3

  -- Verifica trigger de auth → family_account
  select tgname from pg_trigger where tgname = 'on_auth_user_created';
  -- Esperado: 1 linha com 'on_auth_user_created'

  -- Verifica bucket de storage
  select id from storage.buckets where id = 'imagens';
  -- Esperado: 1 linha com 'imagens'

Reporte o resultado de cada uma. Se algo estiver vazio ou faltando,
me avise pra eu colar a migração específica de novo.

Quando terminar, me dê um sumário em 3 linhas:
  - tabelas: X / 35
  - seeds: output_types=N, skills=N, boas_praticas=N
  - trigger e bucket: OK / FALTANDO
===
```

---

## Conteúdo das migrações (cole uma por vez quando o agente pedir)

Os arquivos estão em `supabase/migrations/`. Tamanhos atuais:

- `0001_init.sql` — schema completo (~30 tabelas + indexes + triggers)
- `0002_rls.sql` — Row-Level Security policies + função `auth.uid_family()`
- `0003_seed.sql` — 7 output_types + 7 skills iniciais + 3 boas práticas + configs
- `0004_auth_trigger_and_onboarding.sql` — `handle_new_user` trigger
- `0005_storage_imagens.sql` — bucket público `imagens`

Cole o conteúdo de cada arquivo quando o agente disser "estou pronto
pra próxima migração".

---

## Após terminar

1. No `.env.local` do projeto local, conferir que estas chaves
   continuam batendo com o que aparece em **Supabase Studio → Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Rodar `npm run dev` no `apps/web` e abrir `/login` pra confirmar que
   o auth responde.
3. Criar o primeiro usuário admin via `/signup` e depois acessar
   `/admin/setup` (que cria o registro em `controle_acessos` com
   `role='superadmin'`).
