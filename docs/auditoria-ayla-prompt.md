# Auditoria da Ayla — estado atual do "cérebro" (pra revisar com o ChatGPT)

> Documento pra compartilhar no ChatGPT. Descreve, **em cima do código real** (não de memória), como a Ayla é instruída hoje: identidade, raciocínio, voz, memória, ferramentas, regras e prompts especializados. No fim, o **diagnóstico do Claude Code** (quem leu o código) apontando redundâncias, regras que poderiam virar princípios, e a maior lacuna: **não existe hoje uma camada de "condução" — a Ayla decide a ferramenta por um classificador raso, não pela necessidade profunda da família.**

---

## Como a Ayla é montada hoje (visão de arquiteto)

A Ayla tem **dois canais** que eram prompts separados e agora dividem as diretrizes de conversa (`lib/conducao/diretrizes.ts`):
- **WhatsApp (reativa)** — `lib/ayla/responder.ts`.
- **Estratégias (web)** — `lib/ia/prompt.ts`.

O **system prompt da reativa** é montado por concatenação, nesta ordem:

```
voz_ayla (identidade — vem do banco; fallback no código)
+ DIRETRIZ_CONVERGIR      (não interrogar em loop)
+ DIRETRIZ_SUBSTANCIA     (ter profundidade quando é prático)
+ DIRETRIZ_FUNDO          (um tema por vez, perfil no centro)
+ DIRETRIZ_HIPOTESES      (investigar, não concluir)
+ DIRETRIZ_CRISE          (risco/segurança)
+ DIRETRIZ_FRUSTRACAO     (frustração numa atividade)
+ DIRETRIZ_HABILIDADE     ("ele não é capaz" → habilidade)
+ DIRETRIZ_ESCOLA         (queixa de escola → caminho)
+ DIRETRIZ_CAUTELA        (não afirmar direito/saúde com falsa certeza)
+ DIRETRIZ_TOM            (acalmar, não pôr lenha)
+ DIRETRIZ_IDIOMA         (responder na língua da mãe)
```

Depois, **por turno**, entram como contexto (não como regra): quem é o cuidador/criança, `<o_que_ja_sabemos_da_crianca>` (perfil), `<lacunas_do_perfil>`, conversa recente, `<notas_internas>` (avisos situacionais) e, se houver, a `<foto>`.

**Observação de arquiteto:** repare que **11 blocos de regra** vêm ANTES de qualquer raciocínio sobre a família. A Ayla recebe um manual e um contexto — e escreve. Não há um passo explícito de "o que essa família precisa agora?". É esse o ponto central da revisão.

---

## Bloco 1 — Identidade da Ayla

> ⚠️ **Drift detectado:** a identidade roda a partir da tabela `ai_prompts` (key `voz_ayla`). O texto **no banco** (seed) está mais ANTIGO que o **fallback no código**. Se o banco foi semeado, produção usa a versão antiga (abaixo, "versão banco"). O ideal (versão código) é mais rico. **Isso precisa ser reconciliado.**

**Versão que RODA (banco / seed — possivelmente em produção):**
```
Você é a Ayla — uma presença calma, experiente e afetuosa que apoia mães e pais de
crianças atípicas pelo WhatsApp. Você NÃO é um robô nem um aplicativo: fala como uma
pessoa que entende de neurodivergência e do cansaço de cuidar.
(+ seções "Como você fala", "O que fazer em cada caso", "Limites", "Saída" —
 versão curta; ainda fala "perrengue" e "crianças", 2 a 5 frases)
```

**Versão INTENÇÃO (código, `VOZ_AYLA_FALLBACK`) — mais atual:**
```
Você é a Ayla — uma presença calma, experiente e afetuosa que apoia mães, pais e
cuidadores de pessoas atípicas (crianças, adolescentes ou adultos) pelo WhatsApp.
Você NÃO é um robô nem um aplicativo: fala como uma pessoa que entende de
neurodivergência e do cansaço de cuidar.
```
+ seções: **Como você fala** (curto e quente, no máx 2 balões, sem jargão, 2ª pessoa, no máx 1 pergunta, idade importa) · **Como acolher** (acolhimento em NO MÁXIMO 1 frase, ir pro prático rápido) · **O que fazer em cada caso** (só conta o dia / pergunta ou crise / mensagem vaga) · **Limites** (sem diagnóstico, sem moldura clínica não pedida, risco → encaminha, não inventar fatos, sem recompensa estilo ABA, não presumir quem mora no lar) · **Saída** (texto puro de WhatsApp, sem markdown).

**O que a identidade NÃO diz hoje (lacuna):** não há uma **missão** no sentido que você quer ("conduzir a família no desenvolvimento da criança ao longo do tempo"), nem um **norte** ("deixar a família menos perdida e a criança mais perto da próxima habilidade"). A identidade descreve **como falar**, não **pra onde conduzir**.

---

## Bloco 2 — Processo de raciocínio (o mais importante — e o mais fraco)

**Hoje NÃO existe um processo de raciocínio explícito.** O fluxo real é:

```
mensagem chega
→ acha a família pelo número
→ checa bloqueio / assinatura
→ classifica INTENÇÃO (Haiku): rotina_criar | rotina_ver | rotina_editar | plano | outro
→ roteia pra ferramenta correspondente (condutor de rotina / fluxo de plano / responder reativo)
→ o responder recebe as 11 diretrizes + contexto e escreve
```

Ou seja: a "decisão" que a Ayla toma é só **qual das 4-5 ferramentas** usar, por um classificador de intenção **raso** (é rotina? é plano? senão, "outro"). Não há:
- leitura da **emoção** da mãe;
- leitura da **necessidade profunda** (o "não sei nada" = pedido de direção; o "ele não é capaz" = pedido de esperança);
- noção de **em que fase da jornada** a família está;
- noção de **qual habilidade** da criança está em desenvolvimento.

As diretrizes (bloco 6) tentam suprir isso caso a caso ("se for frustração, faça X"; "se for escola, faça Y") — mas isso é o **oposto** de um raciocínio: é uma pilha de reflexos condicionados. É exatamente o "manual de procedimentos" que engessa.

> **Esta é a lacuna que o conceito de "Motor de Condução" / "necessidade profunda" preenche.**

---

## Bloco 3 — Voz da Ayla

Espalhada entre a identidade (seção "Como você fala"/"Como acolher") e `DIRETRIZ_TOM`:

- Curto e quente, WhatsApp, no máx 2 balões; sem jargão clínico nem frase de atendimento.
- Varie sempre, nunca soe formulário; no máx 1 pergunta.
- 2ª pessoa, de perto; concordância de gênero; idade importa (adulto ≠ criança).
- Acolhimento em **1 frase** e vai pro prático (não gastar 2 balões em sentimento).
- **TOM (`DIRETRIZ_TOM`):** acalmar, não pôr lenha; nunca dramatizar/rotular; validar em 1 frase + 1 passo pequeno; **evitar clichês de IA — não abrir com "Respira"**.
- Saída: texto puro de WhatsApp, sem markdown, `*um asterisco*` com parcimônia.

**Tensão de arquiteto:** a voz manda "curto, no máx 2 balões, 1 pergunta" — mas `DIRETRIZ_SUBSTANCIA` manda "aqui o limite de 2 balões NÃO vale, aprofunde". Duas regras se puxando. Um bom princípio ("dê o espaço que a necessidade pede, nem mais nem menos") resolveria as duas.

---

## Bloco 4 — Memória

A Ayla monta a memória por turno a partir de várias fontes (é boa, mas **passiva** — entra como texto no contexto, não é "consultada" ativamente):

- **Perfil (`Kolo Vivo`)** — `<o_que_ja_sabemos_da_crianca>`: resumo do perfil por domínio. Auto-incorporação (o que a mãe conta vira perfil sem aprovação).
- **Lacunas** — `<lacunas_do_perfil>`: por domínio, o que o perfil já tem × o que falta, pra perguntar só o pertinente.
- **Linha do tempo (`eventos_membro`)** — eventos importantes (troca de professora, mudança de escola, início de terapia…) que a Ayla detecta e grava; hoje usados no relatório.
- **Aprendizado de planos** — `carregarAprendizado`: lê planos passados com resultado ("funcionou/parcial/não") e injeta `<o_que_ja_funcionou>` na geração do próximo plano.
- **Conversa recente** — últimas trocas; **Estratégias recentes** — títulos das últimas conversas no app.

**Limitações (honestas):**
- A memória guarda **fatos e resultados de plano**, mas **não guarda**: em que **fase da jornada** a mãe está, qual **habilidade** da criança está em foco, nem o **estado emocional** dela ao longo do tempo.
- Não há "como o diagnóstico aparece NESTA criança" nem "estratégias testadas com nível de confiança" como estrutura consultável — só texto de perfil + resultado binário de plano.
- A memória é **injetada**, não **raciocinada**: nada força a Ayla a perguntar "quais características desta criança importam PRA ESTA situação?" antes de responder (o risco do "como ele tem TDAH, TDL e gosta de dinossauro…").

---

## Bloco 5 — Ferramentas (quem decide qual usar)

Ferramentas que a Ayla pode acionar: **conversa (responder reativo)**, **rotina visual** (fluxo conduzido próprio), **plano** (fluxo guiado → gera PDF+link), **relatório** (a web gera; a Ayla manda o link), **história / desenho / avatar** (links do Lúdico).

**Quem decide:** o **classificador de intenção** (Haiku, 4-5 rótulos) + regex de reforço (`pedeRotina`, `pedeUmPlano`) + ofertas condicionais dentro das notas (`linksLudico`). 

**Problema de arquiteto:** a escolha da ferramenta acontece **ANTES** de entender a necessidade — e só distingue rotina × plano × outro. Não existe a pergunta "qual recurso ajuda MAIS esta família agora?". Uma mãe perdida cai em "outro" (conversa) e recebe mais perguntas, quando precisava de direção. É o "GPS", não o "guia de montanha".

---

## Bloco 6 — Regras (agrupadas)

As "regras" são as diretrizes injetadas. Agrupando por intenção:

**A. Como conduzir a conversa**
- `CONVERGIR` — entregar algo concreto já, não interrogar em loop.
- `FUNDO` — um tema por vez, fundo; perfil no centro; mediar (conduzir a mãe a resolver), não só explicar; não inflamar queixa; não terminar toda msg com pergunta.
- `SUBSTANCIA` — quando é prático (comida, estratégia), dar 3-5 opções corretas e específicas (aqui o "2 balões" não vale).
- `HIPOTESES` — investigar com 2-3 hipóteses, não concluir; separar fato de hipótese; não inventar característica; correlação ≠ causa; **regra de ouro: não terminar só com perguntas, enquadrar como construção do relatório**.

**B. Momentos difíceis**
- `CRISE` — risco/segurança primeiro; SAMU 192 / CVV 188; sinais que pedem profissional.
- `FRUSTRACAO` — criança travou/explodiu numa atividade: não reexplicar, entender a emoção, orientar o agora, oferecer adaptar, aprender.
- `HABILIDADE` — "ele não é capaz" = mãe exausta pedindo direção: acolher+reenquadrar (não é incapacidade, é habilidade a construir), separar o incêndio de agora do desenvolvimento, responder em 3 níveis (agora/semanas/autonomia), oferecer plano.

**C. Escola & direitos**
- `ESCOLA` — queixa de escola → não concluir, oferecer caminhos (roteiro escola / avaliar nova / relatório), conectar ao perfil.
- `CAUTELA` — não afirmar direito/lei/saúde com falsa certeza; não ser agressiva; não tomar protagonismo jurídico; voltar pra criança.

**D. Tom & forma**
- `TOM` — acalmar, não pôr lenha; sem clichê "Respira".
- `IDIOMA` — responder na língua da mãe (pt/es/en), sem misturar.

**E. Só na web (`VOZ_E_LIMITES` + `blocoIntencao`)**
- Voz do produto (hipóteses não causas, amiga não terapeuta, sem citar metodologia, sem termo clínico, sem comparar crianças, sem recompensa ABA, materiais seguros).
- `blocoIntencao` — crise/desabafo/dúvida/desafio moldam a resposta; o "desafio" emite o marcador que mostra o botão "Montar plano".

**Redundâncias visíveis:** "não inventar fatos" aparece na identidade, em `HIPOTESES` e em `VOZ_E_LIMITES`. "Não terminar com pergunta" aparece em `FUNDO`, `HIPOTESES` e na web. "Não inflamar escola" aparece em `FUNDO`, `ESCOLA`, `CAUTELA` e `TOM`. Muita sobreposição → candidato a consolidar em princípios.

---

## Bloco 7 — Prompts especializados (mapa)

| Prompt / system | Arquivo | Papel | Modelo |
|---|---|---|---|
| **Identidade `voz_ayla`** | banco `ai_prompts` + `responder.ts` (fallback) | quem a Ayla é (WhatsApp) | — |
| **Reativa (resposta)** | `lib/ayla/responder.ts` | escreve a fala; junta as 11 diretrizes | Sonnet |
| **Classificador de intenção** | `lib/ayla/intent.ts` | rotina/plano/outro | Haiku |
| **Condutor de rotina** | `lib/ayla/rotina-guiada.ts` (`SYSTEM_CONDUZIR`) | monta a rotina visual passo a passo | Sonnet |
| **Fluxo de plano guiado** | `lib/ayla/plano-guiado.ts` + `ponte.ts` | pergunta o desafio, gera plano, entrega | Sonnet |
| **Gerador de plano** | `lib/ia/plano.ts` (`montarSistemaPlanoCompleto` + receitas por seção) | monta as seções do plano | Sonnet |
| **Extrator de eventos** | `lib/ayla/eventos.ts` | detecta evento pra linha do tempo | Haiku |
| **Relatório escola (Guia)** | `lib/relatorio/gerar.ts` (`SYSTEM_ESCOLA`) | guia de boas-vindas pra escola | Sonnet |
| **Relatório clínico (Resumo)** | `lib/relatorio/gerar.ts` (`SYSTEM_TERAPEUTA`) | resumo pra médico/terapeuta | Sonnet |
| **Estratégias (web) — conversa** | `lib/ia/prompt.ts` (`buildSystemTextConversa`) | a "Ayla" do app; agora com as diretrizes compartilhadas | Sonnet |
| **Estratégias (web) — botões** | `lib/ia/prompt.ts` (`buildSystemTextOutputType`) + `output_types` (banco) | 7 formatos de apoio | Sonnet |

**Achado:** cada especializado tem sua própria "voz" e suas próprias regras. Não há uma **identidade única** injetada em todos — então a Ayla pode "trocar de personalidade" entre o WhatsApp, o plano e o relatório. (É o ponto do ChatGPT sobre consistência.)

---

# Diagnóstico do Claude Code (quem leu o código)

Concordo com a tese central: **o maior ganho não é mais uma feature — é uma camada de condução + uma identidade única, e MENOS regras, não mais.** Em cima do código, aponto:

### 1. Falta a camada de raciocínio (a mais importante)
Hoje a Ayla vai de "mensagem" a "resposta" com um desvio raso (classificar rotina/plano/outro). **Proposta concreta e barata:** um bloco curto de PRINCÍPIOS no **topo** do system (antes das 11 diretrizes) que force, em toda resposta, uma reflexão interna: *qual a emoção? qual a necessidade profunda? em que ponto da jornada? qual habilidade? qual recurso ajuda mais — que pode ser só uma frase de esperança?* Isso reenquadra tudo que vem abaixo sem apagar nada.

### 2. Regras demais, princípios de menos
As 11 diretrizes têm muita sobreposição (não inventar, não terminar com pergunta, não inflamar aparecem 3-4× cada). Dá pra **destilar em ~5 princípios fortes** e deixar as diretrizes específicas só como *exemplos* subordinados a eles. Prompt menor conversa melhor.

### 3. Identidade fragmentada + drift
(a) O `voz_ayla` do **banco está atrás** do código — reconciliar já. (b) Não há **missão/norte** na identidade. (c) Cada prompt especializado tem voz própria → **extrair uma identidade única** (como as diretrizes já viraram fonte única) e injetar em todos.

### 4. Memória passiva
A memória é rica mas **injetada, não consultada**. Falta o hábito de "quais traços desta criança importam PRA ESTA situação" e o registro de **jornada da mãe** + **habilidade da criança em foco** (as duas "máquinas de estado" que o ChatGPT descreve). Isso conecta com a ideia de plano→trilha.

### 5. Escolha de ferramenta cega à necessidade
A ferramenta é decidida antes de entender a família e só distingue rotina/plano/outro. Se a camada de raciocínio (item 1) existir, a escolha de recurso passa a ser consequência da necessidade — não de um classificador.

### O que eu mudaria primeiro (ordem)
1. **Identidade + norte únicos** (curto, forte) — reconcilia o drift e dá missão.
2. **Bloco de princípios de condução** no topo (substitui a lógica "responder pela última pergunta").
3. **Destilar as 11 diretrizes** em ~5 princípios + exemplos subordinados (menos engessamento).
4. Depois: memória de jornada/habilidade + plano→trilha (estrutura), já sobre uma base sólida.

> Norte que eu proporia (rascunho pra vocês lapidarem): *"A Ayla é uma parceira de jornada. Cada conversa deve deixar a família um pouco menos perdida e a criança um pouco mais perto da próxima habilidade. Antes de responder, entenda a necessidade profunda — depois escolha naturalmente a melhor ajuda (uma explicação, um plano, uma brincadeira, um relatório, uma pergunta ou só acolhimento). Nunca conduza pela ferramenta; conduza pela família. O sucesso não é a resposta — é o próximo pequeno avanço."*
