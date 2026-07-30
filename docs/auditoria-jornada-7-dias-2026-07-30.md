# Auditoria da jornada dos primeiros 7 dias

**Data:** 30/07/2026 · **Nada foi alterado no código.** Toda afirmação sobre o que acontece hoje
aponta arquivo e linha. As simulações estão marcadas como simulação.

**Critério adotado, conforme pedido:** não proponho aumentar o número de funcionalidades
apresentadas. Avalio ordem, momento e forma — buscando confiança, resultado concreto pequeno e
vontade de continuar.

---

## Resumo executivo

**A jornada de 7 dias não existe como jornada.** Existe uma máquina de mensagens proativas
disparada por *estado* (silêncio, sexta-feira, plano entregue, fim do trial), nunca por *dia do
teste*. Nenhum lugar do código sabe que a família está no dia 3. Não há `dia_do_trial` em nenhuma
consulta.

Os cinco achados:

1. **Quem se engaja recebe menos.** A regra "já conversamos hoje"
   ([rules.ts:145-159](../apps/web/src/lib/ayla/rules.ts#L145-L159)) bloqueia qualquer proativa se a
   mãe escreveu qualquer coisa naquele dia. A mãe mais engajada do teste — que escreve todo dia —
   **nunca recebe uma segunda mensagem proativa depois das boas-vindas.** Ela nunca descobre rotina
   visual, relatório ou histórias, porque quem apresentaria isso é justamente a proativa.
2. **Os desafios do onboarding são gravados e praticamente descartados.** A família marca vários
   (não três) e só o **primeiro** é lido, **uma vez**, na mensagem de boas-vindas
   ([orchestrator.ts:142-143](../apps/web/src/lib/ayla/orchestrator.ts#L142-L143)). Depois disso,
   nunca mais. Detalhe na Parte 2.
3. **Os dois marcos de celebração são matematicamente inalcançáveis no teste.**
   `emocional_streak` exige 7 dias consecutivos de check-in respondido
   ([cron:463-482](../apps/web/src/app/api/ayla/cron/route.ts#L463-L482)) — só poderia disparar
   exatamente no dia 7. `plano_seguimento` só olha planos com 3 a 14 dias
   ([cron:653-656](../apps/web/src/app/api/ayla/cron/route.ts#L653-L656)) — se o plano saiu no dia
   4, o seguimento cai no dia 7 no melhor caso, ou depois do trial. **A mãe termina o teste sem
   nenhuma celebração de evolução.**
4. **O relatório — o artefato que mais impressiona — passa fome no teste.** A estrutura é
   excelente (16 seções para escola, 15 para terapeuta), mas se alimenta de diários dos últimos 60
   dias, de ≥2 snapshots mensais e da linha do tempo
   ([gerar.ts:177-220](../apps/web/src/lib/relatorio/gerar.ts#L177-L220)). No dia 5 de teste
   existem 2 ou 3 diários e zero snapshots: o guia sai com metade das seções puladas.
5. **A descoberta de funcionalidade é quase toda reativa.** De dez recursos, **um** aparece
   sozinho no WhatsApp. Os outros dependem de a mãe pedir, ou de ela achar no menu do app. Tabela
   na Parte 4.

Uma observação sobre o pedido: você pede simulação de **plano semanal**. Ele **não existe** — o
catálogo fechado tem três artefatos (plano estratégico, rotina visual, relatório), e o Core proíbe
explicitamente prometer documento fora dessa lista
([diretrizes.ts:104-111](../apps/web/src/lib/conducao/diretrizes.ts#L104-L111)). Simulei o que
existe e é mais próximo — a **rotina da semana** — e digo na Parte 8 o que faltaria para haver um
plano semanal de verdade.

---

## Parte 1 — A jornada real, etapa por etapa

### Cadastro → onboarding

Onboarding **conversacional** (a Ayla "conversa" em chips e campos, não é formulário). Ordem real
em [copy-default.ts](../apps/web/src/lib/onboarding/copy-default.ts), persistência em 4 checkpoints
([salvar-conversacional.ts](../apps/web/src/lib/onboarding/salvar-conversacional.ts)):

| Pergunta | Vira o quê |
|---|---|
| Nome da criança, gênero, nascimento | `membros_atipicos` |
| Diagnóstico com laudo (multi) | `diagnosticos_formais`, `perfil` |
| Em investigação, sem laudo (multi, opcional) | idem, como hipótese |
| **"O que mais pesa no dia a dia agora? Pode marcar vários"** — 9 opções | `categorias_extras.desafios_onboarding` + seções vazias `{texto:""}` |
| Interesses (multi, por idade) | `como_e.interesses` + `preferencias.temas` |
| WhatsApp | `family_accounts.whatsapp_e164` + checagem de duplicado |
| Nome e relação do responsável | `family_profiles` |
| Aceites (termos + opt-in Ayla) | `ayla_preferences.consentimento_em` |
| Melhor horário (manhã/meio-dia/tarde/noite) | janela de 2h em `horario_preferido_*` |

Concluído → `sendBoasVindas` dispara na hora, fora da janela de horário (é a única proativa isenta).
Segundo a memória do projeto: 50% concluem, e 2/3 do abandono acontece nas 7 primeiras perguntas.

### O que dispara em cada dia — o mapa real

Não há cron "dia N do trial". Há oito gatilhos independentes. Traduzindo para os 7 dias:

| Dia | O que realmente pode sair | Gatilho |
|---|---|---|
| **0** | **Boas-vindas** citando o 1º desafio marcado, com pergunta fácil e convite a áudio | fim do onboarding |
| **1** | Pergunta diária (`rotina`) na janela escolhida | `?tipo=rotina`, a cada 30min |
| **2** | Pergunta diária · **ou** `engajamento_2dias` se ela não respondeu nada | rotina · inatividade |
| **3** | Pergunta diária | rotina |
| **4** | Pergunta diária + **`trial_d3`** (falta 3 dias) | comercial |
| **5** | Pergunta diária · `engajamento_5dias` se calada desde o dia 0 | — |
| **6** | Pergunta diária · **oferta de fim de semana**, *só se cair numa sexta* | `?tipo=fim_de_semana` |
| **7** | Pergunta diária + **`trial_d0`** (acaba hoje) | comercial |

Em cima disso, três travas duras ([rules.ts](../apps/web/src/lib/ayla/rules.ts)): máximo **2
proativas/dia**; nada fora da janela de 2h; e **nada se ela escreveu hoje**.

**O que isso significa na prática, para os dois perfis extremos:**

- **Mãe engajada** (escreve todo dia): recebe **boas-vindas e mais nada proativo**. Toda a jornada
  dela é reativa — ela puxa, a Ayla responde. Se ela não souber pedir, não descobre nada.
- **Mãe silenciosa**: recebe boas-vindas, pergunta diária, toque de 2 dias, toque de 5 dias, e os
  dois avisos comerciais. Recebe **mais** condução que a engajada.

Isso é o inverso do que uma jornada de ativação deveria fazer.

## Parte 2 — Os temas prioritários: gravados e descartados

Primeiro, uma correção de premissa: **não são três, e não são chamados de prioridades.** A pergunta
é *"O que mais pesa no dia a dia agora? **Pode marcar vários** — toque em tudo o que hoje está
difícil"* ([copy-default.ts:127-141](../apps/web/src/lib/onboarding/copy-default.ts#L127-L141)), com
9 opções e nenhum limite. Uma mãe sobrecarregada pode marcar sete.

**Onde são gravados:** `categorias_extras.desafios_onboarding` (array), e cada um cria uma seção
vazia `{texto:""}` no domínio correspondente
([salvar-conversacional.ts:149-151](../apps/web/src/lib/onboarding/salvar-conversacional.ts#L149-L151)).

**Onde são lidos — busca exaustiva no projeto:** um único lugar.

```
orchestrator.ts:142  const extras = pv?.categorias_extras as { desafios_onboarding?: string[] }
orchestrator.ts:143  desafioTop = extras?.desafios_onboarding?.[0] ?? null
```

Dentro de `sendBoasVindas`. Lê o **índice [0]** e monta a mensagem de boas-vindas. Nada mais no
sistema volta a tocar nesse array.

| Pergunta | Resposta |
|---|---|
| Onde são usados? | Só na mensagem de boas-vindas |
| Quando? | Uma vez, no minuto zero |
| Como influenciam as respostas? | **Não influenciam.** Não entram no prompt da Ayla, nem no decisor de entrega, nem no gerador de plano |
| Há acompanhamento? | Não |
| Há retomada? | Não |
| Há evolução? | Não |
| Há celebração? | Não |

**Explicitando, como você pediu:** dos desafios que a mãe marcou, **um é usado uma vez e o resto é
descartado**. Se ela marcou comunicação, crises e rotina, a Ayla fala de comunicação na primeira
mensagem e nunca mais volta a nenhum dos três por iniciativa própria.

Há um agravante que vem da auditoria anterior: as seções vazias criadas por esses desafios fazem
`carregarLacunasKoloVivo` dizer corretamente "ainda falta". Mas **`escola` e `aprendizado` — duas
das nove opções — não são sequer visíveis para a Ayla do WhatsApp**, porque `carregarKoloVivoResumo`
lê 14 dos 20 domínios. A mãe pode marcar "Escola" como o que mais pesa e a Ayla nunca ver nada
sobre escola.

## Parte 3 — Condução ativa

A Ayla **tem** a capacidade de conduzir: o Core manda conduzir a jornada, e o decisor de entrega
implementado hoje tomou a decisão de fechar em vez de perguntar para sempre. O problema não é a
capacidade — é que **as iniciativas existentes não estão ligadas ao teste**.

| Iniciativa | Existe? | Onde | Dispara no teste? |
|---|---|---|---|
| "Ontem você comentou que…" | ❌ | — | O histórico entra no prompt (6 turnos), mas nenhuma proativa é construída sobre uma fala anterior |
| "Vamos avançar mais um passo?" | ❌ | — | Não existe conceito de passo, nem de progressão |
| "Conseguiram testar?" | ⚠️ | `sendPlanoSeguimento` | Janela de 3-14 dias — quase sempre cai **fora** do teste |
| "Quer adaptar a estratégia?" | ⚠️ | dentro do seguimento | idem |
| "Posso montar uma atividade?" | ⚠️ | decisor de entrega (reativo) | Só se a conversa der score. Nunca por iniciativa |
| "Vamos registrar a evolução?" | ❌ | — | Nenhuma proativa pede registro |
| Pergunta diária | ✅ | `sendRotinaDiaria` | Sim, todo dia — mas é **a mesma pergunta genérica**, sem tema, sem continuidade |
| Sugestão de repertório (usa o hiperfoco) | ✅ | `sendRepertorioSugestao` | 1×/semana → **uma vez no teste, se não for bloqueada** |
| Oferta de fim de semana | ✅ | `sendOfertaFimDeSemana` | Só se uma sexta cair na janela |
| Insight de padrão | ⚠️ | `insightEngine` | Precisa de dados acumulados; no teste raramente detecta |
| Celebração de sequência | ✅ | `emocional_streak` | **Impossível antes do dia 7** |

**Diagnóstico:** a Ayla conduz *dentro* de uma conversa (isso melhorou hoje), mas **não conduz de um
dia para o outro**. Não existe fio. Cada dia começa do zero, com a mesma pergunta.

## Parte 4 — Descoberta das funcionalidades

| Funcionalidade | Descoberta natural? | Como aparece hoje |
|---|---|---|
| Plano estratégico | ✅ **sim** | O decisor entrega ou oferece sozinho quando a conversa amadurece. É o único recurso genuinamente auto-descoberto |
| Rotina visual | ❌ **depende de pedir** | Só se a mãe expressar intenção de criar rotina (`intent=rotina_criar`). A Ayla nunca oferece |
| Atividades / brincadeiras | ⚠️ **dentro do plano** | Existem como seções do PDF. A mãe não sabe que pode pedir só isso |
| Histórias | ⚠️ **link só se pedir** | A Ayla tem magic link pronto, usado apenas se ela pedir história |
| Relatório para professora | ❌ **quase nunca** | Só o link, e só se o assunto escola aparecer. E na web, não no WhatsApp |
| Relatório para terapeuta | ❌ **quase nunca** | Idem |
| Registrar evolução | ❌ **invisível** | Registro Diário está no app; a Ayla registra nos bastidores sem dizer que registrou |
| Acompanhar progresso | ❌ **invisível** | Tela Evolução; nenhuma mensagem aponta para ela |
| Consultar histórico | ❌ | — |
| Leitura de desenho ("o que o desenho conta?") | ❌ | Link existe, nunca é oferecido |

**Um de dez é auto-descoberto.** E o único que se apresenta sozinho é o mais caro de gerar.

O paradoxo: os magic links do Lúdico (história, rotina, desenho, avatar, relatório) são **gerados em
toda resposta** para criança de até 12 anos
([orchestrator.ts:1661-1669](../apps/web/src/lib/ayla/orchestrator.ts#L1661-L1669)) — cinco tokens
de acesso criados a cada mensagem — e ficam esperando a mãe adivinhar que existem. **Pagamos pela
descoberta e não a usamos.**

## Parte 5 — A primeira conversa

O que a mãe recebe no minuto zero: `templateBoasVindasComDesafio` — cita o desafio que ela marcou,
faz uma pergunta fácil e oferece responder por áudio. Isso está **certo**: é personalizado desde o
primeiro segundo, e o convite ao áudio reduz o atrito para quem está cansada.

Se ela responde, a mensagem cai no fluxo reativo completo: parser, perfil, decisor, Sonnet 4.6.

**A resposta demonstra compreender e personalizar?** Sim. Cita o nome, a idade exata, o interesse
registrado, e explica o mecanismo no cérebro. Isso já a distingue de um ChatGPT genérico.

**Demonstra acompanhar?** **Não — e é aqui que o primeiro dia falha.** "Acompanhar" é uma promessa
que só se prova no tempo, e nada na primeira conversa a antecipa. A Ayla não diz o que vai fazer
amanhã, não nomeia o que está guardando, não combina nada. A mãe sai da primeira conversa com uma
boa resposta e **nenhuma razão para voltar**.

O contraste é exato: hoje a primeira conversa prova três das quatro capacidades. A que falta é
justamente a que sustenta a assinatura.

## Parte 6 — Hábito

| Mecanismo de hábito | Existe? |
|---|---|
| Toque diário | ✅ `sendRotinaDiaria` — mas a mesma pergunta genérica, sem tema |
| Continuidade entre dias | ❌ Nenhuma proativa referencia a conversa anterior |
| Próximo passo | ❌ Não existe como conceito |
| Retomada de assunto | ❌ Só o histórico de 6 turnos dentro do prompt |
| Desafio pequeno | ❌ |
| Celebração de avanço | ⚠️ Existe (`emocional_streak`, `emocional_conquista`) e não alcança o teste |
| Streak visível para a mãe | ❌ Ela nunca sabe que há uma sequência |

E o pior: **a pergunta diária é silenciada exatamente para quem criou o hábito.** Se ela escreveu
ontem à noite, a proativa de hoje não sai. O mecanismo de hábito se desliga quando o hábito começa
a se formar.

**Conclusão:** cada conversa é isolada. Existe um toque diário; não existe uma jornada.

## Parte 7 — Simulação dos 7 dias, três famílias

**Simulação**, construída a partir dos gatilhos reais e dos prompts reais. Formato: o que sai hoje
· o que deveria sair. Cenário: onboarding concluído numa terça, janela da noite (19-21h).

---

### Família A — marcou Comunicação, Crises, Rotina · criança de 5 anos, TEA, ama dinossauros

| Dia | **Hoje** | **Deveria** |
|---|---|---|
| 0 (ter) | **Ayla:** *"Oi, Ana! Vi que a comunicação é o que mais pesa agora com o Théo. Me conta uma coisa: quando ele quer algo e não consegue falar, o que ele faz? Pode mandar áudio, se for mais fácil 🌿"* | ✅ Está bom. Só acrescentaria o combinado: *"Nos próximos dias eu vou te acompanhar nesses três — comunicação, crises e rotina. Começo pela comunicação."* |
| 1 | **Ayla:** *"Como foi o dia do Théo hoje?"** (pergunta genérica) | *"Ontem você contou que ele empurra a sua mão quando quer algo. Isso é comunicação — só não é fala ainda. Testa uma coisa hoje: quando ele empurrar, nomeia por ele — 'você quer água'. Uma vez só. Me conta se ele olhou."* |
| 2 | Pergunta genérica de novo. **Se ela respondeu ontem, nem isso sai** | *"Funcionou o nomear? Se sim, a gente sobe um degrau."* — primeiro fechamento de ciclo |
| 3 | Pergunta genérica | **Primeiro entregável:** *"Juntei o que você me contou em 3 dias num plano com atividades pro Théo — com dinossauro, que é a porta dele."* + PDF |
| 4 | **`trial_d3`:** *"Faltam 3 dias do seu teste…"* | Plano seria aqui, e o dia 4 vira **crises** — o 2º tema. *"Semana que vem a gente entra nas crises. Antes, uma pergunta: elas vêm mais em qual hora do dia?"* |
| 5 | Pergunta genérica | **Rotina visual, oferecida sem ela pedir:** *"Você marcou rotina. Quer que eu monte o quadro do fim da tarde dele? Vem em cartões ilustrados, pra imprimir."* |
| 6 (seg) | Nada de fim de semana (não é sexta) | **Retrato do que mudou:** *"Em 6 dias, olha o que eu aprendi do Théo: [3 itens]. E o que mudou: ele olhou quando você nomeou, 2 de 3 vezes."* ← **o momento da conversão** |
| 7 | **`trial_d0`:** *"Seu teste acaba hoje"* | Mesmo aviso, depois do retrato do dia 6, com o próximo passo já nomeado |

**Diagnóstico A:** dois dos três temas nunca são tocados. A mãe recebe 5 perguntas genéricas
iguais e 2 avisos de cobrança. Se ela não puxar conversa, **termina o teste sem um único
entregável.**

---

### Família B — marcou Autonomia, Alimentação, Sono · criança de 7 anos, TDAH, ama futebol

| Dia | **Hoje** | **Deveria** |
|---|---|---|
| 0 | Boas-vindas citando **autonomia** (só o [0]) | Idem + o combinado dos três |
| 1 | Pergunta genérica | Autonomia com resultado no mesmo dia: *"Escolhe UMA coisa que hoje você faz por ela e que ela quase consegue. Só uma. Me diz qual."* |
| 2 | Genérica | *"Deu certo? Se ela travou no meio, é aí que a gente ajusta — não no começo."* |
| 3 | Genérica | **Plano de autonomia** com futebol como ponte |
| 4 | `trial_d3` | **Alimentação** entra. E aqui está a maior perda: existem **27 boas práticas de alimentação curadas** que a Ayla não vê — a skill `nutricional` está inativa e o WhatsApp não lê boas práticas |
| 5 | Genérica | **Sono** — e sono é o tema que dá resultado percebido mais rápido. Devia ser o primeiro, não o último |
| 6 | Genérica | Retrato do que mudou |
| 7 | `trial_d0` | Idem |

**Diagnóstico B:** ordem invertida. A mãe marcou três temas e o sistema tratou o primeiro clicado
como prioridade — quando **sono é o que produz alívio visível em 48h** e deveria abrir o teste. Não
existe nenhuma lógica de priorização entre os temas marcados; é a ordem dos chips na tela.

---

### Família C — marcou Foco, Sensorial, Socialização · criança de 9 anos, em investigação, ama Minecraft

| Dia | **Hoje** | **Deveria** |
|---|---|---|
| 0 | Boas-vindas citando **foco** | Idem |
| 1 | Genérica | *"Foco tem muitos nomes. Me diz qual é o seu: ela não começa, não termina, ou não volta depois que interrompe?"* — a pergunta cirúrgica que o decisor novo sabe fazer |
| 2 | Genérica | Uma estratégia + o que observar |
| 3 | Genérica | **Sensorial** — e aqui a Ayla está bem servida (26 BPs, skill ativa) |
| 4 | `trial_d3` | Plano cruzando foco + sensorial (a hipótese: o ambiente está consumindo o foco) |
| 5 | Genérica | Socialização |
| 6 | Genérica | **Relatório para a escola** — família em investigação, sem laudo, é quem mais precisa. Mas ver Parte 8: no dia 6 ele sai pela metade |
| 7 | `trial_d0` | Retrato + convite |

**Diagnóstico C:** é a família que mais se beneficiaria do relatório e a que menos tem chance de
descobrir que ele existe.

---

**O padrão nas três:** a mãe recebe **7 mensagens quase idênticas** ("como foi o dia?") e **2 de
cobrança**. Nenhuma menciona o que ela contou ontem. Nenhuma apresenta um recurso. Nenhuma celebra.
Todo o valor depende de ela puxar — e ela chegou cansada e sem saber o que pedir.

## Parte 8 — Relatórios e entregáveis

### 8.1 Inventário real

| Entregável | Existe? | Onde | Fonte dos dados |
|---|---|---|---|
| Plano estratégico | ✅ | PDF no WhatsApp + app | Perfil + conversa |
| Rotina visual (dia ou semana) | ✅ | PDF + app | Perfil + conversa |
| Relatório para escola | ✅ | Só na web (Evolução → Relatório) | Perfil + diários 60d + snapshots + eventos |
| Relatório para terapeuta | ✅ | Idem | Idem |
| Roteiro de fim de semana | ✅ | PDF + app | Conversa |
| Snapshot mensal da Evolução | ✅ | automático, cron | Diários do mês |
| **Plano semanal** | ❌ **não existe** | — | — |

### 8.2 De onde vem cada campo do relatório

Estrutura em [relatorio/gerar.ts:82-141](../apps/web/src/lib/relatorio/gerar.ts#L82-L141).

**Escola** — 16 seções. **Terapeuta** — 15 seções.

| Bloco de contexto | Automático? | O que alimenta | Disponível no dia 5 de teste? |
|---|---|---|---|
| Nome, idade, perfil, diagnósticos | ✅ 100% automático | onboarding | ✅ sim |
| 20 domínios do Kolo Vivo | ✅ automático | onboarding + auto-incorporação da Ayla | ⚠️ parcial — só o que a conversa cobriu |
| Diários (60 dias, até 15) | ✅ automático | parser da Ayla + Registro Diário | ⚠️ 2-4 registros |
| **Snapshots mensais** | ✅ automático | cron mensal | ❌ **zero** (precisa de ≥2 meses) |
| **Linha do tempo de eventos** | ✅ automático | `eventos_membro` | ⚠️ só se houve gatilho |
| Prioridades do semestre | 🧠 inferido pela IA | do perfil | ✅ |
| O que ajuda / evitar / sinais de sobrecarga | 🧠 inferido | do perfil + diários | ⚠️ raso |
| Checklist "o que queremos entender melhor" | 🧠 gerado | lacunas | ✅ |

**Nada é digitado à mão.** Isso é uma força enorme do produto — e é exatamente por isso que o
relatório passa fome no teste: **as duas seções que mais impressionam (Linha do tempo e Evolução
observada) dependem de tempo que a família ainda não teve.** No dia 5, o guia da escola sai com 5 ou
6 das 16 seções.

### 8.3 Simulação — Relatório para a escola

> **Simulação.** Criança fictícia. Feita com a estrutura real do prompt e o volume de dados que uma
> família teria **no fim de um mês** de uso — não no dia 5. No dia 5, tudo abaixo de "Linha do
> tempo" sairia vazio.

---

**Conhecendo a Lívia — como ajudá-la a aprender, participar e se sentir segura**
*Guia construído pela família com apoio da Kolo · atualizado em 30/07/2026*

## Quem é a Lívia
Lívia tem 6 anos e uma memória impressionante para tudo que envolve animais — sabe o nome de
dezenas de espécies e adora contar o que aprendeu. É afetuosa e observadora, e costuma precisar de
um tempo para entrar em ambientes novos antes de participar.

## Prioridades deste semestre
- Ampliar as formas de a Lívia pedir ajuda quando não entende uma instrução
- Favorecer a participação em atividades coletivas, no ritmo dela
- Reduzir o esforço nas transições entre atividades
- Aumentar a autonomia nos momentos de organização do material
- Preservar o interesse dela pelas atividades — evitando que o cansaço vire recusa

## Como a Lívia aprende melhor
- Com instruções curtas, uma por vez — a família observa que instruções encadeadas costumam se
  perder no meio
- Vendo antes de fazer: quando alguém demonstra, ela reproduz com mais segurança
- Quando o conteúdo se conecta a animais — é a porta de entrada mais confiável
- Com tempo de observação antes de participar; forçar a entrada costuma ter efeito contrário

## O que ajuda
- Avisar 5 minutos antes de qualquer mudança, com palavras concretas
- Repetir a instrução com as mesmas palavras, sem reformular (reformular parece nova instrução)
- Confirmar o entendimento com uma pergunta fechada ("é pra pegar o lápis ou o caderno?")
- Deixar que ela observe a atividade antes de entrar
- Reconhecer a tentativa, não só o acerto

## O que evitar
- Corrigir na frente da turma
- Insistir quando ela já está sobrecarregada
- Instruções longas ou várias ao mesmo tempo
- Mudanças de rotina sem aviso
- Perguntar "entendeu?" — a família relata que ela responde que sim mesmo quando não entendeu

## Sinais de sobrecarga
Aparecem *antes* de escalar: fica mais quieta que o normal, começa a mexer na roupa ou nos cabelos,
responde monossilábico, e o olhar se desvia da atividade.
**Quando aparecerem:** reduzir estímulo (som, quantidade de gente por perto), baixar a exigência
naquele momento, presença calma e menos palavras. Voltar ao conteúdo depois.

## Como perceber que uma estratégia funcionou
- Permanece mais tempo na atividade
- Começa a tarefa com menos ajuda
- Aceita melhor a transição para a atividade seguinte
- Pede ajuda em vez de travar
- Chega em casa menos cansada

## Situações que podem exigir mais apoio
- Momentos de mudança sem aviso (troca de sala, professor substituto)
- Atividades coletivas com muita gente falando ao mesmo tempo
- Tarefas com várias etapas apresentadas juntas
- Fim da tarde, quando o cansaço acumulado reduz a tolerância

## O que faz a Lívia sorrir
- Ser reconhecida por algo que ela sabe (especialmente sobre animais)
- Previsibilidade — saber o que vem depois
- Poder observar antes de entrar
- Quando alguém percebe uma conquista pequena dela

## Como se comunica
- Fala em frases completas e tem vocabulário amplo
- Até o momento, a família observa que ela raramente pede ajuda espontaneamente — costuma esperar
  que o adulto perceba
- Quando está sobrecarregada, a fala reduz bastante antes de qualquer outro sinal aparecer

## Perfil sensorial
- **Som:** a família relata desconforto com ambientes de muito ruído simultâneo. *Estratégia:* lugar
  mais afastado do centro de movimento; permitir sair um instante quando a sala está agitada.
- **Toque:** desconforto com etiquetas e costuras. *Estratégia:* não insistir em ajustar a roupa dela.
- **Luz:** sem observações até o momento.

## Interesses e pontos fortes
- Animais, especialmente répteis — porta de entrada para leitura, contagem e escrita
- Memória para informação factual
- Cuidadosa com material próprio

## Linha do tempo
- Em junho de 2026, a família observou que ela passou a contar sobre a escola espontaneamente ao
  chegar em casa — algo que antes não acontecia.
- Em julho de 2026, houve troca de professora na turma. A família observou aumento do cansaço nas
  duas semanas seguintes, sem cravar relação de causa.

## Outros detalhes úteis
Não gosta de alimentos misturados no prato. Prefere garrafa própria de água.

## O que gostaríamos de entender melhor
☐ Em quais momentos do dia ela demonstra mais cansaço
☐ Como participa das atividades coletivas
☐ Se pede ajuda quando não entende
☐ Como reage às mudanças de rotina na escola
☐ Quais estratégias já funcionaram por aí

## Como escola e família podem se comunicar
Seria muito útil a escola avisar quando observar: mudanças importantes de comportamento, novas
habilidades, situações de sobrecarga, estratégias que funcionaram e mudanças na comunicação. A
família compartilhará mudanças relevantes de rotina, saúde ou desenvolvimento.

*Este guia continua sendo construído — vai sendo atualizado conforme a família e a escola registram
novas informações.*

---

### 8.4 Simulação — Resumo para o profissional de saúde

> **Simulação**, mesma criança, mesma ressalva de volume de dados.

**Lívia, 6 anos — resumo de observações da família**
*Organizado pela família com apoio da Kolo · 30/07/2026*

## Motivo deste resumo
Organizar cronologicamente o que a família tem observado nos últimos meses, para que o tempo da
consulta renda mais.

## Diagnósticos informados pela família
Em investigação, sem laudo até o momento. A família registrou hipótese de TDAH levantada em
avaliação escolar.

## Principais preocupações atuais da família
- Aumento do cansaço ao final do dia nas últimas semanas
- Não pede ajuda espontaneamente quando não compreende uma instrução
- Redução da fala como primeiro sinal de sobrecarga
- Dificuldade nas transições entre atividades

## Linha do tempo
- **Junho/2026** — a família observou início de relato espontâneo sobre a escola ao chegar em casa.
- **Julho/2026** — troca de professora na turma. Nas duas semanas seguintes, a família observou
  aumento do cansaço e maior resistência às transições. Sem relação de causa estabelecida.

## Comunicação
**Atual:** frases completas, vocabulário amplo para a idade. Não solicita ajuda espontaneamente.
**Evolução:** a família observa aumento do relato espontâneo desde junho.

## Perfil sensorial
- **Audição:** desconforto relatado em ambientes de ruído simultâneo
- **Toque:** desconforto com etiquetas e costuras de roupa
- **Visual, movimento, olfato:** sem dados suficientes

## Regulação emocional
**Gatilhos observados:** mudanças sem aviso; acúmulo de demanda no fim do dia; ambientes ruidosos.
**Sinais:** redução da fala, movimentos repetitivos com a roupa, desvio do olhar — nesta ordem,
antes de qualquer escalada.

## Participação social
Interage com mais facilidade em grupos pequenos. Em atividades coletivas grandes, a família observa
que ela costuma observar antes de participar.

## Sono · Alimentação · Autonomia
- **Sono:** sem dados suficientes
- **Alimentação:** recusa alimentos misturados no prato
- **Autonomia:** cuidadosa com material próprio; precisa de apoio na organização de tarefas com
  várias etapas

## Evolução observada
- Relato espontâneo sobre a escola: ↑ desde junho
- Cansaço ao fim do dia: ↑ nas últimas duas semanas
- Transições: ↓ tolerância no mesmo período
- Vocabulário: ↔ estável e amplo

## Questões que merecem investigação
- Origem do aumento do cansaço nas últimas semanas
- Relação entre a mudança de professora e a redução da tolerância às transições
- Se a ausência de pedido de ajuda tem relação com compreensão, com iniciativa ou com o ambiente

## Perguntas que a família gostaria de discutir
- Esse aumento de cansaço é esperado nessa fase?
- Vale investigar a parte auditiva, dado o desconforto com ruído?
- Faz sentido uma avaliação formal agora ou é melhor observar mais um período?

*Este resumo reúne observações da família pra apoiar a consulta — não substitui avaliação profissional.*

---

### 8.5 Simulação — Plano estratégico (9 seções reais)

> **Simulação** abreviada — o plano real tem 9 seções, cada uma com a profundidade do botão
> correspondente. Mostro a estrutura com conteúdo real nas três primeiras e resumo as demais.

**Plano estratégico com atividades — Lívia pedir ajuda quando não entende**

**1. Entender** — A Lívia tem vocabulário amplo e memória forte, e é justamente isso que pode estar
escondendo a dificuldade: quem fala bem parece ter entendido. Uma possibilidade é que pedir ajuda
exija duas coisas ao mesmo tempo — perceber que não entendeu, e interromper o adulto. As duas são
funções em construção nessa idade. Vale observar com calma: ela trava em silêncio ou começa errado?

**2. Crenças** — *"Se ela sabe falar, ela sabe pedir."* Falar e pedir ajuda são habilidades
diferentes: a segunda exige monitorar o próprio entendimento. *"Ela não pede porque não quer se
esforçar."* Não pedir costuma ser o oposto de preguiça — é esforço demais para admitir a
dificuldade.

**3. O que fazer diferente** — Em vez de perguntar "entendeu?", pergunte o conteúdo de volta com
duas opções fechadas. Em vez de esperar que ela peça, ofereça a ajuda como parte do combinado
("vou te chamar no meio pra ver como está").

**4. Brincadeiras** — 3 brincadeiras com animais como contexto, para treinar pedir ajuda sem custo
emocional.
**5. Atividades** — 3 atividades de rotina, uma por dia.
**6. Frases prontas** — 6 frases para o adulto usar literalmente.
**7. Rotina** — só se o tema pedir.
**8. História social** — só se o tema pedir.
**9. O que observar** — 4 sinais concretos para os próximos dias.

### 8.6 Simulação — Rotina visual da semana

> **Simulação** do que existe (`/ludico/rotinas/semana` → cartões ilustrados + PDF).

**Rotina da tarde — Lívia**

| # | Cartão | Ilustração |
|---|---|---|
| 1 | Chegar e guardar a mochila | mochila no gancho |
| 2 | Beber água e comer a fruta | garrafa e maçã |
| 3 | Descansar 15 minutos, sem tela | almofada |
| 4 | Lição — uma folha por vez | caderno aberto |
| 5 | Escolher: brincar ou ler sobre animais | lagarto e livro |
| 6 | Banho | chuveiro |
| 7 | Jantar junto | prato e talher |
| 8 | Escolher a roupa de amanhã | camiseta |
| 9 | História e dormir | lua e livro |

Cada cartão vira uma imagem JPEG gerada por IA, no estilo do avatar da criança, montada em PDF para
imprimir e colar.

### 8.7 Sobre o plano semanal

**Não existe.** E deliberadamente não vou simular um — o Core proíbe a Ayla de prometer artefato
fora do catálogo, exatamente porque isso já causou o problema de a mãe ficar esperando um arquivo
que nunca chegaria.

O que existe e chega perto: a **rotina da semana** (7 dias de cartões) e o **roteiro de fim de
semana**. Para haver um plano semanal de verdade faltariam três coisas que não estão construídas:
progressão entre dias (dia 1 mais fácil que dia 5), indicador de sucesso por dia, e vínculo com o
plano estratégico que o originou. É uma feature nova, não um formato novo — e, francamente, seria a
melhor candidata a substituir a pergunta diária genérica na jornada do teste.

## Parte 9 — Momentos de encantamento

| Momento possível | Acontece hoje? |
|---|---|
| A Ayla cita o desafio que ela marcou, no primeiro segundo | ✅ **sim** — e é o melhor momento existente |
| A Ayla usa o hiperfoco para adaptar uma brincadeira | ✅ dentro do plano e na sugestão semanal de repertório |
| Entrega um PDF completo em 40 segundos | ✅ o momento mais forte do produto |
| A Ayla enxerga uma foto (lição, rótulo) | ✅ funciona, e **ninguém sabe que existe** |
| Ela responde por áudio e a Ayla entende | ✅ e é oferecido nas boas-vindas |
| "Ontem você comentou que…" | ❌ nunca |
| "Isso melhorou desde a semana passada" | ❌ nunca (dados existem, não são lidos) |
| "Você já tentou X e não funcionou — vamos por outro caminho" | ❌ nunca (`experimentos` é write-only) |
| A Ayla monta a rotina sem ela pedir | ❌ |
| A Ayla gera o relatório e a mãe leva à escola | ⚠️ existe, quase nunca é descoberto |
| A Ayla celebra 7 dias seguidos | ❌ inalcançável no teste |
| A Ayla lembra do nome do irmão, da professora, do cachorro | ⚠️ está no perfil, mas o Core (com razão) freia puxar assunto antigo |
| A Ayla percebe uma contradição e pergunta | ⚠️ detecta e só grava; não pergunta |

**Cinco acontecem, oito não.** E os oito que não acontecem são justamente os de **acompanhamento** —
a categoria que produziria a frase que você quer ouvir no dia 3: *"parece que a Ayla está
acompanhando a gente."*

Nenhum dos oito depende de conteúdo novo. Todos dependem de **ler o que já está gravado**.

## Parte 10 — Oportunidades perdidas

Tudo isto já existe no banco e não gera valor no teste:

| A Ayla já sabe | Onde está | Por que não usa |
|---|---|---|
| Os desafios marcados no onboarding | `desafios_onboarding` | Lê só o `[0]`, uma vez |
| Aprendizado, escola, saúde, telas, imitação, gostos | `categorias_extras` | `carregarKoloVivoResumo` lê 14 de 20 domínios |
| Interesses / hiperfocos | `como_e.interesses` | Usa no plano e na sugestão semanal; nunca para abrir conversa |
| Estratégias tentadas **e o resultado** | `preferencias.experimentos` (com data!) | Lido só pelo cron semanal de repertório |
| Eventos com data (férias, troca de professora, marcos) | `eventos_membro` | Lido só pelo relatório |
| Conquistas e desafios do dia | `diarios` | A web lê 7 dias; **o WhatsApp não lê nada** |
| Humor da mãe | `check_ins_diarios` | A web lê; o WhatsApp não |
| Contradições detectadas | `categorias_extras.conflitos` | Só a tela |
| 368 boas práticas curadas | `boas_praticas` | 55% presas a skills inativas; **zero chegam ao WhatsApp** |
| Rotinas e planos já entregues | `rotinas`, `planos` | Só para dedup |
| Lacunas do perfil | calculado | Usado para não perguntar — mas mente sobre 6 domínios |

**A soma é o achado central desta auditoria:** o produto **já registra** tudo o que seria necessário
para a mãe sentir que está sendo acompanhada. O que falta não é dado nem conteúdo — é **ler de volta**.

## Parte 11 — Roteiro redesenhado dos 7 dias

Premissas que respeitei: nenhuma funcionalidade nova; nenhum recurso a mais apresentado (na verdade
apresento **três** — plano, rotina, relatório — que é menos do que os dez disponíveis hoje); e cada
dia precisa entregar algo pequeno e concreto.

Duas mudanças estruturais sustentam tudo:

1. **A pergunta diária deixa de ser genérica e passa a ter tema** — o tema do dia vem do
   `desafios_onboarding`, ordenado por "o que dá resultado percebido mais rápido" (sono e rotina
   primeiro; socialização e escola depois), não pela ordem dos chips.
2. **A regra "já conversamos hoje" deixa de valer para o toque de continuidade.** Ela existe para
   não spammar quem já está conversando — mas continuidade não é spam, é a coisa que faz a mãe
   sentir que há alguém do outro lado. Basta excetuar um tipo novo (`continuidade`), com cap de 1/dia.

| Dia | Objetivo | Valor percebido | Conversa principal | Recurso | Próximo hábito | Sucesso |
|---|---|---|---|---|---|---|
| **0** | Provar que é personalizado | "ela já sabe do que eu preciso" | Boas-vindas citando o tema nº 1 + **o combinado dos 7 dias** ("vou te acompanhar nesses três; começo pelo sono") | — | responder uma vez | respondeu |
| **1** | Primeiro resultado concreto | "isso eu consigo fazer hoje" | Uma estratégia do tema nº 1 + **uma** coisa para observar | — | observar e contar | contou o que observou |
| **2** | Provar que ela lembra | **"ela está acompanhando"** ← o momento da conversão | *"Ontem você observou X. Funcionou?"* → ajusta ou sobe um degrau | — | fechar o ciclo | respondeu ao "funcionou?" |
| **3** | Entregar algo que ela guarda | "isso valeu o cadastro" | **Plano estratégico** do tema nº 1, construído com o que ela contou em 3 dias | **Plano** (PDF) | abrir o PDF | abriu ou comentou |
| **4** | Mostrar amplitude sem trocar de assunto | "serve pra mais coisa" | Tema nº 2, aproveitando o que já sabe do nº 1 | **Rotina visual** oferecida, não esperada | imprimir e colar | aceitou a rotina |
| **5** | Provar que registra | "não vou ter que repetir tudo de novo" | Tema nº 3 + a Ayla **diz** o que aprendeu: *"olha o que já sei da Lívia"* | — | corrigir/completar o perfil | corrigiu algo |
| **6** | Provar evolução | "mudou alguma coisa em 6 dias" | **Retrato dos 6 dias:** o que ela contou, o que foi testado, o que mudou | **Relatório** — aqui, quando há dado | levar à escola | abriu o retrato |
| **7** | Converter sem cobrar | "quero continuar" | O aviso do fim do teste **depois** do retrato, com o próximo passo já nomeado | — | assinar | assinou |

**O eixo dessa jornada é o dia 2.** Não é o dia do PDF — é o dia em que a Ayla volta a um assunto
que a mãe trouxe e pergunta se funcionou. Esse é o movimento que nenhum ChatGPT faz, custa uma
consulta ao banco, e é exatamente o que hoje não existe em nenhum dia dos sete.

E a hierarquia que eu defenderia: **continuidade (dia 2) > entregável (dia 3) > evolução (dia 6) >
amplitude (dias 4-5)**. Hoje o produto investe quase tudo no entregável, que é o mais caro de gerar
e o segundo mais convincente.

---

## Decisões que dependem da Karina

1. **Ordem dos temas:** o sistema deve reordenar o que a mãe marcou (sono/rotina primeiro, por
   resultado rápido) ou respeitar a ordem em que ela clicou?
2. **Limitar a 3 a escolha de desafios?** Hoje são ilimitados entre 9. Uma mãe que marca sete não
   dá foco a nenhum.
3. **Furar o "já conversamos hoje" para o toque de continuidade?** É a mudança que destrava a
   jornada, e é uma mudança de política de contato — decisão dela, não minha.
4. **O relatório pode ser oferecido no dia 6 sabendo que sai incompleto**, ou é melhor esperar o
   primeiro mês para não queimar a primeira impressão?
5. **Vale construir o plano semanal** como entregável de verdade (com progressão e indicador), para
   substituir a pergunta diária genérica?
6. **O que a Ayla pode dizer que registrou?** Hoje ela guarda em silêncio. Dizer "guardei isso no
   perfil da Lívia" é encantamento — ou é assustador para uma mãe que nunca usou IA?
