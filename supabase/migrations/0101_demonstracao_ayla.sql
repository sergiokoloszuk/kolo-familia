-- ============================================================
-- 0101 — DEMONSTRAÇÃO DA AYLA NA LANDING (PEND-259) — 27/11/2026
--
-- A virada comercial (PEND-256) troca o teste de dias por UMA conversa guiada
-- com a Ayla, na própria landing, por até 20 minutos. A pessoa informa nome,
-- e-mail e WhatsApp, confirma o número por código e, no fim, recebe o resumo
-- da conversa nesse WhatsApp. O número confirmado não faz outra demonstração.
--
-- ⚠️ POR QUE TABELA PRÓPRIA, e não `verificacoes_whatsapp` (0080) nem
-- `testes_usados` (0065/0069):
--   · `verificacoes_whatsapp.family_account_id` é NOT NULL — visitante da
--     landing ainda não tem família;
--   · `testes_usados` tem índice único por hash e o gatilho
--     `checar_teste_pelo_whatsapp` lê qualquer hash como "teste usado" —
--     misturar demonstração com teste mudaria o que a 0069 decide.
--
-- ⚠️ "1 NÚMERO = 1 DEMONSTRAÇÃO" É DO BANCO, não do app: índice único parcial
-- sobre a chave normalizada do telefone (sem país e sem o 9º dígito, a mesma
-- de `chaveTelefoneBR`), só para demonstrações JÁ CONFIRMADAS.
-- Corrida entre duas confirmações do mesmo número: a segunda bate no índice.
-- O Admin simula à vontade sem passar por aqui: a simulação não grava linha.
--
-- ⚠️ SÓ SERVICE ROLE. RLS ligada e nenhuma política: nem anon nem
-- authenticated leem ou escrevem. Quem fala com estas tabelas são as rotas
-- `/api/demo/*`, no servidor.
--
-- ⚠️ DADO PESSOAL (nome, e-mail, telefone, conversa). Retenção e exclusão
-- ficam registradas em PEND-259 — não há cron de limpeza nesta migração.
--
-- Rollback: `drop table public.demonstracao_mensagens; drop table
-- public.demonstracoes_ayla;` — nenhuma outra tabela depende destas.
-- ============================================================

create table if not exists public.demonstracoes_ayla (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200),
  telefone_e164 text not null,
  -- `chaveTelefoneBR`: sem país e sem o 9º dígito. É a chave do "1 por número".
  telefone_chave text not null,
  -- sha256 do código de 6 dígitos. O código em texto puro não é guardado.
  codigo_hash text,
  codigo_expira_em timestamptz,
  tentativas int not null default 0,
  reenvios int not null default 0,
  ultimo_envio_em timestamptz,
  verificado_em timestamptz,
  -- sha256 do token da sessão de conversa (o token só vai ao navegador).
  token_hash text unique,
  iniciada_em timestamptz,
  expira_em timestamptz,
  turnos int not null default 0,
  encerrada_em timestamptz,
  -- Reserva-antes-de-enviar: só quem grava este carimbo manda o resumo.
  resumo_reservado_em timestamptz,
  resumo_enviado_em timestamptz,
  -- Versão do documento `demonstracao` (ayla_documentos) usada na conversa.
  documento_versao int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists demonstracoes_ayla_um_por_numero
  on public.demonstracoes_ayla (telefone_chave)
  where verificado_em is not null;

-- Um pedido de código pendente por número: reenviar atualiza a mesma linha.
create unique index if not exists demonstracoes_ayla_pendente_por_numero
  on public.demonstracoes_ayla (telefone_chave)
  where verificado_em is null;

create index if not exists demonstracoes_ayla_criadas
  on public.demonstracoes_ayla (created_at desc);

create table if not exists public.demonstracao_mensagens (
  id bigserial primary key,
  demonstracao_id uuid not null references public.demonstracoes_ayla(id) on delete cascade,
  papel text not null check (papel in ('pessoa', 'ayla')),
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists demonstracao_mensagens_por_demo
  on public.demonstracao_mensagens (demonstracao_id, created_at);

alter table public.demonstracoes_ayla enable row level security;
alter table public.demonstracao_mensagens enable row level security;

drop trigger if exists demonstracoes_ayla_set_updated_at on public.demonstracoes_ayla;
create trigger demonstracoes_ayla_set_updated_at
  before update on public.demonstracoes_ayla
  for each row execute function public.set_updated_at();
