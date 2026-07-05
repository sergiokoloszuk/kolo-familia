-- ============================================================
-- Kolo Família — Migração 0057 (CRM Fase C)
--   1) Exclusão de lead com motivo (ex.: "é teste do João") — some do radar,
--      mas o motivo fica guardado. Reversível.
--   2) crm_fase_scripts: roteiro editável por fase — o que a AYLA faz
--      (referência) + a SUGESTÃO de abordagem sua (alimenta o copiloto).
--      Seed com defaults da cadência do documento da agência.
--
--   Leitura só admin; escrita via service-role.
--   Depois de aplicar: NOTIFY pgrst, 'reload schema';
--   (ou reinicie só o container 'rest' — NUNCA o postgres.)
-- ============================================================

alter table public.crm_leads
  add column if not exists excluido        boolean not null default false,
  add column if not exists excluido_motivo text,
  add column if not exists excluido_em     timestamptz;

create table if not exists public.crm_fase_scripts (
  fase           text primary key,
  texto_ayla     text not null default '',
  texto_sugestao text not null default '',
  atualizado_em  timestamptz not null default now()
);

alter table public.crm_fase_scripts enable row level security;
drop policy if exists crm_fase_scripts_admin_select on public.crm_fase_scripts;
create policy crm_fase_scripts_admin_select on public.crm_fase_scripts for select
  using (public.is_admin());

insert into public.crm_fase_scripts (fase, texto_ayla, texto_sugestao) values
  ('cadastrou',
   'Convida a contar uma dor concreta e puxa o 1º uso ("qual situação você quer trabalhar primeiro?").',
   'D0 — Apresente-se e puxe uma dor real: "Oi [Nome], aqui é a Karina, da Kolo 💛. Qual situação da rotina mais pesa hoje — sono, escola, crise, comida?"'),
  ('ativou_teste',
   'Nudge de 1º uso; ensina o valor (registrar o dia → evolução/plano) e puxa pro plano.',
   'D1 — Recupere o 1º uso, com pouca fricção: "Me responde com uma palavra: qual desafio pesa mais hoje? Eu já monto um plano pra vocês tentarem."'),
  ('ativado',
   'Reforça o valor (não é conteúdo genérico), personaliza e convida a gerar um plano.',
   'D2/D3 — Cheque a aplicação: "Conseguiu testar alguma orientação na rotina? O que funcionou, o que não? Se quiser, monto um plano pra um desafio específico."'),
  ('engajado',
   'Mantém o uso, checa aplicação e oferece um novo plano/orientação.',
   'D4 — Eduque sobre continuidade: "A Kolo faz mais sentido como apoio contínuo. Antes do teste acabar, vale usar mais uma vez com uma situação real."'),
  ('oportunidade',
   'Lembrete de fim de trial (D-3/D-0), sem empurrar preço — isso é seu.',
   'D5/D6 — Valor antes do preço. Se já percebeu valor, convide: "Se te ajudou a ter clareza sobre [dor], o próximo passo é manter o acesso. Quer o link?"'),
  ('em_risco',
   'Mensagem de recuperação (sumiu 24h+).',
   'Resgate: "Sumiu por aqui, tá tudo bem? Me conta um desafio que esteja pegando que eu monto um plano prático pra vocês."'),
  ('expirado',
   '—',
   'Pós-teste (D+1): "Seu teste terminou. Se te ajudou a pensar sobre [dor], dá pra reativar o acesso e continuar. Quer o link?"'),
  ('convertido',
   'Retenção inicial (reforça uso semanal e registro).',
   'Pós-conversão: confirme o acesso, reforce o próximo passo de uso e peça um feedback inicial depois dos primeiros dias.')
on conflict (fase) do nothing;
