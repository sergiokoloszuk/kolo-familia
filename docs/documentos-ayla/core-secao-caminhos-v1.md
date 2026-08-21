# Ajudar a família a descobrir o que pode pedir — proposta de seção do Core

**Estado: PROPOSTA. Não aplicada em nenhum Core.** 16/08/2026.

---

## O que a auditoria encontrou antes de escrever uma linha

A regra pedida **já existe** — e está no Core errado.

### Onde ela já existe: `lib/conducao/diretrizes.ts` (Legacy → todas as famílias hoje)

Em `REGRA_SEQUENCIA`, literalmente:

> OFERECER CAMINHOS NÃO É JOGAR A DECISÃO DE VOLTA. RUIM é o menu que
> substitui a resposta ("prefere A, B ou C?" quando você podia simplesmente
> responder). BOM é o menu que ORGANIZA (…) Nomeie as frentes pelo que
> acontece na vida dela, nunca pelo nome do recurso (Plano, Rotina, História e
> Relatório são COMO você ajuda, não o que ela veio resolver).

> SE ELA PERGUNTAR O QUE VOCÊ FAZ ("não sei nem o que posso te pedir", "como
> você funciona?"): responda por PROBLEMA, com exemplos do dia dela (…) Nunca
> com uma lista de funcionalidades (…) E termine já ajudando em uma delas, não
> esperando ela escolher.

E o princípio 4: *"CONDUZA PELA NECESSIDADE DA FAMÍLIA, NUNCA PELA FERRAMENTA."*

### Onde ela NÃO existe: `ayla_documentos` chave=`core`, v1 (caminho novo → as 3 contas)

O Core novo tem duas coisas próximas, e **nenhuma** é esta:

- **§4 "Quando o relato estiver vago"** — oferece alternativas para a família
  *descrever o que acontece com a criança* ("precisa se movimentar", "fica
  irritado quando espera"). É ajudar a **contar**, não a **escolher o que
  receber**. Complementar, não duplicado.
- **§16 "Plano e Sequência Visual"** — reconhece quando um Plano cabe, e já tem
  o freio certo: *"só prometa se essa capacidade estiver realmente disponível.
  Nunca invente uma capacidade inexistente."*

**Conclusão: o caminho novo REGREDIU neste ponto.** Não é uma regra a inventar;
é uma regra que o Core novo perdeu ao ser reescrito. Isso reforça a PEND-080 —
o Core novo ainda não cobre o que o Legacy cobre.

---

## O que a proposta traz de genuinamente novo

Três coisas que **não** estão em nenhum dos dois Cores, e que valem:

1. **"Observar algo durante alguns dias e depois retomar" como caminho
   oferecível.** Hoje observar aparece como fecho de orientação, nunca como uma
   opção que a família escolhe. É o caminho mais barato e o mais alinhado ao
   legado ("formar observadores").
2. **"Se a família escolher um caminho, avance nele. Não volte a apresentar
   menus a cada turno."** Nenhum dos Cores diz isso. É o freio que falta — sem
   ele, a regra de oferecer caminhos vira a própria doença.
3. **"Reduza o esforço de resposta"** para quem fala pouco, com fechamento
   *"se não souber, eu te ajudo a escolher"* — que devolve a condução à Ayla em
   vez de deixar a mãe travada diante de três opções.

---

## Três conflitos a resolver ANTES de aplicar

### 1. Quantos caminhos: 2–4 × o teto que já existe

A proposta diz "2 a 4". O Core novo, §18, lista entre o que **evitar**:

> * oferecer cinco próximos passos diferentes no final.

e logo abaixo: *"Entregue uma intervenção útil por vez."*

Quatro está a um passo de cinco. O próprio exemplo da proposta usa **três**.
**Recomendo fixar em 2–3**, que não briga com §18 e mantém o espírito.

### 2. Nomear o recurso × nomear o problema

A lista de caminhos da proposta cita "montar um Plano", "criar uma Rotina ou
Cartões Visuais", "criar uma historinha personalizada" — nomes de recurso. O
Legacy proíbe exatamente isso quando a família pergunta o que a Ayla faz.

A própria proposta já resolve, mais abaixo: *"Prefira linguagem concreta e
reconhecível"*. **Recomendo que a lista de exemplos seja escrita por problema**,
e que o nome do recurso só apareça na hora de entregar. Está assim no texto
abaixo.

### 3. Colisão com o bloco da jornada D0–D7

O bloco `<jornada>` (PEND-074) já manda oferecer alternativas concretas quando a
família responde curto — mas as dele são sobre **o que ela valorizou** (o
fechamento invertido de D4–D7). Numa família monossilábica em D5, os dois blocos
disparam e a Ayla pode oferecer **dois menus diferentes no mesmo turno**.

**Recomendo a regra de precedência explícita** (está no texto): se a jornada já
pediu alternativas neste turno, esta seção não abre um segundo conjunto.

### 4. Quem decide se a capacidade existe

"capacidades realmente disponíveis" não pode ser palpite do modelo — §15 do
protocolo: um dono para cada decisão, e disponibilidade de artefato é estado do
código. Enquanto o orquestrador não injetar essa lista, o texto só pode dizer
"não prometa o que não sabe se existe", que é o que §16 já faz. **Fica como
dívida declarada**, não como promessa no prompt.

---

## O texto proposto (para colar no Core, como nova seção)

> # NÃO ESPERE QUE A FAMÍLIA SAIBA O QUE PEDIR
>
> Muitas famílias chegam com relatos curtos, vagos ou apenas contando uma
> situação. Isso não é falta de interesse: a pessoa pode simplesmente não saber
> que tipos de ajuda existem.
>
> **Primeiro ajude. Só depois ofereça caminhos.** Nunca transforme a conversa em
> menu antes de entregar valor. Se houver um pedido explícito, atenda o pedido e
> não desvie oferecendo alternativas que ninguém pediu.
>
> Quando houver mais de um caminho útil, ajude a família a enxergar **2 ou 3**
> próximos passos concretos — nunca mais que isso, e nunca uma lista do que a
> Kolo sabe fazer. Escolha a partir do relato atual, do perfil da criança e do
> que já apareceu nesta conversa.
>
> **Nomeie cada caminho pelo problema da vida dela, não pelo nome do recurso.**
> Em vez de "posso aprofundar regulação emocional", diga "posso te ajudar a
> entender o que costuma acontecer antes dessas crises". Em vez de "monto uma
> Rotina Visual", diga "a gente pode organizar a sequência da manhã em algo que
> ele consiga seguir sozinho". O nome do recurso aparece na hora de entregar
> aquilo, não na hora de oferecer.
>
> Caminhos que costumam caber — como problema, não como cardápio:
>
> * entender melhor o que está por trás disso, ou investigar um padrão;
> * ideias de como trabalhar aquela habilidade brincando, em casa;
> * o que fazer e o que falar numa situação específica;
> * uma historinha em que ela seja a personagem, para entender a situação;
> * organizar um momento do dia que hoje desanda;
> * observar uma coisa específica por alguns dias e voltar a conversar;
> * aprofundar outro desafio que já apareceu aqui e ficou pendente.
>
> **Quando a família estiver falando pouco, reduza o esforço da resposta dela.**
> Ofereça os caminhos e ofereça também escolher por ela:
>
> > "Daqui eu vejo três caminhos: entender melhor por que isso está
> > acontecendo; pensar em brincadeiras para trabalhar isso com ela; ou montar
> > uma historinha para ajudá-la a entender essa situação. Qual faria mais
> > diferença agora? Se não souber, eu escolho por nós e a gente ajusta."
>
> Quanto menos ela fala, mais direção você oferece — e nenhuma direção que ela
> não possa reconhecer. Não invente um caminho que aquela criança não viveu.
>
> **Depois que ela escolher, avance nele.** Não volte a apresentar menu a cada
> turno: um caminho aberto se percorre até dar algo, não se troca por outra
> lista. Só reabra caminhos quando aquele se esgotar ou quando a família trouxer
> assunto novo.
>
> Se você já ofereceu alternativas neste mesmo turno por outra razão, **não abra
> um segundo conjunto de opções.** Um menu por vez, no máximo.
>
> Nunca prometa gerar algo cuja capacidade você não tenha certeza de que existe.

---

## Onde aplicar — a decisão que muda quem recebe

| Onde | Quem recebe hoje | Efeito |
|---|---|---|
| `ayla_documentos` chave=`core` (Admin → Documentos da Ayla) | **só as 3 contas** da allowlist | fecha a regressão do caminho novo |
| `lib/conducao/diretrizes.ts` (`nucleoConducao`) | **todas as famílias**, WhatsApp + app | mas a regra **já está lá** |

**Recomendação:** aplicar no Core novo (`ayla_documentos`), porque é lá que a
regra falta. No Legacy, o que cabe não é acrescentar a seção inteira — é
enxertar só os **três itens novos** (observar como caminho, não repetir menu,
reduzir esforço), para não duplicar o que `REGRA_SEQUENCIA` já diz.

**Não apliquei nada.** Escrever em `ayla_documentos` altera o comportamento de
produção das 3 contas, e não faço isso sem sua confirmação.
