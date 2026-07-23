# Jornada de Construção (ex-"trial de 7 dias") — patrimônio, não paywall

> **v2 — virada de filosofia (23/07).** A v1 pensava numa *régua de trial* (contagem regressiva pra um paywall). A v2 pensa numa **jornada de construção de patrimônio**: nesses primeiros dias a mãe não está *testando uma IA* — está começando a construir uma **representação digital do filho**. E ninguém abandona algo que está construindo. A assinatura deixa de ser "continuar usando uma ferramenta" e passa a ser "continuar desenvolvendo um patrimônio de conhecimento sobre a criança". Posicionamento mais forte e difícil de copiar — o maior ativo da Kolo, hoje não explorado na comunicação.
>
> Parte 1 = como é HOJE (real, do código). Parte 2 = os buracos. **Parte 3 = a virada (o conceito de Patrimônio).** Parte 4 = a jornada como narrativa (D1→D7). Parte 5 = o momento de mostrar o que já registrei (D-1, sem nome próprio). Parte 6 = régua comercial mínima. Parte 7 = gatilhos vivos. Parte 8 = o que construir. Parte 9 = decisões abertas.
>
> **Nota de linguagem (Sérgio, 23/07):** o patrimônio É o **Perfil** que já existe no menu (rota `/kolo-vivo`; o código já o chama de "Retrato vivo"). NÃO se cria um objeto novo nem se batiza um artefato. A Ayla só fala como gente — *"olha o que eu já registrei da Maria até aqui, nas nossas conversas"* — e ancora no lugar que a mãe pode abrir (o Perfil). Sem substantivo de produto.

---

## Parte 1 — Como o trial funciona HOJE (real)

**Trial = 7 dias**, criado no signup (`status=trialing`, `trial_ends_at = agora + 7d`). A Ayla só manda proativa **depois do consentimento** no onboarding. Teto de **2 proativas/dia**; respeita janela de horário da família; silêncio total após 10 dias sem resposta.

**Cadência real (assumindo consentimento + a mãe respondendo):**

| Dia | O que dispara | Mensagem (real, hoje) |
|---|---|---|
| **0** | **Boas-vindas** (no fim do onboarding) | Se marcou um desafio: *"Oi, {mãe} 💛 Vi que {o sono/o foco…} {do filho} tem pesado — me conta rapidinho como está sendo? Pode mandar um áudio…"*. Sem desafio: versão padrão de acolhimento. |
| **1–7** | **rotina** (diária, na janela) | IA gera (acolhimento / "você sabia" / completar perfil). Fallback: *"Oi, {mãe}. Me conta uma coisa boa e uma difícil…"* |
| eventual | **insights** (~semanal) | Detecta padrão: *"Notei que a semana tem sido pesada pra você…"* / *"Os últimos dias {do filho} estão pesados. Quer ver junto o que pode estar pegando?"* |
| eventual | **repertório** (~semanal) | Sugere 1 experiência nova ligada aos interesses. |
| se sexta | **fim de semana** | *"Sexta chegou 🌿 Quer que eu monte um roteiro leve pro fim de semana com {filho}?"* |
| se houve plano | **seguimento** (3–14d depois) | *"Lembra do plano sobre {tema}? Você testou? Me conta como foi…"* |
| se 7 dias seguidos | **emocional (streak)** | *"{mãe}, você me respondeu 7 dias seguidos 🌿 Isso é cuidado de verdade…"* |
| se sumiu | **inatividade** (2 e 5 dias) | *"Faz uns dias sem você por aqui — está tudo bem aí?"* |
| **4 (D-3)** | **comercial trial_d3** | *"Te lembrando que seu período grátis termina em 3 dias. Se quiser continuar, é só assinar em /assinatura. Sem pressa."* |
| **7 (D-0)** | **comercial trial_d0** | *"Hoje é o último dia do seu período grátis 🌿 Tudo que você me contou continua salvo. Se quiser seguir, é só assinar em /assinatura — cancela quando quiser."* |
| **pós-vencimento** | **nada proativo** | Só quando a mãe **escreve**: nudge *"…seu período grátis acabou. Pra continuar… {link}"* |

**Trava boa que já existe:** o "assine" (comercial) **não dispara** se a mãe mencionou crise/exaustão nas últimas 48h. Nunca vende por cima da dor.

**Artefatos de valor que já existem** (mas HOJE não são mostrados no trial): relatório escola/terapeuta (pronto, gera PDF), rotina visual (PDF+link), planos (PDF+link), Perfil Vivo (tudo que foi capturado), timeline de Evolução. *Snapshot de evolução é MENSAL — num trial de 7 dias quase nunca existe; pra "resumo do trial" precisaria gerar por janela de datas.*

---

## Parte 2 — Os buracos pra encantar e converter

1. **As mensagens comerciais vendem PREÇO, não VALOR.** "Assine em /assinatura" é seco. Não mostra nada do que foi construído.
2. **O valor construído nunca é mostrado.** A mãe pode ter um relatório, uma rotina, um plano, registros — e **nunca vê isso reunido**.
3. **Não existe um artefato-síntese.** Nada que diga "em poucos dias, já descobri isto sobre a {criança}".
4. **Faltam toques-chave na régua:** não há **D-1** nem **follow-up proativo pós-vencimento**.
5. **A régua diária é genérica** — não constrói um arco. Cada dia é solto.
6. **O momento de maior valor percebido é desperdiçado.** Quando a mãe demonstra que a Ayla ajuda ("nossa, você lembrou…"), a resposta não reforça o vínculo nem a continuidade.
7. **(o buraco maior) Os 5 artefatos são vividos como 5 coisas soltas.** Relatório, rotina, plano, perfil, timeline — na cabeça da mãe são cinco coisas separadas. Na verdade são UMA só, que responde a UMA pergunta: **"quanto a Ayla já conhece meu filho?"** Essa é a métrica. E ela nunca é nomeada nem mostrada crescendo.

---

## Parte 3 — A VIRADA: o Patrimônio de Conhecimento da Criança

**O conceito que precisa existir.** A assinatura não mantém *acesso à Ayla*. Ela mantém o **crescimento de algo que já começou**: o retrato vivo da criança. Tudo que hoje chamamos de relatório + rotina + plano + perfil + timeline é **um só patrimônio** — a resposta acumulada pra "quanto a Ayla já conhece meu filho".

**A métrica única.** Não "quantos dias de trial restam", mas "quanto do meu filho já está construído aqui". A conversão vira consequência de a mãe *ver esse patrimônio crescer* e não querer abandoná-lo.

**A venda muda de verbo.** De **"Assine"** → para **"Continue construindo"**. A pergunta no fim não é "vale pagar por uma ferramenta?", é "vale seguir construindo o retrato do meu filho com alguém que já o conhece?".

**Nome interno da régua:** deixa de ser "trial/onboarding comercial" e passa a ser **Jornada de Construção**. (O nome importa até internamente — muda como a gente pensa a feature.)

**Alinhamento com o Core da Ayla:** isso é a aplicação direta do princípio de CONTINUIDADE ("daqui pra frente eu não recomeço, eu continuo") e da filosofia de que a Ayla conhece a CRIANÇA ao longo do tempo (mapa funcional que se constrói). O patrimônio é a forma visível desse mapa.

---

## Parte 4 — A jornada como NARRATIVA (não régua)

Cada dia não é um passo de uma régua; é um capítulo de uma história cujo enredo é **"quanto já conheço o seu filho"**. A direção (não a mensagem literal — isso o ChatGPT afina) é:

| Dia | O capítulo (o que a Ayla comunica que aconteceu) |
|---|---|
| **1** | *Comecei a conhecer seu filho.* |
| **2** | *Já percebi alguns padrões.* |
| **3** | *Já consigo personalizar algumas orientações pra ela especificamente.* |
| **4** | *Já existe um retrato funcional da criança.* |
| **5** | *Já consigo traduzir isso pra escola e terapeutas (relatório).* |
| **6** | *Olha tudo que construímos juntas.* (entrega do artefato-patrimônio) |
| **7** | *Daqui pra frente eu não recomeço — eu continuo.* (convite de continuidade) |

O arco importa mais que a mensagem de cada dia: o valor precisa ser **entregue** (um ganho concreto, um artefato na mão), não só falado. Cada capítulo prova acúmulo — a Ayla não é conversa solta, é um retrato sendo construído.

---

## Parte 5 — O momento de mostrar "o que já registrei" (D-1, sem nome próprio)

**Não é um artefato batizado.** Nada de "Resumo do Trial", "O Retrato" ou qualquer substantivo de produto. É a **Ayla falando como gente** sobre o Perfil que já existe — mostrando, num momento (D-1), o quanto já conhece a criança. O patrimônio é o Perfil; isto é só o **jeito de apresentá-lo**.

**Abre pelo vínculo, na 1ª pessoa:**
> *"Olha o que eu já registrei da {criança} até aqui, nas nossas conversas…"*

**Os três movimentos da fala:**

1. **O que já aprendi** — gosta de… / evita… / se regula melhor quando… / demonstra interesse por… / desafios atuais…
2. **O que construímos juntas** — a rotina, o plano, as estratégias, os registros, a evolução (referências ao que ela pode abrir, não uma lista de features).
3. **O que ainda quero descobrir** *(o pulo do gato)* — a fala **não termina, ela continua**:
   > *"Ainda quero entender melhor: como ela reage a frustrações inesperadas; quais atividades ajudam mais na atenção; como ela aprende melhor…"*

**Ancora no lugar:** fecha apontando pro Perfil — *"tá tudo guardado aqui, é só abrir 👉"* — pra a mãe saber que isso vive num lugar que é dela.

**Por que o 3º movimento é o insight central:** mostrar só *o que já sei* fala do passado. Mostrar *o que ainda vou descobrir* vende **continuidade** — abre um loop que a assinatura fecha. É a diferença entre algo que acaba e um patrimônio que cresce.

---

## Parte 6 — Régua comercial MÍNIMA (menos venda, não mais)

Hoje são 3 comerciais (D-3, D-1, D-0), mesmo que bem escritos. Na jornada de patrimônio, **quase não há venda** — o valor mostrado converte sozinho:

| Dia | Venda? | Direção |
|---|---|---|
| **D-3** | **Zero.** | *"Quero te mostrar o quanto já conheço da {criança}."* (puxa o retrato parcial) |
| **D-1** | **Zero.** | *"Amanhã termina o período gratuito. Antes disso, queria te entregar uma coisa."* → **entrega o Retrato**. |
| **D-0** | **Só aqui aparece o convite.** | *"Se você sentiu que fez diferença ter alguém acompanhando a {criança} desse jeito, vou adorar continuar essa jornada com vocês."* — agora existe contexto pra pedir. |

**Regra de retenção (barreira = dinheiro):** reconhecer o vínculo, explicar a continuidade, **nunca** pressionar/culpar, **nunca inventar desconto**. Preço/condição especial → **escala pro admin** (a Ayla não negocia — ver Core, princípio 7). **Trava de sempre:** nada de venda por cima da dor.

---

## Parte 7 — Gatilhos vivos (o que vende de verdade, sem ser comercial)

**1. Gatilho de valor percebido (o mais desperdiçado hoje).** Sempre que a mãe reage com *"Nossa…"*, *"você lembrou…"*, *"você conhece ele…"*, *"era isso mesmo…"*, a Ayla responde reforçando o patrimônio:
> *"Fico feliz que você tenha sentido isso. É justamente porque cada conversa vai me ajudando a conhecer melhor a {criança} — quanto mais caminhamos juntas, mais consigo adaptar as orientações à realidade dela."*

Não é comercial. Vende muito mais.

**2. A pergunta de ouro — só na intenção positiva, não no fim.** Quando detectar sinal de querer continuar (*"não quero perder"*, *"vou sentir falta"*, *"você ajuda muito"*, *"queria continuar"*):
> *"Posso te fazer uma pergunta? O que fez você sentir que queria continuar comigo?"*

A resposta vale ouro pra marketing, produto, onboarding, vendas e pesquisa — e reforça o vínculo no ato.

---

## Parte 8 — O que precisa ser construído

1. **A "fala de D-1" (mostrar o que já registrei)** — NÃO é um artefato novo nem tem nome. É a Ayla gerando, em linguagem natural, os **3 movimentos** da Parte 5 a partir do Perfil (rota `/kolo-vivo`) + rotina + planos + timeline, na janela `trial_ends_at − 7d … trial_ends_at`. Reusa o gerador de relatório (`/lib/relatorio/gerar`) só como fonte de conteúdo; a saída é fala da Ayla, não um documento batizado. O movimento "o que ainda quero descobrir" vem das **lacunas do perfil** que já calculamos (`carregarLacunasKoloVivo`). Ancorar sempre no Perfil ("é só abrir aqui").
2. **Reescrita da narrativa diária (D1→D6)** como arco de "quanto já conheço", com valor **entregue** em cada janela (não só falado).
3. **Régua comercial reduzida** — D-3 e D-1 sem venda; convite só no D-0 (ajustar o cron `trial_d3`/`trial_d0`, criar o toque **D-1**).
4. **Follow-up proativo pós-vencimento** (D+1, D+3) — porta aberta, tom "o patrimônio da {criança} continua guardado aqui".
5. **Gatilho de valor percebido** — detectar reações positivas ("nossa, você lembrou") e responder reforçando o patrimônio (Parte 7.1).
6. **Pergunta de ouro por intenção positiva** — detectar "não quero perder / queria continuar" e disparar a pergunta (Parte 7.2); guardar a resposta.

*(Tudo reusa o que já existe — relatório, rotina, planos, perfil vivo, lacunas. A única peça nova de geração é "O Retrato", que é variação do relatório. O resto é condução/copy + toques no cron.)*

---

## Parte 9 — Decisões abertas

1. ~~O nome do artefato~~ **RESOLVIDO (Sérgio, 23/07):** não tem nome. O patrimônio é o **Perfil** (já existe no menu); a Ayla só fala "olha o que já registrei da {criança}…" e ancora no Perfil. Sem substantivo de produto, sem novo item de menu.
2. **Régua diária:** qual o arco exato de valor entregue nos dias 1–6? O que a Ayla *entrega* (não só fala) em cada janela?
3. **Pós-vencimento:** quantos toques e com que espaçamento mantêm a porta aberta sem virar spam? (proposta: D+1 e D+3)
4. **Detecção dos gatilhos** (valor percebido / intenção positiva): por regex de expressões ou por classificador de intenção? (liga com o classificador pendente do CRM)
5. **Automatizar a "pergunta de ouro"** — confirmado que só dispara na intenção positiva; falta definir onde a resposta é guardada e quem lê.
