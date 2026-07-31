-- FACT STORE do Perfil Vivo (v2, primeiro corte) — ADR/desenho em
-- docs/perfil-vivo-fatos-versionados.md.
--
-- ⚠️ NÃO APLICADA. Ver docs/bia-aplicacao-0071.md para o procedimento; esta
-- entra depois da 0071 e da 0072 na mesma janela.
--
-- POR QUE ESTA TABELA EXISTE
--
-- Hoje a memória é destrutiva: `aplicarPropostaNoPerfil` cola texto num blob
-- jsonb (`perfil_vivo_membro`). Some a data, some quem disse, some o contexto,
-- e some a diferença entre o que a família relatou e o que a IA inferiu. Um
-- fato errado incorporado hoje fica indistinguível de um certo, para sempre.
--
-- Esta tabela é ESCRITA EM PARALELO, em modo sombra: ninguém a lê ainda. O
-- objetivo do primeiro corte é um só — parar de perder origem, tempo, contexto
-- e natureza a partir de agora. Cada dia sem ela é conhecimento que não volta,
-- porque o blob não guarda o necessário para reconstruir os fatos depois.
--
-- Só ACRESCENTA: nenhuma tabela existente é tocada, nenhuma extensão nova.

create table if not exists public.perfil_fatos (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,

  -- ---------- IMUTÁVEIS (nunca sobrescrever depois de criados) ----------

  -- Chave canônica, derivada do domínio + campo do extrator atual. Texto e não
  -- enum de propósito: a taxonomia vai crescer, e um check aqui viraria uma
  -- migração a cada conceito novo.
  conceito text not null,
  -- Domínio de exibição/agrupamento. Espelha os domínios do Kolo Vivo.
  dominio text not null,
  -- O fato em uma frase, como foi capturado.
  afirmacao text not null,
  -- "em casa", "na escola", "quando ansiosa". A MESMA habilidade varia por
  -- contexto sem que exista contradição — é o princípio-síntese do v2.
  contexto text,

  -- `statement` é o padrão conservador e NÃO estava na lista original: sem um
  -- tipo neutro, todo relato extraído viraria `event`, afirmando uma
  -- temporalidade que o texto não tem ("ele gosta de música" não é evento).
  --
  -- O nome é `statement` e não `observation` de propósito: `observed` já é um
  -- VERIFICATION_STATUS (o sistema observou diretamente), e dois nomes quase
  -- iguais em dimensões diferentes se confundem. `statement` significa só "algo
  -- foi afirmado" — não implica confirmação, observação clínica, evento
  -- temporal nem verdade consolidada.
  fact_kind text not null default 'statement' check (fact_kind in (
    'statement','event','pattern','trait','preference','ability',
    'trigger','support','goal','tested_strategy','milestone'
  )),

  -- ---------- TEMPO ----------
  -- Quando a informação foi observada/relatada. NÃO é o mesmo que created_at:
  -- created_at é quando o sistema gravou.
  observado_em date not null,
  -- A mãe raramente sabe a data exata. Não forçar precisão que não existe.
  observado_em_preciso boolean not null default false,

  -- ---------- ESCOPO ----------
  -- Onde o fato vale. `campaign` é o que impede a Neuro Copa de virar traço
  -- permanente: o fato nasce preso à campanha e só ganha permanência se
  -- reaparecer FORA dela.
  escopo_tipo text not null default 'sempre' check (escopo_tipo in (
    'sempre','context','campaign','school','professional','life_phase','conversation'
  )),
  escopo_id text,

  -- ---------- PROVENIÊNCIA ----------
  -- Três coisas diferentes, deliberadamente separadas: o TIPO da fonte, a
  -- IDENTIDADE de quem originou, e o CANAL de entrada.
  source_type text not null check (source_type in (
    'caregiver_report','accompanied_person_report','professional_report',
    'teacher_report','manual_entry','ai_inference','system_migration'
  )),
  source_actor_label text,
  source_actor_id uuid,
  source_channel text check (source_channel in ('whatsapp','web','diario','tela','sistema')),
  -- Referência, NÃO cópia: o texto original já vive em ayla_messages. Duplicar
  -- aumentaria a superfície de exposição sem ganho.
  source_message_id text,
  source_conversation_id uuid,

  -- ---------- LINHAGEM ----------
  -- Identidade do CONTEÚDO de origem, estável entre reprocessamentos. É o que
  -- responde "de qual conteúdo este fato veio?" quando a mesma mensagem é
  -- processada por versões diferentes do extrator. Precisa existir ANTES da
  -- primeira coleta: não há como retrofitar depois.
  source_content_id text,

  -- Qual EXECUÇÃO de extração produziu este fato. Agrupa tudo que saiu de uma
  -- mesma passada, e é o que torna um reprocessamento auditável e reversível
  -- em bloco.
  extraction_run_id uuid,

  -- Qual versão do processo produziu esta estrutura.
  extractor_version text not null,
  extraction_confidence numeric check (extraction_confidence between 0 and 1),

  -- ---------- CONTROLE (podem mudar; registram estado, não reescrevem) ----------
  -- Epistemologia SEPARADA de temporalidade: um fato pode ser histórico e
  -- confirmado, ou atual e incerto. Colapsar os dois faz "não verbalizava em
  -- maio" virar falso quando ela passa a verbalizar.
  verification_status text not null default 'reported' check (verification_status in (
    'reported','observed','inferred','confirmed','uncertain','contested'
  )),
  temporal_status text not null default 'current' check (temporal_status in (
    'current','historical','unknown'
  )),
  superseded_by_id uuid references public.perfil_fatos(id) on delete set null,
  superseded_at timestamptz,

  -- ---------- RELAÇÕES ENTRE FATOS ----------
  -- Três coisas DIFERENTES, e tratá-las como iguais é o erro que apaga
  -- história:
  --   supersede  — a situação MUDOU. "Não fala" continua verdadeiro em maio.
  --   correção   — o relato anterior estava ERRADO. "Tem 6" virou "tem 7".
  --   invalidação— o fato não deve mais ser usado (pessoa errada, origem ruim).
  -- Só a invalidação diz que o fato nunca deveria ter existido.
  supersedes_fact_id  uuid references public.perfil_fatos(id) on delete set null,
  correction_of_fact_id uuid references public.perfil_fatos(id) on delete set null,
  invalidates_fact_id uuid references public.perfil_fatos(id) on delete set null,
  relacao_motivo text,
  relacao_em timestamptz,
  relacao_origem text check (relacao_origem in ('sistema','revisao_humana','reprocessamento')),

  -- ---------- IDEMPOTÊNCIA ----------
  -- Distingue REPROCESSAMENTO TÉCNICO (mesma mensagem, mesmo conceito, mesma
  -- afirmação, mesma versão de extrator) de REPETIÇÃO LEGÍTIMA (a família
  -- contou de novo, noutro dia). A segunda é evidência nova e TEM de entrar —
  -- é dela que sai a recorrência que um dia promove um padrão a traço.
  idempotency_key text not null,

  -- ---------- QUARENTENA ----------
  -- A terceira saída, entre persistir e descartar. Um candidato pode ser
  -- valioso E ter sujeito incerto; rejeitar perde a informação, persistir
  -- arrisca o perfil errado. Em quarentena ele fica auditável, vinculado à
  -- origem, e FORA de qualquer leitura — os índices de projeção o excluem.
  status text not null default 'ativo' check (status in ('ativo','quarentena','invalidado')),
  quarentena_motivo text,
  -- Como o sujeito foi classificado na escrita. Guardado para reclassificar
  -- depois sem reprocessar a mensagem inteira.
  sujeito_classificado text check (sujeito_classificado in (
    'accompanied_member','caregiver','another_person','multiple_or_ambiguous','unknown'
  )),

  created_at timestamptz not null default now()
);

-- A trava. Reprocessar a mesma mensagem não duplica; contar de novo, sim.
create unique index if not exists perfil_fatos_idempotency_uk
  on public.perfil_fatos (idempotency_key);

-- Leitura principal da projeção futura: os fatos atuais de uma pessoa, do mais
-- recente para o mais antigo.
-- Leitura da projeção futura: só fato ATIVO e atual. Quarentena e invalidado
-- ficam fora por construção, não por disciplina de quem consulta.
create index if not exists perfil_fatos_membro_idx
  on public.perfil_fatos (membro_atipico_id, observado_em desc)
  where temporal_status = 'current' and status = 'ativo';

-- Fila de quarentena, para auditoria e reclassificação.
create index if not exists perfil_fatos_quarentena_idx
  on public.perfil_fatos (family_account_id, created_at desc)
  where status = 'quarentena';

-- Linhagem: "o que saiu desta execução?" e "o que veio deste conteúdo?"
create index if not exists perfil_fatos_run_idx
  on public.perfil_fatos (extraction_run_id) where extraction_run_id is not null;
create index if not exists perfil_fatos_conteudo_idx
  on public.perfil_fatos (source_content_id, extractor_version)
  where source_content_id is not null;

-- Recorrência por conceito — é a consulta da maturação (promoção por
-- repetição). Sem este índice ela varre a pessoa inteira.
create index if not exists perfil_fatos_conceito_idx
  on public.perfil_fatos (membro_atipico_id, conceito, observado_em desc);

-- Encerramento de campanha: "tudo que nasceu na Neuro Copa".
create index if not exists perfil_fatos_escopo_idx
  on public.perfil_fatos (escopo_tipo, escopo_id)
  where escopo_tipo <> 'sempre';

-- Auditoria: "de onde veio este fato?" e reprocessamento por mensagem.
create index if not exists perfil_fatos_origem_idx
  on public.perfil_fatos (source_message_id)
  where source_message_id is not null;

create index if not exists perfil_fatos_familia_idx
  on public.perfil_fatos (family_account_id, created_at desc);

-- Sem trigger de updated_at: o fato ORIGINAL e imutavel. Os campos de
-- controle (temporal_status, superseded_by_id) registram estado com o proprio
-- superseded_at; um updated_at generico so mascararia quem mudou o que.

alter table public.perfil_fatos enable row level security;

-- Mesmo padrão do resto do perfil: a família lê/gerencia os fatos dos SEUS
-- membros; admin vê tudo. A escrita em produção é por service role (a Ayla).
create policy perfil_fatos_familia on public.perfil_fatos
  for select to authenticated
  using (family_account_id = public.current_family_account_id());

-- INSERT para autenticado. Sem esta policy, DOIS dos quatro caminhos de escrita
-- falham: o diario e o "Guardar no Perfil" da web usam o cliente do USUARIO
-- (`createClient()`), nao service role - so o WhatsApp e o aprendizado
-- automatico usam service role e passam por cima do RLS.
--
-- E falharia em SILENCIO: o servico captura o erro, registra
-- `perfil_fato_falhou` e o turno segue. As metricas mostrariam fatos chegando
-- pelo WhatsApp e ninguem notaria que metade do acervo nunca entrou.
--
-- O `with check` restringe a familia da propria pessoa: o pior caso e alguem
-- forjar fato sobre o proprio filho, o que corrompe so a memoria dela.
--
-- FORMA MELHOR, para quando o fact store passar a ser LIDO (Fase 10): o fato e
-- derivacao do sistema, nao autoria do usuario - a escrita deveria ser sempre
-- por service role, e esta policy deveria sumir. Fica registrado como decisao
-- consciente, nao como esquecimento.
create policy perfil_fatos_insert_familia on public.perfil_fatos
  for insert to authenticated
  with check (family_account_id = public.current_family_account_id());

create policy perfil_fatos_admin on public.perfil_fatos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.perfil_fatos is
  'Fact store do Perfil Vivo: unidades atômicas de conhecimento sobre a pessoa acompanhada, com tempo, proveniência, contexto e escopo. Escrita em modo sombra no primeiro corte — nenhuma resposta depende dela ainda.';
