-- ============================================================
-- Kolo Família — schema inicial
-- Migração 0001: extensões, helpers, tabelas, índices.
-- RLS é habilitado em 0002. Seeds em 0003.
-- ============================================================

-- ----- Extensões -----
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----- Helper: trigger updated_at -----
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Identidade e contas — PRD §4.4
-- ============================================================

-- Uma família = um WhatsApp = uma assinatura. user_id aponta para a mãe (cuidadora principal).
create table if not exists public.family_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nome_familia text,
  whatsapp_e164 text not null check (whatsapp_e164 ~ '^\+\d{8,15}$'),
  whatsapp_hash text generated always as (encode(digest(whatsapp_e164, 'sha256'), 'hex')) stored,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists family_accounts_whatsapp_hash_idx on public.family_accounts(whatsapp_hash);
create trigger family_accounts_set_updated_at before update on public.family_accounts
  for each row execute function public.set_updated_at();

-- Dados da mãe que não cabem em auth.users
create table if not exists public.family_profiles (
  family_account_id uuid primary key references public.family_accounts(id) on delete cascade,
  nome_mae text not null,
  idade_mae int check (idade_mae between 16 and 100),
  como_chamar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger family_profiles_set_updated_at before update on public.family_profiles
  for each row execute function public.set_updated_at();

-- Membro atípico — uma família tem 1 ou mais. Centro do contexto (PRD §1.5).
create table if not exists public.membros_atipicos (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  nome text not null,
  idade int not null check (idade between 0 and 120),
  perfil text not null check (perfil in ('TEA','TDAH','Dislexia','AHSD','Outro','EmInvestigacao')),
  diagnosticos_formais jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists membros_atipicos_family_idx on public.membros_atipicos(family_account_id);
create trigger membros_atipicos_set_updated_at before update on public.membros_atipicos
  for each row execute function public.set_updated_at();

-- Acesso administrativo — PRD §7.9
create table if not exists public.controle_acessos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin_geral','admin_conteudo','admin_suporte')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger controle_acessos_set_updated_at before update on public.controle_acessos
  for each row execute function public.set_updated_at();

-- ----- Helpers de RLS (precisam vir depois das tabelas que consultam) -----

create or replace function public.current_family_account_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.family_accounts where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.controle_acessos
    where user_id = auth.uid() and ativo = true
  );
$$;

-- ============================================================
-- Kolo Vivo — PRD §7.5
-- ============================================================

-- Camada 2 — contexto familiar (1 por família)
create table if not exists public.perfil_vivo_familia (
  family_account_id uuid primary key references public.family_accounts(id) on delete cascade,
  composicao jsonb not null default '{}'::jsonb,
  rotina jsonb not null default '{}'::jsonb,
  recursos jsonb not null default '{}'::jsonb,
  dinamica jsonb not null default '{}'::jsonb,
  completude_pct int not null default 0 check (completude_pct between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger perfil_vivo_familia_set_updated_at before update on public.perfil_vivo_familia
  for each row execute function public.set_updated_at();

-- Camada 1 — por membro atípico (5 seções: essencial, como_e, corpo_rotina, desafios_regulacao, sensorial)
create table if not exists public.perfil_vivo_membro (
  membro_atipico_id uuid primary key references public.membros_atipicos(id) on delete cascade,
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  essencial jsonb not null default '{}'::jsonb,
  como_e jsonb not null default '{}'::jsonb,
  corpo_rotina jsonb not null default '{}'::jsonb,
  desafios_regulacao jsonb not null default '{}'::jsonb,
  sensorial jsonb not null default '{}'::jsonb,
  completude_pct int not null default 0 check (completude_pct between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists perfil_vivo_membro_family_idx on public.perfil_vivo_membro(family_account_id);
create trigger perfil_vivo_membro_set_updated_at before update on public.perfil_vivo_membro
  for each row execute function public.set_updated_at();

-- Sugestões pendentes — toda mudança no Kolo Vivo passa por aqui
create table if not exists public.sugestao_perfil_vivos (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  camada text not null check (camada in ('camada1','camada2')),
  campo text not null,
  texto_sugerido text not null,
  origem text not null check (origem in ('ayla','skill','app','diario_parser')),
  origem_detalhe jsonb,
  status text not null default 'pendente' check (status in ('pendente','aprovada','rejeitada','expirada')),
  decidido_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sugestao_perfil_vivos_family_idx on public.sugestao_perfil_vivos(family_account_id, status);

-- ============================================================
-- Diário — Camada A + Camada B (PRD §7.16)
-- ============================================================

create table if not exists public.diarios (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid not null references public.membros_atipicos(id) on delete cascade,
  data date not null default current_date,
  -- Camada A
  conquista text,
  desafio text,
  observacao_livre text,
  possivel_gatilho text,
  -- Camada B
  quem_estava text check (quem_estava in ('mae','pai','avo_a','avo_o','irmao_a','baba','professor_a','outro')),
  quem_estava_livre text,
  estado_adulto text check (estado_adulto in ('calmo','firme','cansado','ansioso','impaciente')),
  reacao_adulto text check (reacao_adulto in ('acolhedor','esperou','interveio','impositivo','chamou_ajuda','outro')),
  -- Metadados
  origem text not null check (origem in ('app','ayla')),
  incompleto boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (conquista is not null or desafio is not null or observacao_livre is not null)
);
create index if not exists diarios_family_data_idx on public.diarios(family_account_id, data desc);
create index if not exists diarios_membro_idx on public.diarios(membro_atipico_id, data desc);
create trigger diarios_set_updated_at before update on public.diarios
  for each row execute function public.set_updated_at();

-- ============================================================
-- Check-ins (PRD §7.15)
-- ============================================================

create table if not exists public.check_ins_diarios (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  data date not null default current_date,
  escala_emocional_mae text not null check (escala_emocional_mae in ('muito_bem','bem','neutro','dificil','muito_dificil')),
  escala_emocional_membro text check (escala_emocional_membro in ('muito_bem','bem','neutro','dificil','muito_dificil')),
  origem text not null check (origem in ('app','ayla')),
  created_at timestamptz not null default now()
);
create index if not exists check_ins_diarios_family_idx on public.check_ins_diarios(family_account_id, data desc);
create unique index if not exists check_ins_diarios_unique on public.check_ins_diarios(family_account_id, coalesce(membro_atipico_id, '00000000-0000-0000-0000-000000000000'::uuid), data);

create table if not exists public.check_ins_semanais (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  semana_inicio date not null,
  emocional_mae text not null check (emocional_mae in ('muito_bem','bem','neutro','dificil','muito_dificil')),
  energia_mae text not null check (energia_mae in ('cheia','descansada','razoavel','cansada','exausta')),
  emocional_membro text check (emocional_membro in ('muito_bem','bem','neutro','dificil','muito_dificil')),
  energia_membro text check (energia_membro in ('cheia','descansada','razoavel','cansada','exausta')),
  comentario text,
  created_at timestamptz not null default now()
);
create index if not exists check_ins_semanais_family_idx on public.check_ins_semanais(family_account_id, semana_inicio desc);

create table if not exists public.reflexoes_semanais (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  check_in_semanal_id uuid references public.check_ins_semanais(id) on delete cascade,
  semana_inicio date not null,
  o_que_faria_diferente text not null,
  created_at timestamptz not null default now()
);
create index if not exists reflexoes_semanais_family_idx on public.reflexoes_semanais(family_account_id, semana_inicio desc);

-- DASS-21 (PRD §7.15.3) — RLS estrito por user_id
create table if not exists public.dass21_aplicacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  data_aplicacao date not null default current_date,
  respostas jsonb not null,
  score_depressao int not null check (score_depressao >= 0),
  score_ansiedade int not null check (score_ansiedade >= 0),
  score_estresse int not null check (score_estresse >= 0),
  faixa_depressao text not null check (faixa_depressao in ('normal','leve','moderada','severa','extremamente_severa')),
  faixa_ansiedade text not null check (faixa_ansiedade in ('normal','leve','moderada','severa','extremamente_severa')),
  faixa_estresse text not null check (faixa_estresse in ('normal','leve','moderada','severa','extremamente_severa')),
  created_at timestamptz not null default now()
);
create index if not exists dass21_aplicacoes_user_idx on public.dass21_aplicacoes(user_id, data_aplicacao desc);

-- ============================================================
-- Skills, IA, Boas Práticas, Aulas — PRD §7.4, §7.6, §7.11, §7.12
-- ============================================================

create table if not exists public.specialist_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  objective text not null,
  tone text not null,
  scope text not null,
  limits text not null,
  kolo_vivo_fields jsonb not null default '[]'::jsonb,
  knowledge_tags jsonb not null default '[]'::jsonb,
  routing_keywords jsonb not null default '[]'::jsonb,
  routing_priority int not null default 50 check (routing_priority between 0 and 100),
  fallback_questions jsonb not null default '[]'::jsonb,
  versao int not null default 1,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger specialist_prompt_templates_set_updated_at before update on public.specialist_prompt_templates
  for each row execute function public.set_updated_at();

-- 7 tipos de botão de apoio — PRD §7.12
create table if not exists public.output_types (
  key text primary key check (key in ('brincadeiras','atividades','crencas','o_que_fazer_diferente','historias_sociais','frases_prontas','rotinas')),
  label text not null,
  icone text not null,
  prompt_template text not null,
  gera_imagem_opcional boolean not null default false,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger output_types_set_updated_at before update on public.output_types
  for each row execute function public.set_updated_at();

-- Vídeos da fundadora (referenciados por Boas Práticas e Aulas)
create table if not exists public.videos_fundadora (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  url text not null,
  duracao_segundos int,
  tags jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger videos_fundadora_set_updated_at before update on public.videos_fundadora
  for each row execute function public.set_updated_at();

-- Trilhas (sequência didática de aulas)
create table if not exists public.trilhas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  tags jsonb not null default '[]'::jsonb,
  perfis_aplicaveis jsonb not null default '[]'::jsonb,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trilhas_set_updated_at before update on public.trilhas
  for each row execute function public.set_updated_at();

-- Aulas — PRD §7.11
create table if not exists public.aulas (
  id uuid primary key default gen_random_uuid(),
  trilha_id uuid references public.trilhas(id) on delete set null,
  ordem_na_trilha int,
  titulo text not null,
  descricao text,
  video_url text,
  transcricao text,
  tags jsonb not null default '[]'::jsonb,
  perfis_aplicaveis jsonb not null default '[]'::jsonb,
  faixa_etaria_min int,
  faixa_etaria_max int,
  status text not null default 'rascunho' check (status in ('rascunho','ativo','arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aulas_status_idx on public.aulas(status);
create trigger aulas_set_updated_at before update on public.aulas
  for each row execute function public.set_updated_at();

-- Boas Práticas inteligentes — PRD §7.6
create table if not exists public.boas_praticas (
  id uuid primary key default gen_random_uuid(),
  -- Input cru da fundadora
  texto_original text not null,
  -- Estruturação por IA
  titulo text,
  resumo text,
  passos_praticos jsonb,
  quando_usar text,
  erros_comuns jsonb,
  -- Versões
  versao_curta text,
  versao_conversa text,
  versao_passos jsonb,
  -- Classificação
  skills_relacionadas jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  faixa_etaria_min int,
  faixa_etaria_max int,
  perfis_aplicaveis jsonb not null default '[]'::jsonb,
  nivel text check (nivel in ('iniciante','intermediario','avancado')),
  -- Conexão e origem
  video_id uuid references public.videos_fundadora(id) on delete set null,
  aula_id uuid references public.aulas(id) on delete set null,
  origem text not null default 'admin' check (origem in ('admin','aula')),
  -- Aprendizado contínuo
  peso_relevancia numeric not null default 0.5 check (peso_relevancia between 0 and 1),
  -- Versionamento
  versao int not null default 1,
  status text not null default 'rascunho' check (status in ('rascunho','ativo','arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists boas_praticas_status_idx on public.boas_praticas(status);
create index if not exists boas_praticas_tags_idx on public.boas_praticas using gin (tags);
create trigger boas_praticas_set_updated_at before update on public.boas_praticas
  for each row execute function public.set_updated_at();

-- Conversas e mensagens (mãe ↔ skills no app)
create table if not exists public.conversas (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  titulo text,
  contexto_inicial jsonb,
  encerrada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversas_family_idx on public.conversas(family_account_id, created_at desc);
create trigger conversas_set_updated_at before update on public.conversas
  for each row execute function public.set_updated_at();

create table if not exists public.mensagens_skill (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  papel text not null check (papel in ('user','assistant','system')),
  conteudo text not null,
  skills_acionadas jsonb not null default '[]'::jsonb,
  output_type text references public.output_types(key) on delete set null,
  metadata jsonb,
  tokens_input int,
  tokens_output int,
  created_at timestamptz not null default now()
);
create index if not exists mensagens_skill_conversa_idx on public.mensagens_skill(conversa_id, created_at);

-- ============================================================
-- Ayla — PRD §12 (escopo isolado)
-- ============================================================

create table if not exists public.ayla_messages (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  direcao text not null check (direcao in ('inbound','outbound')),
  category text check (category in ('proativa','reativa')),
  tipo text,
  texto text,
  midia_url text,
  midia_tipo text,
  metadata jsonb,
  enviada_em timestamptz,
  recebida_em timestamptz,
  respondeu boolean,
  created_at timestamptz not null default now()
);
create index if not exists ayla_messages_family_idx on public.ayla_messages(family_account_id, created_at desc);

create table if not exists public.ayla_daily_checkins (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  date date not null default current_date,
  conquista_extraida text,
  desafio_extraido text,
  emocao_mae text check (emocao_mae in ('muito_bem','bem','neutro','triste','cansada','ansiosa_estressada')),
  possivel_gatilho text,
  observacao_livre text,
  enviada_em timestamptz,
  respondeu boolean not null default false,
  respondeu_em timestamptz,
  confianca_parser int,
  created_at timestamptz not null default now()
);
create index if not exists ayla_daily_checkins_family_date_idx on public.ayla_daily_checkins(family_account_id, date desc);

create table if not exists public.ayla_preferences (
  family_account_id uuid primary key references public.family_accounts(id) on delete cascade,
  consentimento_em timestamptz,
  pausada_ate date,
  horario_preferido_inicio time not null default '19:00',
  horario_preferido_fim time not null default '21:00',
  frequencia text not null default 'diaria' check (frequencia in ('diaria','3x_semana','semanal')),
  desativada boolean not null default false,
  ultima_mensagem_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ayla_preferences_set_updated_at before update on public.ayla_preferences
  for each row execute function public.set_updated_at();

create table if not exists public.ayla_insights (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  padrao text not null,
  detalhe jsonb,
  mensagem_proposta text,
  enviado boolean not null default false,
  enviado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ayla_insights_family_idx on public.ayla_insights(family_account_id, created_at desc);

-- Auditoria de envio (admin only)
create table if not exists public.ayla_send_log (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  template_key text not null,
  payload jsonb,
  resposta_provider jsonb,
  status text not null check (status in ('enfileirada','enviada','falha')),
  erro text,
  created_at timestamptz not null default now()
);
create index if not exists ayla_send_log_family_idx on public.ayla_send_log(family_account_id, created_at desc);

-- ============================================================
-- Pagamento — PRD §5
-- ============================================================

create table if not exists public.subscription_accesses (
  family_account_id uuid primary key references public.family_accounts(id) on delete cascade,
  status text not null default 'trialing' check (status in ('trialing','active','past_due','paused','canceled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscription_accesses_set_updated_at before update on public.subscription_accesses
  for each row execute function public.set_updated_at();

create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  stripe_event_id text unique not null,
  evento text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists assinaturas_family_idx on public.assinaturas(family_account_id, created_at desc);

-- ============================================================
-- Imagens — PRD §7.14
-- ============================================================

create table if not exists public.avatares_membros_atipicos (
  membro_atipico_id uuid primary key references public.membros_atipicos(id) on delete cascade,
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  estilo text not null default 'cartoon' check (estilo in ('cartoon','aquarela')),
  descricao_textual jsonb not null default '{}'::jsonb,
  imagem_url text,
  prompt_canonico text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger avatares_set_updated_at before update on public.avatares_membros_atipicos
  for each row execute function public.set_updated_at();

create table if not exists public.galeria_imagens (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  url text not null,
  tipo text check (tipo in ('brincadeira','atividade','historia_social','conquista','livre')),
  tags jsonb not null default '[]'::jsonb,
  prompt_usado text,
  favoritada boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists galeria_family_idx on public.galeria_imagens(family_account_id, created_at desc);

-- ============================================================
-- Relatórios — PRD §7.17
-- ============================================================

create table if not exists public.relatorios_gerados (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid not null references public.membros_atipicos(id) on delete cascade,
  destinatario text not null check (destinatario in ('terapeuta','escola')),
  janela_inicio date not null,
  janela_fim date not null,
  inclui_camada_b boolean not null default false,
  inclui_dass21 boolean not null default false,
  pdf_url text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists relatorios_gerados_family_idx on public.relatorios_gerados(family_account_id, created_at desc);

create table if not exists public.links_vivos (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid not null references public.membros_atipicos(id) on delete cascade,
  destinatario text not null check (destinatario in ('terapeuta','escola')),
  destinatario_nome text not null,
  token text unique not null,
  expira_em timestamptz,
  revogado boolean not null default false,
  revogado_em timestamptz,
  inclui_camada_b boolean not null default false,
  inclui_dass21 boolean not null default false,
  acessos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists links_vivos_token_idx on public.links_vivos(token) where revogado = false;
create index if not exists links_vivos_family_idx on public.links_vivos(family_account_id);

-- ============================================================
-- Campanhas administrativas — PRD §7.13
-- ============================================================

create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria text not null check (categoria in ('informacional','promocional','avaliacao','operacional')),
  canais jsonb not null default '["whatsapp"]'::jsonb,
  segmentacao jsonb not null default '{}'::jsonb,
  conteudo_whatsapp text,
  conteudo_email_assunto text,
  conteudo_email_corpo text,
  janela_inicio timestamptz,
  janela_fim timestamptz,
  status text not null default 'rascunho' check (status in ('rascunho','aguardando_aprovacao','aprovada','enviando','enviada','cancelada')),
  autor_user_id uuid references auth.users(id),
  aprovador_user_id uuid references auth.users(id),
  aprovada_em timestamptz,
  total_alcance int,
  total_bloqueados int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger campanhas_set_updated_at before update on public.campanhas
  for each row execute function public.set_updated_at();

create table if not exists public.campanhas_destinatarios (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente','enviada','entregue','lida','respondida','bloqueada','falha')),
  bloqueio_motivo text,
  enviada_em timestamptz,
  entregue_em timestamptz,
  lida_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists campanhas_destinatarios_campanha_idx on public.campanhas_destinatarios(campanha_id);
create index if not exists campanhas_destinatarios_family_idx on public.campanhas_destinatarios(family_account_id);

create table if not exists public.categorias_optout (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  categoria text not null check (categoria in ('informacional','promocional','avaliacao')),
  optou_out_em timestamptz not null default now(),
  unique(family_account_id, categoria)
);

-- ============================================================
-- Operacional (admin/público) — PRD §7.9
-- ============================================================

create table if not exists public.afiliados (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  codigo_unico text unique not null,
  comissao_pct numeric not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.parceiros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text,
  contato_email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cupons (
  codigo text primary key,
  desconto_pct int check (desconto_pct between 1 and 100),
  desconto_centavos int,
  validade timestamptz,
  usos_max int,
  usos_atuais int not null default 0,
  parceiro_id uuid references public.parceiros(id) on delete set null,
  afiliado_id uuid references public.afiliados(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.depoimentos (
  id uuid primary key default gen_random_uuid(),
  nome_publico text not null,
  texto text not null,
  perfil_resumo text,
  destaque boolean not null default false,
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.contato_inclusao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  mensagem text not null,
  status text not null default 'novo' check (status in ('novo','em_andamento','respondido','arquivado')),
  created_at timestamptz not null default now()
);

create table if not exists public.sobre_plataforma (
  chave text primary key,
  conteudo_md text not null,
  publicado boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.configuracao_precos (
  chave text primary key,
  valor_centavos int not null,
  moeda text not null default 'BRL',
  descricao text,
  updated_at timestamptz not null default now()
);

create table if not exists public.configuracao_vozes (
  chave text primary key,
  voice_id text not null,
  modelo text,
  parametros jsonb,
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Avaliações e Histórias — registros públicos da família (PRD §13.4)
-- ============================================================

create table if not exists public.avaliacao_maes (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  nps int check (nps between 0 and 10),
  comentario text,
  permite_publicar boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists avaliacao_maes_family_idx on public.avaliacao_maes(family_account_id);

create table if not exists public.historias (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  titulo text not null,
  conteudo text not null,
  imagens jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists historias_family_idx on public.historias(family_account_id, created_at desc);

-- ============================================================
-- FIM da migração 0001
-- Próxima: 0002_rls.sql habilita RLS e define políticas.
-- ============================================================
