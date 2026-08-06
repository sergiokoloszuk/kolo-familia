# Pendências abertas — 06/08/2026

Levantadas na sessão de auditoria + migração conversacional. Nada disto estava
em commit nenhum: o repositório guardava o código, não a lista do que ficou.

Estado marcado por item, como manda a regra de auditoria: **todo achado leva
data, estado e commit** — e conferir o código antes de recomendar achado de
laudo antigo.

---

## 🔴 Afetam família real

| # | Pendência | Evidência | Estado (06/08) |
|---|-----------|-----------|----------------|
| 1 | A Ayla promete persistência que não existe — "já atualizo aqui", "anotado", sem nenhum UPDATE | Vitória, 3× na mesma conversa | ✅ **CORRIGIDO** — `CONTRATO_DE_VERDADE` no núcleo (vale nos 2 canais) + smoke `correcao_de_dado` nos 2 providers |
| 2 | Não há prova de envio — `zaap_message_id` nulo em 27/27 mensagens de saída | conversa da Vitória | ✅ **CORRIGIDO** — `registroDeEnvio()` grava id + `metadata.entrega` nas saídas reativa e proativa. Sem migração (campos existem desde a 0001) |
| 3 | Idade calculada pelo modelo — disse "6 anos" para 26/04/2019 | mesma conversa | ⬜ aberto |
| 4 | Ambiguidade estrutural resolvida em silêncio — "Eu queria tenho 24" virou "ele tem 24" | mesma conversa | ⬜ aberto |
| 5 | Planos nascem de "Sim" e "Cadê?" — 3 planos, nenhum pedido | `origem=estrategias`, `conversa_id=null` nos 3 | ⬜ aberto — **não está na Fase A nem na B** |
| 6 | `tema` corrompido com andaime de prompt — vira título de PDF na casa da família | plano `dd44f22b` | ⬜ aberto — **não está na Fase A nem na B** |

> ⚠️ Sobre #5 e #6: se a migração seguir como planejada, o GPT herda um
> orquestrador que ainda cria plano a partir de "Cadê?". É decisão consciente
> se entra antes da Fase B ou depois — não é achado esquecido.

## 🟠 Não auditados — podem ser bugs

| # | Pendência | Estado |
|---|-----------|--------|
| 7 | Destino real de `/auth/wa?k=…` — abre Home, lista ou o plano específico? Nunca comprovado | ⬜ aberto |
| 8 | Fluxo geração→envio do PDF — por que 3 planos existem e nenhum tem `midia_url` | 🟡 **parcial** — `entregarPdfDoPlano` agora grava caminho no Storage, tipo e id do provedor no `ayla_send_log`. A causa dos 3 planos segue aberta (é #5) |
| 9 | Causa raiz 2019→2002 — não reproduzida; 2 hipóteses testadas e refutadas | ⬜ aberto |
| 10 | 114 famílias com `status=trialing` e trial vencido — contamina toda contagem que use `status`, inclusive o /dashboards | ⬜ aberto — **~30 min de trabalho, destrava confiança em qualquer número** |

## 🟡 Dívida registrada em código

| # | Pendência | Estado |
|---|-----------|--------|
| 11 | `idadeAnos` não aceita data de referência — erra ~3h na véspera do aniversário | ⬜ aberto |
| 12 | `atribuicao_distribuida` continua o código mais ruidoso do detector | ⬜ aberto |
| 13 | "esse horário é melhor pra ele" sobre sono ainda dispara medicação (resíduo assumido) | ⬜ aberto |
| 14 | Web sem streaming progressivo — vira "Pensando…" por ~10s. Decisão de segurança, mas a UX mudou e não foi validada | ⬜ aberto (a Fase B não piora: a rota já publicava de uma vez) |
| 15 | Respostas da web 40% mais longas sem o teto de 120 palavras — riqueza ou prolixidade? Só o uso diz | ⬜ aberto |

## 🔵 Da migração OpenAI

| # | Pendência | Estado |
|---|-----------|--------|
| 16 | Avaliação cega nunca preenchida — 20 critérios + 10 de jornada, telas prontas | ⬜ aberto — **1h do Sérgio; é a evidência humana que sustenta a decisão** |
| 17 | GPT repete 22% (34,9% na web) — mitigação definida, não implementada | ✅ **IMPLEMENTADO** — `VOZ 7` ("a cada turno, avance a conversa"), uma linha só, sem teto/pergunta obrigatória/blacklist. Efeito não medido ainda |
| 18 | Visão e artefatos sem evidência — a bancada mediu só conversa | 🟡 **parcial** — smoke `foto` passa nos 2 providers (envelope + resposta). Artefatos (plano, rotina) seguem no Claude e não foram medidos |
| 19 | Cache no billing — subestima Claude, superestima GPT (1,5× medido × 19× real) | ⬜ aberto — a PRICE_TABLE não modela cache; `cache_read` já vai no `meta` do `api_calls` da web |
| 20 | Chave de produção é `sk-proj-*` — acesso a texto provado só na chave local | ⬜ aberto — **bloqueia ligar `IA_PROVIDER=openai` em produção** |
| 21 | `OPENAI_MODEL_LEVE` não definido — sem evidência para escolher | ⬜ aberto (não bloqueia: os auxiliares seguem no Claude) |
| 22 | Grupo D — quais dos 28 auxiliares não deveriam usar LLM (não classificado) | ⬜ aberto |

## ⚪ Produto / operação

| # | Pendência | Estado |
|---|-----------|--------|
| 23 | Relatório da campanha do vídeo — 4 levas dispararam em 06/08; sai de `ayla_messages` | ⬜ aberto |
| 24 | 10 vídeos contextuais — infraestrutura pronta, `url: null`, esperando os links | ⬜ aberto |
| 25 | Atribuição Meta Ads — só 1 touchpoint por família. Não é bug, é o modelo — mas limita a análise da agência | ⬜ aberto |
| 26 | Dashboard: "Leads em trial" × recorte — resolvido, mas o `status` desatualizado (#10) ainda distorce | ⬜ depende de #10 |

---

## Onde a migração parou

**Fase A e Fase B implementadas** (suíte 979 verde, typecheck e build verdes,
zero migração de banco). **GPT continua desligado**: `IA_PROVIDER` ausente =
Claude, que é o estado atual de produção.

O que falta pra liberar para famílias reais:

1. #20 — provar acesso a texto na chave de produção `sk-proj-*`
2. #16 — a avaliação cega preenchida (evidência humana, não só automática)
3. decidir #5/#6 — entram antes da Fase B ir pro ar, ou depois?

Ligar: `IA_PROVIDER=openai` no ambiente. Desligar: remover a variável. Sem
deploy, sem build, sem PR — e valor inválido cai no Claude de propósito.
