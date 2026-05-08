# Prompt para extensão Claude no Chrome — aplicar migrações Supabase

> **Status local em 2026-05-08:** Fase 11 (final, com Rules Engine) e
> Fase 12 (PWA + observabilidade) fechadas.
>
> **Migrações a aplicar:** `0001` → `0007`. Todas idempotentes
> (`IF NOT EXISTS`, `ON CONFLICT`, `do $$ if not exists ... create policy`),
> então rodar de novo em cima de uma stack já aplicada não quebra.
>
> **Stack está caída agora** (HTTP 500 em `/auth/v1/health`,
> `/rest/v1/`, e raiz do host). Antes de rodar este prompt, o Easypanel
> precisa estar saudável — entre no Easypanel e:
>
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
   (0001-0007, todas usam IF NOT EXISTS / ON CONFLICT / do$$..if not
   exists..create policy), trate como OK e prossiga.
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
todas estas 50 tabelas, todas as migrações já estão aplicadas e você
pode pular pra etapa de verificação final:

  adaptacoes_sugeridas, afiliados, alertas, assinaturas, aulas,
  avaliacao_maes, avatares_membros_atipicos, ayla_daily_checkins,
  ayla_insights, ayla_messages, ayla_preferences, ayla_send_log,
  boas_praticas, campanhas, campanhas_destinatarios,
  categorias_optout, check_ins_diarios, check_ins_semanais,
  configuracao_precos, configuracao_vozes, contato_inclusao,
  controle_acessos, conversas, cupons, dass21_aplicacoes, depoimentos,
  diarios, eventos_app, family_accounts, family_profiles,
  galeria_imagens, historias, links_vivos, membros_atipicos,
  mensagens_skill, output_types, parceiros, perfil_vivo_familia,
  perfil_vivo_membro, reflexoes_semanais, regras_definicoes,
  regras_eventos_log, regras_overrides, relatorios_gerados,
  sobre_plataforma, specialist_prompt_templates, subscription_accesses,
  sugestao_perfil_vivos, trilhas, videos_fundadora.

(Total: 50 tabelas. Se na sua contagem der diferente, me diga quais
faltam.)

Caso falte alguma, eu vou colar as migrações 0001 a 0007 em ordem.
Para cada uma, siga o procedimento acima. Importante: rode-as em
ORDEM porque 0002 depende de tabelas de 0001, 0006/0007 dependem de
funções e tabelas criadas em 0001-0002.

Após aplicar todas, rode estas queries de verificação:

  -- Tabelas
  select count(*) as total_tabelas
  from information_schema.tables
  where table_schema = 'public';
  -- Esperado: 41

  -- Seeds básicos (0003)
  select count(*) as output_types from public.output_types;
  -- Esperado: 7

  select count(*) as skills_seed from public.specialist_prompt_templates;
  -- Esperado: pelo menos 7

  select count(*) as boas_praticas from public.boas_praticas;
  -- Esperado: pelo menos 3

  -- Trigger auth (0004)
  select tgname from pg_trigger where tgname = 'on_auth_user_created';
  -- Esperado: 1 linha

  -- Bucket storage (0005)
  select id from storage.buckets where id = 'imagens';
  -- Esperado: 1 linha

  -- Eventos app + RLS (0006)
  select count(*) as politicas_eventos
  from pg_policies
  where schemaname='public' and tablename='eventos_app';
  -- Esperado: ≥ 2 (eventos_app_admin + eventos_app_self_insert)

  -- Catálogo de regras (0007 — seedado)
  select key from public.regras_definicoes order by key;
  -- Esperado 4 linhas:
  --   dass21_moderado_ou_severo
  --   gatilho_recorrente
  --   inatividade_diarios_5d
  --   mae_emocional_baixa_3em7

  -- Índice único de alerta open por (família, regra, membro)
  select indexname
  from pg_indexes
  where schemaname='public' and tablename='alertas'
    and indexname = 'alertas_open_unique';
  -- Esperado: 1 linha

Reporte o resultado de cada uma. Se algo estiver vazio ou divergir do
esperado, me avise indicando o número da migração e eu reaplico.

Quando terminar, me dê um sumário em 4 linhas:
  - tabelas: X / 41
  - seeds: output_types=N, skills=N, boas_praticas=N
  - trigger + bucket + RLS eventos_app: OK / FALTANDO (lista o que faltar)
  - catálogo regras: 4 / outro número
===
```

---

## Conteúdo das migrações (cole uma por vez quando o agente pedir)

Os arquivos estão em `supabase/migrations/`. Resumo:

- `0001_init.sql` — schema completo do MVP (≈ 30 tabelas + indexes + triggers)
- `0002_rls.sql` — Row-Level Security e funções `is_admin()` /
  `current_family_account_id()`
- `0003_seed.sql` — 7 output_types + 7 skills iniciais + 3 boas
  práticas + configs
- `0004_auth_trigger_and_onboarding.sql` — trigger `on_auth_user_created`
  que cria `family_accounts` + `subscription_accesses` +
  `ayla_preferences` no signup
- `0005_storage_imagens.sql` — bucket público `imagens` para galeria
- `0006_eventos_app.sql` — tabela `eventos_app` (PWA/observabilidade)
  com RLS dupla (admin tudo, família só insere `client_error` próprio)
- `0007_rules_engine.sql` — Rules Engine: `regras_definicoes` (catálogo
  com 4 regras seedadas), `alertas` com índice único do estado open,
  `adaptacoes_sugeridas` com `payload_pre/pos` para rollback,
  `regras_overrides`, `regras_eventos_log`

Cole o conteúdo de cada arquivo quando o agente disser "estou pronto
pra próxima migração". Ordem importa: **0001 → 0002 → 0003 → 0004 →
0005 → 0006 → 0007**.

---

## Após terminar

1. No `apps/web/.env.local`, conferir que estas chaves continuam batendo
   com o que aparece em **Supabase Studio → Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Rodar `npm run dev` no `apps/web` e abrir `/login` pra confirmar que
   o auth responde.
3. Bater em `/api/health` (rota nova da Fase 12) — deve retornar
   `{ ok: true, db: { ok: true, latency_ms: ... }, env: {...} }`.
4. Criar o primeiro usuário admin via `/signup` e depois acessar
   `/admin/setup` (cria registro em `controle_acessos` com
   `role='superadmin'`).
5. Configurar o cron externo (n8n / Vercel Cron / GitHub Actions) pra
   bater em `/api/ayla/cron?tipo=X` com `Authorization: Bearer
   $CRON_SECRET`. Tipos suportados:
   - `rotina` — pergunta diária da Ayla (ideal: 30min)
   - `inatividade` — engajamento 2/5 dias (ideal: 1×/dia)
   - `comercial` — trial D-3 e D-0 (ideal: 1×/dia)
   - `emocional` — streak 7 dias (ideal: 1×/dia)
   - `insights` — detecção de padrões (ideal: 1×/semana)
   - `campanhas` — drena destinatários pendentes (ideal: 1×/hora)
   - `regras` — Rules Engine para todas as famílias ativas (ideal: 1×/dia)
