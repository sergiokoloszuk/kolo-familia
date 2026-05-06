-- ============================================================
-- Kolo Família — Row Level Security
-- Migração 0002: habilita RLS e define políticas.
--
-- Princípios (PRD §13.4):
--   - Dados de família: acesso só pela própria família.
--   - dass21_aplicacoes: RLS estrito por user_id (admin não vê).
--   - ayla_send_log: só admin.
--   - Conteúdo curado (boas_praticas, aulas, skills, output_types):
--     leitura pública (autenticados), escrita só admin.
-- ============================================================

-- ----- Tabelas escopadas por família -----

alter table public.family_accounts enable row level security;
create policy family_accounts_self on public.family_accounts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.family_profiles enable row level security;
create policy family_profiles_self on public.family_profiles
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.membros_atipicos enable row level security;
create policy membros_atipicos_self on public.membros_atipicos
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.perfil_vivo_familia enable row level security;
create policy perfil_vivo_familia_self on public.perfil_vivo_familia
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.perfil_vivo_membro enable row level security;
create policy perfil_vivo_membro_self on public.perfil_vivo_membro
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.sugestao_perfil_vivos enable row level security;
create policy sugestao_perfil_vivos_self on public.sugestao_perfil_vivos
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.diarios enable row level security;
create policy diarios_self on public.diarios
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.check_ins_diarios enable row level security;
create policy check_ins_diarios_self on public.check_ins_diarios
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.check_ins_semanais enable row level security;
create policy check_ins_semanais_self on public.check_ins_semanais
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.reflexoes_semanais enable row level security;
create policy reflexoes_semanais_self on public.reflexoes_semanais
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

-- DASS-21: RLS por user_id, admin NÃO vê (PRD §7.15.3, §12.13)
alter table public.dass21_aplicacoes enable row level security;
create policy dass21_self on public.dass21_aplicacoes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Conversas e mensagens — só a própria família
alter table public.conversas enable row level security;
create policy conversas_self on public.conversas
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.mensagens_skill enable row level security;
create policy mensagens_skill_self on public.mensagens_skill
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

-- Ayla: tudo escopado por família
alter table public.ayla_messages enable row level security;
create policy ayla_messages_self on public.ayla_messages
  for select to authenticated
  using (family_account_id = public.current_family_account_id());
create policy ayla_messages_admin_all on public.ayla_messages
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.ayla_daily_checkins enable row level security;
create policy ayla_daily_checkins_self on public.ayla_daily_checkins
  for select to authenticated
  using (family_account_id = public.current_family_account_id());
create policy ayla_daily_checkins_admin_all on public.ayla_daily_checkins
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.ayla_preferences enable row level security;
create policy ayla_preferences_self on public.ayla_preferences
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.ayla_insights enable row level security;
create policy ayla_insights_self on public.ayla_insights
  for select to authenticated
  using (family_account_id = public.current_family_account_id());
create policy ayla_insights_admin_all on public.ayla_insights
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ayla_send_log: SÓ admin (PRD §13.4)
alter table public.ayla_send_log enable row level security;
create policy ayla_send_log_admin_only on public.ayla_send_log
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Pagamento
alter table public.subscription_accesses enable row level security;
create policy subscription_accesses_self on public.subscription_accesses
  for select to authenticated
  using (family_account_id = public.current_family_account_id());
create policy subscription_accesses_admin_write on public.subscription_accesses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.assinaturas enable row level security;
create policy assinaturas_self_read on public.assinaturas
  for select to authenticated
  using (family_account_id = public.current_family_account_id());
create policy assinaturas_admin_write on public.assinaturas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Imagens
alter table public.avatares_membros_atipicos enable row level security;
create policy avatares_self on public.avatares_membros_atipicos
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.galeria_imagens enable row level security;
create policy galeria_self on public.galeria_imagens
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

-- Relatórios
alter table public.relatorios_gerados enable row level security;
create policy relatorios_self on public.relatorios_gerados
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

alter table public.links_vivos enable row level security;
create policy links_vivos_self on public.links_vivos
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

-- Categorias opt-out (família escolhe)
alter table public.categorias_optout enable row level security;
create policy categorias_optout_self on public.categorias_optout
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

-- Avaliações e histórias da própria família
alter table public.avaliacao_maes enable row level security;
create policy avaliacao_maes_self on public.avaliacao_maes
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());
-- Depoimentos publicados (com permite_publicar) ficam em public.depoimentos via job admin.

alter table public.historias enable row level security;
create policy historias_self on public.historias
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

-- ----- Conteúdo curado: leitura por todos autenticados, escrita só admin -----

alter table public.specialist_prompt_templates enable row level security;
create policy specialist_prompt_templates_read on public.specialist_prompt_templates
  for select to authenticated using (ativo = true);
create policy specialist_prompt_templates_admin on public.specialist_prompt_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.output_types enable row level security;
create policy output_types_read on public.output_types
  for select to authenticated using (ativo = true);
create policy output_types_admin on public.output_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.boas_praticas enable row level security;
create policy boas_praticas_read on public.boas_praticas
  for select to authenticated using (status = 'ativo');
create policy boas_praticas_admin on public.boas_praticas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.aulas enable row level security;
create policy aulas_read on public.aulas
  for select to authenticated using (status = 'ativo');
create policy aulas_admin on public.aulas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.trilhas enable row level security;
create policy trilhas_read on public.trilhas
  for select to authenticated using (ativo = true);
create policy trilhas_admin on public.trilhas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.videos_fundadora enable row level security;
create policy videos_read on public.videos_fundadora
  for select to authenticated using (ativo = true);
create policy videos_admin on public.videos_fundadora
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----- Operacional: leitura pública (autenticados), escrita admin -----

alter table public.depoimentos enable row level security;
create policy depoimentos_read on public.depoimentos
  for select to authenticated using (ativo = true);
create policy depoimentos_admin on public.depoimentos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.sobre_plataforma enable row level security;
create policy sobre_plataforma_read on public.sobre_plataforma
  for select to authenticated using (publicado = true);
create policy sobre_plataforma_admin on public.sobre_plataforma
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.configuracao_precos enable row level security;
create policy configuracao_precos_read on public.configuracao_precos
  for select to authenticated using (true);
create policy configuracao_precos_admin on public.configuracao_precos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.configuracao_vozes enable row level security;
create policy configuracao_vozes_admin on public.configuracao_vozes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.afiliados enable row level security;
create policy afiliados_admin on public.afiliados
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.parceiros enable row level security;
create policy parceiros_admin on public.parceiros
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.cupons enable row level security;
create policy cupons_read on public.cupons
  for select to authenticated using (ativo = true);
create policy cupons_admin on public.cupons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.contato_inclusao enable row level security;
create policy contato_inclusao_admin on public.contato_inclusao
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.controle_acessos enable row level security;
create policy controle_acessos_admin on public.controle_acessos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Campanhas: gestão admin
alter table public.campanhas enable row level security;
create policy campanhas_admin on public.campanhas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.campanhas_destinatarios enable row level security;
create policy campanhas_destinatarios_admin on public.campanhas_destinatarios
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy campanhas_destinatarios_self_read on public.campanhas_destinatarios
  for select to authenticated using (family_account_id = public.current_family_account_id());

-- ============================================================
-- FIM da migração 0002 — RLS habilitado em todas as tabelas.
-- ============================================================
