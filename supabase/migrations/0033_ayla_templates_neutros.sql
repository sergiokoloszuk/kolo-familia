-- ============================================================
-- Kolo Família — Migração 0033
--   Corrige duas falhas nos templates da Ayla:
--
--   1. 'engajamento_2dias' variação 0 usava "Sumida há uns dias" (feminino)
--      ao se dirigir ao usuário. Como o campo pra contato pode ser qualquer
--      responsável (pai, mãe, avó, etc.), trocamos a auto-referência
--      gendrada por uma forma neutra: "Faz uns dias sem você por aqui".
--      Também removemos o "hoje" temporal (engajamento dispara em qualquer
--      hora da janela — "hoje" colide com manhã cedo).
--
--   2. 'rotina' tinha variações ancoradas em momento do dia ("Como foi o
--      dia?", "está sendo o dia", "Fim de dia"), mas o seletor de variação
--      é round-robin por seed diária — não conhece o slot horário. Resultado:
--      às 08:00 chegava "O que pegou mais hoje?" (pra recapitular o que
--      ainda não aconteceu); às 19:00 chegava "Como está sendo o dia?"
--      (presente contínuo num dia que já acabou). Reescritas todas pra
--      serem temporalmente neutras — funcionam manhã, tarde e noite.
--
--   Usa INSERT ... ON CONFLICT DO UPDATE porque a observação em prod (frases
--   chegando do FALLBACK hardcoded) indica que as linhas do seed 0010 podem
--   não estar presentes ou estar com variations vazias. Esta migração é
--   idempotente — pode rodar várias vezes, sempre converge pro mesmo estado.
--
--   Mantém os mesmos {placeholders} (nomeMae, nomeMembro, comNomeMembro,
--   deNomeMembro) — não muda contrato com o code.
-- ============================================================

insert into public.ayla_message_templates (key, label, description, category, variations, variables, ativo)
values (
  'rotina',
  'Pergunta diária de rotina',
  'Pergunta enviada no horário preferido — uma conquista e um desafio. Variações neutras de momento do dia.',
  'proativa',
  jsonb_build_array(
    E'Oi, {nomeMae}.\n\nMe conta uma coisa boa e uma difícil — do que vier à cabeça, só pra eu acompanhar do meu canto.',
    E'{nomeMae}, oi.\n\nComo vocês estão {comNomeMembro}? Pode ser frase curta — ou áudio, se for mais fácil.',
    E'Oi 🌿\n\nO que tá pegando mais por aí? E o que tá ajudando? Me conta quando der.',
    E'{nomeMae}, passando aqui rapidinho. Como vocês estão?\n\nQualquer coisa serve — uma frase, um áudio, um emoji.',
    E'{nomeMae}, passando aqui.\n\nMe conta uma coisa {deNomeMembro} quando der — sem pressa.'
  ),
  jsonb_build_array('nomeMae','nomeMembro','comNomeMembro','deNomeMembro'),
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
  'engajamento_2dias',
  'Engajamento (2 dias sem responder)',
  'Mensagem após 2 dias sem registro. Auto-referência neutra (sem "Sumida").',
  'proativa',
  jsonb_build_array(
    E'Oi, {nomeMae}. Faz uns dias sem você por aqui — está tudo bem aí?\n\nSe quiser me contar uma coisa, qualquer frase serve.',
    E'{nomeMae}, faltou seu registro nesses dias. Tudo bem?\n\nUma frase curta sobre como vocês estão já ajuda.',
    E'Oi 🌿\n\nNão te ouvi nos últimos dias. Está tudo bem com {nomeMembro}?'
  ),
  jsonb_build_array('nomeMae','nomeMembro'),
  true
)
on conflict (key) do update set
  variations = excluded.variations,
  variables = excluded.variables,
  description = excluded.description,
  ativo = true,
  versao = public.ayla_message_templates.versao + 1;
