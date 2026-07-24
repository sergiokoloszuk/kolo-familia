# Continuidade pós-plano — brief pro ChatGPT

> **Objetivo:** desenhar o que acontece DEPOIS que a Ayla entrega um plano. Hoje a conversa morre ali: não sabemos se a família gostou, se conseguiu abrir, se testou, e não aprofundamos o tema. Queremos manter a relação viva, fechar o ciclo (funcionou? gostou?) e continuar explorando — de um jeito que agregue e que a Kolo vá aprendendo sobre a criança. Este doc dá TODO o contexto pro ChatGPT (ele não conhece a estrutura do plano nem como ele aparece nos canais).

---

## 1. O que é a Kolo (contexto)

Produto para famílias de crianças/jovens/adultos **neurodivergentes** (autismo, TDAH, etc.). A **Ayla** é a IA que conversa com o cuidador (quase sempre a mãe). Dois canais, **mesma Ayla**:
- **WhatsApp** — conversa reativa; a Ayla também manda mensagens proativas (com consentimento).
- **Web (app)** — a seção "Estratégias" (conversa no app) + o "Perfil" (retrato da criança) + "Meus Planos" + "Evolução".

Princípios da Ayla: acolhe primeiro; ensina o cuidador a **observar** o desenvolvimento; conduz uma jornada (não é um respondedor de perguntas); **não infantiliza** jovem/adulto; adapta tudo à idade.

## 2. O que é um PLANO (a estrutura)

Um plano é um **documento completo e personalizado** sobre um desafio/habilidade específica da criança. Ele reúne, num só lugar, seções que a família também poderia ver clicando "botões" no app — cada seção com profundidade real. As **seções** (nesta ordem, algumas condicionais):

1. **Entender** — 1-2 parágrafos que acolhem, mostram a força da criança e levantam a **hipótese central** do que pode estar por trás (possibilidade, nunca causa cravada). Termina convidando a observar.
2. **Crenças** — até 3 crenças da CRIANÇA + 3 da RESPONSÁVEL (hipótese gentil, jamais julgamento) + um reenquadre acolhedor (ex.: "ele não é capaz" → é uma habilidade ainda em construção).
3. **O que fazer diferente** — a mudança concreta a testar.
4. **Rotina** (condicional) — como estruturar o dia/transições, quando o tema pede.
5. **Brincadeiras** — VÁRIAS (3+), concretas, com materiais e duração. *(Para jovem/adulto: viram "atividades", nunca "brincadeiras".)*
6. **Atividades** — atividades práticas pra treinar/desenvolver.
7. **História social** (condicional) — uma historinha curta que ensaia uma situação (transição, regra), quando faz sentido. *(Só criança pequena.)*
8. **Frases prontas** — frases que o cuidador pode usar exatamente, em situações concretas.
9. **O que observar** — 1-3 coisas concretas pra reparar nos próximos dias, ligadas à hipótese.

O plano é gerado por IA a partir do **desafio** + do **perfil da criança** (interesses, jeito, sensorial…) + do que já se aprendeu de planos anteriores.

## 3. Exemplo real de plano (resumido)

Contexto: mãe quis montar uma **festa do pijama** pra filha (6 anos, TEA, adora competição leve, precisa de previsibilidade). Depois de uma conversa rica, a Ayla gerou:

- **Entender:** "Uma festa do pijama com as amigas vai ser uma memória enorme — e dá pra deixar tudo gostoso pra ela sem precisar 'gerenciar' ninguém."
- **O que fazer diferente:** reservar um cantinho quieto (almofadas, luz baixa) pra ela se retirar sem sair da festa.
- **Roteiro/atividades:** Chegada (20-30 min sem brincadeira estruturada, só se aquecer) → Caça-palavras gigante (cooperativo) → Jogo de memória (competitivo na medida) → Cinema em casa (junto sem interagir o tempo todo) → Desfile de pijama (categorias bobas) → Dormir (luz baixa, rotina preservada).
- **Frases prontas / o que observar** entram junto.

## 4. Como o plano APARECE (WhatsApp × web) — importante

### No WhatsApp
O fluxo hoje (recém-ajustado): a mãe traz um tema → a Ayla tem uma **conversa rica** (entende, dá ideias concretas, explica) → quando faz sentido trabalhar algo, **oferece**: *"quer que eu monte um plano completo sobre isso, pra você ter salvo e organizado?"* → a mãe diz **"sim"** → a Ayla responde *"tô montando 🌿 já já te mando"* → o sistema gera e entrega:
- um **PDF** do plano (enviado como documento no WhatsApp);
- + um **link mágico** que abre o plano no app, já logado, na tela do plano.

Exemplo de mensagem de entrega:
> *"Montei um plano completo sobre isso — mandei em PDF aqui em cima 👆 (dá pra salvar e imprimir). E se quiser ver no app, ajustar ou me contar depois como foi, é só abrir: {link}"*

**Problema técnico real:** às vezes o PDF/link **não chega** (falha de entrega), e a mãe diz *"não recebi, traz aqui"* — aí a Ayla acaba escrevendo o plano no chat (fallback). Isso corrói a confiança.

### Na Web (app)
Na seção **Estratégias**, a pessoa conversa e o plano é gerado e aberto **dentro do app** (tela "/planos/{id}"): cada seção renderizada (Entender, Crenças, O que fazer diferente, Brincadeiras…), **editável**, com botão de **baixar PDF**. Fica salvo em **"Meus Planos"**.

## 5. O que existe hoje de follow-up (e os limites)

Existe UM seguimento proativo: **3 a 14 dias** depois de um plano sem resultado registrado, a Ayla pergunta:
> *"Lembra do plano sobre {tema}? Você testou? Me conta como foi…"*

A resposta vira **aprendizado** (funcionou / parcial / não funcionou), que melhora os próximos planos.

**Limites:**
- É **longe** (3-14 dias) e focado só em "**testou/funcionou?**".
- Não pergunta logo, de leve, se **gostou / conseguiu abrir** o plano.
- Não **aprofunda o tema** (não puxa a conversa de volta pra construir mais).
- Se o PDF não chegou, ninguém sabe.

## 6. O problema a resolver

Depois que a Ayla entrega o plano, **a conversa morre**. A gente não sabe:
- se o plano **chegou** (o PDF/link abriu?);
- se a família **gostou**;
- se **testou** e como foi;
- e perde a chance de **continuar explorando o tema** (aprofundar, ajustar, aprender mais sobre a criança pro perfil).

Queremos uma **continuidade pós-plano** que mantenha a relação viva, feche o ciclo e agregue — sem virar spam, sem cobrança, respeitando a janela emocional (nunca insistir se a família está em crise/exausta) e a idade.

## 7. Perguntas pro ChatGPT

1. **Cadência pós-plano:** qual a régua ideal de toques depois de entregar um plano? (ex.: confirmação de recebimento na hora? um "conseguiu abrir/gostou?" no dia seguinte? o "testou/funcionou?" alguns dias depois? aprofundamento do tema?) Quantos toques, com que espaçamento, sem virar spam?
2. **O "gostou?" curto:** como e quando perguntar se gostou / se conseguiu abrir, de um jeito leve que também **capte se o PDF não chegou**?
3. **Continuar explorando o tema:** como a Ayla puxa a conversa de volta pra **aprofundar** (não só "funcionou?"), agregando (explicando o desenvolvimento, ajustando o plano, propondo o próximo passo) — e como isso vira **aprendizado pro perfil da criança**?
4. **Diferença por canal:** o pós-plano deve ser igual no WhatsApp e na web? (No WhatsApp é proativo; na web a pessoa volta quando quer.)
5. **Fechar o ciclo de aprendizado:** que sinais coletar (gostou, abriu, testou, funcionou, o que ajustaria) e como usá-los pra melhorar os planos seguintes e o retrato da criança?
6. **Travas:** o que respeitar sempre — não insistir em crise/exaustão, não repetir, adequar à idade, não transformar em cobrança.
