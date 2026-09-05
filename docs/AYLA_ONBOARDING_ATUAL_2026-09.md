# O onboarding da Kolo, como ele é hoje

**Para a equipe que vai analisar a experiência conversacional da Ayla.**
Levantado em 02/09/2026, lendo o sistema e conferindo o banco de produção.
Nada foi alterado — nem código, nem banco, nem textos, nem configuração.

---

## O que este documento responde

A pergunta é simples e a resposta não é: **a mãe responde 13 perguntas — quanto
disso a Ayla realmente sabe quando a conversa começa?**

Existe uma diferença entre *o que o onboarding coleta* e *o que chega até a
Ayla*. Ela está marcada em cada linha, e resumida no fim.

### As quatro marcas usadas aqui

| Marca | Significa |
|---|---|
| 🟢 **CHEGA** | a Ayla recebe essa informação em toda conversa |
| 🟡 **CHEGA EM PARTE** | chega transformada, resumida ou só em certas situações |
| 🔴 **NÃO CHEGA** | fica guardado, mas a Ayla não vê |
| ⚪ **NÃO PROVEI** | não consegui confirmar com segurança |

### Uma verificação que veio primeiro

Os textos do onboarding **podem** ser editados por um painel interno. Então
antes de tudo eu conferi qual versão está no ar: **o campo de texto publicado
está vazio no banco**, o que significa que o sistema usa os textos originais do
próprio programa.

**As 13 perguntas abaixo são, palavra por palavra, as que a família vê hoje.**

---

## As 13 perguntas, na ordem exata

### 1. Nome da criança
> *"Pra começar: quem é a pessoa que você cuida?"*
Campo aberto · **obrigatória**

Guarda o nome na ficha da criança. 🟢 **CHEGA**

---

### 2. Gênero
> *"Sobre [NOME]: falo no feminino ou no masculino?"*
Escolha única: Feminino · Masculino · **obrigatória**

Guarda o gênero na ficha da criança. 🟢 **CHEGA** — e chega de um jeito
específico: a Ayla não recebe "gênero: feminino", recebe **como falar** ("ela/dela").
Antes de agosto ela adivinhava pelo nome; hoje não adivinha mais.

---

### 3. Data de nascimento
> *"Qual a data de nascimento de [NOME]? Assim minhas ideias acompanham a fase de vida — do jeito certo pra cada idade."*
Campo de data · **obrigatória**

🟡 **CHEGA EM PARTE** — a Ayla recebe **a idade em anos**, não a data. Para o que
ela faz, a idade é o que importa; mas quem esperava que ela soubesse o
aniversário não vai encontrar isso.

---

### 4. Diagnósticos com laudo
> *"[NOME] já tem laudo de alguma coisa? Toca em tudo que já tem — e se ainda não tiver, é só pular."*
Múltipla escolha: Autismo (TEA) · TDAH · Dislexia · Altas habilidades · Outro (texto livre) · **pode pular**

🟢 **CHEGA** — como *"Diagnóstico informado pela família"*.

Um detalhe que vale registrar: se a família não marcar nada, **nada é dito à
Ayla**. Isso é proposital — já houve um caso em que a lista vazia produzia a
frase "Diagnóstico informado pela família:" seguida de nada.

---

### 5. Em investigação
> *"E tem algo ainda em investigação, sem laudo? (pode pular também)"*
Mesmas opções · **pode pular**

🟢 **CHEGA** — guardado com uma marca de "hipótese", junto dos diagnósticos, de
forma que a Ayla distingue o que tem laudo do que está sendo investigado.

---

### 6. Desafios de agora
> *"O que mais pesa no dia a dia agora? Pode marcar vários — toque em tudo o que hoje está difícil. A gente começa por aí."*
Múltipla escolha: Comunicação · Sono · Foco · Alimentação · Socialização · Emoções/crises · Escola · Autonomia · Rotina/transições · **obrigatória**

🟢 **CHEGA** — e é **a informação mais bem aproveitada de todo o onboarding**.
Aparece na primeira mensagem da Ayla, entra no contexto de toda conversa, e o
sistema sabe distinguir "desafio que a família marcou mas nunca detalhou" de
"desafio sobre o qual já conversamos".

---

### 7. Interesses da criança
> *"O que [NOME] mais gosta de fazer? Toque no que combina — e adicione outros se quiser."*
Múltipla escolha com opções livres · **pode pular**

🟢 **CHEGA** — como *"Interesses atuais"*. É o que permite à Ayla usar o que a
criança gosta para propor uma estratégia, em vez de sugerir algo genérico.

---

### 8. WhatsApp
> *"Pra eu te acompanhar todo dia — e te mandar ideias pra [NOME] mesmo quando você não estiver no app — me passa seu WhatsApp?"*
Telefone · **obrigatória, com código de 6 dígitos**

Este é o único ponto do onboarding que **para e exige confirmação**: a família
recebe um código no WhatsApp e precisa digitá-lo. O número só é salvo depois
disso.

🔴 **NÃO CHEGA** como informação de conversa — e não deveria: é o endereço por
onde a Ayla escreve, não algo sobre a criança.

---

### 9. Nome do responsável
> *"Agora me conta de você: como te chamo?"*
Campo aberto · **obrigatória**

🟢 **CHEGA** — a Ayla recebe *"Responsável: [nome]"*.

---

### 10. Relação com a criança
> *"E você é o quê de [NOME]?"*
Escolha única: Mãe · Pai · Avó · Avô · Outro(a) (texto livre) · **obrigatória**

🔴 **NÃO CHEGA.** Fica guardado na ficha da família e **não entra no contexto da
Ayla**. Na prática: uma avó que passou pelo onboarting inteiro dizendo que é avó
conversa com uma Ayla que não sabe disso. Se o assunto não voltar na conversa, a
informação some.

---

### 11. Combinados (termos e privacidade)
> *"Antes de seguir, dois combinados rapidinhos:"*
Aceites · **obrigatória**

Guarda o consentimento com data. 🔴 **NÃO CHEGA** à conversa — mas é o que
**autoriza** a Ayla a escrever. Sem esse aceite, ela não manda mensagem nenhuma.

---

### 12. Faixa etária do responsável
> *"E você, em que faixa de idade está? (só pra eu conhecer melhor as famílias — pode pular)"*
Escolha única: 18-25 · 26-35 · 36-45 · 46-59 · 60+ · Prefiro não dizer · **pode pular**

🔴 **NÃO CHEGA.** É guardado como uma data aproximada de nascimento do
responsável e serve para relatórios internos, não para a conversa.

---

### 13. Melhor horário
> *"Qual horário costuma ser melhor pra eu te escrever no WhatsApp?"*
Escolha única: De manhã · No meio do dia · À tarde · À noite · **pode pular**

🔴 **NÃO CHEGA** ao que a Ayla *diz* — mas **decide quando ela fala**. Vira uma
faixa de horário (manhã 8h–10h, meio-dia 12h–14h, tarde 15h–17h, noite 19h–21h)
e o sistema só envia mensagem espontânea dentro dela.

**Quem pula esta pergunta fica com o padrão do sistema: 19h–21h.** Não há aviso.

---

## Onde cada informação fica guardada

Sem detalhe técnico, só a organização:

| Onde | O que guarda |
|---|---|
| **Ficha da criança** | nome, data de nascimento, gênero, diagnósticos e hipóteses |
| **Perfil da criança** | desafios marcados, interesses, e tudo que for aprendido depois |
| **Ficha da família** | nome do responsável, relação, faixa etária, WhatsApp |
| **Preferências da Ayla** | faixa de horário, consentimento, se está ativa ou pausada |

---

## A mensagem de boas-vindas — o que ela usa

A primeira mensagem que a família recebe no WhatsApp usa **quatro** informações
do onboarding:

1. **o nome do responsável**;
2. **o nome da criança**;
3. **o gênero** — para concordar as palavras corretamente;
4. **os desafios marcados** — até três, com as palavras que a própria família escolheu.

Ela também pode incluir **um vídeo-guia da plataforma**, quando a família ainda
não abriu o app.

O que essa mensagem faz, nesta ordem: reconhece que já conheceu um pouco da
criança, devolve os desafios que a família marcou, explica em uma frase o tipo de
ajuda, pergunta por qual começar, e convida a contar por texto ou áudio.

O que ela **não** faz, de propósito: não lista recursos ("tenho planos, rotinas,
relatórios"), não promete nada, e não pede nenhum dado novo.

> **Vale registrar:** até agosto essa mensagem citava **um só** desafio e fazia
> uma pergunta. Funcionava como isca, mas não ensinava nada — e as famílias
> chegavam perguntando sobre remédio, amamentação, assuntos fora do escopo,
> porque "uma IA no WhatsApp" não tem território visível. A mensagem atual nasceu
> dessa constatação.

---

## O que acontece quando o onboarding termina

1. A família responde a última pergunta.
2. O sistema salva tudo e marca o cadastro como concluído.
3. **A Ayla envia a mensagem de boas-vindas no WhatsApp** — automaticamente, sem
   esperar a família fazer nada, e **em qualquer horário**: esta é a única
   mensagem que ignora a faixa de horário escolhida.
4. A família vê uma tela final: *"Tudo pronto, [nome]! Por onde você quer
   começar?"*, com **quatro caminhos**:
   - **Falar comigo agora no WhatsApp** — abre a conversa já começada
   - **Completar o perfil de [criança]**
   - **Pedir uma estratégia**
   - **Montar a rotina visual**

Se a família escolher o WhatsApp, a conversa abre com uma primeira frase já
escrita para ela enviar.

---

## Onde "o que se coleta" e "o que a Ayla recebe" se separam

Este é o ponto central deste documento.

| Informação coletada | A Ayla recebe? |
|---|---|
| Nome da criança | 🟢 sim |
| Gênero | 🟢 sim, como forma de falar |
| Data de nascimento | 🟡 só a idade em anos |
| Diagnósticos com laudo | 🟢 sim |
| Em investigação | 🟢 sim, marcado como hipótese |
| Desafios | 🟢 sim |
| Interesses | 🟢 sim |
| WhatsApp | 🔴 não (é o canal, não conteúdo) |
| Nome do responsável | 🟢 sim |
| **Relação com a criança** | 🔴 **não** |
| Aceite dos termos | 🔴 não (autoriza a Ayla a escrever) |
| **Faixa etária do responsável** | 🔴 **não** |
| **Horário preferido** | 🔴 não no que ela diz — decide **quando** ela fala |

**Duas perdas de conteúdo, e as duas são sobre o adulto:** a Ayla não sabe se
está falando com a mãe, o pai, a avó ou o avô, nem a faixa etária de quem
escreve. As informações **sobre a criança** chegam praticamente todas.

Uma diferença importante de natureza: relação e faixa etária ficam guardadas e
**não são usadas**. O horário é usado — só que para outra coisa (quando falar),
não para o que dizer.

---

## O QUE A AYLA REALMENTE JÁ SABE QUANDO A CONVERSA COMEÇA

Só o que é comprovadamente entregue a ela:

1. **O nome de quem está escrevendo.**
2. **O nome da criança.**
3. **A idade da criança**, em anos.
4. **Como falar da criança** — ela/dela ou ele/dele, quando a família informou.
5. **Os diagnósticos**, quando houver — separando o que tem laudo do que está em
   investigação.
6. **Os desafios que a família marcou** — e quais deles ainda não foram
   detalhados em nenhuma conversa.
7. **Os interesses da criança.**
8. **Como a criança se comunica hoje** e **suas sensibilidades** — quando esses
   campos foram preenchidos depois, no perfil.
9. **"Como ela é"** — o retrato que a família escreveu sobre quem é a criança,
   quando existe.
10. **O que já foi conversado antes** — o histórico recente e os aprendizados
    registrados.
11. **O que ainda falta saber** — a Ayla recebe uma lista explícita das lacunas,
    para saber o que ainda vale perguntar.

E o que ela **não** sabe, mesmo tendo sido perguntado:

- se quem escreve é mãe, pai, avó ou avô;
- a faixa etária de quem escreve;
- a data exata de nascimento da criança (só a idade).

---

## Duas observações finais, sem correção

Documentando o estado real, sem propor mudança:

**Uma tela que ninguém vê.** Existe no sistema uma tela de boas-vindas separada,
que também pergunta o melhor horário. Ela ficou inalcançável: o onboarding, ao
terminar, já a marca como vista. Quem faz o cadastro normal nunca passa por ela.

**Quatro horários fixos.** As mensagens espontâneas são disparadas em quatro
momentos do dia (8h, 12h, 15h e 19h), que coincidem com o início das quatro
faixas oferecidas na pergunta 13. Nas configurações do app, porém, é possível
digitar **qualquer** horário — e uma faixa que não contenha um desses quatro
momentos não recebe mensagem.

---

### Sobre este levantamento

Feito por leitura do sistema e consulta ao banco de produção. Nenhum dado
pessoal, identificador de família, texto de conversa real ou informação sensível
foi incluído aqui. Os textos das perguntas são os que a família vê, e foram
conferidos contra o que está publicado.
