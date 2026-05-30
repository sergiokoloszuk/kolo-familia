-- ============================================================
-- Kolo Família — Migração 0034
--   Continuação do 0033: corrige mais duas auto-referências gendradas
--   nos templates da Ayla, que assumiam mãe/mulher como destinatária.
--
--   1. 'trial_d3' variação 1 dizia "pra você não ser pega de surpresa"
--      (feminino). Reescrita pra "Quis te avisar com antecedência, pra
--      você decidir com calma" — neutro, mantém a intenção (avisar com
--      tempo, sem pressão).
--
--   2. 'emocional_streak' variação 0 dizia "o/a {nomeMembro} está tendo
--      uma mãe bem presente" — assume mãe como destinatário. Reescrita
--      pra "{nomeMembro} está tendo um cuidado bem presente — e isso
--      vem de você" — neutro, mantém o reconhecimento.
--
--   Aproveita pra alinhar os textos do DB com os FALLBACK do code
--   (estavam levemente diferentes desde o 0010). Idempotente.
-- ============================================================

insert into public.ayla_message_templates (key, label, description, category, variations, variables, ativo)
values (
  'trial_d3',
  'Trial faltam 3 dias',
  'Aviso de fim do trial em 3 dias. Auto-referência neutra (sem "pega").',
  'proativa',
  jsonb_build_array(
    E'Oi, {nomeMae}. Te lembrando que seus 30 dias grátis terminam em 3 dias.\n\nSe quiser continuar com a gente, é só assinar em /assinatura. Sem pressa.',
    E'{nomeMae}, faltam 3 dias pro fim do seu período grátis.\n\nQuis te avisar com antecedência, pra você decidir com calma.'
  ),
  jsonb_build_array('nomeMae'),
  true
)
on conflict (key) do update set
  variations = excluded.variations,
  variables = excluded.variables,
  description = excluded.description,
  ativo = true,
  versao = public.ayla_message_templates.versao + 1;

insert into public.ayla_message_templates (key, label, description, category, variations, variables, ativo)
values (
  'emocional_streak',
  'Streak emocional (7 dias)',
  'Reconhecimento ao completar 7 dias seguidos de registros. Sem assumir "mãe" como destinatário.',
  'proativa',
  jsonb_build_array(
    E'{nomeMae}, você me respondeu 7 dias seguidos 🌿\n\nIsso é cuidado de verdade. {nomeMembro} está tendo um cuidado bem presente — e isso vem de você.',
    E'Sete dias de papo seguidos, {nomeMae}.\n\nTô vendo o trabalho enorme que você está fazendo {comNomeMembro}. Não é pouco.'
  ),
  jsonb_build_array('nomeMae','nomeMembro','comNomeMembro'),
  true
)
on conflict (key) do update set
  variations = excluded.variations,
  variables = excluded.variables,
  description = excluded.description,
  ativo = true,
  versao = public.ayla_message_templates.versao + 1;
