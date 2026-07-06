-- ============================================================
-- Kolo Família — Migração 0058
--   crm_ayla_cadencia: diretriz EDITÁVEL por situação da Ayla proativa (o que
--   ela fala em cada momento da cadência). A lógica de QUANDO (dia/estado) fica
--   no código; o QUE ela fala a Karina edita aqui. Injeta na geração da proativa.
--
--   Leitura só admin; escrita via service-role. Seed com as situações atuais.
--   Depois de aplicar: NOTIFY pgrst, 'reload schema';
-- ============================================================

create table if not exists public.crm_ayla_cadencia (
  situacao       text primary key,
  label          text not null default '',
  diretriz       text not null default '',
  ativo          boolean not null default true,
  atualizado_em  timestamptz not null default now()
);

alter table public.crm_ayla_cadencia enable row level security;
drop policy if exists crm_ayla_cadencia_admin_select on public.crm_ayla_cadencia;
create policy crm_ayla_cadencia_admin_select on public.crm_ayla_cadencia for select
  using (public.is_admin());

insert into public.crm_ayla_cadencia (situacao, label, diretriz) values
  ('menu_do_dia', 'Menu do dia (nao engajou / ativador)', 'Ofereca um menu de caminhos do dia: (crianca) ajuda pra uma situacao / montar rotina visual / historia; (adulto) situacao / plano; ou so contar o dia, que pode ser por audio. Lembre que registrar o dia vira a evolucao por tema.'),
  ('convite_plano', 'Convite ao plano', 'Convide a contar um desafio concreto de agora pra montar um PLANO pratico. O plano e o que mais encanta no teste.'),
  ('ensinar_valor', 'Ensinar o valor', 'Ensine o ciclo: quanto mais conta o dia a dia, mais da pra montar relatorio de evolucao (escola/terapeuta), personalizar e fazer planos.'),
  ('feedback_plano', 'Perguntar o que achou do plano', 'Quem ja recebeu plano: pergunte o que achou, se testou, o que funcionou. Vira feedback pra melhorar.'),
  ('completar_perfil', 'Completar o Perfil', 'Convide a completar um campo do Perfil, com uma pergunta simples, pra personalizar melhor as proximas orientacoes.'),
  ('voce_sabia', 'Voce sabia (recurso)', 'Apresente de leve um recurso do app (voce sabia que...?) que ajude no dia a dia.'),
  ('acolhimento', 'Acolhimento', 'Abertura calorosa e neutra, convidando a contar uma coisa boa e uma dificil, sem cobranca.')
on conflict (situacao) do nothing;
