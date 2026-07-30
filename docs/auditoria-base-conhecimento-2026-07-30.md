# Auditoria da base de conhecimento da Ayla

**Data:** 30/07/2026 · **Critério:** base consumida por **IA**, não lida por humano.
**Nada foi alterado.** Números vêm da análise programática do XLSX curado (368 linhas, 17 colunas) e
da leitura do código que consome esse acervo.

---

## 0. O que é a base, na prática

Três camadas, e só a primeira é "conteúdo" no sentido usual:

| Camada | Onde vive | Volume | Quem escreve |
|---|---|---|---|
| **Boas Práticas (BPs)** — o acervo curado | `boas_praticas` (DB), origem `data/import/…FASE3_AJUSTADO.xlsx` | **368 BPs**, 17 campos, ~710 mil caracteres ≈ **177k tokens** | Karina |
| **Skills** — as lentes de especialista | `specialist_prompt_templates` (DB) | **12 úteis** (5 ativas, 7 em rascunho) | Karina, via `/admin/skills` |
| **Core** — identidade e método | `lib/conducao/diretrizes.ts` (código) | ~11 mil caracteres | Karina + Sérgio |

Documentos de apoio (`docs/cowork-frente-1-skills.md`, `frente-2-boas-praticas.md`) são
**especificações de processo**, não conhecimento consumido em runtime. O `05_PROMPT_SKILL_EMOCIONAL_v3.md`
referenciado como "canônico" **não está no repositório** — vive fora, o que já é um achado.

**Como a base é consumida hoje:** `buildContext` carrega até 20 BPs ativas ordenadas por
`peso_relevancia`, filtra por interseção com as skills roteadas *ou* com as tags de conhecimento, e
injeta **as 3 primeiras** no prompt ([context.ts:192-302](../apps/web/src/lib/ia/context.ts#L192-L302)).
Só isso. Só na web.

---

## 1. Resumo executivo — os cinco achados

### #1 — Provavelmente 55% do acervo é inalcançável, e 100% dele é invisível no WhatsApp

Duas travas independentes, ambas fora do conteúdo:

**(a) 7 das 12 skills estão `ativo=false`.** Segundo
[cowork-frente-1-skills.md:24-34](cowork-frente-1-skills.md#L24-L34): `socializacao`, `imitacao`,
`motor`, `autonomia`, `aprendizado`, `foco`, `nutricional` são esqueletos sem conteúdo. O roteador
só escolhe entre as ativas, e o filtro de BPs exige interseção com as skills roteadas. As BPs
penduradas nessas 7 skills somam **204 de 368 — 55%**:

| Situação | Skills | BPs |
|---|---|---|
| Ativas | Emocional 51, Comunicação 34, Rotina 27, Sensorial 26, Sono 26 | **164** |
| Rascunho (`ativo=false`) | Socialização 34, Imitação 32, Motor 30, Foco 28, Nutricional 27, Aprendizado 27, Autonomia 26 | **204** |

Há uma válvula parcial: o filtro também aceita interseção por `tags`. Então algumas dessas BPs
podem ser alcançadas por acaso. Mas o caminho projetado está fechado.
**HIPÓTESE** quanto ao número exato — o estado das skills é de 17/05 e precisa de conferência no
banco (SQL na §12).

**(b) O WhatsApp não lê boas práticas.** `RespostaParams` não tem campo para elas
([responder.ts:101-135](../apps/web/src/lib/ayla/responder.ts#L101-L135)); só a web carrega.
**368 boas práticas curadas à mão, e o canal onde as mães realmente conversam nunca viu nenhuma.**

Somando: uma mãe no WhatsApp perguntando sobre alimentação recebe uma resposta que não usa nenhuma
das 27 BPs de nutrição — nem as veria se estivesse na web, porque `nutricional` está inativa.

Este é o achado mais caro da auditoria, e **nenhuma linha do conteúdo precisa mudar para resolvê-lo.**

### #2 — A base foi escrita como enciclopédia por faixa etária, não como conhecimento recuperável

A distribuição é regular demais para ter vindo da demanda real:

```
skill             0-1   1-3   4-6  7-12 13-18   tot
Aprendizado         6     6     6     4     5    27
Autonomia           5     5     5     5     6    26
Foco                5     6     6     6     5    28
Sensorial           5     6     5     6     4    26
Sono                4     6     6     5     5    26
…
TOTAL              64    82    85    82    55   368
```

Cinco por célula, doze skills, cinco faixas — uma **matriz preenchida por cota**. Isso garante
cobertura uniforme e produz dois efeitos ruins para uma IA:

- **Toda BP é presa a uma faixa etária.** Zero BPs marcadas como "vale para qualquer idade" (a
  coluna `multi` é 0). Mas princípios como "comportamento é comunicação" ou "reduza o estímulo antes
  de falar" não têm idade. Ao fatiá-los por faixa, o mesmo princípio foi reescrito cinco vezes com
  exemplos diferentes — e a IA recupera **uma** fatia, quando devia recuperar o princípio e adaptar.
- **Profundidade nivelada por baixo.** Emocional (51) mal se distingue de Sono (26), embora a dor
  real das famílias e o volume de conversa sejam muito diferentes. A cota impediu que os temas
  quentes ficassem fundos.

### #3 — Metade dos campos é redundante; o campo mais caro é o menos reutilizável

Preenchimento e tamanho medidos:

| Campo | Preenchido | p50 | Diagnóstico |
|---|---|---|---|
| Orientação | 100% | 197 ch | ✅ o núcleo |
| Versão curta | 100% | 116 ch | ⚠️ **47% não acrescenta nada**: 41 são cópia literal da Orientação e outras 132 são prefixo literal dela |
| Versão conversa | 100% | **598 ch** | ⚠️ **214 mil caracteres — 30% de toda a base.** Prosa pronta, no tom, para ser colada numa resposta |
| Versão passos | 70% | — | ✅ o formato mais reutilizável, e é o mais incompleto |
| Crenças do adulto | 100% | 149 ch | ✅ diferencial real do produto |
| Quando usar | 100% | 97 ch | ✅ é o campo de *recuperação* — subaproveitado |
| Erros comuns | 100% | 119 ch | ✅ |
| Atividades | 100% | 173 ch | ⚠️ texto corrido, não itens |

A **"Versão conversa"** merece parágrafo próprio, porque é o ponto onde a lógica humana e a lógica
de IA divergem mais. Ela é excelente prosa — e é a decisão mais cara da base:

- consome 30% do acervo escrevendo aquilo que o modelo faz sozinho (transformar orientação em fala);
- **congela o tom fora do Core**: um dia mudamos a voz da Ayla em `diretrizes.ts` e 368 parágrafos
  continuam com o tom antigo, porque a voz foi copiada para dentro do dado;
- é o campo **menos reutilizável de todos** — prosa conversacional não vira item de plano, cartão de
  rotina, linha de relatório para professora nem passo de atividade;
- e é a matéria-prima do risco de cópia literal que o próprio validador existe para punir
  (`validateAntiCopy`).

O certo, para consumo por IA, é o inverso do que foi feito: investir em **Quando usar** (recuperação),
**Versão passos** (reutilização) e **Crenças** (diferencial), e deixar a prosa por conta do modelo.

### #4 — Buracos estruturais em tudo que é escolar, clínico e de perfil

Busca estrita no núcleo de cada BP (Orientação + Quando usar + Versão curta — menções de passagem
não contam):

| Tema | BPs no núcleo | |
|---|---|---|
| Alfabetização (sílaba, fonema, decodificação) | **0** | INEXISTENTE |
| Escrita (traçado, caligrafia, produção de texto) | **0** | INEXISTENTE |
| Matemática | 4 | INSUFICIENTE |
| Funções executivas (nomeadas) | **0** | INEXISTENTE |
| Inclusão escolar formal (PEI, AEE, mediador, laudo, adaptação curricular) | **0** | INEXISTENTE |
| Comunicação alternativa (CAA, PECS) | **0** | INEXISTENTE |
| Dislexia · discalculia · disgrafia | **0** | INEXISTENTE |
| TOD · dispraxia/apraxia · TDL · TAG · Down · altas habilidades · DI | **0** | INEXISTENTE |
| Terapias (como escolher/acompanhar) | 2 | INSUFICIENTE |
| Medicação | 1 | INSUFICIENTE |
| Projeto de vida / transição para vida adulta | 1 | INSUFICIENTE |
| Bullying | 2 | INSUFICIENTE |
| Luto e perdas | 2 | INSUFICIENTE |
| Puberdade, corpo, sexualidade | 2 | INSUFICIENTE |
| Irmãos | 6 | RAZOÁVEL |

Isto é uma **base de neurodesenvolvimento típico** (marcos, brincar, autonomia, sensorial, sono,
emocional) — muito boa nisso. Não é ainda uma base de **neurodivergência clínica e escolar**.

Duas consequências concretas:
- O produto se apresenta para famílias de **TEA, TDAH, TDL, dislexia, TAG e AH/SD**. Só **12 de 368
  BPs** (3%) têm um perfil de diagnóstico nos "Perfis aplicáveis" — 291 são "qualquer perfil". A
  base não sabe diferenciar TDAH de TEA.
- O produto **entrega um relatório para escola/terapeuta** e não tem uma BP sequer sobre PEI, AEE,
  mediador ou adaptação curricular — exatamente o vocabulário desse documento.

### #5 — O conhecimento transversal está diluído dentro dos capítulos

Só 16 BPs foram marcadas como transversais. Mas os conceitos-base aparecem espalhados:

| Conceito | BPs que o mencionam |
|---|---|
| Modelagem / imitar o adulto | 129 (35%) |
| Apoio ou antecipação visual | 73 (20%) |
| Celebrar a tentativa | 66 (18%) |
| Interesse da criança como ponte | 45 (12%) |
| Previsibilidade / antecipar | 39 (11%) |
| Timer / cronômetro / musiquinha | 29 (8%) |
| Co-regulação | 17 (5%) |
| Reduzir estímulo | 8 |
| Escolhas limitadas | 6 |

Cada um desses foi reexplicado dezenas de vezes com palavras diferentes. Para um leitor humano isso
é bom (cada capítulo se sustenta). Para uma IA é o pior arranjo possível: consome contexto
repetindo o que já sabe, produz recomendação genérica ("use apoio visual") vinda de qualquer fatia
sorteada, e **impede correção central** — mudar como a Ayla ensina "apoio visual" hoje exige editar
73 registros.

Sinal do mesmo problema no schema: a coluna **"Coerência filosófica"** tem dois significados
incompatíveis. Em 177 linhas o valor é literalmente `"Sim"`; nas outras ~190 é prosa
("Mirror neurons. Início da imitação é base da aprendizagem social."). O campo começou como
checkbox de revisão e virou campo de princípio no meio do caminho — sem que ninguém decidisse.
É deriva de schema, e uma IA que leia essa coluna recebe ora um booleano, ora uma tese.

---

## 2. Cobertura dos 33 domínios pedidos

Classificação pelo **núcleo** da BP. Contagens por menção solta ficam entre parênteses quando
divergem muito — a diferença é exatamente a medida do problema #5.

| Domínio | Nota | Evidência |
|---|---|---|
| Comunicação | **Bom** | 34 BPs próprias, 5 faixas. Falta CAA/PECS (0) e TDL nomeado (0) |
| Sensorial | **Bom** | 26 BPs, todas as faixas, com propriocepção e vestibular |
| Socialização | **Bom** | 34 BPs — mas a skill está inativa |
| Autorregulação emocional | **Excelente** | 51 BPs, a mais funda; 16 transversais reforçam |
| Funções executivas | **Insuficiente** | 0 nomeadas; existe implícito dentro de Foco (28) |
| Foco | **Bom** | 28 BPs — skill inativa |
| Aprendizagem | **Razoável** | 27 BPs, mas de *desenvolvimento*, não de *escolarização* |
| Alfabetização | **Inexistente** | 0 |
| Escrita | **Inexistente** | 0 |
| Matemática | **Insuficiente** | 4 |
| Motricidade fina | **Razoável** | dentro das 30 de Motor, sem recorte próprio |
| Motricidade ampla | **Bom** | idem, 30 BPs de Motor |
| Brincar | **Bom** | forte e bem distribuído por idade |
| Interesses | **Razoável** | 45 menções, nenhuma BP sobre *como usar* interesse como ponte |
| Autonomia | **Bom** | 26 BPs — skill inativa |
| Vida diária | **Bom** | vestir, higiene, banho dentro de Autonomia |
| Sono | **Bom** | 26 BPs, todas as faixas |
| Alimentação | **Bom** | 27 BPs — skill inativa |
| Rotina | **Bom** | 27 BPs |
| Transições | **Razoável** | forte, mas diluído em Rotina/Emocional |
| Escola | **Razoável** | muitas menções (200) e pouca BP própria; nada de inclusão formal |
| Inclusão | **Inexistente** | 0 (PEI/AEE/mediador/laudo) |
| Adolescência | **Bom** | 55 BPs na faixa 13-18 |
| Vida adulta | **Insuficiente** | 1 |
| Família | **Razoável** | pano de fundo, sem recorte próprio |
| Irmãos | **Insuficiente** | 6 |
| Comportamentos desafiadores | **Razoável** | dentro de Emocional; a skill dedicada foi desativada de propósito |
| Ansiedade | **Bom** | bem coberto dentro de Emocional |
| Flexibilidade cognitiva | **Razoável** | implícito, nunca nomeado |
| Planejamento | **Insuficiente** | implícito em Rotina/Foco |
| Saúde | **Insuficiente** | pouco; medicação = 1 |
| Terapias | **Insuficiente** | 2 |
| Tecnologia e telas | **Razoável** | aparece como "erro comum", quase nunca como tema |
| Projeto de vida | **Insuficiente** | 1 |

**Resumo:** excelente em 1, bom em 13, razoável em 9, insuficiente em 8, inexistente em 2. O eixo do
desenvolvimento está coberto; o eixo **escolar/clínico** está vazio.

## 3. Arquitetura — capítulos × componentes

Hoje a BP é **um registro plano de 17 campos**, e cada registro é um mini-capítulo autossuficiente:
tem sua orientação, sua crença, sua atividade, sua prosa. Isso é ótimo para revisão humana e ruim
para uma IA, por três razões mensuráveis: o mesmo princípio existe em 5 cópias (uma por faixa), o
mesmo conceito transversal existe em dezenas (§5), e nenhum pedaço pode ser recombinado — a IA
recupera o registro inteiro ou nada.

**Componentes que deveriam existir como entidades próprias** (não como campos de um mesmo registro):

| Componente | Existe hoje? | Observação |
|---|---|---|
| Objetivo / habilidade-alvo | ❌ | Não há "que habilidade isto desenvolve". É o que faltaria para o plano ser progressivo |
| Faixa etária | ✅ | Mas obrigatória, quando deveria ser opcional |
| Nível de desenvolvimento | ❌ | Só idade cronológica. Uma criança de 8 anos com linguagem de 3 recebe conteúdo de 8 |
| Perguntas de investigação | ⚠️ | Existem como `fallback_questions` na skill (4 por skill), não por tema |
| Hipóteses | ⚠️ | Dentro da prosa, não recuperáveis |
| Sinais de alerta / encaminhar | ⚠️ | Só no `limits` da skill, genérico |
| Orientação rápida | ✅ | "Versão curta" (metade é cópia) |
| Orientação aprofundada | ✅ | "Orientação" |
| Mecanismo (o porquê no cérebro) | ⚠️ | Misturado em "Coerência filosófica" e na prosa — **é o diferencial do produto e não tem campo próprio** |
| Estratégia | ⚠️ | Implícita, nunca nomeada como entidade reutilizável |
| Atividade | ⚠️ | Texto corrido; deveria ser entidade com material, duração, idade |
| Brincadeira | ❌ | Não separada de atividade |
| História | ❌ | Só o gerador em `output_types` |
| Exemplo | ❌ | — |
| Adaptação escolar | ❌ | **O buraco mais caro** — o relatório para escola depende disso |
| Adaptação familiar | ❌ | — |
| Materiais | ❌ | Dentro da prosa da atividade |
| Indicadores de evolução | ❌ | **Não existe "como saber se funcionou"** em nenhum lugar da base |
| Próximo passo | ❌ | Nenhuma BP aponta para outra. A base é um saco, não um grafo |
| Critérios de encaminhamento | ⚠️ | Por skill, não por situação |
| Crenças do adulto | ✅ | Diferencial real, bem executado |
| Erros comuns | ✅ | Idem |
| Quando usar | ✅ | Existe e é subaproveitado |

Os três ausentes que mais custam: **mecanismo**, **indicador de evolução** e **próximo passo**. Sem
eles a Ayla não consegue fazer o que o Core promete — explicar o porquê, acompanhar resultado e
conduzir uma jornada. Ela só consegue dar uma boa dica isolada.

## 4. Duplicação — o que deveria existir uma vez só

Tabela do §5 é a lista. O padrão: **estratégias transversais foram escritas dentro de cada domínio**.

Deveriam existir **uma vez**, como estratégias nomeadas e referenciáveis, com adaptações por domínio
e idade em vez de reescrita: apoio visual, previsibilidade/antecipação, timer, redução de estímulo,
escolhas limitadas, modelagem, quebra em passos, uso do interesse como ponte, celebração da
tentativa, co-regulação, nomear a emoção. Onze estratégias resolveriam a maior parte das repetições
das 368 BPs.

Duplicação **dentro** do registro: "Versão curta" duplica "Orientação" em 47% dos casos.

## 5. Específico × genérico

**Resultado limpo, e vale registrar como acerto:** busca por `Isa`, `Isabela`, `Mario`, `Manu`,
`João`, `Davi`, `Pietro`, `Ryan`, `Karina`, `Giselda`, `Camile` nas 368 BPs → **zero ocorrências**.
Nenhum caso pessoal contaminou o acervo permanente. Não há nada a extrair aqui.

Duas observações de contorno:
- **Procedência está registrada** (coluna `Origem`), o que é raro e bom: PDFs autorais da Karina,
  marcos de neurodesenvolvimento e Siegel & Bryson. Um registro diz *"fotografia da edição da
  Karina"* — vale checar com calma se o texto derivado é paráfrase (ok) ou próximo do original
  (questão de direito autoral, não de arquitetura).
- **135 de 368 BPs (37%) estão sem "Status revisão Karina"** — não passaram pela Fase 3. Não é
  conteúdo pessoal, mas é conteúdo não homologado misturado ao homologado, sem distinção que a IA
  possa usar.

## 6. Profundidade

- **Super desenvolvido:** nenhum, em termos absolutos. Emocional (51) é o mais fundo e ainda é raso
  para o tema.
- **Equilibrado — artificialmente:** os 12 domínios, entre 26 e 34 BPs. A regularidade é o problema,
  não a virtude (§2).
- **Raso:** interesses, transições, irmãos, terapias, telas, planejamento, flexibilidade — todos
  existem só como coadjuvantes de outros temas.
- **Ausente:** alfabetização, escrita, matemática, funções executivas nomeadas, inclusão escolar
  formal, CAA, e todo o conjunto de perfis clínicos.

Não há nenhum caso de "sensorial com centenas de linhas × alfabetização com poucas". O desequilíbrio
real é **desenvolvimento (coberto) × escolarização e clínica (vazio)**.

## 7. Fluxo de raciocínio

Testando cada BP contra as 9 etapas:

| Etapa | Suportada? | Onde |
|---|---|---|
| 1. Entender a dúvida | ⚠️ parcial | "Quando usar" existe, mas é usado como descrição, não como chave de recuperação |
| 2. Investigar só o necessário | ⚠️ | 4 perguntas por *skill*, não por tema. Uma BP de seletividade não traz a pergunta que a destrava |
| 3. Levantar hipóteses | ❌ | Só como instrução geral no Core; nenhuma BP oferece hipóteses alternativas estruturadas |
| 4. Explicar o mecanismo | ⚠️ | Existe, mas dentro da prosa e da coluna ambígua de coerência |
| 5. Dar direção prática | ✅ | O ponto mais forte. "Atividades" + "Versão passos" |
| 6. Adaptar à idade | ✅ | Por construção — 5 faixas |
| 7. Adaptar ao perfil | ❌ | 291/368 são "qualquer perfil" |
| 8. Registrar evolução | ❌ | Nenhum indicador em nenhuma BP |
| 9. Sugerir próximo passo | ❌ | Nenhuma BP aponta para outra |

A base **entrega o meio do raciocínio** (4-6) e deixa as pontas descobertas: não ajuda a investigar,
não ajuda a levantar hipótese, não ajuda a acompanhar nem a continuar. É por isso que ela sustenta
uma boa resposta isolada e não sustenta uma jornada.

## 8. Personalização

| Eixo | A base permite? | Por quê |
|---|---|---|
| Idade | ✅ | 5 faixas obrigatórias |
| Diagnóstico | ❌ | 3% têm perfil; nenhuma BP explica como o mesmo tema muda em TEA × TDAH |
| Nível de linguagem | ❌ | Não existe campo. Só idade cronológica |
| Nível cognitivo | ❌ | Idem |
| Interesses | ⚠️ | A BP diz "use o interesse"; nenhuma diz *como* fazer a ponte de um interesse para uma habilidade |
| Hipersensibilidades | ⚠️ | Cobertas como tema (sensorial), não como *modificador* das outras BPs |
| Escola | ❌ | Sem adaptação escolar |
| Família | ❌ | Nada muda se é mãe solo, avó cuidadora ou dois cuidadores |
| Estratégias anteriores | ❌ | A BP não sabe se já foi tentada — e o app registra isso em `experimentos`, que ninguém lê |
| Objetivos | ❌ | Não existem como entidade |

Diagnóstico: **a base personaliza por idade e por nada mais.** Tudo o que o produto sabe sobre a
criança (perfil, sensibilidades, interesses, o que já tentou) não tem onde se encaixar, porque a BP
não tem eixos de variação — ela tem um texto só.

## 9. Reutilização

| Entregável | Serve hoje? | Por quê |
|---|---|---|
| Resposta conversacional | ✅ | É o único caso para o qual foi desenhada ("Versão conversa") |
| Plano | ⚠️ | Só "Versão passos" serve, e está em 70% das BPs. O gerador de plano **não lê BP nenhuma** |
| Atividade | ⚠️ | Existe, mas como prosa sem material/duração/idade separados |
| História | ❌ | Nada nas BPs alimenta o gerador de histórias |
| Rotina | ❌ | Nada vira cartão de rotina |
| Relatório | ❌ | Linguagem de mãe, não de escola/terapeuta. E não há adaptação escolar |
| Guia para professor | ❌ | Inexistente |
| Material para terapeuta | ❌ | Inexistente |
| Checklist | ❌ | "Versão passos" chegaria perto, mas não é indexada por objetivo |
| Plano semanal | ❌ | Sem progressão nem próximo passo |

**Um acervo, um destino.** O motivo é o mesmo do §3: o conhecimento foi salvo já *renderizado* num
formato de saída (prosa de conversa) em vez de guardado como estrutura que se renderiza em vários.

## 10. Modularização proposta

Arquitetura, não conteúdo. A ideia central é **separar o que é verdade do que é aplicação**.

```
CONCEITO           mecanismo do desenvolvimento. Atemporal, sem idade, sem diagnóstico.
                   ("memória de trabalho é o post-it mental")
   ↓ explica
HABILIDADE         o que se quer desenvolver, com progressão em níveis.
                   (associar causa e efeito · nível 1..5)  ← indexa TUDO
   ↓ trabalhada por
ESTRATÉGIA         as ~11 transversais, UMA VEZ cada, com eixos de variação
                   (apoio visual, previsibilidade, timer, ponte de interesse…)
   ↓ instanciada em
RECURSO            atividade · brincadeira · frase pronta · cartão · história
                   (com material, duração, faixa, pré-requisito)
   ↓ montada em
ENTREGÁVEL         resposta · plano · rotina · relatório · guia da escola · checklist

Atravessando tudo, como MODIFICADORES (não como cópias):
  perfil (TEA/TDAH/TDL/dislexia…) · nível de linguagem · nível cognitivo ·
  sensibilidades · idade · contexto (casa/escola/terapia)

E como metadados de RECUPERAÇÃO (hoje quase inexistentes):
  quando_usar · sinais_observáveis · hipóteses · indicador_de_evolução ·
  próximo_passo · critério_de_encaminhamento · procedência · homologação
```

A diferença prática: hoje "use apoio visual para transições aos 4-6 anos" é **um registro**. Na
arquitetura proposta é a interseção de `estratégia:apoio_visual` × `habilidade:transição` ×
`faixa:4-6` — recuperável por qualquer um dos três eixos, editável num lugar só, e renderizável
como fala, passo de plano, cartão de rotina ou linha de relatório.

## 11. Conhecimentos ausentes (lista, sem conteúdo)

**Por perfil:** TEA (níveis de suporte, perfil verbal × não-verbal, meninas), TDAH (desatento ×
hiperativo × combinado, disfunção executiva, tempo cego, desregulação emocional), TDL (compreensão ×
expressão, vocabulário, narrativa), dislexia (consciência fonológica, fluência, compreensão leitora,
acomodações), discalculia, disgrafia, TAG (esquiva, somatização, recusa escolar), deficiência
intelectual (ritmo, funcionalidade, currículo adaptado), altas habilidades (assincronia, tédio,
duplaexcepcionalidade), síndrome de Down (apraxia de fala, hipotonia, saúde associada), atraso
global, TOD, dispraxia/apraxia, perfis mistos e como priorizar quando coexistem.

**Por eixo escolar:** consciência fonológica, alfabetização, fluência, compreensão leitora, escrita
(traçado → texto), matemática (senso numérico → operação), estudo e organização, lição de casa,
provas e avaliação adaptada, PEI, AEE, mediador/AT, laudo e direitos, transição entre etapas
escolares, comunicação família-escola, bullying.

**Por eixo clínico e de rede:** como escolher e acompanhar terapias, o que esperar de cada
especialidade, medicação (o que perguntar ao médico, efeitos, adesão — sem prescrever), sinais de
encaminhamento urgente, comorbidades, sono clínico, alimentação clínica (ARFID), epilepsia.

**Por eixo de vida:** puberdade e corpo, sexualidade e autoproteção, autoadvocacia, identidade e
revelação do diagnóstico, amizade e relacionamentos na adolescência, transição para vida adulta,
trabalho, moradia, projeto de vida, luto e perdas, irmãos, avós e rede ampliada, separação dos pais,
mudanças e adaptação.

**Por eixo de método (o que falta para a IA raciocinar):** perguntas de investigação por tema, árvores
de hipótese, indicadores de evolução por habilidade, critérios de progressão de nível, sinais de
alerta, e o mapa de "o que fazer quando a estratégia não funcionou".

## 12. Escalabilidade — dobrando por 5 anos

368 → 736 → 1.472 → 2.944 → 5.888 → **11.776 BPs**. Hoje a base ocupa ~177k tokens; em cinco anos,
~5,6 milhões. Nada disso cabe num prompt — e já não cabe hoje: **injetamos 3 BPs por resposta.**

| Pergunta | Resposta |
|---|---|
| A arquitetura se sustenta? | **Não.** O gargalo não é volume, é recuperação: hoje a seleção é `peso_relevancia` fixo + interseção de tags, sem semântica. Com 12 mil registros, "as 3 de maior peso" vira aleatório |
| Fica difícil localizar? | **Já é.** Não há busca semântica em lugar nenhum do produto |
| A duplicação aumenta? | **Multiplicativamente.** A matriz é skill × faixa; somar perfil e contexto leva a 12 × 5 × 6 × 3 = mais de mil células a preencher |
| Risco de inconsistência? | **Alto e já presente.** Duas BPs podem se contradizer sem que nada detecte — o detector de conflito existe para o *perfil da criança*, não para o acervo |
| Como evitar? | Separar conceito de aplicação (§10); recuperação semântica em vez de top-N por peso; estratégias transversais únicas com variação; e um teste de contradição no acervo, como o que já existe para o perfil |

## 13. Recomendações

**Simples (dias, sem tocar em conteúdo):**
1. Ativar as 7 skills em rascunho ou desacoplar o filtro de BPs do estado da skill. Destrava ~55% do acervo.
2. Levar boas práticas ao WhatsApp. É um campo em `RespostaParams` e uma consulta.
3. Subir de 3 para 5-8 BPs por resposta, medindo custo.
4. Marcar as 135 BPs não homologadas para que a recuperação as trate como segunda linha.
5. Resolver a coluna "Coerência filosófica" — decidir se é checkbox ou princípio.

**Estruturais (semanas):**
6. Recuperação semântica por embedding sobre "Quando usar" + "Orientação", em vez de top-N por peso.
7. Extrair as ~11 estratégias transversais para entidades únicas.
8. Acrescentar os três campos ausentes que mais custam: mecanismo, indicador de evolução, próximo passo.
9. Tornar a faixa etária opcional e criar "vale para qualquer idade".
10. Separar "Atividades" em recursos estruturados (material, duração, faixa).

**Futuras:**
11. Migrar para a arquitetura em camadas do §10.
12. Eixo escolar completo (alfabetização, escrita, matemática, inclusão formal).
13. Eixo clínico por perfil.
14. Grafo de progressão entre habilidades.

**Dependem do código:** 1, 2, 3, 6, 10, e todo o §10.
**Dependem de decisão de produto:** 4, 5, 9, e as três frentes futuras — são meses de curadoria da Karina.

## 14. Roadmap

**Agora — destravar o que já existe.** Não escrever uma linha nova. Ativar as skills, levar as BPs
ao WhatsApp, subir o número injetado. Se 55% do acervo está inalcançável, qualquer investimento em
conteúdo novo rende menos do que ligar o que já foi pago.

**3 meses — tornar recuperável.** Embeddings sobre "Quando usar". Estratégias transversais extraídas.
Os três campos que faltam. Aqui a base para de ser uma lista e vira um índice.

**6-12 meses — o eixo escolar.** É o maior buraco e o de maior valor comercial: destrava relatório
de verdade, guia para professora e conversa sobre lição de casa — e é o que as famílias de TDL e
dislexia procuram.

**12-24 meses — o eixo clínico por perfil.** A base para de ser "desenvolvimento infantil" e vira
"neurodivergência". É o que permite responder diferente para TEA e TDAH.

**24 meses+ — o grafo.** Habilidades com progressão, próximo passo, indicadores. Só aqui a Ayla
consegue acompanhar uma criança por anos em vez de responder bem a cada pergunta.

---

## Resposta à pergunta final

Se eu fosse arquitetar hoje a base para uma IA de neurodesenvolvimento que atende famílias, escolas,
terapeutas e médicos, e que precisa crescer por anos sem virar um pântano, eu partiria de quatro
decisões:

**1. Guardar conhecimento, não texto pronto.** É a inversão mais importante e a mais contraintuitiva
para quem escreve bem. Todo texto já renderizado num formato de saída — como a "Versão conversa" —
é conhecimento que só serve uma vez, envelhece junto com o tom e não se recombina. O acervo guarda
*o que é verdade sobre o desenvolvimento*; a IA renderiza no formato e na voz do momento, puxando a
voz do Core. Um texto excelente para ler pode ser um péssimo registro para recuperar.

**2. Indexar por habilidade, não por capítulo.** Capítulo é uma unidade de leitura humana; ela obriga
a repetir o mesmo princípio em cada capítulo e por faixa etária. Habilidade com níveis de progressão
é a unidade certa: dá para dizer onde a criança está, o que vem depois, e como se mede — que são
exatamente as três coisas que a base não sabe fazer hoje.

**3. Separar o que é atemporal do que é aplicação.** Conceito (mecanismo) muda a cada década.
Estratégia muda a cada poucos anos. Recurso e exemplo mudam toda hora. Misturados no mesmo registro,
tudo envelhece na velocidade do mais volátil — e corrigir uma explicação de cérebro exige editar
centenas de linhas. Separados, a correção acontece num lugar e propaga.

**4. Fazer da recuperação um campo de primeira classe.** "Quando usar", sinais observáveis, hipóteses
e contraindicação valem mais, para uma IA, do que mais uma página de orientação. O gargalo de uma
base grande nunca é o que ela contém — é achar a coisa certa no momento certo. Hoje temos 177 mil
tokens de conhecimento e um seletor que escolhe três registros por peso fixo.

Sobre o que **preservar** — e é bastante: a procedência registrada por BP, a ausência total de casos
pessoais, as crenças do adulto (que é um diferencial real e raro), os erros comuns, e o Core como
fonte única de voz. A base tem qualidade de conteúdo alta. O problema não é o que a Karina escreveu;
é o formato em que foi guardado e o fato de mais da metade não chegar a lugar nenhum.

**O que eu faria primeiro, se pudesse fazer uma coisa só:** ligar as 7 skills e levar as boas
práticas ao WhatsApp. É a diferença entre ter uma base de conhecimento e usá-la.

---

### Verificação pendente (não deu para checar daqui)

O estado das skills é de 17/05 e precisa de confirmação em produção:

```sql
select name, ativo, routing_priority from public.specialist_prompt_templates order by ativo, name;
select status, count(*) from public.boas_praticas group by status;
select jsonb_array_elements_text(skills_relacionadas) as skill, count(*)
  from public.boas_praticas where status = 'ativo' group by 1 order by 2 desc;
```

Se a terceira consulta mostrar zero BPs ativas para `socializacao`, `imitacao`, `motor`, `autonomia`,
`aprendizado`, `foco` e `nutricional`, o achado #1 está confirmado no seu pior cenário.
