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
| [PEND-004](#pend-004) | Rotina/Sequência Visual | D · Entregas | P2 | AGUARDANDO VALIDAÇÃO | 4 fatias no ar; falta conversa real |
| [PEND-019](#pend-019) | Estratégias que a família consegue usar | D · Entregas | P2 | ABERTA | depende de A+B+C |
| [PEND-020](#pend-020) | Relatórios para escola, terapeuta e médico | D · Entregas | P2 | ABERTA | depende de C |
| [PEND-023](#pend-023) | Feedback da família e aprendizado | E · Feedback | P2 | ABERTA | depende de D |
| [PEND-026](#pend-026) | Impacto das funcionalidades no Admin (equipe/agência) | H · Governança | a definir | ABERTA | montar o mapa de impacto; prioridade sai dele |
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
| **D · Entregas** | PEND-004 (rotina) · PEND-019 (estratégias) · PEND-020 (relatórios) | **PEND-004 NÃO depende mais** (decisões fechadas em 08/08); as outras duas sim |
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

### PEND-026
**Impacto das funcionalidades no Admin — o que a equipe precisa enxergar**
Bloco: **H · Governança** · Prioridade: **a definir** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: pedido do Sérgio na missão da PEND-004

- **Impacto:** doze fichas deste registro já carregam uma linha *"Admin precisa
  de ajuste"*, cada uma pensada isolada. **Não existe ficha que olhe o
  conjunto** — então o Admin cresce por acréscimo, uma tela por frente, e a
  equipe fica sem o que precisa justamente quando o produto fica mais
  sofisticado.
- **DESEJADO — A DEFINIR.** Avaliar o que a equipe/agência precisa **ver e
  administrar** à medida que evoluem: condução da Ayla · conhecimento
  recuperado e usado · memória da criança · Rotina · Estratégias · Relatórios ·
  Trial · feedback · fontes · escalonamentos.
- **O trabalho é um MAPA DE IMPACTO, não telas.** Para cada frente: o que a
  equipe precisa ver · para decidir o quê · com que frequência · e se isso já
  existe em algum canto do Admin. **A prioridade sai do mapa**, não antes dele.
- **IMPACTOS DA ROTINA, levantados pela auditoria de 2026-08-08** (PEND-004):
  ver rotinas geradas por família · **criança** · título · data · **origem**
  (veio da conversa? de qual?) · **status dos cartões** (`nenhum`/`aguardando`/
  `gerando`/`pronto`/`erro` — o `erro` hoje não é visível para ninguém) ·
  **feedback da mãe** quando D-R5 estiver no ar · e **quantas rotinas a mesma
  família tem para o mesmo momento**, que passa a acontecer por decisão (D-R3).
- **DESCOBERTO NA EXECUÇÃO DA ROTINA (2026-08-08), com caso em produção:**
  - **Erro de geração de cartão não é visível para ninguém.** O baseline achou
    **1 rotina com `cards_status = 'erro'`** em produção. A família vê um aviso
    na tela; a equipe não vê nada, não há alerta, e não há como saber que
    aconteceu sem varrer a tabela à mão. É o exemplo mais concreto de por que
    esta ficha existe.
  - **Feedback da rotina** agora existe e precisa ser lido por família e por
    tipo de resposta — inclusive "quero ajustar", que é pedido de mudança.
  - **Rotina em modo `lista` é quase inexistente** (2 de 73). Se continuar
    assim, é sinal de que o modo existe e ninguém acha — coisa que só se
    percebe olhando o conjunto.
- **RASTREABILIDADE DO QUE A AYLA DECIDIU × O QUE O ARTEFATO RECEBEU** (caso
  "Entrada no Leônidas", 08/08/2026). O quadro saiu com três etapas quando a
  mãe tinha ditado cinco, e **nada no sistema registrou a divergência**: só se
  descobriu porque uma pessoa leu a conversa e abriu o artefato. Não há registro
  do que o modelo emitiu no campo `tarefas`, nem de quantas etapas a mensagem
  narrava. **Para a equipe, conversa e artefato são dois mundos que ninguém
  cruza.** É o mesmo buraco do erro de cartão, uma camada acima.
- **O RASTRO DO CONHECIMENTO JÁ EXISTE — falta a tela (2026-08-08).** Desde a
  etapa 1 da PEND-017, cada turno grava em `eventos_app` o que foi consultado,
  o que foi recuperado e o que chegou ao modelo. **O dado está estruturado; o
  Admin ainda não sabe mostrá-lo.** O que a tela precisará juntar, numa
  conversa: o que a mãe disse · o que a Ayla entendeu · que dados da criança
  existiam · que conteúdos foram recuperados · quais chegaram ao modelo · que
  resposta saiu · que artefato saiu. **E precisa exibir "uso efetivo: não
  observável" como tal** — uma tela que insinue que a resposta se apoiou nas
  BPs listadas mentiria com dado verdadeiro.
- **Já sabido, das fichas existentes:** PEND-004 rotinas geradas (criança,
  título, data, origem, status, feedback, erro de geração) · PEND-016 *por que*
  a Ayla decidiu o que decidiu · PEND-017 administrar acervo e ver o que foi
  recuperado · PEND-018 retrato da criança e procedência · PEND-019 estratégias
  entregues · PEND-020 relatórios gerados · PEND-021 jornada e conversão ·
  PEND-022 **receber e tratar escalonamento** · PEND-023 feedback por família.
  *(PEND-024 e PEND-025 estao reservadas por frentes ainda nao publicadas;
  por isso esta ficha e a 026 e a numeracao salta.)*
- **⚠️ Um princípio já vale aqui:** *conceito visível no Admin* — todo indicador
  mostra a própria definição na tela. "Ativado" virou três conceitos por falta
  disso.
- **Depende de:** nada para começar o mapa. **Não bloqueia** nenhuma frente.
- **Critério de conclusão:** mapa de impacto escrito, com prioridade proposta e
  aprovada.
- **Agente recomendado:** AUDITAR → PROPOR

---

### PEND-004
**Rotina/Sequência Visual — auditar o fluxo atual antes de redesenhar**
Categoria: Produto · Prioridade: **P2** · Estado: **AGUARDANDO VALIDAÇÃO**
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
- **📄 SPEC: [specs/rotina-visual.md](specs/rotina-visual.md)** — DESEJADO
  consolidado (2026-08-08) + ATUAL × DESEJADO auditado contra o código de hoje +
  as cinco decisões abertas. **Nada implementado.**
- **A ROTINA ESTÁ MUITO MAIS MADURA DO QUE O DESEJADO PRESSUPUNHA.** A auditoria
  de 2026-08-08 encontrou já implementados, com genealogia datada no código:
  detecção implícita (intenção `organizacao` + `prontidao-rotina.ts`), recusa de
  gerar para birra/desabafo, identificação da criança, "nunca pergunte o que
  você já tem", antes/durante/depois (é o tamanho `orientacao`), tema por estado
  `aguardando`, e **entrega por link com PDF só a pedido** — que era decisão de
  03/08 e coincide com o desejado.
- **AS LACUNAS REAIS SÃO QUASE TODAS DO APP, NÃO DA CONDUÇÃO:**
  1. a página **não ensina** — tem olho, nome e idade, e nenhum "como usar";
  2. a execução marca etapa concluída mas **não destaca a próxima** nem o que falta;
  3. **não existe feedback na página** (`rotina-feedback.ts` classifica fala no
     WhatsApp — é outra coisa);
  4. o botão **Imprimir só aparece em modo `cartoes`** — rotina em lista não imprime;
  5. **evento único não é escopo válido** (*"o Mario vem jantar"*): o critério
     exige "qual pedaço do dia". É o Caso C, e não está coberto.
- **AS CINCO DECISÕES DE PRODUTO — TOMADAS em 2026-08-08.** Não resta decisão
  bloqueadora; a SPEC traz a redação de cada uma.
  - **D-R1 · confirmação seletiva.** Sequência que a **mãe ditou** → gerar sem
    confirmação redundante. Sequência que a **Ayla inferiu, acrescentou ou
    reorganizou** → apresentar e confirmar.
  - **D-R2 · oferta pelo contexto.** Cai a exigência de evidência prévia de que
    "visual funciona para esta criança". Fica a distinção que não pode se
    perder: *transição difícil ≠ esta criança precisa de apoio visual*; significa
    que **apoio visual é possibilidade relevante a oferecer**. Não virar regra
    por palavra-chave.
  - **D-R3 · nunca substituir em silêncio** (provisório). Preserva a anterior;
    não apagar artefato que a família possa já ter impresso.
  - **D-R4 · evento único gera rotina.** O critério deixa de ser "pedaço
    recorrente do dia" e passa a ser a **sequência de acontecimentos**.
  - **D-R5 · feedback não espera PEND-023.** Primeira versão guarda rotina,
    criança, timestamp e resposta.
- **⚠️ D-R1 e D-R2 REVERTEM DECISÕES DELIBERADAS DE 03/08 — e as antigas não
  eram erro.** A exigência de evidência para o visual continha cartão gerado sem
  necessidade; o "MONTE, não peça confirmação" evitava mais um turno de
  perguntas. Ao implementar, **preservar o comentário datado e o motivo
  originais** no código, acrescentando a decisão nova. Apagar a genealogia é o
  que tornou a auditoria de identidade tão cara.
- **Depende de:** PEND-016, PEND-017 e PEND-018 para a parte de inteligência;
  PEND-023 para o feedback. A execução técnica não começa antes do DESEJADO
  desses blocos.
- **Admin:** ADMIN PRECISA DE AJUSTE — visualizar rotinas geradas por família,
  com criança, título, data, origem, status e feedback. **Registrado em PEND-026**;
  não se implementa aqui.
- **AS QUATRO FATIAS FORAM IMPLEMENTADAS E PUBLICADAS EM 2026-08-08.** Cada uma
  saiu da `origin/main` atualizada, com branch, commit, testes, PR, checks e
  merge próprios — para saber exatamente qual mudança produziu qual efeito.

  | Fatia | O que entrou | PR | Testes |
  |---|---|---|---|
  | 1 · app | progresso e etapa de agora · "como usar" nos dois modos · imprimir fora do modo cartões | [#53](https://github.com/sergiokoloszuk/kolo-familia/pull/53) | 11 novos · 2 sabotagens |
  | 2 · feedback | "essa rotina ajudou?" na página, **sem migração** | [#54](https://github.com/sergiokoloszuk/kolo-familia/pull/54) | 12 novos · 2 sabotagens |
  | 3 · oferta | evento único (D-R4) · visual pelo contexto (D-R2) | [#55](https://github.com/sergiokoloszuk/kolo-familia/pull/55) | 17 novos · 3 sabotagens |
  | 4 · confirmação | confirmação seletiva (D-R1) | [#56](https://github.com/sergiokoloszuk/kolo-familia/pull/56) | 18 novos · 2 sabotagens |

  Suíte ao final: **1462 passando**, `tsc` limpo, `npm run build` ok, todos os
  checks verdes, tudo em Production.
- **A FATIA 2 NÃO PRECISOU DE MIGRAÇÃO — e isso é o achado da frente.** A 0075
  já dera à rotina as mesmas quatro colunas de resultado do plano, **e está
  aplicada em produção** (conferido por leitura). O feedback da página só
  traduz os quatro botões para os quatro valores que o banco aceita, e um teste
  lê o SQL da migração para impedir que alguém acrescente botão sem valor.
  Efeito colateral que não custou código: quem responde no app sai da fila do
  follow-up da Ayla e **não recebe a mesma pergunta pelo WhatsApp depois**.
- **O PRÓXIMO NÚMERO DE MIGRAÇÃO LIVRE É 0077**, não 0076 — a 0076
  (`plano_versionamento`) já está reivindicada pela branch
  `feat/plano-kolo-estrutura`. Conferido contra todas as branches, locais e
  remotas, antes de decidir que a fatia 2 não precisava de migração.
- **BASELINE CONGELADO ANTES DA FATIA 3** (2026-08-08, antes de tocar a
  condução): 73 rotinas em 15 famílias · 30 nos últimos 7 dias, 51 em 14, 65 em
  30 · cartões: 26 prontos, 46 nenhum, **1 erro** · modo: 71 cartões, 2 lista ·
  38 de dia da semana, 35 avulsas · **0 respostas de resultado** (o feedback
  acabara de nascer) · 294 mensagens de rotina no WhatsApp em 14 dias.
  **Não comparar volume ainda:** a base é pequena e a fatia 3 saiu no mesmo dia.
- **VALIDAÇÃO INTEGRADA — o que está provado e o que não está.**
  Provado por teste e por leitura de código, sem comunicação real: a página
  ensina, destaca a etapa de agora, imprime nos dois modos, edita, salva,
  reencontra pela lista filtrada por criança, e grava o feedback com escrita
  conferida. Os contratos cobrem os casos A a G da SPEC.
  **Validado por bancada em 08/08** (ver abaixo) e **corrigido um defeito real
  de produção**. **Continua NÃO validado:** o comportamento com famílias reais
  depois da correção. Todos
  os testes das fatias 3 e 4 prendem o TEXTO da decisão, não o que o modelo faz
  com ele — é o limite conhecido desse tipo de teste, e está dito nos arquivos.
- **⚠️ CASO REAL DE PRODUÇÃO — 08/08/2026, "Entrada no Leônidas". CORRIGIDO E
  PUBLICADO ([#58](https://github.com/sergiokoloszuk/kolo-familia/pull/58)).**
  A mãe ditou cinco etapas (*chega · cumprimenta todos · senta para estudar ·
  faz a lição · agradece e dá tchau*). A Ayla narrou as cinco corretamente na
  fala e, **no mesmo turno**, sugeriu um ensaio de três passos para a parte
  mais pesada. **O quadro saiu com os três dela.**
  - **Rastreio:** a rotina foi criada às `00:01:54`, dois segundos antes da
    mensagem das `00:01:56` — mesma chamada ao modelo. **As cinco etapas nunca
    entraram no caminho estruturado**; só existem como texto em
    `ayla_messages`. Não é o gerador, nem o serviço, nem a persistência:
    3 etapas → 3 cartões → 3 gerados, sem erro, na ordem certa. A perda é
    anterior a tudo isso, na escolha do que ia no campo `tarefas`.
  - **Duas causas:** (1) nada declarava que, havendo duas listas no turno, a do
    quadro é a da FAMÍLIA; (2) a instrução de tamanho `mini` mandava montar
    *"de 2 a 4 etapas, só o trecho que trava"* **sem excluir a sequência
    ditada** — e o nome que a rotina recebeu, *"Entrada no Leônidas"*, é a
    assinatura desse recorte.
  - **Prova comportamental, não só de texto:** com a correção, **3 de 3**
    execuções com chamada real devolveram as cinco etapas exatas. **Sem ela**,
    uma de duas fundiu *"senta para estudar"* e *"faz a lição"* numa só.
- **BANCADA COM CHAMADA REAL — 08/08/2026** (casos B, C e G da SPEC; sem banco,
  sem WhatsApp, sem família real). **Aprovados:** B (necessidade implícita →
  `suficiente`/`orientacao`) · C (evento único → **não** caiu em `falta_escopo`;
  pediu a sequência, que é o desenhado) · C2 dentista (`suficiente`/`mini`) ·
  G (sequência ditada → `montar`, sem confirmação) · **contracaso** (sobrecarga
  sensorial no mercado → `nao_e_rotina`, com o raciocínio certo: *"a
  previsibilidade da sequência não resolve"*). **A D-R2 não virou automática.**
  - **Reprovado e corrigido:** a instrução injetada quando dava pra montar
    dizia `acao="montar", obrigatoriamente` e *"não faça mais nenhuma
    pergunta"*, **contradizendo a D-R1**. Diante de uma sequência que precisava
    completar, a Ayla devolvia **pergunta de investigação** (*"o Mario é alguém
    que ele conhece bem?"*) em vez da proposta numerada. Duas instruções fortes
    em contradição produzem uma saída que não é nenhuma das duas.
  - **AINDA EM ABERTO, e repetiu 2 de 2:** quando a Ayla **reorganiza** a ordem
    que a mãe deu (ela disse *dormir, jantar, chega*), a Ayla corrige a ordem e
    **monta sem confirmar**. A correção provável exige o porteiro informar ao
    condutor que houve reorganização — **campo novo em `ProntidaoRotina`**, o
    que é mudança estrutural, não ajuste localizado. **Não implementado; precisa
    de decisão.**
- **DECISÃO DE PRODUTO REGISTRADA (2026-08-08), NÃO IMPLEMENTADA — D-R6.**
  > **Se a Ayla alterar materialmente uma sequência fornecida pela família —
  > inclusive mudar a ORDEM — deve apresentar a sequência alterada e confirmar
  > antes de gerar.**
  Fecha o buraco que a bancada encontrou e que **repetiu 2 de 2**: quando a mãe
  ditou *dormir, jantar, chega*, a Ayla corrigiu a ordem e montou sem
  confirmar. A D-R1 cobria acrescentar e completar; **reordenar** ficou fora.
  ⚠️ A correção provável exige o porteiro informar ao condutor que houve
  reorganização — **campo novo em `ProntidaoRotina`**, mudança estrutural, não
  ajuste de texto. **Destino: próxima fatia de execução da PEND-004.**
- **⚠️ ESTADO: AGUARDANDO VALIDAÇÃO.** Falta exatamente uma evidência, e ela
  não se fabrica: **uma conversa real, de uma família real, exercitando os
  casos B (necessidade implícita), C (evento único) e a confirmação seletiva.**
  Não criei tráfego nem família de teste para conseguir a baixa. O caminho
  honesto é a bancada com chamada real ao modelo, ou o uso orgânico das
  próximas famílias — e aí comparar com o baseline acima.
- **RISCOS QUE FICAM.**
  1. **A D-R2 aumenta a oferta de cartões.** É deliberado, e é seguro porque
     `visual: true` só faz a Ayla PERGUNTAR o tema (a mãe recusa com
     `recusouTema`). Mas o custo de imagem sobe se muita gente aceitar.
     **ACEITO com justificativa**, e mensurável contra o baseline.
  2. **Erro de geração de cartão é invisível.** Já há 1 em produção e ninguém
     soube. → **PEND-026**.
  3. **Lint pré-existente** (`set-state-in-effect` no rascunho do AddTarefa)
     continua no arquivo, idêntico à `main`. **ACEITO** — não é desta frente e
     não se corrige em silêncio.
- **Critério de conclusão restante:** só a validação orgânica acima.
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
- **DESEJADO — A DEFINIR COM PRODUTO.** Decisões que precisam vir **antes** de
  qualquer investigação técnica:
  1. como a Ayla escolhe **um** foco quando a mãe traz três problemas;
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
- **✅ ENTRADA GUIADA — FATIA 1 NO AR (2026-08-08)**
  ([#62](https://github.com/sergiokoloszuk/kolo-familia/pull/62)). Quem chega
  sem saber o que contar recebe **caminhos numerados**, não uma pergunta aberta.
  - **Menos dependência de pergunta aberta.** A entrada anterior já recuperava
    os desafios do onboarding, mas em **prosa** — *"o que mais tem pesado é a
    comunicação e o sono. Por qual você quer começar?"* — e isso ainda exigia
    que a mãe formulasse a resposta. Agora ela responde **um número**.
  - **RESPOSTA POR ESCOLHA, e a escolha manda.** O tema vem do menu, não da
    inferência do classificador: *a escolha é explícita, o classificador é
    inferência, e duas fontes para a mesma decisão sempre divergem.* A skill
    correspondente vai junto — sem isso, "2" chegaria à recuperação sem skill
    e a resposta sairia sem repertório.
  - **SITUAÇÃO CONCRETA TEM PRIORIDADE, e é a regra que mais importa.** Quem
    escreve *"meu filho não quer fazer lição"* é atendida na hora. A detecção é
    por **lista fechada de aberturas vazias**, nunca por tamanho — *"ele morde"*
    tem dez caracteres e é uma situação. **O erro caro não é deixar de mostrar o
    menu; é mostrá-lo a quem já disse o que está acontecendo.**
  - **O número vale pelo menu que ela VIU:** o estado sai do texto da mensagem
    já persistida, sem coluna e sem migração, espelhando o padrão da Rotina.
  - **Fatia 2 (segundo nível por tema) NÃO entrou** — decisão de produto ainda
    aberta.
  - **Prova:** 41 testes (casos A–I) e **quatro sabotagens**: tirar a prioridade
    do onboarding quebra 13 · interpretar número sem respeitar o menu quebra 5 ·
    entrada concreta cair no menu quebra 8 · misturar desafio de outra família
    quebra 13.
- **TESTE REAL DA ENTRADA GUIADA — 2026-08-09, conversa da Karina.** Primeira
  evidência orgânica depois da fatia 1. **O menu funcionou; a condução depois
  dele é o problema.**
  - **LATÊNCIA CONVERSACIONAL: quatro trocas até o valor forte.**
    `5` → `Tarefas` → `Começar/Matemática` → `Ele não quer fazer lição`. Só a
    última trouxe *o que eu faria primeiro* + explicação + frase pronta. As três
    anteriores **já traziam orientação concreta** — não foi interrogatório puro —
    mas cada uma **fechava com mais uma pergunta de afunilamento**, e é isso que
    faz a mãe sentir que ainda não chegou.
  - **TEMA ESCOLHIDO VIROU ORIENTAÇÃO SOBRE HIPÓTESE NÃO IDENTIFICADA.** Com
    `sensorial`, a Ayla abriu por pressão/movimento/barulho — o conteúdo médio
    do tema, não o problema daquela família. **Tema escolhido não é autorização
    para despejar o tema**, e também não é começo de interrogatório: o que falta
    é oferecer **situações concretas reconhecíveis** para a mãe se identificar.
  - **A SUFICIÊNCIA NÃO É DECIDIDA POR NINGUÉM.** Diferente da Rotina e do Plano,
    a conversa livre **não tem porteiro**: nada avalia *"já dá pra ajudar de
    verdade?"* antes de responder. `Começar + Matemática` já bastava.
  - **FORMA DA RESPOSTA — auditada em 2026-08-09.** As respostas saem em blocos
    uniformes de prosa. A mãe não consegue bater o olho e achar *o que tentar ·
    o que falar · uma ideia prática · qual o próximo caminho*. **Âncoras curtas
    em negrito** (`*assim*`, que é a sintaxe que o WhatsApp renderiza e que a
    Ayla já usa) devem aparecer **quando ajudarem a leitura** — nunca como
    template fixo em toda resposta.
  - **PRINCÍPIO REGISTRADO:** *uma boa resposta Kolo não apenas explica o
    comportamento — ela deixa a mãe com alguma coisa concreta para experimentar.*
    Quando houver repertório, ir além do óbvio: **orientação + frase +
    brincadeira/atividade/missão + alternativas**, conforme o caso.
    ⚠️ **Isto NÃO vira a regra "criança não quer tarefa → gamificar".** A
    intervenção nasce da situação + dados da criança + interesses + o que já
    funcionou + repertório recuperado. Sem saber o que funciona com aquela
    criança, a saída é **oferecer 2–3 jeitos com o como-fazer de cada um** e
    deixar a mãe escolher — ela não precisa saber de antemão o que serve.
  - **DESEJADO, registrado e NÃO construído:** (a) a escolha do número deve
    **aumentar o valor imediatamente**; (b) não orientar sobre hipótese ainda não
    identificada; (c) sem pergunta de afunilamento quando já dá para ajudar;
    (d) **depois de entregar ajuda**, oferecer 2–4 caminhos concretos (outras
    estratégias · atividade/missão · analisar foto · Rotina Visual · Plano Kolo ·
    História), **nunca menu fixo**; (e) **artefato não substitui orientação** —
    *se retirarmos o artefato desta conversa, a família ainda aprendeu algo útil
    para fazer ou falar?*
  - **CRITÉRIO CONCEITUAL DE ARTEFATO — hipótese a validar, não implementada:**
    **Rotina Visual** quando há sequência concreta e ver "agora/depois" ajuda ·
    **Plano Kolo** quando o desafio é recorrente e vale trabalhar ao longo do
    tempo · **História** quando antecipar/ensaiar ajuda · **orientação primeiro**
    quando ainda se está entendendo o problema. ⚠️ **Não ampliar a oferta de
    Plano enquanto a PEND-017 não avançar** — a auditoria de 08/08 mostrou que o
    conteúdo dele tem liberdade excessiva do modelo.
  - **Estado: ABERTA.** A fatia 2 não começou e o mecanismo mínimo que produziria
    esse comportamento ainda não foi desenhado.
- **DESEJADO DA CONDUÇÃO — DECISÕES FECHADAS EM 2026-08-09.**
  - **O PISO é UMA AÇÃO CONCRETA E EXECUTÁVEL HOJE**, sempre que houver contexto
    suficiente. Frase pronta e treino em momento calmo **são recursos
    selecionáveis, não piso.**
  - Depois do piso, escolher **1 ou 2 recursos** que mais aumentem o valor
    naquele caso: frase pronta · treino em momento tranquilo · brincadeira/missão
    · sequência curta de verbos · alternativa · recurso simples para montar ·
    adaptação para outro ambiente · próximo caminho da Kolo.
  - **Régua: 2 a 3 elementos úteis por intervenção**, sem obrigar categoria
    nenhuma.
  - **PRINCÍPIO:** *poucas coisas, executáveis hoje e fáceis de lembrar.*
  - **FORMA:** hierarquia, não blocos. No WhatsApp, **âncoras curtas em
    `*negrito*`** (a sintaxe que o canal renderiza), listas simples e espaço.
    **Nada de "BLOCO 1/2/3" nem tabelas** — a tabela vaza como texto cru, e há
    print do app antigo provando isso.
  - **Nomear a estratégia e comprimir em verbos** (*Diminuir → Escolher →
    Começar*) quando ajudar a lembrar — **não batizar toda intervenção**, senão
    o nome vira tique e perde força.
  - **PRÓXIMOS CAMINHOS NÃO SÃO SÓ PLANO/ROTINA/HISTÓRIA.** A condução deve
    reconhecer capacidades que a Kolo já tem quando forem continuação natural —
    em especial **Registro Diário / Evolução**. Achado do "Diário dos Sinais" do
    app antigo: aquilo era um pedido solto no texto; aqui já existe funcionalidade.
- **APRENDIZADOS DA PROTOTIPAÇÃO CONVERSACIONAL (2026-08-09, 4 casos simulados).**
  - **A suficiência chega antes do que se supunha: TEMA + ONDE já basta.**
    Prototipando, "Foco" + "Lição" já sustenta uma intervenção concreta. A
    dificuldade específica (começar × manter × terminar) **enriquece e não
    bloqueia** — é a mesma regra que a Rotina já aprendeu em 03/08.
  - **O segundo nível NÃO precisa de árvore.** O que a escolha do tema pede não
    é um submenu fixo: é a Ayla **nomear 3 ou 4 situações reconhecíveis** daquele
    tema para a mãe se identificar em uma. É gerado do tema + do que se sabe da
    criança, não hardcoded — e é o mecanismo mínimo da fatia 2.
  - **A ausência de dado muda o RECURSO, não a entrega.** Sem interesses
    conhecidos, não se inventa a missão da nave: entrega-se a ação concreta e
    oferecem-se **2 ou 3 jeitos com o como-fazer de cada um**, para a mãe
    escolher sem precisar saber de antemão o que funciona com o filho.
  - **A oferta de artefato cabe na MESMA mensagem da orientação, em uma linha.**
    Virar turno próprio ("quer uma rotina visual?") gasta uma troca e empurra o
    artefato para o lugar da ajuda.
- **Depende de:** PEND-017 e PEND-018 — **desenhar junto**. Absorve PEND-009
  (primeira conversa) dentro do DESEJADO.
- **Admin:** ADMIN PRECISA DE AJUSTE — hoje não dá para ver *por que* a Ayla
  disse o que disse (decisão, contexto recuperado, conteúdo usado).
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
- **✅ ETAPA 1 — RASTREABILIDADE, NO AR desde 2026-08-08**
  ([#60](https://github.com/sergiokoloszuk/kolo-familia/pull/60)). *Enxergar
  antes de melhorar: nada de ranking, conteúdo, seleção ou prompt foi tocado.*
  - **PASSOU A SER OBSERVÁVEL**, por turno e nos dois canais, em `eventos_app`
    (`kind = conhecimento_consultado`): canal · família · criança · skills
    roteadas · quantas tags entraram · idade usada · **IDs recuperados** ·
    **IDs enviados ao modelo** · se o bloco saiu vazio · **por que**. Só id,
    contagem e rótulo — nenhum texto de BP, de família, de prompt ou de
    resposta, que já vivem em outro lugar.
  - **VAZIO DEIXOU DE SER UM ESTADO SÓ:** `sem_skill` (nem se consultou) ·
    `acervo_vazio` (consultou e não havia) · `erro_na_consulta` (a consulta
    quebrou, e a falha era engolida num `console.warn` que não persiste). Os
    três produziam exatamente o mesmo bloco ausente.
  - **CONTINUA NÃO OBSERVÁVEL, de propósito: o USO.** Ter a boa prática no
    contexto não prova que ela sustentou a resposta. O evento grava
    `uso_efetivo: "nao_observavel"` por extenso, para que ninguém conclua o
    contrário depois. Provar uso exige outra coisa — o modelo citar o id, ou um
    juiz comparando resposta e conteúdo — e **é decisão de etapa futura**.
  - **A observabilidade não mudou o que mede:** seleção, ordem, bloco, prompt e
    resposta idênticos. O registro não é esperado (`void`) e tem duas camadas
    de `catch` — nenhuma família perde resposta por uma linha de log.
  - **`logEvent` ganhou `persistir`**: nem todo evento que precisa sobreviver é
    um problema, e marcar operação normal como `warn` envenenaria a severidade.
  - **Validação:** 19 testes, três sabotagens provadas (perder a associação com
    a família quebra 1; perder a detecção de vazio quebra 4; confundir erro com
    acervo vazio quebra 2). **Zero rastros gravados até agora** — não houve
    conversa depois do deploy, e **não fabriquei tráfego**. A primeira conversa
    real produz a evidência.
  - **O que isto desbloqueia:** a validação por conversas reais que esta ficha
    exige, e a separação entre erro de conhecimento e erro de raciocínio que a
    PEND-016 vai precisar.
- **Inclui o pipeline de Admin** (upload → extração → classificação → proposta
  da IA → revisão humana → aprovação → disponível para a Ayla), já desenhado em
  `docs/frente-import-documentos.md`.
- **EVIDÊNCIA NOVA SOBRE ROTEAMENTO (2026-08-08):** com a entrada guiada, a
  escolha numérica passa a **semear a skill** quando o classificador não
  devolve nenhuma. O rastro da etapa 1 mostra esse roteamento como qualquer
  outro. **Isto não resolve nada desta ficha** — ranking, peso e seleção
  continuam como estavam, e a qualidade do que é recuperado segue em aberto.
- **EVIDÊNCIA REAL — conversa da Karina, 2026-08-09.** O rastro da etapa 1
  produziu o primeiro laudo por turno desta base.
  - `5`/sensorial → **3 recuperadas, 3 enviadas**, `idade=18`. **Pertinentes:**
    o Mario **tem 18 anos**, e vieram BPs de faixa 13-18 sobre autorregulação
    sensorial em adolescente.
  - `Tarefas` → **3 recuperadas, 3 enviadas, `idade=null`** — e aí entraram
    *"Música e dança livre… ritmo"* (faixa 1-3) e *"Sustentação cervical cresce
    entre 3-5 meses"* (faixa 0-1) **para um adolescente**.
  - `Começar/Matemática` e `Ele não quer fazer lição` → skill `foco`, `idade=18`,
    3 de 3, faixa adequada. **Pertinentes.**
  - **🐛 ACHADO: a idade desaparece entre turnos.** Três turnos com `idade=18` e
    um, no meio, com `null`. Quando a idade some, a regra tolerante de
    `idadeElegivel` — **deliberada e certa** para família sem data de nascimento
    — deixa entrar conteúdo de bebê. **O defeito não é o filtro: é a idade
    sumir.** Causa provável: `membroConversa` oscila entre turnos da mesma
    conversa. **NÃO corrigido:** exige entender a oscilação, e mexer às cegas na
    resolução de criança é território do isolamento entre irmãos.
    **Destino: investigação própria nesta ficha, com o rastro como baseline.**
  - **🔴 O ACERVO NÃO TEM O QUE A CONDUÇÃO PRECISARIA — medido em 2026-08-09.**
    Perguntou-se se faltava criatividade à Ayla ou conteúdo à base. **É
    conteúdo.** Na skill `foco`: 35 BPs ativas, 33 com passos práticos, **6 com
    linguagem lúdica** (missão · jogo · brincadeira · desafio) — e **ZERO delas
    elegível para 18 anos**. As seis são de faixa infantil.
    Respondendo item a item: **existiam?** sim, seis · **elegíveis?** não,
    nenhuma · **recuperadas?** não · **chegaram ao modelo?** não · **apareceram
    na resposta?** não — e é exatamente por isso que a resposta ficou em
    *"reduza, pause, observe"*.
    **Consequência para o desenho:** pedir à Ayla que "seja mais criativa com
    missões" para um adolescente seria pedir que ela **invente**, não que use a
    base. **Não é bug de recuperação; é lacuna de curadoria** — e some junto com
    `meu_bem_estar` na lista do que o acervo não cobre.
  - **Uso efetivo continua não observável.**
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
- **APRENDIZADOS DE 2026-08-09 (prototipação e medição de latência):**
  1. **Protótipo conversacional escrito à mão é diagnóstico barato.** Escrever as
     quatro conversas como a mãe as veria expôs, em minutos, que o segundo nível
     não precisa de árvore e que a suficiência chega mais cedo — duas coisas que
     nenhuma leitura de código tinha mostrado. **Prototipar a experiência antes
     de desenhar o mecanismo** evita construir a árvore que não era necessária.
  2. **Decompor a latência desmente a suspeita.** Medido: catálogo 204 ms ·
     classificação 2 172 ms · recuperação **97 ms** · modelo 2 408 ms. A
     recuperação, que era a suspeita natural, é a etapa **mais barata de todas**.
     O custo está em **encadear chamadas de modelo** (até três por turno) e nos
     **4 s de "digitando"** — nenhum dos dois aparece se a gente otimizar no
     escuro.
- **APRENDIZADOS DE 2026-08-09 (auditoria do teste real da entrada guiada):**
  1. **Latência técnica e latência conversacional são métricas diferentes, e as
     duas precisam ser medidas.** A percepção de "quase um minuto" somava o
     tempo de digitação da mãe ao da Ayla; **medido, o técnico foi de 10 a 25
     segundos por resposta**. O que incomodava era a outra: **quatro trocas até
     a ajuda forte**. Otimizar a errada custaria dias e não mudaria a sensação.
  2. **Rastro de conhecimento prova PRESENÇA no contexto, não USO pelo modelo.**
     Confirmado na prática: dá para afirmar que três boas práticas de faixa
     13-18 chegaram ao prompt; **não dá para afirmar que a resposta se apoiou
     nelas.**
  3. **Conferir o dado antes de reportar o alarme.** Vi `idade=18` no rastro e
     quase reportei bug grave de faixa etária — o Mario **tem** 18 anos e a
     recuperação estava certa. O bug verdadeiro era outro e menor (a idade sumir
     num turno), e só apareceu porque conferi a data de nascimento antes de
     escrever.
- **APRENDIZADO A INCORPORAR (2026-08-08, vindo da PEND-004):** *desejado novo
  que contradiz uma decisão antiga documentada exige **decisão explícita de
  produto** — não se sobrescreve em silêncio nem se preserva o legado por
  inércia.* Na Rotina, duas cláusulas do desejado revertiam decisões de 03/08
  que **não eram erro** e traziam o motivo escrito no código. Viraram D-R1 e
  D-R2, foram decididas, e a genealogia antiga fica preservada junto da nova.
- **APRENDIZADOS DA EXECUÇÃO EM FATIAS (2026-08-08, PEND-004):**
  1. *Antes de criar tabela ou coluna, procurar a migração que já resolveu o
     problema ao lado.* A fatia de feedback ia nascer com migração; a 0075 já
     tinha as quatro colunas certas, aplicadas em produção. **Zero schema
     novo.** O reflexo de "feature nova, tabela nova" custa caro.
  2. *Teste de regressão pega o autor mudando o que não devia — duas vezes na
     mesma missão.* Ao reescrever um bloco de critério, derrubei junto duas
     regras que a decisão NÃO revogava (tema não é motivo pra cartão; horário
     proposto). Nos dois casos o teste antigo é que avisou, e a correção foi no
     código, não no teste. **Quando um teste antigo falha, a primeira pergunta
     é se a decisão o revogou — não como fazê-lo passar.**
  3. *Decisão de produto que vive em texto precisa ser exportada para poder ser
     testada.* Dois contratos passaram a ser exportados nesta frente, sem mudar
     comportamento. Sem isso, a única forma de prender a decisão seria chamada
     real ao modelo — e a regra antiga voltaria no primeiro merge distraído.
- **Já desenhado, não recomeçar:** `docs/perfil-vivo-fatos-versionados.md`
  (fatos datados + proveniência + visão derivada) — decidido e **não construído**.
- **✅ OS DESAFIOS REAIS DO ONBOARDING CONDUZEM A ENTRADA (2026-08-08).** A
  entrada guiada lê `perfil_vivo_membro.categorias_extras.desafios_onboarding`
  e os apresenta **primeiro**, com o vocabulário canônico de
  `lib/conducao/temas.ts` — sem catálogo paralelo.
  - **AUSÊNCIA NUNCA É PREENCHIDA POR INFERÊNCIA.** Três desafios → mostra três.
    Um → mostra um. Nenhum → mostra os temas gerais **sem dizer "você me
    contou"**. Chave desconhecida (lixo, tema renomeado) é **descartada** em vez
    de virar uma linha sem rótulo: melhor um menu com dois itens verdadeiros do
    que três com um inventado.
  - Nome que não é nome passa pelo mesmo detector que já evitou *"Oi, Meu Nome
    e Gisela Meu Filgo e Davi"* — sem nome confiável, a saudação funciona sem
    nome.
- **ORIGEM DA FRASE "referência visual" — RASTREADA em 2026-08-09.** A Ayla
  disse *"Como ele copia bem quando tem referência visual…"*. Classificação:
  **A — fato real do perfil**, não inferência. Procedência:
  `perfil_vivo_membro.categorias_extras`, texto literal *"Copia palavras com
  perfeição quando vê o modelo, mas não consegue escrever sem referência
  visual — força em processamento visual, fraqueza em evocação de grafia."*
  **A memória funcionou, e funcionou bem.**
  - **⚠️ MAS O FATO FOI USADO FORA DO ESCOPO EM QUE FOI REGISTRADO.** O que está
    guardado é sobre **escrita e grafia**; a Ayla o aplicou a **matemática**,
    para justificar o exemplo resolvido ao lado. A extensão é plausível e pode
    até estar certa — **mas não é o que a família contou**, e saiu na voz de
    quem afirma algo sabido.
  - **É a mesma família de falha da uva-passa:** detalhe verdadeiro reusado fora
    do contexto original. Reforça que o problema não é a memória guardar errado,
    e sim **não carregar o escopo do que foi observado**. Requisito para o
    desenho desta ficha: **um fato precisa saber sobre o que ele fala.**
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
- **PRINCÍPIO DO INÍCIO DO TRIAL, registrado em 2026-08-08 (não é a jornada).**
  > **O início do trial deve reduzir o esforço da família e ajudá-la a
  > descobrir rapidamente onde a Kolo pode ser útil.**
  Os **3 desafios do onboarding** são apresentados primeiro, porque provam que a
  Ayla já sabe algo daquela criança; os **demais temas também aparecem**, porque
  a mãe frequentemente não sabe que a Kolo ajuda com aquilo. A entrada guiada
  (fatia 1, no ar) é a primeira peça disso.
  ⚠️ **As mensagens D1–D7 continuam não existindo** e não foram criadas aqui.
- **TEMPO ATÉ O PRIMEIRO VALOR — critério do trial, registrado em 2026-08-09.**
  A entrada guiada reduziu o esforço da primeira resposta (a mãe responde um
  número), **mas o teste real mostrou quatro trocas até a ajuda forte**. Reduzir
  o esforço de responder não adianta se a ajuda ainda demora a chegar.
  - **A entrada guiada precisa virar ajuda útil rápido**, e a descoberta de
    funcionalidades deve acontecer **pelo contexto**, quando a situação pede —
    nunca como catálogo.
  - **Medível a partir de agora:** o rastro e `ayla_messages` permitem contar
    quantas trocas separam a primeira mensagem da primeira orientação concreta.
  - Segue valendo: **as mensagens D1–D7 não existem** e não foram criadas.
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

**Próximo ID livre: PEND-027. *(024 e 025 reservadas por frentes ainda não publicadas.)***

> Conferir contra `origin/main`, não contra o seu branch. Dois branches podem
> reivindicar o mesmo número — o conflito de merge nesta linha é o alarme.
> Se colidir, renumera a mais nova: o ID só vira referência estável depois do
> merge. (Este repositório já queimou números de migração assim.)
