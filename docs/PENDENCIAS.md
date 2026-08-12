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
| [PEND-040](#pend-040) | Observabilidade de IA — conversa Web e Plano não existem em `api_calls` | H · Governança | P1 | ABERTA | achar por que a instrumentação atual não grava |
| [PEND-042](#pend-042) | 58% dos turnos de WhatsApp sem repertório | B · Conhecimento | P1 | MEDIDA | separar os 5 motivos antes de tocar em base ou prompt |
| [PEND-038](#pend-038) | Latência percebida no WhatsApp e resposta em vários balões | A · Condução | P1 pós-rollout | NÃO MEDIDA EM PRODUÇÃO | os 56s são bancada do Plano; depende de [PEND-040] |
| [PEND-039](#pend-039) | Bancada permanente de golden cases (Manu · LEGO · Bia · vago) | A · Condução | P1 | DESENHADA | construir antes da próxima fase do Plano |
| [PEND-043](#pend-043) | Ter objetivo ≠ gerar Plano — falta decisão de valor | D · Entregas | P1 | ABERTA | separar suficiência de valor de consolidação |
| [PEND-046](#pend-046) | Turno seguinte não enxerga a resposta ainda em voo | A · Condução | P1 | CAUSA PROVADA | avaliar junto com [PEND-038]; não aumentar a janela |
| [PEND-045](#pend-045) | Pronome perde a criança logo após ação sobre ela | A · Condução | P1 | CAUSA PROVADA | âncora na ação anterior, sem heurística de pronome |
| [PEND-044](#pend-044) | A Kolo terceiriza antes de tentar ajudar | A · Condução | P1 | ABERTA | classe funcional, não regra de palavra |
| [PEND-036](#pend-036) | O Plano reoferece o que a conversa acabou de descartar | D · Entregas | P1 | DESCONTAMINADA | medida sozinha após a 035; é defeito próprio |
| [PEND-037](#pend-037) | O Plano afirma causas sem fonte rastreável | D · Entregas | P2 | ABERTA | classificar PERFIL/BASE/INFERÊNCIA/SEM FONTE |
| [PEND-032](#pend-032) | Bancada instável entre execuções — método, não produto | A · Condução | P3 | MÉTODO | só é achado o que se repete |
| [PEND-031](#pend-031) | Repetição entre seções do Plano — medida, e anterior à 3a | D · Entregas | P2 | MEDIDA | 7 ideias repetidas JÁ sem a 4A; tratar na Fatia 4 |
| [PEND-030](#pend-030) | Confirmações curtas e continuidade do objetivo | D · Entregas | P3 | VALIDAÇÃO NO PILOTO | observar conversas reais antes de ajustar |
| [PEND-029](#pend-029) | Aprendizado do Plano sabe o resultado, não a intervenção | D · Entregas | P2 | ABERTA | medir quantas notas são descritivas |
| [PEND-028](#pend-028) | Piloto 4A — o que a bancada deixou em aberto | **A · Condução** | P2 | ABERTA | não bloqueia o piloto; medir depois do uso real |
| [PEND-027](#pend-027) | Plano Kolo — contexto, conhecimento e aprendizado | **D · Entregas** | P1 | ABERTA | P0 interno: fazer o feedback chegar ao Plano seguinte |
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
| **D · Entregas** | PEND-004 (rotina) · PEND-019 (estratégias) · PEND-020 (relatórios) · **PEND-027 (plano)** | **PEND-004 NÃO depende mais** (decisões fechadas em 08/08); as outras três sim. **PEND-027 é a prova de que D é a mesma inteligência três vezes** — o Plano é cego para o que Estratégias já enxerga |
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

### Princípio de desenho: CAPACIDADES, NÃO CHECKLIST

> Registrado em 2026-08-10, depois de medir o gabarito da conversa e antes de
> desenhar as fatias 2 a 4 do Plano.

Manejar · desenvolver · brincar · treinar · modelar · adaptar · generalizar ·
observar são **capacidades disponíveis**, não etapas de uma resposta. Nenhuma
precisa aparecer só porque existe.

**As duas formas de errar, e a segunda é a mais tentadora:**

1. **Receita de bolo textual** — mandar a lista inteira em todo turno. Já
   aconteceu e foi medido: 15 formas de entrega em lista ordenada viraram
   **3 títulos em 77% dos usos** e **6 nunca usados**. Lista ordenada de opções
   não é leque, é funil — o modelo pega o topo.
2. **Receita de bolo PROGRAMADA** — `if comunicação → brincadeira`,
   `if foco → treino`. Troca o gabarito de texto por um gabarito de código, e
   fica pior: some a possibilidade de o modelo perceber que aquele caso pedia
   outra coisa.

**O desenho que vale:**

```
ESTADO/CONTEXTO
  → disponibiliza conhecimento e capacidades RELEVANTES àquele turno
  → modelo raciocina sobre mecanismo e finalidade
  → escolhe a menor combinação útil
  → resposta natural
```

**Fronteira entre código e modelo:** o código controla *disponibilidade,
gatilho, segurança, escopo e contexto*; o modelo compõe dentro disso. Já há
precedente que funciona — `ORIENTACAO_DE_TRANSICAO` e `formasDeEntrega` só
entram quando o estado diz que cabem, e quem decide é código lendo estado.

**Corolário que fecha a porta do inchaço:** capacidade nova que chega em TODO
turno vira obrigação por presença. Se não tem gatilho próprio, ou vive noutro
lugar, ou não deve existir. `formasDeEntrega` tem teto de 1.600 caracteres e
está em 1.560 — **não cabe mais nada lá**, e isso é proteção, não limitação.

**E a generalização vem do MECANISMO, não da categoria.** O acervo não deve
ensinar "mercadinho para comunicação", e sim "brincadeira de papéis cria motivo
real para iniciar, responder e encerrar" — é o que permite trocar mercadinho
por veterinário, oficina ou entrevista pós-jogo mantendo a habilidade-alvo.
Nomear mecanismo generaliza; nomear categoria vira taxonomia.

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

### PEND-049
**A retomada da Rotina fica de pé por 48 horas — e o portão pula o ato**
Bloco: **A · Condução** · Prioridade: **P2** · Estado: **ABERTA · MEDIDA, DECISÃO DE PRODUTO PENDENTE**
Aberta em: 2026-08-11 · Origem: mapeamento da Rotina (fases 1-4 da missão de artefatos)

> **Uma pergunta da Ayla sem resposta reabre o fluxo da Rotina dois dias
> depois, num assunto qualquer.**

- **PROVEI POR EXECUÇÃO** (duplo de banco, sem produção). `rotinaConversaPendente`
  não guarda estado: ele DERIVA do histórico — último outbound
  `tipo="rotina_conversa"` nas últimas **48 h** sem nenhum inbound depois.
  Medido: pendente com 1 h → abre · já respondida → fecha · **40 h sem resposta
  → abre** · 47h59 → abre · 49 h → fecha.
- **E o que abre por aí não passa pelo ato.** `rotinaConversa` entra no portão
  ANTES de `pedidoDeRotina`, de propósito: é continuação de uma montagem em
  curso, e exigir o ato mataria a resposta curta da mãe ("as 7h", "sim"). O
  efeito colateral é que, na janela de 48 h, qualquer mensagem entra pelo fluxo
  da Rotina.
- **O que segura hoje:** o modelo, um passo adiante —
  `prontidao.desfecho === "nao_e_rotina"` faz `conduzirRotina` devolver null e a
  conversa cai no reativo. **INFERI** que é isso que evita o estrago na maior
  parte dos casos; **NÃO MEDI** com que frequência ele erra.
- **⚠️ ISTO É DECISÃO DE PRODUTO, NÃO DE ENGENHARIA**, e é por isso que não
  corrigi: encurtar a janela troca *estado fantasma* por *retomada perdida*. Uma
  mãe que responde no dia seguinte é comum. Não invento o número — **48 h, 12 h
  ou "só até a próxima mensagem dela"** são três produtos diferentes.
- **Critério de conclusão:** janela decidida por escrito, com o caso da mãe que
  some e volta considerado, e teste que morde nos dois lados (retomada legítima
  preservada · assunto novo não entra pelo fluxo antigo).
- **Depende de:** decisão do Sérgio.
- **Agente recomendado:** PROPOR

---

### PEND-050
**Plano não tem caminho de editar nem de reenviar**
Bloco: **A · Condução** · Prioridade: **P2** · Estado: **ABERTA · LACUNA PROVADA**
Aberta em: 2026-08-11 · Origem: fatia de autoridade do Plano (5490c24)

> **Depois de 5490c24, "ajusta aquele plano" e "manda o plano de novo" não
> geram mais um plano indevido — e também não fazem nada.**

- **VI NO CÓDIGO:** a ponte (`montarPonteWhatsApp`) só sabe GERAR. Não existe
  caminho de edição de Plano nem de reenvio do PDF/link já produzido — ao
  contrário da Rotina, que tem `editarRotina` e `entregarArtefatoImprimivel`.
- **MEDIDO, antes da correção:** `pedeUmPlano` devolvia `true` para
  "manda o plano de novo" e o turno gerava um plano **NOVO**. Ou seja: o
  reenvio nunca funcionou; ele era mascarado por uma geração duplicada.
- **Por isso `editar` NÃO abre o portão de criação do Plano** — deixá-lo abrir
  produziria um plano a mais em vez de ajustar o que existe. A correção trocou
  um comportamento errado por uma lacuna honesta, e a lacuna fica registrada.
- **Hoje esses dois atos caem na conversa**: a Ayla responde por texto, sem
  entregar nada. **NÃO MEDI** o que ela diz nesse caso.
- **Critério de conclusão:** os dois atos com desfecho próprio — reenviar o
  artefato existente, e alterar sem duplicar —, provados pelo fluxo real.
- **Depende de:** nada. **Deve ser avaliada com:** [PEND-044].
- **Agente recomendado:** PROPOR

---

### PEND-054
**A janela de lote custa 7 segundos em TODO turno do WhatsApp**
Bloco: **A · Condução** · Prioridade: **P0 de EXPERIÊNCIA** · Estado: **CONCLUÍDA em 2026-08-13 (05ca5b2)**
Aberta em: 2026-08-13 · Origem: missão de latência (97d0765)

> ⚠️ **P0 aqui é de experiência/performance, não de segurança.** Os outros P0
> desta lista são clínicos ou de acesso — família perdendo dado, criança em
> risco, mãe sem entrar. Este é "afeta todo turno do WhatsApp e degrada o
> produto inteiro", e não deve competir por urgência com aqueles. Ler os dois
> como a mesma coisa foi o que já transformou "ativado" em três conceitos
> diferentes neste repositório.

> **`lote-inbound.ts:62` dorme 7 segundos fixos antes de qualquer
> processamento, e é o maior componente isolado da latência percebida.**

- MEDIDO local (n=5), sem contar a janela: até a mãe ver algo, p50 **12,9s**.
  Somando os 7s: **~20s** no turno limpo, **~25s** com o fallback do parser.
- A janela é decisão de produto, não defeito: junta balões que a mãe manda em
  sequência, e o próprio arquivo assume o custo por escrito.
- Consulta somente-leitura pronta em `docs/bancada/janela-lote-consulta.sql`,
  com o recorte certo (burst ANTES da resposta da Ayla, não intervalo entre
  mensagens consecutivas).
- **Régua de decisão já acordada:** 3s se os casos entre 3-7s forem assunto
  novo; 4s se houver complemento real perdido em 3s; manter 5-7s só se a
  amostra qualitativa provar que junta frases do mesmo pensamento.
- Critério de conclusão: janela ajustada com base no dado, e nova medição do
  fluxo real depois.

### PEND-055
**O parser cai no modelo de fallback em parte dos turnos, e custa ~6s**
Bloco: **A · Condução** · Prioridade: **P1** · Estado: **ABERTA — não investigada**
Aberta em: 2026-08-13 · Origem: missão de latência

> **`parser.ts:197` tenta o modelo leve e, se vier null, tenta o grande EM
> SÉRIE. Disparou em 2 de 5 turnos medidos.**

- A primeira medição acusou 4 de 5, mas **era artefato de fixture**: o
  `novoId` do harness devolvia `membro-0016` e o `ParserSchema` exige
  `z.string().uuid()`. Corrigido em `0bae762`; o índice caiu pela metade.
- **NÃO SEI** por que ainda dispara nos 2 restantes: `tentar()` devolve null
  por erro de rede, JSON inválido OU schema reprovado, e não distingui.
  `prova-parser-real.test.ts` captura a resposta crua e serve pra isso.
- Só investigar DEPOIS da janela (PEND-054) e de nova medição — pode deixar de
  ser o maior gargalo.

### PEND-056
**As conquistas chegam ao prompt e a Ayla não as usa**
Bloco: **A · Condução** · Prioridade: **P2** · Estado: **ABERTA — observação de 1 caso**
Aberta em: 2026-08-13 · Origem: M1 (2cb06d6)

> **Duas conquistas relevantes foram semeadas e nenhuma foi usada nos 5 turnos
> do âncora — inclusive uma que era ponte perfeita.**

- "Contou pela primeira vez o que tinha acontecido na aula" estava disponível
  no turno em que a mãe disse "ela não consegue falar sobre isso". A Ayla
  passou por cima.
- A FIAÇÃO está provada (`conversa-e2e.test.ts`): o bloco `<ja_conquistou>`
  chega, com a instrução de uso colada. O que não aconteceu foi o USO.
- Amostra de 1. **Não corrigir com mais prompt antes de ver se repete** — o
  padrão desta base é que regra somada a regra faz a nova perder.

### PEND-057
**Paralelizar parser e classificador esbarra em nove saídas antecipadas**
Bloco: **A · Condução** · Prioridade: **P3** · Estado: **ABERTA — adiada por decisão**
Aberta em: 2026-08-13 · Origem: missão de latência

> **A independência está provada; a posição no fluxo é que não é gratuita.**

- Entre o classificador (linha ~2060) e o parser (~2530) há **9 `return`
  antecipados** (rotina, plano, PDF, aceite). Disparar o parser cedo paga uma
  chamada de Haiku descartada nesses turnos, e deixa promise órfã em serverless.
- Ganho: ~0,9s (serial 0,9+2,2=3,1s → paralelo 2,2s). Contra 4s sem custo na
  janela — um oitavo do ganho com toda a complexidade.
- Reavaliar só depois de PEND-054 e PEND-055.

### PEND-058
**Fragmentação multi-balão: a janela já não captura 72,6% dos bursts**
Bloco: **A · Condução** · Prioridade: **P1 de EXPERIÊNCIA** · Estado: **ABERTA — achado de produção, sem solução proposta**
Aberta em: 2026-08-13 · Origem: medição da PEND-054

> **A mediana do intervalo entre balões do mesmo turno é 11,2 segundos. A
> janela era de 7s e agora é de 3s — nos dois casos, a maioria das
> continuações chega DEPOIS que a Ayla já respondeu.**

- MEDIDO em produção (60 dias, 1.834 turnos): 252 são multi-balão. A janela de
  7s capturava 69 (27,4%); a de 3s captura 33 (13,1%). p75 = 18,6s · p90 = 34s.
- **Consequência que ninguém tinha medido:** ~10% dos turnos já recebiam
  resposta partida ANTES da mudança — a mãe manda *"Tem dificuldade de Tomar"*,
  a Ayla responde, e 11 segundos depois chega *"De engolir"* como turno novo.
  Com 3s isso vai a ~12%.
- **Esticar a janela NÃO é a solução:** cobrir o p90 exigiria 34 segundos de
  espera para 100% dos turnos, sendo que 86,3% têm um balão só.
- O caminho a investigar é outro: **tratar a mensagem que chega DEPOIS da
  resposta como continuação**, e não como turno novo — a Ayla já tem o
  histórico e poderia emendar em vez de recomeçar. Não implementar sem
  desenho: mexe em como o turno é definido.
- Critério de conclusão: a continuação tardia deixa de produzir duas respostas
  desconexas, sem impor espera longa a quem manda um balão só.

### PEND-059
**Contradição percebida, mas ainda não persistida — a segunda metade da fatia**
Bloco: **A · Condução** · Prioridade: **P1** · Estado: **ABERTA — depende da [PEND-053]**
Aberta em: 2026-08-13 · Origem: M3.2, regra de contradição perfil × relato

> **A Ayla passou a PERCEBER e CHECAR a contradição. Ela ainda não ATUALIZA o
> perfil nem USA a correção depois.**

- O que foi entregue e está provado: `PERCEBER → CHECAR`. Com o perfil dizendo
  "não fala", a Ayla responde *"pelo que você contou antes, a Manu não fala com
  palavras… quando você diz que ela falou, como foi isso?"*.
- O que **falta**, e é o que faz a mãe sentir que a Kolo aprende:
  `→ ATUALIZAR O PERFIL → USAR DEPOIS`. Comportamento desejado, por caso:
  - confirmou **evolução** → registrar o novo fato **com data**, sem apagar a
    história anterior (o perfil é uma linha do tempo, não um estado);
  - a mãe corrige (*"falei errado, ela não fala"*) → corrigir o dado incorreto;
  - "falou" era **apontar/gesto/prancha** → NÃO alterar para verbal;
  - ficou **ambíguo** → não salvar como fato.
- ⚠️ **NÃO é mecanismo paralelo.** Depende da [PEND-053]: o parser hoje não
  consegue endereçar boa parte dos domínios (lista manual de 9 de 20), então
  não há por onde gravar. Resolver a 053 primeiro; esta é a continuação.
- **NÃO SEI** se o mecanismo atual sabe corrigir ou remover um fato com
  segurança — só provei INSERT. Se não souber, isso vira decisão de produto
  antes de virar código.
- Critério de conclusão: os quatro casos acima provados de ponta a ponta —
  gravação correta, e recuperação no turno seguinte.

### PEND-060
**Dois Planos em segundos: a rajada fura o cooldown de 3 min**
Bloco: **A · Condução** · Prioridade: **P1 de EXPERIÊNCIA** · Estado: **ABERTA — causa identificada, sem solução proposta**
Aberta em: 2026-08-13 · Origem: achado ao corrigir o gatilho do aceite (oferta pendente × cumprida)

> **O cooldown de 3 minutos da ponte existe e está correto. Ele não pega
> turnos CONCORRENTES: as duas leituras acontecem antes da primeira escrita.**

- MEDIDO em produção (145 Planos, 53 famílias): **15 pares de Planos da mesma
  família a menos de 10 min** um do outro. Sete deles **abaixo de 120 s** —
  3 s, 4 s, 9 s, 16 s, 21 s, 32 s, 76 s. Todos os 15 são da **mesma criança**.
- **Caso Theo** (0b319cbe, 12/08, 18:08:45 → 18:08:55, **9 s**): dois inbounds
  a 15 s de distância (*"Ele comia bastante banana, uva…"* / *"Na escola tem
  comido melancia"*) abriram dois turnos concorrentes. **Nenhum dos dois era
  um "Ok"** — não passa pelo gatilho do aceite, e por isso não foi corrigido
  na fatia de 13/08.
- **Caso Matheo** (4135061b, 11/08, 13:30:27 → 13:30:59, **32 s**): mesmo
  mecanismo, com dois "Ok" a 34 s de distância. Os outros dois duplicados dele
  (13:26 e 13:30) eram o gatilho do aceite e **estão corrigidos**.
- CAUSA RAIZ, **VI NO CÓDIGO** (`ponte.ts`, freio anti-duplicata): o cooldown
  faz `select` em `ayla_messages` procurando `/auth/wa` nos últimos 3 min, e a
  mensagem que ele procura só é gravada **no fim** do turno
  (`enviarRespostaEmChunks`). Em duas invocações simultâneas, ambas leem antes
  de qualquer uma escrever. É o padrão do §8 do protocolo: *ler antes de
  escrever não basta numa rajada*.
- O caminho já existe no repositório e **não deve ser reinventado**:
  `reservarEnvioProativo` (`cadencia.ts`) e `reservarConviteAssinatura`
  (`orchestrator.ts`) — **reservar primeiro, resolver quem chegou antes**, e
  quem perde apaga a própria reserva. ⚠️ Atenção à janela da reserva: se ela
  for tão longa quanto o cooldown, uma reserva órfã silencia o fluxo por 3 min
  por uma geração que nunca aconteceu.
- ⚠️ **Não confundir com o gatilho do aceite.** Aquele era semântico (a entrega
  se reoferecia sozinha) e está resolvido; este é de concorrência e sobrevive
  a ele. Corrigir um não corrige o outro.
- Critério de conclusão: dois turnos concorrentes da mesma família produzem
  **um** Plano, provado por execução com as duas invocações em voo ao mesmo
  tempo — e o caso legítimo (dois pedidos separados por horas) continua
  gerando dois.

### PEND-052
**Patrimônio dos especialistas do app anterior — auditar o que não migrou**
Bloco: **A · Condução** · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-12 · Origem: missão do Core transversal (897f36b)

> **Os prompts dos antigos especialistas do Kolo Materno nunca foram
> comparados, item a item, com a Base Kolo atual.**

- O app anterior tinha agentes por domínio com estratégias práticas,
  atividades, formas de condução, crenças, rituais, frases prontas e perguntas
  de investigação. Parte disso virou `docs/skills/` e `boas_praticas`; **não se
  sabe o que ficou pelo caminho.**
- **NÃO É** copiar o app antigo, nem engrossar o prompt: é identificar
  patrimônio intelectual útil que possa ter se perdido na migração, e só então
  decidir onde ele entra (BP, skill, Plano — não necessariamente o núcleo).
- Critério de conclusão: uma lista, por domínio, do que existe lá e não existe
  aqui, com recomendação de destino para cada item — ou a constatação, com
  evidência, de que não há lacuna.

### PEND-053
**Aprendizado longitudinal sobre COMO a criança recebe melhor a informação**
Bloco: **A · Condução** · Prioridade: **P1** · Estado: **ABERTA — não investigada**
Aberta em: 2026-08-12 · Origem: missão do Core transversal (897f36b)

> **Se a mãe descobre "quando eu mostro primeiro e falo depois, ele entende
> muito melhor", isso chega ao próximo turno?**

- O núcleo passou a mandar a Ayla propor testes pequenos ("vamos experimentar
  mostrar em vez de falar?") e aprender com a resposta da criança. **A metade
  que fecha o ciclo — guardar a descoberta e reusá-la — NÃO foi verificada.**
- `perfil_vivo_membro` tem `aprendizado` e `como_e`, e existe incorporação
  automática (`incorporar.ts`); mas **NÃO SEI** se uma descoberta sobre FORMA
  DE INTERAÇÃO é reconhecida, classificada e gravada, nem em qual campo.
- Se não chegar, é lacuna estrutural alinhada ao diferencial da Kolo: a
  descoberta mais valiosa da conversa morre nela.
- Critério de conclusão: prova por execução de que a descoberta é gravada e
  volta ao prompt no turno seguinte — ou o desenho do menor mecanismo que faça
  isso, sem memória nova.

### PEND-051
**A conversa nunca tinha sido executada em teste**
Bloco: **A · Condução** · Prioridade: **P1** · Estado: **CONCLUÍDA em 2026-08-11 (8c42a53)**
Aberta em: 2026-08-11 · Origem: harness end-to-end (e64da15)

> **Pelo fluxo real, um pedido explícito de Rotina termina como
> `resposta_registro`, e o perfil da criança não aparece em chamada nenhuma.**

- **O harness existe agora** (`__harness/`, `conversa-e2e.test.ts`):
  `processInbound` rodando de verdade, banco em memória, modelo falso, nenhum
  envio. Antes dele, **nenhum teste executava a conversa** — os que existiam
  liam o arquivo com `readFileSync`.
- **PROVEI PELO FLUXO REAL (5):** relato conceitual não cria artefato · falar de
  rotina existente não cria outra · a pergunta do caso Mário não gera plano · a
  recusa não gera plano · troca de criança não vaza perfil do irmão.
- **NÃO CONSEGUI PROVAR (2), e é isto que esta ficha guarda:**
  1. "me ajuda a montar uma rotina para a manhã dela?" — **MEDIDO por função**,
     o portão ABRE (piso + ato `criar`); **pelo fluxo real** o turno sai como
     `resposta_registro`. Alguma coisa antes do portão decide.
  2. `perfil_vivo_membro.sensorial` não chega a chamada nenhuma, enquanto o
     **nome** da criança chega.
- **⚠️ AS DUAS LEITURAS, e nenhuma provada:** (a) lacuna do harness —
  `loadFamiliaParaEnvio` devolvendo null porque a fixture não tem os campos que
  ele lê, e o bloco caindo fora em silêncio; (b) defeito real de roteamento e de
  recuperação. **A hipótese (a) já foi descartada uma vez** neste mesmo teste (a
  fixture escrevia em `categorias_extras`, que só é lido para chaves de TEMAS) e
  o resultado não mudou — então ela não pode ser assumida de novo por
  conveniência.
- **Os dois cenários estão `it.skip` com a dúvida escrita no corpo**, não
  apagados. Nada deve ser corrigido com base neles antes da causa localizada.
- **⚠️ ENQUANTO ISTO NÃO FECHAR, a Rotina NÃO está provada de ponta a ponta** —
  só nos portões.
- **✅ BAIXA (2026-08-11, 8c42a53).** Causa localizada e etiquetada: **os dois
  itens eram do HARNESS**, e a hipótese de defeito de produto está **REFUTADA**.
  - Item 1 — `client.messages.create is not a function`. O duplo só implementava
    `.stream()`; intenção, prontidão e condutor usam `.create()`. **O portão da
    Rotina TINHA aberto** — a prontidão só é chamada lá dentro. Rastreado pelo
    log real do turno.
  - Item 2 — duas falhas em sequência na fixture: o **lugar** (`categorias_extras`
    só é lido para chaves de TEMAS) e a **forma** (`resumoCampoKV` exige
    `{ texto }`; string pura cai fora em silêncio — a mesma forma da PEND-033).
    **PROVEI POR EXECUÇÃO** que o perfil chega: `<o_que_ja_sabemos_da_crianca>`
    com "barulho alto" e "acorda 6h30".
- **⚠️ E A SABOTAGEM DESMENTIU O PRÓPRIO ARQUIVO:** reverter o portão de criar ao
  piso puro mantinha os cenários VERDES — com a prontidão no padrão, o modelo
  devolvia "orientação" e nada era publicado. O teste media o MODELO, não o
  portão. Corrigido: A e E forçam `prontidao="suficiente"`, e a sabotagem morde.
- **Fica aberto em outra ficha, não nesta:** deixar uma pergunta PENDENTE pelo
  fluxo real exige um duplo que escreva a fala do condutor — ver [PEND-049].
- **Critério de conclusão (cumprido):** causa localizada e etiquetada (harness × produto);
  se for produto, correção com regressão; se for harness, fixture corrigida e os
  dois cenários verdes.
- **Depende de:** nada.
- **Agente recomendado:** INVESTIGAR

---

### PEND-046
**O turno seguinte não enxerga a resposta ainda em voo**
Bloco: **A · Condução** · Prioridade: **P1** · Estado: **ABERTA · CAUSA PROVADA**
Aberta em: 2026-08-11 · Origem: caso Mário (WhatsApp, produção)

> **A Ayla repetiu a orientação inteira e reabriu a identidade porque, no
> momento em que montou o contexto, a própria resposta anterior ainda não
> existia no banco.**

- **EVIDÊNCIA — timestamps reais, correlacionados por `processada_em` e não por
  proximidade:**

  ```
  19:53:22.977  INBOUND A   "não quer sair do quarto, sonolento"
  19:53:34.161  A CLAIMA    (dormiu os 7 s da janela; nada mais novo)
  19:53:38.301  INBOUND B   "Sim"        ← 4,1 s DEPOIS do claim de A
  19:53:46.119  B CLAIMA    (nada mais novo — turno legítimo e separado)
  19:53:54.309  OUTBOUND 1  resposta de A é ENVIADA e persistida
  19:54:03.974  OUTBOUND 2  resposta de B
  ```

  **B montou o contexto 8,2 segundos ANTES de a resposta de A existir.** Para
  B, aquilo nunca tinha sido dito — então ela reofereceu a mesma estratégia
  ("missão curta", "portão") e reabriu "estamos falando do Mario?".

- **⚠️ O QUE ISTO NÃO É**, e cada uma dessas leituras foi descartada por prova:
  - **não é duplicidade de webhook** — dois `zaap_message_id` distintos, dois
    textos distintos da mãe;
  - **não são dois produtores do mesmo turno** — o claim atômico funcionou:
    A → OUTBOUND 1, B → OUTBOUND 2, um inbound para cada resposta;
  - **não é falha do lote** — `JANELA_SILENCIO_MS = 7000` e B chegou **15,3 s**
    depois de A. Dois turnos genuinamente separados;
  - **não é erro do modelo** — ele respondeu bem ao contexto que recebeu; o
    contexto é que estava incompleto no tempo.
- **CLASSE CORRETA: leitura temporalmente incompleta do histórico enquanto
  existe resposta em voo.** O lote protege contra *dois processarem a mesma
  mensagem*; **nada protege contra um processar sem ver a resposta em voo**.
- **⚠️ AUMENTAR `JANELA_SILENCIO_MS` NÃO É SOLUÇÃO ACEITA.** Agrupar A e B
  exigiria uma janela de 16 s, e isso faria **toda família** esperar 16 s por
  qualquer resposta. Duplicação não se resolve com atraso artificial para
  todos — a latência percebida já é P50 22,4 s.
- **A correção provável toca ORDENAÇÃO/COORDENAÇÃO** entre processamento e
  persistência: persistir o outbound antes de liberar o claim seguinte, ou o
  claim esperar enquanto houver processamento em voo para a mesma família.
  **Nenhuma das duas foi investigada.**
- **⚠️ BLAST RADIUS ALTO, e há uma dependência de ordem:** a correção mexe no
  **caminho crítico de latência**, que está sendo instrumentado e medido agora.
  Qualquer mudança aqui **precisa ser avaliada junto com [PEND-038]** — pode
  aumentar ou reduzir o tempo percebido, e mexer nele antes de ter os dados
  alteraria o próprio objeto da medição.
- **Relação com [PEND-045], e são DEFEITOS INDEPENDENTES que se somaram:** na
  mesma conversa houve **três** reaberturas de identidade. Duas (19:10 e 19:51)
  aconteceram **sem concorrência nenhuma** e são da PEND-045 (pronome perde a
  criança). A terceira (19:54) é desta ficha. Se a identidade estivesse
  perfeita, a repetição de CONTEÚDO ("missão curta", "portão") teria acontecido
  do mesmo jeito.
- **CRITÉRIO DE BAIXA:** reproduzir dois turnos legítimos próximos, com o
  segundo chegando **enquanto o primeiro ainda está gerando**, e provar que o
  segundo **enxerga a resposta anterior**, **ou espera de forma controlada**,
  **ou invalida e recalcula o contexto** — sem criar atraso artificial para
  todos os turnos.
- **Depende de:** nada. **Deve ser avaliada com:** [PEND-038].
- **Agente recomendado:** INVESTIGAR

---

### PEND-045
**O pronome perde a criança logo depois de uma ação inequívoca sobre ela**
Bloco: **A · Condução** · Prioridade: **P1** · Estado: **ABERTA · CAUSA PROVADA**
Aberta em: 2026-08-11 · Origem: auditoria do caso Mário (WhatsApp, produção)

> **A Ayla acabou de gerar um Plano para uma criança e, 41 segundos depois,
> perguntou de qual das duas a mãe estava falando.**

- **A LINHA DO TEMPO REAL**, lida em `ayla_messages` e `planos` (família com dois
  filhos, Mário e Manu):

  ```
  19:08:32  MÃE   membro=MARIO  "plano para melhorar a comunicação do Mário"
  19:09:54        ── plano criado, planos.membro_atipico_id = MARIO ──
  19:09:57  AYLA  membro=MARIO  "Vamos trabalhar a comunicação do Mario…"
  19:10:35  MÃE   membro=NULL   "…você salvou o que sobre ELE?"
  19:10:53  AYLA  membro=NULL   "você está falando do Mário ou da Manu?"
  ```

- **O plano estava CERTO.** Conferido no banco, não pelo título:
  `planos.membro_atipico_id = MARIO`. O que se perdeu foi o turno seguinte.
- **CAUSA (VI NO CÓDIGO).** `resolverMembroAlvo({ texto, membros,
  membroContexto })` resolve pelo NOME no texto; o contexto vem de
  `criancaDaConversa`, que devolve a última mensagem com membro não nulo nas
  **últimas 2 horas**. Às 19:10 essa janela alcançava Mário (19:09:57) **e**
  Manu (18:34:23), e o pronome "ele" não desempata.
- **⚠️ O DEFEITO NÃO É A JANELA.** É que **a ação que a Ayla acabou de executar
  não conta como contexto**. Gerar um Plano para o Mário é o sinal mais forte
  possível de quem é o assunto — e a resolução do turno seguinte não olha para
  ele. Aumentar a janela pioraria: alcançaria mais o irmão, não menos.
- **Alcance:** qualquer família com dois filhos em que a mãe use pronome depois
  de uma ação sobre um deles. **WhatsApp** — na web o membro vem da conversa,
  que é fixa por `conversa_id`.
- **⚠️ O QUE A CORREÇÃO NÃO PODE SER:** regex de "ele/ela" apontando para o
  último filho; janela maior; "o último membro mencionado sempre vence". Duas
  crianças do mesmo gênero derrubam a primeira; as outras duas aumentam o risco
  de **contaminar um irmão com o contexto do outro**, que é a regra mais dura
  desta base (`membro-escopo.ts`).
- **Critério de baixa:** os sete golden cases (nomeado · ação anterior ·
  mudança explícita · dois alvos na mesma frase · ambiguidade real · mesmo
  gênero · português informal) passando, com sabotagem: **remover a âncora da
  ação anterior tem que fazer o caso Mário falhar de novo**.
- **Ligada a** [PEND-037] (mesmo turno, achado diferente). **Depende de:** nada.
- **Agente recomendado:** VS Code

---

### PEND-044
**A Kolo manda a família para fora antes de tentar ajudar diretamente**
Bloco: **A · Condução** · Prioridade: **P1** · Estado: **ABERTA**
Aberta em: 2026-08-11 · Origem: caso real (lição que a criança não sabia fazer)

> ⚠️ **Esta ficha NÃO é "pedir foto".** Foto é um dos meios; o defeito é de
> ordem — a Ayla terceiriza antes de verificar se ela própria resolve.

- **O caso.** A família disse, em essência, *"tem uma lição que ele não sabe
  fazer"*. A Ayla propôs dividir a tarefa, trabalhar autonomia, **mandar
  mensagem para um colega** e **depois para a professora/coordenação**. A ação
  mais direta não apareceu: *"me manda uma foto da lição — eu olho com você o
  que está sendo pedido e ajudo a pensar em como explicar para ele"*.
- **TRÊS CAMADAS, e elas têm donos diferentes:**
  1. **Princípio de condução** — antes de mandar procurar professora, colega ou
     terapeuta, verificar se a Kolo consegue ajudar com o que já tem.
     **VI NO CÓDIGO: este princípio não existe.** Procurado em
     `conducao/diretrizes.ts`, `formas.ts`, `composicao.ts` e `ia/prompt.ts`.
  2. **WhatsApp** — recebe e lê imagem (`ayla/responder.ts`, base64 ao modelo),
     e tem um bloco `<foto>` muito bom. Mas ele é **condicional a
     `params.imagemUrl`**: só entra quando a foto JÁ chegou. **A Ayla descobre
     que pode ver uma lição depois que a lição chegou** — o inverso do útil.
  3. **Web** — **não recebe imagem**. Nem rota, nem upload. Prometer "me manda
     uma foto" na web seria promessa falsa, e é por isso que a regra não pode
     ser só de prompt.
- **⚠️ NÃO CRIAR "se aparecer 'lição', peça foto".** A classe funcional é
  **"o obstáculo é um artefato que existe e pode ser inspecionado"**. Casos de
  contraste que a regra precisa separar: *"não entendemos esta questão"* (foto
  ajuda) · *"recebi este comunicado e não entendi"* (ajuda) · *"não sei quando
  é a prova"* (não resolve) · *"ele não consegue fazer amigos"* (inadequado) ·
  *"ele fez este desenho e fiquei preocupada"* (relevante, com os limites que
  já existem).
- **O comportamento desejado**, e ele é condicional ao canal: *"Você tem a
  lição aí? Se estiver falando comigo pelo WhatsApp, tira uma foto e me
  manda."* — só quando ver o material realmente mudar a qualidade da
  orientação.
- **Ligada a** [PEND-037] (a mesma resposta trouxe afirmações não rastreadas).
- **Critério de baixa:** os cinco casos de contraste passando em bancada
  semântica, nos DOIS canais, com a web não prometendo o que não pode cumprir.
- **Agente recomendado:** INVESTIGAR

---

### PEND-043
**Ter objetivo ≠ gerar Plano — falta decisão compartilhada de valor**
Bloco: **D · Entregas** · Prioridade: **P1** · Estado: **ABERTA**
Aberta em: 2026-08-11 · Origem: portão da PEND-035

> **O Plano deve ser artefato de CONSOLIDAÇÃO, não resposta automática a toda
> dificuldade relatada.**

- **São DUAS perguntas, e hoje só existe meia resposta para uma delas:**
  1. **SUFICIÊNCIA** — "temos informação para gerar um Plano útil?"
  2. **VALOR DE CONSOLIDAÇÃO** — "há valor em organizar isto num artefato, em
     vez de continuar na conversa?"
- **O QUE EXISTE HOJE (VI NO CÓDIGO), e os canais discordam:**
  - **Web** (`conversar/actions.ts`): **nenhum gate**. A mãe clica, o Plano
    nasce, sobre o que quer que o objetivo tenha elegido.
  - **WhatsApp** (`ayla/ponte.ts`): quatro freios de ENVIO (cooldown, janela de
    20h, mínimo de mensagens, mensagem curta) **mais** um gate de suficiência
    real — `avaliarProntidaoParaPlano`, com `CRITERIO_SUFICIENCIA` escrito em
    linguagem de produto num lugar só. Pedido explícito pula tudo.
  - **Nenhum dos dois responde a pergunta 2.** Suficiência ≠ valor.
- **Critério de valor a investigar — sem virar checklist obrigatório:** outra
  forma de enxergar o problema · padrões observados · competências já
  existentes · barreiras · crenças envolvidas (sem tratá-las como fatos) ·
  estratégias · brincadeiras · atividades · frases · o que observar ·
  progressão ao longo de dias. **Não exigir todas.**
- **Resolve-se na conversa, e não vira Plano:** uma ideia · uma frase · um
  ajuste simples · interpretar uma situação · entender uma tarefa · decidir o
  próximo passo.
- **⚠️ PEDIDO EXPLÍCITO NÃO PODE VIRAR BUROCRACIA.** Se a mãe pede o Plano, a
  resposta não é negar: é **ajudar primeiro, fazer UMA pergunta de alto valor
  se faltar um dado decisivo, e gerar em seguida**. Prontidão governa a
  OFERTA espontânea; não é veto contra quem pediu.
- **⚠️ E não transportar política de ENVIO do WhatsApp para a Web.** Cooldown e
  janela de 20h são regras de proatividade, não de valor do artefato. Confundir
  as duas faria um clique herdar um cooldown que não faz sentido.
- **Dono provável:** um `lib/conducao/prontidao.ts` puro (`Turno[] → Prontidao`)
  ao lado de `objetivo.ts` — a mesma dupla, os mesmos dois canais.
- **Ligada a** [PEND-035] (fechada), [PEND-039]. **Depende de:** nada.
- **Critério de baixa:** os casos "problema simples" e "caso que merece Plano"
  decididos igual nos dois canais, provados por execução, e o pedido explícito
  nunca bloqueado.
- **Agente recomendado:** INVESTIGAR

---

### PEND-042
**58% dos turnos de WhatsApp saem sem uma linha de repertório**
Bloco: **B · Conhecimento** · Prioridade: **P1** · Estado: **ABERTA · MEDIDA, CAUSA DESCONHECIDA**
Aberta em: 2026-08-11 · Origem: leitura pós-rollout de `eventos_app`

- **MEDIDO**, últimas 24h antes do rollout geral: dos **64** eventos
  `conhecimento_consultado` no canal WhatsApp, **37 saíram com zero boas
  práticas** — `motivo_vazio: sem_skill` em **31**, `acervo_vazio` em **6**. A
  Ayla respondeu sem uma linha do acervo em mais da metade das conversas.
- **⚠️ NÃO CONCLUIR QUE FALTA CONTEÚDO.** O número diz que o repertório não
  chegou; não diz por quê. Trocar prompt ou mexer na base agora seria corrigir
  um sintoma cuja causa ninguém olhou — e `sem_skill` sequer é sobre acervo: é
  sobre a etapa anterior, o roteamento.
- **A investigação tem que separar cinco coisas**, que hoje estão somadas num
  contador só:
  1. **`sem_skill`** — o turno não roteou para skill nenhuma. Por quê? Fala
     curta? Confirmação? Desabafo (onde o vazio é correto, ver
     [PEND-BIA-desabafo] na base BIA)? Ou falha do classificador?
  2. **`acervo_vazio`** — roteou, e não havia BP para aquela skill+faixa etária.
  3. **falha de roteamento** — roteou para a skill errada e o vazio é
     consequência.
  4. **recuperação e filtros** — faixa etária, `statusAceitos`, `limite` e o
     ranking podem estar cortando material que existe.
  5. **ausência real de material adequado** — a única das cinco que justifica
     mexer na base.
- **Anterior ao rollout**, e portanto não é regressão dele. Mas é grande demais
  para seguir sem ficha.
- **📊 MEDIDO EM 11/08/2026, e o quadro mudou.** Ampliado para 7 dias: **222
  eventos, 85 vazios (38%)**. Classificados pela causa real, não pelo rótulo:

  | causa | n | onde |
  |---|---|---|
  | **não houve skill real** | **54** | **100% WhatsApp** |
  | acervo sem material (`meu_bem_estar`, 0 BPs) | 19 | WhatsApp |
  | filtro de idade zerou | 12 | ambos |

- **Os canais não têm a mesma causa:** WhatsApp **63%** de vazios em 120 turnos;
  web **10%** em 105 — e **zero** "sem skill" na web.
- **O filtro de idade é real mas minoritário** (14% dos vazios). Ainda assim
  descarta muito: aos 8 anos, `sono` perde **89%** do acervo, `nutricional` 85%,
  `sensorial` 82%.
- **`organizacao` NÃO é skill** — é rótulo de intenção. Consultar o recuperador
  com ele devolve vazio porque não existe skill com esse nome.
- **⚠️ Os 54 continuam FECHADOS.** `conhecimento_consultado` não guarda relato
  nem intenção detectada — sem isso não dá para separar roteamento × contexto
  perdido × fluxo especial. **Depende de [PEND-040].**
- **Critério de baixa:** os 54 classificados por causa, com evidência; e, para os
  que forem defeito, a causa localizada no código. Um número que continue
  somando fenômenos diferentes não fecha nada.
- **Ligada a** [PEND-017]. **Depende de:** nada.
- **Agente recomendado:** INVESTIGAR

---

### PEND-041
**✅ BAIXADA · O rastro do canal web não distinguia conversa de artefato**
Bloco: **H · Governança** · Prioridade: **P2** · Estado: **CONCLUÍDA · EM PRODUÇÃO**
Baixada em: 2026-08-11 · `dbb3c59` (PR #93)
Aberta em: 2026-08-11 · Origem: leitura pós-rollout de `eventos_app`

- **O caso, e ele quase virou um laudo errado.** Lendo o rastro de 11/08, os 68
  eventos do canal `web` apareciam com `n_enviados: 3` enquanto a MESMA família
  aparecia com `2` no WhatsApp. Dois BPs é o corte da 4A; três é o
  comportamento sem ela. A leitura direta seria "a 4A está ligada num canal e
  desligada no outro para a mesma família" — divergência grave.
- **Não era.** Foi preciso ler o código para desfazer: os eventos web em rajada
  (quatro no mesmo segundo) são geração de artefato, que passa por
  `respondAsOutputType` e não passava `relato`. Conversa e artefato compartilham
  o rótulo `canal: "web"` em `montarRastro`, e nada no evento os separa.
- **O custo disto não é teórico:** um rastro que exige leitura de código para
  ser interpretado não serve para o que ele existe — descobrir o que aconteceu
  sem depender da reclamação de uma família.
- **✅ PROVADO EM PRODUÇÃO (11/08/2026).** Conversa web real às 16:31:39 BRT,
  correlacionada por horário e pelo título da conversa. O registro em
  `api_calls` traz `feature: "conversa_web"` **e** `meta.origem: "conversa"` —
  "web" diz por onde entrou, "conversa" diz o que era. Baseline antes do teste:
  **zero registros de `conversa_web` em todo o histórico**.
- **⚠️ O QUE A BAIXA NÃO COBRE.** A distinção existe em `api_calls`. No rastro
  `conhecimento_consultado` (`eventos_app`) o rótulo continua sendo só o canal —
  e foi lá que a ambiguidade quase produziu um laudo errado. Essa metade vive
  em [PEND-040], que segue aberta.
- **Ligada a** [PEND-040]. **Depende de:** nada.
- **Agente recomendado:** VS Code

---

### PEND-040
**Observabilidade de IA — a conversa Web e o Plano não existem em `api_calls`**
Bloco: **H · Governança** · Prioridade: **P1** · Estado: **ABERTA**
Aberta em: 2026-08-11 · Origem: prova pós-rollout que não pôde ser feita

> **É o que impede provar em produção o que se acabou de liberar.** O rollout
> geral de 11/08 (GPT + 4A para todos) não pode ser confirmado por dado: o
> canal onde ele mais aparece é justamente o que não registra nada.

- **MEDIDO:** `api_calls` com `feature = "conversa_web"` em **todo o histórico:
  ZERO**. E não é falta de uso — no mesmo período há **68 eventos de
  conhecimento no canal web**. As conversas acontecem; o registro de provider,
  modelo e custo não chega ao banco.
- **VI NO CÓDIGO** que a rota de streaming *pretende* registrar: `feature:
  "conversa_web"` está em `app/api/conversar/stream/route.ts`. **NÃO SEI** por
  que a linha não produz registro — pode ser o `tracking` não chegar, o
  `logarUsoApi` engolir o erro por design, o caminho de streaming terminar antes
  da gravação, ou a resposta sair por outro ramo. **A causa não foi
  investigada.**
- **MEDIDO, e é o mesmo defeito com outra cara:** `api_calls` de **Plano:
  ZERO**, em todo o histórico. O Plano gasta **8 chamadas Claude por geração** e
  nenhuma é contabilizada. Some do custo real e some da prova de que ele
  continua em Claude — que é uma das garantias que este rollout deu por escrito.
- **O que se quer poder provar, por chamada:** canal · feature · provider ·
  modelo · duração · sucesso ou falha · fallback · tokens · custo quando
  disponível · família e conversa quando aplicável. Hoje o WhatsApp entrega
  parte disso e os outros dois não entregam nada.
- **✅ CAUSA PROVADA E METADE CORRIGIDA (11/08/2026).** A rota web chamava
  `logarUsoApi` com o cliente da **sessão da família** (anon key); `api_calls` é
  tabela de auditoria e a RLS recusa o insert. O erro voltava em `error` e o
  `console.warn` morria com a retenção do stdout. O WhatsApp nunca teve o
  problema porque roda em service role. Corrigido em `dbb3c59`: o privilégio
  ficou numa linha (só o billing), e a falha passou a persistir como
  `billing_nao_gravou` via `logEvent`. **Provado em produção**: conversa web
  real às 16:31:39 BRT, `openai/gpt-5.6-luna`, `ms=20111`.
- **🔎 O PRÓPRIO MECANISMO ACHOU O SEGUINTE, no mesmo turno:**
  `classificar_intencao` falha pela MESMA RLS (19:31:18Z, registrado). Roda em
  todo turno de conversa web e nunca foi contabilizada. **Não corrigido.**
- **⏱️ INSTRUMENTAÇÃO DO TURNO DO WHATSAPP, em três fatias:** piloto
  (`parser` + `responder`, `af52fa9`), A1 (quatro auxiliares, `2cb24ba`), A2
  (proativo com `envio_id`, `cd49c59`). **6 dos 9 call-sites** do turno gravam
  `ms`, `tentativas` e correlação. Falta a **A3** — `classificar-area` e
  `ayla_audio`, este último rodando ANTES de `processInbound`.
- **⚠️ O RESTO SÓ DEPOIS DE MEDIR.** Acrescentar instrumentação por cima de uma
  que falha em silêncio seria repetir o erro que a [PEND-033] documentou — foi
  por isso que a causa veio antes da correção.
- **Critério de baixa:** uma conversa web real e uma geração de Plano real
  aparecendo em `api_calls` com provider, modelo e duração, conferidas contra o
  horário do turno.
- **Ligada a** [PEND-038], [PEND-041]. **Bloqueia:** a prova pós-rollout de
  provider na Web e no Plano.
- **Agente recomendado:** INVESTIGAR

---

### PEND-039
**Bancada permanente de golden cases — quatro casos que medem sete coisas de uma vez**
Bloco: **A · Condução** · Prioridade: **P1** · Estado: **ABERTA · DESENHADA**
Aberta em: 2026-08-11 · Origem: decisão de 11/08/2026

> **A regra que ela existe para impor:** não gastar 40 chamadas para descobrir
> um problema isolado. Já temos casos bons; cada um deles morde várias
> dimensões ao mesmo tempo.

- **Os quatro casos, e por que cada um entra:**

  | caso | vem de | o que ele morde |
  |---|---|---|
  | **Manu** — "quero ler com ela e ela não fica sentada"; depois "quando anda, começa a correr" | conversa real, 11/08 | objetivo × barreira · contexto recente prevalece · fato × hipótese · repetição |
  | **Tito/LEGO** — "ele não consegue focar", perfil com 2h de LEGO | sintético, 11/08 | competência preservada · não presumir incapacidade · usar a força como alavanca |
  | **Bia** — silêncio com pares, fala com adultos, `sons: não`, `luz: não` | sintético, Golden Case L | nível demonstrado é o piso · negativo respeitado · personalização funcional × decorativa |
  | **relato vago** — a mãe diz pouco e o perfil está quase vazio | a construir | não presumir incapacidade na ausência de dado · identificar a informação que MUDA a intervenção · não inventar |

- **O que se mede em CADA caso, num juízo só** (não um juiz por dimensão):
  objetivo preservado · competência percebida · negativo respeitado · nível
  respeitado · fato × hipótese rastreado · diversidade funcional entre seções ·
  repetição · seleção (poucas propostas de alto valor).
- **⚠️ Nada de teste por presença de palavra.** Julgamento semântico, cego,
  critério escrito antes de rodar. Regex serve para prender decisão estrutural
  no código, não para avaliar um plano.
- **Três execuções por braço** onde a decisão for bloqueante — [PEND-032].
- **O ANTES é congelado em `docs/bancada/`** e reusado; só o DEPOIS se paga a
  cada rodada. É o que tornou a 3b barata de medir.
- **Depende de:** nada. **Bloqueia:** a próxima fase de inteligência do Plano
  ([PEND-035], [PEND-036], [PEND-037]) — sem ela, cada correção custa uma
  bancada nova.
- **Agente recomendado:** VS Code

---

### PEND-038
**Latência percebida no WhatsApp — e a resposta que chega em vários balões**
Bloco: **A · Condução** · Prioridade: **P1 pós-rollout** · Estado: **ABERTA · NÃO MEDIDA EM PRODUÇÃO**
Aberta em: 2026-08-11 · Origem: teste real (Karina/Manu, 11:25–11:28)

> **Paralela à 3b, não depois dela.** Não adianta a inteligência melhorar se a
> mãe sente que "demora e depois despeja texto".

- **O caso.** Entre 11:27 e 11:28 houve espera perceptível, e a resposta chegou
  em **vários balões seguidos**. A percepção é de peso, não de cuidado.
- **Medir separadamente**, no caminho real, antes de otimizar qualquer coisa:
  tempo até começar a responder · tempo total · chamadas ao roteador · chamadas
  ao modelo · queries · geração do Plano · geração do PDF · envio ao WhatsApp ·
  **número de balões**.
- **E separar as três latências**, que hoje se confundem numa só queixa:
  a da conversa · a da geração do Plano · a do PDF e do envio.
- **⚠️ O NÚMERO QUE CIRCULA É DE BANCADA, E É DO PLANO — não da conversa.** Os
  **44,0 s** (sem 4A) e **56,0 s** (com 4A) medidos em 11/08 são a geração de um
  Plano completo em bancada: 8 chamadas ao modelo Claude com `thinking`, em
  lotes, sem PDF e sem envio. **Não explicam a demora que a família sente na
  conversa**, e usá-los para isso mandaria a investigação para o lugar errado.
- **CONTINUAM NÃO MEDIDAS, depois do rollout geral de 11/08:** latência da
  conversa **Web**, latência da conversa **WhatsApp** e latência do **Plano
  real** em produção. Até 16:39Z do dia do rollout não houve um único turno
  posterior ao redeploy — `api_calls` e `eventos_app` vazios no período.
- **E há um obstáculo material para medir**, que precisa cair antes: a conversa
  Web e o Plano não registram nada em `api_calls` ([PEND-040]). Sem isso, "tempo
  de resposta em produção" não tem de onde sair.
- **⚠️ Não otimizar por hipótese.** Primeiro medir.
- **Trilha PARALELA de performance.** Não espera a inteligência do Plano ficar
  pronta, e não é medida junto com ela — as duas frentes se atrapalham quando
  compartilham a mesma bancada.
- **Depende de:** nada. **Não bloqueia** a 3b.
- **Agente recomendado:** VS Code

---

### PEND-037
**Fato × hipótese — o Plano afirma causas sem fonte rastreável**
Bloco: **D · Entregas** · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-11 · Origem: teste real (Karina/Manu)

- **O caso.** O PDF afirma que a criança tem "bastante desafio de coordenação
  global", que "o corpo pega velocidade antes que ela perceba" e que andar
  funciona "como ignição". Podem ser boas hipóteses — mas aparecem como
  **explicações estabelecidas**, e a mãe não tem como distinguir.
- **A auditoria é de rastreio**, não de correção: cada afirmação causal recebe
  uma origem — **PERFIL · BASE · INFERÊNCIA · SEM FONTE IDENTIFICADA**.
- **Por que importa mais aqui do que na conversa.** O Plano vira PDF, é salvo,
  impresso e mostrado a terapeuta e escola. Hipótese que atravessa esse caminho
  vestida de fato passa a circular como laudo.
- **Ligada a** [PEND-027]. **Depende de:** nada.
- **Fase:** próxima fase de inteligência do Plano — selecionar melhor,
  manter o objetivo certo, respeitar o que acabou de ser aprendido e não
  repetir a mesma ideia sete vezes. **O problema do Plano não é mais falta
  de conteúdo.** Provar a origem antes de alterar prompt ou código.
- **❌ CASO MÁRIO — FALSO POSITIVO, DESCARTADO POR INVESTIGAÇÃO (11/08/2026).**
  Eu havia registrado aqui as afirmações sobre o Mário (*"trava antes de
  começar"*, *"a preocupação com errar"*) como suspeita de extrapolação.
  **Rastreei o perfil real e não é extrapolação — é leitura do que a família
  registrou.** O campo `comunicacao` do perfil dele diz, textualmente:

  > *"Conversa bem… Antecipa falha em interações com estranhos (porteiro,
  > jardineiro, merendeira) e não tenta; crença limitante que protege
  > autoimagem. Copia palavras com perfeição quando vê o modelo, mas não
  > consegue escrever sem referência visual."*

  E `foco` diz *"Funciona melhor em passos curtos"*. As cinco afirmações
  auditadas — *conversa bem · copia modelos visuais · sensação de que vai
  falhar · passos curtos · referências visuais* — são **FATO**, quase verbatim.
  Até a "estratégia de proteção" está escrita no perfil.
- **O que sobra do caso é de REDAÇÃO, não de origem:** o Plano deu voz de
  primeira pessoa (*"eu acredito que vou falhar"*) a algo que a família
  registrou em terceira. Isso é a PEND-043/superprompt, não extrapolação.
- **⚠️ E fica a lição de método:** eu suspeitei pelo padrão medido em outros
  casos e quase deixei uma ficha apontando para o lugar errado. **Ficha errada
  custa mais caro que ficha ausente** — foi por isso que este achado foi
  removido em vez de amaciado.
- **A ficha continua aberta SOMENTE pelos casos medidos**, que são outros:
  *"gosta de brincar de caixa"* → *"domina o papel de caixa"*, e a corrida da
  Manu virando *"adora correr"* / *"a corrida regula seu corpo"* (2 de 4 na
  bancada de 11/08).
- **⚠️ O NOME DO DEFEITO MUDA A CORREÇÃO.** O que a bancada mediu (2 de 4 casos)
  não é "hipótese apresentada como fato": é **EXTRAPOLAÇÃO** — `interesse →
  competência` ("gosta de brincar de caixa" virou "domina o papel de caixa"),
  `ocorrência → preferência` (a corrida apareceu na situação e virou "adora
  correr"), `comportamento → função` ("a corrida regula seu corpo"). Uma regra
  contra "não invente" não alcança nenhum dos três: o modelo não inventou do
  nada — ele **promoveu um dado de categoria**.
- **Ligada a** [PEND-044] (o caso Mário veio da mesma resposta).
- **Agente recomendado:** VS Code

---

### PEND-036
**O contexto mais recente não prevalece — o Plano reoferece o que a conversa acabou de descartar**
Bloco: **D · Entregas** · Prioridade: **P1** · Estado: **ABERTA**
Aberta em: 2026-08-11 · Origem: teste real (Karina/Manu)

- **O caso, e ele é limpo.** Na conversa a Ayla sugeriu ler caminhando; a mãe
  respondeu que **andar já vira corrida**; a Ayla corrigiu para movimento sem
  deslocamento — acertou. O **Plano gerado logo em seguida** voltou a propor
  percurso andando, pular durante a leitura e "Tartaruga e Coelho" com corrida
  de 3 segundos.
- **A hipótese a provar (não assumir).** O Plano recebe o objetivo da conversa
  (Fatia 2), mas talvez não receba as **restrições** que a conversa descobriu —
  e uma restrição descoberta no turno anterior é o dado mais fresco que existe.
- **Não corrigir antes de mostrar a causa.** Pode ser o enquadramento do
  objetivo, o corte de contexto (`TETO_CONTEXTO`), ou as seções raciocinando
  sobre o desafio original sem o que veio depois.
- **Ligada a** [PEND-027], [PEND-035]. **Depende de:** nada.
- **Fase:** próxima fase de inteligência do Plano — selecionar melhor,
  manter o objetivo certo, respeitar o que acabou de ser aprendido e não
  repetir a mesma ideia sete vezes. **O problema do Plano não é mais falta
  de conteúdo.** Provar a origem antes de alterar prompt ou código.
- **Agente recomendado:** VS Code

---

### PEND-035
**✅ BAIXADA · O objetivo do Plano confundia BARREIRA com OBJETIVO FINAL**
Bloco: **D · Entregas** · Prioridade: **P1** · Estado: **CONCLUÍDA · EM PRODUÇÃO**
Baixada em: 2026-08-11 · `09d5aa2` (PR #92)
Aberta em: 2026-08-11 · Origem: teste real (Karina/Manu)

- **O caso.** A conversa começou em *"quero ler com ela e ela não fica
  sentada"*. Apareceu um dado: *"quando anda, começa a correr"*. O Plano saiu
  com o título **"Controlar a velocidade ao andar"**.
- **A corrida era um DADO DO PROBLEMA, não o objetivo.** O objetivo fiel seria
  algo como *"participar de momentos de leitura, encontrando uma forma de
  regular o movimento sem perder o envolvimento com a história"* — e
  "controlar a velocidade" é, no máximo, estratégia intermediária.
- **A distinção que falta ser explícita em algum lugar:**
  **OBJETIVO FINAL × BARREIRA OBSERVADA × ESTRATÉGIA INTERMEDIÁRIA.** A última
  informação da conversa costuma ser a barreira, e é ela que está virando
  título.
- **⚠️ Isto é da Fatia 2** (`lib/conducao/objetivo.ts`), não da 3b: o objetivo
  já chega ao Plano, e chega estreito. A 3b enriquece o contexto; não conserta
  um alvo errado — e alvo errado com contexto rico produz um documento melhor
  sobre a coisa errada.
- **✅ CORRIGIDA EM 11/08/2026 — o contrato de TRÊS NÍVEIS.** `objetivo.ts`
  distingue **objetivo-raiz** (só muda por decisão: vontade, escolha,
  prioridade, mudança ou aceite de oferta), **focoAtual** (só por confirmação;
  `null` é o padrão e é correto) e **barreiras** (tudo o que a família
  descreveu, rotulado e entregue ao Plano como material de estratégia). A regra
  deixou de ser *"a fala mais recente vence"* e passou a ser **"a DECISÃO mais
  recente vence"**.
- **PROVAS:** 30/30 casos semânticos (tangente, dispensa, mudança real,
  prioridade, conversa longa, contrato aditivo) · **SABOTAGEM**: restaurada a
  regra antiga, **7 testes ficam vermelhos** · **PIPELINE COMPLETO** (conversa →
  objetivo → enquadramento → 8 chamadas do Plano):

  | | ANTES | DEPOIS |
  |---|---|---|
  | objetivo eleito | "Quando anda, ja comeca correr" | "Mas eu quero ler…" |
  | título do plano | "Quando anda, já começa a correr" | **"Ler junto com a criança"** |
  | `OBJETIVO_PRESERVADO` | NAO | **SIM** |
  | útil para a mãe | **1/5** | **3/5** |
  | veredito | FAIL | PASS_PARCIAL |

- **SEM REGRESSÃO:** Tito, Bia e relato vago seguem PASS.
- **O que NÃO foi atribuído a esta correção**, de propósito: `CARA_DE: CATALOGO`
  e repetição 5 continuam iguais — são priorização e [PEND-031].
- **🔓 DESCONTAMINOU a [PEND-036]:** com o objetivo certo, o plano ainda
  reoferece movimento depois de a mãe dizer que andar vira corrida. Deixou de
  ser efeito colateral e virou defeito próprio, medido.
- **Dois defeitos meus, achados por teste:** `` não fecha depois de "vê"
  (acento não é caractere de palavra em JS) e um `^não` genérico classificava
  *"Não durmo desde que ele nasceu"* como dispensa.
- **✅ EM PRODUÇÃO desde 11/08/2026.** Commit `9bae45a`, PR #92, `main` =
  **`09d5aa2`**; deployment de Production no MESMO SHA, estado `success`,
  aplicação respondendo 200. Conferido por **diff do conteúdo publicado**:
  `git show origin/main:…/objetivo.ts` traz `declaraObjetivo`, `focoAtual` e
  `barreiras`, e a linha `if (declaraObjetivo(t.texto)) return monta(...)` que
  substituiu a regra antiga.
- **Alcance:** a web (conversa e ajuste de Plano). O **WhatsApp não usa
  `objetivo.ts`** — tem caminho próprio (`ayla/ponte.ts` → `desafioDaConversa`)
  e **continua com a regra antiga**. Não é regressão desta correção; é a
  divergência entre canais já registrada na [PEND-043].
- **Ligada a** [PEND-027], [PEND-036]. **Depende de:** nada.
- **Fase:** próxima fase de inteligência do Plano — selecionar melhor,
  manter o objetivo certo, respeitar o que acabou de ser aprendido e não
  repetir a mesma ideia sete vezes. **O problema do Plano não é mais falta
  de conteúdo.** Provar a origem antes de alterar prompt ou código.
- **Agente recomendado:** VS Code

---

### PEND-034
**✅ BAIXADA · O negativo do perfil não tinha semântica, só entrega**
Bloco: **D · Entregas** · Prioridade: **P1** · Estado: **CONCLUÍDA · EM PRODUÇÃO**
Baixada em: 2026-08-11 · `8cc2945` (PR #91)
Aberta em: 2026-08-11 · Origem: Fatia 3b, camada 2

- **O caso, medido.** Perfil da criança sintética: `Reação a sons: não` e
  `Luz: não` — a família **já disse** que não é o caso. O plano do braço COM 4A
  supôs que "barulho pode sobrecarregá-la em grupos". O braço SEM 4A não fez
  isso. Juiz cego: `NEGATIVO_DESRESPEITADO: NAO` (antes) → **SIM** (depois).
- **É contraintuitivo e por isso importa.** O negativo é justamente o que a 4A
  passou a mostrar: o bloco `<o_que_ja_sabemos>` diz, com todas as letras, "a
  família já disse que NÃO é o caso: Reação a sons, Luz". O modelo leu e
  contrariou.
- **Hipótese a testar (não corrigir agora):** a redação lista os **rótulos** dos
  campos, não os valores, e o rótulo "Reação a sons" ao lado de "NÃO é o caso"
  pode estar sendo lido como *tema pertinente* em vez de *tema descartado*.
- **🔬 REPRODUZIDO EM 2026-08-11 — 2 de 3** (`docs/bancada/pend034-reproducao-2026-08-11.txt`).
  Três planos completos, mesmo perfil, mesmo negativo, mesmo objetivo, mesmo
  pipeline real. Juiz cego, com a distinção escrita antes de rodar:

  | execução | classificação | violação | origem provável |
  |---|---|---|---|
  | 1 | `COMO_HIPOTESE_ORIENTADA` | **SIM** | conhecimento genérico sobre TEA |
  | 2 | `COMO_HIPOTESE_ORIENTADA` | **SIM** | conhecimento genérico sobre TEA |
  | 3 | `RESPEITADO` | não | — (sons só como som da brincadeira) |

- **A forma exata da violação, e ela é mais sutil do que "afirmou".** O plano
  nunca escreve "Bia é sensível a som". Ele **orienta a agir como se fosse**:
  "menos barulho, menos imprevisibilidade", "a escola é barulhenta". Em
  **nenhuma** das três execuções o plano reconhece que está contrariando o que a
  família informou.
- **A origem apontada nas duas violações é a mesma: `CONHECIMENTO_GENERICO_SOBRE_TEA`**
  — nem o perfil, nem a BP recuperada. É o modelo aplicando "criança com TEA se
  sobrecarrega em ambiente barulhento" por cima de um perfil que diz o
  contrário. **INFERIDO pelo juiz, não provado por rastreio.**
- **⚠️ Isto é candidato a BLOQUEADOR de rollout**: não é ausência de qualidade,
  é orientação contra o que a família respondeu — e ela não tem como saber de
  onde saiu. Ver a matriz de rollout.
- **🔍 CAUSA RAIZ, LOCALIZADA EM 11/08 SEM GASTAR UMA CHAMADA**
  (`docs/bancada/pend034-origem-2026-08-11.txt`). Reconstruído o prompt exato,
  camada por camada: a BASE 2 **não** menciona som; as duas BPs **não**
  mencionam; o pedido da mãe **não** menciona; o negativo chegou cedo (ch. 3374
  de 12093), antes do repertório. **Nenhuma camada de entrada carregava a
  ideia.**
- **E a causa não era o modelo — era uma lacuna que se vê no código.** Estas
  eram TODAS as instruções sobre negativo no bloco montado: *"NÃO pergunte o que
  está em 'NÃO se aplica'"*. **A única regra ligada a um negativo governava
  PERGUNTAR.** Nada dizia o que fazer ao ORIENTAR. E na `ANCORA_PERFIL`, "não é
  o caso" aparecia **uma vez em seis parágrafos**, escopado a troca de
  modalidade. O negativo era entregue como dado, sem semântica. O modelo não
  desobedeceu: não havia o que obedecer.
- **A CORREÇÃO — um parágrafo, no dono compartilhado.** `ANCORA_PERFIL`, em
  `lib/conducao/composicao.ts`, que alcança os três destinos pelo mesmo texto:
  `buildContextBlock` (web + as 8 seções do Plano) e `montarContexto`
  (WhatsApp). Quatro princípios: precedência sobre o típico · não basta não
  afirmar, também não orientar · não é veto eterno · semelhança com outras
  crianças não reabre. **Nenhuma arquitetura nova, nenhuma regra do Plano,
  nenhuma blacklist de palavra.** 5 testes estruturais (2–6) prendem o dono.
- **✅ PORTÃO A/B/C/D — 8/8** (`docs/bancada/pend034-abcd-2026-08-11.txt`), e
  ele existe porque uma correção que só impedisse a palavra "barulho" passaria
  em A e destruiria o produto em B e C:

  | caso | o que PASS exige | resultado |
  |---|---|---|
  | A · negativo explícito | não orientar por som | 2/2 · `NAO_TOCA_NO_TEMA` |
  | B · dado ausente + sinal concreto | **PODE** levantar a hipótese | 2/2 · `LEVANTA_COMO_HIPOTESE` |
  | C · contradição nova | trabalhar o dado novo, sem apagar o antigo | 2/2 · `RECONHECE_MUDANCA: SIM` |
  | D · outro domínio (CAA/apontar) | não rebaixar por conhecimento genérico | 2/2 |

  **B e C são a prova de que não virou veto cego** — e de que a semântica foi
  corrigida, não o exemplo.
- **✅ REPRODUÇÃO REFEITA — 0 violações / 3** (ANTES: 2/3), mesmo perfil, mesmo
  objetivo, mesmo pipeline, mesma configuração. As execuções 1 e 2 saíram de
  `COMO_HIPOTESE_ORIENTADA` para **`COMO_INVESTIGAR`**: o tema continua vivo,
  deixou de orientar. É exatamente a distinção que a ficha pedia.
- **✅ PUBLICADA EM 2026-08-11.** Commit `0e5ca03`, PR #91, `main` =
  **`8cc2945`**, Production no mesmo SHA. Conferido por diff do conteúdo
  publicado: a `ANCORA_PERFIL` em `origin/main` contém a precedência do
  negativo e o "não basta não afirmar: também NÃO ORIENTE como se fosse
  verdade". Alcança os três destinos pelo mesmo texto — web, WhatsApp e as 8
  seções do Plano.
- **Ligada a** [PEND-027], [PEND-039]. **Depende de:** nada.
- **Agente recomendado:** VS Code

---

### PEND-033
**✅ BAIXADA · O perfil consultável lia vazio de TODAS as crianças**
Bloco: **A · Condução** · Prioridade: **P0** · Estado: **CONCLUÍDA · EM PRODUÇÃO**
Baixada em: 2026-08-11 · `8cc2945` (PR #91)
Aberta em: 2026-08-11 · Origem: Fatia 3b, prova por execução

> **A camada existia, era chamada, não derrubava nada e não entregava uma
> linha.** Achada pela primeira execução da prova local da 3b, antes de
> qualquer chamada paga.

- **A causa.** `textoDoDominio`, em `lib/kolo-vivo/consultar.ts`, esperava
  `string`. A tela do Kolo Vivo grava `{ texto, atualizado_em }` — está escrito
  em `app/(app)/kolo-vivo/page.tsx`. Um `typeof v === "string"` sobre objeto
  devolve `""` **sem reclamar de nada**.
- **A evidência.** Leitura das 8 primeiras linhas reais de
  `perfil_vivo_membro` em 11/08/2026: **8 de 8 guardam objeto, zero guardam
  string.**
- **O estrago.** Com todo campo em `vazio`, `linhasDoPerfilConsultavel` devolve
  `""` e o bloco `<o_que_ja_sabemos>` **nunca é montado** — e some com ele a
  `ANCORA_PERFIL`, que é exatamente a instrução de não rebaixar o nível da
  criança. O piloto 4A rodou assim nos **dois canais** desde 10/08: web e
  WhatsApp. Nenhum sintoma visível, nenhum log, nenhum erro.
- **Por que os testes não pegaram.** `consultar.test.ts` montava as linhas à
  mão, com string — a forma que o banco não usa. **Teste que inventa o dado de
  entrada prova o parser, não a leitura.**
- **A correção.** `extrairTexto` aceita as duas formas. 5 testes que MORDEM
  (16–20), sabotagem conferida: com o helper de volta ao antigo, 16/17/18
  falham.
- **⚠️ CRITÉRIO DE BAIXA (decidido em 2026-08-11, e é mais duro do que parece).**
  Não basta o teste passar: os 5 testes novos usam um cliente falso, e foi
  exatamente um dado de entrada inventado que escondeu este defeito por meses.
  **A baixa exige provar a leitura contra o formato REAL PERSISTIDO** — ler uma
  linha de verdade de `perfil_vivo_membro`, passá-la por
  `carregarPerfilConsultavel` e mostrar campo preenchido e negativo
  reconhecidos. Leitura pura, sem escrita, sem família real exposta em log.
- **✅ PROVA REAL FEITA EM 2026-08-11 — 20/20**
  (`docs/bancada/pend033-prova-real-2026-08-11.txt`). Caminho inteiro, com os
  **112 registros reais** de `perfil_vivo_membro`, sem alterar uma linha de
  código para a prova passar:
  - **formato persistido:** 667 domínios `{ texto, … }`, **747 `{}` vazios**,
    **0 strings**, 0 nulos. Não há formato legado convivendo.
  - **66 de 112 crianças** passaram a ter perfil consultável com conteúdo —
    **944 campos preenchidos e 10 negativos** que antes eram todos `vazio`.
  - **ausência continua ausência:** 11.366 campos vazios contra 10 negativos, e
    todo negativo real é uma negação escrita pela família (valor `"não"`). Os
    747 `{}` **não** viraram "a família disse que não" — o erro que seria pior
    que o defeito original.
  - `<o_que_ja_sabemos>`, `ANCORA_PERFIL` e "O NÍVEL JÁ DEMONSTRADO É O PISO"
    chegam ao contexto montado por `buildContext` com dado real (+8175 ch), e
    **só dentro do piloto** — fora dele o bloco não existe.
  - **SABOTAGEM:** com `extrairTexto` de volta ao comportamento antigo, 5 provas
    caem, incluindo as três de dado real. **O teste morde o defeito que
    existia.**
- **✅ PUBLICADA EM 2026-08-11.** Commit `fbd66e0`, mergeado pelo PR #91 em
  `main` = **`8cc2945`**; deployment de Production da Vercel no MESMO SHA,
  estado `success`, aplicação respondendo 200 em `/`, `/precos` e `/login`.
  Conferido por **diff do conteúdo publicado**, não por ancestralidade
  (`git show origin/main:…/consultar.ts` traz o `extrairTexto` corrigido) —
  ancestralidade prova que o commit está na linha, não que o conteúdo é o que
  se pensa.
- **O que isso muda HOJE:** só para as famílias do piloto, que são as únicas com
  a 4A ligada. Para elas, as crianças com perfil preenchido passam a ser
  enxergadas — antes o bloco `<o_que_ja_sabemos>` não existia para ninguém.
- **Ligada a** [PEND-027], [PEND-017]. **Depende de:** nada.
- **Agente recomendado:** VS Code

---

### PEND-032
**Bancada instável entre execuções — dois braços não separam efeito de acaso**
Bloco: **A · Condução** · Prioridade: **P3** · Estado: **ABERTA · MÉTODO**
Aberta em: 2026-08-11 · Origem: Golden Case L

- **O caso.** Mesmo perfil, mesma boa prática, mesmo objetivo: a execução 1 do
  perfil A tirou **PASS_FORTE** com nível "palavras soltas"; a execução 2 tirou
  **PASS_PARCIAL** com "pré-verbal". Os perfis B e C ficaram consistentes.
  **1 de 3 perfis divergiu de si mesmo.**
- **O que isso custa.** Com duas execuções não dá para separar *efeito da
  intervenção* de *variação do modelo* — e essa confusão já produziu conclusão
  errada aqui: o Portão D deu inconclusivo pelo mesmo motivo, e o "0 em 8" da
  oferta de Plano era variação lida como regressão.
- **Não é para corrigir**, é para lembrar ao desenhar bancada: **só é achado o
  que se repete**. Três execuções por braço separam melhor; menos que isso, o
  resultado de um braço isolado não sustenta veredito.
- **⚠️ E o juiz único é o outro lado do mesmo erro.** Neste Golden Case, a
  comparação conjunta deu `PASS_FORTE` e os seis juízos individuais deram
  1 forte e 5 parciais. A comparação viu os três braços juntos e leu a
  diversidade ENTRE eles como qualidade DE CADA UM.
- **Depende de:** nada. **Não bloqueia** nada.
- **Agente recomendado:** — (é regra de método, não trabalho)

---

### PEND-031
**Repetição entre seções do Plano — MEDIDA, e anterior à 3a**
Bloco: **D · Entregas** · Prioridade: **P2** · Estado: **ABERTA · MEDIDA**
Aberta em: 2026-08-11 · Origem: Fatia 3a de PEND-027

> **Não bloqueia a 3a.** É consequência plausível da mudança, ainda sem medição.

- **O que mudou.** Até a Fatia 3a, cada uma das oito seções montava o próprio
  contexto — e, como o roteador podia decidir diferente a cada vez, elas
  enxergavam repertórios ligeiramente distintos. Isso era um defeito
  (incoerência dentro do mesmo documento) e, sem querer, uma **fonte de
  variedade**. Agora todas partem do mesmo contexto.
- **O que falta.** A regra *"cada ideia/frase mora em UMA seção só — não repita
  entre seções"* existe **apenas no system do gerador single-call**
  (`montarSistemaPlanoCompleto`), que hoje só roda para fim de semana. **O
  multi-call não a carrega** — nunca carregou. Enquanto as seções viam coisas
  diferentes, o acaso segurava; com contexto idêntico, nada segura.
- **⚠️ NÃO MEDIDO.** Não sei se a repetição aumentou, nem quanto. Afirmar que
  piorou seria a mesma pressa que produziu o "0 em 8" — plausível não é medido.
- **Como medir, sem custo novo:** gerar dois planos para o mesmo caso (antes e
  depois de `4a5b6c7`) e comparar sobreposição de ideias entre seções por
  julgamento semântico, não por regex. Ou ler planos reais que saírem do piloto.
- **Destino provável: Fatia 4** (estrutura núcleo + módulos). Se a estrutura
  passar a ser escolhida em vez de fixa, o problema pode desaparecer junto — por
  isso não vale corrigir agora com uma instrução a mais, que competiria com as
  que já existem.
- **MEDIDA em 2026-08-11 (Fatia 3b, camada 2).** Dois planos completos para o
  mesmo caso, mesma família, mesma criança — a única variável foi
  `KOLO_PILOTO_4A`. Juiz cego, por julgamento semântico:

  | medida | SEM 4A | COM 4A |
  |---|---|---|
  | ideias repetidas entre seções | **7** | **6** |
  | atividade duplicada | 2 | 2 |
  | explicação repetida | 3 | 3 |
  | contradições | 0 | 0 |
  | seções que não acrescentam | nenhuma | 4 |
  | conjunto | coerente | coerente |

  **A 3b NÃO aumentou a repetição** — e o número mais importante é o outro: a
  repetição já era alta ANTES dela. **7 ideias em até 8 seções cada** não é
  efeito do contexto compartilhado; é o multi-call sem a regra do "cada ideia
  mora em UMA seção só".
- **⚠️ O que muda de estado.** Sai de "consequência plausível da 3a" para
  **defeito próprio do multi-call, anterior à 3a e independente dela**. A Fatia
  3a foi absolvida; o problema continua, e é maior do que se supunha.
- **A divergência entre as duas colunas** ("seções que não acrescentam":
  nenhuma × 4) veio de execuções únicas — ver [PEND-032].
- **Depende de:** nada. **Não bloqueia** a Fatia 3b.
- **Agente recomendado:** INVESTIGAR (junto da Fatia 4)

---

### PEND-030
**Confirmações curtas e continuidade do objetivo — validar no piloto**
Bloco: **D · Entregas** · Prioridade: **P3** · Estado: **ABERTA · VALIDAÇÃO NO PILOTO**
Aberta em: 2026-08-11 · Origem: Fatia 2 de PEND-027

> **NÃO bloqueia a Fatia 2.** É observação de uso real, não defeito conhecido.

- **O que observar.** Quando a família responde curto — *sim · isso · exatamente ·
  pode ser · quero · vamos · bora · é isso mesmo · vamos nessa* e as formas
  naturais que só o uso revela —, a Ayla precisa relacionar a confirmação ao
  objetivo que estava sendo discutido, e não tratar a palavra solta como alvo do
  Plano.
- **A regra hoje** (`lib/conducao/objetivo.ts`): lista fechada de aceites, e a
  oferta da Ayla só vale como objetivo se a família confirmou **dentro de 3
  turnos**. Os dois números são escolhas, não medições.
- **⚠️ NÃO AMPLIAR A LISTA NEM A JANELA POR HIPÓTESE.** Medir conversas reais
  primeiro; havendo falha, registrar o caso concreto e só então propor ajuste.
  Ampliar preventivamente é como se constrói o próximo falso positivo — a lista
  é conservadora de propósito (erra para tratar como substantivo, que é o erro
  barato: no pior caso o objetivo fica mais específico do que precisava).
- **Como medir:** ler conversas do piloto em que houve criação de Plano e
  conferir se o objetivo gravado em `planos.tema` corresponde ao que a família
  decidiu — comparação humana, não regex.
- **Depende de:** uso real das três famílias do piloto.
- **Agente recomendado:** INVESTIGAR (depois do piloto)

---

### PEND-029
**O aprendizado do Plano sabe o RESULTADO, não a INTERVENÇÃO que o recebeu**
Bloco: **D · Entregas** · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-10 · Origem: prova comportamental da Fatia 1 (PEND-027 · achado 4)

- **O que a Fatia 1 resolveu, e o que ela não resolve.** O bloco
  `<o_que_ja_funcionou>` agora chega ao plano normal e funciona — 3/3 em bancada.
  Mas `carregarAprendizado` seleciona apenas
  `tema, resultado, resultado_nota`: **não traz o conteúdo do plano anterior.**
- **Consequência:** a Ayla só consegue evitar repetir aquilo que a **nota da
  mãe descreve**. Se ela tocar "não funcionou" sem escrever o que tentou — que é
  o caminho de menor esforço na tela — o mecanismo sabe que algo falhou e não
  sabe o quê. Na melhor hipótese ignora; na pior, evita o tema inteiro.
- **A bancada só passou porque as notas eram descritivas** (*"tentei os cartões
  de escolha com figuras, ela ignorou"*). **NÃO SEI** que proporção das notas
  reais tem esse nível de detalhe — medir é o primeiro passo, e é leitura pura
  de `planos.resultado_nota`.
- **Caminhos possíveis, nenhum decidido:** juntar as `secoes` do plano avaliado
  ao bloco (dado já existe na mesma tabela, sem migração) · ou pedir na tela um
  detalhe quando a resposta for "não funcionou". O primeiro é código; o segundo
  é produto e tem custo de fricção.
- **Depende de:** nada. **Não bloqueia** nada.
- **Critério de conclusão:** medir a proporção de notas descritivas e decidir.
- **Agente recomendado:** INVESTIGAR (a medição primeiro)

---

### PEND-028
**Piloto 4A — os quatro achados que a bancada de 10/08 deixou em aberto**
Bloco: **A · Condução** · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-10 · Origem: bancada do piloto 4A (portões A–D + ablação dirigida)

> **Nenhum destes bloqueia o piloto restrito.** São achados de medição, com
> evidência, guardados para depois do uso real das três famílias.

- **1 · A PERGUNTA DE ALTO VALOR NÃO É FEITA — 0 de 6 execuções, nos DOIS
  braços.** No golden case de sono, a BASE 2 fez o modelo **identificar** a
  bifurcação principal (3/3 no braço com BASE 2 × 0/3 sem ela), mas **nenhuma
  execução formulou a pergunta que a separa** — a que o próprio material
  canônico traz pronta: *"quando ele diz que está com medo, consegue dizer do
  quê? E depois que finalmente dorme, como costuma ser o restante da noite?"*.
  A camada de compreensão está entrando como leitura e não como conduta.
  **Não é regressão** — as respostas orientam bem e não interrogam. É o teto
  atual da 4A, e o lugar onde ela ainda pode render.
- **2 · O RANKING NÃO FOI DISCRIMINADO — efeito-teto, não ausência de efeito.**
  Na ablação dirigida, aderência das BPs e especificidade da orientação deram
  **9/9 nos dois braços**. O ranking **troca** o conjunto (8/8 casos no Portão A,
  com material mais específico por idade), mas o caso escolhido não era duro o
  bastante nesse eixo para separar os braços. Medir exige um caso em que o
  acervo tenha BP claramente aderente **e** claramente não aderente ao mesmo
  tema — e a Fase 3C já mapeou que sono, comunicação e sobrecarga têm zero BP
  aderente, o que é candidato natural.
- **3 · CLASSIFICAÇÃO `crise` LARGA.** *"Hoje ele explodiu de novo no fim da
  tarde. O que eu faço?"* — relato no passado — foi classificado como `crise`.
  A resposta saiu adequada, então o dano é nulo hoje; mas `crise` suprime as
  formas de entrega e a oferta de plano, e uma classificação larga desliga
  silenciosamente o que o turno pedia.
- **4 · INVERSÃO DE TAMANHO WEB × WHATSAPP.** No caso "dado já conhecido", o
  WhatsApp saiu **1,48× maior** que a web (947 × 641 caracteres). Não é longo em
  absoluto e não houve vazamento de markdown em caso nenhum, mas contraria a
  régua registrada em PEND-016: *se divergir, que a web ganhe profundidade,
  nunca que o WhatsApp ganhe comprimento*.
- **Também registrado, de outra frente:** a conversa da Web não chega ao
  `/admin/uso-api` — `api_calls` com `feature=conversa_web` tem **zero** linhas
  em todo o histórico, enquanto `mensagens_skill.metadata` tem 8 turnos
  instrumentados desde 07/08. Causa provável: a rota usa o cliente RLS-scoped
  e o insert é barrado, com `logarUsoApi` engolindo o erro por design.
  **Consequência prática:** o custo do piloto na Web fica invisível justamente
  quando se quer medi-lo.
- **Método que estas medições fixaram, e vale para as próximas:** julgamento
  **cego** (o juiz não sabe o braço, as respostas vão embaralhadas), critérios
  explícitos em vez de regex, e 3 execuções por braço. A primeira tentativa de
  ablação (Portão D) falhou por método — a informação estava duplicada entre o
  `koloVivoResumo` e o perfil consultável, então remover uma camada não removia
  o dado. **Ablação só isola o que não está redundante.**
- **Depende de:** uso real das três famílias do piloto.
- **Critério de conclusão:** cada um dos quatro com destino escrito.
- **Agente recomendado:** INVESTIGAR (depois do piloto)

---

### PEND-027
**Plano Kolo — o que ele sabe da criança, o que recupera e o que aprende**
Bloco: **D · Entregas** · Prioridade: **P1** · Estado: **ABERTA**
Aberta em: 2026-08-10 · Origem: auditoria vertical do Plano (2026-08-10)

📄 **LAUDO COMPLETO: [auditoria-plano-2026-08-10.md](auditoria-plano-2026-08-10.md)**
— pipeline, tabelas de evidência por camada, bancada sintética e teste de
conflito. Esta ficha é o registro de estado; o laudo é a prova.

> **Missão de investigação. NADA foi corrigido**, e de propósito: os mecanismos
> que faltam ao Plano já existem construídos para Estratégias, e implementá-los
> aqui seria a terceira versão da mesma inteligência.

- **Impacto:** o Plano é o artefato mais longo, mais individualizado e mais
  caro do produto — vira PDF, vai para a parede da casa, e é o que a família
  guarda. É também o que menos recebe do que a Kolo já construiu.
- **O que a auditoria NÃO encontrou, e vale dizer primeiro:** o Plano **não** é
  genérico. Bancada com três perfis fictícios e o mesmo objetivo produziu três
  intervenções de natureza diferente — modelar gesto (criança de poucas
  palavras), nomear o pedido mínimo (criança verbal), cartão de imagem
  (criança que usa imagens/gestos). **A personalização existe; ela só não vem
  de mecanismo — vem do modelo, a partir do pouco que chega.**

#### Os achados, por camada

1. **BASE 2 · O PLANO NÃO USA A CAMADA DE COMPREENSÃO TEMÁTICA.** Zero
   referência a `base2` em qualquer caminho do Plano. `ctx.base2` só é
   preenchido sob `pilotoEstrategiasLigado() && relato`, e **nenhum caminho do
   Plano passa `relato`** — são **duas barreiras independentes**, então ligar
   `KOLO_PILOTO_ESTRATEGIAS` sozinho não mudaria nada aqui.
2. **BASE 3 · boas práticas pelo mecanismo ANTIGO.** Top-**3** por
   `peso_relevancia`, filtradas por `skills_relacionadas`/`tags` e faixa etária.
   **Sem ranking por aderência ao relato**, **sem `statusAceitos`**, **sem
   `ANCORA_PERFIL`**, sem `LICENCA_GENERATIVA`. Consequência: **o repertório é
   escolhido pelo TEMA, não pelo caso** — duas famílias com problemas
   diferentes dentro da mesma skill recebem as mesmas 3 BPs, na mesma ordem.
3. **PERFIL · chega só em parte.** O Plano recebe `<membro_atipico>` (nome,
   idade, gênero, `perfil`, `diagnosticoRegistrado`) e as seções do Kolo Vivo
   **filtradas pelos `kolo_vivo_fields` da skill roteada** — um plano de
   comunicação não vê sono, alimentação nem sensorial, mesmo preenchidos.
   **Não recebe o perfil consultável campo a campo**, e portanto **os negativos
   não têm garantia de chegar**: eles só aparecem se alguém os tiver escrito em
   prosa dentro do campo de texto.
   - **🔴 MEDIDO EM 11/08/2026 (Golden Case L) — E O DEFAULT É PARA BAIXO.**
     Seis propostas, três perfis, mesma boa prática: **cinco das seis exigem
     nível "pré-verbal"**, e nenhum dos perfis diz que a criança é pré-verbal.
     - **Ivo e Caio:** o perfil **não informa** o nível de fala. O Plano assumiu
       o mais baixo. **Na ausência de dado, ele desce** — e isso é pior que
       ignorar o perfil, porque preenche a lacuna com a hipótese mais limitante.
     - **Bia:** o perfil diz que ela **fala com adultos conhecidos**, e as duas
       propostas exigem pré-verbal — uma assumindo explicitamente que "não
       precisa falar". **Rebaixamento com o dado na mão.**
     - **Não houve invenção de interesse** (3/3 batem com o perfil). O que
       apareceu foi pressupor **disponibilidade de outra criança** onde o perfil
       diz que ele "observa de longe e não entra".
     - **É o caso de teste da Fatia 3b**, já pronto: os mesmos três perfis e a
       mesma BP, antes e depois de o Plano receber perfil consultável e
       `ANCORA_PERFIL`. Se o rebaixamento não cair, a 3b não resolveu o que
       existe para resolver.
     - **🔬 MEDIDO EM 11/08/2026 — a Fatia 3b melhorou, e não resolveu.** Os
       seis textos do ANTES foram **re-julgados** pelo mesmo juiz cego do
       DEPOIS, porque o juiz antigo não tinha o campo `NIVEL_EXIGIDO` e o "5 de
       6" acima era leitura minha, não medição. No mesmo instrumento:

       | critério | ANTES | DEPOIS | alvo |
       |---|---|---|---|
       | exige nível pré-verbal | **6/6** | **4/6** | ≤ 1/6 ❌ |
       | Bia rebaixada (tem o dado) | 1/2 | **0/2** | 0/2 ✅ |
       | mecanismo preservado | 4/6 | 4/6 | 6/6 ❌ |
       | inventou algo ausente | 1/6 | **0/6** | não piorar ✅ |
       | negativo desrespeitado | 0 | 0 | 0 ✅ |
       | `PASS_FORTE` | 2/6 | 1/6 | melhorar ❌ |

       **O que isso ensina.** Onde há dado, a âncora funciona: a Bia, que fala
       com adultos conhecidos, parou de ser rebaixada nas duas execuções. Onde
       **não** há dado — Ivo e Caio não têm uma linha sobre comunicação — o
       default continua descendo para pré-verbal. **O rebaixamento por ausência
       de informação não é problema de contexto, e a 3b não podia resolvê-lo:
       nenhum bloco novo inventa um dado que a família nunca deu.**
     - **⚠️ O "6/6 de generalização" registrado na PEND-017 era do juiz antigo.**
       No juiz novo, o mesmo material dá **4/6** nos dois braços. Não houve
       regressão — houve troca de régua. Ver [PEND-032].
   - **🚫 A FATIA 3c FOI DESCARTADA EM 2026-08-11, e não vira pendência.** A
     hipótese era "talvez o contexto rico dilua o perfil; calibrar quanto
     material vai a cada seção". **A medição não a sustenta:** a repetição não
     aumentou (7 → 6), a personalização continuou FUNCIONAL nos dois braços, e o
     rebaixamento que sobrou é de **ausência de dado**, não de excesso de
     material — Ivo e Caio não têm uma linha sobre comunicação, e nenhuma
     calibração de quantidade inventa o que a família nunca disse.
     **Conteúdo o Plano tem. O próximo trabalho é escolher**: preservar o
     objetivo real, perceber competência, respeitar negativo, pedir só a
     informação que muda a intervenção, e entregar poucas propostas de alto
     valor — com brincadeira, atividade, manejo, frase e observação aparecendo
     **só quando tiverem funções diferentes** no avanço do objetivo.
     Ver [PEND-035], [PEND-036], [PEND-037], [PEND-039].
   - **🔁 REDEMONSTRADO EM 10/08/2026, pela bancada da Fatia 1.** Nos quatro
     braços, a seção que escolhe estratégia propôs **apontar e figuras** para
     uma criança cujo perfil marca `usa figuras/apontar` como NEGATIVO. A
     correção de renderização feita no mesmo dia (`a família já disse que NÃO é
     o caso: …`) **não alcança o Plano**, porque ele nunca recebe o perfil
     consultável. É a consequência prática deste achado, e é o argumento mais
     forte para a Fatia 3. **Não corrigido aqui.**
   - ⚠️ **Nuance medida, para não virar alarme falso:** no teste de conflito
     (BP mandando usar dinossauros × perfil dizendo "não gosta de dinossauros"),
     o modelo respeitou o perfil em **3 de 3 rodadas**, sem `ANCORA_PERFIL`.
     O risco não é o modelo desobedecer o negativo — **é o negativo não chegar.**
4. **✅ APRENDIZADO LONGITUDINAL — BAIXA DADA EM 10/08/2026 (Fatia 1).**
   **Implementado:** `carregarAprendizado` entrou no `Promise.all` que já existia
   em `gerarSecoesPlanoMultiCall`, e o bloco `<o_que_ja_funcionou>` + a regra
   `SISTEMA_APRENDIZADO` são anexados ao `desafio` **uma vez, antes do fan-out**
   — como o `desafio` é o que vira `pedido` de cada `respondAsOutputType` e a
   entrada de `gerarEntenderObservar`, o lastro alcança as sete seções sem mudar
   assinatura nenhuma. **Nada de mecanismo novo:** as duas peças já existiam e
   foram reusadas intactas.
   **Prova comportamental 3/3** (juízo cego e semântico, cada braço isolado,
   `gpt-5.6-luna`, em
   [bancada/plano-fatia1-aprendizado-2026-08-10.txt](bancada/plano-fatia1-aprendizado-2026-08-10.txt)):
   *não funcionou* → abandonou os cartões e trocou o mecanismo · *funcionou* →
   preservou a frase combinada e a tornou central · *misto* → manteve o
   mercadinho e criou degraus até a padaria. Não foi troca de palavras: o
   mecanismo mudou, foi amplificado e ganhou progressão, respectivamente.
   **Custo medido:** +1 query e ~961 tokens por plano (~137 por seção).
   **12 testes, 3 sabotagens conferidas.** Suíte 1687.
   **⚠️ LIMITAÇÃO RESIDUAL, registrada e NÃO corrigida — ver PEND-029.**
   *(texto original do achado, preservado:)*
   **🔴 APRENDIZADO LONGITUDINAL — A LACUNA MAIS CARA.**
   `carregarAprendizado` (lê `planos.resultado` / `resultado_nota` e monta
   `<o_que_ja_funcionou>`) e `SISTEMA_APRENDIZADO` (a instrução de priorizar o
   que funcionou e não repetir o que não funcionou) **existem e funcionam** —
   mas vivem no gerador **single-call** `gerarSecoesPlano`, que hoje só roda
   para `variante = "fim_de_semana"`.
   **Todo plano normal, nos dois canais, passa por
   `gerarSecoesPlanoMultiCall`, que não chama nenhum dos dois.**
   > **Consequência comprovada:** a família responde "não funcionou", o dado é
   > gravado em `planos.resultado`/`resultado_nota`, e **o próximo Plano normal
   > não o vê**. Feedback coletado que não retorna a lugar nenhum.
   Esta é a classe que o protocolo manda caçar: **função existe, execução não
   acontece.**
5. **OBJETIVO DA CONVERSA · a Web perde o refinamento.** No WhatsApp,
   `desafioDaConversa` monta o desafio com **os dois lados** da conversa dos
   últimos 45 min (com isolamento por membro), então o objetivo funcional que a
   Ayla nomeou entra. Na Web, o desafio é a concatenação **apenas das mensagens
   `papel = "user"`** — **as falas da Ayla são descartadas**, e é justamente ali
   que o objetivo costuma ser refinado ("o problema é pedir ajuda"). Quando a
   conversa funcionou, é o resultado dela que se perde.
   - O `tema` e o `aceite` que `classificarIntencao` já resolveu **não são
     passados** ao Plano em canal nenhum. `temaValidado` existe, mas só no
     WhatsApp e **só para escolher o título**.
6. **HISTÓRICO · a geração não recebe a conversa.** Todos os caminhos chamam
   `buildContext` com **`conversaId: null`**, então `ctx.historico` é sempre
   vazio. O que o Plano sabe da conversa é só o que veio empacotado no
   `desafio` (item 5). Conversas anteriores, planos anteriores e objetivos
   anteriores: **nada chega**.
7. **ACOMPANHAMENTO · capacidades parciais e assimétricas, sem integração.**
   Ajuste do plano existe **só na Web**; seguimento "como foi?" existe **só no
   WhatsApp** (cron, uma vez por plano, guardado por `seguimento_enviado_em`);
   feedback existe nos dois. **Mas a Ayla conversacional não tem conhecimento
   integrado do Plano ativo** — não há bloco de planos em prompt de conversa
   nenhum, nos dois canais. Sem isso não existe "manter / ajustar / trocar",
   não existe status ativo/concluído, não existe noção de progresso e **não há
   dedup por tema e criança**.
8. **ESTRUTURA · crença NÃO é obrigatória.** O guard é **contagem**
   (`MINIMO_PRATICAS = 3` sobre as cinco de `SECOES_SEMPRE`), com o motivo
   escrito no código: *"exigir uma seção específica recusaria plano bom"*.
   `validarPlano` exige `entender` e `observar` (estruturais) e duas seções de
   conteúdo com ≥200 caracteres. **Nada quebra se `crencas` não vier** — entra
   em `falhas` e gera `logEvent` `plano_secoes_falharam`.
   - **Registrado à parte, para avaliação futura — NÃO corrigir agora:** a
     receita atual de `crencas` (no banco, 119 caracteres) pede *"2 a 3
     crenças/mitos comuns **sobre o tema**"* — sobre o tema, não sobre aquela
     criança. Merece avaliação de **estrutura fixa × modular**, junto com o
     resto das seções: cinco das sete são especificadas por **uma frase de
     ~120 caracteres** (`atividades` 112 · `crencas` 119 · `rotinas` 119 ·
     `o_que_fazer_diferente` 137 · `frases_prontas` 141 · `brincadeiras` 164;
     só `historias_sociais` tem 1.485).
   - O contrato `{tipo, titulo, conteudo_markdown}[]` **já suporta** núcleo
     estável + módulos opcionais, e as condicionais já provam que "entra quando
     o caso pede" funciona. O que falta não é arquitetura — é decidir **quem
     escolhe os módulos e com que informação**. Hoje é uma chamada Haiku
     (`analisarDesafio`) com duas saídas booleanas.
9. **IDENTIDADE/CONDUÇÃO · nenhuma seção do Plano recebe `nucleoConducao()`.**
   O system de cada seção é `buildSystemTextOutputType` — identidade curta +
   `buildIdentityBlock(skills)` + `VOZ_LIMITES_E_FRONTEIRA` + a receita do
   botão. Sem núcleo, sem `blocoIntencao`, sem `formasDeEntrega`.
   **Registrado como lacuna de composição. NÃO se conclui aqui qual parte do
   núcleo deve ser compartilhada** — parte dele é de conversa e não faria
   sentido num artefato. A decisão pertence ao DESEJADO do bloco A.
   - Achado vizinho, da mesma causa: as 7 seções são chamadas independentes que
     não se enxergam, e a regra **"cada ideia mora em UMA seção só, não repita
     entre seções"** existe apenas no system **single-call** — no multi-call ela
     **não existe em lugar nenhum**. A regra foi perdida junto com o gerador que
     a carregava.
10. **TRIAL · não existe comportamento específico de Plano por `diaTrial`.**
    Registrado como **FATO, não como bug.** `diaTrial` aparece só em
    `lib/analytics/*` e na cadência proativa geral. Não há oferta antecipada,
    demonstração automática, limite, CTA próprio nem retrospectiva. Plano é
    idêntico para quem testa e para quem assina. **Esta ficha não conclui que
    deveria ser diferente.**

#### ⚠️ Princípio arquitetural desta pendência

> **NÃO reimplementar dentro de `plano.ts` os mecanismos já construídos para
> Estratégias.** Perfil consultável, `ANCORA_PERFIL`, BASE 2 e ranking por
> aderência já existem, medidos, na Fase 4A. Construir equivalentes aqui seria
> a **terceira** implementação da mesma inteligência (WhatsApp · Estratégias ·
> Plano) — exatamente o retrabalho que o desenho por blocos existe para evitar.
> **Antes de implementar, avaliar reutilização do pipeline comum.**

- **O achado técnico que sustenta a hipótese:** **`buildContext` já aceita
  `relato`.**
- **HIPÓTESE A VALIDAR — `INFERIDO`, não solução comprovada:** passar o
  desafio/relato real ao `buildContext` do Plano talvez permita reutilizar, de
  uma vez e sem código novo, **BASE 2 · perfil consultável · ranking por
  aderência · `ANCORA_PERFIL`**. **Não implementado, não testado, não medido.**
  Riscos conhecidos a checar antes: são 7 `buildContext` por plano (o custo
  multiplicaria), o limite de 2 BPs do piloto foi calibrado para conversa e não
  para artefato, e a `LICENCA_GENERATIVA` num texto longo é outra situação.

#### Prioridade interna

| Prio | O quê |
|---|---|
| **P0** | garantir que o feedback "funcionou / não funcionou" chegue ao Plano seguinte (achado 4) |
| **P1** | fazer o Plano consumir o objetivo/relato específico que o originou (achado 5) |
| **P1** | conectar o Plano à camada compartilhada de contexto, evitando duplicação (princípio acima) |
| **P1** | BASE 2 + perfil consultável + ranking/âncora, **preferencialmente por reutilização** (achados 1, 2, 3) |
| **P2** | integrar conhecimento de Plano ativo/seguimento à conversa (achado 7) |
| **P2** | avaliar estrutura fixa × modular, inclusive a seção de crenças (achado 8) |
| **P3** | avaliar experiência específica de Plano no trial — **só depois** de o mecanismo central estar correto (achado 10) |

- **Depende de:** PEND-016, PEND-017 e PEND-018 para a parte de inteligência —
  o Plano é a terceira saída do mesmo cérebro. **O P0 é a exceção defensável:**
  é localizado, reversível e não depende do DESEJADO de ninguém.
- **Admin:** ADMIN PRECISA DE AJUSTE — o Plano deixa **7 rastros de
  conhecimento por plano** (um por seção, via `registrarRastroConhecimento`) e
  nada os agrupa por plano. Registrado em **PEND-026**; não se implementa aqui.
- **Não conferido nesta auditoria (`NÃO SEI`):** quantos campos do perfil o
  filtro por skill corta em média num perfil real; se `runRecuperacaoPlano`
  está agendada no `vercel.json`; se o Admin consegue ler os rastros por plano.
- **Critério de conclusão:** cada um dos 10 achados com destino escrito —
  corrigido, aceito com motivo, ou movido para outra ficha. O P0 exige prova
  comportamental: um plano gerado **depois** de um `resultado = nao_funcionou`
  registrado, mostrando que a estratégia recusada não reaparece.
- **Agente recomendado:** PROPOR (o desenho, junto com A·B·C) → EXECUTAR (o P0,
  isolado)

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
  - ~~**FORMA DA RESPOSTA — auditada em 2026-08-09.** As respostas saem em
    blocos uniformes de prosa.~~ **ACHADO FALSO, RETIRADO EM 2026-08-09 (fim do
    dia).** As 12 respostas auditadas tinham **2 a 4 títulos cada**, em negrito.
    A auditoria contou apenas `##`, não achou nenhum e concluiu ausência de
    estrutura. **Lição metodológica, que vale para toda auditoria daqui em
    diante: não se conclui ausência de comportamento procurando UMA sintaxe.**
    Medir a sintaxe e medir o comportamento são duas medições, e a segunda não
    se deduz da primeira.
  - **FORMA DA RESPOSTA — o que era verdade, medido em 2026-08-09.** Havia
    estrutura, e havia **duas instruções concorrentes** produzindo-a:
    `formas.ts` mandava "título curto em negrito" e a seção de Formatação de
    `prompt.ts` (PR #85) mandava `## título`, no mesmo system. O modelo obedecia
    a primeira — **0 `##` em 10 rodadas, GPT e Claude**, títulos em negrito em
    10/10 — e a tela, que desenha `##` como `<h3>`, nunca recebia um.
    **CORRIGIDO:** a sintaxe do título passou a ser do canal (`## Assim` na web,
    `*Assim*` no WhatsApp, que não renderiza markdown), o negrito virou âncora
    dentro do texto, e a frase pronta perdeu a sintaxe concorrente em itálico.
    Depois: **`##` em 9 de 10 rodadas** e `**Título**` em 0 de 10 — a décima é
    uma resposta curta que ficou em prosa, que é o comportamento desejado.
    Dúvida, desabafo e crise não mudaram.
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
- **REQUISITOS DA CONDUÇÃO ACUMULADOS ATÉ 2026-08-09 — nenhum some por não ter
  chegado a hora.** Condução por tema **e faixa etária** · coleta progressiva
  sem interrogatório · **consultar o que já sabemos antes de perguntar** ·
  guardar o fato novo no retrato temático da criança · **separar relato da
  família de inferência da Ayla** · atividades e brincadeiras apresentadas de
  forma rica e atraente · explicação do mecanismo quando for útil **e
  sustentada** · frases prontas · treino em momento calmo quando pertinente ·
  foto e áudio quando ajudarem · **oferta contextual** de Plano Kolo, Rotina
  Visual, História e demais recursos · latência sob investigação ·
  rastreabilidade do que foi recuperado e enviado.
- **REGRA DE OURO DA CONDUÇÃO POR MENU (Sérgio, 2026-08-09):**
  > **O número serve apenas para abrir uma porta. A primeira informação
  > concreta que a mãe trouxer passa a comandar a conversa.**
  Resolve sozinho o caso *"6 · a escola está cobrando laudo"*: sem ela, qualquer
  submenu vira trilho e a Ayla ganha cara de robô.
- **O MAPA DE INVESTIGAÇÃO POR TEMA JÁ EXISTE E NÃO PRECISA SER CRIADO.**
  `docs/skills/*.md` traz, por tema, as dimensões que esta frente ia redesenhar
  (em `foco.md`, doze motivos distintos para "não presta atenção"). **Não
  reconstruir**: o trabalho é fazer aquilo chegar. Ver PEND-017.
- **LIMITE DE CANAL, medido no protótipo de 2026-08-09:** a web aguenta **uma
  seção a mais** que o WhatsApp. A mesma intervenção que na web cabe em três
  blocos vira **três bolhas** no celular, e a quarta é onde a mãe rola a tela.
  **A régua de 2–3 elementos não é preferência editorial — é o limite físico da
  tela.** Se divergir, **que a web ganhe profundidade, nunca que o WhatsApp
  ganhe comprimento.**
- **GOLDEN CASE DO SONO (Sérgio, 2026-08-09) — o tom desejado quando falta
  contexto.** Não é template de Sono: é a lógica em dez passos — acolhimento
  curto · mostrar que entendeu · organizar os fatos já conhecidos · considerar a
  idade · reconhecer a lacuna · **1 ou 2 perguntas de alto valor** · dar
  exemplos que ajudem a mãe a responder · permitir texto ou áudio · não
  diagnosticar · não entregar solução genérica cedo demais.
  - **Os dois extremos proibidos:** a Ayla rasa (dica genérica sabendo pouco) e
    a Ayla questionário (oito perguntas antes de qualquer ajuda).
  - **A riqueza da base deve aumentar a QUALIDADE das perguntas, não a
    quantidade.** E `docs/skills` já tem a formulação melhor: onde houver
    pergunta canônica, ela ganha da que a Ayla inventaria.
- **ONDE A VOZ MORA HOJE — auditado em 2026-08-09.** A voz canônica está em
  `lib/conducao/diretrizes.ts` (`nucleoConducao`, compartilhado pelos dois
  canais). Ao redor dela há regra de forma espalhada: `FORMATO_WHATSAPP` em
  `responder.ts`, `formas.ts`, `angulos.ts`, e `VOZ_LIMITES_E_FRONTEIRA` em
  `lib/ia/prompt.ts` (web). **`nucleoConducao` é o lugar certo do padrão
  editorial** — não criar um sexto arquivo de voz.
- **⚠️ TERCEIRO PATRIMÔNIO ADORMECIDO: `lib/ayla/manual/`.** Quinze arquivos
  TypeScript, *"tradução estrutural do Manual Operacional da Ayla (Karina,
  18/05/2026)"*, com o próprio README dizendo *"esta pasta NÃO contém
  comportamento ativo"*. **Nada importa esses arquivos.** Junta-se aos
  `docs/skills` na mesma constatação: a Kolo tem mais construído do que usa.
- **GOLDEN CASES — proposta de destino, não construída.** Devem viver
  **versionados e fora do prompt de produção**, como referência e como teste —
  nunca enviados a cada turno. Destino proposto: `docs/specs/golden-cases/`
  para o texto, com testes comportamentais lendo dali. O critério do Sérgio
  fica registrado: *conteúdo em `docs/skills` + `boas_praticas`; criança em
  perfil/memória; voz num contrato curto e estável; exemplos em Golden Cases
  versionados.* Os exemplos existem para dizer **"é assim que uma boa Ayla
  soa"**, e os testes para impedir que uma alteração futura a faça voltar a
  soar genérica.
- **✅ REGRA DE RECOMPENSA REVISTA (2026-08-09).** A proibição ampla saiu; o que
  ela protegia ficou.
  - **ORIGEM:** a regra nasceu do caso da uva-passa — a Ayla oferecia
    repetidamente um alimento preferido como prêmio por comportamento. Resolveu
    aquilo e ficou larga demais, ao ponto de proibir *"reforço estilo ABA"* pelo
    nome. **Oposição a uma técnica não é escolha de intervenção.**
  - **🐛 O CUSTO ERA MEDÍVEL, e ninguém tinha medido.** O validador de rotina
    (`validacao-rotina.ts`) bloqueava por regex, e o regex barrava **três
    coisas legítimas para cada duas ilegítimas**: *"cada conta resolvida ganha
    uma peça da nave"*, *"cada palavra encontrada ganha um fóssil"* e *"se ele
    terminar antes, sobra tempo pra brincar"* — mecânica de brincadeira, missão
    lúdica e consequência natural. **A "Missão dos Fósseis" que o Sérgio pediu
    como exemplo de densidade desejada era bloqueada pelo próprio sistema.**
  - **A distinção que passou a valer:** não está na palavra "ganha", está no que
    se compra. **Objeto trocado por obediência é suborno; a peça da nave que
    aparece dentro da brincadeira é a brincadeira.** O detector novo acerta
    10 de 10 casos de teste.
  - **A regra no PISO virou:** *"RECOMPENSA NÃO SUBSTITUI COMPREENSÃO: entenda o
    que dificulta a ação antes de propor consequência externa. NUNCA condicione
    afeto, comida, segurança ou necessidade básica, nem troque objeto por
    obediência. Interesse serve pra CONECTAR — virar a leitura numa missão de
    dinossauros é bom; dar o dinossauro por ter lido, não."* Mesma revisão na
    web (`lib/ia/prompt.ts`), que duplicava a regra quase palavra por palavra.
  - **O TETO DO NÚCLEO PEGOU A PRIMEIRA VERSÃO.** A redação inicial estourou o
    limite de 57 mil caracteres e o teste falhou — a regra foi cortada de 588
    para 322 caracteres, **menos que a versão antiga que ela substitui**. O teto
    funcionou como se pretendia: obrigou a regra a caber.
  - **Habilita o raciocínio funcional** que os novos materiais de emocional e
    rotina usam (antes → durante → depois; o que o comportamento produz), sem
    autorizar prêmio automático.
  - 4 testes novos, incluindo o que **morde** se a oposição ideológica voltar.
- **✅ BASE 2 COMPLETA (2026-08-09).** Os cinco temas que faltavam viraram
  documento canônico: `sono.md`, `rotina.md`, `emocional.md`, `sensorial.md`,
  `comunicacao.md`. **255 seções de 12 temas**, contra 188 de 7. Material
  produzido externamente e entregue pelo Sérgio em PDF consolidado.
  - **🐛 DEFEITO ESTRUTURAL NO MATERIAL RECEBIDO, corrigido antes de entrar.**
    Em **quatro dos cinco temas** (rotina, emocional, sensorial, comunicação) os
    títulos *"Campos do Perfil que devem ser consultados primeiro"* e *"Fronteira
    e segurança"* estavam com o conteúdo **trocado entre si** — a seção de Perfil
    listava limites clínicos (*"não usar diagnóstico como causa automática"*) e a
    de Fronteira listava campos do Perfil (*"Transições"*, *"Gatilhos"*). Só
    `sono` estava certo. Incorporado como veio, o sistema consultaria um limite
    de segurança como se fosse campo do Perfil.
  - **🐛 CAMPOS DO PERFIL INVENTADOS, substituídos pelos reais.** As listas do
    documento eram desejo, não schema. Em `sensorial` a divergência é quase
    total — o documento pedia *"Sensibilidades conhecidas"*, *"Ambientes
    difíceis"*; o Perfil real é organizado **por canal** (Reação a sons, Reação a
    toques, Texturas, Luz, Cheiros, Movimento), que é **exatamente** a distinção
    que o próprio material diz ser a central. O schema existente era melhor que a
    lista proposta.
  - **Duas lacunas de Perfil ficam registradas, não inventadas:** `sono` não tem
    campo para *onde a criança dorme*, ambiente do quarto nem medos;
    `comunicacao` não distingue **uso espontâneo de uso provocado**, que é a
    bifurcação central do tema. Até existirem, a informação vai para "Outras
    observações". **Não criar campo sem decisão de produto.**
  - Sete seções do PDF que duplicavam tema canônico (foco, aprendizado,
    autonomia, motor, imitação, socialização, alimentação) **não** foram
    incorporadas: eram resumos de uma página de documentos com 10 a 14 mil
    caracteres, e duas fontes competindo é pior que uma lacuna.
- **🐛 LACUNA SISTÊMICA DA BASE 3 (2026-08-09), medida nos cinco casos-ouro.**
  Não é falta de volume; é falta de **variedade funcional**.
  - **`uso de interesse`, `progressão` e `observar` estão AUSENTES nos cinco
    temas.** Nenhuma boa prática usa o interesse da criança como ponte. A
    revisão do PR #76 destravou o validador que barrava a "Missão dos Fósseis" —
    e **não há repertório para entregar no lugar**. Destravar não bastou.
  - **Por caso** (acervo → elegíveis na idade → quantas pontuaram):
    sono 31→5→2 · rotina 45→13→2 · sensorial 38→10→3 · emocional 75→34→4 ·
    comunicação 66→32→**1**.
  - **CORREÇÃO de laudo anterior:** eu havia relatado comunicação como bem
    servida (17 pontuando). Aquilo usou um relato longo. Com o **caso-ouro real**
    — *"me puxa pela mão pra pegar as coisas mas quase não pede sozinho"* —
    pontua **1**. O acervo de comunicação tem volume e não tem aderência ao
    relato curto.
  - **SONO é o pior**: para 8 anos sobram 5 boas práticas, e as duas que sobem
    falam de dever de casa e de caixa para celular. Zero repertório para presença
    do cuidador ao adormecer, que é o núcleo do caso.
- **✅ FASE 3C — MAPA DAS LACUNAS DA BASE 3 (2026-08-09).** Laudo completo em
  [lacunas-base3-fase-3c.md](lacunas-base3-fase-3c.md). 20 subproblemas tirados
  das bifurcações da BASE 2 nova, medidos contra 370 boas práticas ativas.
  - **🐛 SETE DOS VINTE SUBPROBLEMAS TÊM ZERO BOA PRÁTICA ADERENTE.** Não é
    falta de volume: `comunicacao` tem 32 elegíveis para 4 anos e **nenhuma**
    responde ao caso-ouro do próprio tema.
  - **⚠️ ISSO MUDA A PREMISSA DO PILOTO.** Eu havia recomendado emocional por
    ser o tema mais bem servido — medindo **por tema**. Medindo **por
    subproblema**, emocional é bom em dois e **cego em dois**: *sobrecarga
    acumulada* (0 aderentes) e *sinais precoces / ponto de entrada* (0
    aderentes). E esses dois são exatamente onde a BASE 2 nova é mais forte —
    *"qual é o primeiro sinal de que está começando a ficar difícil?"* é a
    melhor pergunta do documento, e **não há repertório para a resposta**.
  - **Duas lacunas transversais de verdade, no acervo inteiro:** `treino em
    momento calmo` **7 de 370** e `próximo passo` **4 de 370**. A primeira é o
    mecanismo mais citado pela BASE 2 nova; a segunda é o que impede a Ayla de
    sustentar uma frente por mais de um dia.
  - **CORREÇÃO de laudo meu de hoje mais cedo:** eu disse que `uso de interesse`
    estava *ausente nos cinco temas*. O acervo tem **32** — elas não sobrevivem
    ao filtro de idade nem alcançam o piso nesses temas. A frase certa é: existe
    repertório de interesse e ele não chega nestes casos.
  - **52 registros novos estimados**, em P0/P1/P2, mais três conteúdos
    existentes que estão a uma frase de servir e valem melhoria em vez de
    duplicação.
  - **Critério objetivo de pronto** definido no laudo, com o item que evita a
    armadilha principal: cada conteúdo novo é validado pelo caso-ouro do seu
    subproblema. **Escrever não é cobrir.**
- **⏳ FASE 4A — não iniciada.** Autorizada como piloto de EMOCIONAL em
  Estratégias Web. Bloqueio conhecido antes de começar: dos quatro subproblemas
  de emocional, dois não têm o que entregar. A bancada precisa incluí-los e
  esperar que falhem — senão o piloto mede só a metade boa do tema.
- **✅ FASE 3D — AMOSTRA DE NOVA GERAÇÃO DA BASE 3 (2026-08-09).** Dez registros
  para os dois subproblemas cegos de emocional, em
  `scripts/base3-emocional-nova-geracao.mjs`. **Gravados como `rascunho`** —
  `recuperar.ts` filtra `status = ativo`, então nada chega a família nenhuma.
  - **A cobertura foi resolvida, e está medida.** Sobrecarga acumulada: **0 → 2**
    aderentes. Sinais precoces: **0 → 7**. Os dois buracos da Fase 3C fecharam.
  - **🐛 MAS SÓ 6 DOS 10 SOBEM NO CASO PARA O QUAL FORAM ESCRITOS**, pelo critério
    que eu mesmo defini na 3C. Testando cada um contra um relato irmão do mesmo
    subproblema, **oito** são recuperáveis em algum lugar — e **dois são
    invisíveis**: *"Uma coisa por vez quando o dia já foi demais"* e *"O que
    fazer no sinal"*.
  - **A causa é a mesma nos dois, e vale como regra para os 42 restantes: o
    título é a superfície de recuperação.** O ranking pesa título 5, quando_usar
    4, tags 3, corpo 2 — e exige dois conceitos convergindo. Os que sobem têm no
    título as palavras que a mãe usa (*"explosão"*, *"fim da tarde"*,
    *"escola"*, *"auge"*, *"perceber"*). Os dois invisíveis têm títulos bonitos e
    sem nenhuma palavra do relato. **Registro bem escrito com título poético é
    conteúdo que não existe.**
  - **Custo:** corpo médio de ~1.400 caracteres, ~355 tokens por registro. Três
    por turno custam ~1.060 tokens de contexto. É o preço do repertório; a
    resposta continua seletiva.
  - **Proveniência preservada sem criar base de livro.** `origem` tem CHECK
    constraint no banco e só aceita `admin`; a linha AUTOR/CIÊNCIA/KOLO foi para
    `referencia_bibliografica`. Nenhum registro repete metáfora neuroanatômica
    como fato — não há "cérebro de cima" nem "hemisfério direito emocional".
  - **Duplicação evitada:** *"Contar o dia depois"* quase colidiu com
    *"Capacidade de se observar"*, que já existe e sobe no mesmo relato. Ficaram
    porque atacam momentos diferentes (reconstruir o episódio × perceber-se
    durante), mas a proximidade está registrada.
  - **⏳ PENDENTE:** ativar (`status = ativo`) só quando a Fase 4A estiver pronta
    para medir; corrigir os dois títulos invisíveis; decidir se o enum de
    `origem` merece migração para carregar proveniência estruturada.
- **✅ ABLAÇÃO A–E EXECUTADA COM MODELO REAL (2026-08-09).** 4 casos × 5
  condições, 20 chamadas. Transcrição integral em
  [bancada/ablacao-emocional-2026-08-09.txt](bancada/ablacao-emocional-2026-08-09.txt).
  Perfil sintético, nenhuma família real, nada enviado a ninguém.
  - **A licença generativa NÃO é ruído — é a diferença.** A pergunta do Sérgio
    era: se D e E saírem iguais, o modelo já faz a síntese sozinho. **Não
    saíram.** No caso dos sinais precoces, D faz uma pergunta melhor e para
    aí; **E entrega o método**: *"rebobina a fita — qual foi a última coisa que
    você percebeu antes do auge? Não a mais chamativa, a primeira. Anota. Em
    pouco tempo vai aparecer um sinal que se repete. Esse é o seu ponto de
    entrada."* Só o E dá à mãe algo para fazer hoje à noite.
    **"Criatividade com lastro" precisa ser arquitetura, não expectativa.**
  - **🐛 ACHADO NEGATIVO: A BASE 3 PIOROU UM CASO.** Em *"bate na irmã"*, a
    condição C (Perfil + BASE 2) citou os sinais que o Perfil já registrava —
    *"aqueles sinais que você já conhece dele"*. A condição D, com BASE 3, **jogou
    fora essa personalização** e fez uma pergunta genérica. O conteúdo
    recuperado eram as BPs antigas de crise (44/35/21 pontos), e elas **diluíram
    o Perfil**. Repertório ruim não é neutro: compete com o que já funcionava.
  - **Onde a BASE 3 nova funcionou, funcionou visivelmente.** Em sobrecarga, D e
    E reproduzem a chave do registro novo — *"não foi a meia; a meia foi o
    último item de uma conta que já estava alta"* — e perguntam pelo horário e
    pelas duas horas anteriores, que é a operação do registro.
  - **Caso insuficiente ("ele tem tido umas crises"): as cinco condições pediram
    esclarecimento e nenhuma inventou nada.** O piso de aderência devolveu zero e
    o sistema não forçou repertório. É o comportamento correto.
  - **Custo medido:** entrada de **145 tokens (A) → 3.010 (E)**, ~20×. Latência
    de **4,0s (A) → 11,4s (E)** no pior caso; mediana de E em torno de 5s. O
    ganho tem preço e ele é conhecido.
- **📌 DECISÃO REGISTRADA (Sérgio, 09/08/2026): títulos humanos ficam.** Os dois
  registros invisíveis da Fase 3D **não** serão reescritos para otimizar ranking.
  Se causar problema real, corrige-se com evidência.
- **✅ FASE 3E (2026-08-09).** Duas medições e uma correção de arquitetura.
  Transcrições em [bancada/ablacao-3e-2026-08-09.txt](bancada/ablacao-3e-2026-08-09.txt).
  - **A CAUSA DA DILUIÇÃO NÃO ERA A BASE 3 — era a falta de instrução de
    precedência.** Rodando o caso "bate na irmã" em cinco condições: com Perfil
    + BASE 2 a Ayla citava os sinais registrados; acrescentar BASE 3 antiga
    tornava a resposta genérica; **acrescentar a âncora do Perfil trouxe a
    personalização de volta** — a condição E1 nomeou literalmente os sinais do
    Perfil ("fica mais agitado, fala mais alto, começa a andar rápido").
    Não é preciso remover repertório: é preciso dizer quem ganha.
  - **🐛 SEQUESTRO MEDIDO.** Em 18 subproblemas de 5 temas, **duas boas práticas
    antigas ocupam 8 das vagas de top-3**: *"Bater, morder, chutar, gritar:
    todas formas de comunicação"* (4×) e *"Quando a criança entra em crise"*
    (4×) — e as duas atravessam `emocional` **e** `sensorial`. Só 10 BPs
    venceram em exatamente um subproblema. **Classificação: RESTRINGIR
    SUBTEMA** para as duas; nenhuma alteração feita ainda, porque a âncora
    resolveu o sintoma sem precisar mexer no acervo.
  - **Repertório específico vence genérico, com licença nos dois lados.** Em
    sobrecarga, E2 (BASE 3 nova) usou o interesse do Perfil para explicar —
    *"segurando a vontade de falar sobre as estações da linha azul"* — e
    entregou o método do registro. E1 (BASE 3 antiga) ficou bom e genérico.
  - **🐛 RISCO NOVO: a licença aumenta a invenção.** No caso sem repertório
    aderente, o modelo escreveu *"o cérebro dela está dizendo: aqui eu consigo
    me reorganizar"* — mecanismo inventado. Por isso a cláusula anti-invenção de
    `LICENCA_GENERATIVA` cita **o exemplo real**, e não uma proibição abstrata:
    proibição abstrata competiu com ser prestativo e perdeu.
  - **Onde ficou:** `lib/conducao/composicao.ts`, **fora de `nucleoConducao`**.
    O núcleo é compartilhado com o WhatsApp e a missão proíbe alterá-lo. Um teste
    **morde** se alguém colar a licença no núcleo, e outro **morde** se o módulo
    ganhar consumidor — hoje ele não tem nenhum.
  - **Custo:** entrada de 857 (C) → 2.778 tokens (E2). Latência de 3,5s a
    **14,1s** no pior caso. A latência é o item mais frágil do conjunto.
- **🐛 FALHA MINHA, corrigida (09/08/2026).** O PR #77 foi mergeado com dois
  testes quebrados em `base2.test.ts` — as asserções diziam "os sete temas" e
  "sono não deveria ter material", e o próprio PR tornou as duas falsas. **O CI
  não rodou a suíte naquele PR** e eu não conferi antes de mergear. O teste 4
  foi invertido para guardar o que passou a valer: os cinco temas existem **e**
  são recuperáveis por estado.
- **📌 CORREÇÃO DE NOMENCLATURA (2026-08-09).** Eu chamei as Fases 1, 2 e 3 de
  **CONCLUÍDAS** em vários relatórios. Medindo consumidores reais no código
  mergeado, as três tinham **ZERO**. O termo certo é **construída/testada →
  ligada só na 4A.1**. A imprecisão poderia ter feito o Sérgio acreditar que a
  Fase 4A era menor do que é: ela liga **quatro módulos que nunca rodaram
  juntos**, não um.
- **✅ FASE 4A.1 — as três leituras ligadas atrás de flag (2026-08-09).**
  `KOLO_PILOTO_ESTRATEGIAS=1`. Ausente ou qualquer outro valor mantém o fluxo
  antigo. Medição em [bancada/4a1-ranking-2026-08-09.txt](bancada/4a1-ranking-2026-08-09.txt).
  - **O ranking mudou o trio em 3 dos 8 casos, e onde mudou foi decisivo.**
    *"Bate na irmã"*: **3 de 3 trocaram** — saía *"o cérebro tem andares"* e
    *"crianças pequenas não têm capacidade neurológica"*; passou a sair
    *"Explosões de raiva — bate, grita, joga coisas"*. *"Festa/sensorial"*:
    **3 de 3**, e entrou *"Crises em ambientes com muitos estímulos (festas,
    shoppings)"*. Foco/matemática: 1 de 3.
  - **Nos outros 5 o ranking foi INERTE — e isso confirma a Fase 3C, não
    contradiz o ranking.** Sono, comunicação e sobrecarga são exatamente os
    subproblemas medidos com zero boa prática aderente. O ranking não inventa
    conteúdo que o acervo não tem.
  - **O caso 2 melhoraria hoje se os 10 rascunhos estivessem ativos** — eles
    foram escritos para ele. Isso é a 4A.3, e a medição já mostra o ganho
    esperando.
  - **Custo praticamente zero.** BASE 2 custa **0 ms** (módulo gerado em build,
    zero I/O). O ranking roda sobre candidatas já em memória: 204 ms contra
    305 ms no caso 1 — dentro do ruído. **Nenhuma chamada de IA nova.**
  - **Tokens:** a BASE 2 acrescenta ~1.500 a 2.350 caracteres (~400–600 tokens).
    A BASE 3 não mudou de tamanho, mudou de conteúdo.
  - **Isolamento por construção:** o ranking é **opt-in por parâmetro** em
    `recuperarBoasPraticas` — omitir devolve o comportamento byte a byte. O
    WhatsApp não passa `relato` e não passa por `buildContext`. **12 testes, 3
    sabotagens mordem.**
- **⏳ PEND: reconciliar o `main` local.** Backup em
  `backup/main-local-2026-08-09`. 5 commits não publicados, 117 atrás do
  `origin/main`, **97 arquivos divergentes**. Classificação por conteúdo:
  `068af16` já incorporado · `0e53a91` e `d97811d` parcialmente (a migração
  local `0071_rotina_resultado` virou `0075` no origin) · `1506aa1` e `33d0894`
  trazem **6 arquivos que não existem no origin/main**:
  `escopo-kolo.ts`, `escopo-kolo.test.ts`, `plano-recursos.ts`,
  `plano-estrutura.test.ts`, `0071_rotina_resultado.sql`,
  `0076_plano_versionamento.sql`. **Nenhum foi aplicado.** Missão própria.
- **✅ ROTINA PRESERVADA NA 4A.1 — PROVADO (2026-08-09).** Auditoria específica,
  pedida antes de aprovar a fatia.
  - **Por execução:** os 11 arquivos de teste da Rotina — 322 testes — rodam
    **idênticos antes e depois**. Revertendo os quatro arquivos da 4A.1 para o
    commit anterior (`1ab817a`) e rodando a mesma seleção: **322 passando**. Com
    a 4A.1: **322 passando**. Nenhum teste mudou de resultado.
  - **Por leitura:** nenhum dos sete módulos da Rotina — `gerar.ts`,
    `rotina-guiada.ts`, `prontidao-rotina.ts`, `validacao-rotina.ts`,
    `rotina-progresso.ts`, `rotina-resultado.ts`, `api/ludico/gerar-rotina` —
    importa `context.ts`, `prompt.ts`, `engine.ts` ou `piloto.ts`. **A Rotina não
    passa por `buildContext`.**
  - **A flag não alcança a Rotina nem ligada.** O recuperador **não lê a flag**:
    a decisão é de quem chama, e o caminho da Rotina não passa `relato`. Um
    `if (pilotoLigado())` dentro de `recuperarBoasPraticas` atingiria todo mundo
    — é a sabotagem 2, e ela morde.
  - **8 testes novos de fronteira** em `rotina-isolamento-4a1.test.ts`, com 3
    sabotagens verificadas. Eles guardam a fronteira nos **dois sentidos**:
    a Rotina não importar o que a 4A tocou, e o que a 4A tocou não importar a
    Rotina.
  - **As correções caras continuam escritas:** "A SEQUÊNCIA DO QUADRO É A DA
    FAMÍLIA", "CONFIRMAR OU MONTAR" e "QUAL RECORTE".
  - **Os 5 commits locais não foram usados.** Os seis arquivos exclusivos deles
    continuam ausentes do `origin/main`, e o backup segue em `33d0894`.
- **✅ FASE 4A.2 + 4A.3 (2026-08-09).** Âncora, licença e os 10 registros novos
  ligados no piloto. 8 casos com modelo real em
  [bancada/4a2-oito-casos-2026-08-09.txt](bancada/4a2-oito-casos-2026-08-09.txt).
  - **O Perfil passou a mudar a resposta, não só a evitar pergunta.** No caso da
    leitura, a Ayla usou o interesse por dinossauros **funcionalmente**:
    *"use palavras de dinossauro que ele já conhece de cor — TIRANOSSAURO. Ele
    sabe essa palavra dormindo. Como ele já sabe o destino, fica mais fácil
    juntar. É treino de leitura com rede de segurança."* Isso é composição, não
    citação do perfil.
  - **Reenquadramento do cuidador aconteceu sozinho.** A mãe disse *"acho que é
    preguiça"*; a resposta foi *"não é preguiça, é travamento de início"*, com o
    experimento concreto junto (fazer o primeiro exercício em voz alta e devolver
    o segundo). Nenhuma linha do prompt pede reenquadramento — ele emergiu do
    Perfil + licença.
  - **Mecanismo explicado em linguagem de casa:** *"é como carregar balde furado
    — quando enche, já vazou metade"*.
  - **🐛 A CLÁUSULA ANTI-INVENÇÃO NÃO SEGUROU.** `LICENCA_GENERATIVA` proíbe
    *"o cérebro dela está dizendo…"* **citando a frase exata**, e o modelo
    produziu três variantes mesmo assim: *"o cérebro dela tá dizendo isso é
    difícil demais"*, *"o cérebro dele precisa desse tempo pra voltar"*, *"o
    cérebro dele vai somando tudo isso"*. São metáforas, não afirmação de
    evidência — mas **proibir citando o exemplo não bastou**. Fica registrado
    como o achado que a 4A.2 não resolveu.
  - **🐛 O CASO 1 NÃO USOU O PERFIL.** Em *"bate na irmã"*, o Perfil registrava
    os sinais precoces e a resposta não os mencionou — enquanto na ablação de
    03/08 a mesma configuração os nomeava. **Personalização inconsistente entre
    casos**, e não sei ainda por quê.
  - **4A.3 é ganho limpo.** Em sobrecarga, com os registros novos (98/80/26 pts
    contra 18/12/10), a resposta passou a entregar o método —
    *"por uns três dias, anota duas coisas: que horas ficou difícil e o que
    tinha rolado nas duas horas antes"* — ficou **828 caracteres contra 1.179**,
    e **não inventou mecanismo nenhum**. Mais útil, mais curta, mais segura.
  - **Os 10 registros continuam em `rascunho`.** O piloto os alcança por
    `statusAceitos: ["ativo","rascunho"]`, não por publicação — desligar a flag
    os faz sumir, e o WhatsApp nunca os vê.
  - **Custo:** 1.807 a 2.963 tokens de entrada · 4,0 s a 13,9 s. **A latência é o
    item que ainda não está resolvido.**
  - **Dois testes-guarda foram INVERTIDOS de propósito** — eles guardavam a
    ausência de consumidor na 4A.1 e agora guardam a presença, com a mesma
    severidade (exatamente um consumidor, e é o prompt da web).
- **⏳ PLANO KOLO — levar a inteligência conversacional aprovada para a geração
  e o acompanhamento do Plano.** Auditoria de 09/08/2026 sobre `lib/ia/plano.ts`:
  - **JÁ EXISTE E ESTÁ LIGADO:** contexto do Perfil (via `buildContext`), uso de
    interesses, "o que observar", próximo passo, e leitura do resultado anterior.
  - **EXISTE MAS NÃO ESTÁ LIGADO:** perfil consultável campo a campo · BASE 2 ·
    ranking por aderência · licença generativa. **O Plano chama `buildContext`
    mas NÃO passa `relato`** — então `piloto` é sempre `false` ali, e ele recebe
    zero da inteligência nova, mesmo com a flag ligada.
  - **DIVERGÊNCIA:** o Plano usa `VOZ_LIMITES_E_FRONTEIRA`, **não** o
    `nucleoConducao`. Ele tem uma voz própria, não a voz da Ayla — o que
    contradiz o que se acreditava sobre "a mesma cabeça nos dois canais".
  - **NÃO EXISTE:** progressão explícita como campo.
  - **Só implementar depois que a Karina aprovar Estratégias Web**, para não
    replicar uma arquitetura em calibração.
- **✅ PRÉ-GO (2026-08-09).** Três correções, todas medidas em 5 rodadas do
  mesmo caso por condição. Dados em
  [bancada/prego-3vs2-bps-2026-08-09.txt](bancada/prego-3vs2-bps-2026-08-09.txt).
  - **🐛 A LATÊNCIA NÃO ERA CONTEXTO — É TAMANHO DE RESPOSTA.** Minha hipótese
    era que 3 BPs afogavam o Perfil e inchavam o prompt. **Errada.** Cortar para
    2 economiza só 200 tokens. O que a medição mostrou é outra coisa: 225
    caracteres de resposta → 3,2 s; 1.002 caracteres → 12,4 s. **A latência
    acompanha o que o modelo ESCREVE, não o que ele lê** — e mais repertório
    convida a escrever mais.
  - **Mesmo assim, 2 BPs vence nos três eixos:** pior caso **5,9 s contra
    17,3 s**, Perfil usado em **3 de 5 contra 1 de 5**, invenção igual. Aplicado
    só dentro do piloto (`limite: piloto ? 2 : undefined`); fora dele continua 3.
  - **🐛 A ÂNCORA ERA SÓ NEGATIVA.** Ela proibia reperguntar e nunca mandava
    construir a pergunta EM CIMA do que já se sabe — por isso, em modo de
    investigação, o Perfil não mudava nada. A regra nova diz: *"investigar não é
    começar do zero"*, com o exemplo de ancorar a pergunta no dado registrado.
  - **✅ ANTI-INVENÇÃO RESOLVIDA ESTRUTURALMENTE: 0 em 10 rodadas** (era 1 em 5).
    A defesa não é outra lista de frases proibidas — é uma **regra de sujeito**:
    quem faz as coisas é a criança ou a situação, **nunca o cérebro**. O cérebro
    não diz, não quer, não decide, não pede, não entende, não manda, não acha.
    Isso cobre as variantes que ninguém escreveu ainda, que era a falha da lista.
    E os **três registros legítimos ficaram nomeados** — conhecimento geral
    hedgeado, hipótese marcada e analogia anunciada —, para a correção não
    empobrecer a Ayla.
  - **⚠️ PERSONALIZAÇÃO AINDA É 3 EM 5.** Melhorou, e não está resolvida. Fica
    como o item mais fraco do piloto, e é justamente o tipo de coisa que o olho
    da Karina pega melhor que a minha régua.
- **✅ FORMATAÇÃO DE ESTRATÉGIAS (2026-08-09).**
  - **LIMITE DE TEXTO: não existia teto de caracteres.** O prompt já dizia *"O
    TAMANHO É O DA AJUDA — não há alvo de palavras"*, e `max_tokens: 2048`
    (~8.000 caracteres) nunca chegou perto de cortar: as respostas medidas
    ficaram entre 99 e 1.609. **Nada foi removido, porque não havia o que
    remover.** O `slice` em `resposta-markdown.tsx` só apara um rodapé de
    "registrar este papo".
  - **🐛 A FORMATAÇÃO SE PERDIA NO PROMPT, NÃO NA TELA.** O renderizador já
    suporta `#`…`######`, `**negrito**`, `- `, `1. `, `> ` e `---`. **O prompt é
    que proibia**: dizia *"negrito no máximo em 1 palavra e nunca como título"*.
    A tela sabia desenhar o que o modelo estava proibido de escrever.
  - **A condicionalidade foi PRESERVADA, e um teste existente me impediu de
    quebrá-la.** A regra `const entrega = intencao === "desafio"` mantém crise,
    desabafo e dúvida em prosa — quem desabafa não quer documento organizado.
    Minha primeira versão liberava estrutura para todo mundo; o teste mordeu.
    Agora os dois ramos são explícitos e uma sabotagem prova que não podem virar
    um só.
- **⏳ PEND: levar o mesmo padrão visual para o Plano Kolo**, depois da aprovação
  da Karina. Junto com a pendência da inteligência conversacional no Plano.
- **✅ AUDITORIA DA ENTREGA (2026-08-09).** Duas perguntas que podiam bloquear o
  piloto. Transcrições em
  [bancada/entrega-estrategia-atividade-brincadeira-2026-08-09.txt](bancada/entrega-estrategia-atividade-brincadeira-2026-08-09.txt).
  - **✅ A IA DISTINGUE OS TRÊS — e com folga.** Em 3 desafios, pedindo
    separadamente estratégia, atividade e brincadeira, as três respostas
    compartilharam **3, 2 e 1 palavra de conteúdo**. Não é a mesma orientação com
    títulos diferentes.
    - *Estratégia* (leitura): o dedo da criança embaixo da sílaba e o adulto
      repetindo a palavra inteira por cima do mesmo caminho — muda a atuação do
      adulto, não propõe atividade.
    - *Atividade*: "Leitura em duas passadas", com etapas e progressão de duas
      sílabas em diante. Sem nome fantasioso, como deve ser.
    - *Brincadeira*: "Caçada de Dinossauro Perdido" — o dino só "acorda" se o
      nome inteiro for falado. **Não existe no banco**: é criação com lastro no
      mecanismo, usando o interesse como ponte e explicando o que treina.
    - E no caso dos sinais precoces saiu o "Semáforo do Maquinista", com a criança
      de maquinista e o adulto de torre de controle. **Interesse como ponte, não
      como prêmio.**
  - **🐛 BASE 3 — A CLASSIFICAÇÃO NÃO É CONFIÁVEL PORQUE NÃO EXISTE.** Não há
    campo de tipo: as colunas são `nivel` (nulo em 378 de 381), `tags`,
    `atividades_praticas` e texto. A palavra "brincadeira" aparece no texto de
    **87 registros**, e ao tentar classificá-los semanticamente descobri que a
    minha própria heurística não separa — ela marcou *"Corte de dever 2h antes
    de dormir"* como brincadeira. **A conclusão honesta não é "a taxonomia está
    errada"; é que taxonomia não há.** O que existe são tags soltas
    (`brincadeira`, `jogo`, `atividade`, `jogo-paralelo`) sem critério.
  - **CONSEQUÊNCIA PARA O PILOTO: nenhuma.** A distinção que importa é a que a
    IA faz na hora de entregar, e essa passou. A reclassificação do acervo é
    trabalho de conteúdo, não bloqueio de experiência.
- **⏳ PEND: taxonomia funcional da BASE 3** — decidir se estratégia · atividade ·
  brincadeira viram campo, e com que critério. **Não migrar em massa antes da
  decisão editorial.** Hoje 87 registros mencionam brincadeira e não se sabe
  quantos são.
- **⏳ PEND: regra de oferta do Plano.** O prompt web diz *"assim que tiver
  contexto suficiente pra um bom plano, FECHE assim"* e *"use SÓ quando for
  mesmo hora de oferecer, nunca em toda resposta"*. A decisão de produto do
  Sérgio é mais estrita: **Plano não é CTA padrão** — a oferta acontece quando a
  conversa já produziu compreensão E há vantagem real em organizar os próximos
  dias, e ela precisa **explicar por quê**, não anunciar funcionalidade. A
  redação atual descreve o que o Plano contém ("mais ideias, frases prontas"),
  não por que vale naquele caso. **Não medi a frequência real de oferta** — fica
  para a bancada com o `blocoIntencao` real.
- **⏳ PEND: PDF + link do Plano**, e a inconsistência entre Web e WhatsApp. Não
  auditado nesta missão.
- **✅ FORMATAÇÃO CHEGA À TELA — PROVADO (2026-08-09).** 6 respostas geradas com
  o bloco novo, em [bancada/gate-estrategias-2026-08-09.txt](bancada/gate-estrategias-2026-08-09.txt).
  **A estrutura escala com a necessidade, que era exatamente o pedido:**
  | resposta | títulos | negritos | lista | citação |
  |---|---|---|---|---|
  | dúvida pontual (756ch) | 0 | 1 | 0 | 0 |
  | uma frente (428ch) | 0 | 1 | 0 | 0 |
  | várias frentes (1.318ch) | **3** | 4 | 2 | **1** |
  | atividade (2.059ch) | **3** | 6 | **6** | 0 |
  | brincadeira (1.079ch) | 2 | 4 | 0 | 0 |
  Resposta curta continuou sem título; resposta com várias frentes ganhou três.
  **Nenhum gabarito fixo apareceu.**
- **🐛 OFERTA DE PLANO — corrigida DUAS vezes, a segunda não verificada.**
  A regra antiga (*"assim que tiver contexto suficiente, FECHE assim"*) virou
  *"transformar isto num plano acrescenta algo que esta conversa sozinha não
  entrega? Se não, não ofereça"*. **Medido: 0 ofertas em 6 casos** — inclusive no
  **pedido explícito** *"você consegue me montar um plano pra essa semana?"*, em
  que a Ayla perguntou o que o plano deveria organizar **e não ofereceu o
  botão**. Isso é super-correção minha: fazer a mãe pedir duas vezes.
  Acrescentei *"quando a família pedir, o pedido basta — ofereça o botão na
  mesma resposta"*. **NÃO reverifiquei**: a bancada com streaming quebrou no
  parse e eu não insisti. Fica como o único item do gate sem prova.
- **⚠️ LATÊNCIA DA WEB NÃO ESTÁ PROVADA.** Medi **total de geração**: p50 12,6 s,
  pior 21,6 s. **Mas a web faz streaming** (`client.messages.stream`), então o
  que a mãe espera é o TTFT, não o total — e **o TTFT eu não consegui medir**.
  Sem esse número, não afirmo que a latência da Web está aceitável. É o que
  falta para o gate fechar.
- **⏳ P0 — LATÊNCIA E RETOMADA CONVERSACIONAL DO WHATSAPP.** Diagnóstico
  completo, nenhuma alteração feita. **O comentário da função diz "streaming,
  manda cada parágrafo assim que fica pronto"; o código diz "buffer completo,
  nada saiu para o WhatsApp até aqui".** Os dois discordam e o código é o que
  roda: **TTFT no WhatsApp = tempo total**.
  - **3 chamadas de IA sempre** (`classificarIntencao` → `gerarRespostaAyla` →
    `extrairESalvarEventos`) e **até 4 condicionais**, todas em série.
  - Três leituras de banco serializadas **dentro da lista de argumentos** de
    `classificarIntencao` — `ultimasFalas`, `carregarDesafiosOnboarding`,
    `carregarCatalogoSkills`. Candidatas óbvias a `Promise.all`.
  - `TETO_ESPERA_SEGUNDOS = 4` de atraso **artificial**, somado depois de tudo
    pronto.
  - `extrairESalvarEventos` roda **antes** do `return` — a família espera por uma
    extração que não muda a resposta.
  - Ordem proposta: instrumentar → primeira bolha antes do fim da geração →
    `Promise.all` → mover a extração para depois → rediscutir os 4 s → só então
    abertura/retomada e o caso Mario.
- **⏳ ABERTURA E RETOMADA (caso "Oi, tudo bem?").** Missão recebida, **não
  iniciada**. Regra a implementar: **memória é contexto, não pauta**. Hipótese a
  verificar primeiro: o comportamento pode vir de `gerarSugestaoRepertorio`
  (`orchestrator.ts:1115`) ou de `gerarMensagemEspontanea` (`:358`) — se for,
  o conserto é na fronteira entre abertura e mensagem espontânea, não no prompt.
- **✅ TTFT DA WEB MEDIDO — resolve a dúvida da latência (2026-08-09).**
  12 execuções com streaming, em [bancada/ttft-web-2026-08-09.txt](bancada/ttft-web-2026-08-09.txt).
  **TTFT: mediana 1.222 ms · p90 1.766 ms · pior 1.979 ms.** Total de geração:
  mediana 8,4 s, pior 21,1 s. **A mãe começa a ler em pouco mais de um segundo** —
  o total só importa para custo. A Web **não** tem o problema do WhatsApp, e a
  razão é estrutural: `messages.stream()` no engine contra buffer completo no
  orquestrador.
  - **A causa do bench quebrado era boba e vale registrar:** `r.body` entrega
    pedaços de rede, não linhas. Um `data: {...}` chega partido entre dois
    chunks, e dividir chunk a chunk parte o JSON no meio. A correção é um buffer
    que só consome linhas completas.
- **⚠️ OFERTA DE PLANO — POSSÍVEL PROBLEMA, NÃO REGRESSÃO COMPROVADA.**
  **RECLASSIFICADO EM 2026-08-10** — ver "A MEDIÇÃO NÃO VALE COMO PROVA" no fim
  deste bloco. O número abaixo (**0 ofertas em 8 rodadas**) foi obtido com um
  system reconstruído à mão, e **não** reproduz o pipeline real. O achado
  continua aberto; o que cai é o status de regressão comprovada do produto.
  Os dois casos em que deveria oferecer:
  - **Caso A · pedido explícito** — *"você consegue me montar um plano pra essa
    semana?"*. A Ayla responde *"Consigo sim! Mas antes de montar, me conta: o
    que você quer organizar nesse plano?"* — **atende a intenção e não emite o
    marcador**. A mãe pede plano e não recebe botão.
  - **Caso B · quatro frentes** — explode no fim da tarde, briga com a irmã, não
    quer banho, tem lição. A resposta é boa e longa, e **termina com "você não
    precisa de um plano gigante"**. Ela argumenta CONTRA o plano no caso que
    mais o justifica.
  - **CAUSA, e é o padrão que este repositório já conhece:** a proibição lidera
    o bloco e está em termos absolutos — *"PLANO NÃO É FECHAMENTO PADRÃO"*,
    *"se a resposta for não, não ofereça"* — e as autorizações vêm depois, como
    orações subordinadas. **Instrução que compete com uma vizinha mais forte
    perde**, e a mais forte aqui é a que proíbe.
  - **MENOR CORREÇÃO PROPOSTA (não aplicada):** não acrescentar texto — **mudar
    a ordem**. O pedido explícito vira portão que curto-circuita ANTES da
    avaliação: *"Se a família pediu plano, ofereça o botão. Ponto — não passe
    pela avaliação abaixo."* E "várias frentes" precisa virar gatilho afirmativo
    no início, não item de lista depois da proibição.
  - ~~**É regressão em relação ao comportamento anterior**, que oferecia demais
    mas nunca deixava pedido explícito sem botão. **Bloqueia o piloto.**~~
    **RETIRADO EM 2026-08-10** — ver abaixo.
  - **⚠️ A MEDIÇÃO NÃO VALE COMO PROVA (correção metodológica, 2026-08-10).**
    Os dois benches que produziram estes números — `scripts/ttft-web.mjs` e
    `scripts/gate-estrategias.mjs` — **reconstroem o system prompt à mão** em
    vez de chamar `buildSystemTextConversa`. O que eles mediram difere do
    produto em cinco pontos, todos verificados no código dos scripts:
    1. **núcleo simplificado** — um `NUCLEO` de três linhas escrito no script,
       no lugar de `nucleoConducao()` inteiro;
    2. **sem `VOZ_CONVERSA`**;
    3. **sem as skills** (`buildIdentityBlock`) e sem `FATOS_COMERCIAIS`;
    4. **sem `formasDeEntrega`**, `INTERESSE_COMO_VEICULO` e
       `A_CRIANCA_ANTES_DO_ROTULO`;
    5. **modelo diferente do alvo** — `claude-sonnet-4-5-20250929` no script
       contra `MODELO_CONVERSA.anthropic` (`claude-sonnet-4-6`) em produção.
    Some-se a isso que **a intenção foi fixada à mão**: nenhum dos dois rodou
    `classificarIntencao`, e é ela que decide se o bloco `desafio` — o único
    que carrega a instrução do marcador — chega ao modelo. Classificado como
    `duvida`, o caso A **não teria como** emitir o marcador, e isso não seria
    regressão nenhuma: seria roteamento.
    > O comentário de `buildSystemTextConversa` já avisava, em `prompt.ts`:
    > *"exportada pra a bancada montar o system EXATAMENTE como produção monta.
    > Sem isto a bancada reconstrói o prompt e mede um produto que não existe."*
    > O harness que faz certo **já existia** (`scripts/bancada/*/rodar.mjs`, com
    > o resolvedor de `@/`) e não foi reusado. É §4 do protocolo — reutilizar
    > antes de criar — cobrando o preço na medição, não no código.
  - **ESTADO CORRETO HOJE: "possível problema de oferta de Plano — necessita
    nova validação pelo pipeline real".** Não é baixa: o comportamento descrito
    (pedido explícito sem botão) pode muito bem ser verdadeiro, e a leitura de
    código que atribui a causa à ordem das instruções continua de pé. O que não
    se pode mais afirmar é que **foi medido**.
  - **✅ BAIXA DA SUSPEITA DE REGRESSÃO (2026-08-10).** Medido pelo pipeline
    REAL — `assemblePrompt` + `gerarConversacional`, o par exato da rota de
    produção, com `classificarIntencao` real e `gpt-5.6-luna`, em
    [bancada/piloto-4a-portao-a-2026-08-10.txt](bancada/piloto-4a-portao-a-2026-08-10.txt).
    **A Ayla ofereceu o Plano em 2 de 2 casos pertinentes e em 0 de 6
    impertinentes** — inclusive emitindo o marcador com o ganho daquele caso
    ("num plano eu consigo organizar essa progressão, as frases e o que
    observar em cada etapa"). Não há regressão de oferta.
  - **O que fica desta linha, e não é o número:** a lição metodológica. O
    "0 em 8" era real como medição e falso como conclusão, porque media outro
    produto. **Bancada que reconstrói prompt não vale como evidência de
    comportamento** — e o harness que faz certo (`scripts/bancada/*/rodar.mjs`)
    já existia. `scripts/bancada/oferta-plano/rodar.mjs`, escrito para este fim,
    ficou obsoleto: o Portão A o cobre com fidelidade maior.
- **🐛 TRIAL DE 30 DIAS — corrigido, e a causa raiz não era o texto
  (2026-08-09).** Uma família em teste de **7 dias** podia receber, pelo
  WhatsApp: *"te lembrando que seus 30 dias grátis terminam em 3 dias"*.
  - **ORIGEM 1, a visível:** o template `trial_d3` nasceu na migração 0010,
    quando o trial era de 30 dias. As migrações **0047 e 0051 encurtaram para
    7 e ninguém voltou no texto.** Duas variações, **uma errada** — metade das
    mães avisadas lia 30. `ativo = true`, **disparado pelo cron**
    (`api/ayla/cron/route.ts:520`).
    **Corrigido em produção** (`versao 4`), tirando o número em vez de trocá-lo:
    *"seu período grátis termina em 3 dias"* continua verdadeiro se o trial
    mudar de novo. **Número repetido em texto é número que defasa.**
  - **🐛 ORIGEM 2, a grave: A AYLA NUNCA SOUBE QUANTO DURA O TRIAL.** Nenhum
    prompt de conversa — nem web, nem WhatsApp — informava a duração.
    Perguntada, ela **inferia**, e 30 dias é o palpite de mercado. O único lugar
    que fazia certo era o `/ajuda`, com um bloco *"use estes valores; NÃO
    invente"* que ninguém tinha generalizado.
  - **A constante estava em TRÊS arquivos**, cada um com a sua cópia:
    `ajuda/actions.ts`, `admin/familias/page.tsx`, `admin/teste/actions.ts`.
    Agora existe **uma** fonte: `lib/billing/fatos-comerciais.ts`.
  - **REGRA NOVA: informação comercial e estrutural não é generativa.** A Ayla
    pode inventar uma brincadeira; não pode decidir prazo de teste, preço ou
    funcionamento de cobrança.
  - **E os dois "30 dias" ficaram nomeados no mesmo arquivo**, para não se
    contaminarem: `TRIAL_DIAS = 7` é o teste comercial; a duração de um **Plano
    Kolo** é outra entidade e pode ser 30.
  - **Varredura do banco:** `ayla_message_templates` (13), `ai_prompts` (7),
    `specialist_prompt_templates` (14) e as **381 boas práticas** — **só o
    `trial_d3`** afirmava duração.
  - **6 testes, 2 sabotagens mordem.**
- **📌 O TETO DO NÚCLEO NÃO FOI AUMENTADO — e a tentativa foi o achado.**
  Eu havia subido de 57.000 para 57.300 para caber o fato comercial. **O Sérgio
  vetou, e tinha razão pelo motivo certo:** pela classificação dele, fato
  comercial é **REGRA DE PRODUTO**, não regra universal de voz — **não pertence
  ao núcleo.** O bloco saiu de `diretrizes.ts` e passou a ser injetado pelos
  dois canais (`ia/prompt.ts` e `ayla/responder.ts`). **O teto voltou a 57.000**,
  e um teste morde se o fato voltar para o núcleo.
  **O teto estourar era sinal arquitetural, não obstáculo.**
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

- **✅ A BASE 3 SUSTENTA GENERALIZAÇÃO POR MECANISMO — medido em 11/08/2026
  (Golden Case L, `docs/bancada/golden-case-l-*`).** Uma boa prática real do
  acervo (brincadeira de papéis, `imitacao`+`socializacao`), **sem nenhum
  `passos_praticos` preenchido**, entregue idêntica a três perfis com o mesmo
  objetivo, produziu **generalização em 6 de 6 execuções**: o modelo abstraiu o
  princípio ("criança lidera", reciprocidade, turnos, motivo real para falar) e
  recriou a experiência em três formatos funcionalmente distintos — mediação
  por desenho, turnos motores com a bola, alternância de papéis com apoio
  visual. Não copiou o médico da BP em nenhuma.
  - **Veredito: PASS PARCIAL.** Generalização 6/6, mas 1 PASS_FORTE contra 5
    parciais, decoração residual em 4/6, e um perfil instável entre execuções
    (ver PEND-032).
  - **⚠️ CONCLUSÃO QUE FECHA UMA PORTA, DE PROPÓSITO:** das 370 BPs ativas,
    **apenas 7 têm formato de atividade proposta** e 67% têm `passos_praticos`.
    **Isso NÃO é deficiência comprovada.** A BP que gerou as três intervenções
    é uma ORIENTAÇÃO, sem passos — e bastou. **Não há evidência para criar
    catálogo de atividades nem taxonomia nova**, e criar seria consertar o que
    não quebrou. Se algum dia houver, que venha de um caso que falhe, não de
    uma contagem.
  - **NÃO SEI** se BPs menos explícitas sobre mecanismo generalizam igual —
    testei o melhor caso do acervo, deliberadamente. O gargalo medido está no
    CONTEXTO (o Plano não recebe perfil consultável nem âncora), não na base.

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
- **🔴 AUDITORIA DOS DOIS ACERVOS — 2026-08-09. O MATERIAL EXISTE E NÃO CHEGA.**
  - **ACERVO 1 · `boas_praticas`** — 370 ativas, 15 temas, faixa etária em 368.
    Campos ricos: `versao_conversa`, `quando_usar`, `erros_comuns`,
    `passos_praticos`, `tags`, `perfis_aplicaveis`, `nivel`.
  - **ACERVO 2 · `docs/skills/*.md`** — **84 647 caracteres** de conteúdo
    editorial aprovado, marcado *"FONTE CANÔNICA EDITORIAL — salvo VERBATIM"*,
    em 7 arquivos (aprendizado, autonomia, foco, imitação, motor, nutricional,
    socialização). Contém **exatamente o mapa de investigação por tema** que
    esta frente ia redesenhar: `foco.md` diferencia **doze** motivos distintos
    para "não presta atenção" e lista dezesseis situações de entrada.
    **⚠️ NENHUM CÓDIGO LÊ ESSES ARQUIVOS.** Grep exaustivo em `apps/web/src` e
    `scripts`: zero referências. Os `.md` estão no repositório e **nunca
    chegaram a lugar nenhum**.
  - **O QUE ESTÁ NO BANCO É 13× MENOR.** `specialist_prompt_templates` guarda
    14 skills com quatro campos curtos cada (`objective`/`tone`/`scope`/
    `limits`) — **6 507 caracteres somando as catorze**, contra 84 647 no
    markdown das sete.
  - **E NO WHATSAPP NEM ESSES 6 507 CHEGAM.** A web injeta `objective` no prompt
    (`lib/ia/prompt.ts:34`); no WhatsApp a skill é **apenas chave de
    recuperação** — nada do conteúdo editorial dela entra no prompt. É uma
    assimetria maior que a das tags.
  - **QUATRO CASOS DE BANCADA — o material certo existe e não é escolhido:**

    | caso (idade) | no tema | na faixa | falam do subtema | recuperados | do subtema **fora** |
    |---|---|---|---|---|---|
    | leitura (8) | 39 | 13 | 3 | 3 | 2 |
    | bate na irmã (5) | 75 | 34 | **11** | 3 | **10** |
    | não começa a lição (8) | 35 | 9 | 6 | 3 | 4 |
    | sensorial na tarefa (8) | 38 | 11 | 6 | 3 | 4 |

    No caso da irmã, ficaram de fora *"Explosões de raiva — bate, grita, joga
    coisas: identifique gatilhos"* e *"Valide emoções: 'vejo que você está bravo
    porque…'"* — **os dois conteúdos que descrevem literalmente o caso.**
  - **DOIS MODOS DE FALHA, AGORA DISTINGUÍVEIS.** (1) *o conteúdo não existe*
    para aquela faixa — foi o caso do lúdico para adolescente, medido em 08/08;
    (2) *o conteúdo existe e não é escolhido* — é este, e é o mais comum.
    **A causa do (2) é o ranking empatado**: como o peso não ordena, a seleção
    ignora o subtema e devolve os três primeiros da ordem física.
  - **RESPOSTAS DIRETAS:** (a) a idade **influencia** a recuperação (filtro em
    memória), mas **não** o ranking · (b) o subtema — leitura, bater, começar —
    **não influencia nada**: a consulta é por rótulo, e o texto da mensagem não
    entra · (c) as perguntas por tema/idade **não chegam ao condutor**, porque
    ninguém lê os `.md` · (d,e) atividades, frases e orientações só chegam se
    caírem por acaso no top-3 · (f) **três itens no total, sem tipagem** — o
    sistema não sabe distinguir orientação de brincadeira · (g) **sim, o
    ranking é o gargalo** · (h) **não**, os canais recebem repertório diferente.
  - **PODEMOS PROVAR QUE FOI USADO?** Não. Continua **não observável** — o
    rastro prova envio, nunca uso.
- **ANATOMIA DOS `docs/skills/*.md` — AUDITADA EM 2026-08-09.** Os arquivos têm
  estrutura funcional consistente, **com nomes de seção próprios** — não é
  preciso impor taxonomia nova:
  `MISSÃO` · `PRINCÍPIO CENTRAL` · `REGRA DE CONDUÇÃO` ·
  **`TRIAGEM INICIAL — DUAS PERGUNTAS QUE SEPARAM CAMINHOS`** (foco) ·
  **`PERGUNTA DE ALTO VALOR`** (autonomia, imitação) ·
  **`ANTES DE ORIENTAR, DIFERENCIE`** com cenários numerados (8 em aprendizado,
  18 em foco) · **`<SUBTEMA> — MAPA DE RACIOCÍNIO`** (aprendizado tem ESCRITA,
  LEITURA e MATEMÁTICA) · `ATIVIDADES` · `FRASES PARA O CUIDADOR` ·
  `ERROS COMUNS` · `O QUE OBSERVAR` · `PROGRESSÃO` · `USO DE INTERESSES` ·
  `RESULTADO ESPERADO`.
  - **O MAPA DE PERGUNTAS QUE ESTA FRENTE IA CRIAR JÁ ESTÁ ESCRITO.**
    `LEITURA — MAPA DE RACIOCÍNIO` traz exatamente as dimensões pedidas —
    reconhece letras · conhece sons · junta sílabas · junta e perde a palavra ·
    decodifica sem compreender · compreende quando leem para ele · trava em
    texto longo · é mais atenção que decodificação — **e traz o caso
    "junta as sílabas mas se perde" com a conduta pronta** (revelar uma sílaba
    por vez, reduzir campo visual, reconstruir a palavra ao final).
  - **A IDADE ESTÁ NOS ARQUIVOS**, mas em prosa: 10 a 31 menções por arquivo,
    **sem marcação estrutural**. Dá para ler, não dá para filtrar. **Lacuna
    documentada** — e é a razão pela qual "idade muda o repertório" ainda não
    se sustenta do lado editorial.
  - **A CAMADA 1 EXISTE E FOI CARREGADA; A CAMADA 2 NUNCA TEVE DESTINO.** Cada
    `.md` termina com um bloco YAML *"destilação para
    `specialist_prompt_templates`"* — e é isso que está no banco. Os outros ~95%
    do arquivo (mapas, cenários, atividades, frases) **não têm para onde ir**.
    Não é conteúdo perdido: é conteúdo sem tubulação.
  - **SOBREPOSIÇÃO COM `boas_praticas`: ZERO.** Testadas 8 frases de `foco.md`
    contra as 370 boas práticas — **nenhuma existe lá**. Os dois acervos são
    **complementares**, e a hipótese está confirmada por medição:
    **`docs/skills` = como conduzir e o que compreender** ·
    **`boas_praticas` = o que sugerir e como executar.**
  - **MELHOR PONTO DE INTEGRAÇÃO:** o mesmo de `recuperarBoasPraticas` — o
    módulo já é neutro de canal e serve os dois. O material editorial entra como
    **segunda fonte no mesmo bloco**, com **recuperação seletiva por seção**
    (sem contexto → `MAPA DE RACIOCÍNIO`/`TRIAGEM`; com suficiência →
    `ATIVIDADES`/`FRASES`/orientações). **Não despejar arquivo inteiro.**
  - **CUSTO ESTIMADO:** o arquivo inteiro custaria ~21 mil tokens por turno
    (84 647 chars ÷ 4) — inviável. **Uma seção** custa 300 a 900 tokens, na
    ordem do bloco de repertório atual (3 739 chars no caso medido). O parsing
    dos `.md` deve ser feito **em build ou cache**, não por turno.
- **BANCADA COM CASOS REAIS — 2026-08-09.** Quatro relatos de produção, sem
  escolher os que favorecem a arquitetura. **Existe · elegível · recuperado ·
  enviado · função · uso observável** por caso:

  | caso real | no tema | na faixa | **aderentes** | chegam hoje |
  |---|---|---|---|---|
  | escrita: *"copia perfeito se olhar, sem o modelo não escreve"* (18a) | 39 | 11 | 3 | **1** |
  | foco: *"não consegue se concentrar"* (relato vago, 8a) | 35 | 9 | 5 | **2** |
  | agressividade: *"é agressivo demais, não sossega"* (sem idade) | 75 | 75 | 6 | **0** |
  | recusa alimentar após mudar de escola (7a) | 27 | 4 | **0** | — |

  - **O pior é o terceiro.** Existem *"Agressão física é comunicação de
    frustração sem palavras"* e *"Explosões de raiva — bate, grita, joga coisas:
    identifique gatilhos"*, e **nenhum dos dois chega**. Entram no lugar
    "discussões abertas sobre notícias" e "o cérebro tem andares".
  - **⚠️ O QUARTO É O CASO DE BASE INSUFICIENTE**, e ele importa tanto quanto os
    outros: recusa alimentar ligada a **mudança de contexto** não tem nenhum
    conteúdo aderente em `nutricional` para 7 anos — só 4 BPs sobrevivem ao
    filtro de idade, e nenhuma fala do assunto. **Aqui nenhum ranking resolve.**
    É lacuna de curadoria, e o veredito honesto é *"a base ainda não tem
    repertório para responder isso com a qualidade que queremos"*.
  - **Uso efetivo: não observável**, em todos os quatro.
- **ROADMAP DA NOVA EXPERIÊNCIA (nomes acordados em 2026-08-09):**
  **BASE 1 · PERFIL DA CRIANÇA** (Kolo Vivo / subcampos) ·
  **BASE 2 · PERGUNTAS E ORIENTAÇÕES POR TEMA** (`docs/skills/*.md`) ·
  **BASE 3 · ATIVIDADES, BRINCADEIRAS E BOAS PRÁTICAS** (`boas_praticas`).

  | fase | o quê | estado |
  |---|---|---|
  | 1 | BASE 1 consultável campo a campo | **CONCLUÍDA** ([#71](https://github.com/sergiokoloszuk/kolo-familia/pull/71)) |
  | 2 | BASE 2 seletivamente acessível | **CONCLUÍDA** ([#72](https://github.com/sergiokoloszuk/kolo-familia/pull/72)) |
  | 3 | BASE 3 · ranking por aderência ao relato | **CONCLUÍDA** ([#74](https://github.com/sergiokoloszuk/kolo-familia/pull/74)) — construída, provada, **não ligada** |
  | 3b | BASE 3 · o conteúdo certo chega ao ranking | **CONCLUÍDA** ([#75](https://github.com/sergiokoloszuk/kolo-familia/pull/75)) — **não ligada** |
  | 4A | piloto em **Estratégias** | próxima · começar por aprendizado/leitura e foco |
  | 4 | nova experiência em **Estratégias** | marco de produto |
  | 5 | WhatsApp | só após aprovação da Karina |
- **✅ FASE 2 · BASE 2 SELETIVA — NO AR (2026-08-09).** O patrimônio editorial
  deixou de ser inalcançável. **Nada mudou para as famílias**: esta fase cria
  disponibilidade, não comportamento.
  - **188 seções parseadas dos 7 temas**, pelos títulos que o material já tem —
    nenhuma taxonomia paralela. Cada seção guarda tema · seção · título ·
    subtema · estado · **id estável** (`aprendizado/leitura-mapa-de-raciocinio`).
  - **GERADO EM BUILD, não lido em runtime.** Os `.md` vivem em `docs/`, fora de
    `apps/web`; ler disco em produção dependeria de a Vercel empacotar arquivo
    de fora do app, e falharia em silêncio no pior lugar. O módulo gerado é
    importado como código: **zero I/O e zero chamada de IA por turno**.
  - **🐛 ACHADO: o material não é formatado de maneira uniforme.**
    `nutricional.md` **não usa `#` nos títulos** — escreve em caixa alta. Na
    primeira geração ele saiu com **zero seções**. O gerador passou a aceitar os
    dois formatos, mas fica registrado: **quem escrever material novo precisa
    saber que o formato importa**, e um `.md` mal formatado desaparece em
    silêncio. O teste de defasagem cobre a regressão.
  - **CUSTO — o problema estava aqui:** os 7 arquivos somam **~21 162 tokens**;
    `aprendizado.md` inteiro, ~3 271. O **bloco entregue tem ~523 tokens**
    (3 seções) e o mapa de leitura sozinho, **~142**. Redução de **97,5%**
    contra mandar o material todo.
  - **LATÊNCIA:** 1000 consultas em **49,6 ms** (0,05 ms cada); uma consulta com
    bloco montado, **0,145 ms**. **Nenhuma chamada de IA acrescentada** —
    requisito cumprido.
  - **GOLDEN CASE DE LEITURA, provado com o conteúdo REAL:** `tema=aprendizado,
    subtema=leitura, estado=investigacao` devolve
    `aprendizado/leitura-mapa-de-raciocinio` em primeiro, com as sete
    diferenciações do material — e **sem** trazer os mapas de escrita e
    matemática. O trecho *"junta as sílabas, mas se perde"* e a conduta *"não
    volte para vamos ensinar as letras"* estão recuperáveis.
  - **⚠️ BASE 2 INDISPONÍVEL PARA: sono · emocional · sensorial · comunicação ·
    rotina.** Cinco dos temas mais frequentes da conversa **não têm material de
    condução** — inclusive **sono**, que é o golden case da frente. Nenhum
    conteúdo foi inventado. **É achado, e é grande:** a Fase 4 vai conduzir com
    BASE 2 em aprendizado, foco, autonomia, imitação, motor, nutricional e
    socialização — e **sem ela** nos outros cinco.
  - **Testes:** 20 novos, com o conteúdo real como prova. Três sabotagens:
    perder o reconhecimento de subtema quebra 3 · devolver o tema inteiro quebra
    6 · deixar o módulo gerado defasar quebra 2.
- **✅ FASE 3 · BASE 3 — ADERÊNCIA AO RELATO (2026-08-09). CONSTRUÍDA E
  PROVADA, MAS NÃO LIGADA.** Como nas Fases 1 e 2, nada mudou para as famílias:
  a função existe, tem teste e **nenhum caminho de produção a chama**. Ligar é
  decisão da Fase 4.
  - **O que faz:** dentro do conjunto **já elegível** (skill · tags · status ·
    faixa etária intactos), ordena por aderência ao relato. Determinística,
    **zero chamada de modelo**, 0,3 a 5 ms por caso.
  - **Três defesas contra caça-palavra:** um termo sozinho **zera** (não é
    aparado) · dois termos no mesmo campo valem mais que a soma · **piso de 10**,
    abaixo do qual o ranking **se abstém** e devolve a ordem que já viria.
  - **🔴 O ACHADO QUE MUDA A CONCLUSÃO DA FASE: reordenar não resolve o caso
    que motivou a fase.** No caso *"bate na irmã quando é contrariada"* o
    ranking **não interferiu** — porque *"Explosões de raiva: bate, grita, joga
    coisas"* **não estava entre os 10 elegíveis**. O corte de `.limit(40)` no
    banco, feito por um peso que não ordena, **já tinha excluído o conteúdo
    certo antes de qualquer ranking**.
    | caso | elegíveis | interferiu? |
    |---|---|---|
    | bate na irmã (5a) | 10 | **não** — o conteúdo certo não é candidato |
    | leitura silabando (8a) | 13 | **não** — mesma causa |
    | não começa a lição (8a) | 9 | **sim** |
    | sensorial na tarefa (8a) | 11 | **sim**, e bem (25 e 18 pontos) |
    **A causa raiz é a montante: o universo de candidatos.** Fica registrado
    como **FASE 3b**, e é ela que resolve os casos A e C.
  - **CASOS NEGATIVOS calibraram o piso, e isso não foi teórico.** Com piso 8,
    *"ele bate a porta quando sai do quarto"* subia um conteúdo sobre **medo**
    (porta + quarto convergindo num texto de outro assunto). Em 10, os dois
    negativos deixam de interferir e os positivos seguem passando.
  - **DIVERSIDADE FUNCIONAL — medida, não corrigida.** Nos quatro casos havia
    orientação, atividade, brincadeira e frase entre os candidatos; o top-3
    **antes** entregava 2 funções distintas, e **depois** 3 no caso sensorial.
    **Três itens tematicamente certos e funcionalmente idênticos ainda produzem
    resposta rasa** — registrado para a Fase 4, sem diversidade forçada agora.
  - **IDADE:** o ranking roda **depois** da elegibilidade; nada semanticamente
    ótimo mas fora de faixa consegue subir. Coberto por teste.
  - **Testes:** 17 novos. Três sabotagens: tirar a convergência quebra 1 ·
    baixar o piso quebra 1 · ignorar o relato quebra 4.
- **REQUISITO ARQUITETURAL REGISTRADO, sem implementar:** BASE 2 e BASE 3 **não
  devem ficar presas a uma origem única**. Conhecimento aprovado vindo de
  livros, materiais Kolo, artigos ou especialistas poderá alimentar as mesmas
  camadas — e **a origem precisa ser preservável**. Nenhuma ingestão nesta fase.
- **✅ FASE 3b · O CONTEÚDO CERTO CHEGA AO RANKING (2026-08-09).** Construída e
  provada. **Continua não ligada** — nenhum caminho de produção chama o ranking.
  - **⚠️ CORRIJO O QUE EU MESMO REPORTEI NA FASE 3.** Eu escrevi que
    *"Explosões de raiva: bate, grita, joga coisas"* **não estava entre os
    elegíveis**. **Estava** — posição 17 de 75, faixa 4-6, elegível para a
    criança de 5 anos. Eu inferi a causa sem verificar. A causa real era outra,
    e é mais interessante: **só a palavra "bate" coincidia.** A boa prática fala
    de *"agressão"* e *"após recusas"*; a mãe escreveu *"bate"* e
    *"contrariada"*. Um termo sozinho não passa a convergência, então **o
    conteúdo mais aderente do acervo pontuava zero**.
  - **DUAS CAUSAS DISTINTAS, as duas corrigidas:**
    1. **A distância entre o vocabulário da mãe e o do acervo.** Resolvida com
       um mapa de **conceitos** — oito grupos pequenos e revisáveis (bater ≈
       agressão · contrariar ≈ recusa/frustração · começar ≈ iniciar · irmã ≈
       irmão · ler ≈ leitura/sílaba · dormir ≈ sono · barulho ≈ sensorial ·
       manter ≈ terminar). **É decisão editorial, não técnica**, e está
       comentada como tal.
    2. **O corte de candidatos.** `.limit(40)` descartava, medido, **51 boas
       práticas elegíveis** para uma criança de 5 anos — 24 em `emocional`, 19
       em `comunicacao`, 4 em `rotina`. Subiu para **200**, que é **teto de
       segurança, não critério**: buscar a skill inteira custa **o mesmo**
       (91 ms com 40, 90 ms com 75).
  - **🐛 O CASO NEGATIVO PEGOU UM BUG REAL:** o radical `port` (de "porta")
    casava dentro de **"importante"**, **"suporte"**, **"oportunidade"** — e
    fazia subir conteúdo de crise emocional num relato sobre bater a porta.
    Corrigido com fronteira de início de palavra.
  - **FUNIL, antes × depois** (caso A): skill 75 → elegíveis **10 → 34** → com
    pontuação **4** → top-3.
    | | top-3 |
    |---|---|
    | **antes** | "cérebro tem andares" · "crianças pequenas não têm capacidade" · "momentos de quietude" |
    | **depois** | "quando a criança entra em crise (agressividade, recusa)" **44pts** · "bater, morder, chutar: formas de comunicação" **35pts** · "explosões de raiva — bate, grita" **21pts** |
    Os quatro golden cases passaram a interferir. Os **dois negativos** —
    "bate a porta" e "lê livro à noite" — voltaram a **não interferir**.
  - **Latência:** 0,7 a 4,3 ms de ranking; consulta ao banco **inalterada**.
    Zero chamada de modelo.
  - **Testes:** 23 no total (6 novos na 3b). Três sabotagens: tirar os
    conceitos quebra 3 · tirar a fronteira de palavra quebra 1 · voltar o teto
    para 40 quebra 1.
- **📌 REGISTRO QUE NÃO PODE SE PERDER:** *ranking bom não corrige candidato que
  morreu antes do ranking* — **e diagnóstico rápido não substitui verificação**.
  Nesta frente as duas coisas apareceram juntas: o corte era real, mas **não era
  a causa do caso A**, e eu só descobri porque medi a posição da boa prática em
  vez de confiar no que tinha escrito.
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
- **APRENDIZADO DE 2026-08-09 (Fase 3b): não reportar causa que não foi
  medida.** Na Fase 3 afirmei que a boa prática certa "não estava entre os
  elegíveis". Estava — posição 17 de 75. A causa real era outra, e a inferência
  errada quase gerou uma fase inteira resolvendo o problema errado. **O corte de
  candidatos existia e valia corrigir; só não era o que eu disse que era.**
- **APRENDIZADO DE 2026-08-09 (Fase 3): sabotagem que não morde é teste que não
  existe.** Duas das três sabotagens da Fase 3 passaram na primeira tentativa —
  não porque o código resistia, mas porque **os testes não cobriam aquelas
  regras**. Uma delas expôs um defeito real de desenho: o clamp de convergência
  usava `PISO - 1`, então baixar o piso produzia pontuação negativa e mascarava
  a própria sabotagem. **Duas regras independentes não podem depender uma da
  outra** — e foi a sabotagem, não a leitura do código, que revelou isso.
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
- **PERFIL VIVO — ESTRUTURA ATUAL, AUDITADA EM 2026-08-09.**
  `perfil_vivo_membro` tem seis campos de conteúdo (`essencial`, `como_e`,
  `corpo_rotina`, `desafios_regulacao`, `sensorial`, `completude_pct`) mais o
  saco `categorias_extras` em jsonb, onde vivem as 26 categorias e os
  `desafios_onboarding`.
  - **NÃO HÁ NADA que distinga**, na estrutura, **relato explícito da família ·
    observação · hipótese da Ayla · estratégia sugerida · estratégia testada ·
    resultado relatado.** Tudo vira texto no mesmo campo. É a causa estrutural
    dos dois casos já registrados: a uva-passa (fato revogado que continuou
    valendo) e a "referência visual" (fato verdadeiro usado fora do escopo).
  - **Requisito registrado, não construído:** perfil temático progressivo ·
    consultar antes de perguntar · não repetir pergunta já respondida ·
    **fato ≠ inferência** · estratégia sugerida ≠ testada · registrar resultado.
  - **REGRA DE PRODUTO (Sérgio, 2026-08-09):** *"o perfil não é um formulário
    que precisa ser concluído — é um retrato que a Ayla vai completando
    enquanto ajuda"*, e *"perguntar para ajudar agora; guardar para não
    precisar perguntar amanhã."*
- **MAPA TEMA → PERGUNTAS DO PERFIL — AUDITADO EM 2026-08-09. ELE EXISTE.**
  `lib/kolo-vivo/subcampos.ts` traz **111 subcampos estruturados em 16
  domínios**, com `label`, `opcoes` (chips), `lista` e `mostrarSe`
  (condicional). É o mapa de perguntas por tema que a frente procurava.
  - **⛔ NÃO HÁ CONDICIONAMENTO POR IDADE.** `mostrarSe` condiciona por
    **resposta de outro campo**, nunca por faixa etária. As 14 menções a idade
    no arquivo são texto de placeholder. **Este é o furo central do requisito
    "idade não é decoração"**: nem o perfil nem os `.md` permitem filtrar
    pergunta por faixa hoje.
  - **AS RESPOSTAS NÃO SÃO CAMPOS CONSULTÁVEIS.** Os 111 subcampos são
    **serializados como rótulos dentro de UM texto por domínio** em
    `perfil_vivo_membro` (`Aceita bem: … / Rejeita: …`). Decisão consciente para
    não reescrever o backend — mas a consequência é que *"este campo está
    vazio?"* não tem resposta programática. **Sem isso, "consultar antes de
    perguntar" não se implementa.**
  - **QUEM PREENCHE:** a tela do Kolo Vivo (web). Pelo WhatsApp, o caminho é
    indireto — a auto-incorporação grava em `sugestao_perfil_vivos`
    (**200+ linhas, camada1, `origem` ∈ {ayla, skill}, status aprovada/
    rejeitada**). **O WhatsApp não escreve subcampo diretamente.**
  - **NÃO DISTINGUE "não sabemos" DE RESPOSTA NEGATIVA** — tudo é texto.
  - **DATA E FONTE:** `sugestao_perfil_vivos` tem `origem` e `decidido_em`; o
    texto final no perfil **não carrega nem data nem fonte**. `origem` diz se
    veio da Ayla ou de uma skill — **não** se é relato da família ou inferência
    dela. É meio caminho, não a distinção pedida.
  - **HISTÓRICO:** não há. Resposta nova **sobrescreve** a anterior.
  - **O PLANO** consome o texto do perfil via `buildContext`, como qualquer
    outro contexto.
- **COMPARAÇÃO PERFIL × `docs/skills` — as três situações previstas, todas
  confirmadas (2026-08-09):**
  1. **Sobrepõem na função, não no conteúdo.** Os dois têm perguntas: as do
     perfil são **estruturais e estáticas** (o que queremos saber sempre); as
     dos `.md` são **diagnósticas e condicionais** (o que muda a conduta agora).
     **Unificar a função, não fundir os textos.**
  2. **Os `.md` têm perguntas excelentes que não são campo de perfil.** As oito
     dimensões do `LEITURA — MAPA DE RACIOCÍNIO` não existem em `subcampos.ts`.
     **Decisão pendente:** quais delas merecem virar campo persistente.
  3. **O perfil tem campos que os `.md` não mencionam** — e continuam
     necessários para conhecer a criança.
- **TABELA A · IDADE — evidência levantada em 2026-08-09, para decisão.**
  Varredura dos sete `.md` procurando diferenciação etária com substância
  (descartando placeholder e exemplo):

  | arquivo | diferencia hoje? | evidência real |
  |---|---|---|
  | aprendizado | **pouco** | uma marca explícita: `Adolescente/adulto:` (linha 486) |
  | autonomia | **não** | só exemplos (*"meu filho de 6 anos não se veste"*) |
  | foco | **não** | menciona "tarefa escolar", que é contexto, não faixa |
  | motor | **não** | só exemplo (*"meu filho de 5 anos"*) |
  | imitação · nutricional · socialização | **não** | nenhuma marca estrutural |

  - **LEITURA DO ACHADO — e ela muda a proposta:** o material é
    **deliberadamente agnóstico de idade**, porque descreve **mecanismos**
    (o que trava, como diferenciar), não currículo por faixa. As poucas marcas
    aparecem onde o mecanismo realmente muda — adolescente/adulto em
    aprendizado.
  - **PROPOSTA MÍNIMA, a decidir:** **não** criar faixa por seção. Marcar
    apenas onde o material **já** distingue, com uma linha de metadado por
    seção (`faixa: adolescente+`), deixando o resto como universal — que é o
    que ele é. **Qualquer marcação além disso é taxonomia inventada** e está
    fora do que a evidência sustenta.
  - ⚠️ Enquanto esta decisão não existir, **nenhuma resposta pode ser declarada
    "adaptada por faixa etária"** do lado editorial. A idade continua atuando
    só no filtro das `boas_praticas` (`faixa_etaria_min/max`) e como contexto
    no prompt.
- **TABELA B · PERSISTÊNCIA — evidência levantada em 2026-08-09, para decisão.**
  Perguntas editoriais reais confrontadas com os subcampos reais do perfil:

  | pergunta editorial | origem | serve à condução? | já existe campo? | vale lembrar? |
  |---|---|---|---|---|
  | *ele dorme no próprio quarto?* | golden case sono | sim | **não existe** | **sim** — descreve o arranjo, não muda toda hora |
  | *você fica até ele adormecer?* | golden case sono | sim | **sim** — `sono · Como adormece` | sim |
  | *quanto tempo leva pra pegar no sono?* | golden case sono | sim | **sim** — campo homônimo | sim |
  | *medo de quê?* | golden case sono | sim | parcial — `sono · O que atrapalha` | sim |
  | *junta as sílabas? troca palavras? perde a linha?* | `LEITURA — MAPA DE RACIOCÍNIO` | **muito** | **não existe** — `aprendizado` só tem campos genéricos | **sim**, é estável e evita repergunta |
  | *sustenta no que gosta mas não na tarefa?* | `foco · TRIAGEM INICIAL` | sim | **sim** — `foco · Como é o foco` + `O que prende a atenção` | sim |
  | *o que aconteceu logo antes?* | condução de regulação | sim | **sim** — `emocional · Gatilhos` | sim |
  | *ele topou a estratégia que sugeri?* | seguimento | sim | **não** | **NÃO persistir como fato da criança** — é resultado de estratégia, outra coisa |

  - **CRITÉRIO PROPOSTO, coerente com a direção do Sérgio:** persistir quando a
    informação **descreve a criança**, tende a seguir valendo e **evita uma
    pergunta futura**. Não persistir quando for circunstancial, hipótese da
    Ayla, interpretação causal, ou conteúdo da própria estratégia.
  - **O QUE A EVIDÊNCIA SUSTENTA HOJE:** os campos de `sono`, `foco`,
    `emocional` e `sensorial` **já cobrem** a maior parte das perguntas de alto
    valor — **não é preciso criar campo para elas**. A lacuna real é
    concentrada: **as dimensões de leitura/escrita** (o mapa de raciocínio não
    tem par no perfil) e **"onde dorme"**.
  - ⚠️ **Nenhum campo novo antes desta decisão.** Duas ou três adições
    específicas ≠ transformar toda pergunta editorial em campo.
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

**Próximo ID livre: PEND-033. *(024 e 025 reservadas por frentes ainda não publicadas.)***

> Conferir contra `origin/main`, não contra o seu branch. Dois branches podem
> reivindicar o mesmo número — o conflito de merge nesta linha é o alarme.
> Se colidir, renumera a mais nova: o ID só vira referência estável depois do
> merge. (Este repositório já queimou números de migração assim.)
