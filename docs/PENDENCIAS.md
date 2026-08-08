# Pendências abertas — Kolo Família

**Fonte oficial do estado das pendências.** Memória de agente, conversa,
relatório e commit ajudam no contexto; o estado válido é este arquivo. Onde
divergirem, este arquivo vence e a outra fonte se corrige.

Concluídas e canceladas vivem em [PENDENCIAS-ARQUIVO.md](PENDENCIAS-ARQUIVO.md).
As regras de uso estão no fim deste documento.

---

## Painel

Só o que está aberto. 🔒 = bloqueada.

| ID | Pendência | Bloco | Prio | Estado | Próximo passo |
|---|---|---|---|---|---|
| [PEND-015](#pend-015) | Exposição de secrets no Easypanel | H · Governança | a definir | ABERTA | investigar o risco antes de priorizar |
| [PEND-007](#pend-007) | Ativação do GPT parada na prova da chave | H · Governança | P1 | ABERTA 🔒 | publicar e rodar `provider-check` |
| [PEND-002](#pend-002) | Pagamento confirmado sem acesso na Kolo | G · Comercial | P1 | AGUARDANDO VALIDAÇÃO | esperar a primeira assinatura real |
| [PEND-001](#pend-001) | Cooldown do convite de assinatura | G · Comercial | P1 | AGUARDANDO VALIDAÇÃO | esperar o próximo convite real |
| [PEND-016](#pend-016) | Condução da Ayla — o que ela diz e por quê | **A · Condução** | P1 | ABERTA | **preencher o DESEJADO com a Karina** |
| [PEND-017](#pend-017) | Conhecimento: acervo, recuperação e uso | **B · Conhecimento** | P1 | ABERTA | desenhar junto com A |
| [PEND-018](#pend-018) | Memória e retrato da criança | **C · Memória** | P1 | ABERTA | desenhar junto com A |
| [PEND-021](#pend-021) | Jornada dos 7 dias e conversão | G · Comercial | P1 | ABERTA | preencher o DESEJADO |
| [PEND-022](#pend-022) | Fontes confiáveis, limites e escalonamento | F · Limites | P2 | ABERTA | preencher o DESEJADO |
| [PEND-004](#pend-004) | Rotina/Sequência Visual | D · Entregas | P2 | ABERTA | completar o DESEJADO (parte já existe) |
| [PEND-019](#pend-019) | Estratégias que a família consegue usar | D · Entregas | P2 | ABERTA | depende de A+B+C |
| [PEND-020](#pend-020) | Relatórios para escola, terapeuta e médico | D · Entregas | P2 | ABERTA | depende de C |
| [PEND-023](#pend-023) | Feedback da família e aprendizado | E · Feedback | P2 | ABERTA | depende de D |
| [PEND-009](#pend-009) | Primeira conversa da Ayla | A · Condução | P2 | ABERTA | entra no DESEJADO de PEND-016 |
| [PEND-012](#pend-012) | RUNBOOK — como operar a Kolo com segurança | H · Governança | P2 | ABERTA | levantar o que só existe em memória |
| [PEND-005](#pend-005) | `MEMORY.md` perto do limite de leitura | H · Governança | P2 | ABERTA | compactar o índice |
| [PEND-006](#pend-006) | Dois arquivos não rastreados em `lib/conducao/` | H · Governança | P2 | ABERTA | identificar a frente dona |
| [PEND-014](#pend-014) | Revisar o protocolo de engenharia | H · Governança | P2 | ABERTA | decidir os níveis de risco |
| [PEND-011](#pend-011) | README aponta para documentos inexistentes | H · Governança | P3 | ABERTA | restaurar ou corrigir os links |
| [PEND-013](#pend-013) | Mapa do sistema | H · Governança | P3 | ABERTA | listar os fluxos que merecem ponteiro |

---

## Blocos e dependências

O registro deixou de ser uma lista plana em 2026-08-08. Funcionalidades que
compartilham **cérebro, memória, recuperação ou decisão** não podem ser
investigadas como se fossem independentes — implementar duas vezes a mesma
inteligência é o retrabalho mais caro que existe aqui.

| Bloco | Pendências | Natureza |
|---|---|---|
| **A · Condução** | PEND-016 | INVESTIGAR/DESENHAR JUNTO com B e C |
| **B · Conhecimento** | PEND-017 | INVESTIGAR/DESENHAR JUNTO com A |
| **C · Memória da criança** | PEND-018 | INVESTIGAR/DESENHAR JUNTO com A |
| **D · Entregas** | PEND-004 (rotina) · PEND-019 (estratégias) · PEND-020 (relatórios) | DEPENDE DE A+B+C |
| **E · Feedback** | PEND-023 | DEPENDE DE D · alimenta A e C |
| **F · Limites** | PEND-022 | PODE SER DESENHADA SEPARADAMENTE, aplica-se a A |
| **G · Comercial** | PEND-021 · PEND-001 · PEND-002 | PODE ANDAR EM PARALELO |
| **H · Governança/Infra** | PEND-005 · PEND-006 · PEND-007 · PEND-011 · PEND-012 · PEND-013 · PEND-014 · PEND-015 | INFRAESTRUTURA/GOVERNANÇA |

### Ordem por dependência

```
A · Condução ──┐
B · Conhecimento ──┼──> D · Entregas ──> E · Feedback ──┐
C · Memória ───┘                                        │
      ^                                                 │
      └─────────────── aprende com ────────────────────┘

F · Limites  → atravessa A (desenhar junto, implementar depois)
G · Comercial → paralelo (não depende de A/B/C para andar)
H · Governança → destrava as outras, nunca é destravada por elas
```

**A, B e C são um desenho só.** A Ayla escolher o que dizer (A) depende do que
ela consegue recuperar (B) e do que sabe da criança (C). Desenhar A sem B
produz prompt melhor sobre acervo inalcançável; desenhar B sem C produz
recuperação genérica.

**D não começa antes de A+B+C terem DESEJADO definido** — rotina, estratégia e
relatório são as três saídas do mesmo cérebro, e hoje cada uma tem o seu.

**E fecha o ciclo:** sem feedback, A e C não têm como melhorar a próxima
recomendação para aquela criança.

### Portão do DESEJADO

> Pendência de produto/experiência **não** vai para investigação técnica
> profunda antes de o comportamento desejado estar suficientemente definido.
> A investigação compara **ATUAL × DESEJADO** e aponta lacunas e dependências —
> ela não inventa o produto.

Ficha de produto tem seção `DESEJADO`. Quando depender de decisão da Karina,
ela fica marcada **`DESEJADO A DEFINIR COM PRODUTO`** com a lista do que
precisa ser decidido antes.

---

## Fichas

### PEND-001
**Cooldown do convite de assinatura — publicado, aguardando tráfego real**
Categoria: Pagamento/Acesso · Prioridade: **P1** · Estado: **AGUARDANDO VALIDAÇÃO**
Aberta em: 2026-08-08 · Origem: Fase 0A

- **Impacto:** a Ayla repetia o convite para assinar a cada mensagem de quem
  está sem acesso — 15 convites em 3h41 no pior caso, quatro deles em seis
  segundos. Publicado, o dano cessa; falta comprovar com tráfego real.
- **REVALIDADA E PUBLICADA (2026-08-08):** commit `9e6a468` (o `27fcab4`
  original, trazido para a `main` atual), PR #45, merge `050cf87`, Production
  **success** às 16:19:43Z.
- **Revalidação semântica, não só de git:** `orchestrator.ts` **não mudou**
  entre a base do commit antigo e a `main` de hoje. Reconferido que as três
  premissas da correção continuam verdadeiras: `enviarEPersistir` só grava em
  `ayla_messages` **quando o envio sai** (é o que sustenta a janela de 12h);
  `ayla_send_log` tem `template_key`/`status` com o `check` que a reserva usa;
  e `convidouAssinarRecente` não tinha outro chamador.
- **Replay read-only refeito contra o histórico real (2026-08-08):**
  30 → **9** convites (−70%), um por família · Rochelle (`7c764314`) 15 → 1 ·
  **nenhuma das 9 famílias deixa de receber convite** · 16 convites vieram a
  menos de 2min do anterior, que é o que a reserva pega. Os números do laudo
  original se confirmaram.
- **O bug estava vivo até 3 dias atrás:** em 2026-08-05 a família `9e68a369`
  recebeu **3 convites em 22 segundos** (18:03:44, 18:03:54, 18:04:06).
- **Correção de fato:** o commit original atribuía o caso à "Simone". A família
  de 15 convites é `7c764314`, que este registro identifica como **Rochelle** —
  a mesma da PEND-002. Corrigido no código, nos testes e na mensagem do commit.
- **Testes:** 17, conferidos por mutação — desligar o cooldown de 12h derruba 3;
  desligar a reserva de rajada derruba outros 3. Suíte 1362 → **1379**,
  typecheck e build verdes.
- **Próximo passo:** aguardar o próximo convite legítimo em produção e comparar
  o número. O último convite foi em 2026-08-05 (~3 dias antes da publicação),
  então isto leva dias, não minutos.
- **Critério de conclusão:** publicado em `origin/main`, preview verde, e smoke
  mostrando que o segundo convite dentro da janela **não** sai. Validação em
  produção com número: convites enviados na janela, antes → depois.
- **Baixa (2026-08-08):** Implementado **OK** · Testado **OK** (17 testes, com
  mutação) · Regressão **OK** (suíte 1379) · Build **OK** · Publicado **OK**
  (`050cf87`, Production success) · Configuração **N/A** — não usa env nova ·
  **Preview funcional: OK** (PEND-003 concluída) · **Smoke: PENDENTE** ·
  **Validado em produção com número: PENDENTE**.
- **⚠️ Por que NÃO recebeu baixa** — faltam duas coisas, e as duas dependem de
  tráfego real:
  1. **smoke mostrando que o segundo convite dentro da janela não sai** — exige
     uma família sem acesso mandando duas mensagens. Não dá para fabricar sem
     WhatsApp real ou conta de QA dedicada.
  2. **número antes → depois em produção** — exige tráfego. Medição do dia da
     publicação: **0 reservas** (`assinatura_nudge_reserva`) gravadas desde o
     deploy, o esperado poucos minutos depois.
- **Infraestrutura de Preview: SATISFEITA (2026-08-08).** A cláusula "preview
  verde" estava bloqueada pela PEND-003, agora **concluída** — o Preview builda
  e abre. Decisão registrada: **não se fabrica um PR novo** só para obter outro
  check verde da mesma alteração já publicada e testada; o requisito era de
  infraestrutura, e a infraestrutura está comprovada.
- **Depende de:** ~~PEND-003~~ — resolvida em 2026-08-08.
- **Como conferir quando acontecer:** contar `ayla_messages` com
  `tipo='assinatura_nudge'` por família na janela, e conferir se existe reserva
  correspondente em `ayla_send_log` (`template_key='assinatura_nudge_reserva'`).
  Esperado: no máximo **um** convite por família a cada 12h.
- **Agente recomendado:** EXECUTAR (só a conferência, quando houver tráfego)

---

### PEND-002
**Pagamento confirmado no Stripe sem acesso na Kolo (classe Rochelle)**
Categoria: Pagamento/Acesso · Prioridade: **P1** · Estado: **AGUARDANDO VALIDAÇÃO**
Aberta em: 2026-08-08 · Origem: incidente Rochelle (2026-07-23) → Fase 0B

> Etapas 1, 2 e 3 publicadas em 2026-08-08. Não há mais código não publicado
> nesta frente — só falta evidência real. A Etapa 4 é risco registrado, não
> trabalho em curso.

- **Impacto:** família paga e continua sem acesso, sem ninguém descobrir até
  ela reclamar. Hoje o dano é **potencial, não ativo** — ver evidência.
- **Evidência (2026-08-08):**
  - Baseline de produção, leitura pura, sem Stripe e sem escrita: 163 linhas em
    `subscription_accesses` — 161 `trialing`, 2 `active`, **zero** `past_due`,
    `canceled` ou `paused`. 118 sem acesso, **todas** `trialing` vencida e
    **nenhuma** com vínculo Stripe. Só 2 linhas têm vínculo, ambas com acesso.
    **População afetada agora = 0** — por isso P1 e não P0.
  - Código conferido: a guarda de corrida em
    `apps/web/src/app/api/stripe/webhook/route.ts` só protege quem já está
    `active`; `incomplete` é traduzido para `past_due` em
    `apps/web/src/lib/stripe/status.ts`; as oito escritas do webhook não
    conferem `error`; o reconciliador em
    `apps/web/src/app/api/ayla/cron/route.ts` varre apenas `status='past_due'`.
- **Bloqueio (parcial):** sem acesso ao Stripe pelo Chrome.
  *Por quê:* confirmar a ordem exata dos eventos da família `7c764314`.
  *Onde obter:* tabela `assinaturas` no Supabase (guarda `evento`, `payload` e
  `created_at`), ou Stripe → Developers → Events.
  *Não bloqueou* nenhuma das três etapas — todas foram feitas sem esse dado.
  Segue útil só para reconstruir o timeline histórico do incidente.
- **Evidência operacional (2026-08-08, investigação do "posso vender hoje?"):**
  - existem **três eventos positivos independentes** capazes de conceder acesso
    (`checkout.session.completed`, `invoice.payment_succeeded` e
    `customer.subscription.updated` já com `active`) — redundância que **reduz
    a probabilidade** de a família ficar trancada, mas **não elimina a classe**;
  - o reconciliador roda **de hora em hora** (`vercel.json`,
    `?tipo=alerta_assinatura`, `"0 * * * *"`) e conserta sozinho quem para em
    `past_due` — mas continua **cego para família presa em `trialing`**;
  - situação operacional declarada: **pode vender com monitoramento manual de
    cada nova assinatura** (🟡), não sem ele.
- **Etapas 1 e 2 PUBLICADAS (2026-08-08):** commit `25ca617`, PR #39, merge
  `c61d540`. Deployment de **Production** do merge concluiu com **success**
  (14:28Z). Smoke sem cobrança: app responde 200, `/precos` 200, `/admin` 200 e
  `GET /api/stripe/webhook` devolve **405** — assinatura saudável de rota
  só-POST, sem criar nenhum evento no Stripe. **Nenhuma variável de ambiente
  alterada.**
- **Etapas 1 e 2 IMPLEMENTADAS (2026-08-08):**
  escritas críticas do webhook agora conferem `error` **e** linhas afetadas;
  pagamento sem família resolvível falha de forma visível em vez de retornar
  calado; `incomplete` virou evidência **neutra** e não rebaixa mais ninguém;
  `invoice.payment_failed`, dunning, graça e cancelamento real preservados e
  cobertos por teste. Suíte: 1306 → **1332** (26 testes novos), typecheck e
  build verdes.
- **Branch/commit/PR:** `fix/stripe-escrita-e-autoridade` · `25ca617` · PR #39 ·
  merge `c61d540`
- **Etapa 3 IMPLEMENTADA (2026-08-08):** o reconciliador deixa de perguntar "quem está em
  `past_due`?" e passa a perguntar "existe família que deveria ter acesso
  segundo o Stripe e a Kolo não está concedendo?". A população é **vínculo
  Stripe** (filtrado no banco) **+ sem acesso por `assinaturaLiberada`**
  (filtrado em memória) — as duas condições **antes** de qualquer chamada ao
  Stripe. Reusa `sincronizarAssinaturaDoStripe` sem duplicar lógica.
  Acrescenta: erro no SELECT da população **lança** em vez de virar
  "0 encontrados"; falha de sincronização acumula em `naoCorrigidas` com motivo
  (antes sumia num `catch {}` vazio) e gera **alerta operacional** novo, com
  trava de 12h para não virar 24 mensagens por dia. Classificação de conserto
  passou a ser "**a família tem acesso agora?**" pela fonte única, e não
  "mudou o status?" — o critério antigo contava `trialing` sobre trial vencido
  como conserto, que é falso positivo. 24 testes novos; suíte 1332 → **1356**;
  typecheck e build verdes; testes conferidos por mutação.
- **Baseline da população nova (leitura pura, 2026-08-08T15:13:20Z):** 163
  linhas · 2 com vínculo Stripe, **ambas com acesso** · 118 sem acesso, **todas
  sem vínculo** · **população candidata = 0**, ou seja **0 chamadas ao Stripe**
  por execução hoje. Antes → depois desta mudança na população varrida:
  `past_due` = 0 → divergência = 0. O ganho é de **cobertura**, não de volume.
- **Etapa 3 PUBLICADA (2026-08-08):** commit `8107a26`, PR #41, merge
  `2f3a216`. Deployment de **Production** com **success** às 15:34:34Z.
- **PULSO DE SAÚDE implementado e publicado (2026-08-08):** commit `f7f1bdd`,
  PR #43, merge `14a7696`, Production **success** às 15:55:30Z. A execução
  limpa registrava tudo em `info` e `logEvent` só persiste `warn+` — de fora,
  "rodou e estava tudo certo" era indistinguível de "não rodou". Agora
  persiste **um pulso por janela de 20h** (20h e não 24h: com cron horário, uma
  janela de 24h anda para frente e acaba pulando um dia), reusando a mesma
  trava de janela do alerta operacional, sem tabela nova e sem migração.
  Divergência e erro seguem persistindo **na hora**; o pulso não dispara
  WhatsApp. 6 testes novos, conferidos por mutação. Suíte 1356 → **1362**.
- **✅ RECONCILIAÇÃO COMPROVADA VIVA EM PRODUÇÃO (2026-08-08T16:00:11.754Z).**
  Primeira execução agendada depois do deploy, sem provocar nada e sem tocar em
  família alguma. Registro real em `eventos_app`:
  `reconciliacao_pulso` · `warn` · *"reconciliação viva — executou e não havia
  divergência"* · `com_vinculo: 2` · `candidatas: 0` · `chamadas_stripe: 0` ·
  `corrigidas: 0` · `nao_corrigidas: 0` · `verificadas_sem_acesso: 0`.
  Os números batem com o baseline lido às 15:13Z. A lógica nova está no ar,
  calculou a população e **não chamou o Stripe à toa**.
- **Próximo passo:** aguardar a **primeira assinatura real** (smoke já descrito
  abaixo). Não há mais trabalho técnico pendente nesta frente — só evidência.
- **Riscos, com destino explícito (reavaliados em 2026-08-08):**

  | # | Risco | Destino | Motivo |
  |---|---|---|---|
  | 1 | Família sem vínculo Stripe gravado é invisível à reconciliação | **MANTER NA PEND-002** | mesma causa; mitigado pela Etapa 2, que grava o vínculo mesmo em evento neutro. Resolver exige varredura Stripe→Kolo, não autorizada |
  | 2 | Trava de 12h agrupa várias famílias num alerta só | **RISCO ACEITO** | o alerta é gatilho para olhar, não relatório: a resposta do cron e o `eventos_app` listam cada família. Sem a trava, uma família travada geraria 24 mensagens/dia e o alerta seria ignorado quando importasse |
  | 3 | Recência entre evidências fortes (Etapa 4) | **MANTER NA PEND-002** | exige migração; não autorizada |
  | 4 | Concorrência entre evento positivo e negativo real | **MANTER NA PEND-002** | mesma causa do 3 — não fragmentar |
  | 5 | `invoice.payment_failed` casa por `stripe_customer_id` | **RISCO ACEITO, com medição** | leitura de 2026-08-08: 2 linhas com customer, **2 customers distintos, 0 compartilhados**. Cada família ganha o seu no checkout; compartilhar exigiria intervenção manual |
  | 6 | `registrarEvento` roda depois dos handlers, e `invoice.*` fica fora da tabela `assinaturas` | **MANTER NA PEND-002** | é a auditoria do mesmo fluxo; abrir pendência separada fragmentaria uma causa só |
  | 7 | População real = 0 | **NÃO É RISCO — é limitação de validação** | a lógica nova nunca foi exercida com dado real. Não vira pendência; vira o que falta para a baixa |
  | 8 | Webhook passa a devolver 500 onde devolvia 200 | **MANTER NA PEND-002** | efeito desejado, mas novo: reentregas do Stripe devem aparecer e precisam ser observadas |
  | 9 | Execução limpa da reconciliação não deixa rastro persistido | **RESOLVIDO** (2026-08-08, `f7f1bdd`) | pulso de saúde por janela de 20h, comprovado em produção às 16:00:11Z |

  Detalhe dos itens 3 e 4 (Etapa 4 — recência pelo relógio do Stripe; **não**
  autorizada, exige migração):
  1. **Ordem/recência entre evidências fortes** — um `subscription.updated`
     genuinamente `past_due` que chegue depois de um evento positivo ainda pode
     rebaixar quem não estiver `active` no instante da leitura. O caso neutro
     (`incomplete`, o da Rochelle) é imune por construção.
  2. **Concorrência entre evento positivo e negativo real** — os dois leem o
     estado antes de qualquer escrita; o resultado final depende de quem grava
     por último.
  3. **`invoice.payment_failed` casa por `stripe_customer_id`** — dois vínculos
     no mesmo customer rebaixariam ambos. Pré-existente.
  4. **`registrarEvento` roda depois dos handlers** — handler que estoura não
     deixa registro na auditoria. Pré-existente.
  5. **Eventos `invoice.*` nunca entram na tabela `assinaturas`** (objetos
     `Invoice` não carregam `metadata.family_account_id`) — a trilha de
     auditoria tem buraco justamente nos eventos de dinheiro.
  6. **Mudança de comportamento a observar em produção:** o webhook passa a
     devolver 500 onde antes devolvia 200, então reentregas do Stripe devem
     aparecer. É o efeito desejado, mas é novo.
  7. **A reconciliação só enxerga quem tem vínculo Stripe gravado.** Família que
     pagou e cujo `stripe_customer_id` nunca chegou ao banco continua invisível.
     Cobrir isso exige a varredura no sentido Stripe → Kolo
     (`subscriptions.list`), que **não** foi implementada. Hoje o risco é
     mitigado pela Etapa 2: o evento neutro grava o vínculo mesmo sem conceder
     acesso.
  8. **O alerta operacional tem trava de 12h.** Se uma segunda família travar
     dentro da janela, ela entra no relatório do cron e no `eventos_app`, mas
     não gera mensagem nova até a janela virar.
- **Critério de conclusão:** replay determinístico da classe verde na suíte;
  falha de persistência não termina em 2xx; dunning legítimo preservado
  (`invoice.payment_failed` continua produzindo `past_due` + carimbo + graça);
  publicado e exercido em produção.
- **Baixa (2026-08-08):** Implementado **OK** (Etapas 1, 2 e 3) · Testado **OK**
  (1356 verdes, 50 novos nesta frente) · Regressão **OK** (suíte completa) ·
  Build **OK** · Publicado **OK** — Etapas 1 e 2 em `c61d540`, Etapa 3 em
  `2f3a216`, ambas com Production success · Configuração **N/A** — nenhuma
  configuração nova · **Reconciliação exercida em produção: OK** (pulso de
  16:00:11.754Z) · **Smoke de pagamento real: PENDENTE** · **Validado em
  produção com pagamento real: PENDENTE** · **Evidência final: PENDENTE**.
  **Etapa 4 (recência entre evidências fortes) não implementada — riscos 3 e 4.**
- **A PRIMEIRA ASSINATURA REAL depois de 2026-08-08 é smoke monitorado.**
  Conferir, nesta ordem: (1) pagamento confirmado no Stripe; (2) a linha da
  família ficou `active`; (3) acesso liberado em `/admin/familias`; (4) não
  houve erro nem retry anormal; (5) evidência observável da escrita nova em
  `eventos_app` (`stripe_checkout_completed` com `resultado: ok`). Passando os
  cinco, é a primeira validação real das Etapas 1 e 2.
- **Agente recomendado:** EXECUTAR (Etapa 3)

---

### PEND-004
**Rotina/Sequência Visual — auditar o fluxo atual antes de redesenhar**
Categoria: Produto · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: decisão de produto (2026-08-08)

- **Impacto:** é a funcionalidade escolhida para validar o
  [protocolo de entrega](FEATURE-DELIVERY-PROTOCOL.md); redesenhar antes de
  auditar repetiria o erro que o protocolo existe para evitar.
- **Evidência (2026-08-08):** existe auditoria anterior do fluxo em
  `docs/auditoria-experiencia-rotina-2026-08-03.md` (214 linhas, de 2026-08-03)
  e correções posteriores em `docs/correcao-rotina-manu-2026-08-03.md`. **O
  conteúdo desses laudos não foi conferido contra o código atual nesta sessão**
  — pode haver achado já resolvido.
- **DESEJADO — parcialmente definido.** Já decidido, não se rediscute:
  a mãe **não precisa conhecer a funcionalidade** · a Ayla identifica a
  necessidade pela conversa · também reconhece menção direta (rotina visual,
  sequência, cartões) · identifica a criança pelo contexto e **só confirma se
  houver dúvida real** · perguntas necessárias, de preferência agrupadas · gera
  a sequência · gera imagens/cartões · permite **imprimir o PDF logo após
  gerar** · experiência clara no app · salvar e reencontrar · editar e reutilizar
  · feedback da mãe sobre qualidade e utilidade.
- **DESEJADO — A DEFINIR COM PRODUTO:** o que a Ayla precisa saber da criança
  para a sequência ser dela e não genérica (é onde PEND-018 entra) · o que
  acontece quando a mãe pede uma segunda rotina para o mesmo momento · como a
  rotina aparece de novo dias depois.
- **Depende de:** PEND-016, PEND-017 e PEND-018 para a parte de inteligência;
  PEND-023 para o feedback. A execução técnica não começa antes do DESEJADO
  desses blocos.
- **Admin:** ADMIN PRECISA DE AJUSTE — visualizar rotinas geradas por família.
- **Próximo passo:** completar o DESEJADO com a Karina; só então a missão
  INVESTIGAR do fluxo atual, começando por conferir o laudo de 2026-08-03
  contra o código de hoje.
- **Critério de conclusão:** SPEC da Rotina Visual em `docs/specs/` com os oito
  portões respondidos e o corpus de disparo preenchido. Implementação é frente
  seguinte, não faz parte desta baixa.
- **Depende de:** nada. Não bloqueia nada.
- **Agente recomendado:** INVESTIGAR → PROPOR

---

### PEND-005
**`MEMORY.md` do agente perto do limite de leitura**
Categoria: Documentação · Tags: `memoria` · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: aviso automático do ferramental (2026-08-08)

- **Impacto:** passando do limite, o índice de memória deixa de ser lido
  inteiro e o agente perde contexto sem aviso.
- **Evidência (2026-08-08):** `MEMORY.md` com **21.149 bytes**; limite de
  leitura 24,4 KB; alvo recomendado pelo ferramental < 17,1 KB.
- **Próximo passo:** compactar o índice — uma linha por memória, detalhe no
  arquivo de tópico, fundir ou remover entradas vencidas.
- **Critério de conclusão:** `MEMORY.md` abaixo de 17 KB sem perda de ponteiro
  para nenhuma memória existente.
- **Nota:** arquivo fora do repositório (vive no diretório de memória do
  agente). A pendência é registrada aqui porque o estado oficial mora aqui.
- **Agente recomendado:** EXECUTAR

---

### PEND-006
**Dois arquivos não rastreados em `apps/web/src/lib/conducao/`**
Categoria: Ayla/IA · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: `git status` recorrente

- **Impacto:** baixo hoje; mas qualquer `git add -A` distraído os leva para o
  commit errado — já aconteceu neste repositório (§6 do protocolo de
  engenharia).
- **Evidência (2026-08-08):** `apps/web/src/lib/conducao/catalogo.ts` e
  `apps/web/src/lib/conducao/deteccao-catalogo.ts`, não rastreados, presentes
  em todas as branches desta semana. **Conteúdo não lido** — pertencem a outra
  frente.
- **Próximo passo:** identificar a frente dona e decidir: commitar lá ou
  descartar.
- **Critério de conclusão:** working tree limpo **sem perder trabalho de
  ninguém**.
  ⚠️ "Resolver apagando" é FALHA, não conclusão.
- **Agente recomendado:** INVESTIGAR

---

### PEND-007
**Ativação do GPT parada na prova da chave de produção**
Categoria: Ayla/IA · Prioridade: **P1** · Estado: **ABERTA** 🔒
Aberta em: 2026-08-08 · Origem: `docs/pendencias-2026-08-06.md` item 20

- **Impacto:** a decisão de produto de 2026-08-06 é que a OpenAI é o provider
  oficial da camada conversacional. Enquanto a chave não for provada em
  produção, a migração fica pronta e desligada — trabalho feito que não chega
  a ninguém.
- **Evidência (2026-08-08):** o laudo de 2026-08-06 marca este item como o
  **único bloqueador de ativação**. Conferido no repositório: a rota
  `apps/web/src/app/api/admin/provider-check/route.ts` existe (com teste), e
  `IA_PROVIDER` ausente mantém o Claude — que é o estado atual de produção.
  **Não conferido:** se a rota já está publicada e qual o resultado da prova.
- **Bloqueio:** a prova roda dentro de produção.
  *Por quê:* a chave `sk-proj-*` de produção nunca foi exercida; só a local.
  *Onde obter:* `GET /api/admin/provider-check?p=openai` depois do deploy.
  *Destrava:* Sérgio (deploy + execução).
- **Próximo passo:** publicar e rodar a prova. Se falhar: **parar**, não mexer
  em `IA_PROVIDER`.
- **Critério de conclusão:** `provider-check` retornando `ok: true` em
  produção, `IA_PROVIDER=openai` aplicado e smoke no ambiente real com conta de
  teste. Rollback: remover a variável.
- **Absorve os resíduos da migração (laudo 06/08), sem virar pendência
  separada:** cache não modelado na PRICE_TABLE, o que subestima o Claude e
  superestima o GPT (#19) · `OPENAI_MODEL_LEVE` sem evidência para escolher
  (#21) · Grupo D — quais dos 28 auxiliares não deveriam usar LLM (#22).
  Nenhum deles bloqueia a ativação.
- **Admin:** ADMIN JÁ SUPORTA — a rota `provider-check` é a tela da prova.
- **Depende de:** nada neste arquivo.
- **Agente recomendado:** EXECUTAR (com Sérgio no ambiente)

---

### PEND-009
**Primeira conversa da Ayla — spec registrada, nunca construída**
Categoria: Ayla/IA · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: `docs/pendencia-primeira-conversa-ayla.md`
(registrada em 2026-08-04)

- **Impacto:** o primeiro contato é onde a família decide se isto serve para
  ela; hoje ele não usa o que o onboarding já sabe.
- **Evidência (2026-08-08):** o documento existe (110 linhas) e está declarado
  como **não construído**. **Não conferido nesta sessão** se algum trabalho
  posterior implementou parte do desenho.
- **Consolidada no bloco A (2026-08-08):** o DESEJADO desta primeira conversa
  entra no DESEJADO da PEND-016 — é a mesma decisão de condução, e desenhar as
  duas separadas produziria duas Aylas. A ficha continua aberta como escopo
  próprio, mas não se investiga sozinha.
- **Depende de:** PEND-016.
- **Admin:** ADMIN SEM IMPACTO.
- **Próximo passo:** entra no DESEJADO da PEND-016; depois, conferir o desenho
  contra o código atual.
- **Critério de conclusão:** SPEC em `docs/specs/` com os portões respondidos,
  **ou** cancelamento com motivo escrito.
- **Agente recomendado:** INVESTIGAR → PROPOR

---

### PEND-011
**README aponta para três documentos que não existem no repositório**
Categoria: Documentação · Prioridade: **P3** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: conferência de links na missão de governança

- **Impacto:** quem chega (pessoa ou agente) procura o PRD e o Roadmap e não
  encontra; o README perde confiabilidade como porta de entrada.
- **Evidência (2026-08-08):** `README.md` linhas 10–12 apontam para
  `docs/PRD_Kolo_Familia_v3.1.md`, `docs/Roadmap_Implantacao_v2.md` e
  `docs/Explicacao_Funcionalidades.md`. Os três **não existem** no repositório,
  **não estão no `.gitignore`** e **nunca foram commitados**
  (`git log -- <arquivo>` vazio).
- **Próximo passo:** decidir — restaurar os arquivos (se existirem fora do
  repositório) ou corrigir os links.
- **Critério de conclusão:** todo link do README resolve.
- **Agente recomendado:** EXECUTAR

---

### PEND-012
**RUNBOOK — documento operacional de como operar a Kolo com segurança**
Categoria: Documentação · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: decisão de governança (2026-08-08)

- **Impacto:** o conhecimento mais perigoso do projeto — o que **não** se pode
  fazer em produção — hoje não está versionado. Ele vive em memória de agente
  (que esta própria semana provou envelhecer) e espalhado por documentos de
  uma frente só. Quem não souber, descobre errando: já houve redeploy que zerou
  o banco, e a recuperação dependeu de backup externo.
- **Evidência (2026-08-08):** existe procedimento escrito para **um** caso —
  `docs/migracoes-chrome-prompt.md` (aplicar migração pelo Supabase Studio),
  citado no README. Não há documento equivalente para deploy, rollback,
  variáveis, crons ou smoke. **Não levantado** o que já existe espalhado em
  outros documentos.
- **Próximo passo:** levantar o que hoje só existe em memória de agente e em
  conversa, e decidir o escopo mínimo do documento.
- **Escopo pretendido, quando for escrito:** produção · Vercel · Supabase ·
  EasyPanel · Hostinger · Stripe · variáveis e segredos · migrações · crons ·
  deploy · rollback · smoke · procedimentos operacionais.
- **Critério de conclusão:** existe `docs/RUNBOOK.md` cobrindo, para cada item
  do escopo acima que se aplicar: **como fazer**, **como desfazer** e **o que
  nunca fazer**. Cada procedimento perigoso com o aviso na frente. Um
  procedimento crítico exercido de ponta a ponta seguindo o texto — documento
  operacional que ninguém testou não é procedimento, é intenção. Item que não
  se aplicar recebe N/A com motivo.
  ⚠️ **Nenhum segredo no documento** (§16 do protocolo de engenharia): nomes de
  variáveis sim, valores nunca.
- **Nota:** a criação **não está autorizada** — esta ficha registra a decisão
  de fazer depois, não a permissão de fazer agora.
- **Agente recomendado:** PROPOR

---

### PEND-013
**Mapa do sistema — onde vivem os principais componentes**
Categoria: Documentação · Prioridade: **P3** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: decisão de governança (2026-08-08)

- **Impacto:** o §1 do protocolo de engenharia manda mapear o fluxo real antes
  de alterar, e não dá nenhum ponto de partida. Cada missão redescobre a mesma
  arquitetura — custo repetido, e risco de implementação paralela que o §4
  tenta impedir.
- **Evidência (2026-08-08):** não existe documento com essa função no
  repositório. O README descreve a stack e a árvore de pastas, não os fluxos.
- **Próximo passo:** listar quais fluxos merecem ponteiro, sem escrever o
  documento.
- **Escopo pretendido, quando for escrito:** Ayla · WhatsApp · Web/App · Admin ·
  autenticação · famílias e crianças · memória · artefatos · pagamento e
  acesso · Stripe · Supabase · providers de IA · jobs e crons ·
  observabilidade · principais arquivos e pastas.
- **Critério de conclusão:** existe `docs/MAPA-DO-SISTEMA.md` em que cada item
  do escopo tem **uma linha com o arquivo de entrada** — onde começa e quem
  decide. Todo caminho citado resolve, conferido por script. Teste prático: um
  agente sem contexto acha o dono de um fluxo qualquer sem varrer o
  repositório.
  ⚠️ **Só ponteiros, nunca prosa explicativa.** Prosa apodrece em silêncio;
  ponteiro quebra de forma visível — e é isso que o mantém honesto.
- **Nota:** a criação **não está autorizada** — ficha de decisão, não de
  permissão.
- **Depende de:** nada. Não bloqueia nada.
- **Agente recomendado:** PROPOR

---

### PEND-014
**Revisar o AI-ENGINEERING-PROTOCOL com o aprendizado das primeiras missões reais**
Categoria: Documentação · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: reflexão de processo ao fim das missões da
PEND-002 (Etapas 1, 2 e 3), 2026-08-08

- **Impacto:** o protocolo trata uma correção de acesso a pagamento e um ajuste
  de texto com o mesmo peso. Isso empurra para dois lados ruins ao mesmo tempo:
  cerimônia demais no pequeno, e leitura de menos no grande — porque um
  documento que cobra tudo de todos passa a ser consultado só quando alguém
  cobra.
- **Evidência:** as missões da PEND-002 rodaram o ciclo completo três vezes.
  Cada item abaixo veio de um custo ou de um erro observado, não de teoria.
- **Itens a decidir** (nada implementado):
  1. **Níveis de risco para correção**, como já existe para funcionalidade —
     evitando ciclo completo em mudança pequena;
  2. **manter o ciclo completo** para dinheiro, acesso, dado de criança,
     segurança e integração crítica;
  3. **fundir o relatório final (§20) e os portões (§21)**, que hoje cobrem o
     mesmo terreno duas vezes;
  4. **exigir "teste que morde"**: demonstrar que ao menos um teste relevante
     falha quando a correção é revertida ou sabotada. Nesta frente isso foi
     feito por iniciativa própria e pegou o que teste verde não pega;
  5. **antes de investigar produção, confirmar que o código analisado é o que
     está publicado** — nesta semana a análise correu horas antes de alguém
     verificar que produção estava deployando;
  6. **não tratar métrica ou timestamp de integração externa como medida** sem
     entender como é produzida — usei tempo de deployment como evidência e era
     artefato de quando a Vercel cria o registro;
  7. **todo risco identificado recebe destino explícito** (resolvido · manter ·
     nova pendência · aceito · descartado), nunca só uma linha no relatório;
  8. **manter o `AGENTS.md` curto e operacional** e o protocolo grande como
     referência — o que é seguido sozinho é o que cabe numa tela.
  9. **perguntar também: "quando a correção FUNCIONAR em silêncio, que
     evidência fica?"** O §11 pergunta se descobrimos a falha; ninguém pergunta
     se conseguimos ver o conserto funcionando. A Etapa 3 nasceu invisível
     exatamente por isso, e precisou de uma correção só para poder ser
     validada;
  10. **diferenciar "reduzir ruído" de "eliminar sinal"** — escolher `info`
      para não poluir produziu um sistema mudo. O padrão que resolve os dois já
      existia no repositório: janela de deduplicação (heartbeat);
  11. **portão cuja prova depende de acesso ou capacidade externa precisa de
      plano B declarado** — a prova de execução em produção esbarrou num
      bloqueio de sandbox que só apareceu na hora;
  12. **antes de discutir um risco, verificar se ele é mensurável agora** — o
      risco do `stripe_customer_id` compartilhado andou três missões como
      hipótese e uma leitura de dez segundos o resolveu;
  13. **validar pode revelar que falta instrumentação para provar que a
      correção funciona.** Isso é parte natural do ciclo, não retrabalho: a
      missão que ia validar a Etapa 3 virou a missão que a tornou verificável.
      O protocolo deve prever esse desvio em vez de tratá-lo como falha;
  14. **teste antigo que quebra porque o comportamento mudou de propósito se
      revisa, não se apaga.** Reescrever a *asserção* preservando a *intenção*:
      "sem ruído" deixou de ser "nada persiste" e virou "só o pulso persiste".
      Apagar teria removido a única guarda contra o pulso virar spam;
  15. **patch que aplica sem conflito de git não está semanticamente
      revalidado.** O git diz "aplica limpo" em segundos; o que importa é
      conferir as premissas que o patch assume sobre código **fora do próprio
      diff**. Pergunta fixa: *"em que este patch acredita que não está nele?"*;
  16. **trabalho ainda não publicado é a melhor hora para corrigir fato
      histórico e comentário errado**, antes que virem referência permanente —
      depois de publicado, mexer em mensagem de commit é caro e arriscado;
  17. **configuração crítica ausente deve falhar FECHADA.** Regra candidata:
      *"autenticação/autorização crítica não deve depender de secret opcional
      de forma fail-open; ausência de configuração obrigatória deve falhar
      fechada."*
      Origem: `if (expectedSecret) { ... }` nos crons
      (`api/ayla/cron/route.ts` e `api/cron/exclusao-pagamento/route.ts`) — se a
      variável sumir, a proteção some junto, em silêncio.
      **Estado de fato, medido em 2026-08-08:** `CRON_SECRET` **existe** em
      Production **e** em Preview (desde 09/05), e a Vercel só dispara cron
      contra Production — portanto **não há exposição ativa hoje**. A premissa
      anterior ("ausente no Preview") era inferência minha a partir do código e
      **estava errada**. O que sobrevive é a fragilidade arquitetural, não um
      incidente. Não corrigir o código nesta fase; quando o RUNBOOK
      ([[PEND-012]]) existir, a mesma regra vira entrada operacional
      ("não remover `CRON_SECRET`").
  22. **pendência de produto/experiência precisa do comportamento desejado
      suficientemente definido ANTES da investigação técnica profunda.** A
      investigação compara **ATUAL × DESEJADO** e aponta lacunas e dependências
      — ela não inventa o produto. Ficha de produto sem DESEJADO não vai para
      execução;
  23. **além de prioridade, toda frente relevante declara dependências e o que
      compartilha com outras** (cérebro, memória, recuperação, decisão). Sem
      isso, duas frentes implementam a mesma inteligência em paralelo e a
      terceira herda as duas;
  19. **teste que cruza duas fontes que deveriam concordar acha o que teste de
      número fixo não acha.** O caso `trialing` sem data não estava em laudo
      nenhum: apareceu porque uma asserção comparava a contagem do funil com a
      regra de acesso, em vez de conferir um número esperado;
  20. **quando a causa continua produzindo o dado errado, corrigir a leitura
      vence corrigir o dado.** O UPDATE em lote no `status` era mais rápido e
      teria parecido resolvido — até o próximo trial vencer;
  21. **o limite do escopo se decide por quem sofre o efeito, não pela causa
      técnica.** Mesma raiz (`status` cru) em dois lugares: na contagem eu
      corrigi sozinho, na segmentação de campanha eu parei — um muda um número
      na tela, o outro muda quem recebe mensagem em casa;
  18. **medir o estado do ambiente NO ambiente**, não inferir do código-fonte —
      já registrado no item 5, e agora com **três ocorrências na mesma semana**
      (o "0–1 segundo" da Vercel; o `CRON_SECRET` supostamente ausente; as
      variáveis de Preview). Pela regra deste registro, três repetições é o
      sinal de que virou padrão: **candidato forte a regra permanente**, não
      mais a observação.
- **Próximo passo:** decidir item a item o que entra, com você.
- **Critério de conclusão:** `AI-ENGINEERING-PROTOCOL.md` alterado com as
  decisões aprovadas, ou cada item recusado registrado com motivo. Nenhum item
  fica sem destino.
- **Não bloqueia a PEND-002.**
- **Agente recomendado:** PROPOR

---

### PEND-015
**Revisar exposição e governança de secrets no Easypanel**
Categoria: Segurança · Prioridade: **a definir após investigação de risco** ·
Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: achado fora de escopo durante a correção da
PEND-003 (2026-08-08), reportado em vez de tratado

- **Evidência observada:** o painel Easypanel **autenticado** apresenta, em
  texto legível e sem máscara, variáveis sensíveis do Supabase self-hosted —
  categorias: **service role · senha do Postgres · JWT secret · senha de
  dashboard · secret key base · chave de vault**. Difere da Vercel, que oculta
  valores marcados como *Sensitive*.
  ⚠️ **Nenhum valor foi copiado para esta documentação, e nada foi alterado.**
- **Por que a prioridade não está definida:** o raio de alcance é grande — a
  service role bypassa RLS, ou seja, alcança dado de saúde e comportamento de
  criança de todas as famílias — mas não há evidência de exposição fora do
  painel autenticado. Severidade sem as respostas abaixo seria chute, e a régua
  deste arquivo é que prioridade se mede.
- **A investigação precisa responder, antes de classificar:**
  1. quem consegue acessar o painel hoje;
  2. que autenticação/MFA existe;
  3. há histórico ou auditoria de acesso;
  4. os valores podem ser mascarados;
  5. podem ser movidos para secret store ou mecanismo mais seguro;
  6. quais serviços dependem de cada secret;
  7. impacto de comprometimento por categoria;
  8. quais realmente precisariam de rotação;
  9. como rotacionar sem derrubar produção;
  10. há backup e caminho de recuperação;
  11. existe exposição além do painel autenticado.
- **Proibido nesta fase:** rotacionar qualquer segredo, alterar o Easypanel,
  copiar valores para documento, ticket ou log.
- **Critério de conclusão:** as 11 perguntas respondidas com evidência, uma
  prioridade atribuída com justificativa, e uma decisão registrada para cada
  categoria de secret (mascarar · mover · rotacionar · aceitar).
- **Agente recomendado:** INVESTIGAR

---

### PEND-016
**Condução da Ayla — o que ela diz, e por quê**
Bloco: **A · Condução** · Prioridade: **P1** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: consolidação da PEND-010 (itens 3, 4, 12, 13, 15
do laudo de 06/08) + `docs/auditoria-ayla-prompt.md`

- **Impacto:** é o produto. Tudo que a família recebe passa por aqui — se a
  condução pergunta demais, responde raso ou erra um fato da criança, nenhuma
  entrega adiante salva a conversa.
### DESEJADO — em construção com produto (sessão de 2026-08-08)

> **Experiência desejada, que rege todas as decisões deste bloco:** a pessoa
> sente que a Ayla **ouviu o conjunto, organizou o caos e sabe por onde
> começar** — sem tirar dela o controle.

**D1 · Vários problemas ao mesmo tempo (APROVADA 2026-08-08).**
São **dois passos separados**, não uma hierarquia só. Misturá-los faz um
compromisso de amanhã sequestrar uma conversa que precisa tratar o hoje.

1. **PRESERVAÇÃO — o que não pode se perder.**
   *Risco* (segurança da criança ou da mãe, crise aguda) e *compromissos com
   hora marcada* (consulta, reunião na escola). **Preservar não é virar foco:**
   risco que exige ação imediata assume a conversa; risco sem ação imediata e
   compromisso futuro são **nomeados e guardados em voz alta** — *"a consulta de
   amanhã eu não vou deixar passar"* —, para a mãe não ficar com medo de que se
   perderam.
   ⚠️ O que conta como risco e o que se faz com ele é **dependência da
   PEND-022** — não definido aqui.
2. **FOCO DA CONVERSA AGORA.** Não havendo risco que exija ação imediata, o foco
   é a **raiz provável**: o problema cuja melhora alivia os outros (sono, dor,
   fome e sobrecarga sensorial quase sempre estão embaixo de "comportamento").
   Empate desfaz-se pelo **alívio mais rápido** — o que pode melhorar em 24–48h.
   Confiança se constrói com uma coisa que funcionou, não com o plano mais
   completo.

**Forma (a parte que impede isso de virar interrogatório):**
- **a Ayla escolhe e assume a escolha** — não devolve a priorização para quem
  está em sobrecarga (*"por qual você quer começar?"* cobra uma decisão cara e
  gasta um turno antes da primeira ajuda);
- **o porquê cabe em uma linha.** Se precisa de parágrafo, a escolha está fraca;
- **trocar custa uma palavra** — *"me diz numa palavra que eu troco"*: a mãe
  mantém o controle sem pagar um turno por isso;
- **devolver o conjunto organizado, agrupando em até três frentes sempre que
  possível.** Não é regra rígida: a intenção é **não reproduzir o caos**, e nada
  importante que a pessoa trouxe pode ser omitido — em especial compromisso
  futuro.

**Decisões seguintes deste bloco, ainda a definir com produto:**
  1. ~~como a Ayla escolhe **um** foco quando a mãe traz três problemas;~~
     **decidido em D1**;
  2. quantas perguntas são aceitáveis antes de entregar algo de valor;
  3. o que é "direção prática" — o que fazer, o que falar, que atividade;
  4. quando ela muda de estratégia porque a anterior não funcionou, e como sabe;
  5. o que muda entre WhatsApp e Web (ritmo, tamanho, o que só existe num canal);
  6. como retoma contexto de dias atrás sem repetir pergunta já respondida.
- **Já existe, não recomeçar do zero:** `lib/conducao/diretrizes.ts`
  (`nucleoConducao`, fonte única dos 2 canais) · `docs/auditoria-ayla-prompt.md`
  · decisor de entrega e fechador já no ar.
- **Achados herdados, com estado do laudo (06/08), NÃO reconferidos:** idade
  calculada pelo modelo em vez do dado (#3) · ambiguidade estrutural resolvida
  em silêncio (#4) · `atribuicao_distribuida` é o código mais ruidoso do
  detector (#12) · fala sobre sono ainda dispara medicação (#13) · respostas da
  web 40% mais longas sem o teto de 120 palavras (#15).
- **Depende de:** PEND-017 e PEND-018 — **desenhar junto**. Absorve PEND-009
  (primeira conversa) dentro do DESEJADO.
- **Admin:** ADMIN PRECISA DE AJUSTE — hoje não dá para ver *por que* a Ayla
  disse o que disse (decisão, contexto recuperado, conteúdo usado).
  **Nasceu da D1:** registrar **qual foco ela escolheu, com que critério, e o
  que foi preservado** — sem isso não há como revisar uma condução ruim depois.
- **Critério de conclusão:** DESEJADO preenchido e aprovado; investigação
  ATUAL × DESEJADO concluída com lacunas nomeadas. Execução é frente seguinte.
- **Agente recomendado:** PROPOR (depois do DESEJADO)

---

### PEND-017
**Conhecimento: o que existe, o que é recuperado, o que chega ao modelo**
Bloco: **B · Conhecimento** · Prioridade: **P1** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: consolidação da PEND-010 +
`docs/cowork-frente-1-skills.md`, `docs/cowork-frente-2-boas-praticas.md`,
`docs/frente-import-documentos.md`

- **Impacto:** a Ayla responder por conhecimento genérico existindo material
  melhor no acervo é o desperdício mais caro da Kolo — paga-se para escrever
  conteúdo que não chega à família.
- **DESEJADO — A DEFINIR COM PRODUTO** (parte de curadoria):
  1. o que entra no acervo (livro, guia, artigo, conteúdo próprio), com autoria,
     versão e data;
  2. quem aprova, e o que acontece com conteúdo antigo, duplicado ou conflitante;
  3. quando a Ayla **deve** citar a fonte para a mãe.
- **A investigar (ATUAL), quando o DESEJADO fechar:** o que existe · como está
  indexado · como é recuperado · o que é injetado · **o que efetivamente chega
  ao modelo** · o que é usado na resposta. São camadas diferentes que falham por
  motivos diferentes (§15 do protocolo de engenharia).
- **Estado conhecido, não reconferido:** parte do acervo estaria inalcançável
  por skills inativas, e o WhatsApp não leria boas práticas. A **BIA**
  (biblioteca) existe **fora da `main`**: conferido em 2026-08-08 — **zero
  arquivos de BIA em `origin/main`**, só no branch `bia/ciclo-tecnico`, com
  migrações nunca aplicadas.
- **Inclui o pipeline de Admin** (upload → extração → classificação → proposta
  da IA → revisão humana → aprovação → disponível para a Ayla), já desenhado em
  `docs/frente-import-documentos.md`.
- **Depende de:** desenhar junto com PEND-016 e PEND-018.
- **Admin:** ADMIN PRECISA DE AJUSTE — administrar acervo, e ver o que foi
  recuperado e o que foi usado.
- **Critério de conclusão:** DESEJADO da curadoria aprovado; auditoria das seis
  camadas com números; decisão sobre a BIA (entra na `main` ou é descartada).
- **Agente recomendado:** PROPOR (curadoria) → AUDITAR (camadas)

---

### PEND-018
**Memória e retrato da criança**
Bloco: **C · Memória** · Prioridade: **P1** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: consolidação da PEND-010 +
`docs/perfil-vivo-fatos-versionados.md`

- **Impacto:** é o que faz a orientação ser *daquela* criança. Sem separar fato,
  relato de terceiro e inferência da IA, tudo vira "a Kolo disse" — e um
  relatório para escola ou médico não pode nascer assim.
- **Separação conceitual que precisa existir, e hoje não tem clareza:**
  1. **base de conhecimento da Kolo** (geral, serve a muitas crianças);
  2. **memória da criança** (o que a família contou);
  3. **evidência externa** (professora, terapeuta, laudo — com autor e data);
  4. **histórico de intervenção e resultado** (o que foi tentado, o que funcionou).
- **DESEJADO — A DEFINIR COM PRODUTO:**
  1. como entra informação de professora/escola/terapeuta: origem, autor, data,
     período observado, criança, tipo;
  2. como a tela e a Ayla distinguem "a professora relatou" de "a Ayla inferiu";
  3. o que acontece quando duas informações se contradizem.
- **Já desenhado, não recomeçar:** `docs/perfil-vivo-fatos-versionados.md`
  (fatos datados + proveniência + visão derivada) — decidido e **não construído**.
- **Requisito herdado de PEND-016 · D1 (2026-08-08):** para escolher a **raiz
  provável**, a Ayla precisa saber o que **já foi tentado** e o que já se sabe
  de sono, dor, alimentação e sensorial daquela criança. Sem isso na memória, o
  critério de foco vira chute.
- **Depende de:** desenhar junto com PEND-016 e PEND-017. **Bloqueia** PEND-020.
- **Admin:** ADMIN PRECISA DE AJUSTE — ver o retrato da criança e a procedência
  de cada informação.
- **Critério de conclusão:** DESEJADO aprovado; modelo de dados decidido (o de
  `perfil-vivo-fatos-versionados` confirmado ou substituído).
- **Agente recomendado:** PROPOR

---

### PEND-019
**Estratégias que a família consegue usar**
Bloco: **D · Entregas** · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: consolidação da PEND-010 (itens 5 e 6) +
`docs/plano-estrategias-ayla.md`

- **Impacto:** é a entrega que a mãe leva para o dia. Plano genérico gasta a
  confiança dela sem devolver nada.
- **DESEJADO — A DEFINIR COM PRODUTO:** como a Ayla escolhe a intervenção; o que
  precisa usar da criança (interesses, sensibilidades, idade, histórico); o que
  é "direção concreta"; e se/como acompanha o resultado.
- **Achados herdados (laudo 06/08, não reconferidos):** planos nasceram de "Sim"
  e "Cadê?" — 3 planos sem pedido (#5) · `tema` corrompido com andaime de prompt
  virando título de PDF na casa da família (#6). Registrado também: planos
  saindo **sem seção prática** por falha silenciosa em chamadas paralelas.
- **Requisito herdado de PEND-016 · D1 (2026-08-08):** o foco escolhido na
  conversa é o que define qual estratégia é entregue — a entrega não escolhe o
  próprio tema.
- **Depende de:** PEND-016 (escolha) + PEND-017 (repertório) + PEND-018
  (criança). Não começa antes do DESEJADO de A/B/C.
- **Admin:** ADMIN PRECISA DE AJUSTE — ver estratégias entregues e o que foi
  usado para montá-las.
- **Critério de conclusão:** DESEJADO aprovado e investigação ATUAL × DESEJADO
  concluída.
- **Agente recomendado:** PROPOR (depois de A/B/C)

---

### PEND-020
**Relatórios para escola, terapeuta e médico**
Bloco: **D · Entregas** · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: consolidação da PEND-010

- **Impacto:** é o documento que sai da Kolo e entra numa reunião de escola ou
  num consultório. Errar procedência aqui custa mais que errar em qualquer tela.
- **DESEJADO — A DEFINIR COM PRODUTO:** que dados entram e de que período; como
  o documento **separa fato, relato externo e inferência da IA**; o que a mãe
  edita; como se guarda e se compartilha.
- **Depende de:** **PEND-018** — sem proveniência na memória, o relatório não
  tem como marcar o que é de quem.
- **Admin:** ADMIN PRECISA DE AJUSTE — ver relatórios gerados.
- **Critério de conclusão:** DESEJADO aprovado; dependência de PEND-018
  resolvida ou explicitamente contornada.
- **Agente recomendado:** PROPOR (depois de PEND-018)

---

### PEND-021
**Jornada dos 7 dias de teste e conversão**
Bloco: **G · Comercial** · Prioridade: **P1** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: consolidação da PEND-010 (itens 23, 24, 25) +
`docs/plano-trial-encantamento.md`

- **Impacto:** é a frente comercial. Medido em 2026-08-08: **42 famílias em
  teste válido e 121 que já saíram dele**. A conversão acontece ou não acontece
  aqui.
- **DESEJADO — A DEFINIR COM PRODUTO.** ⚠️ Explicitamente **não** é "desenhar
  sete mensagens fixas": a jornada deve orquestrar as melhores experiências da
  Kolo conforme aquela família. Decisões necessárias:
  1. o que caracteriza valor entregue no dia 1, e como isso muda por família;
  2. como a Ayla apresenta uma funcionalidade no momento em que ela serve;
  3. o que acontece no aviso de término, na retrospectiva e no convite;
  4. o que muda depois de assinar — e depois de **não** assinar.
- **Estado conhecido:** não existe jornada por dia (só gatilhos por estado);
  quem se engaja recebe **menos** proativa; a celebração é inalcançável.
- **Depende de:** nada de A/B/C para começar o desenho — **pode andar em
  paralelo**. Liga-se a PEND-001 e PEND-002, já publicadas.
- **Admin:** ADMIN PRECISA DE AJUSTE — acompanhar a jornada e a conversão por
  família. O funil já separa "em teste × trial vencido" (PEND-008, concluída).
- **Critério de conclusão:** DESEJADO aprovado; investigação ATUAL × DESEJADO
  com o número de conversão de antes.
- **Agente recomendado:** PROPOR

---

### PEND-022
**Fontes confiáveis, limites e escalonamento para humano**
Bloco: **F · Limites** · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: consolidação da PEND-010

- **Impacto:** saúde, diagnóstico, medicação, direito escolar e laudo são temas
  em que uma frase com falsa certeza faz estrago real na vida de uma família.
- **DESEJADO — A DEFINIR COM PRODUTO:** o que a Ayla pode e não pode afirmar em
  cada tema; quando busca fonte externa; quando cita e como apresenta
  (procedência, data, versão); o que ela diz quando **não** há fonte confiável;
  quando recomenda profissional; **quando escala para humano**.
- **Estado conhecido:** os freios de tom estão no ar (não afirmar direito ou
  saúde com falsa certeza). O **escalonamento para humano não existe**: a Ayla
  desvia assunto de cupom/preço/cancelamento e ninguém é notificado.
- **Requisito herdado de PEND-016 · D1 (2026-08-08):** o passo de
  **preservação** depende desta ficha para saber **o que conta como risco** e o
  que a Ayla faz quando o identifica. Enquanto não estiver definido, a condução
  trata risco como "assume a conversa" sem política escrita.
- **Depende de:** aplica-se a PEND-016 — desenhar junto, implementar depois.
- **Admin:** ADMIN PRECISA DE AJUSTE — receber e tratar escalonamento.
- **Critério de conclusão:** DESEJADO aprovado, com a lista do que nunca se
  afirma e o caminho de escalonamento definido.
- **Agente recomendado:** PROPOR

---

### PEND-023
**Feedback da família e aprendizado**
Bloco: **E · Feedback** · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: consolidação da PEND-010

- **Impacto:** sem isto, a Ayla recomenda amanhã a mesma coisa que não funcionou
  ontem — e a família percebe antes da gente.
- **DESEJADO — A DEFINIR COM PRODUTO:** onde a mãe diz "ajudou / não ajudou /
  funcionou / quero ajustar"; e — o ponto que não pode ser esquecido — **como
  isso vira histórico da intervenção e muda a próxima recomendação para aquela
  criança**. Não é pesquisa de satisfação.
- **Depende de:** PEND-019 e PEND-004 (precisa existir entrega para avaliar).
  **Alimenta** PEND-016 e PEND-018.
- **Admin:** ADMIN PRECISA DE AJUSTE — consultar feedback por família e por tipo
  de entrega.
- **Critério de conclusão:** DESEJADO aprovado, incluindo o caminho de volta
  para a memória da criança.
- **Agente recomendado:** PROPOR (depois de D)

---

## Como usar este arquivo

### Estados

**ABERTA** → **EM INVESTIGAÇÃO** → **PRONTA PARA EXECUTAR** → **EM EXECUÇÃO** →
**AGUARDANDO VALIDAÇÃO** → **CONCLUÍDA**. Fora da linha: **CANCELADA** (com o
motivo — é registro de decisão, não apagamento).

**Bloqueio é campo, não estado.** Uma pendência bloqueada continua no estado em
que estava; some o bloqueio, ela continua de onde parou. O campo tem sempre
quatro partes: *o que falta · por que é necessário · onde obter · quem
destrava*. Bloqueio parado há mais de duas semanas sobe para o topo do painel,
independente da prioridade.

### Prioridades

| | Critério | Régua |
|---|---|---|
| **P0** | família perde acesso, perde dado, recebe dado de outra criança, ou é cobrada errado | largar o que estiver fazendo |
| **P1** | funcionalidade central quebrada ou degradada em silêncio, ou que nos cega | próxima frente |
| **P2** | funciona, com furo conhecido ou dívida que vai cobrar juros | entra na fila |
| **P3** | melhoria, polimento, oportunidade | quando sobrar |

Prioridade é **independente de estado** (P0 bloqueada é normal, e é o que mais
importa no painel) e é **reavaliada, não herdada** — reflete o impacto de hoje,
de preferência com número medido. P3 parada há 90 dias vira CANCELADA com
motivo, ou sobe de prioridade.

### Categorias e tags

Uma categoria: Produto · Ayla/IA · WhatsApp · Web · Admin · Pagamento/Acesso ·
Dados/Banco · Infra/Deploy · Segurança · Conteúdo · Documentação.

Tags livres, opcionais: `ux` `testes` `observabilidade` `memoria` `custo`
`performance` `lgpd`.

### Criar

Entra quando passa nos três filtros: **sobrevive à sessão**; **alguém se
surpreenderia** ao redescobrir daqui a um mês; **tem próximo passo nomeável**.

Antes de criar, procurar por palavra-chave e por categoria. Se já existir,
**atualizar a existente**. Se duas nascerem, sobrevive a de ID menor e a outra
vira `CANCELADA — duplicata, ver PEND-XXX`. **ID nunca é reciclado nem
apagado.**

Campos obrigatórios: ID · título · categoria · prioridade · estado · aberta em
· origem · próximo passo · **critério de conclusão**. O critério nasce **junto
com a pendência** — escrito depois, ele se molda ao que já foi feito.

Campos condicionais, só quando existem e nunca inventados: impacto
(obrigatório em P0/P1) · evidência · bloqueio · depende de · branch ·
commit/PR · deploy · validação · agente recomendado · concluída em ·
aprendizado.

### Achado fora de escopo

**(1)** não conserta; **(2)** não amplia a missão; **(3)** registra a pendência
(ou propõe o registro, se a missão for INVESTIGAR/AUDITAR); **(4)** segue a
missão original se for seguro; **(5)** cita o ID no relatório.

> Exceção única: achado **P0 ativo** — família perdendo acesso ou dado agora.
> Aí vale parar e avisar.

### Atualizar

A pendência muda de estado **no mesmo commit do trabalho que a moveu** — se não
está no diff, não aconteceu. Quem começa move para EM INVESTIGAÇÃO ou EM
EXECUÇÃO **antes** de começar: é assim que outra sessão descobre que já tem
gente ali. Toda mudança de estado carrega data.

### Dependências

Uma linha, uma direção só: `Depende de: PEND-XXX`. O sentido inverso não se
escreve — procura-se pelo ID.

### Dar baixa

CONCLUÍDA exige o **critério comprovado**, não o trabalho feito. Cada degrau
recebe `OK`, `N/A (motivo)` ou `PENDENTE`:

Implementado · Testado · Regressão · Build · Publicado · Configuração · Smoke ·
Validado em produção · Evidência.

**Enquanto houver degrau obrigatório PENDENTE, o estado é AGUARDANDO
VALIDAÇÃO — nunca CONCLUÍDA.** `N/A` sem motivo escrito é proibido: é a forma
mais comum de portão aprovado por omissão (§21 do protocolo de engenharia).

Ao concluir ou cancelar: mover a ficha para
[PENDENCIAS-ARQUIVO.md](PENDENCIAS-ARQUIVO.md) com uma frase de
**`Aprendizado:`**. Quando três fichas arquivadas disserem a mesma coisa,
aquilo virou padrão — e padrão sobe para o protocolo.

### Arquivamento

Concluídas e canceladas saem daqui quando este arquivo passar de ~40 fichas, ou
trimestralmente, o que vier antes.

---

**Próximo ID livre: PEND-024.**

> Conferir contra `origin/main`, não contra o seu branch. Dois branches podem
> reivindicar o mesmo número — o conflito de merge nesta linha é o alarme.
> Se colidir, renumera a mais nova: o ID só vira referência estável depois do
> merge. (Este repositório já queimou números de migração assim.)
