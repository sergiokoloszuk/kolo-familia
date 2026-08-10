# Auditoria vertical do Plano Kolo — 2026-08-10

Missão **INVESTIGAR**. Nenhum código, prompt, banco ou migração alterado.
Nenhum commit, nenhum deploy.

Commit da árvore auditada: `cdc4373` (main), com o working tree carregando a
frente de formatação (não commitada, não relacionada).

**Régua de evidência usada em todo o documento:**

| Marca | Significa |
|---|---|
| **VI NO CÓDIGO** | li o corpo da função e o caminho de chamada |
| **PROVEI POR EXECUÇÃO** | rodei o caminho real e observei a saída |
| **MEDI** | número contado, com a fonte dita |
| **INFERI** | dedução a partir do que vi, sem prova direta |
| **NÃO SEI** | não foi verificado |

---

## Resumo executivo

**PLANO HOJE É: parcialmente personalizado.** A personalização que existe vem
quase inteira do bloco de Kolo Vivo e da capacidade do modelo — não de
mecanismo. **PROVEI POR EXECUÇÃO** (bancada abaixo): com três perfis fictícios
e o mesmo objetivo, as três saídas foram genuinamente diferentes — carrinhos
para o Téo, quadrinhos e palavra-código para o Bento, cartão de imagem, água e
tecido para a Lia. Não é o mesmo plano com troca de nome.

**O PLANO LÊ O PERFIL? Parcial.** Lê o `<membro_atipico>` do `buildContextBlock`
— nome, idade, gênero, `perfil`, `diagnosticoRegistrado` e as seções do Kolo
Vivo **filtradas pelos `kolo_vivo_fields` da skill roteada**. **NÃO** lê o
`perfilConsultavel` da Fase 4A (campo a campo, com estado `preenchido` /
`negativo` / `vazio`). **VI NO CÓDIGO.**

**O PLANO LÊ BASE 2? NÃO.** `PLANO NÃO USA A CAMADA DE COMPREENSÃO TEMÁTICA.`
Zero referência a `base2` em qualquer caminho do Plano. **VI NO CÓDIGO** —
`ctx.base2` só é preenchido quando `pilotoEstrategiasLigado() && relato`, e
nenhum caminho do Plano passa `relato`.

**O PLANO LÊ BOAS PRÁTICAS? Sim, mas pelo mecanismo ANTIGO.** Top-3 por
`peso_relevancia`, filtradas por `skills_relacionadas`/`tags` e faixa etária.
**Sem ranking por aderência, sem `statusAceitos`, sem limite de 2, sem
`ANCORA_PERFIL`, sem `LICENCA_GENERATIVA`.** **VI NO CÓDIGO.**

**O PLANO LÊ HISTÓRICO? Parcial, e de formas diferentes por canal.**
Na Web, o `desafio` é a concatenação de **todas as mensagens do papel `user`**
da conversa (1.800 caracteres). No WhatsApp, é a conversa dos **dois lados** dos
últimos 45 minutos, filtrada por membro. Dentro da geração, `conversaId: null`
em todos os caminhos — o `ctx.historico` do Plano é sempre vazio. **VI NO CÓDIGO.**

**O PLANO SABE O QUE JÁ FUNCIONOU / NÃO FUNCIONOU? NÃO — e este é o achado mais
caro do documento.** A função existe (`carregarAprendizado`), lê `planos.resultado`
e `resultado_nota`, e monta um bloco `<o_que_ja_funcionou>`. A instrução
correspondente existe (`SISTEMA_APRENDIZADO`). **As duas só são alcançadas por
`gerarSecoesPlano`, o gerador single-call — que hoje só roda para
`variante = "fim_de_semana"`.** Todo plano normal, nos dois canais, passa por
`gerarSecoesPlanoMultiCall`, que **não chama `carregarAprendizado` e não carrega
`SISTEMA_APRENDIZADO`**. **VI NO CÓDIGO** (`plano.ts:161` é o único chamador;
`plano.ts:244-247` faz o desvio).

**O PLANO USA O OBJETIVO ESPECÍFICO DA CONVERSA? Parcial, e pior na Web.**
No WhatsApp o `desafio` diz explicitamente qual é o pedido de agora e o que é
só contexto. Na Web o `desafio` é o despejo das falas da mãe, **sem as falas da
Ayla** — ou seja, sem a frase em que o objetivo específico foi nomeado. Se a
conversa concluiu "o problema é pedir ajuda" pela boca da Ayla, essa conclusão
**não entra no Plano**. **VI NO CÓDIGO.**

**CRENÇA É OBRIGATÓRIA? NÃO.** É uma das cinco de `SECOES_SEMPRE`, e o guard é
**contagem** (`MINIMO_PRATICAS = 3`), não lista fixa — com um comentário datado
dizendo exatamente por quê. `validarPlano` exige `entender` e `observar`
(estruturais) e **duas** seções de conteúdo com ≥200 caracteres. **VI NO CÓDIGO.**

**O PLANO CONSEGUE ACOMPANHAR E AJUSTAR? Parcial.** Ajuste existe (Web).
Seguimento existe (WhatsApp, cron, uma vez por plano). Feedback existe
(4 valores + nota). **Mas a Ayla conversando não sabe que o plano existe** — não
há bloco de planos anteriores em nenhum prompt de conversa, nos dois canais.

**WEB × WHATSAPP:** o Plano é a coisa mais simétrica do produto — os dois canais
convergem no mesmo `gerarSecoesPlanoMultiCall`. As diferenças estão **na
entrada** (como o `desafio` é montado) e **na saída** (PDF/WhatsApp × tela/Web).

---

## 1 · Mapa do pipeline

### Caminhos de criação

| # | Origem | Entrada | Gerador | Variante |
|---|---|---|---|---|
| 1 | Web · botão "Montar plano" na conversa | `conversar/actions.ts` | `gerarSecoesPlanoMultiCall` | padrão |
| 2 | Web · "ajustar plano" | `planos/actions.ts` | `gerarSecoesPlanoMultiCall` | padrão |
| 3 | Admin · replay de plano incompleto | `admin/planos-incompletos/actions.ts` | `gerarSecoesPlanoMultiCall` | padrão |
| 4 | WhatsApp · ponte | `ayla/ponte.ts` → `gerarPlano` | `gerarSecoesPlanoMultiCall` | padrão |
| 5 | WhatsApp · fim de semana | `gerarPlano({variante:"fim_de_semana"})` | `gerarSecoesPlano` (single-call) | fim de semana |

**Só o caminho 5 é single-call.** Ele é o único que recebe
`<o_que_ja_funcionou>` e `SISTEMA_APRENDIZADO`. **VI NO CÓDIGO.**

### Como o `desafio` nasce

- **Web (1 e 2):** `SELECT papel, conteudo FROM mensagens_skill WHERE conversa_id`
  → filtra `papel === "user"` → junta com `\n` → corta em 1.800 caracteres.
  Fallback: `"Sobre o tema desta conversa."`
- **WhatsApp (4):** `desafioDaConversa` — últimas 10 mensagens de 45 minutos,
  **dos dois lados**, filtradas por `semOutrosMembros` (isolamento entre irmãos),
  embrulhadas num texto que diz qual é o pedido de agora e que o resto é contexto.

### O que roda dentro do multi-call

1. `analisarDesafio` (Haiku) → título + decide se entram `historia_social` e `rotina`.
2. 5 seções sempre (`crencas`, `diferente`, `brincadeiras`, `atividades`, `frases`)
   + as condicionais → cada uma é **uma chamada `respondAsOutputType`**, em lotes
   de 3, com até 3 tentativas.
3. `gerarEntenderObservar` (Sonnet, 1 chamada) em paralelo.
4. Guard: `praticas.length >= 3`, senão `PlanoIncompletoError` e **nada é gravado**.
5. `escolherTitulo` → `validarPlano` → `INSERT`/`UPDATE` em `planos`.

### O que cada seção recebe, de fato

`respondAsOutputType` → `buildContext(…, conversaId: null)` (**sem `relato`**) →
`callClaude` → `assemblePrompt({modo: output_type})`:

- **system:** `buildSystemTextOutputType` = identidade curta +
  `buildIdentityBlock(skills)` + `VOZ_LIMITES_E_FRONTEIRA` +
  `outputType.prompt_template` + teto de 400 palavras.
  **Sem `nucleoConducao()`.** **Sem `blocoIntencao`.** **Sem `formasDeEntrega`.**
- **user:** `buildContextBlock(ctx)` + `<pedido_da_mae>{desafio}</pedido_da_mae>`.
- **modelo:** `MODELS.principal`, `max_tokens: 2048`, `thinking: 1024`.

**VI NO CÓDIGO** e **PROVEI POR EXECUÇÃO** (a bancada monta exatamente este par).

⚠️ **Cada seção do plano é uma conversa independente.** Sete chamadas que não se
enxergam, cada uma pedindo "não repita entre seções" — instrução que só existe no
system **single-call**, e que no multi-call **não existe em lugar nenhum**.
A regra de não repetir foi perdida junto com o gerador que a carregava. **VI NO CÓDIGO.**

### Persistência e apresentação

Tabela `planos`: `titulo`, `tema`, `secoes` (jsonb), `origem`, `conversa_id`,
`membro_atipico_id`, `resultado`, `resultado_nota`, `resultado_em`,
`seguimento_enviado_em`.
Web: `/planos`, `/planos/[id]` com poller enquanto `secoes = []`.
WhatsApp: PDF via `planoParaPdf` + link de acesso; envio registrado em
`ayla_send_log` com `template_key = 'plano_pdf'`.

---

## 2 · Perfil da criança — o que chega ao modelo

Fonte única do que o Plano vê: `buildContextBlock(ctx)`.

| Informação | Existe | Plano consulta | Chega ao modelo | Formato |
|---|---|---|---|---|
| nome, idade, gênero | sim | sim | **sim** | `<membro_atipico>` + `<familia_membros>`, com "idade EXATA, nunca chute" |
| diagnóstico/laudo | sim | sim | **sim** | `blocoDiagnosticoRegistrado` — separa confirmado × em investigação |
| `perfil` (enum) | sim | sim | **sim** | linha `perfil:` |
| comunicação, socialização, autonomia, aprendizado, foco, sono, nutricional, escola, emocional, rotina, motor, imitação, tela/mídia, saúde | sim (`categorias_extras`) | **só os campos da skill roteada** | parcial | `k: v` dentro de `<membro_atipico>` |
| sensorial, `como_e`, `corpo_rotina`, `desafios_regulacao`, `essencial` | sim (top-level) | idem | parcial | idem |
| irmãos / composição familiar | sim | sim | **sim** | `<contexto_familia>` |
| terapias, estratégias ativas, apoio comunitário, marcos | sim (`perfil_vivo_familia.categorias_extras`) | sim | **sim** | `<contexto_familia>` |
| diário recente (7 dias, 5 entradas) | sim | sim | **sim** | `<diario_recente>` |
| último check-in | sim | sim | **sim** | `<ultimo_checkin>` |
| **negativos explícitos ("não gosta de…")** | sim, se a família contou | **só se estiverem escritos no texto do campo** | parcial | prosa |
| **`perfilConsultavel` (campo a campo, com estado `negativo`)** | sim (Fase 1) | **NÃO** | **NÃO** | — |
| **`ANCORA_PERFIL` (precedência perfil > BP genérica)** | sim (`composicao.ts`) | **NÃO** | **NÃO** | — |
| **`LICENCA_GENERATIVA`** | sim | **NÃO** | **NÃO** | — |

**O filtro por skill é a limitação estrutural.** `camposMembroAcionados` é a
união dos `kolo_vivo_fields` das skills roteadas + `essencial`. Um plano roteado
para "comunicação" **não vê** sono, alimentação nem sensorial, mesmo que estejam
preenchidos. **VI NO CÓDIGO** (`context.ts:152-161`, `filterMembroSections`).
**NÃO SEI** quantos campos isso corta em média — exigiria varrer perfis reais.

### Pergunta decisiva: o Plano tem algo equivalente à `ANCORA_PERFIL`?

**Não. VI NO CÓDIGO.** `ANCORA_PERFIL` é importada **só** por `lib/ia/prompt.ts`
e usada **só** dentro do `if (ctx.perfilConsultavel)`, que no Plano é sempre
`null`.

O que faz o papel dela hoje, mais fraco e por outra via:

- `"Use os dados REAIS do Perfil e do contexto — personalize de verdade, não
  invente"` — **existe só no system single-call** (fim de semana).
- `RECEITA_ENTENDER` diz "ancore nos dados REAIS do Perfil" — vale só para a
  seção `entender`.
- Nas cinco seções práticas do multi-call, **não há nenhuma instrução de
  precedência**. O que segura é o `prompt_template` do botão dizer "alinhadas ao
  perfil".

---

## 3 · Memória e histórico

| O Plano sabe… | Resposta | Evidência |
|---|---|---|
| o que a família contou nesta conversa | **sim**, via `desafio` | VI NO CÓDIGO |
| o que a Ayla concluiu nesta conversa | **Web: NÃO** (só `papel = user`) · **WhatsApp: sim** | VI NO CÓDIGO |
| conversas anteriores | **não** (`conversaId: null`, `ctx.historico` vazio) | VI NO CÓDIGO |
| diário dos últimos 7 dias | sim | VI NO CÓDIGO |
| planos anteriores | **não** | VI NO CÓDIGO |
| objetivos anteriores | **não** | VI NO CÓDIGO |
| feedback da família sobre planos | **não** (só fim de semana) | VI NO CÓDIGO |
| **o que já funcionou / não funcionou** | **NÃO** em plano normal | VI NO CÓDIGO |
| evolução observada | parcial (só o diário de 7 dias) | VI NO CÓDIGO |

> **O Plano pode evitar sugerir de novo algo que a mãe já disse que não funcionou?**
> **Não.** O mecanismo foi construído, testado e ficou pendurado no gerador que
> deixou de ser usado para planos normais. É exatamente a classe "função existe,
> execução não acontece" que esta auditoria foi montada para pegar.

---

## 4 · BASE 2 — skills temáticas

**PLANO NÃO USA A CAMADA DE COMPREENSÃO TEMÁTICA.**

- `docs/skills/*.md` → `BASE2` (`lib/conducao/base2-conteudo.ts`, 255 seções, 12 temas).
- Consumidor único: `context.ts:371-374`, sob `piloto && skillsNomes[0] && temMaterial`.
- `piloto = pilotoEstrategiasLigado() && Boolean(relato?.trim())`.
- **Nenhum caminho do Plano passa `relato`** — `gerarSecoesPlano` e
  `gerarEntenderObservar` chamam `buildContext` sem ele; `respondAsOutputType`
  também. **VI NO CÓDIGO.**
- Logo: `ctx.base2 = []` sempre, e o bloco `<como_compreender_este_tema>` nunca é
  montado. **Duas barreiras independentes** (flag desligada **e** ausência de
  `relato`) — ligar a flag sozinha não mudaria nada no Plano.

O que o Plano usa no lugar: `buildIdentityBlock(skills)` — as colunas
`objective/tone/scope/limits` da tabela `skills`, que é a lente, não o mapa de
diferenciação.

---

## 5 · BASE 3 — boas práticas

**MEDI (leitura pura da produção, 2026-08-10):** 381 registros — 370 `ativo`,
11 `rascunho`.

Caminho no Plano: `buildContext` → `recuperarBoasPraticas({skills, tags, idade})`.

| Mecanismo | Estratégias (piloto) | **Plano** |
|---|---|---|
| filtro por `skills_relacionadas` / `tags` | sim | **sim** |
| filtro por faixa etária | sim | **sim** |
| ordenação por `peso_relevancia` | sim | **sim** |
| **ranking por aderência ao relato** (`ordenarPorAderencia`) | sim | **NÃO** (`relato: undefined`) |
| **`statusAceitos: ["ativo","rascunho"]`** | sim | **NÃO** (só `ativo`) |
| limite | 2 | **3** |
| considera o perfil da criança | via `ANCORA_PERFIL` | **NÃO** |
| considera histórico / feedback | não | **não** |
| considera o objetivo específico do Plano | — | **NÃO** — a seleção usa o **nome da skill**, não o texto do desafio |

**Este é o ponto mais importante da seção 5:** as boas práticas do Plano são
escolhidas **pelo tema, não pelo caso**. Duas famílias com problemas diferentes
dentro de "comunicação" recebem **as mesmas 3 BPs**, na mesma ordem, porque a
ordenação é `peso_relevancia DESC` e o texto do desafio nunca entra na consulta.
**VI NO CÓDIGO**; **INFERI** o efeito prático (não medi contra perfis reais).

⚠️ E há um agravante de arquitetura: **cada seção do plano recupera BPs de novo,
por conta própria** — 7 chamadas a `buildContext`, cada uma com o seu
`recuperarBoasPraticas`. Como o roteador (`routeSkillsAI`, `maxSkills: 1` no
`respondAsOutputType`) recebe o mesmo `desafio`, a tendência é que caia sempre na
mesma skill e recupere as mesmas 3 BPs — o mesmo repertório repetido sete vezes,
com a instrução de não repetir ausente. **INFERI.**

**Rastro:** `montarRastro`/`registrarRastroConhecimento` roda em cada
`buildContext`, então o Plano **deixa** rastro em `eventos_app` do que recuperou.
Como são 7 chamadas por plano, são 7 rastros — e nada os agrupa por plano.
**VI NO CÓDIGO.** **NÃO SEI** se o Admin consegue lê-los assim.

---

## 6 · Outros materiais canônicos

| Material | Existe no repositório/banco | **É consumido pelo Plano** |
|---|---|---|
| `boas_praticas` (381) | sim | **sim** — 3 por seção, por peso |
| `output_types` (7 ativos) | sim | **sim** — é a receita de cada seção |
| `skills` (`buildIdentityBlock`) | sim | **sim** |
| `VOZ_LIMITES_E_FRONTEIRA` (voz + fronteira do diagnóstico) | sim | **sim** |
| `RECEITA_ENTENDER` / `RECEITA_OBSERVAR` | sim | **sim** |
| `docs/skills` / BASE 2 | sim | **não** |
| `nucleoConducao()` (identidade, princípios, piso, tom) | sim | **não** |
| `ANCORA_PERFIL`, `LICENCA_GENERATIVA` | sim | **não** |
| `formasDeEntrega`, `INTERESSE_COMO_VEICULO`, `A_CRIANCA_ANTES_DO_ROTULO` | sim | **não** |
| `angulosUsados` / `blocoProgressao` | sim | **não** (só modo conversa) |
| `lib/ayla/manual/` (15 arquivos) | sim | **não** — nada importa |
| BIA | branch `bia/ciclo-tecnico` | **não** — não está na main |

**MEDI:** as receitas dos botões são minúsculas — `atividades` 112 caracteres,
`crencas` 119, `rotinas` 119, `o_que_fazer_diferente` 137, `frases_prontas` 141,
`brincadeiras` 164. Só `historias_sociais` tem 1.485. **Cinco das sete seções do
Plano são especificadas por uma frase.**

Exemplo verbatim, o de `crencas`:
> "Apresente 2 a 3 crenças/mitos comuns sobre o tema, com contraposição prática
> baseada em observação. Sem afirmar causas."

Note "**sobre o tema**" — não sobre a criança.

---

## 7 · Como o Plano escolhe o que fazer

A resposta é **C + D + E**, e não A.

- **C · categorias fixas:** `ORDEM_SECOES` são 9 tipos fixos; `SECOES_SEMPRE` são
  5 obrigatórias por contagem. A estrutura **não** nasce do caso.
- **D · template obrigatório:** cada seção tem a sua receita de ~120 caracteres,
  igual para toda família.
- **E · o modelo escolhe livremente dentro da seção:** é aqui que mora **toda** a
  personalização observada na bancada.
- **A · adequação ao caso** entra só num ponto: `analisarDesafio` (Haiku) decide
  se `historia_social` e `rotina` entram. Duas decisões booleanas.

### A cadeia pedida, reconstruída — e onde quebra

```
relato da mãe   → chega (Web: só as falas dela; WhatsApp: os dois lados)
+ perfil        → chega parcial (filtrado pelos campos da skill)
+ skill         → chega como lente (buildIdentityBlock), NÃO como BASE 2
+ boas práticas → chegam por TEMA, não por caso — sem ranking de aderência
+ histórico     → NÃO CHEGA (conversaId: null)
+ o que funcionou → NÃO CHEGA (carregarAprendizado fora do caminho)
= ações do Plano
```

**Onde quebra, em ordem de gravidade:**

1. `carregarAprendizado` não é chamado no multi-call.
2. `relato` nunca é passado → sem BASE 2, sem ranking de aderência, sem perfil
   consultável.
3. Web perde as falas da Ayla ao montar o `desafio`.
4. As 7 seções não se enxergam e a regra de não repetir ficou no gerador antigo.

---

## 8 · Estrutura — onde nasce cada obrigatoriedade

| Elemento | Obrigatório? | Onde nasce |
|---|---|---|
| `entender` | **sim** | `validacao-plano.ts` · `SECOES_ESTRUTURAIS` + ≥200 chars |
| `observar` | **sim** | idem |
| `crencas` | **não individualmente** | `plano.ts` · `SECOES_SEMPRE` (tenta) + `MINIMO_PRATICAS = 3` (contagem) |
| `diferente`, `brincadeiras`, `atividades`, `frases` | idem | idem |
| `rotina`, `historia_social` | condicionais | `analisarDesafio` (Haiku) |
| ≥2 seções de conteúdo com ≥200 chars | **sim** | `validacao-plano.ts` · `MINIMO_CONTEUDO` |
| tipo dentro de `PLANO_TIPOS` | **sim** | `normalizarSecao` — tipo desconhecido vira `"entender"` |
| título sem "aguardando/a definir" | **sim** | `escolherTitulo` + `validarPlano` |
| frequência, duração, progresso, próximo passo | **não existem como campo** | só como prosa dentro da seção |

**Resposta direta: crença NÃO é obrigatória.** O guard é contagem, com o motivo
escrito no código: *"exigir uma seção específica recusaria plano bom (4 práticas
ricas sem uma delas continua sendo um plano)"*. Se `crencas` falhar, entra em
`falhas`, gera `logEvent` `plano_secoes_falharam` (severity `warn`, persiste) e o
plano sai com as outras quatro.

**Núcleo estável + módulos opcionais é viável sem reconstruir a arquitetura.**
**INFERI**, com base em: o contrato já é `{tipo, titulo, conteudo_markdown}[]`;
a lista de tipos é uma constante; a obrigatoriedade já é por contagem; e as
condicionais já provam que "entra quando o caso pede" funciona. O que falta não é
arquitetura — é a decisão de quem escolhe os módulos, e com que informação.

---

## 9 · Bancada sintética — personalização real

**PROVEI POR EXECUÇÃO.** `scripts/bancada/plano-auditoria/rodar.mjs`, saída em
`docs/bancada/plano-auditoria-2026-08-10.txt`.

Método: `assemblePrompt` é função pura, então dá para montar o par
system/messages **exato** de uma seção de plano com um `ctx` 100% fictício.
Sem banco, sem INSERT, sem PDF, sem família real. Modelo, `max_tokens` e
`thinking` idênticos a `callClaude`. `output_types` lidos da produção por SELECT.

Três perfis, **mesmo objetivo** (*"Ele não pede ajuda. Quando trava, desiste ou
chora."*) e **as mesmas 2 boas práticas sintéticas** nos três.

| | A · Téo, 5, poucas palavras, carrinhos | B · Bento, 8, verbal, quadrinhos | C · Lia, 6, imagens/gestos, água e tecidos |
|---|---|---|---|
| ação central | criar a dificuldade e modelar "me ajuda" | nomear o pedido mínimo | cartão de imagem "me ajuda" |
| interesse usado | **carrinho na caixa, um carrinho por vez** | **quadrinho com balão vazio; palavra-código de personagem** | **bolha presa, caixa de tecido, transferir água** |
| adaptação ao canal comunicativo | aceita olhar/toque como pedido | frase curta, sem elogio exagerado | "gesto ou imagem já conta como pedido" |
| adaptação sensorial | — | — | nada de som alto; texturas |
| forma | prosa + 2 atividades | 3 blocos com títulos | 3 blocos com emoji + materiais + duração |

**Os três planos são realmente diferentes por causa do perfil.** Não é troca de
nome: a natureza da intervenção muda (modelar gesto × nomear frase × cartão
visual), o material muda e a régua de "o que conta como pedido" muda.

⚠️ **Limite honesto desta prova:** o `ctx` foi montado à mão, com o perfil escrito
de forma limpa e completa. O que ela prova é que **o modelo usa bem o contexto
que recebe**. O que ela **não** prova é que o `ctx` real, vindo do banco e
filtrado pelos campos da skill, seja igualmente rico. **NÃO SEI** — mediria
varrendo perfis reais, que não fiz.

---

## 10 · Conflito perfil × boa prática

**PROVEI POR EXECUÇÃO.** BP entregue: *"Brincadeira com dinossauros para ampliar
o repertório"*. Perfil C: *"NÃO gosta de carrinhos e NÃO gosta de dinossauros"*.
3 rodadas.

**Resultado: 3 de 3 rodadas respeitaram o perfil.** Zero menção a dinossauro,
zero a carrinho. O modelo substituiu o veículo pelo interesse real (água,
tecidos) e **preservou o mecanismo** da BP — dificuldade intencional + ajuda
imediata. É o resultado desejado, e veio **sem `ANCORA_PERFIL`**.

**A leitura correta desse número, e ela importa:** o teste prova que o modelo
respeita um negativo **quando ele está escrito em prosa dentro do perfil**. Não
prova que o Plano recebe negativos — e essa é a parte que falha. O `estado:
"negativo"` do `perfilConsultavel` é justamente o mecanismo que transforma "a
família disse que não" em texto, e o Plano não o consome. **O negativo só chega
se alguém o tiver escrito à mão no campo de texto.**

**O segundo caso — "já tentei e não funcionou" — NÃO FOI EXECUTADO**, e por um
motivo que é o próprio achado: **não há como a estratégia recusada chegar ao
Plano normal.** `carregarAprendizado` está fora do caminho. Testar exigiria
fabricar um bloco que a produção nunca monta, e o resultado não diria nada sobre
o produto. Marcado como **BLOQUEADO POR AUSÊNCIA DE MECANISMO**, não como
"não testado".

---

## 11 · Plano × conversa

O cenário do enunciado — mãe traz 5 temas, escolhe Comunicação, a conversa
descobre que o problema é *pedir ajuda* — resolve assim hoje:

- **WhatsApp:** o `desafio` carrega os dois lados dos últimos 45 min, então a
  frase da Ayla que nomeou "pedir ajuda" **entra**. **VI NO CÓDIGO.**
- **Web:** o `desafio` é só o que a mãe escreveu. Se quem nomeou o objetivo foi a
  Ayla — que é o caso quando a conversa funcionou — **o objetivo específico não
  entra no Plano**. Chega o material bruto da mãe, e o Plano volta a inferir do
  zero o que a conversa já tinha decidido. **VI NO CÓDIGO.**
- Além disso, o `tema` que o classificador (`classificarIntencao`) resolveu e o
  `aceite` que ele extraiu **não são passados** para o Plano em nenhum canal.
  `gerarSecoesPlanoMultiCall` não tem parâmetro para eles. **VI NO CÓDIGO.**

O `temaValidado` existe — mas só em `gerarPlano` (WhatsApp), só vindo de
`avaliarProntidaoParaPlano`, e **só para escolher o título**. Não entra no
conteúdo.

---

## 12 · Acompanhamento

| Capacidade | Estado | Onde |
|---|---|---|
| a Ayla sabe que o plano existe, conversando | **NÃO** | nenhum bloco de planos em prompt de conversa, nos 2 canais |
| retomar o plano em conversa | **não** pela conversa; **sim** por proativa | `sendPlanoSeguimento` |
| perguntar como foi | **sim**, WhatsApp, 1× por plano | cron, janela 3–14 dias, `seguimento_enviado_em` |
| registrar feedback | **sim** | `planos.resultado` (`funcionou`/`parcial`/`nao_funcionou`/`nao_testou`) + `resultado_nota` |
| usar o feedback no próximo plano | **NÃO** (só fim de semana) | `carregarAprendizado` |
| ajustar o plano | **sim, Web** | `planos/actions.ts`, com `<ajuste_pedido_pela_mae>` e fallback que devolve o plano antigo |
| manter / ajustar / trocar | **não existe como decisão** | — |
| evitar plano duplicado | **não há dedup por tema/criança** | o único controle é a oferta na conversa |
| status ativo/concluído | **não existe** | `resultado` é feedback, não ciclo de vida |
| noção de progresso | **não existe** | — |

**Recuperação pós-plano** existe (`runRecuperacaoPlano`, `?tipo=recuperacao_plano`),
com idempotência de 24h. **NÃO SEI** se está agendada no `vercel.json` — não conferi.

---

## 13 · Trial

**Não existe nenhuma regra de Plano por dia de trial.** **VI NO CÓDIGO.**
`diaTrial` aparece só em `lib/analytics/*` (dashboard, jornada — leitura para o
Admin) e em `mensagemEspontanea.ts` (cadência proativa geral, não Plano).

O que existe de gating: `requireActiveWrite` bloqueia escrita sem acesso;
`filtrarComAcesso` tira trial vencido das proativas, inclusive do seguimento de
plano. Não há oferta antecipada, demonstração automática, limite de planos, CTA
próprio nem retrospectiva de trial. **Plano é idêntico para quem está em teste e
para quem assina.**

Registro explícito, conforme pedido: **não concluo que o trial deveria ter regra
diferente.** Apenas que não tem.

---

## 14 · Web × WhatsApp

| | WEB | WHATSAPP |
|---|---|---|
| perfil resumido (`<membro_atipico>`) | **sim** | **sim** |
| perfil consultável (campo a campo, negativos) | **não** | **não** |
| `ANCORA_PERFIL` | **não** | **não** |
| BASE 2 | **não** | **não** |
| BASE 3 (boas práticas) | sim — 3 por peso | sim — 3 por peso |
| ranking por aderência (4A) | **não** | **não** |
| `nucleoConducao()` no gerador | **não** | **não** |
| histórico dentro da geração | **não** | **não** |
| falas da Ayla no `desafio` | **NÃO** | **sim** (45 min) |
| isolamento entre irmãos no `desafio` | implícito (por conversa) | **explícito** (`semOutrosMembros`) |
| gate de suficiência antes de gerar | oferta pelo marcador (modelo decide) | `avaliarProntidaoParaPlano` (Haiku, critério escrito) |
| `temaValidado` para o título | **não** | **sim** |
| entrega | tela + poller | PDF + link |
| ajuste do plano | **sim** | **não** |
| seguimento "como foi?" | **não** | **sim** |
| `<o_que_ja_funcionou>` | **não** | **só fim de semana** |

**A assimetria da 4A NÃO se repete aqui.** No Plano os dois canais são igualmente
cegos — a diferença é que o WhatsApp monta uma **entrada melhor** e tem
acompanhamento, e a Web tem ajuste.

---

## Lacunas comprovadas

1. **O aprendizado do que funcionou não chega a nenhum plano normal.**
   `carregarAprendizado` + `SISTEMA_APRENDIZADO` vivem só no gerador single-call,
   usado apenas para fim de semana. A família responde "não funcionou", o dado é
   gravado, e o próximo plano não o vê. **VI NO CÓDIGO.**
2. **O Plano é cego para BASE 2, perfil consultável, ranking por aderência e
   âncora — por duas barreiras independentes** (flag desligada **e** `relato`
   nunca passado). Ligar a flag não resolveria. **VI NO CÓDIGO.**
3. **As boas práticas do Plano são escolhidas pelo tema, não pelo caso.**
   `peso_relevancia DESC` dentro da skill; o texto do desafio não participa da
   seleção. **VI NO CÓDIGO.**
4. **Na Web, o objetivo específico da conversa não chega ao Plano** — o `desafio`
   descarta as falas da Ayla, que é onde o objetivo costuma ser nomeado. **VI NO CÓDIGO.**
5. **As 7 seções não se enxergam, e a regra de "não repita entre seções" ficou no
   gerador que saiu de uso.** **VI NO CÓDIGO.**
6. **Cinco das sete seções são especificadas por uma frase de ~120 caracteres**,
   sobre o tema e não sobre a criança. **MEDI.**
7. **A Ayla conversando não sabe que o plano existe** — não há bloco de planos
   anteriores em prompt de conversa nenhum. Sem isso, não há "manter/ajustar/
   trocar", nem dedup por tema. **VI NO CÓDIGO.**
8. **Nenhuma seção do Plano carrega `nucleoConducao()`** — o Plano é o artefato
   mais longo e mais individualizado do produto, e é o que menos recebe da
   identidade da Ayla. O comentário em `prompt.ts:106-113` já dizia isso em
   2026; segue verdadeiro. **VI NO CÓDIGO.**

---

## Risco de retrabalho

**ALTO**, e por um motivo específico: os quatro mecanismos que faltam ao Plano —
perfil consultável, âncora de precedência, BASE 2 e ranking por aderência — **já
existem construídos e medidos** para Estratégias. Construir equivalentes dentro
de `lib/ia/plano.ts` seria a terceira implementação da mesma inteligência
(WhatsApp, Estratégias, Plano) — exatamente o que o bloco A·B·C do registro de
pendências foi criado para impedir.

O caminho barato existe e é pequeno: **`buildContext` já aceita `relato`.**
Passar o desafio como `relato` liga perfil consultável, BASE 2 e ranking de uma
vez, atrás da mesma flag — sem arquitetura nova. **INFERI** (não implementei nem
testei; é a hipótese a validar, não a recomendação fechada).

---

## Recomendação de arquitetura (sem implementar)

1. **Um dono para o contexto do Plano.** Hoje são 7 `buildContext` independentes
   por plano, mais um para `entender/observar`. O contexto da criança deveria ser
   montado **uma vez** e reusado pelas seções.
2. **`relato` como porta única.** É o parâmetro que já liga os três mecanismos da
   4A. Não criar caminho paralelo.
3. **O aprendizado sobe para o multi-call**, ou o multi-call passa a chamar o
   mesmo carregador. Correção pequena, de alto valor.
4. **Na Web, o `desafio` precisa incluir o que a Ayla concluiu** — ou receber o
   `tema`/`aceite` que o classificador já resolveu.
5. **Núcleo estável + módulos opcionais**: o contrato de seções já suporta.
   A decisão que falta é *quem escolhe os módulos e com que informação* — hoje é
   uma chamada Haiku com duas saídas booleanas.
6. **Nada disso antes do DESEJADO dos blocos A·B·C.** O Plano é a terceira saída
   do mesmo cérebro; corrigi-lo isolado repete o erro que o registro descreve.

---

## Próximo passo mínimo e seguro

Levar os achados a `PENDENCIAS.md` (bloco D · Entregas, ficha nova de Plano,
ligada a PEND-016/017/018), **sem tocar em código**. A lacuna 1
(`carregarAprendizado`) é a única candidata a correção isolada — é localizada,
reversível e não depende do DESEJADO — mas mesmo ela **não** deve ser feita nesta
missão, que é de investigação.

---

## Status

**PASS (investigação completa) com uma prova BLOQUEADA:**
o caso "já tentei e não funcionou" não pôde ser exercitado porque **o mecanismo
que o produziria está fora do caminho de execução** — o que é, ele próprio, o
achado principal.
