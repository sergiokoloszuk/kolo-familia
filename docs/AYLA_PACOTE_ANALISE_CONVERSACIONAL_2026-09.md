# Pacote de análise conversacional da Ayla — setembro/2026

> ## ⚠️ RETIFICAÇÃO — 05/09/2026
>
> **Este documento afirmou que Claude e GPT eram dois providers conversacionais
> válidos em produção. Está errado, e a correção importa.**
>
> **PROVEI POR EXECUÇÃO:** `lib/ayla/experimental.ts:969` fixa
> `const provider = "openai" as const`. O caminho oficial do WhatsApp — 97,4%
> dos turnos — **nunca** usa Claude e ignora o seletor de provider. Eu li o
> registro `MODELO_CONVERSA` inteiro (que contém os dois) e reportei o lado
> errado.
>
> **Consequência:** onde este documento fala em "Claude × GPT" ou "fallback
> Claude", leia **GPT nas duas colunas**. As diferenças que atribuí a providers
> eram variação entre execuções do mesmo modelo.
>
> **DECISÃO DE PRODUTO (05/09/2026):** GPT é o cérebro conversacional e
> interpretativo da Ayla. Claude não responde família em canal nenhum. O
> endurecimento arquitetural disso é frente própria — ver
> `docs/AYLA_ATIVACAO_V10_2026-09.md`.



**Para uma equipe externa avaliar ativação e Trial.**
Levantado em 02/09/2026 lendo o repositório e consultando o banco de produção
por leitura. Nada foi alterado.

## Como ler este documento

Cada afirmação carrega o grau de certeza:

| Marca | Significa |
|---|---|
| **VI NO CÓDIGO** | li o arquivo indicado |
| **PROVEI POR EXECUÇÃO** | consultei produção e colei o resultado |
| **MEDI** | contei sobre dados reais |
| **INFERI** | dedução a partir do código, não observação |
| **NÃO SEI** | não consegui verificar |

E cada componente carrega o estado:

**PRODUÇÃO ATUAL** · **EXPERIMENTAL** (atrás de flag) · **DOCUMENTO DE DESENHO**
(escrito, não implementado) · **LEGACY** (existe, quase não roda) ·
**ARQUIVADO**.

> ⚠️ **A armadilha número um deste repositório:** o arquivo chamado
> `experimental.ts` **é a produção**, e o arquivo com cara de principal
> (`responder.ts`, `orchestrator.ts`) é o **legado**. Quem confiar nos nomes
> analisa o sistema errado. Isso já custou três correções que não alcançaram
> ninguém.

---

## 1. Arquitetura conversacional atual

### O caminho de um turno de WhatsApp

```
WhatsApp (Z-API)
  └─ POST /api/ayla/webhook            apps/web/src/app/api/ayla/webhook/route.ts
      └─ orchestrator.ts               identidade, acesso, idempotência, isolamento
          ├─ [97,4% dos turnos] ──────► experimental.ts   ← A AYLA REAL
          └─ [ 2,6% dos turnos] ──────► responder.ts      ← LEGACY (fallback)
```

**VI NO CÓDIGO** (`lib/ayla/experimental.ts`, cabeçalho): a chave
`AYLA_EXPERIMENTAL_TODAS=true` está no ambiente desde 23/08/2026 e manda 100%
das conversas para `experimental.ts`. O cabeçalho do próprio arquivo registra
que `responder.ts` atendia **2,59%** dos turnos na medição de agosto.

| Arquivo | Linhas | Estado |
|---|---|---|
| `lib/ayla/experimental.ts` | 1.244 | **PRODUÇÃO ATUAL** — a Ayla que as famílias recebem |
| `lib/ayla/orchestrator.ts` | 5.173 | **PRODUÇÃO (infra) + LEGACY (condução)** |
| `lib/ayla/responder.ts` | 841 | **LEGACY** — fallback se a flag sumir |

`orchestrator.ts` é ambíguo e vale explicitar: a **infraestrutura** dele roda
sempre (identidade, dedup, acesso, isolamento entre irmãos, proativas); a
**condução conversacional** dele é legado.

### Dois canais, um Core

**VI NO CÓDIGO:** a web (`/conversar`) usa `lib/ia/prompt.ts`; o WhatsApp usa
`experimental.ts`. Os dois leem o mesmo documento `core`. As regras de forma,
comercial e Trial **não** são as mesmas nos dois — ver §11.

---

## 2. Prompt real

### O que chega ao modelo, na ordem exata

**VI NO CÓDIGO** — `lib/ayla/experimental.ts:1011-1026`, o array `system`:

| # | Bloco | Origem | Quando entra |
|---|---|---|---|
| 1 | `core.conteudo` | banco `ayla_documentos` (chave `core`) | **sempre** |
| 2 | `bloco` | `experimental-contexto.ts` | sempre (contexto da família) |
| 3 | `jornada` | `lib/trial/jornada.ts` → `blocoDaJornada` | só em Trial ativo |
| 4 | `conducaoTrial` | banco `ayla_documentos` (chave `trial`) | **só quando `jornada` entra** |
| 5 | `repertorio` | `lib/conhecimento/recuperar.ts` → `boas_praticas` | só se houver skill roteada |
| 6 | `conducaoPosTrial` | `blocoPosTrial` | só pós-Trial, atrás de `AYLA_POS_TRIAL` |
| 7 | `comercial` | `lib/billing/fatos-comerciais.ts` | só em pergunta comercial |
| 8 | `formato` | `lib/conducao/formas.ts` | sempre (disciplina de canal) |
| 9 | `instrucaoExtra` | `lib/conducao/fronteiras.ts` | só na regeneração após vazamento |

Depois: `messages: [{ role: "user", content: mensagem }]`, `maxTokens: 1200`,
`cacheSystem: true`.

**Três coisas que surpreendem aqui:**

1. **Não há histórico no array `messages`.** Só a mensagem atual. O histórico
   recente entra **dentro do bloco 2**, como texto. **INFERI** que isso muda como
   o modelo pondera turnos anteriores — ele lê a conversa como contexto narrado,
   não como diálogo.
2. **A ordem é deliberada e o formato vem por último.** O comentário em
   `experimental.ts:825` explica: o Core é escrito em markdown e o modelo imita o
   que o documento demonstra; a regra de formato precisa ser a última palavra.
3. **O cache da Anthropic casa por prefixo**, e o prefixo é o Core — por isso ele
   é o bloco 1 e nada muda antes dele.

### Estado dos documentos no banco

**PROVEI POR EXECUÇÃO** (02/09/2026, `ayla_documentos`, produção):

```
ATIVO: core   v9  publicado 2026-08-17
ATIVO: trial  v5  publicado 2026-08-26
```

`plano`, `cartoes_visuais` e `fontes_confiaveis`: cadastrados, **nenhum ativo**.

> ⚠️ **Comentário desatualizado no repositório.** `lib/ayla/documentos.ts:26-31`
> afirma que *"hoje só o `core` é resolvido e injetado"*. Isso **não é mais
> verdade**: `experimental.ts:781` resolve e injeta o documento `trial`. Quem ler
> só o comentário conclui errado.

### Fallback

**VI NO CÓDIGO** (`documentos.ts`): se o banco falhar, a linha sumir ou o
conteúdo vier vazio, o Core do código (`experimental-prompt.ts`,
`AYLA_EXPERIMENTAL_PROMPT`, 565 linhas) assume. Ele é chão, não resquício.

---

## 3. Core

**Fonte de verdade hoje: o registro `core` v9 na tabela `ayla_documentos`,
editável pelo Admin em `/admin/documentos/core`, sem deploy.**

O que o Core define: princípios permanentes, forma de raciocínio, investigar
antes de orientar, segurança e limites, uso de memória, personalização, não
repetição, artefatos, relação com o Perfil/Kolo Vivo.

**Onde NÃO está mais:** `lib/conducao/diretrizes.ts` (`nucleoConducao`) foi a
fonte única até agosto e hoje serve o caminho **Legacy**. Analisar a Ayla por ele
é analisar 2,6% dos turnos.

**Histórico versionado em `docs/documentos-ayla/`** — `core-ayla-v1/v2/v4.md`,
`core-v5-base.md`, `core-v7-INTEGRAL-DO-BANCO.md`. São **DOCUMENTO DE DESENHO /
ARQUIVADO**; nenhum é o que roda. O que roda é a v9 do banco.

---

## 4. Voz Ayla

> **Não existe um documento de Voz.** As regras estão espalhadas por quatro
> lugares, e essa é uma lacuna real, não um detalhe de organização.

| Onde | O que define | Estado |
|---|---|---|
| `core` v9 (banco) | tom, acolhimento, perguntas, não-repetição | **PRODUÇÃO** |
| `lib/conducao/formas.ts` | `FORMATO_WHATSAPP`, tamanho, entrega estruturada, idioma, proporção | **PRODUÇÃO** |
| `lib/conducao/fronteiras.ts` + `fronteiras-forma.ts` | o que **não pode sair** — inspeção da resposta pronta | **PRODUÇÃO** |
| `lib/conducao/diretrizes.ts`, `angulos.ts`, `escopo.ts` | tom e progressão | **LEGACY** |

**A disciplina de canal é recente e nasceu de uma medição** — `experimental.ts:812`:
desde o rollout de 17/08, as respostas saíam com `**` cru em **65,2%** dos casos,
`##` em 9,6%, `>` em 22,2%, mediana de **812 caracteres** contra 376 do Legacy. O
WhatsApp não renderiza nada disso: a família via os asteriscos.

**E o mesmo recorte mostrou o contrário do esperado na qualidade:** nas mesmas 12
famílias, o caminho novo valida emoção em **27,1%** contra 11,3% do Legacy, e
acolhe antes de orientar em **20,1%** contra 10,2%.

**Few-shot:** **NÃO SEI**. Não inspecionei o conteúdo do Core v9 — ele vive no
banco. Precisa ser exportado para a equipe (ver §12).

---

## 5. Contexto recebido pelo modelo

Montado em `lib/ayla/experimental-contexto.ts` (753 linhas) + `experimental-foco.ts`
+ `experimental-memoria.ts`.

### O que realmente chega

| Informação | Chega? | Onde |
|---|---|---|
| Nome, idade/nascimento da criança | **SIM** | `montarContextoBase` |
| Gênero e pronomes | **SIM** | `pronomes.ts` |
| Desafios do onboarding | **SIM** | `blocoDaFamilia` |
| Interesses | **SIM** | `interessesAtuais` |
| Perfil Vivo / Kolo Vivo | **SIM** | `lerPerfilVivo`, `fatosDisponiveis` |
| Rótulos/diagnósticos conhecidos | **SIM** | `rotulosConhecidos` |
| Histórico recente | **SIM** — como texto no bloco, não como `messages` | `montarContexto` |
| Memória longitudinal (eventos) | **SIM** | `experimental-memoria.ts` |
| Foco do turno | **SIM** | `experimental-foco.ts` |
| Estado do Trial + dia | **SIM**, se em Trial | `lerEstadoTrial` + `blocoDaJornada` |
| Evidências da jornada | **SIM**, se em Trial | `lerEvidenciasJornada` |
| Boas Práticas | **SIM**, no máximo **2**, só com skill roteada | `recuperarBoasPraticas` |
| Estratégias/tentativas anteriores | **PARCIAL** — via eventos, não como bloco próprio | — |
| Plano existente | **NÃO SEI** | — |
| Rotina existente | **NÃO SEI** | — |
| Assinatura | **INDIRETO** — só decide se o bloco comercial entra | — |

**Isolamento entre irmãos:** `lib/ayla/membro-escopo.ts` — corrigido em agosto,
em produção.

**O ponto que merece atenção da equipe externa:** o limite de **2** Boas Práticas
por turno, e só quando há skill roteada. Com 381 BPs no acervo, o que chega ao
modelo por conversa é uma fatia muito estreita.

---

## 6. Conhecimento disponível

**PROVEI POR EXECUÇÃO** (produção, 02/09):

### A) Conectada e usada hoje

| Base | Volume | Como entra |
|---|---|---|
| `boas_praticas` | **381 registros** | `recuperarBoasPraticas` → bloco 5, máx. 2/turno |
| `ayla_documentos` (`core` v9) | 1 ativo | bloco 1, sempre |
| `ayla_documentos` (`trial` v5) | 1 ativo | bloco 4, só em Trial |
| `lib/conducao/base2-conteudo.ts` | 2.574 linhas | **NÃO SEI** se alcança o caminho oficial |
| `mensagens_skill` | 427 registros | roteamento de skill |

### B) Existe e não está conectada

- `specialist_prompt_templates` (tabela do `/admin/skills`) — **NÃO SEI** se algum
  caminho a lê.
- `ayla_documentos`: `plano`, `cartoes_visuais`, `fontes_confiaveis` — cadastrados,
  nenhum ativo, nenhum injetado.

### C) Experimental

- **BIA** (`lib/bia/`, 15 arquivos) — **está na `main`**, com retriever, chunker,
  pontuação, detecção de desabafo e testes. **Desligada** por
  `BIA_PROMPT_ENABLED`, e **não é importada** por `experimental.ts` nem por
  `orchestrator.ts`. Infraestrutura pronta, prompt não conectado.

### D) Arquivada

- `docs/documentos-ayla/*` — versões anteriores de Core, Trial, Plano, Cartões.
- Versões `arquivado` em `ayla_documentos` (core v1–v8, trial v1–v4).

---

## 7. Iniciativa espontânea

### O mecanismo de produção

```
Vercel Cron ──► GET /api/ayla/cron?tipo=…       app/api/ayla/cron/route.ts
   └─ seleciona famílias por janela de horário   runRotina / runInatividade / …
       └─ podeEnviarProativa()                   lib/ayla/rules.ts   ← os gates
           └─ reservarEnvioProativo()            lib/ayla/cadencia.ts ← anti-rajada
               └─ gerarMensagemEspontanea()      lib/ayla/mensagemEspontanea.ts
                   └─ enviarTexto()              Z-API → WhatsApp
```

### Os horários do cron

**VI NO CÓDIGO** (`vercel.json`): quase todos os tipos rodam em
`0 11,15,18,22 * * *` — **11h, 15h, 18h e 22h UTC** = **08h, 12h, 15h e 19h em
Brasília**. São **quatro instantes fixos por dia**, não uma varredura contínua.

### Os gates, em ordem (`lib/ayla/rules.ts`, `podeEnviarProativa`)

1. Consentimento LGPD (`consentimento_em`), não desativada, não pausada
2. **Acesso liberado** — Trial vencido não recebe engajamento (staff é isento)
3. Criança específica definida
4. **"Já conversamos hoje"** — qualquer inbound no dia bloqueia (exceto boas-vindas)
5. **Janela de horário preferida** da família (fuso BR)
6. **Máximo 2 proativas por dia**
7. Comercial bloqueado por 48h após crise/exaustão
8. Insight não sai no mesmo dia que comercial
9. Engajamento adiado se a Ayla falou há menos de 36h

Mais `reservarEnvioProativo` (`cadencia.ts`), que resolve rajada por
reserva-primeiro no banco — necessário porque em serverless cada invocação é um
processo novo.

### Comparação com o desenho mais recente

| Elemento do desenho | Estado |
|---|---|
| Jornada do dia orientando a iniciativa | **PARCIAL** — `INTENCAO_DO_DIA` existe e entra no prompt reativo; as proativas usam templates |
| Perfil/Kolo Vivo na decisão | **NÃO IMPLEMENTADO** na proativa |
| Histórico recente na decisão | **PARCIAL** |
| O que já foi perguntado/respondido | **NÃO IMPLEMENTADO** |
| Lacunas reais como gatilho | **NÃO IMPLEMENTADO** |
| Motor leve decidindo | **NÃO IMPLEMENTADO** — hoje a decisão é uma cascata determinística por tipo |
| **Máx. 1 iniciativa/família/dia** | **DIVERGE** — o código permite **2** |

### Existem dois motores concorrentes?

**Sim, e é importante.** **VI NO CÓDIGO:**

- `lib/ayla/rules.ts` + `cron/route.ts` + `mensagemEspontanea.ts` — **PRODUÇÃO**
- `lib/ayla/manual/bridge.ts` e `lib/ayla/manual/proactive.ts` — uma segunda
  camada que também chama `podeEnviarProativa`. **NÃO SEI** se é alcançada em
  produção ou se é ferramenta de admin.

Os dois compartilham os gates duros (bom), mas a seleção e a geração são
distintas.

---

## 8. Trial D0–D7

### Referência atual

**Duas, e elas não são a mesma coisa:**

1. **O que roda:** documento `trial` **v5** no banco (ativo desde 26/08) +
   `lib/trial/jornada.ts` (código).
2. **O que está escrito:** `docs/documentos-ayla/trial-v4-VIGENTE.md` — o nome diz
   "vigente" mas **o banco está na v5**. **DOCUMENTO DE DESENHO**, possivelmente
   desatualizado em relação ao que roda.

### Implementado

**VI NO CÓDIGO** (`lib/trial/jornada.ts`):

- `INTENCAO_DO_DIA` — uma intenção por dia, D0 a D7
- `intencaoDoDia(dia, diasRestantes)` — **ancorado no FIM do teste**, não no
  começo; com 7 dias, a etapa 3 é comprimida
- `DIAS_DE_FECHAMENTO = {4,5,6,7}` — só nesses dias a conversa pode ter função
  comercial
- `blocoDaJornada` — determinístico, sem chamada de modelo; sai vazio para
  assinante, cortesia, staff e simulador
- `lerEvidenciasJornada` + `nivelDeEvidencia` (A/B/C) — o D6 só resume com
  evidência real
- `blocoPosTrial` — atrás de `AYLA_POS_TRIAL`

**Como o Trial chega ao modelo:** blocos 3 e 4 do `system`. O `<jornada>` é o
**quando/o quê**; o documento `trial` v5 é o **como**. O documento entra
exatamente quando o bloco entra — um dono só para a decisão.

**D4 feedback · D5 trajetória · D6 oferta · D7 fechamento:** as quatro intenções
existem em `INTENCAO_DO_DIA` e são o "fechamento invertido" — quem nomeia o valor
é a mãe, e a decisão cai no último dia.

### Não implementado / a confirmar

- **NÃO SEI** se as mensagens **proativas** do Trial seguem `INTENCAO_DO_DIA` ou
  templates fixos. A jornada comprovadamente alimenta o caminho **reativo**.
- Vídeo de boas-vindas: existe cron `tipo=video_guia`; **NÃO SEI** o conteúdo.
- Plano/Rotina/Relatório dentro da jornada: **NÃO SEI** se há gatilho por dia.

---

## 9. Boas-vindas e onboarding

### O fluxo real

```
/signup → /onboarding (conversacional, 13 perguntas) → garfo de 4 caminhos
                                                           └─ WhatsApp → 1ª conversa
```

**VI NO CÓDIGO** (`lib/onboarding/copy-default.ts`): as perguntas incluem nome e
data de nascimento da criança, desafios, interesses, **WhatsApp (pergunta 8 de
13, com código de 6 dígitos obrigatório)**, responsável, faixa etária e horário
de contato.

### ⚠️ A tela `/boas-vindas` está morta na prática

**VI NO CÓDIGO** (`lib/onboarding/salvar-conversacional.ts:277`): ao concluir, o
onboarding conversacional grava `boas_vindas_vista_at = agora`. E
`app/boas-vindas/page.tsx` redireciona para `/painel` se esse campo estiver
preenchido.

**INFERI:** quem passa pelo onboarding conversacional **nunca vê** a tela de
boas-vindas — e portanto nunca vê a pergunta de janela que vive lá. O código dela
continua no repositório e parece ativo.

### O que pode se perder entre onboarding e conversa

- O horário é **opcional** (`opcional: true`). Não respondeu → o padrão do banco
  (19:00–21:00) decide por ela.
- **NÃO SEI** se todos os 13 campos coletados alcançam o bloco de contexto — a
  equipe deveria comparar a lista de perguntas com `blocoDaFamilia`.

---

## 10. Capacidades e artefatos

| Capacidade | Quando pode ser acionada | Estado |
|---|---|---|
| Orientação / investigação | qualquer turno | **PRODUÇÃO** |
| Atividades e brincadeiras | via repertório (Boas Práticas) | **PRODUÇÃO** |
| **Plano Kolo** | decisor por pontuação antes da resposta; dedup pela tabela `planos` | **PRODUÇÃO** |
| **Rotina Visual** | pedido de rotina; contrato estruturado; cartões em JPEG | **PRODUÇÃO** (`rotina-guiada.ts`, 2.356 linhas) |
| Relatório escola/terapeuta | pedido explícito; magic link | **PRODUÇÃO** |
| Visão (imagem: lição, rótulo) | mãe manda foto | **PRODUÇÃO** |
| Celebração / evolução | **NÃO SEI** se há gatilho automático | — |
| Cartões visuais (documento) | — | **NÃO CONECTADO** |

---

## 11. Lacunas atuais

1. **Não existe documento de Voz.** As regras de tom estão em quatro lugares, dois
   deles legado. É a lacuna mais fácil de corrigir e a mais cara de manter aberta.
2. **O nome do arquivo mente.** `experimental.ts` é a produção. Qualquer análise
   que comece pelos nomes analisa o sistema errado.
3. **Comentário desatualizado em `documentos.ts`** afirma que só o Core é
   injetado; o `trial` também é.
4. **`trial-v4-VIGENTE.md` não é o vigente** — o banco está na v5.
5. **Divergência de cadência:** o desenho pede **1** iniciativa/família/dia; o
   código permite **2**.
6. **A proativa não usa Perfil, histórico nem lacunas** para decidir o que dizer.
7. **BIA pronta e desconectada** — 15 arquivos, retriever, testes, flag desligada.
8. **Só 2 Boas Práticas por turno**, de um acervo de 381.
9. **Quatro instantes de cron** contra um campo de horário livre (ver §14).
10. **A tela `/boas-vindas` é inalcançável** pelo caminho normal, mas segue viva
    no código.
11. **Dois motores de proativa** (`rules`/`cron` e `manual/`), sem clareza de qual
    alcança produção.

---

## 12. Arquivos que devem ser enviados à equipe externa

**Prompt e Core**
- `apps/web/src/lib/ayla/experimental-prompt.ts` — o Core de fallback (565 linhas)
- **Export do `core` v9** do banco (`/admin/documentos/core`) — *não está em arquivo*
- **Export do `trial` v5** do banco — *não está em arquivo*

**Montagem e contexto**
- `apps/web/src/lib/ayla/experimental.ts`
- `apps/web/src/lib/ayla/experimental-contexto.ts`
- `apps/web/src/lib/ayla/experimental-foco.ts`
- `apps/web/src/lib/ayla/experimental-memoria.ts`
- `apps/web/src/lib/ayla/documentos.ts`

**Voz e fronteiras**
- `apps/web/src/lib/conducao/formas.ts`
- `apps/web/src/lib/conducao/fronteiras.ts`
- `apps/web/src/lib/conducao/fronteiras-forma.ts`

**Trial**
- `apps/web/src/lib/trial/jornada.ts`
- `apps/web/src/lib/trial/estado.ts`
- `docs/documentos-ayla/trial-v4-VIGENTE.md` — **com o aviso de que o banco está na v5**

**Iniciativa espontânea**
- `apps/web/src/lib/ayla/rules.ts`
- `apps/web/src/lib/ayla/cadencia.ts`
- `apps/web/src/lib/ayla/mensagemEspontanea.ts`
- `apps/web/vercel.json`

**Onboarding**
- `apps/web/src/lib/onboarding/copy-default.ts`
- `apps/web/src/lib/onboarding/salvar-conversacional.ts`

**Conhecimento**
- `apps/web/src/lib/conhecimento/recuperar.ts`
- Amostra anonimizada de `boas_praticas`

---

## 13. Arquivos que NÃO devem ser enviados

| O quê | Motivo |
|---|---|
| `apps/web/.env.local` e qualquer `.env` | segredos: service-role, Stripe, Z-API, OpenAI, Anthropic |
| Dumps de `family_accounts`, `family_profiles`, `membros_atipicos` | dados pessoais de criança |
| `perfil_vivo_membro`, `ayla_daily_checkins` | dado de saúde de criança |
| `ayla_messages` **em cru** | conversas identificáveis — só o extrato anonimizado de §14 |
| `acessos_app`, `verificacoes_whatsapp`, `verificacoes_email` | credenciais e códigos |
| `lib/supabase/server.ts` (chave), rotas de webhook Stripe | superfície de segurança |
| `docs/PENDENCIAS.md` | histórico interno com incidentes e nomes de famílias |
| `lib/ayla/orchestrator.ts` e `responder.ts` | **legado** — enviar induziria a equipe a analisar 2,6% do sistema |

---

## 14. Conversas anonimizadas recomendadas para análise

**MEDI** (produção, 02/09/2026): `ayla_messages` tem **7.077 mensagens**, sendo
**2.840 inbound**. É material suficiente.

### Como extrair sem expor ninguém

A tabela tem `family_account_id`, `direcao`, `category`, `tipo`, `created_at` e o
conteúdo. Para o pacote:

1. Substituir `family_account_id` por um pseudônimo estável (F001, F002…) —
   permite ler a conversa inteira sem saber de quem é.
2. Remover/mascarar nomes de criança e responsável, telefones, e-mails e links com
   token. **Os nomes aparecem no corpo das mensagens** — a Ayla chama a criança
   pelo nome. Uma varredura por regex não basta: é preciso cruzar com
   `membros_atipicos.nome` e `family_profiles.nome_mae` para saber o que mascarar.
3. Manter data relativa (D0, D1…), não absoluta.

### Recortes pedidos e como achar cada um

| Recorte | Como selecionar |
|---|---|
| Boas conversas | famílias com muitos inbounds e artefato gerado (plano/rotina) |
| Conversas genéricas | turnos sem skill roteada — sem repertório no prompt |
| Pouco contexto ("ele grita") | inbound com < 40 caracteres (constante `CARACTERES_FALA_POUCO`) |
| Ayla perguntou demais | usar `perguntasReais()` de `fronteiras-forma.ts` sobre o outbound |
| Personalizou bem | outbound citando fato do Perfil Vivo |
| Usou memória corretamente | outbound retomando assunto de dia anterior |
| **Repetiu perguntas** | mesma pergunta em turnos distintos da mesma família |
| Trial D1–D7 | cruzar `created_at` com `subscription_accesses.trial_ends_at` |

> ⚠️ **NÃO SEI** se existe hoje um script de anonimização. **Não encontrei
> nenhum.** Ele precisa ser escrito antes de qualquer exportação — e essa é a
> dependência que separa este pacote de estar pronto para envio.

---

## Tabela final

| MATERIAL | ARQUIVO FONTE | ESTADO | PRODUÇÃO? | ENVIAR? | MOTIVO |
|---|---|---|---|---|---|
| Ayla oficial | `lib/ayla/experimental.ts` | PRODUÇÃO ATUAL | **Sim, 97,4%** | **Sim** | é a Ayla real |
| Ayla legado | `lib/ayla/responder.ts` | LEGACY | 2,6% | **Não** | induz a analisar o sistema errado |
| Orquestrador | `lib/ayla/orchestrator.ts` | infra PRODUÇÃO / condução LEGACY | parcial | **Não** | 5.173 linhas, majoritariamente legado |
| Core ativo | banco, `core` v9 | PRODUÇÃO ATUAL | **Sim** | **Sim** (exportar) | não existe em arquivo |
| Core fallback | `lib/ayla/experimental-prompt.ts` | PRODUÇÃO (chão) | sim, se o banco falhar | **Sim** | mostra a base |
| Cores antigos | `docs/documentos-ayla/core-*.md` | ARQUIVADO | não | **Não** | v1–v7, superados |
| Trial ativo | banco, `trial` v5 | PRODUÇÃO ATUAL | **Sim**, em Trial | **Sim** (exportar) | não existe em arquivo |
| Trial escrito | `docs/…/trial-v4-VIGENTE.md` | DOC DE DESENHO | não | **Sim, com aviso** | o nome mente: banco na v5 |
| Jornada D0–D7 | `lib/trial/jornada.ts` | PRODUÇÃO ATUAL | **Sim** | **Sim** | o motor do Trial |
| Contexto | `lib/ayla/experimental-contexto.ts` | PRODUÇÃO ATUAL | **Sim** | **Sim** | define o que o modelo vê |
| Voz/forma | `lib/conducao/formas.ts` | PRODUÇÃO ATUAL | **Sim** | **Sim** | disciplina de canal |
| Fronteiras | `lib/conducao/fronteiras*.ts` | PRODUÇÃO ATUAL | **Sim** | **Sim** | o que não pode sair |
| Núcleo antigo | `lib/conducao/diretrizes.ts` | LEGACY | 2,6% | **Não** | não é mais a fonte |
| Proativa | `lib/ayla/rules.ts`, `cadencia.ts`, `mensagemEspontanea.ts` | PRODUÇÃO ATUAL | **Sim** | **Sim** | os gates reais |
| Proativa alternativa | `lib/ayla/manual/*` | NÃO SEI | ? | **Não** | estado indefinido |
| Cron | `apps/web/vercel.json` | PRODUÇÃO ATUAL | **Sim** | **Sim** | os 4 horários |
| Boas Práticas | `boas_praticas` (381) | PRODUÇÃO ATUAL | **Sim**, máx. 2/turno | **Amostra** | acervo clínico |
| BIA | `lib/bia/*` | EXPERIMENTAL | **Não** — flag off, não importada | **Sim, rotulada** | pode informar o desenho |
| Base2 | `lib/conducao/base2-conteudo.ts` | NÃO SEI | ? | **Não** | alcance não confirmado |
| Skills | `specialist_prompt_templates` | NÃO SEI | ? | **Não** | conexão não confirmada |
| Onboarding | `lib/onboarding/copy-default.ts` | PRODUÇÃO ATUAL | **Sim** | **Sim** | as 13 perguntas |
| Boas-vindas | `app/boas-vindas/*` | **inalcançável** | não | **Sim, rotulada** | mostra a lacuna |
| Conversas | `ayla_messages` (7.077) | PRODUÇÃO ATUAL | **Sim** | **Só anonimizado** | dado de criança |
| Segredos | `.env*` | — | — | **NUNCA** | credenciais |
