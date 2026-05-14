-- ============================================================
-- Kolo Família — Migração 0010
--   - Cria public.ayla_message_templates: templates editáveis da Ayla
--   - Move os textos hardcoded de messageTemplates.ts para DB
--   - /admin/mensagens permite admins editarem sem tocar no código
-- ============================================================

create table if not exists public.ayla_message_templates (
  key text primary key,
  label text not null,
  description text,
  category text not null check (category in ('proativa','reativa','comando','auxiliar')),
  variations jsonb not null default '[]'::jsonb,
  variables jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  versao int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ayla_message_templates_set_updated_at
  before update on public.ayla_message_templates
  for each row execute function public.set_updated_at();

alter table public.ayla_message_templates enable row level security;

create policy ayla_message_templates_admin_all on public.ayla_message_templates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----- Seed -----

insert into public.ayla_message_templates (key, label, description, category, variations, variables)
values
  (
    'boas_vindas',
    'Boas-vindas',
    'Primeira mensagem após onboarding concluído.',
    'proativa',
    jsonb_build_array(
      E'Oi, {nomeMae}. Sou a Ayla 🌿\n\nObrigada por confiar a gente com a história do/da {nomeMembro}. A partir de agora vou aparecer por aqui pra te perguntar como foi o dia — sem cobrança, só pra organizar junto.\n\nQuando quiser, é só me escrever. Digite AJUDA pra ver os comandos.',
      E'{nomeMae}, oi! Aqui é a Ayla.\n\nCadastro concluído ✅. Daqui pra frente vou te mandar uma perguntinha por dia sobre o/a {nomeMembro} — uma conquista e um desafio bastam.\n\nVocê pode pausar (PAUSAR), mudar horário (MUDAR HORARIO 20:00) ou sair (SAIR) quando quiser.',
      E'Oi, {nomeMae} 🌿\n\nSou a Ayla. A partir de hoje fico do seu lado pra organizar o dia a dia com o/a {nomeMembro}. Sem pressa, sem cobrança.\n\nResponde quando der. Se precisar de ajuda, digite AJUDA.'
    ),
    jsonb_build_array('nomeMae','nomeMembro')
  ),
  (
    'rotina',
    'Pergunta diária de rotina',
    'Pergunta enviada no horário preferido — uma conquista e um desafio.',
    'proativa',
    jsonb_build_array(
      E'Oi, {nomeMae}.\nComo foi o dia do/da {nomeMembro}?\n\nMe conta só 2 coisas:\n1. uma conquista, mesmo pequena\n2. um desafio que apareceu hoje',
      E'{nomeMae}, oi.\nE aí, como foi o dia hoje com {nomeMembro}?\n\nUma conquista + um desafio é suficiente.',
      E'Oi! Como foi o dia do/da {nomeMembro} hoje?\n\nQuando puder responder: uma coisa boa e uma difícil.',
      E'Oi, {nomeMae} 🌿\nComo está o dia? Conta uma coisa que deu certo e uma que foi difícil com {nomeMembro}.',
      E'{nomeMae}, fim de dia. Como foi com {nomeMembro}?\n\nUma conquista + um desafio bastam — pode ser frase curta.'
    ),
    jsonb_build_array('nomeMae','nomeMembro')
  ),
  (
    'engajamento_2dias',
    'Engajamento (2 dias sem responder)',
    'Mensagem após 2 dias sem registro.',
    'proativa',
    jsonb_build_array(
      E'Oi, {nomeMae}. Sumida há uns dias — está tudo bem aí?\n\nSe quiser me contar uma coisa do dia hoje, qualquer frase serve.',
      E'{nomeMae}, faltou seu registro nesses dias. Tudo bem?\n\nUma frase curta sobre como vocês estão já ajuda.',
      E'Oi! Não te ouvi nos últimos dias 🌿. Está tudo bem com {nomeMembro}?'
    ),
    jsonb_build_array('nomeMae','nomeMembro')
  ),
  (
    'engajamento_5dias',
    'Engajamento (5 dias sem responder)',
    'Mensagem após 5 dias sem registro.',
    'proativa',
    jsonb_build_array(
      E'{nomeMae}, faz alguns dias que não nos falamos. Sem cobrança — quero só saber se estão bem.\n\nSe puder responder, mesmo que com ''tudo bem'', já me conforta.',
      E'Oi, {nomeMae}. Caí da rotina aqui sem você 😅. Me conta uma coisa do dia quando puder.'
    ),
    jsonb_build_array('nomeMae','nomeMembro')
  ),
  (
    'trial_d3',
    'Trial faltam 3 dias',
    'Aviso de fim do trial em 3 dias.',
    'proativa',
    jsonb_build_array(
      E'Oi, {nomeMae}. Te lembrando que seus 30 dias grátis terminam em 3 dias.\n\nSe quiser continuar, entra em /assinatura quando der.',
      E'{nomeMae}, faltam 3 dias do seu trial. Sem pressão — só pra você não ser pega de surpresa.'
    ),
    jsonb_build_array('nomeMae')
  ),
  (
    'trial_d0',
    'Trial último dia',
    'Aviso de último dia do trial.',
    'proativa',
    jsonb_build_array(
      E'Oi, {nomeMae}. Hoje é o último dia do seu trial 🌿\n\nSe quiser seguir, é só assinar em /assinatura. Cancela quando quiser.',
      E'{nomeMae}, hoje termina seu trial. Tudo que você registrou continua aqui — pra continuar usando, é só assinar.'
    ),
    jsonb_build_array('nomeMae')
  ),
  (
    'emocional_streak',
    'Streak emocional (7 dias)',
    'Reconhecimento ao completar 7 dias seguidos de registros.',
    'proativa',
    jsonb_build_array(
      E'{nomeMae}, você registrou 7 dias seguidos. Isso é cuidado de verdade — o/a {nomeMembro} está tendo uma mãe bem presente. 🌿',
      E'Sete dias de papo seguidos, {nomeMae}. Você tá fazendo um trabalho enorme com {nomeMembro}.'
    ),
    jsonb_build_array('nomeMae','nomeMembro')
  ),
  (
    'clarificacao_membro',
    'Clarificação — sobre quem',
    'Pergunta de desambiguação quando a família tem 2+ membros.',
    'reativa',
    jsonb_build_array(
      E'Sobre quem você está falando? {opcoes}?'
    ),
    jsonb_build_array('opcoes')
  ),
  (
    'clarificacao_conteudo',
    'Clarificação — conteúdo',
    'Pergunta quando o parser não entendeu o que aconteceu.',
    'reativa',
    jsonb_build_array(
      E'Não consegui entender direito o que aconteceu. Pode me contar de outro jeito? Uma frase curta serve.'
    ),
    jsonb_build_array()
  ),
  (
    'comando_ajuda',
    'Comando AJUDA',
    'Resposta ao comando AJUDA. Lista os comandos disponíveis.',
    'comando',
    jsonb_build_array(
      E'Comandos disponíveis:\n• PAUSAR ou PAUSAR 7 — pausa minhas mensagens\n• MUDAR HORARIO 20:00 — atualiza o horário das perguntas diárias\n• SAIR — desativa as mensagens (mantém seus dados)\n• AJUDA — mostra esta lista'
    ),
    jsonb_build_array()
  ),
  (
    'comando_pausada',
    'Comando PAUSAR',
    'Confirmação quando o usuário pausa as mensagens.',
    'comando',
    jsonb_build_array(
      E'Pausada por {dias_label}. Volto depois — pode escrever a qualquer hora se quiser falar antes.'
    ),
    jsonb_build_array('dias_label')
  ),
  (
    'comando_horario_mudado',
    'Comando MUDAR HORARIO',
    'Confirmação após alterar o horário das perguntas diárias.',
    'comando',
    jsonb_build_array(
      E'Anotado, vou perguntar às {hora}.'
    ),
    jsonb_build_array('hora')
  ),
  (
    'comando_sair',
    'Comando SAIR',
    'Confirmação quando o usuário desativa as mensagens.',
    'comando',
    jsonb_build_array(
      E'Desativada. Seus dados continuam aqui, e quando quiser voltar é só me responder qualquer coisa.'
    ),
    jsonb_build_array()
  )
on conflict (key) do nothing;
