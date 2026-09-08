# HANDOFF — MAPA COMPLETO DA AYLA

**08/09/2026.** O que a Ayla pode acessar, o que ela de fato acessa, e onde a
cadeia se rompe.

**Régua usada em tudo:**

```
EXISTE → IMPLEMENTADO → CONFIGURADO → ATIVO → CARREGADO → CONSULTADO
→ INFLUENCIA A RESPOSTA → EXECUTA AÇÃO
```

Nome de arquivo e nome de função **não são prova**. Onde não consegui provar,
está escrito **NÃO SEI** — e isso não conta como funcionando.

> ⚠️ **Estado desta versão.** As seções 1 a 7, 10 e 11 estão fechadas com
> evidência. As seções 8 (modelos) e 9 (traçado dos seis casos) estão
> **parciais** — o traçado exige leitura linha a linha do orquestrador para cada
> caso, e não terminei. O que está aqui não foi inferido.

---

## O achado que reorganiza tudo

**`status = "ativo"` em `ayla_documentos` NÃO significa que o runtime carrega o
documento.**

`resolverDocumento` — a única porta de leitura de documentos no runtime — é
chamada em **exatamente dois lugares**, ambos em `lib/ayla/experimental.ts`:

```
experimental.ts:839   resolverDocumento(supabase, "core", rascunhoCore)
experimental.ts:864   resolverDocumento(supabase, "trial")     ← só quando !semJornada
```

`cartoes_visuais` e `plano` **existem como chaves** (`documentos.ts:36,47`), têm
tela no Admin, têm linha no banco — e **nenhum consumidor no runtime**. Ativar o
documento de Cartões Visuais no Admin hoje **não mudaria uma vírgula** do que a
Ayla faz.

E o `FALLBACK` do código só tem `core`: se alguém pedisse `plano` ou
`cartoes_visuais`, receberia string vazia.

---

## 1 · Tabela-mestra

| Recurso | Existe | Implem. | Ativo | Carregado quando | Consulta Perfil | Usa conhecimento | Escreve estado | Produção comprovada | Problema |
|---|---|---|---|---|---|---|---|---|---|
| **Core** (`core v11`) | ✅ | ✅ | ✅ | todo turno reativo | — | — | não | ✅ `ayla_documentos`, status ativo, lido em `experimental.ts:839` | — |
| **Trial** (`trial v5`) | ✅ | ✅ | ✅ | turno reativo, **exceto** `semJornada` | — | — | não | ✅ lido em `experimental.ts:864` | condição de carga não medida |
| **Doc. Cartões Visuais** (`cartoes_visuais v1`) | ✅ | ❌ | `arquivado` | **nunca** | — | — | — | ❌ | **sem consumidor no runtime**; ativar não faria efeito |
| **Doc. Plano** (`plano v1`) | ✅ | ❌ | `arquivado` | **nunca** | — | — | — | ❌ | idem |
| **Boas Práticas (BPs)** | ✅ | ✅ | ✅ | todo turno do caminho novo | via skills | ✅ | rastro | ✅ **330 rastros `canal:"whatsapp"`** em `eventos_app` desde 09/08 | — |
| **Perfil consultável** (`carregarPerfilConsultavel`) | ✅ | ✅ | **web apenas** | só no caminho **LEGADO** do WhatsApp | ✅ | — | não | ❌ **não chega ao WhatsApp** | código inalcançável — §1-bis |
| **base2** (`secoesDe`) | ✅ | ✅ | **web apenas** | só no caminho **LEGADO** do WhatsApp | — | ✅ | não | ❌ **não chega ao WhatsApp** | código inalcançável — §1-bis |
| **Material da pós** | ✅ (arquivo) | ❌ | ❌ | **nunca** | — | ❌ | — | ❌ | **BASE EXISTE / NÃO CONECTADA** — ver §7 |
| **Decisor do turno** (`decidirTurno`) | ✅ | ✅ | ✅ | todo turno | não | não | `api_calls` | ✅ 4 chamadas medidas em 07/09 | — |
| **Dono do lote** (`aguardarTurnoDaMae`) | ✅ | ✅ | ✅ | todo turno, antes dos gates | — | — | `processada_em` | ✅ dois balões com o mesmo `processada_em` | janela de 10 s |
| **Rotina Visual** | ✅ | ✅ | ✅ | porta `rotina_criar`/`organizacao`/posse | ✅ interesses e transições | — | `rotinas`, `rotina_tarefas` | ✅ Nível 2 provou `aguardando→gerando→pronto` | ver §6 |
| **Plano Estratégico** | ✅ | ✅ | ✅ | `ponteDePlano` após resposta comum | ✅ | ✅ BPs | `planos` | ✅ 25 planos analisados | 25/25 automáticos |
| **Metadata de turno** | ✅ | ✅ | ✅ | todo envio | — | — | `ayla_messages.metadata` | ⚠️ **corrigido só em branch** (`94e2e6d`) | em produção ainda apaga |
| **Rastro do conhecimento** | ✅ | ✅ | **web apenas** | caminho legado (WA) / web | — | — | `eventos_app` | ⚠️ 330 rastros WA, **todos de 09–22/08**; nenhum depois | PEND-106 confirmada — §1-bis |

---

## 1-bis · A INCÓGNITA FOI FECHADA — e a resposta é pior que "off"

**08/09, segunda rodada.** A pergunta era "`KOLO_PILOTO_4A` está ligada?".
A resposta certa é: **não importa, porque o código que a lê não é alcançado.**

### A prova, em três passos

**1. `pilotoQuatroA` é chamada em exatamente dois lugares:**

```
orchestrator.ts:3588   ← caminho do WhatsApp
lib/ia/context.ts:153  ← caminho da WEB
```

**2. A linha 3588 fica DEPOIS do `return` do caminho novo.** Em
`orchestrator.ts:3334`, com o comentário original:

```js
// ⚠️ O `return` É O QUE GARANTE UMA RESPOSTA SÓ. Sem ele, o turno seguiria
// para a Ayla atual e a família receberia duas.
return { tratada: true, familia: family.id, resposta: resp };
}
console.log("[ayla:path] experimental indisponível — seguindo pela Ayla atual");
```

Tudo abaixo disso — inclusive o bloco do piloto 4A — só executa quando
`responderExperimental` **falha**. E `AYLA_EXPERIMENTAL_TODAS=true` está
publicado em produção (visível em `/api/health`), então o caminho novo atende
**todos os turnos**.

**3. O caminho vivo não usa nada disso.** Varredura em `experimental.ts` por
`carregarPerfilConsultavel`, `secoesDe`, `base2`, `pilotoQuatroA` e
`registrarRastroConhecimento`: **zero ocorrências**.

### A confirmação empírica, que eu quase li ao contrário

Os 330 rastros de conhecimento com `canal:"whatsapp"` vão de **09/08 a 22/08 —
e param**. Nenhum depois disso. É exatamente a assinatura de um bloco que
deixou de ser alcançado quando o caminho novo assumiu.

E dentro daquela janela o piloto **estava ligado para alguém**: das 93 boas
práticas distintas recuperadas no WhatsApp, **8 estavam em `rascunho`** — e
`statusAceitos` só inclui `rascunho` dentro do piloto (`orchestrator.ts:3597`).
A distribuição de `n_enviados` mistura 2 (limite do piloto) e 3 (limite de
fora), coerente com `teste` + allowlist.

> ⚠️ **CORREÇÃO DE UM ERRO MEU.** Na primeira versão deste mapa eu escrevi que a
> PEND-106 estava "parcialmente desatualizada" porque encontrei 330 rastros de
> WhatsApp. **Estava errado.** Os rastros são todos do período legado e param em
> 22/08. A PEND-106 está certa: **o rastro do conhecimento não cobre o WhatsApp
> hoje**. Eu tinha o dado e li a data errado.

### O que isso significa

| | WhatsApp (caminho vivo) | Web |
|---|---|---|
| `carregarPerfilConsultavel` | **não chega** | atrás do piloto |
| `base2` / `secoesDe` | **não chega** | atrás do piloto |
| rastro do conhecimento | **não emite** | emite |
| BPs | **chega** — `experimental.ts:841`, `relato` + `idade` + `limite: 2`, só `ativo` | chega |
| `KOLO_PILOTO_4A` | **irrelevante** | relevante |

**Valor da variável: NÃO COMPROVADO** — não tenho leitura de env de produção, e
o `/api/health` não a publica. Mas o valor **deixou de importar para o
WhatsApp**: ligar a flag hoje não mudaria nada no canal das famílias.

### Consumidores do gate — o que ele liga de verdade

| Recurso | Condição | Efeito | Alcançável no WhatsApp? |
|---|---|---|---|
| `relato` no ranking de BPs | `noPiloto4A` | ordena por aderência | ❌ legado |
| `statusAceitos: ["ativo","rascunho"]` | `noPiloto4A` | inclui rascunho | ❌ legado |
| `limite: 2` | `noPiloto4A` | 2 em vez de 3 BPs | ❌ legado |
| `carregarPerfilConsultavel` | `noPiloto4A && membroContextoId` | perfil estruturado ao modelo | ❌ legado |
| `secoesDe` (base2) | `noPiloto4A && temMaterial(tema)` | 3 seções de investigação | ❌ legado |
| `piloto` na web | `pilotoQuatroA && relato` | idem, no canal web | ✅ web |

**Ele não escreve estado, não muda perguntas, não toca Plano nem Rotina.** É um
gate exclusivamente de *enriquecimento de contexto* — e, no WhatsApp, de código
inalcançável.

---

## 2 · A incógnita que decide metade do mapa (RESOLVIDA — ver 1-bis)

`carregarPerfilConsultavel` e `secoesDe` (base2) — as duas leituras "que
faltavam a este canal" — estão atrás de **uma única porta**:

```js
const noPiloto4A = pilotoQuatroA(family.id);              // orchestrator.ts:3588
const perfilConsultavel4A = noPiloto4A && membroContextoId ? await carregarPerfilConsultavel(...) : null;
const base2Secoes = noPiloto4A && temaBase2 && temMaterial(temaBase2) ? secoesDe(...) : [];
```

`pilotoQuatroA` lê `KOLO_PILOTO_4A` e, **sem a variável, `estadoDeRollout`
devolve `"off"`** (`rollout.ts:42`) — ninguém entra.

**Não consigo ler variável de ambiente de produção.** O `/api/health` publica
apenas `ayla_pos_trial` e `ayla_experimental_todas`; `KOLO_PILOTO_4A` não
aparece. E o rastro do conhecimento **não registra** se o perfil consultável ou
a base2 entraram — só BPs.

> **Se a flag estiver `off`:** o Perfil consultável e a base2 **nunca** chegam ao
> WhatsApp, e metade da inteligência que já existe está desligada.
> **Se estiver `on`:** chegam, e o mapa é bem melhor.
>
> **Esta é a pergunta mais barata e mais importante de responder.** Um olhar no
> painel da Vercel resolve.

---

## 3 · Arquitetura real do turno

```
WhatsApp (Z-API)
  │
  ▼
POST /api/ayla/webhook ─── valida x-ayla-secret (se configurado)
  │                        responde 200 e processa em after()
  ▼
processInbound  (orchestrator.ts:1878 — única porta para tudo)
  │
  ├─ 1. identifica família por telefone (tolerante ao 9º dígito)
  │      ⚠️ whatsapp_e164 SEM UNIQUE — 1 duplicado medido em 07/09
  │
  ├─ 1a. BLOQUEIO: ayla_preferences.desativada → não responde nada
  │
  ├─ 2. persiste o inbound em ayla_messages
  │
  ├─ 3a. CONTROLE DE TURNO  ── aguardarTurnoDaMae (lote-inbound.ts)
  │      dorme 10 s · quem chegou depois responde por todas
  │      claim atômico sobre processada_em → UM dono por lote
  │      ⚠️ tudo abaixo roda UMA vez por lote, não por mensagem
  │
  ├─ retomarPedidoAposClarificacao ── lê metadata.pedido
  │      ⚠️ EM PRODUÇÃO SEMPRE FALHA: metadata é apagada no envio
  │
  ├─ apurarEstadoDoTurno → blocoDeEstado
  │
  ├─ decidirTurno (GPT)  ── intenção · tema · skills · pedidoExplicito
  │      falha → neutro (intencao "outro", pedidoExplicito false)
  │
  ├─ PORTAS DE ARTEFATO, nesta ordem — cada uma pode TOMAR o turno:
  │      rotina_ver     && pedidoExplicito   ou pedeRotinaDeUmDia(texto)
  │      rotina_editar  && pedidoExplicito   && atoSobreArtefato == "editar"
  │      rotina_criar   && pedidoExplicito   ─┐
  │      organizacao    && pedidoExplicito   ─┼→ conduzirRotina
  │      rotinaConversa (posse do turno)     ─┘   retorna tratada:true
  │                                                ANTES da ponte do Plano
  │
  ├─ CONVERSA COMUM → responderExperimental
  │      ├─ resolverDocumento("core")            ← Core v11
  │      ├─ resolverDocumento("trial")           ← se !semJornada
  │      ├─ recuperarBoasPraticas → blocoBoasPraticas
  │      ├─ carregarPerfilConsultavel   ← SÓ se pilotoQuatroA  (§2)
  │      └─ secoesDe (base2)            ← SÓ se pilotoQuatroA  (§2)
  │
  ├─ enviarEPersistir → tipo decide a posse do próximo turno:
  │      rotina_proposta · rotina_pronta · rotina_conversa · resposta_registro
  │      ⚠️ registroDeEnvio APAGA metadataMensagem (corrigido só em branch)
  │
  └─ se resp.enviada E tipo = resposta_registro:
         ponteDePlano → montarPonteWhatsApp
           cooldown 3 min · dedup 20 h · ≥3 inbounds
           avaliarProntidaoParaPlano (LLM) → gera Plano + PDF + link
```

**Caminhos capazes de sequestrar o turno:** as cinco portas de artefato, a
clarificação de criança, o bloqueio por `desativada`, o gate de segurança
(`seguranca.aberta`), o paywall e a ponte do Plano.

---

## 4 · O QUE A AYLA TEM MAS NÃO USA

A tabela mais importante deste documento.

| Recurso | Onde está | Por que não é usado | O que custaria ligar |
|---|---|---|---|
| **Documento de Cartões Visuais** | `ayla_documentos` (`arquivado`) + `docs/documentos-ayla/cartoes-visuais-v1.md` (**fora do git**) | **não há consumidor no runtime**; só `core` e `trial` são resolvidos | um `resolverDocumento("cartoes_visuais")` injetado quando a porta de rotina abre |
| **Documento do Plano** | `ayla_documentos` (`arquivado`) | idem | idem, no caminho do Plano |
| **Material da pós** | `docs/documentos-ayla/material-pos-v1-ORIGINAL.md`, 20.695 caracteres, **fora do git** | nunca importado; **sem loader, sem chunk, sem embedding** | ver §7 — e PEND-104 bloqueia por conflito clínico |
| **`necessidade_conhecimento`** | `decisao-do-turno.ts:41` | o decisor já classifica `base2` / `pos_neurodesenvolvimento` / `combinacao`, e **nada consome**. Documentado: *"apenas SINALIZAM"* | ligar o sinal a um recuperador |
| **Perfil consultável** | `lib/kolo-vivo/consultar.ts` | atrás de `pilotoQuatroA` — **estado desconhecido** (§2) | uma variável de ambiente |
| **base2 / `secoesDe`** | `lib/conducao/base2.ts` | idem | idem |
| **Correção de metadata** | branch `fix/metadata-nao-sobrescreve` (`94e2e6d`) | **não publicada** | merge + deploy |
| **7 skills do acervo** | banco, `ativo=false` | decisão antiga de curadoria | revisão da Karina |
| **Feedback da Rotina na página** | não existe; `rotina-feedback.ts` só classifica fala do WhatsApp | D-R5 desbloqueou em 08/08, nunca construído | frente de app |

---

## 5 · A pós hoje — resposta objetiva

> **Quando a Karina escreve "ele grita quando desligo o tablet", algum conteúdo
> da pós entra no raciocínio da Ayla?**

**NÃO.**

- O arquivo existe (`material-pos-v1-ORIGINAL.md`) e **não está no git**.
- **Nenhum loader** o lê. Varredura por `pos_neurodesenvolvimento` no código
  encontra **só** o enum de `decisao-do-turno.ts` e seu teste.
- **Não há** chunking, embeddings, pgvector, vector store ou busca semântica
  para esse material.
- O decisor **classifica** `necessidade_conhecimento: "pos_neurodesenvolvimento"`
  e o próprio código diz que isso **apenas sinaliza**.

**Veredito: BASE EXISTE / NÃO CONECTADA AO RUNTIME.**

O que entra hoje nesse turno é: Core v11 · Trial v5 (se aplicável) · BPs
recuperadas por skill · e, **se e somente se** a flag do piloto 4A estiver
ligada, Perfil consultável e base2.

---

## 6 · Artefatos reais

| | **Rotina Visual** | **Plano Estratégico** |
|---|---|---|
| Comando | `rotina_criar`/`organizacao` + `pedidoExplicito`, ou posse do turno | `ponteDePlano` após resposta comum |
| Documento de produto | v1 `arquivado`; **V2 escrita, não ativa** | v1 `arquivado` |
| Documento chega ao runtime? | **não** | **não** |
| Serviço | `rotina-servico.ts` → `interpretarRotina` | `ponte.ts` → `montarPonteWhatsApp` |
| Persistência | `rotinas` + `rotina_tarefas` | `planos` |
| Estados | `nenhum`/`aguardando`/`gerando`/`pronto`/`erro` | sem máquina de estados |
| Página | `/ludico/rotinas/[id]`, imagens assinadas | `/planos/[id]` + PDF |
| Homologado | **Nível 1 e 2 sim; Nível 3 bloqueado** (sem número de QA) | não |
| Situação real | 88 rotinas · 38 `pronto` · 3 `aguardando` · 2 `erro` | 25/25 recentes **automáticos** |

**Outros artefatos** (meditação, desenho, história, relatório, avatar) existem em
`lib/ludico/` e `lib/historias/` — **não foram mapeados nesta versão**.

---

## 7 · A jornada que queremos — elo a elo

| Elo | Estado | Por quê |
|---|---|---|
| situação real chega | 🟢 | webhook + lote com dono único |
| entender contexto | 🟢 | Core v11 + decisor GPT com `<estado>` |
| consultar a criança | 🟡 | interesses e transições sim; **Perfil consultável NÃO chega ao WhatsApp** (§1-bis) |
| identificar ponto crítico | 🟢 | `prontidao-rotina` distingue os cenários |
| saber o que já foi respondido | 🔴 | histórico são **9 mensagens**; `metadata` era apagada; sem índice de "já perguntei isso" |
| identificar lacuna | 🔴 | **não existe** seleção de lacunas nem matriz de perguntas por habilidade |
| **uma** pergunta realmente útil | 🟡 | o Core manda perguntar uma coisa por vez; não há mecanismo que **prove** que a resposta muda a conduta |
| consultar conhecimento relevante | 🟡 | BPs sim (`experimental.ts:841`); **base2 não chega**; **pós não** |
| orientar de forma personalizada | 🟡 | personaliza por nome/interesses; profundidade clínica limitada ao Compilado |
| oferecer/executar recurso | 🟢 | Rotina e Plano executam de verdade |
| registrar novo aprendizado | 🟡 | `perfil_vivo_membro` é escrito (medido no Mario); **sem carimbo de temporalidade** |
| reutilizar depois | 🟡 | reutiliza — e **reutilizou errado** (caso do barco, corrigido em `cfd500b`) |
| acompanhar evolução | 🔴 | `resultado`/`seguimento` existem nas tabelas; feedback na página não existe |

**Três vermelhos, e os três são o mesmo buraco:** a Ayla não sabe o que já
perguntou, não sabe o que falta saber, e não fecha o ciclo do que aprendeu.
É exatamente a camada que a base da pós deveria alimentar — e que hoje não
existe nem como mecanismo, nem como conteúdo conectado.

---

## 7-bis · `ayla_documentos` — chave por chave

| Chave | No banco | Status | Consumidor no runtime | Influencia a Ayla? |
|---|---|---|---|---|
| `core` | ✅ v1–v11 | **v11 ativo** | `experimental.ts:839` | ✅ **sim, todo turno** |
| `trial` | ✅ v1–v5 | **v5 ativo** | `experimental.ts:864` (se `!semJornada`) | ✅ sim, condicional |
| `plano` | ✅ v1 | `arquivado` | **nenhum** | ❌ **não** |
| `cartoes_visuais` | ✅ v1 | `arquivado` | **nenhum** | ❌ **não** |
| `fontes_confiaveis` | ❌ **sem linha** | — | **nenhum** | ❌ não |

- **Outra leitura direta de `ayla_documentos`?** Sim, mas só no Admin
  (`admin/documentos/actions.ts`, `admin/inteligencia/actions.ts`) e dentro do
  próprio `documentos.ts`. Nenhuma no caminho conversacional.
- **Cache:** de processo, TTL de 60 s (`documentos.ts:87`), e **não cacheia
  falha** de propósito. Em serverless acerta pouco.
- **O Admin dá falsa impressão de ativação?** **Sim.** A tela publica, versiona e
  marca `ativo` para as cinco chaves; três delas não têm consumidor. Publicar
  `cartoes_visuais` ou `plano` cria a sensação de mudança sem mudança nenhuma —
  e o `FALLBACK` do código só tem `core`, então um consumidor futuro que
  pedisse `plano` receberia string vazia em vez de erro.

---

## 7-ter · Outros artefatos

| Artefato | Existe | Documento | Consumidor do doc | Porta no WhatsApp | Página |
|---|---|---|---|---|---|
| **Rotina Visual** | ✅ `lib/ludico/rotina-servico.ts` | v1 arquivado / **V2 escrita** | ❌ | ✅ 5 portas | ✅ |
| **Plano** | ✅ `lib/ia/plano.ts` | v1 arquivado | ❌ | ✅ `ponteDePlano` | ✅ |
| **História** | ✅ `lib/historias/gerar.ts` | ❌ | — | ⚠️ 1 referência, **não medida** | ✅ |
| **Meditação** | ✅ `lib/ludico/meditacao.ts` + `api/ludico/meditacao` | ❌ | — | ❌ **zero** referências no orquestrador | ✅ app |
| **Desenho** | ✅ `lib/ludico/desenho.ts` + `api/ludico/desenhos` | ❌ | — | ⚠️ 1 referência, não medida | ✅ app |
| **Relatório** | ✅ `lib/relatorio/` | ❌ | — | ⚠️ 1 referência, não medida | ✅ app |
| **Avatar** | ✅ `avatares_membros_atipicos` | ❌ | — | ⚠️ 1 referência, não medida | ✅ app |
| **Timer** | ✅ `app/(app)/ludico/timer` | ❌ | — | ❌ | ✅ app |

**O padrão de `cartoes_visuais` e `plano` se repete e é pior:** dos oito
artefatos, **nenhum** tem documento de produto que o runtime carregue. Seis não
têm documento nenhum. **Meditação não é alcançável pela Ayla** — existe só no
app.

---

## 8 · O que este mapa NÃO prova

1. **`KOLO_PILOTO_4A` em produção** — a incógnita da §2. Decide dois elos.
2. **Traçado dos seis casos** (A a F) — não terminei; exige leitura linha a linha
   por caso.
3. **Inventário de modelos** — sei que há chamadas em `decidirTurno`,
   `responderExperimental`, `conduzirRotina`, `interpretarRotina`,
   `avaliarProntidaoParaPlano`, `gerarRoteiroRotina`, `ilustrarCards` e no juiz
   da bancada; **não montei a tabela modelo × input × custo**.
4. **Artefatos além de Rotina e Plano.**
5. **Condição exata de `semJornada`** que desliga o documento de Trial.

---

## 9 · Pendências que este mapa toca

- **PEND-104** — material da pós localizado, em auditoria, **não ativo**; há
  conflito clínico documentado (contato visual) que impede importar como está.
- **PEND-106** — rastro do conhecimento não cobria o WhatsApp desde 17/08.
  **CONFIRMADA.** Os 330 rastros com `canal:"whatsapp"` são todos de 09/08 a
  22/08 e param ali: o bloco que os emite ficou inalcançável quando o caminho
  novo assumiu. Eu havia escrito o contrário na primeira versão — ver §1-bis.
- **PEND-169 / PEND-170 / PEND-171** — Plano automático, repetição entre turnos,
  rotina órfã da Manu.
- **`whatsapp_e164` sem UNIQUE** — 1 duplicado medido em 07/09; deixou de ser
  teórico.
