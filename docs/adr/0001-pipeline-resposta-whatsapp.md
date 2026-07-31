# ADR 0001 — Pipeline de resposta da Ayla no WhatsApp

- **Status:** proposto (aguardando aprovação)
- **Data:** 2026-07-31
- **Escopo:** o caminho de uma mensagem da família até a resposta entregue no
  WhatsApp. Não trata de conteúdo clínico, voz da Ayla, BIA, planos ou memória.

---

## Contexto

Em conversas reais apareceram dez sintomas distintos: vazamento de instrução
interna e de raciocínio ("percebi uma inconsistência no prompt", "orientação da
Karina", "ela respondeu 1"), respostas duplicadas, perguntas repetidas,
respostas concorrentes, mensagens fora de ordem, automação entrando no meio da
conversa, oferta de plano antes de a mãe responder.

A auditoria mostrou que **não são dez bugs**. São duas ausências arquiteturais:

1. **Não existe um instante em que a resposta completa exista antes de sair.**
   `gerarRespostaAyla` transmite ao WhatsApp parágrafo a parágrafo à medida que o
   modelo gera (`responder.ts`, `for await (stream) → onParagrafo → enviarTexto`).
   Não há onde inspecionar, e o que saiu não volta. Nenhum filtro poderia ter
   evitado os vazamentos — faltava o lugar onde o filtro existiria.

2. **Não existe fronteira única de saída.** `enviarTexto`/`enviarDocumento` são
   chamados de 13 pontos em 10 arquivos. Qualquer camada publica.

Os demais sintomas derivam de duas lacunas menores: o lote é claimado **antes**
da chamada ao modelo (40–90 s), e ninguém reconfere na hora de publicar se
aquela execução ainda é a mais recente.

Este ADR fixa a arquitetura definitiva dessa camada. É a referência para
qualquer pessoa que mexer no caminho de resposta daqui em diante.

---

## Decisão

### 1. Responsabilidades

Nove etapas. **Nenhuma executa a responsabilidade da outra**, e a regra que
resume tudo: *só a Publicação fala com o WhatsApp.*

| # | Etapa | Responsabilidade única | O que lhe é PROIBIDO |
| --- | --- | --- | --- |
| 1 | **Inbound** | receber o webhook, validar origem, parsear, responder 200 rápido, garantir idempotência do evento | decidir, responder, chamar modelo |
| 2 | **Agrupamento** | juntar a rajada da mãe num turno só; eleger **uma** execução responsável | ler contexto, gerar, publicar |
| 3 | **Orquestração** | decidir o que acontece neste turno; chamar modelo e ferramentas; montar o resultado | publicar, formatar bolha, falar com a Z-API |
| 4 | **Modelo** | produzir texto bruto | publicar, ter efeito colateral |
| 5 | **Ferramentas** | executar (plano, rotina, PDF, magic link) e **devolver ao orquestrador** | publicar, enviar anexo, mandar mensagem |
| 6 | **Montagem** | transformar o resultado numa `RespostaFinal` completa — texto, anexos, tipo | decidir conteúdo, chamar modelo |
| 7 | **Validação** | aprovar ou barrar; produzir fallback quando barra | alterar sentido, reescrever voz, publicar |
| 8 | **Publicação** | **o único ponto que fala com o WhatsApp**; ordena, quebra em bolhas, aplica delays, registra | decidir conteúdo, gerar, validar |
| 9 | **Persistência** | registrar o que foi publicado e o rastro de auditoria | publicar, alterar conteúdo |

> A Montagem existe separada da Orquestração de propósito: é ela que converte
> "vários pedaços de resultado" em **uma** entrega coerente. Sem esse degrau, a
> tentação de mandar "só mais um balãozinho" reaparece.

### 2. Contratos

#### `publicar()` — a fronteira

```ts
type RespostaFinal = {
  conversationId: string;
  sourceMessageId: string;   // a inbound que originou esta resposta
  execucaoId: string;        // quem está publicando
  text: TextoParaFamilia;    // tipo nominal — ver Validação
  attachments: Anexo[];
  responseType: "resposta" | "entrega" | "sistema";
};

publicar(resposta: RespostaFinal): Promise<ResultadoPublicacao>
```

- **Invariantes:** publica **no máximo uma vez** por `sourceMessageId`;
  só publica se `execucaoId` ainda detém o turno; só aceita `text` já validado;
  texto e anexos saem como **uma entrega**, na ordem, sem intercalar.
- **Pode chamar:** só a Orquestração, ao final do turno.
- **Não pode chamar:** modelo, ferramentas, ponte, cron, automações, server
  actions de tela.
- **Efeitos colaterais permitidos:** falar com a Z-API, gravar em `ayla_messages`
  e no log de envio. Nada mais.

**Canal administrativo separado.** Notificações à Karina, healthcheck e a
abordagem manual do CRM **não são resposta à família** e não passam por
`publicar()`. Usam `notificarAdmin()`, explicitamente separado, sem
`conversationId`. Misturar os dois foi parte do problema: um alerta operacional
não deve competir com uma conversa.

#### `gerarRespostaAyla()`

- **Entrada:** `RespostaParams`. **Saída:** `TextoBruto` (tipo interno).
- **Invariante:** **não recebe mais callback de publicação.** Devolve o texto
  completo. Esta é a mudança central do ADR.
- **Não pode:** tocar na Z-API, persistir, decidir sobre plano.

#### Ferramentas (plano, rotina guiada, magic link, PDF)

- **Saída:** `ResultadoFerramenta { texto?, anexos?, erroInterno? }` — devolvido
  ao orquestrador.
- **Invariante:** ferramenta **nunca** publica, nem por "atalho de anexo".
  `erroInterno` jamais é publicável.
- Hoje `ponte.ts` e `rotina-guiada.ts` chamam `enviarDocumento` diretamente:
  passam a devolver o anexo.

#### Plano

- Nesta camada, o plano é **uma ferramenta**. A lógica clínica não muda.
- **Invariante nova:** não é gerado no mesmo turno de uma **pergunta pendente**.
  Pergunta pendente e entrega são movimentos distintos; quem decide continua
  sendo `prontidao-plano.ts`.

#### Cron e automações

- **Não publicam resposta.** Enfileiram uma `IntencaoDeMensagem`, que é avaliada
  contra o estado da conversa antes de virar publicação.
- **Invariante:** com conversa ativa, a automação é **adiada** (preferência) ou
  descartada com motivo registrado. Nunca entra por cima.

### 3. Fluxos

**Permitido — o único caminho de resposta:**

```
Inbound → Agrupamento → Orquestração → Modelo/Ferramentas
        → Montagem → Validação → Publicação → Persistência
```

**Permitido — automação:**

```
Cron → IntencaoDeMensagem → checa conversa ativa → Montagem → Validação → Publicação
```

**Permitido — administrativo (fora do pipeline da família):**

```
Cron/Admin → notificarAdmin() → WhatsApp da Karina
```

**Proibidos, explicitamente:**

```
Ferramenta  → WhatsApp   ❌
Cron        → WhatsApp   ❌   (só via IntencaoDeMensagem)
Modelo      → WhatsApp   ❌
Streaming   → WhatsApp   ❌
Orquestrador→ WhatsApp   ❌   (só via publicar())
Ponte/PDF   → WhatsApp   ❌
Server action de tela → WhatsApp da família ❌
Publicação sem Validação ❌
Publicação sem posse do turno ❌
```

### 4. Estados da conversa

```
IDLE → RECEBENDO → AGRUPANDO → GERANDO → VALIDANDO → PUBLICANDO → FINALIZADO → IDLE
                                   ↘ (msg nova) → CEDIDO → IDLE
                                   ↘ (timeout)  → EXPIRADO → IDLE
                        VALIDANDO ↘ (bloqueio) → FALLBACK → PUBLICANDO
```

- **RECEBENDO → AGRUPANDO:** inbound persistida e idempotência garantida.
- **AGRUPANDO → GERANDO:** silêncio observado e lote claimado. Só uma execução
  passa; as demais vão a CEDIDO.
- **GERANDO → VALIDANDO:** texto completo em memória. **Só aqui a resposta
  existe.**
- **VALIDANDO → PUBLICANDO:** aprovado, ou fallback quando bloqueado.
- **PUBLICANDO:** reconfere posse do turno **imediatamente antes** de enviar.
  Perdeu a posse → DESCARTADO, com motivo.
- **Mensagem nova durante GERANDO:** a execução atual segue até VALIDANDO, mas
  **falha na reconferência** e descarta. Quem chegou depois responde por todas.
  Esta é a regra que impede a resposta das 22h42 de aparecer depois da de 23h10.
- **Timeout:** teto por execução (< `maxDuration` do webhook). Estourou → EXPIRADO,
  nada publicado, registrado.
- **Descartar a resposta quando:** perdeu a posse do turno; chegou inbound mais
  recente que `sourceMessageId`; já houve publicação para esta inbound;
  validação bloqueou e nem o fallback pôde ser montado.

### 5. Garantias

1. Uma inbound produz **no máximo uma** resposta.
2. Somente a execução que detém o turno publica.
3. Nenhuma resposta antiga publica depois de uma mais recente.
4. Nenhuma saída interna — raciocínio, instrução, log, output de ferramenta —
   chega ao WhatsApp.
5. Nenhuma ferramenta publica diretamente.
6. Nenhuma automação interrompe conversa ativa.
7. Toda resposta passa pela validação; o que ela barra vira fallback neutro, e o
   motivo fica registrado sem expor erro à família.
8. Texto e anexos de um turno chegam como **uma entrega coerente**, em ordem.
9. Retry de webhook não produz resposta nova.
10. Falha de qualquer camada **não** produz publicação parcial.

### 6. Riscos remanescentes

| Risco | Avaliação | Mitigação |
| --- | --- | --- |
| **Buffering completo** | perde-se o tempo até a primeira bolha (~8 s → ~25–40 s). O efeito "digitando" NÃO se perde: ele vem do `delaySegundos` por bolha, não do streaming | manter o balão de espera nos caminhos lentos; medir o tempo até a primeira bolha antes e depois |
| **Resposta muito grande** | buffer inteiro em memória; quebra em bolhas pode ficar longa | teto de tamanho na Montagem; acima dele, o excedente vira anexo ou é cortado com critério |
| **Timeout durante GERANDO** | resposta perdida, mãe sem retorno | teto abaixo do `maxDuration`; ao expirar, publicar fallback curto em vez de silêncio |
| **Falha entre Validação e Publicação** | janela pequena, mas real | publicação idempotente por `sourceMessageId`; retry seguro |
| **Publicação parcial** (bolha 2 de 4 falha) | a família vê meia resposta | publicar bolhas sequencialmente com registro de progresso; falha no meio não reinicia do zero no retry |
| **Retry do webhook** | resposta duplicada | idempotência no inbound (já existe) + idempotência na publicação (nova) |
| **Anexos** | PDF grande, URL assinada expirada | anexo é montado antes de publicar; falha do anexo não impede o texto, mas é registrada |
| **Conversa ativa mal calibrada** | janela curta demais deixa automação entrar; longa demais silencia | janela em constante única, revisável, com registro de adiamentos |
| **Detector defensivo** | falso positivo bloqueia resposta boa | fallback neutro + registro; medir taxa de bloqueio antes de apertar |

### 7. Migração

Nem tudo exige corte único. A ordem abaixo mantém o sistema publicável a cada
passo.

**Etapa 1 — Fronteira (incremental, sem mudar comportamento).**
Criar `publicar()` e `notificarAdmin()`. Redirecionar os 13 pontos de envio.
Nada muda para a família; o que muda é que passa a existir um lugar único.
*Regressão:* as conversas continuam idênticas.

**Etapa 2 — Buffering (CORTE ÚNICO).**
`gerarRespostaAyla` deixa de receber callback e passa a devolver o texto
completo; o envio em bolhas vai para a Publicação. **Não dá para fazer meio a
meio** — enquanto existir o caminho de streaming, o filtro é contornável, e é
exatamente esse caminho que vazou. É a única etapa sem meio-termo.

**Etapa 3 — Validação (incremental).**
Tipos `TextoBruto`/`TextoParaFamilia`, detector defensivo, fallback. Pode entrar
primeiro em modo observação (registra o que bloquearia sem bloquear) para medir
falso positivo, e depois passar a barrar.

**Etapa 4 — Ordem e posse (incremental).**
Reconferência de posse antes de publicar; descarte de resposta obsoleta.

**Etapa 5 — Conversa ativa (incremental, por automação).**
`IntencaoDeMensagem` + gate. Pode ser aplicada a um tipo de cron por vez.

**Testes que garantem não-regressão** (os 16 obrigatórios, agrupados):

- *idempotência:* webhook duplicado; dois workers; retry após timeout
- *concorrência e ordem:* mensagem nova durante geração; execução antiga
  terminando depois da nova; duas publicações simultâneas; mensagem fora de ordem
- *vazamento:* "orientação da Karina"; "ela respondeu 1"; comentário interno em
  terceira pessoa; ferramenta devolvendo diagnóstico interno; **conversa normal
  que não pode ser bloqueada**
- *entrega:* texto + PDF como entrega única; fallback quando o filtro barra
- *automação:* disparo durante conversa ativa; plano com pergunta pendente

O teste da "conversa normal que não sofre bloqueio" é o mais importante do
conjunto: é ele que impede o detector defensivo de virar um problema pior do que
o que resolve.

---

## Consequências

**Ganha-se:** um lugar único onde a resposta pode ser inspecionada, bloqueada,
ordenada e auditada; a possibilidade de evoluir o filtro sem tocar em
orquestração; e a garantia estrutural — não por disciplina — de que ferramenta,
cron e modelo não falam com a família.

**Perde-se:** a resposta progressiva. A primeira bolha passa a demorar mais.

**Fica fora deste ADR:** conteúdo clínico, voz, acolhimento, BIA, memória,
onboarding, motor de intervenção. Este documento é sobre integridade de entrega,
e só.
