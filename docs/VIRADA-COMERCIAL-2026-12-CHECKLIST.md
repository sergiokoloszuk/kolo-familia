# Virada comercial 2026-12 — checklist de execução

**Dona da decisão:** Karina

**Data:** provisória 01/12/2026, 00h (horário de Brasília), sujeita à confirmação
de Karina. A data é programada e alterada em `/admin/virada`, sem deploy.

**O que muda:** a partir da data, conta nova não ganha dias grátis. A pessoa
conhece a Ayla pela demonstração da landing e, ao criar a conta, vai direto à
escolha do plano (R$ 54,90/mês ou anual, preço lido do Stripe).

**O que não muda:** quem já tem teste, cortesia, oferta Black Friday ou
assinatura mantém o que tem até o próprio prazo, incluindo os prazos que chegam
a 10/12. Os avisos de fim de teste (D-3, D-1, D-0) continuam só para essas
famílias, porque dependem de `trial_ends_at`, que a jornada nova não cria.

**Regra de segurança:** nenhum item marcado como prova pode ser substituído por
"o código existe". Este roteiro não autoriza mensagem, cobrança, migração,
deploy ou alteração no Stripe.

## Como funciona (resumo técnico)

| Peça | Onde | Comportamento |
|---|---|---|
| Data da virada | `configuracao_geral.virada_comercial_em`, `lib/billing/virada-comercial.ts` | Sem chave ou valor inválido = jornada antiga byte a byte |
| Concessão do teste | `lib/trial/iniciar.ts` | Com a virada: família **sem linha** não chama `iniciar_trial_se_apto`; família com linha continua na RPC (direito de legado da 0084) |
| Pagamento sem linha | `lib/stripe/acesso.ts` `gravarAcessoDaFamilia` | O webhook cria a linha quando o `UPDATE` não casa; nasce `canceled` sem pagamento e `active` com pagamento |
| Ayla (WhatsApp) | `lib/billing/fatos-comerciais.ts`, `lib/trial/jornada.ts`, `lib/ayla/orchestrator.ts`, `lib/ayla/desconhecido.ts` | Não promete dias grátis; quem nunca teve teste não ouve "seu período grátis acabou" |
| Telas | `/precos`, onboarding, `/ajuda`, `/termos`, login/cadastro | Sem "dias grátis" para quem chega; os estados de quem já tem conta seguem iguais |
| Black Friday | `lib/billing/black-friday-2026.ts` e travas SQL da 0096 | Novas entradas encerram sozinhas em 01/12 00h. O Admin recusa virada antes disso |

## Responsáveis

| Papel | Pessoa |
|---|---|
| Decisão e validação da Ayla e da landing | Karina |
| Merge, deploy e variáveis na Vercel | _______________ |
| Stripe (conferência de preços e webhooks) | _______________ |
| Banco e backup (Supabase/EasyPanel) | _______________ |
| Monitoramento das primeiras 48 h | _______________ |

## Antes do dia (D-2 a D-1)

- [ ] **Backup do banco** feito e restauração testada em ambiente separado (PEND-092). Registrar data e referência.
- [ ] **Tag de código** de reversão conferida: `backup/antes-virada-2026-11-27` (= `main` em `d4f4f262`).
- [ ] **Termos de uso:** Karina ou jurídico aprovou o texto da seção 6 "Demonstração e Assinaturas" (aparece só com a virada valendo).
- [ ] **Preço:** em `/admin/virada`, o card "Preço que novas contas verão" mostra R$ 54,90 mensal e o anual esperado.
- [ ] **Stripe:** os 4 webhooks continuam ligados (não desligar nenhum). Conferir na lista de endpoints que o da Kolo Família recebe os eventos de assinatura, checkout e fatura.
- [ ] **Prévia:** merge do PR da virada **com a data ainda não programada**. Sem a data, produção fica idêntica à de hoje.
- [ ] **Health:** `/api/health` mostra o commit novo e `db: ok`.
- [ ] **Onboarding conversacional:** revisar no Admin o texto publicado do onboarding (`carregarCopy`) — ele vive no banco e pode mencionar "período gratuito".
- [ ] **Core e documento de trial da Ayla:** revisar se a versão ativa promete dias grátis a quem chega (§ "período de teste").
- [ ] **Landing (Karina):** botão de teste/demonstração e chamada para "criar conta" sem promessa de dias grátis.

## No dia

1. [ ] Em `/admin/virada`, gravar a data confirmada por Karina (pode ser feito antes; vale a partir do horário gravado).
2. [ ] Depois do horário, em janela anônima: `/precos` mostra "A Kolo do seu lado todos os dias" e o botão "Criar minha conta", sem "grátis".
3. [ ] `/termos` mostra "6. Demonstração e Assinaturas".
4. [ ] Conta fictícia de QA nova (e-mail e WhatsApp de teste, nunca família real): concluir o cadastro → a tela final diz "No próximo passo você escolhe o seu plano" → o app abre a tela "Assine pra continuar" com R$ 54,90.
5. [ ] Assinatura de teste **somente em modo de teste do Stripe** (nunca cartão real em produção): o acesso é liberado sem intervenção manual. Conferir em `eventos_app` o registro `stripe_checkout_completed_linha_criada` ou `stripe_subscription_changed_linha_criada` com `resultado: ok`.
6. [ ] Família antiga com teste em andamento (QA): continua com o prazo, o painel mostra "Faltam N dias", `/precos` mostra "Continuar com a Kolo".
7. [ ] Participante da Black Friday (QA, se houver): mantém R$ 39,90 e o prazo individual.
8. [ ] Apagar a conta fictícia criada no passo 4 ao final do teste.

## Monitoramento — primeiras 48 h

Consultas só de leitura em `eventos_app`, a cada 6 h no primeiro dia e a cada 12 h no segundo:

- [ ] `kind = 'trial_inicio'` com `motivo = 'sem_trial_jornada_nova'`: novas contas sem teste (esperado).
- [ ] `kind = 'trial_inicio'` com `motivo = 'iniciado'` **depois** do horário da virada: **não deveria existir**. Se aparecer, a virada não está valendo para alguém — conferir a data no Admin.
- [ ] `kind like 'stripe_%_linha_criada'` com severidade de erro: pagamento sem acesso. Agir na hora (reconciliar pelo Admin de famílias).
- [ ] `kind = 'iniciar_trial_virada_leitura_falhou'`: leitura do banco falhou no fim do cadastro (a família ficou sem teste, o que é o correto; investigar a causa).
- [ ] Conversas da Ayla com famílias sem acesso: nenhuma resposta com "seu período grátis acabou" para conta criada depois da virada.
- [ ] Stripe → Webhooks: nenhuma entrega com falha repetida.

## Se algo der errado (reversão)

| Situação | Ação | Efeito |
|---|---|---|
| Qualquer incoerência de jornada | `/admin/virada` → **Cancelar virada** | Na hora, conta nova volta a ganhar 7 dias. Quem criou conta durante a virada continua sem teste (não há concessão retroativa) |
| Defeito no código novo | Reverter o merge (ou publicar a tag `backup/antes-virada-2026-11-27`) | Volta ao código de antes. Os dados criados (linhas `canceled`/`active` do webhook) são válidos no código antigo |
| Pagamento sem acesso | Reconciliação pelo Admin de famílias; o Stripe reenvia o evento enquanto a escrita falhar | Nenhuma cobrança é desfeita |

Nenhuma reversão apaga pagamento, cadastro ou direito concedido: a virada só
decide o que **nasce** para conta nova.
