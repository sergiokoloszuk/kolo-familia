# BIA — infraestrutura (etapa 1)

**Data:** 2026-07-30
**Escopo:** só infraestrutura. A BIA existe no banco e tem importer. **Não é lida por nada.**

## O que NÃO mudou

Nenhum arquivo existente foi modificado. Confirmado por `git status`: a etapa só adiciona.

- `lib/conducao/diretrizes.ts` — o Core, intacto
- `lib/ayla/responder.ts`, `lib/ia/prompt.ts` — os prompts dos dois canais, intactos
- `lib/ayla/prontidao-plano.ts` — o decisor de entrega, intacto
- `lib/ia/plano.ts`, `lib/plano/pdf.ts` — planos e PDF, intactos
- `lib/conhecimento/boas-praticas.ts` — a recuperação das 368 BPs, intacta

`tsc --noEmit` limpo. `lib/bia/tipos.ts` não é importado por ninguém — é órfão de propósito.

## O que foi criado

| Arquivo | Papel |
|---|---|
| `supabase/migrations/0071_bia.sql` | Tabela `bia_chunks` + CHECKs + índices + RLS |
| `apps/web/src/lib/bia/tipos.ts` | Vocabulário canônico, tipos e mapa núcleo↔domínio |
| `scripts/bia/docx.mjs` | `.docx` → texto. ZIP + XML na mão, zero dependências |
| `scripts/bia/chunker.mjs` | Texto → chunks com metadados. Puro |
| `scripts/bia/importar-bia.mjs` | CLI: relatório, JSON, SQL |

## Modelo de dados

`public.bia_chunks` — **1 linha = 1 unidade de raciocínio**, não 1 parágrafo.

Granularidades diferentes por natureza do conteúdo, porque é o que a BIA tem de
valioso:

| Conteúdo | Granularidade | Por quê |
|---|---|---|
| Regra `SE… ENTÃO…` | 1 regra = 1 chunk | Foi escrita atômica |
| Pergunta investigativa | pergunta + "por que existe" + hipóteses + "muda conduta" **juntos** | Separadas viram interrogatório — o que o FREIO ANTI-ANAMNESE do Core proíbe |
| Estratégia | com "quando NÃO funciona" e "erros comuns" junto | Cortar o "quando não funciona" é perigoso |
| Princípio de ouro | 1 princípio = 1 chunk | — |
| Prosa | blocos de ~320 palavras, quebrando só em fronteira de parágrafo | Nunca separa par crença→reconstrução |

Campos além da especificação original, e por quê:

- **`muda_conduta`** — só para perguntas. É exatamente o critério que o decisor de entrega (`prontidao-plano.ts`) já usa. Pergunta que não muda conduta não deve ser feita.
- **`faixa_etaria_*_meses` + `faixa_rotulo`** — meses porque a BIA mistura granularidades e o perfil guarda data de nascimento; o rótulo original fica para conferência.
- **`revisao_pendente` / `revisao_motivo`** — o importer nunca chuta. Sem isso, classificação errada viraria conhecimento curado.
- **`hash`** (único) — reimportação idempotente.
- **`ordem`** — preserva a sequência narrativa para revisão.
- **`texto_busca`** (tsvector português, gerado) — o índice que um retriever usaria primeiro.

RLS espelha `boas_praticas`/`aulas`: leitura para autenticados só do que está
ativo, escrita só admin. Conteúdo curado, não dado de família.

## Fronteira com as Boas Práticas

Este é o principal risco de duplicação, então fica escrito:

```
boas_praticas → O QUE FAZER.        368 fichas. Fonte da verdade. Intocada.
bia_chunks    → COMO PENSAR antes de escolher o que fazer.
```

Um trecho da BIA que vira "faça X com a criança" provavelmente é uma BP, não um
chunk de BIA. O anexo de brincadeiras do documento **não foi tratado** nesta
etapa justamente por isso — precisa da comparação por código (BP-APR-01) antes.

## Como rodar

```bash
# relatório, sem gravar nada
node scripts/bia/importar-bia.mjs --arquivo "C:/.../BIA.docx" --versao 2026-07-30

# + JSON para inspeção
node scripts/bia/importar-bia.mjs --arquivo "..." --versao 2026-07-30 --json bia.json

# + SQL para aplicar (revisar antes)
node scripts/bia/importar-bia.mjs --arquivo "..." --versao 2026-07-30 --sql bia.sql
```

O importer **gera SQL, não escreve no banco**. Três motivos: é assim que
migração chega em produção aqui; não adiciona dependência ao projeto; e o SQL é
auditável antes de rodar. O Supabase é self-hosted e já teve incidente de perda
de dados — escrita automática não compensa.

## Resultado da execução real (30/07/2026)

Documento: `BIA_Kolo_Familia_Compilado_Final.docx`, 1.394.614 caracteres.

```
chunks ............. 1120
hashes duplicados .. 35     (ON CONFLICT ignora)
revisão pendente ... 298    (27%)
com faixa etária ... 80
palavras (média) ... 188
```

Por tipo: 495 conceito · **285 regra_operacional** · 102 interpretação ·
66 princípio_de_ouro · 48 estratégia · **44 pergunta_investigativa** ·
34 fundamento · 24 explicação_para_família · 9 encaminhamento ·
5 orientação_para_escola · 3 ferramenta · 2 brincadeira · 2 sinal_de_alerta ·
1 atividade.

Por cautela: 852 baixo · 235 moderado · 25 alto · 8 requer_encaminhamento.

Verificado por amostragem: as regras SE/ENTÃO saem atômicas e íntegras; as
perguntas saem com `muda_conduta` preenchido a partir do próprio "Muda conduta?
Sim/Não" do documento.

## Decisões tomadas

1. **Sem `embedding` / sem pgvector.** Extensão nova num Supabase self-hosted
   com histórico de fragilidade, e a recuperação determinística das BPs mostrou
   que filtro + pontuação textual resolve. `texto_busca` (tsvector) cobre o
   full-text sem exigir extensão. Quando a busca semântica for aprovada, é uma
   migração de uma coluna.
2. **"Kolo Materno" nunca entra.** O documento traz essa assinatura nos núcleos
   de Sono e Rotina — resíduo do material de origem. `normalizarMarca()` corrige
   para **Kolo Família** antes de qualquer chunk ser criado. Verificado:
   0 ocorrências na saída.
3. **Os 15 `tipo_conhecimento` da especificação, sem inventar.**
4. **Os núcleos são fechados.** "Não invente novos núcleos durante a
   importação": o que não couber vai para revisão, nunca para um núcleo novo.
5. **Revisão só com sinal concreto** — gabarito vazado, ou seção existente e não
   reconhecida. Prosa sem seção é abertura de núcleo, conteúdo normal. Marcar
   tudo inflava o número e afogava os casos reais.

## Em aberto (precisam de decisão antes da próxima etapa)

1. **`crenca_limitante` como tipo próprio?** Hoje crenças limitantes e "erros
   comuns dos adultos" entram como `interpretacao`. São dois blocos grandes e
   distintos. Mudar é um CHECK.
2. **Gabarito vazado nos núcleos 6 e 9.** O briefing de encomenda ("Explique de
   maneira simples…", "Formato obrigatório SE… ENTÃO…") está no documento final.
   Detectado e marcado (2 chunks). Completar ou descartar?
3. **298 chunks em revisão.** Seções legítimas que nenhum padrão reconheceu.
   Precisam de passada humana antes de qualquer uso.
4. **O anexo de brincadeiras não foi conciliado com as 368 BPs.** Comparação por
   código pendente.
5. **Volumes seguintes.** Este documento vai até o núcleo 12 + transversal.
   Reimportar é idempotente pelo hash.
6. **Erros de digitação e caracteres corrompidos** no documento ("共享",
   "接管", "Étalvez", "aliento", "desinterença"). Entram como estão — limpeza
   é decisão editorial da Karina.

---

# Etapa 2 — o BIA Retriever

**Data:** 2026-07-30
**Escopo:** camada de recuperação. **Nada é chamado pela Ayla.**

## O que NÃO mudou (de novo)

Nenhum arquivo existente modificado. Prompt, decisor de entrega, planos, PDFs e
os dois fluxos de conversa intactos. `104 testes` passando, `tsc` limpo,
`npm run build` exit 0.

Sem LLM e sem embedding na recuperação, por decisão desta etapa.

## Arquivos

| Arquivo | Papel |
|---|---|
| `lib/bia/pontuacao.ts` | **Núcleo puro.** Zero I/O. Filtros duros, pesos, prioridade, diversidade, motivos |
| `lib/bia/retriever.ts` | **Serviço.** `buscarConhecimentosBIA()`. Só I/O, delega o julgamento |
| `lib/bia/pontuacao.test.ts` | 28 testes do núcleo — sem banco, sem rede |
| `lib/bia/retriever.test.ts` | 13 testes do serviço com Supabase falso |
| `scripts/bia/consultar.mjs` | Bancada de consulta manual |

A separação puro × I/O é o que permite testar a qualidade da recuperação
isoladamente — a exigência central da etapa.

## Como a recuperação combina os três sinais

1. **Filtro estruturado em SQL** — `ativo`, `revisao_pendente = false`, faixa
   etária em meses (faixa aberta serve sempre). Corta cedo e barato.
2. **Duas consultas que se SOMAM**, não que se intersectam:
   - estruturada: todos os chunks do(s) núcleo(s) do domínio em foco
   - textual: `websearch_to_tsquery` sobre `texto_busca`

   Somar porque cada uma cobre um buraco da outra. A estruturada garante
   candidatos quando a mãe escreve palavras que não existem no documento ("ele
   surta na hora do banho"); a textual acha conhecimento de **outro** núcleo (a
   criança que não dorme pode estar num problema sensorial). Intersectar
   devolveria vazio com frequência — o pior resultado possível.
3. **Pontuação determinística** com regras de prioridade e diversidade.

## Filtros duros (exclusão, não penalidade)

- `revisao_pendente = true` → **nunca sai**. Servir chute com cara de método
  curado é o pior resultado possível.
- Faixa etária incompatível.
- `nao_usar_sem_contexto` sem o domínio explícito.

## Regras de prioridade

| Regra | Peso |
|---|---|
| Núcleo = domínio em foco | +50 |
| Cobertura textual da pergunta | até +38 |
| Situação do cotidiano bate | +25 (até 2) |
| Regra SE/ENTÃO | +18 |
| Pergunta investigativa | +15 |
| Faixa etária específica compatível | +12 |
| Diagnóstico declarado | +10 |
| `muda_conduta = true` | +10 |
| **Encaminhamento COM sinal de risco** | **+60** |
| Encaminhamento SEM sinal de risco | **−40** |
| Núcleo `fundamentos` | **−25** |

Duas decisões merecem explicação:

- **Encaminhamento** é rebaixado com força em conversa de rotina (para não virar
  alarme) e promovido na frente de tudo quando há sinal de risco no contexto.
  Rebaixado, não excluído — esconder informação de segurança é pior.
  Não substitui o PISO do Core, que age na resposta, sempre.
- **`fundamentos` penalizado**: a Parte I já vive em `lib/conducao/diretrizes.ts`.
  Devolvê-la seria a Ayla recuperando a própria identidade como conhecimento
  externo.

**Diversidade:** teto de 3 por tipo. `regra_operacional` tem o maior peso de
tipo **e** é o mais numeroso do corpus (285 de 1120) — sem teto, a saída seria
seis regras e nenhuma pergunta investigativa.

## Todo resultado diz por que foi selecionado

```
2. [comunicacao] estrategia  score 78
   7. Estratégias Práticas (Raciocínio de Aplicação)
     • corresponde ao domínio Comunicação (+50)
     • correspondência textual (pega, mao, puxa, olha) (+16)
     • estratégia (+12)
```

Os motivos são estruturados (`codigo` + `peso`) e legíveis (`descricao`): o
código serve ao teste automatizado, a descrição à revisão humana.

## Uma calibração feita com evidência, não por intuição

A primeira versão pesava o texto em 1 ponto por termo — rendia +2 a +4 contra
+50 do domínio. Na bancada isso ficou visível: **dentro** de um núcleo o texto
da conversa não discriminava nada, e a regra que respondia exatamente à
pergunta ("SE a criança puxa a mão do adulto…") perdia para um chunk genérico
que só mencionava autismo.

Medição que mudou a decisão: `tea` aparece em só 3% do corpus (sinal forte no
geral), mas em **48%** dos chunks de Comunicação — lá ele quase não discrimina.

Correções: pontuação textual por **cobertura da pergunta** (quantos termos
perguntados o chunk cobre, sobre o total) em vez de contagem bruta — o que
também evita premiar chunk longo por ter mais palavras; teto de 38; diagnóstico
de 15 → 10. Depois disso, "Seguir a Liderança" subiu para #2 e a regra exata
entrou no limite padrão.

Os dois casos viraram teste de regressão.

## A bancada de consulta

```bash
node scripts/bia/consultar.mjs --corpus bia.json \
     --dominio comunicacao --idade 3 --perfil TEA \
     --texto "ele pega minha mão, me puxa até o armário"

node scripts/bia/consultar.mjs --corpus bia.json --cenarios
```

Consulta o **corpus JSON**, não o banco: a 0071 não foi aplicada, e validar
contra o corpus não encosta em produção. Usa o **mesmo** `pontuacao.ts` do app
(transpilado na hora com o `typescript` que já é dependência) — nenhuma lógica
duplicada, nenhuma dependência nova.

`--cenarios` roda 6 consultas de referência (comunicação, sono, alimentação,
risco/regressão, adolescente, sem domínio). Se um cenário mudar de resposta
depois de mexer nos pesos, foi mudança de comportamento — não ajuste fino.

## Verificado de ponta a ponta

Contra o corpus real (1.120 chunks, 822 recuperáveis):

- **Regressão** ("ele falava algumas palavras e parou") → devolve *"Bandeiras
  Vermelhas: Perda de habilidades já adquiridas (a criança falava e parou)"*,
  score 133, com o motivo "há sinal de risco no contexto".
- **Adolescente 15 anos / autonomia** → princípios e perguntas de autonomia,
  nada infantil.
- **Sem correspondência** → lista vazia. Silêncio é melhor que ruído.

## Em aberto

1. **Sem `idf`**: termos raros e comuns pesam igual na cobertura. Um chunk longo
   ainda tem mais chance de conter os termos. Aceitável agora; se incomodar, a
   correção é estatística de corpus, não IA.
2. **O corpus tem 43% de chunks sem nenhuma situação relacionada** — o filtro
   por situação só funciona para pouco mais da metade.
3. **Pesos não estão validados pela Karina.** Foram calibrados por mim contra
   casos que eu escolhi. A bancada existe justamente para ela contestar.
4. **A tabela está vazia em produção.** O retriever nunca rodou contra Postgres
   de verdade — só contra o Supabase falso dos testes e o corpus JSON. A
   sintaxe do `textSearch` e do `or` de faixa etária só será provada quando a
   0071 for aplicada.

## Próxima etapa (não iniciada)

Integração. Os pontos mapeados continuam: o decisor de entrega (perguntas
investigativas), o bloco no prompt dos dois canais via `context.ts`/`responder.ts`,
e as receitas de seção em `plano.ts`. `blocoBia()` já existe em `retriever.ts`
como o formato que a integração usaria — sem nenhum chamador.

---

# Etapa 3 — primeira integração controlada

A BIA passou a ser lida pelos dois canais, **atrás de uma flag desligada**.

## Ponto de entrada único

`lib/bia/contexto-ayla.ts` → `carregarBlocoBia()`. WhatsApp
(`lib/ayla/orchestrator.ts`) e Web (`lib/ia/engine.ts`) chamam esta função e
mais nenhuma. Não é disciplina, é estrutura: as cotas, o orçamento, as
instruções e a instrumentação existem em um lugar só. Foi a falta disso que
produziu o drift entre canais que a Fase 1 teve de consertar.

## Fronteira (não se atravessa)

| Camada | Responsabilidade |
| --- | --- |
| Core (`conducao/diretrizes.ts`) | identidade, condução, tom, limites |
| `ayla/prontidao-plano.ts` | decide o próximo movimento |
| **BIA** | recupera conhecimento — contexto complementar |
| `conhecimento/boas-praticas.ts` | sugestões práticas curadas |
| `ia/prompt.ts` | organiza os blocos |

A BIA não decide, não pergunta, não muda tom, não entra em plano, PDF ou Meus
Planos. `respondAsOutputType` e `buildContext` ficaram intocados de propósito —
`plano.ts` reusa `buildContext`, então mexer ali mudaria os planos.

## Flag

`BIA_PROMPT_ENABLED` = `1` ou `true`. Qualquer outro valor (inclusive ausente)
mantém tudo desligado, e `carregarBlocoBia` retorna **antes de qualquer I/O** —
não consulta o banco, não loga, não custa nada.

## Cotas e orçamento

Máximo 5 chunks: 1 interpretação, 1 pergunta investigativa, 2 regras
operacionais, 2 estratégias/conceitos — mais 1 vaga de **segurança**
(`sinal_de_alerta`/`encaminhamento`), que é acréscimo deliberado: sem ela, um
relato de regressão recuperaria o alerta certo (o retriever o promove com +60) e
o bloco o descartaria por falta de cota.

Teto de 2.000 caracteres de texto e 600 por chunk; o corte é pelo fim da lista,
ou seja, pelo menor score. Tipos sem cota (princípio de ouro, fundamento,
explicação para a família) ficam de fora — é onde mora o risco de a Ayla
"recuperar a própria identidade", que o Core já dá.

## Instrumentação

`kind = "bia_recuperacao"`, com canal, domínio, núcleos, IDs, tipo, score,
motivos, chars, tokens, ms, vazio e conflito. **Sem uma linha da conversa e sem
o texto dos chunks** — dá para julgar a qualidade da recuperação sem abrir o que
a família contou. Sobe para `warn` (e portanto persiste em `eventos_app`) só
quando há conflito com Boa Prática.

## Bancadas

- `scripts/bia/consultar.mjs` — o que o retriever traz e por quê
- `scripts/bia/bancada-bloco.mjs` — o caminho inteiro até o texto que entra no
  prompt, com cotas, orçamento, conflito e tokens

As duas rodam contra o corpus JSON. Não encostam em produção.

## Desabafo puro — quando a BIA fica quieta

Decisão de produto tomada depois da bancada da Etapa 3: "hoje eu não aguento
mais, tô exausta" recuperava quatro regras operacionais e injetava ~674 tokens
de conhecimento técnico num turno que pedia colo. Não é só token desperdiçado —
é empurrar a Ayla a responder com conteúdo quando a mãe pediu acolhimento.
**Acolhimento é do Core e continua sendo.**

O critério vive em `lib/bia/desabafo.ts` e são três portas, nesta ordem. Basta
uma abrir para a BIA rodar normalmente:

1. **Sinal de risco** no relato → nunca silencia. Encaminhamento e segurança
   passam sempre, inclusive dentro de um desabafo.
2. **Domínio identificável** (sono, alimentação, crise, escola, comunicação…) →
   há problema concreto.
3. **Conteúdo concreto no texto** → algum termo que não seja estado interno do
   adulto, tempo vago, verbo de intenção ou autorreferência.

A terceira porta é definida por **ausência**, não por lista de desabafos: é
desabafo puro quando *todos* os termos restantes depois das stopwords descrevem
como a mãe se sente, quando, o que ela quer, ou como ela se nomeia. Um único
termo fora desses campos ("ele grita", "a escola ligou") libera.

O viés é **permissivo de propósito**: um termo concreto basta. Errar liberando
custa um bloco que o próprio prompt manda ignorar se não for pertinente; errar
silenciando deixa a Ayla sem conhecimento diante de um problema real embrulhado
em desabafo. Termo desconhecido conta como concreto, então a lista pode ficar
incompleta sem quebrar nada.

Fica registrado em `bia_recuperacao` com `consultada: false` e
`motivo: "desabafo_puro"` — dá para medir quantos turnos caem aqui sem ler
conversa nenhuma.

Efeito colateral encontrado e corrigido no caminho: a pista de socialização
casava com `sozinh`, então "me sinto sozinha" — a solidão da MÃE — era roteada
para o conhecimento de socialização da criança. Agora só conta colada a um verbo
("brinca sozinho", "fica sozinho no recreio").

## Classificação por seção: normalização e o que ela não resolveu

Os 298 chunks bloqueados em `revisao_pendente` (27% do acervo) caíram para 54
(4,8%). A causa era de classificação, não de conteúdo — nenhum texto mudou.

**A normalização estrutural do título** (`tituloParaClassificar`, em
`scripts/bia/chunker.mjs`) tira do começo do título só o que é editorial:
numeração simples ou hierárquica, ponto, e os separadores em suas variantes
Unicode (hífen, travessão, meia-risca, barra horizontal, traço de figura, sinal
de menos, ponto médio, bala, dois-pontos). Uma etapa só, e não um padrão novo
por formato — assim um formato editorial inédito não volta a quebrar tudo.

Dois cuidados que definem a fronteira entre editorial e conteúdo:

- numeração **simples** só é removida quando vem seguida de ponto, parêntese ou
  traço. Sem isso, "5 sinais de alerta" perderia o 5;
- o título **original** continua inteiro no chunk e é ele que entra no `hash`.
  A forma normalizada existe só para comparar.

`tipoPorSecao` tenta o título cru **antes** do normalizado. Isso preserva
padrões que dependem da numeração — "4.2 — 3–5 anos" precisa dela para ser
reconhecida como subseção de faixa etária — e garante que o que já classificava
certo continue idêntico.

**O que a normalização resolveu, medido: 2 chunks de 296.** O diagnóstico de que
os prefixos impediam a inferência valia para uma minoria. A maioria dos títulos
("6.2 — Neurônios-Espelho", "3.5 — Escola", "Aprendizagem Observacional") não
casava com regra nenhuma por um motivo diferente: são títulos **expositivos**, e
nunca houve regra para eles porque não há o que inferir de um substantivo.

**O que resolveu de fato: separar "não sei ler" de "material expositivo".** Para
um título expositivo, `conceito` não é chute — é o tipo correto. Só que aceitar
isso em bloco correria o risco de uma seção acionável com título idiossincrático
virar `conceito` em silêncio. Então quem decide não é o título: é o texto
(`textoPrescreve`). Se o texto dá ordem ao adulto — imperativo, proibição,
"deve-se", estrutura SE/ENTÃO — o tipo é mesmo incerto e o chunk continua
bloqueado. Se só descreve, `conceito` está certo e ele é liberado.

O detector é conservador de propósito: na dúvida, considera que prescreve.
Segurar um chunk descritivo a mais custa zero; liberar um prescritivo mal
tipado, não.

Efeito na recuperação: nenhum bloco das 10 consultas da bancada mudou. Os
chunks liberados passaram a aparecer entre os candidatos (um `conceito` de
autonomia entra em 7º com score 74), mas `conceito` tem o menor peso de tipo na
pontuação e divide cota com `estrategia` — então mais acervo disponível não
virou mais ruído no prompt.
