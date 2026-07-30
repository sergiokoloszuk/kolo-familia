# Auditoria do conhecimento da Ayla sobre BRINCAR

**Data:** 30/07/2026 · **Escopo:** tudo o que a Ayla sabe sobre brincar, direta ou indiretamente.
**Nenhum conteúdo novo foi produzido.** Todos os números vêm de análise programática do acervo real
(368 BPs no XLSX curado) e de leitura do código. Cada achado aponta ID da BP ou arquivo:linha.

---

## Números de partida

| Medida | Valor |
|---|---|
| BPs que **mencionam** brincar em qualquer campo | **157 de 368 — 43%** |
| BPs em que brincar **é o assunto** (núcleo: orientação + quando usar + versão curta) | **86 de 368 — 23%** |
| BPs de brincar para **adolescentes (13-18)** | **0** |
| Tipos de brincar com cobertura **zero** no acervo | **6 de 21** |
| Situações reais da Parte 3 com cobertura **zero** | **7 de 17** |
| BPs sobre **como usar o hiperfoco** para brincar | **0** |

Duas leituras opostas cabem nesses números, e as duas são verdadeiras: **a Ayla fala de brincar o
tempo todo** (43% do acervo toca no assunto) e **a Ayla não sabe nada sobre brincar como
desenvolvimento** (nenhuma BP trata do brincar em si). É a distinção que a auditoria pede — brincar
como *ferramenta* × brincar como *domínio* — e ela é a chave de tudo o que vem abaixo.

---

## PARTE 1 — Inventário

### 1.1 No acervo de Boas Práticas (86 BPs com brincar no núcleo)

| Tema | Conhecimento existente | Onde aparece | Profundidade | Utilidade prática | Observações |
|---|---|---|---|---|---|
| **Imitação como brincadeira** | Caretas, sons, palmas, imitar o bebê e esperar; imitar o som DELE e devolver | 12 BPs · BP-IMI-02, 12, 13, 14 | **completa** | alta | O único tema com progressão implícita (imitar → esperar → variar). Toda a faixa 0-1 |
| **Atenção compartilhada** | "Brota entre 8-10 meses. Construa movendo lentamente e mantendo seu rosto próximo" | BP-FOC-21 | **completa** | alta | Conhecimento clínico correto e datado por marco |
| **Permanência de objeto** | Esconde-esconde graduado: esconder parcialmente, depois aumentar | BP-FOC-22, BP-APR-17, BP-EMO-20 | **completa** | alta | 3 BPs, com progressão explícita — raro no acervo |
| **Brincar paralelo** | "Dois bebês brincando perto um do outro, sem compartilhar, é SUCESSO SOCIAL" | BP-SOC-15, BP-SOC-34 | **intermediária** | alta | Reenquadre valioso; sem o que vem depois |
| **Turnos** | "Game de turns (você-eu)" para quem não compartilha brinquedo | BP-EMO-10 | **superficial** | média | Uma linha, com anglicismo. Sem progressão |
| **Cesta de tesouros / exploração sensorial** | Objetos de texturas variadas, observar reação | BP-SEN-01, BP-SEN-12, BP-APR-03 | **completa** | alta | Bem executado para 0-3 |
| **Ambiente que convida ao movimento** | Blocos baixos, "caminhos" com fita no chão, tummy time | BP-MOT-01, 02, 03 | **completa** | alta | 10 BPs motoras, boa densidade |
| **Coordenação fina com materiais** | Tesoura sem ponta, cola, pintura | BP-MOT-03 | **intermediária** | alta | — |
| **Jogo cooperativo e leitura de colegas** | "Jogos simples, quebra-cabeças e brincadeiras cooperativas ensinam turnos" | BP-SOC-03 | **superficial** | média | Uma frase para um tema inteiro |
| **Perder no jogo / frustração** | "Comece com games que praticamente sempre ganha" | BP-EMO-07 | **intermediária** | alta | Bom, mas isolado |
| **Brincar dentro da rotina** | Sequência mamar → brincar → dormir; brincar como etapa previsível | BP-ROT-01, 02, 11, 12 | **intermediária** | alta | Brincar aqui é slot da rotina, não conteúdo |
| **Escolha de 2 opções** | "Não 'o que você quer', mas 'blusa vermelha ou azul'" | BP-AUT-15, BP-ROT-12 | **completa** | alta | Transversal, aplicável ao brincar |
| **Deixar "fazer junto"** | "Empurrar brinquedo, bater colher, ajudar na rotina" | BP-APR-15 | **intermediária** | alta | Brincar funcional sem nomear |
| **Interesse do adolescente por games** | "Game tem feedback imediato, conquista clara, narrativa" — conversar a partir disso | BP-FOC-18 | **intermediária** | alta | **A única BP de brincar que serve a adolescente** — e não está catalogada como brincar |

### 1.2 No código (as regras, não o conteúdo)

| Onde | O que é | Tamanho | Observação |
|---|---|---|---|
| [seed 0003 · output_type `brincadeiras`](../supabase/migrations/0003_seed.sql) | *"Sugira 2 a 3 brincadeiras concretas alinhadas ao perfil sensorial e interesses do membro atípico em foco. Inclua materiais simples e duração estimada."* | **~30 palavras** | ⚠️ **É a única especificação generativa de brincadeira em todo o produto.** Alimenta o botão E a seção do plano |
| [plano.ts:19-29](../apps/web/src/lib/ia/plano.ts#L19-L29) | `brincadeiras` é seção **SEMPRE presente** do plano | — | Todo plano gerado contém brincadeiras, a partir daquelas 30 palavras |
| [diretrizes.ts:95](../apps/web/src/lib/conducao/diretrizes.ts#L95) | PISO: nunca usar brinquedo/interesse como recompensa; materiais só reais, seguros e adequados à idade | ~60 palavras | ✅ Regra correta e ativa nos dois canais |
| [seed · `validador_ai` A3](../apps/web/src/lib/ai/seed-prompts-data.ts) | *"SE a resposta propõe brincadeira ou atividade, ela usa pelo menos 1 interesse"* | — | ✅ **Existe validador que exige personalização por interesse.** Só roda na web |
| [repertorio.ts](../apps/web/src/lib/ayla/repertorio.ts) | Sugestão semanal de experiência **adjacente** ao interesse, com listas `evitar` e `jaTentados` | ~40 linhas | ✅ O mecanismo mais sofisticado que existe sobre interesse → atividade. Roda 1×/semana, só proativo |
| [chips.ts:69](../apps/web/src/lib/ayla/manual/chips.ts#L69) | Chip "Brincadeiras em dupla" | — | Só no manual do CRM |
| [parser.ts:62](../apps/web/src/lib/ayla/parser.ts#L62) | `socializacao` = "brincar junto/lado a lado" | — | Única definição de tipo de brincar no código |
| Lúdico (rotinas, desenho, meditação, timer, histórias) | Funcionalidades | — | São recursos, não conhecimento sobre brincar |

### 1.3 Nos guias recém-entregues (PDF Compilado)

Praticamente nada. Nos 29 temas dos quatro guias, brincar aparece como **objeto de transição**
("parar de brincar", "guardar o brinquedo dizendo tchau") e como slot da rotina. Nenhum tema trata
do brincar. Confirma o padrão.

---

## PARTE 2 — Tipos de brincar contemplados

Busca no acervo inteiro (368 BPs). "Núcleo" = a BP é sobre isso; "menção" = aparece de passagem.

| Tipo | Existe? | Onde | Núcleo / menções | O que falta |
|---|---|---|---|---|
| Exploratório | ⚠️ menção | BP-SEN-01, APR-03 | 1 / 23 | Nomeado como "exploração sensorial", nunca como estágio do brincar |
| Sensorial | ✅ | Sensorial, Motor | 7 / 17 | Boa cobertura 0-3; nada acima |
| **Funcional** (usar o objeto pela função) | ❌ **inexistente** | — | **0 / 0** | O estágio inteiro. É o que a mãe descreve quando diz "ele não sabe brincar" |
| Construtivo | ✅ | Motor, Aprendizado | 17 / 57 | Empilhar/montar/encaixe bem cobertos |
| Causa e efeito | ❌ | — | 0 / 3 | Nada sobre brinquedo de apertar-e-acontece |
| **Imitativo** | ✅ **o mais forte** | skill Imitação inteira | 34 / 99 | Só faixa 0-3 |
| Simbólico / faz de conta | ⚠️ **raso** | BP-SOC-03 e 2 outras | **3** / 11 | Não há progressão, nem o que fazer quando não emerge |
| Paralelo | ⚠️ | BP-SOC-15, SOC-34 | 1 / 4 | Existe o reenquadre; falta o que vem depois |
| Associativo | ❌ | — | **0 / 0** | O degrau entre paralelo e cooperativo simplesmente não existe |
| Cooperativo | ⚠️ raso | BP-SOC-03 | 4 / 10 | Uma frase |
| Jogos de turno | ⚠️ raso | BP-EMO-10 | 2 / 4 | Sem progressão |
| Jogos com regras | ⚠️ raso | BP-EMO-07 | 1 / 3 | Só o ângulo "perder o jogo" |
| Corporais | ✅ | Motor, Sensorial | 11 / 26 | Bem coberto |
| Sociais | ⚠️ | Socialização | — | Diluído |
| **Solitário** | ❌ | — | **0 / 0** | Nada sobre brincar sozinho ser legítimo |
| Digital / videogame | ⚠️ | BP-FOC-18 | 0 / 2 | Só como problema de foco |
| **Entre irmãos** | ❌ **inexistente** | — | **0 / 0** | Uma das perguntas mais frequentes |
| Espontâneo × mediado por adulto | ❌ | — | **0 / 0** | "Seguir a liderança da criança" não aparece nenhuma vez |
| **Na escola / recreio** | ❌ | — | **0 / 0** | — |
| **Na adolescência** | ❌ | — | **0** / 9 | **Zero BPs de brincar na faixa 13-18** |

**Padrão inescapável:** a base cobre bem os tipos que aparecem **antes dos 4 anos** (exploratório,
sensorial, imitativo, construtivo, corporal) e é rasa ou vazia em todos os que aparecem **depois**
(simbólico, associativo, cooperativo, regras, digital, adolescência).

Distribuição por faixa das 86 BPs de brincar: **0-1 → 19 · 1-3 → 27 · 4-6 → 24 · 7-12 → 16 ·
13-18 → 0.**

---

## PARTE 3 — O raciocínio da Ayla nas 17 situações reais

Legenda: **I**nvestiga · **In**terpreta · **E**stratégia.

| Situação | I | In | E | O que falta / risco |
|---|---|---|---|---|
| "Meu filho não sabe brincar" | ⚠️ | ❌ | ⚠️ | 2 BPs tocam. **Falta o mapa de estágios** para saber em qual ela está. Risco: sugerir faz de conta a quem ainda está no exploratório — a mãe tenta, falha, conclui que "não funciona" |
| "Só gira a rodinha do carrinho" | ⚠️ | ⚠️ | ❌ | 8 menções a girar, nenhuma sobre **entrar** na repetição em vez de interrompê-la. Risco alto: a Ayla pode tratar como sintoma a ser eliminado |
| "Ela enfileira os brinquedos" | ❌ | ❌ | ❌ | **Zero**. É uma das falas mais comuns de mãe de TEA |
| "Não brinca com outras crianças" | ❌ | ⚠️ | ⚠️ | **Zero direto**. BP-SOC-15 salva parcialmente (paralelo é sucesso) — mas só se o roteador achar |
| "Só quer brincar do mesmo jeito" | ⚠️ | ⚠️ | ❌ | 4 menções. Falta a graduação de variação dentro do script conhecido |
| "Quebra todos os brinquedos" | ⚠️ | ❌ | ❌ | 1 menção (BP-FOC-13). Não distingue busca proprioceptiva de descarga de frustração de exploração destrutiva — **três causas com condutas opostas** |
| "Não gosta de brinquedos" | ❌ | ❌ | ❌ | **Zero**. Risco: insistir em brinquedo quando o caminho é objeto real / corpo / rotina |
| "Só gosta de telas" | ❌ | ⚠️ | ⚠️ | Zero sobre brincar; BP-FOC-18 dá o ângulo do adolescente. Cobertura por acidente |
| "Brinca sozinho" | ❌ | ❌ | ❌ | **Zero**. Risco ético: patologizar o brincar solitário, que é legítimo |
| "Não aceita o irmão" | ❌ | ❌ | ❌ | **Zero** |
| "Não entende faz de conta" | ❌ | ❌ | ❌ | **Zero**. Só 3 BPs com simbólico no núcleo, nenhuma sobre ausência |
| "Fala, mas não sustenta a brincadeira" | ⚠️ | ❌ | ❌ | 4 menções. **Confunde fala com brincar** — criança verbal com brincar imaturo é caso clássico e invisível aqui |
| "Grande, mas brinca de coisa de menor" | ⚠️ | ⚠️ | ❌ | 6 menções (idade mental). Zero BPs de brincar 13-18. **Risco máximo de infantilizar** |
| "Brincadeira pra estimular a fala" | ✅ | ✅ | ✅ | 16 BPs. **A melhor coberta de todas** — pausa expectante, imitar o som, expandir |
| "Atividade pra foco" | ✅ | ✅ | ✅ | 28 BPs. Bem coberta |
| **"Como usar o hiperfoco para brincar"** | ❌ | ❌ | ⚠️ | **ZERO BPs.** Só existe no código: o validador A3 e o `repertorio.ts` semanal. **O maior descompasso da auditoria** — é o diferencial declarado do produto e não tem uma linha de conhecimento |
| "Sem transformar a casa em clínica" | ❌ | ❌ | ⚠️ | 1 menção. O Core protege parcialmente ("a Kolo forma cuidadores, não terapeutas") |

**Cinco situações de dezessete estão bem servidas. Sete têm cobertura zero.** E as sete são
justamente as que uma mãe de criança autista traz na primeira semana.

---

## PARTE 4 — Personalização

| Critério | Está no raciocínio? | Evidência |
|---|---|---|
| Idade cronológica | ✅ forte | Faixa em toda BP; seletor filtra por ela desde a Fase 1; regras duras no prompt |
| **Estágio funcional** | ❌ **ausente** | Não existe campo, nem conceito. **É a lacuna estrutural**: sem estágio, idade vira o único critério |
| Linguagem / nível verbal | ⚠️ parcial | 13 BPs citam "não-verbal"; nenhuma liga isso à escolha da brincadeira |
| Comunicação não verbal | ⚠️ | Dentro de Comunicação |
| **Comunicação alternativa (CAA)** | ❌ | **1 BP em 368** (BP-EMO-42) |
| Interesses | ✅ | Perfil + validador A3 + `repertorio.ts` |
| **Hiperfoco** | ⚠️ mecanismo sim, conhecimento não | `repertorio.ts` faz a ponte; zero BPs explicam como |
| Perfil sensorial | ✅ | 26 BPs + o output_type cita explicitamente |
| Habilidades motoras | ✅ | 30 BPs |
| Regulação emocional | ✅ | 51 BPs |
| Atenção | ✅ | 28 BPs |
| Tolerância à frustração | ⚠️ | 35 menções a frustração; 1 BP de brincar (BP-EMO-07) |
| Nº de participantes | ⚠️ | Só o chip "em dupla" |
| **Presença de irmãos** | ❌ | Zero |
| Ambiente / **espaço pequeno** | ❌ | Zero |
| Materiais disponíveis | ✅ | Output_type pede "materiais simples"; 10 BPs citam objetos de casa |
| **Tempo disponível** | ⚠️ | Output_type pede "duração estimada"; nada no conhecimento |
| **Energia da família** | ❌ | Zero. O Core acolhe a exaustão, mas nada adapta a brincadeira a ela |
| Objetivo de desenvolvimento | ⚠️ | Implícito na skill; nunca declarado |

**Sete de vinte critérios não fazem parte do raciocínio.** O mais grave é **estágio funcional** —
sem ele, a idade cronológica vira critério único, que é exatamente o risco 8 da Parte 8.

---

## PARTE 5 — Adaptação

| Saber adaptar para… | Status | Evidência |
|---|---|---|
| Simplificar | ⚠️ parcial | 6 menções |
| Aumentar dificuldade | ✅ | 29 menções, com progressão explícita em esconde-esconde |
| Criança não verbal | ⚠️ | 13 menções; sem ligação com brincadeira |
| **Deficiência motora** | ❌ **ausente** | **0** |
| **Deficiência visual** | ❌ **ausente** | **0** |
| **Deficiência auditiva** | ❌ **ausente** | **0** |
| Hipersensibilidade | ⚠️ | Termo literal: 0. Coberto por outras palavras no domínio sensorial |
| Busca sensorial | ⚠️ | 5 menções |
| Pouca tolerância à espera | ❌ | 0 |
| Frustra fácil | ⚠️ | 35 menções; 1 BP de brincar |
| **Adolescentes** | ❌ | 62 BPs citam adolescente; **0 sobre brincar** |
| Materiais simples | ✅ | 10 BPs + output_type |
| **Espaço pequeno** | ❌ | 0 |
| **Adaptar para escola** | ❌ | 1 menção |
| **Incluir irmãos** | ❌ | 0 |

A base **assume uma criança que vê, ouve e se move**. Para um produto que atende neurodivergência
ampla — e cujo onboarding aceita "Outro" como diagnóstico — isso é um pressuposto silencioso e
arriscado.

---

## PARTE 6 — Habilidade → brincadeira

| Habilidade | Brincadeira na base | Progressão? | Reconhece evolução? | Sabe quando avançar? |
|---|---|---|---|---|
| Atenção compartilhada | BP-FOC-21 (rosto próximo, movimento lento) | ⚠️ marco etário | ✅ "brota 8-10 meses" | ❌ |
| Intenção comunicativa | BP-COM-13 (imitar som + pausa) | ✅ | ⚠️ | ❌ |
| Pedido | ❌ | — | — | — |
| Recusa | ❌ | — | — | — |
| Imitação | 12 BPs | ✅ a melhor do acervo | ✅ | ⚠️ |
| Linguagem receptiva | BP-COM-14 (narrar) | ⚠️ | ❌ | ❌ |
| Linguagem expressiva | BP-COM-03 (expandir) | ✅ | ⚠️ | ❌ |
| Turnos | BP-EMO-10 (uma linha) | ❌ | ❌ | ❌ |
| Espera | ❌ | — | — | — |
| Controle inibitório | ❌ | — | — | — |
| Flexibilidade | ⚠️ diluído | ❌ | ❌ | ❌ |
| Planejamento | ❌ | — | — | — |
| Memória de trabalho | ❌ | — | — | — |
| Coordenação motora | 10 BPs | ⚠️ | ⚠️ | ❌ |
| Motricidade fina | BP-MOT-03 | ⚠️ | ❌ | ❌ |
| Equilíbrio | ✅ | ⚠️ | ❌ | ❌ |
| Autonomia | 3 BPs | ❌ | ❌ | ❌ |
| Reconhecer emoções | ⚠️ (guia Emocional) | ❌ | ❌ | ❌ |
| Resolução de conflitos | ⚠️ | ❌ | ❌ | ❌ |
| Cooperação | BP-SOC-03 | ❌ | ❌ | ❌ |
| Criatividade | ❌ | — | — | — |
| Brincar simbólico | 3 BPs | ❌ | ❌ | ❌ |
| Socialização | 10 BPs | ⚠️ | ⚠️ | ❌ |

**Nenhuma linha da tabela tem "sabe quando avançar" preenchido.** A base sabe *o que fazer*; não
sabe *o que vem depois*, nem *como saber que é hora*. É a mesma conclusão da auditoria da base de
conhecimento (faltam mecanismo, indicador de evolução e próximo passo) — reaparecendo aqui.

---

## PARTE 7 — Linguagem para famílias leigas

**O que protege hoje:** o Core proíbe jargão clínico e frase de atendimento
([diretrizes.ts:120](../apps/web/src/lib/conducao/diretrizes.ts#L120)); os vetos da base proíbem
nome de método e de autor; o validador de tom roda na web.

**O que encontrei de problema no acervo, com ID:**

| Achado | Exemplo real | Por quê |
|---|---|---|
| **Anglicismo cru** | BP-EMO-10: *"Game de turns (você-eu)"* · BP-MOT-01: *"tummy time"* · BP-FOC-26: *"cérebro stressed"* | Mãe leiga não entende. "Tummy time" já circula, "game de turns" não existe em português nenhum |
| **Termo técnico sem tradução** | BP-FOC-21: *"Atenção compartilhada brota entre 8-10 meses"* | Correto clinicamente, opaco para a mãe. Falta a tradução |
| **Sintaxe de manual, não de conversa** | BP-IMI-13: *"Bater palma LENTO e audível. Agite braços. Sacuda cabeca. Mostre enquanto FALA."* | Caixa alta imperativa + telegráfico. É anotação de terapeuta |
| **Lista de sintomas como abertura** | BP-EMO-10: *"Não compartilha brinquedo, não compreende turno, não percebe quando machucou"* | Abre pelo déficit. A mãe lê isso como diagnóstico do filho |
| **"Estimular"** | 30 BPs | O verbo carrega a lógica de intervenção que o método Kolo rejeita |
| **"Corrigir"** | 27 BPs | Idem |
| **"Normalizar"** | 18 BPs | Ambíguo: "normalizar o sentimento" (bom) × "normalizar a criança" (grave) |
| Erros de digitação | *"cabeca"*, *"convitem"*, *"options"*, *"aliento"*, *"Bebé"* (galego/pt-PT) | Chegam ao prompt como estão |

**Ressalva importante e favorável:** as 102 ocorrências de "forçar" que a busca levantou são, na
amostra que li, **vetos corretos** — *"Forçar antes deixa cicatrizes emocionais"* (BP-APR-16),
*"Não force, observe quando o bebê está vocal"* (BP-COM-13). O acervo usa a palavra para proibir,
não para mandar. Isso é sinal de curadoria consciente.

**Como deveria falar** — o padrão que o próprio acervo já atinge nas melhores BPs: BP-SOC-15,
*"Dois bebês brincando perto um do outro, sem 'compartilhar', é SUCESSO SOCIAL"*. Concreta, explica
o porquê, tira a culpa, cabe na rotina. Essa é a régua.

---

## PARTE 8 — Riscos clínicos e éticos

| # | Risco | Onde aparece | Por que é problema | Como corrigir |
|---|---|---|---|---|
| 1 | **Prescrever contato visual** | **BP-COM-12**: *"Estabeleça contato visual frequente durante interações. Observe se o bebê mantém o olhar"* · BP-COM-02 e **BP-IMI-02**: *"Faça contato visual durante as interações para capturar atenção"* | ⚠️ **O achado mais sério.** Em criança autista, buscar contato visual pode aumentar a carga e reduzir o processamento. Nenhuma das três traz ressalva | Reescrever como *disponibilidade* de olhar, não meta; acrescentar a exceção explícita |
| 2 | Retirar objeto para provocar pedido | **0 ocorrências** | — | ✅ ausente, e é bom que esteja |
| 3 | Ajuda física / mão sobre mão | **0** | — | ✅ ausente |
| 4 | Invalidar brincadeira repetitiva | **0 explícito** — mas as 8 menções a "girar" não ensinam a entrar na repetição | Por omissão, a Ayla improvisa. Sem orientação, o padrão cultural é interromper | Precisa de conteúdo, não de correção |
| 5 | Cócegas / toque sem consentimento | **0** | — | ✅ ausente. E 5 BPs falam em respeitar recusa |
| 6 | Hiperfoco como recompensa | 14 menções — **todas corretas**: BP-MOT-30 *"Movimento é regulação, não recompensa"*; BP-NUT-05 *"Usar comida como recompensa"* está listado como ERRO | ✅ O veto do Core está internalizado no acervo | Nada a fazer |
| 7 | Promessa de desenvolvimento da fala | 2 menções, ambas em contexto de ressalva | Baixo | Monitorar |
| 8 | **Idade cronológica como critério único** | Estrutural: toda BP tem faixa; **nenhuma tem estágio funcional** | Criança de 9 anos com brincar de 3 recebe conteúdo de 9 — ou é infantilizada | Introduzir estágio funcional (ver Parte 12) |
| 9 | **Infantilizar criança maior** | 0 BPs de brincar em 13-18; 2 menções a "infantilizar" | O Core protege no tom; o **conteúdo** não existe para sustentar | Conteúdo para 7-12 e 13-18 |
| 10 | Confundir ausência de fala com ausência de compreensão | ⚠️ risco por omissão | 13 menções a não-verbal, nenhuma ligada a brincar | Conteúdo |
| 11 | **Desconsiderar CAA** | **1 BP em 368** | Criança com prancha/PECS é invisível para o acervo | Conteúdo |
| 12 | Recomendar sem considerar perfil sensorial | ✅ protegido | Output_type exige "alinhadas ao perfil sensorial"; validador A3 exige interesse | — |
| 13 | Orientar além do limite da IA | ✅ protegido no Core (PISO) | Mas **zero critérios de encaminhamento** específicos de brincar | Acrescentar |

**Balanço:** dos quinze riscos listados, **cinco não existem na base** (e sua ausência é mérito da
curadoria), **quatro estão ativamente protegidos** pelo Core e pelo validador, **um é concreto e
precisa de correção pontual** (contato visual, 3 BPs), e **cinco são riscos por omissão** — a Ayla
improvisa porque não há conteúdo.

---

## PARTE 9 — Duplicações e fragmentação

| Conhecimento | Onde se repete | Versão mais completa | Fonte oficial recomendada |
|---|---|---|---|
| **Imitar a criança / devolver o som** | BP-IMI-14, BP-COM-13, BP-SOC-04 | **BP-COM-13** (imita + pausa expectante) | Núcleo de Brincar; Comunicação e Imitação consultam |
| **Pausa expectante** | BP-COM-13, BP-IMI-12, BP-IMI-14 | BP-COM-13 | Idem |
| **Usar o interesse** | Validador A3 (código) · output_type (código) · `repertorio.ts` (código) · **zero BPs** | `repertorio.ts` — o único com `evitar` e `jaTentados` | ⚠️ Existe só em código, sem conhecimento por trás |
| **Troca de turnos** | BP-EMO-10, BP-SOC-03, BP-IMI-14 | Nenhuma boa | Precisa ser escrita |
| **Progressão de dificuldade** | BP-FOC-22 (esconde-esconde), BP-APR-17, BP-EMO-20 | **BP-FOC-22** | Núcleo de Brincar |
| **Reduzir estímulo antes de brincar** | BP-FOC-19, BP-FOC-20, BP-SEN-14 + Core | BP-FOC-20 | Sensorial (já é dono) |
| **Escolha de 2 opções** | BP-AUT-15, BP-ROT-12 | BP-ROT-12 | Rotina (já é dono) |
| **Rotinas visuais** | BP-ROT-02 + feature do Lúdico + guia Rotina do PDF | O guia | Rotina |
| **Seguir a liderança da criança** | **0 ocorrências** | — | ❌ conceito central do brincar, ausente em toda a base |

**Fragmentação medida:** as 86 BPs de brincar estão distribuídas em **12 skills**, e em nenhuma
delas brincar é o objeto — é sempre o veículo. Uma mãe que pergunta sobre brincar é atendida por
Foco, ou por Imitação, ou por Socialização, dependendo de qual skill o roteador sortear. **O mesmo
assunto tem doze donos e nenhum responsável.**

---

## PARTE 10 — O que é exclusivo de brincar

> **Existe conhecimento clínico exclusivo sobre brincar que justifique um núcleo independente?**

**Sim — e é identificável com precisão.** É tudo o que trata do brincar como **objeto de
desenvolvimento**, não como veículo de outro domínio:

1. **A sequência de estágios do brincar** — exploratório → causa-e-efeito → funcional → construtivo
   → simbólico → sociodramático; e, em paralelo, solitário → paralelo → associativo → cooperativo.
   Isso não pertence a Comunicação nem a Socialização: é o mapa que diz **em que degrau a criança
   está**. Hoje: `funcional` = 0, `associativo` = 0, `simbólico` = 3.
2. **Como identificar o estágio observando a criança brincar** — a habilidade que responde "meu
   filho não sabe brincar". Nenhum outro domínio pode dar isso.
3. **O que fazer quando o brincar está travado num estágio** — girar, enfileirar, repetir o mesmo
   script. Conduta específica, e hoje inexistente.
4. **Como entrar na brincadeira da criança** (seguir a liderança, imitar, ampliar por dentro) —
   **zero ocorrências em toda a base**, e é o conceito mais central da mediação do brincar.
5. **Brincar repetitivo como legítimo × brincar travado** — a distinção ética que separa respeitar
   de intervir. Não tem dono hoje.
6. **A ponte hiperfoco → habilidade** — como transformar o interesse restrito em veículo de
   desenvolvimento sem transformá-lo em moeda. É o diferencial declarado do produto e tem **zero
   BPs**.
7. **Brincar do 7-12 e do adolescente** — jogos com regras, games, interesses maduros. Zero.

**O que NÃO é exclusivo e deve continuar onde está:** as atividades sensoriais (Sensorial), as
motoras (Motor), as de imitação precoce (Imitação), a pausa expectante (Comunicação), a rotina
visual (Rotina). São **ferramentas** que usam brincadeira — e movê-las criaria a duplicação que a
auditoria manda evitar.

A linha divisória é limpa: **o desenvolvimento DO brincar é exclusivo; o brincar como MEIO pertence
a quem já o usa.**

---

## PARTE 11 — Lacunas priorizadas

| # | Lacuna | Classificação | Por que faz falta | Onde prejudica | Quem preenche |
|---|---|---|---|---|---|
| 1 | **Estágios do brincar e como identificá-los** | 🔴 **crítica** | Sem isso a Ayla sugere no degrau errado e a mãe conclui que não funciona | "Não sabe brincar", "não entende faz de conta", "brinca de coisa de menor" | Karina / TO ou fono |
| 2 | **Brincar 13-18 anos** | 🔴 **crítica** | **Zero BPs.** Combinado com a regra anti-infantilização, a Ayla fica sem repertório | Toda família de adolescente | Karina |
| 3 | **Como usar o hiperfoco** | 🔴 **crítica** | Diferencial declarado do produto, com zero conhecimento por trás | "Como usar o interesse dele" | Karina |
| 4 | **Seguir a liderança / entrar na brincadeira** | 🔴 **crítica** | Conceito mais central da mediação, **zero ocorrências** | Todas as conversas de brincar | Karina |
| 5 | **Brincar repetitivo: quando respeitar, quando ampliar** | 🔴 **crítica** | Risco ético ativo — sem orientação, o padrão cultural é interromper | "Gira a rodinha", "enfileira" | Karina + revisão clínica |
| 6 | Corrigir as 3 BPs de contato visual | 🔴 **crítica** | Risco clínico concreto e localizado | BP-COM-02, COM-12, IMI-02 | Karina |
| 7 | Brincar entre irmãos | 🟠 importante | Zero, e é queixa frequente | "Não aceita o irmão" | Karina |
| 8 | Simbólico: progressão e o que fazer quando não emerge | 🟠 importante | 3 BPs para um estágio inteiro | "Não entende faz de conta" | Karina |
| 9 | Turnos e jogos com regras: progressão | 🟠 importante | 2 e 1 BPs | "Não sabe perder", "não espera a vez" | Karina |
| 10 | Adaptação para não-verbal e CAA | 🟠 importante | 1 BP em 368 | Criança com prancha | Karina + fono |
| 11 | Indicadores de evolução e critério de avançar | 🟠 importante | Zero em toda a tabela da Parte 6 | Acompanhamento ao longo do tempo | Karina |
| 12 | Brincar sozinho como legítimo | 🟠 importante | Zero; risco de patologizar | "Ele brinca sozinho" | Karina |
| 13 | Deficiência motora / visual / auditiva | 🟡 complementar | Zero, mas fora do público principal hoje | Casos específicos | Especialista externo |
| 14 | Espaço pequeno, tempo curto, energia da família | 🟡 complementar | Viabilidade real; o Core já acolhe exaustão | Mãe exausta | Karina |
| 15 | Brincar na escola / recreio | 🟡 complementar | Zero, mas há sobreposição com o relatório | Queixa escolar | Karina |
| 16 | Atividades sensoriais, motoras, de imitação precoce | ✅ **já suficiente** | 7, 10 e 12 BPs com boa densidade | — | — |
| 17 | Brincadeira para fala e para foco | ✅ **já suficiente** | 16 e 28 BPs | — | — |

---

## PARTE 12 — Decisão

### Recomendo a **Opção B** — módulo transversal menor. Não a A.

**Por que não a Opção A (núcleo completo).** Um núcleo completo de Brincar traria consigo um banco
de atividades — e o banco **já existe**: 86 BPs, o output_type `brincadeiras`, a seção obrigatória de
brincadeiras em todo plano, o `repertorio.ts`. Criar um núcleo completo significaria reescrever
atividade sensorial, motora e de imitação que já estão curadas e funcionando. Seria a duplicação que
a própria auditoria manda evitar, e o custo cairia sobre a Karina.

**Por que não a Opção C (integrar aos núcleos existentes).** Já está integrado — e é justamente o
problema. Doze skills contêm brincar e nenhuma responde por ele. Distribuir os estágios do brincar
entre Comunicação, Socialização e Imitação repetiria o mapa três vezes e as três versões divergiriam
em seis meses.

**Por que não a Opção D (só reorganizar).** Reorganizar não cria o que não existe: estágio funcional,
adolescente, hiperfoco, seguir a liderança, brincar travado. São cinco lacunas críticas com cobertura
literalmente zero. Nenhuma reorganização as produz.

### O que o módulo deve conter

**Exclusivo (produzir):**
1. Mapa de estágios do brincar + como identificar observando
2. Quando o brincar está travado — respeitar × ampliar
3. Como entrar na brincadeira (seguir a liderança, imitar, ampliar por dentro)
4. A ponte hiperfoco → habilidade
5. Brincar 7-12 e 13-18
6. Indicadores de evolução e critério de avançar de estágio
7. Adaptação: não-verbal/CAA, irmãos, espaço, tempo, energia da família
8. Critérios de encaminhamento

**Reaproveitar sem reescrever:** as 86 BPs existentes, o `repertorio.ts` (mecanismo de interesse
adjacente), o validador A3, o PISO do Core, o output_type `brincadeiras`, e a estrutura de faixa
etária do acervo.

**Corrigir pontualmente:** BP-COM-02, BP-COM-12, BP-IMI-02 (contato visual) e os anglicismos.

### Tamanho e posição

**Tamanho:** 8 capítulos, **12 a 18 páginas**. Aproximadamente 1/3 do que a Karina já escreveu nos
quatro guias — porque a maior parte do trabalho (atividades) já está feita.

**Posição na BIA:** camada de **raciocínio**, não de conteúdo. Fica ao lado do Core (`lib/conducao`),
não dentro de uma skill — porque é consultado por várias e não pertence a nenhuma. Concretamente: o
mapa de estágios e as regras de acionamento entram como conhecimento de condução; as ~40 orientações
novas entram como BPs normais, com uma skill `brincar` própria para poderem ser recuperadas.

---

## PARTE 13 — Mapa estrutural recomendado

**Nome:** Brincar e Desenvolvimento
**Objetivo:** dar à Ayla a capacidade de **ler o brincar de uma criança**, situá-lo num estágio,
decidir se respeita ou amplia, e transformar interesse em desenvolvimento — sem virar terapia em casa.

**Capítulos:**

1. **O que é brincar e por que importa** — princípios e o piso ético (repetitivo é legítimo; brincar
   não é tarefa; a casa não é clínica)
2. **Mapa dos estágios** — as duas linhas (com objetos / com pessoas), o que se observa em cada uma
3. **Ler o brincar** — como identificar o estágio pela observação; o que perguntar à mãe
4. **Quando está travado** — girar, enfileirar, repetir o script: respeitar × ampliar, e como
5. **Entrar na brincadeira** — seguir a liderança, imitar, ampliar por dentro, sair na hora certa
6. **Do interesse ao desenvolvimento** — a ponte do hiperfoco, e por que ele nunca é moeda
7. **Adaptar** — não-verbal e CAA, irmãos, espaço, tempo, energia da família, escola
8. **Crescer** — 7-12 e adolescência; indicadores de evolução; quando avançar; quando encaminhar

**Relação com os outros núcleos:**

```
                    BRINCAR E DESENVOLVIMENTO
                    (estágio · leitura · mediação)
                              │
        ┌──────────┬──────────┼──────────┬──────────┐
   Comunicação  Imitação  Socialização  Motor    Sensorial
   (pausa       (imitação  (paralelo →  (ativi-  (ativi-
    expectante)  precoce)   cooperativo) dades)   dades)

   Cada domínio CONSULTA o estágio; nenhum o redefine.
   As atividades continuam onde estão. O mapa fica aqui.
```

**Conhecimento exclusivo:** estágios, leitura, brincar travado, entrar na brincadeira, ponte do
hiperfoco, progressão e encaminhamento.
**Conhecimento compartilhado (referencia, não copia):** atividades sensoriais → Sensorial; motoras →
Motor; imitação precoce → Imitação; pausa expectante → Comunicação; rotina visual → Rotina.

**Regras de acionamento** (o momento em que a Ayla consulta este módulo):

| Quando | Aciona |
|---|---|
| A mãe descreve **como** a criança brinca | leitura de estágio |
| A mãe diz que a criança "não sabe brincar" ou não brinca com outras | leitura de estágio + mapa |
| Aparece brincar repetitivo (gira, enfileira, mesmo script) | capítulo 4 — **antes** de qualquer sugestão |
| A mãe pede atividade para uma habilidade | estágio primeiro, depois a atividade do domínio |
| O perfil tem interesse forte registrado | capítulo 6 |
| A criança tem 7+ anos | capítulo 8 — trava contra infantilizar |
| A conversa é sobre irmãos brincando | capítulo 7 |
| **Não aciona** quando a brincadeira é só o contexto (comer brincando, transição lúdica) | — |

---

## Resposta à pergunta final

> **A Ayla precisa aprender mais sobre brincar, ou precisa organizar melhor o que já tem?**

**As duas coisas, e em proporções que a auditoria permite medir.**

Ela tem **86 boas práticas em que brincar é o assunto** — isso não é pouco, e a qualidade em vários
casos é alta (BP-FOC-21 sobre atenção compartilhada, BP-SOC-15 sobre brincar paralelo, as doze de
imitação). Nesse recorte, o problema é **organização**: o conhecimento está fragmentado em doze
skills, ninguém responde por ele, e a recuperação depende de qual skill o roteador sorteia.

Mas há um recorte inteiro em que **não há o que organizar, porque não existe**: nenhuma BP trata do
brincar como desenvolvimento. Zero sobre estágio funcional. Zero para adolescentes. Zero sobre como
usar o hiperfoco — que é o diferencial anunciado do produto. Zero sobre seguir a liderança da
criança, que é o conceito mais central da mediação do brincar. Zero sobre o que fazer quando ela
gira a rodinha.

A formulação mais precisa que consigo dar é esta: **a Ayla tem um bom banco de atividades e não tem
um raciocínio sobre o brincar.** Ela sabe o que propor; não sabe ler onde a criança está, nem decidir
se aquela proposta cabe. Por isso o material novo é pequeno em volume — 12 a 18 páginas — e grande em
efeito: não é mais atividade, é a lente que decide qual das 86 usar.

E respondendo diretamente ao que motivou tudo isto: para a mãe que diz *"meu filho não sabe
brincar"*, a Ayla hoje tem duas boas práticas tangenciais e nenhum mapa. Ela vai responder bem — com
carinho, com uma sugestão plausível — e vai errar o degrau. A mãe vai tentar, não vai funcionar, e
vai concluir que o problema é o filho.
