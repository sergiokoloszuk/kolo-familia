# Pendências abertas — Kolo Família

**Fonte oficial do estado das pendências.** Memória de agente, conversa,
relatório e commit ajudam no contexto; o estado válido é este arquivo. Onde
divergirem, este arquivo vence e a outra fonte se corrige.

Concluídas e canceladas vivem em [PENDENCIAS-ARQUIVO.md](PENDENCIAS-ARQUIVO.md).
As regras de uso estão no fim deste documento.

---

## Painel

Só o que está aberto. 🔒 = bloqueada.

| ID | Pendência | Categoria | Prio | Estado | Próximo passo |
|---|---|---|---|---|---|
| [PEND-007](#pend-007) | Ativação do GPT parada na prova da chave de produção | Ayla/IA | P1 | ABERTA 🔒 | publicar e rodar `provider-check` |
| [PEND-003](#pend-003) | Preview da Vercel vermelho há vários PRs | Infra/Deploy | P1 | ABERTA 🔒 | ler o log do primeiro preview que falhou |
| [PEND-002](#pend-002) | Pagamento confirmado no Stripe sem acesso na Kolo | Pagamento/Acesso | P1 | EM EXECUÇÃO | implementar Etapas 1 e 2 (autorizadas) |
| [PEND-001](#pend-001) | Cooldown do convite de assinatura não publicado | Pagamento/Acesso | P1 | EM EXECUÇÃO | revisar o diff, abrir PR, publicar, smoke |
| [PEND-004](#pend-004) | Rotina/Sequência Visual — auditar antes de redesenhar | Produto | P2 | ABERTA | missão INVESTIGAR do fluxo atual |
| [PEND-008](#pend-008) | 118 famílias em `trialing` com trial vencido | Dados/Banco | P2 | ABERTA | decidir a regra e corrigir a contagem |
| [PEND-009](#pend-009) | Primeira conversa da Ayla — spec sem construção | Ayla/IA | P2 | ABERTA | levar a spec para PROPOR |
| [PEND-010](#pend-010) | Triar as 26 pendências do laudo de 06/08 | Documentação | P2 | ABERTA | conferir item a item contra o código |
| [PEND-005](#pend-005) | `MEMORY.md` perto do limite de leitura | Documentação | P2 | ABERTA | compactar o índice |
| [PEND-006](#pend-006) | Dois arquivos não rastreados em `lib/conducao/` | Ayla/IA | P2 | ABERTA | identificar a frente dona e decidir |
| [PEND-011](#pend-011) | README aponta para três documentos inexistentes | Documentação | P3 | ABERTA | restaurar os arquivos ou corrigir os links |

---

## Fichas

### PEND-001
**Cooldown do convite de assinatura implementado, não publicado**
Categoria: Pagamento/Acesso · Prioridade: **P1** · Estado: **EM EXECUÇÃO**
Aberta em: 2026-08-08 · Origem: Fase 0A

- **Impacto:** enquanto não publicar, o convite para assinar segue sem cooldown
  real em produção — a correção existe e não protege ninguém.
- **Evidência (2026-08-08):** commit `27fcab4` ("fix(assinatura): o convite
  para assinar tem cooldown de verdade", 2026-08-08) toca
  `apps/web/src/lib/ayla/orchestrator.ts` e acrescenta
  `apps/web/src/lib/ayla/nudge-cooldown.test.ts` (254 linhas). Conferido:
  **não é ancestral de `origin/main`** e **não existe branch remota**
  correspondente — o trabalho está só no repositório local.
  O conteúdo do diff não foi auditado nesta sessão.
- **Branch:** `fix/nudge-cooldown` (local, 1 commit à frente de `origin/main`)
- **Próximo passo:** revisar o diff, rebasear sobre `origin/main`, abrir PR,
  publicar, smoke.
- **Critério de conclusão:** publicado em `origin/main`, preview verde, e smoke
  mostrando que o segundo convite dentro da janela **não** sai. Validação em
  produção com número: convites enviados na janela, antes → depois.
- **Baixa:** Implementado OK · Testado PENDENTE (existe teste; não executado
  nesta sessão) · Regressão PENDENTE · Build PENDENTE · Publicado PENDENTE ·
  Configuração N/A (não usa env nova) · Smoke PENDENTE · Validado PENDENTE
- **Agente recomendado:** EXECUTAR

---

### PEND-002
**Pagamento confirmado no Stripe sem acesso na Kolo (classe Rochelle)**
Categoria: Pagamento/Acesso · Prioridade: **P1** · Estado: **EM EXECUÇÃO**
Aberta em: 2026-08-08 · Origem: incidente Rochelle (2026-07-23) → Fase 0B

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
  *Não bloqueia* as Etapas 1 e 2; **bloqueia** a autorização da Etapa 3.
- **Branch:** `fix/stripe-escrita-e-autoridade` (a partir de `origin/main`;
  baseline técnico verde registrado: typecheck limpo, 1306 testes passando,
  build OK — nenhum arquivo alterado até agora)
- **Próximo passo:** implementar Etapa 1 (escritas críticas conferidas) e
  Etapa 2 (regra de autoridade por força da evidência), autorizadas em
  2026-08-08.
- **Fora do escopo autorizado, na mesma frente** — não corrigir sem
  autorização: eventos `invoice.*` nunca entram na tabela `assinaturas`
  (objetos `Invoice` não carregam `metadata.family_account_id`), então a
  trilha de auditoria tem buraco justamente nos eventos de dinheiro.
- **Critério de conclusão:** replay determinístico da classe verde na suíte;
  falha de persistência não termina em 2xx; dunning legítimo preservado
  (`invoice.payment_failed` continua produzindo `past_due` + carimbo + graça);
  publicado e exercido em produção.
- **Baixa:** todos os degraus PENDENTE (Etapas 1 e 2 ainda não implementadas)
- **Agente recomendado:** EXECUTAR (Etapas 1–2) · PROPOR (Etapa 3)

---

### PEND-003
**Preview da Vercel vermelho há vários PRs**
Categoria: Infra/Deploy · Prioridade: **P1** · Estado: **ABERTA** 🔒
Aberta em: 2026-08-08 · Origem: relato do Sérgio (2026-08-08)

- **Impacto:** se o preview falha em todo PR, ele para de significar alguma
  coisa — e a checagem que deveria pegar regressão antes do merge vira ruído.
- **Evidência:** ⚠️ **não verificada neste repositório.** Registrada a partir
  do relato. Não há artefato local (log, workflow do GitHub Actions ou
  configuração da Vercel) que comprove ou explique a falha. O build local
  (`npm run build`) passou em 2026-08-08 na branch `fix/stripe-escrita-e-autoridade`,
  o que **não** contradiz o relato: o preview pode falhar por env, por
  configuração ou por passo que não roda localmente.
- **Bloqueio:** sem acesso ao painel da Vercel.
  *Por quê:* a causa está no log do build remoto.
  *Onde obter:* Vercel → Deployments → primeiro preview vermelho → Build Logs.
  *Destrava:* Sérgio.
- **Próximo passo:** trazer o log do primeiro preview que falhou.
- **Critério de conclusão:** um PR novo com preview verde, e a causa registrada
  em uma frase (para não voltar).
- **Agente recomendado:** INVESTIGAR

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
- **Próximo passo:** missão INVESTIGAR do fluxo atual, começando por conferir
  o laudo de 2026-08-03 contra o código de hoje.
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
- **Depende de:** nada neste arquivo.
- **Agente recomendado:** EXECUTAR (com Sérgio no ambiente)

---

### PEND-008
**118 famílias em `trialing` com o trial vencido**
Categoria: Dados/Banco · Tags: `observabilidade` · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: `docs/pendencias-2026-08-06.md` item 10,
reconfirmada por leitura de produção em 2026-08-08

- **Impacto:** `status` deixa de significar "tem acesso", e toda contagem que
  use `status` fica distorcida — inclusive `/dashboards`. Foi o que fez a
  palavra "ativado" ganhar três significados diferentes no admin.
- **Evidência (2026-08-08):** leitura pura de produção — 163 linhas, das quais
  **118 estão em `trialing` com `trial_ends_at` no passado** e sem acesso pela
  regra de `assinaturaLiberada`. O laudo de 2026-08-06 registrava 114; a
  diferença é coerente com cadastros novos no período.
- **Próximo passo:** decidir a regra (corrigir o `status` em lote, ou derivar
  sempre o acesso da função e nunca do `status` bruto) e aplicar à contagem.
  ⚠️ Escrita em produção — exige autorização própria e §17 (rollback).
- **Critério de conclusão:** nenhuma contagem do produto usando `status` bruto,
  **ou** `status` coerente com a regra de acesso, com número antes → depois.
- **Agente recomendado:** PROPOR

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
- **Próximo passo:** conferir o desenho contra o código atual e levar para
  PROPOR.
- **Critério de conclusão:** SPEC em `docs/specs/` com os portões respondidos,
  **ou** cancelamento com motivo escrito.
- **Agente recomendado:** INVESTIGAR → PROPOR

---

### PEND-010
**Triar as 26 pendências do laudo de 06/08 e cadastrar as que seguem abertas**
Categoria: Documentação · Prioridade: **P2** · Estado: **ABERTA**
Aberta em: 2026-08-08 · Origem: `docs/pendencias-2026-08-06.md`

- **Impacto:** o laudo tem 26 itens com estado marcado em 2026-08-06; dois já
  entraram aqui como PEND-007 e PEND-008. Os demais continuam fora deste
  arquivo — e este arquivo é a fonte oficial. Enquanto a triagem não acontecer,
  há duas listas.
- **Evidência (2026-08-08):** o laudo existe e marca cada item com ✅ corrigido,
  🟡 parcial ou ⬜ aberto. **Nenhum dos itens ⬜ foi conferido contra o código
  atual nesta sessão** — por isso não foram cadastrados: cadastrar sem conferir
  seria transportar estado de dois dias atrás como se fosse de hoje, que é
  exatamente o erro que a regra de auditoria proíbe.
- **Próximo passo:** missão AUDITAR, item a item, com data/estado/commit; o que
  seguir aberto vira ficha aqui; o que estiver resolvido vai para o arquivo.
- **Critério de conclusão:** todo item ⬜ ou 🟡 do laudo com destino — ficha
  aberta aqui, ou entrada em [PENDENCIAS-ARQUIVO.md](PENDENCIAS-ARQUIVO.md)
  com evidência. Feito isso, o laudo vira documento histórico.
- **Agente recomendado:** AUDITAR

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

**Próximo ID livre: PEND-012.**

> Conferir contra `origin/main`, não contra o seu branch. Dois branches podem
> reivindicar o mesmo número — o conflito de merge nesta linha é o alarme.
> Se colidir, renumera a mais nova: o ID só vira referência estável depois do
> merge. (Este repositório já queimou números de migração assim.)
