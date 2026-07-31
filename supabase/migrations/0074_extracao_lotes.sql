-- LOTE DE EXTRAÇÃO — a unidade de proveniência do que o extrator leu.
--
-- ⚠️ NÃO APLICADA. Entra na mesma janela da 0073, depois dela.
--
-- POR QUE ESTA TABELA EXISTE
--
-- No WhatsApp ninguém escreve um parágrafo: escreve três mensagens seguidas.
-- `lote-inbound.ts` junta a rajada num turno só e entrega ao extrator o texto
-- consolidado das três. Mas o fato gravava `source_content_id` apontando para
-- UMA mensagem — a que levou o turno.
--
-- Ou seja: o ponteiro de evidência não descrevia o insumo. Quem fosse
-- reconstruir o caso depois recuperaria uma das três mensagens e concluiria
-- que o extrator errou, quando o extrator tinha lido outra coisa. Todo caso
-- capturado de produção nasceria com a entrada errada — teste com aparência de
-- teste, medindo um insumo que nunca existiu.
--
-- A unidade de proveniência passa a ser o LOTE: mensagens → lote → fatos.
--
-- O TEXTO NÃO É COPIADO PARA CÁ, DE PROPÓSITO
--
-- Guardamos o hash do texto consolidado e as referências ordenadas das
-- mensagens. O texto se reconstrói por `reconstruirTextoDoLote`, que usa a
-- MESMA função de consolidação do caminho de produção (`consolidarTextos`), e
-- o hash prova que a reconstrução bate com o que foi entregue ao extrator.
--
-- Duas vantagens sobre copiar o texto: o relato da família não passa a existir
-- em mais um lugar (é dado de saúde de criança), e o teste de fidelidade vira
-- uma afirmação de verdade em vez de tautologia. Se a consolidação mudar, o
-- hash denuncia em vez de a reconstrução mentir em silêncio.
--
-- Só ACRESCENTA: nenhuma tabela existente é tocada.

create table if not exists public.extracao_lotes (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,

  -- De onde veio o insumo. O WhatsApp é o único que agrupa rajada hoje; os
  -- outros canais entram com lote de uma peça só, para que exista UM caminho de
  -- proveniência e não um por canal.
  canal text not null check (canal in ('whatsapp', 'web', 'diario', 'sistema')),

  -- AS MENSAGENS, NA ORDEM EM QUE FORAM LIDAS.
  --   [{ ordem, mensagem_id, provedor_message_id, recebida_em }]
  --
  -- `mensagem_id` é o id interno de `ayla_messages` — sempre existe, é estável
  -- e não depende do provedor. `provedor_message_id` é o id externo (Z-API) e é
  -- NULO quando o payload não trouxe. Nulo explícito, nunca inventado: um id
  -- externo falso faria a evidência parecer recuperável fora daqui, e ela não é.
  --
  -- jsonb e não tabela de ligação: a ordem é a do array, `ayla_messages` é
  -- append-only (não há expurgo) e some junto por cascade de família. Uma tabela
  -- de ligação só acrescentaria integridade referencial que o append-only já
  -- garante na prática — e a pergunta inversa ("que lotes contêm a mensagem X?")
  -- não é feita por ninguém.
  mensagens jsonb not null,
  quantidade integer not null check (quantidade > 0),

  -- Hash sha256 do texto consolidado entregue ao extrator. NÃO é chave: o mesmo
  -- texto pode ser dito de novo amanhã, e isso é repetição legítima, não
  -- reprocessamento.
  texto_hash text not null,

  -- CHAVE DE REPROCESSAMENTO: hash do conjunto ordenado de `mensagem_id`.
  -- Reprocessar as mesmas mensagens reencontra o mesmo lote; a mãe repetir a
  -- mesma frase amanhã gera linhas novas em `ayla_messages` e portanto um lote
  -- novo. É a distinção entre reprocessamento técnico e repetição legítima,
  -- aplicada uma camada acima do `idempotency_key` do fato.
  mensagens_chave text not null,

  criado_em timestamptz not null default now()
);

create unique index if not exists extracao_lotes_chave
  on public.extracao_lotes (family_account_id, mensagens_chave);

create index if not exists extracao_lotes_familia_data
  on public.extracao_lotes (family_account_id, criado_em desc);

alter table public.extracao_lotes enable row level security;

create policy extracao_lotes_familia on public.extracao_lotes
  for select to authenticated
  using (family_account_id = public.current_family_account_id());

-- INSERT para autenticado pelo mesmo motivo da 0073: hoje só o WhatsApp grava
-- lote, e ele usa service role — mas o dia em que a web/diário passarem a
-- registrar lote, a escrita falharia em SILÊNCIO sem esta policy. Já custou uma
-- rodada de auditoria descobrir isso em `perfil_fatos`; não repetir.
create policy extracao_lotes_insert_familia on public.extracao_lotes
  for insert to authenticated
  with check (family_account_id = public.current_family_account_id());

create policy extracao_lotes_admin on public.extracao_lotes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.extracao_lotes is
  'Unidade de proveniência do extrator: o conjunto ordenado de mensagens efetivamente lido numa passada. Referência, não cópia — o texto vive em ayla_messages e se reconstrói por consolidarTextos, com texto_hash provando a fidelidade.';
