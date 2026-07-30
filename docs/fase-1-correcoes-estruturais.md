# Fase 1 — Correções estruturais: relatório do que foi alterado

**Data:** 30/07/2026 · **Escopo:** só infraestrutura. Nenhuma funcionalidade nova, nenhuma mudança na
personalidade da Ayla, nenhuma mudança no fluxo da conversa.

**Verificação:** `npx tsc --noEmit` limpo · `npm run build` compila · **63 testes passam** (9 novos)
· ESLint sem erros nos arquivos tocados.

**Não commitado** — está no working tree para revisão.

---

## O princípio que guiou tudo

Nenhuma das três auditorias apontou falta de dado ou de conteúdo. Todas apontaram a mesma coisa por
ângulos diferentes: **o que já existe no banco não chega ao prompt.** Esta fase não acrescenta nada
— faz a Ayla enxergar o que ela já tinha.

---

## 1. Os seis domínios que não chegavam ao prompt ✅

**Problema:** `carregarKoloVivoResumo` tinha duas listas hardcoded — 5 top-level + 9 extras = **14
dos 20 domínios**. Ficavam invisíveis `aprendizado`, `escola`, `saude_geral`, `imitacao`,
`tela_midia` e `gostos`. E `carregarLacunasKoloVivo`, que varre os 20, injetava no prompt *"JÁ TEM no
perfil: Aprendizado, Escola…"* com a ordem de não re-perguntar. A Ayla era informada de que sabia o
que não podia ver: não sabia e não perguntava.

**O que mudou:** a função virou uma linha, apoiada no leitor compartilhado. Um domínio novo entra em
`lib/kolo-vivo/campos.ts` e passa a valer nos dois canais de uma vez.

- `lib/ayla/orchestrator.ts` — `carregarKoloVivoResumo` reescrita (de ~45 linhas para 1 chamada)
- `lib/kolo-vivo/leitura.ts` — **novo**: `lerSecoesMembro`, `resumoRotulado`, `textoDoCampo`
- `lib/kolo-vivo/leitura.test.ts` — **novo**: um teste itera `MEMBRO_CAMPOS_TODOS` e falha se
  qualquer domínio voltar a sumir

## 2. Leitura de perfil unificada entre canais ✅

**Problema:** cada canal tinha a sua lista, e as duas estavam erradas de formas diferentes. O
WhatsApp lia 14 de 20. A web lia 19 (faltava `gostos`) **e ainda filtrava pelos `kolo_vivo_fields`
das skills roteadas** — o perfil que a Kolo via *mudava conforme o sorteio do roteador*.

**O que mudou:** um leitor só, sem filtro por skill.

- `lib/ia/context.ts` — `filterMembroSections` e `resolveSecaoMembro` removidas; `secoes` agora vem
  de `lerSecoesMembro`. As listas `KOLO_VIVO_FIELDS_MEMBRO_*` foram apagadas
- `secoes` mudou de tipo: `Partial<Record<KoloVivoFieldMembro, string>>` → `Record<string, string>`
- O parâmetro `skills` continua na assinatura de `buildContext` (quem monta o prompt usa as skills
  como lentes de especialista) mas **não filtra mais nada**

## 3. A web aprende automaticamente, como o WhatsApp ✅

**Problema:** a rota de streaming gravava a mensagem e **nada mais** — sem extração de fatos, sem
linha do tempo, sem marcos. O único caminho de escrita era o botão "Guardar no Perfil", que a pessoa
precisa lembrar de apertar. No WhatsApp a incorporação é automática desde maio. Uma Ayla aprendia, a
outra não.

**O que mudou:**

- `lib/kolo-vivo/aplicar.ts` — **novo**: a escrita no perfil saiu de dentro da server action e virou
  módulo compartilhado (`aplicarPropostaNoPerfil`, `aplicarTextoCampo`, `appendFato`,
  `registrarDiarioAutomatico`). **A lógica de merge não mudou** — é a mesma que estava em produção
- `lib/ia/aprender.ts` — **novo**: `aprenderDaConversa` extrai, aplica, consolida o diário e
  alimenta a linha do tempo
- `app/api/conversar/stream/route.ts` — chama em `after()`, depois de a resposta já ter chegado
- `app/(app)/conversar/actions.ts` — o botão passou a usar o **mesmo** aplicador; ~90 linhas de
  lógica duplicada removidas

Três decisões de contenção que vale registrar:

- **Freio de custo:** só roda se a última fala tiver ≥ 25 caracteres. "ok" e "obrigada" não
  disparam uma chamada de IA.
- **Sem diário duplicado:** consolida uma linha por criança por dia em vez de inserir por turno —
  senão uma conversa de dez mensagens viraria dez diários do mesmo episódio.
- **Sem escrita dupla:** a "REGRA DE NOVIDADE" do extrator (não propor o que já está registrado) é o
  que impede o botão e o automático de gravarem a mesma coisa.

⚠️ **Um bug que quase entrou:** eu tinha usado `origem='app_auto'` para separar o diário automático
do manual. `diarios.origem` tem `CHECK in ('app','ayla')` desde a migração 0001 — o insert falharia,
e como o erro não era checado, **falharia em silêncio**. Corrigido para `'app'` (que consolida com o
diário do botão, o que é o comportamento certo) e os erros de insert/update agora são logados.
Separar os dois exigiria migração.

## 4. Eventos e experimentos no contexto da conversa ✅

**Problema:** as duas únicas memórias com **data** eram write-only para a conversa. `eventos_membro`
(férias, troca de professora, medicação, marcos) só era lida pelo relatório;
`preferencias.experimentos` (o que já foi tentado, com resultado e data) só pelo cron semanal de
repertório. O sistema sabia que as férias foram em janeiro e não conseguia usar isso — e recomendava
o que já tinha sido tentado e não funcionou.

**O que mudou:** ambas entram no prompt dos **dois** canais, com a data visível.

- `lib/kolo-vivo/leitura.ts` — `carregarEventosRecentes` (120 dias, até 12), `carregarExperimentos`
  (últimos 15), e os formatadores `blocoEventos` / `blocoExperimentos`
- `lib/ayla/responder.ts` — dois campos novos em `RespostaParams`, dois blocos novos no prompt
- `lib/ia/context.ts` + `lib/ia/prompt.ts` — os mesmos blocos na web

O bloco de eventos leva uma instrução curta e factual: evento datado **já aconteceu**, serve para
entender a história, não para ser tratado como presente. É a contenção mínima contra "Copa" e
"viagem antiga" — a solução real é o perfil datado, que é fase posterior.

## 5. Informação filtrada por criança ✅

**Problema:** `carregarHistorico` filtrava só por `family_account_id`. Numa família com dois filhos,
os 6 últimos turnos podiam ser sobre o outro — o vetor mais provável de "informação da outra criança
aparecendo na resposta".

**O que mudou:** `lib/ayla/orchestrator.ts` — a consulta ganhou
`membro_atipico_id.eq.<foco> OR membro_atipico_id.is.null`.

O `is.null` é deliberado: as linhas antigas e as que o parser não soube atribuir continuam entrando.
Cortá-las deixaria a Ayla amnésica — o problema era misturar irmãos, não ter histórico.

## 6. Skills desligadas — **não ativei, e explico** ⚠️

O item dizia "ativar as skills que estão desligadas, **quando apropriado**". Não é apropriado, por
duas razões:

1. Segundo [cowork-frente-1-skills.md:24-34](cowork-frente-1-skills.md#L24-L34), as 7 skills em
   rascunho são *"esqueleto criado, sem conteúdo real… placeholders"*. Ativá-las **injetaria
   placeholder no prompt da web** — que é exatamente alterar a personalidade da Ayla, o que esta
   fase proíbe. É trabalho de curadoria da Karina, não de código.
2. Não tenho acesso a produção para rodar o `UPDATE`, e o estado é de 17/05 (precisa conferência).

**O que fiz em vez disso — que resolve o problema real:** desacoplei a recuperação de boas práticas
do estado da skill. O objetivo do item era destravar os ~204 BPs (55% do acervo) presos às skills
inativas. Agora eles são alcançáveis **sem** ativar skill nenhuma. Ver item 7.

## 7. Boas práticas no WhatsApp ✅ (e recuperação consertada na web)

**Problema:** 368 boas práticas curadas à mão, e **o WhatsApp não lia nenhuma** — `RespostaParams`
não tinha o campo. Só a web carregava, e do pior jeito possível: as 20 de maior `peso_relevancia` →
filtro por interseção com as skills roteadas → as 3 primeiras. O filtro por skill descartava tudo o
que está pendurado nas 7 skills em rascunho, e "as de maior peso" é quase aleatório num acervo de 368.

**O que mudou:**

- `lib/conhecimento/boas-praticas.ts` — **novo**: `selecionarBoasPraticas`, fonte única dos dois
  canais. Pontua por sobreposição de termos entre o que a família escreveu e as tags/título da BP;
  respeita `faixa_etaria_min/max` e `perfis_aplicaveis` declarados na própria BP; o
  `peso_relevancia` entra como **desempate**, não como critério
- `lib/ayla/orchestrator.ts` + `responder.ts` — o WhatsApp passa a receber até 5 BPs por turno
- `lib/ia/context.ts` — a web usa o mesmo seletor (5 em vez de 3), sem filtro por skill

A seleção é **determinística de propósito**: nenhuma chamada de IA a mais no caminho da resposta (o
canal já é lento) e nenhum custo por mensagem. Não é busca semântica — essa é a evolução seguinte e
está anotada no laudo da base de conhecimento.

## 8. Divergências entre canais — o que fiz e o que deixei ⚠️

**Removidas (são divergências de informação):**

| Divergência | Antes | Agora |
|---|---|---|
| Domínios do perfil visíveis | 14 (WA) × 19 filtrados por skill (web) | **20, iguais** |
| Leitura do perfil | duas implementações | `lerSecoesMembro`, uma |
| Extração de texto do jsonb | `resumoCampoKV` (WA) × `extractTextoFrom` (web) | `textoDoCampo`, uma |
| Boas práticas | zero (WA) × 3 por peso+skill (web) | mesmo seletor, até 5, nos dois |
| Linha do tempo no prompt | nenhum canal | **os dois** |
| Estratégias tentadas no prompt | nenhum canal | **os dois** |
| Aprendizado automático | só WA | **os dois** |
| Escrita no perfil | duas implementações | `aplicarPropostaNoPerfil`, uma |
| Linha do tempo alimentada | só WA | **os dois** |

**Deixadas de fora, deliberadamente — são divergências de VOZ:**

- `VOZ_E_LIMITES` ([prompt.ts:39-60](../apps/web/src/lib/ia/prompt.ts#L39-L60)): bloco de voz que só
  existe na web, anterior ao Core, que repete o que o Core já diz e define um tom próprio ("amiga
  experiente, não terapeuta" × "consultora estratégica" do Core).
- `blocoIntencao("desabafo")` ([prompt.ts:78-82](../apps/web/src/lib/ia/prompt.ts#L78-L82)): manda
  *"não force uma ideia prática"*, o oposto de "sofrimento não anula pedido" — a regra que
  implementamos hoje no decisor do WhatsApp.
- `blocoIntencao("desafio")`: tem um critério de entrega próprio, em prosa, independente do decisor
  por pontuação.
- As **duas taxonomias de intenção** (crise/desabafo/dúvida/desafio × rotina_*/plano/outro).
- O `tone` por skill vindo do banco, que só a web usa.

Mexer em qualquer uma **altera como a Ayla fala e quando ela entrega** — que é precisamente o que a
Fase 1 proíbe. São Fase 2, e a mais urgente é o `blocoIntencao("desabafo")`: hoje, a mesma frase
("estou achando que ela não aprende nada, queria trabalhar isso") sai com direção no WhatsApp e
só acolhida na web.

---

## Arquivos

**Novos (5):**

| Arquivo | Responsabilidade |
|---|---|
| `lib/kolo-vivo/leitura.ts` | Leitura do perfil (20 domínios), eventos datados e experimentos — fonte única |
| `lib/kolo-vivo/leitura.test.ts` | 9 testes que travam os 20 domínios e os blocos de memória datada |
| `lib/kolo-vivo/aplicar.ts` | Escrita no perfil + diário consolidado — fonte única |
| `lib/conhecimento/boas-praticas.ts` | Recuperação de BPs por assunto — fonte única |
| `lib/ia/aprender.ts` | Aprendizado automático da web (paridade com o WhatsApp) |

**Modificados (6):**

| Arquivo | O que mudou |
|---|---|
| `lib/ayla/orchestrator.ts` | `carregarKoloVivoResumo` usa o leitor único; histórico filtra por criança; carrega eventos, experimentos e BPs; `resumoCampoKV` removida |
| `lib/ayla/responder.ts` | 3 campos novos em `RespostaParams` + 3 blocos no prompt |
| `lib/ia/context.ts` | Perfil sem filtro por skill; eventos e experimentos; BPs pelo seletor único; ~70 linhas de listas e helpers removidas |
| `lib/ia/prompt.ts` | Blocos de linha do tempo e de estratégias tentadas |
| `lib/ia/engine.ts` | `userInput` passa para `buildContext` (necessário pra escolher BP por assunto) |
| `app/(app)/conversar/actions.ts` | Botão usa o aplicador compartilhado; ~90 linhas duplicadas removidas |
| `app/api/conversar/stream/route.ts` | Chama o aprendizado automático em `after()` |

---

## Impacto esperado e o que observar

**Prompt maior nos dois canais.** Entram até 6 domínios de perfil a mais, até 12 eventos, até 15
experimentos e até 5 boas práticas. No WhatsApp o `max_tokens` da resposta segue 900 — o que cresce é
a entrada, que é a parte barata e cacheada. Vale medir o custo por mensagem em `/admin/uso-api` nos
primeiros dias.

**Uma chamada de IA nova por turno na web** (o extrator do aprendizado automático, Sonnet, 800
tokens de saída), em `after()`. Se o custo incomodar, o ajuste natural é rodar a cada dois turnos em
vez de todos — está isolado numa constante.

**Uma ida a mais ao banco** por resposta na web (as BPs, que dependem da idade lida no lote anterior).

**O que observar nos logs:** `[web:aprender]` (itens gravados por conversa) e
`[kolo-vivo:diario-auto]` (se aparecer, é falha de escrita no diário).

## Ainda pendente de produção

Independente desta fase, e continua valendo: **a migração 0070 não foi confirmada em produção**. Sem
ela o controle de turno degrada para uma Ayla por mensagem, e qualquer medição de qualidade de
resposta fica contaminada. Prompt pronto em [aplicar-0070-controle-turno.md](aplicar-0070-controle-turno.md).
