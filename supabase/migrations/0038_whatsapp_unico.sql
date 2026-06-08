-- WhatsApp único por família.
-- Sem isso, duas famílias com o mesmo número fazem a Ayla responder pra a
-- família errada (inbound casa pela primeira que aparece). Índice único
-- PARCIAL: ignora NULL (famílias que ainda não preencheram o WhatsApp).
--
-- ATENÇÃO: se já existirem duplicatas exatas, a criação falha. Rodar antes:
--   select whatsapp_e164, count(*) from public.family_accounts
--   where whatsapp_e164 is not null group by whatsapp_e164 having count(*) > 1;
-- e resolver as duplicatas (ou nulizar a errada) antes de aplicar.
--
-- Obs.: o índice pega duplicata EXATA. Variações de 9º dígito/país são
-- barradas no onboarding (validação por chave normalizada em chaveTelefoneBR).

create unique index if not exists family_accounts_whatsapp_unico
  on public.family_accounts (whatsapp_e164)
  where whatsapp_e164 is not null;
