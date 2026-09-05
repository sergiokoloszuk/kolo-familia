# Quando a Ayla puxa assunto — como funciona hoje

**Para a agência que vai analisar a experiência conversacional da Kolo.**
Levantado em 02/09/2026, lendo o sistema e conferindo o banco de produção.
Nada foi alterado.

> **Este documento descreve apenas o estado atual.** Não diz como deveria
> funcionar, não propõe melhoria, não compara com um ideal e não recomenda
> mensagens. Onde há inconsistência, ela está descrita como comportamento
> observado — e nada mais.

---

## 1. Quando a Ayla pode começar uma conversa sozinha

A Ayla nunca decide falar "no meio do dia, porque achou melhor". Ela é
**acordada por um relógio**: quatro vezes por dia, o sistema desperta, olha
todas as famílias e pergunta, para cada uma, se pode escrever.

Os quatro despertares são **8h, 12h, 15h e 19h** (horário de Brasília). Fora
desses quatro instantes, **nenhuma mensagem espontânea nasce**.

Existem tipos diferentes de iniciativa, e cada um tem seu próprio despertar:

| Tipo | Quando o relógio toca |
|---|---|
| Conversa do dia | todos os dias, nos 4 horários |
| Sumiço (2 ou 5 dias sem falar) | todos os dias, nos 4 horários |
| Vídeo-guia da plataforma | todos os dias, nos 4 horários |
| Acompanhamento de plano | todos os dias, nos 4 horários |
| Avisos de fim do período grátis | todos os dias, nos 4 horários |
| Sugestão de fim de semana | **só às sextas** |
| Sugestão de repertório | **só aos sábados** |
| Aviso de problema de pagamento | **de hora em hora** |

Há uma exceção a tudo isso: **a mensagem de boas-vindas**, que sai assim que a
família termina o cadastro, em qualquer horário, sem esperar relógio nenhum.

---

## 2. Quantas por dia

**No máximo duas por família, por dia.** É um teto rígido: chegando a duas, o
sistema para, independentemente de quantos tipos de iniciativa estivessem
disponíveis.

Além do teto, há limites por tipo. Por exemplo: a conversa do dia sai **uma vez
por dia**; o vídeo-guia sai **uma vez na vida** da família.

---

## 3. Horários e a preferência da família

Cada família tem uma **faixa de horário**. Ela é escolhida na última pergunta do
cadastro, entre quatro opções:

| Escolha da família | Faixa |
|---|---|
| De manhã | 8h–10h |
| No meio do dia | 12h–14h |
| À tarde | 15h–17h |
| À noite | 19h–21h |

**Quem não responde essa pergunta fica com 19h–21h**, que é o padrão do sistema.

A regra é simples: quando o relógio toca, o sistema só considera as famílias cuja
faixa contém aquele instante. Uma família de "manhã" só pode ser procurada no
despertar das 8h.

**As quatro faixas coincidem com os quatro despertares** — o início de cada faixa
é exatamente um horário de despertar.

Há um detalhe observado: nas configurações do aplicativo é possível **digitar
qualquer horário livremente**, não só escolher entre as quatro opções. Uma faixa
digitada que não contenha 8h, 12h, 15h ou 19h — por exemplo, 20h–21h — não
coincide com nenhum despertar, e nenhuma mensagem espontânea é enviada nela.

---

## 4. O que impede uma mensagem de sair

Antes de qualquer mensagem, o sistema passa por uma sequência de verificações.
**Basta uma falhar para a mensagem não sair.** Nesta ordem:

1. **Sem consentimento** — a família não aceitou receber mensagens.
2. **Ayla desativada** — a família desligou.
3. **Ayla pausada** — a família pediu uma pausa, e ela ainda vale.
4. **Sem acesso ao produto** — período grátis vencido ou assinatura inativa
   bloqueiam as mensagens de acompanhamento. **Os avisos comerciais continuam
   podendo sair** — são justamente o convite para voltar.
5. **Criança não identificada** — quando o campo do nome da criança traz um
   recado em vez de um nome, o acompanhamento não sai.
6. **"Já conversamos hoje"** — se a família escreveu qualquer coisa naquele dia,
   a Ayla não puxa assunto. A boas-vindas é a única exceção.
7. **Fora da faixa de horário.**
8. **Duas mensagens já enviadas hoje.**
9. **Assunto delicado recente** — se a família registrou cansaço, ansiedade ou
   tristeza nas últimas 48 horas, mensagens comerciais ficam bloqueadas.
10. **Um insight não sai no mesmo dia que uma mensagem comercial.**
11. **A Ayla falou há menos de 36 horas** — mensagens de "sumiço" ficam adiadas.

Há ainda uma proteção contra duplicidade: quando dois processos tentam escrever
para a mesma família ao mesmo tempo, apenas um passa.

---

## 5. Como o sistema escolhe o assunto

Isto varia conforme o tipo de iniciativa, e a diferença é grande.

### Para a maior parte dos tipos: o assunto é o próprio tipo

"Sumiço de 2 dias", "seu período grátis termina em 3 dias", "acompanhamento do
plano" — nesses casos o motivo já É o assunto. O sistema apenas verifica se a
condição aconteceu.

### Para a conversa do dia: um sorteio orientado por estado

Este é o caso mais elaborado, e funciona assim:

O sistema calcula um número a partir de um **sorteio fixo por família e por dia**
— a mesma família, no mesmo dia, sempre cai no mesmo resultado; no dia seguinte,
pode cair em outro. Esse número é combinado com **cinco informações** sobre a
família:

- já existe um plano criado?
- em que dia do período grátis ela está?
- ela já escreveu para a Ayla alguma vez?
- há algum desafio sobre o qual já se conversou?
- há algum tema da criança ainda sem nenhuma informação?

Dessa combinação sai **uma entre nove intenções possíveis**:

| Intenção | O que a Ayla faz |
|---|---|
| Acolhimento | pergunta como estão, sem agenda |
| Menu do dia | oferece caminhos concretos para começar |
| Convite ao plano | puxa para montar um plano |
| Ensinar valor | mostra em que ela pode ajudar |
| Aprofundar tema | volta a um desafio já conversado |
| Explorar temas | pergunta sobre um tema ainda em branco |
| Completar perfil | pergunta algo que falta saber sobre a criança |
| Feedback do plano | pergunta o que achou do plano |
| Você sabia | apresenta um recurso da plataforma |

Alguns exemplos de como o estado inclina o sorteio: se a família **nunca
escreveu** e já passou do segundo dia, o "menu do dia" tem metade das chances. Se
**ainda não há plano**, o convite ao plano domina. Se **já há plano**, a pergunta
sobre o que achou passa a ser a mais provável.

**Uma observação:** dentro de cada situação, a escolha final entre as intenções
disponíveis é um sorteio por faixas de probabilidade, não uma decisão sobre qual
assunto seria mais oportuno naquele dia.

Há também um painel interno onde cada uma dessas intenções pode ser **desligada**
ou receber uma **orientação de texto** que passa a ter prioridade na escrita.

---

## 6 e 7. O que o sistema sabe no momento de decidir

Esta é a parte mais importante do documento. **Uma coisa é o que a Ayla sabe
quando responde; outra é o que ela sabe quando decide puxar assunto.** São
momentos diferentes, e o segundo enxerga menos.

No instante de decidir a conversa do dia, o sistema carrega: o nome do
responsável; nome, data de nascimento e gênero da criança; o perfil da criança;
**se existe** algum plano; a data de criação da conta; o status da assinatura; e
**se a família já escreveu alguma vez**.

| Informação | Usa? | Como |
|---|---|---|
| **Perfil / Kolo Vivo** | **USA** | é a base da personalização; de lá saem os temas e os campos em branco |
| **Histórico recente** | **NÃO USA** | o sistema verifica apenas **se a família já escreveu alguma vez na vida** — sim ou não. Não lê nenhuma mensagem |
| **Conversa do dia anterior** | **NÃO USA** | |
| **Perguntas já feitas** | **NÃO USA** | não há verificação do que já foi perguntado antes |
| **Respostas já dadas** | **USA PARCIALMENTE** | só o que virou registro no perfil. O que foi dito na conversa e não foi registrado não conta |
| **Lacunas do perfil** | **USA** | os campos em branco viram a intenção "completar perfil" e "explorar temas" |
| **Desafios** | **USA** | os que têm informação viram "aprofundar tema"; os vazios viram "explorar" |
| **Interesses** | **USA** | carregados do perfil e disponíveis para a escrita |
| **Estratégias já tentadas** | **NÃO USA** | |
| **O que funcionou ou não** | **NÃO USA** | |
| **Plano Kolo** | **USA PARCIALMENTE** | só **se existe** um plano — o conteúdo dele não é lido |
| **Rotina Visual** | **NÃO USA** para escolher a conversa do dia. Existe um tipo separado que pergunta sobre uma rotina criada |
| **Relatórios** | **NÃO USA** | |
| **Momento/dia do período grátis** | **USA** | inclina o sorteio e define os avisos comerciais |

**O ponto que resume a tabela:** o sistema sabe *o que está registrado sobre a
criança* e sabe *se a família já falou alguma vez* — mas **não lê a conversa**
para decidir sobre o que falar. Se uma pergunta foi feita ontem e respondida, o
mecanismo de iniciativa não sabe disso.

---

## 8. De onde vem o texto da mensagem

**Depende do tipo, e há três origens.**

### Regras
Decidem **se** e **para quem** a mensagem sai. Sempre. Nenhum texto nasce sem
passar por elas.

### Templates (textos prontos)
A maior parte dos tipos usa **variações fixas**, escritas por pessoas e guardadas
no sistema, com espaços para o nome do responsável, o nome da criança e a
concordância de gênero. O sistema sorteia uma variação.

Se a leitura falhar, existe um conjunto de textos embutidos como rede de
segurança.

### Inteligência artificial
**Um único tipo usa IA hoje: a conversa do dia.** Depois que o sorteio escolhe a
intenção, um texto de orientação é montado com os dados daquela família e enviado
a um modelo, que escreve a mensagem. O limite é curto — mensagem de conversa, não
texto longo.

Duas coisas são impostas ao modelo: **a concordância de gênero** (informada
explicitamente, com o aviso de que trocar é erro grave) e, quando existe, a
**orientação editorial** definida no painel interno para aquela intenção.

**Se a chamada ao modelo falhar**, o sistema cai automaticamente no texto pronto
da conversa do dia. A família recebe mensagem de qualquer forma.

### Em resumo

| Tipo | Origem do texto |
|---|---|
| Conversa do dia | **IA**, com fallback em texto pronto |
| Boas-vindas | texto pronto + desafios que a família marcou |
| Sumiço (2/5 dias) | texto pronto |
| Avisos do período grátis | texto pronto + link de planos |
| Marcos e conquistas | texto pronto |
| Acompanhamento de plano e rotina | texto pronto + link |
| Vídeo-guia | texto pronto + link |

---

## 9. Exemplos do que o sistema pode enviar hoje

Todos retirados dos textos do próprio sistema. **Nenhuma conversa real de
família foi usada.** Os nomes abaixo são espaços a preencher.

**Boas-vindas**
> *"Oi, [responsável]. Aqui é a Ayla 🌿 Obrigada por me deixar entrar na história
> de vocês. Vou aparecer aqui de vez em quando — sem cobrança, sem checklist."*

**Conversa do dia (texto pronto)**
> *"Oi, [responsável]. Me conta uma coisa boa e uma difícil — do que vier à
> cabeça, só pra eu acompanhar do meu canto."*

**Conversa do dia (escrita por IA)** — o modelo recebe uma orientação como
*"pergunta sobre [criança] pra você conhecer melhor; frase 1 contextualiza,
frase 2 é a pergunta, frase 3 diz que qualquer coisa serve — uma palavra, um
áudio"*, e escreve com as próprias palavras. Também recebe instruções do que
**não** dizer: nada de "perfil", "registro" ou "banco de dados".

**Sumiço de 2 dias**
> *"Oi, [responsável]. Faz uns dias sem você por aqui — está tudo bem aí? Se
> quiser me contar uma coisa, qualquer frase serve."*

**Sumiço de 5 dias**
> *"[responsável], faz alguns dias que não nos falamos. Sem cobrança — quero só
> saber se vocês estão bem."*

**Faltam 3 dias para o fim do período grátis**
> *"Oi, [responsável]. Te lembrando que seu período grátis termina em 3 dias. Se
> quiser continuar com a gente, os planos estão aqui: [link]. Sem pressa."*

**Último dia**
> *"Oi, [responsável]. Hoje é o último dia do seu período grátis 🌿 Tudo que você
> me contou continua salvo."*

**Período já encerrado** — existe um texto separado para quando o prazo já
passou, para não dizer "hoje é o último dia" a quem já está bloqueada.

**Marco de constância**
> *"[responsável], você me respondeu 7 dias seguidos 🌿 Isso é cuidado de
> verdade."*

---

## 10. Existe mais de um mecanismo?

**Não em produção. Há um só.**

Isto merece esclarecimento porque o sistema *parece* ter dois.

**O mecanismo em produção** é o descrito neste documento: relógio → verificações
→ escolha do assunto → texto → WhatsApp.

**A segunda pasta não tem alcance nenhum.** Existe no sistema um conjunto de
arquivos que descreve, em forma de código, um modelo de acompanhamento mais
elaborado. Verifiquei: **nenhum outro arquivo do sistema a utiliza**, e a própria
documentação dela declara que *"não contém comportamento ativo — nenhuma chamada
de IA, nenhuma escrita em banco, nenhum agendador rodando"*.

**Não há competição nem duplicação hoje.** Ela é uma camada de desenho, não um
segundo motor.

---

## 11. Relação com o período grátis (D0–D7)

O período grátis influencia a fala espontânea de **três maneiras**, e é útil
separá-las porque são independentes.

**Primeira — avisos de prazo.** Existem mensagens específicas para "faltam 3
dias", "hoje é o último dia" e "o período terminou". São textos prontos, sem IA, e
carregam o link de planos.

**Segunda — inclinação do assunto.** O dia do período grátis é uma das cinco
informações que orientam o sorteio da conversa do dia. Por exemplo: se a família
ainda não escreveu nada e já passou do segundo dia, o "menu do dia" ganha peso.

**Terceira — o corte de acesso.** Quando o período vence sem assinatura, as
mensagens de acompanhamento param. As comerciais continuam.

**O que é importante notar:** existe no sistema uma jornada dia a dia, do D0 ao
D7, com uma intenção definida para cada dia — conhecer a criança, ajudar num
desafio, ampliar, retomar, perguntar o que ajudou, e assim por diante.

**Essa jornada alimenta a conversa quando a família escreve.** Ela entra no
contexto da Ayla no momento de responder.

**Ela não é o que decide as mensagens espontâneas.** A iniciativa usa o *número
do dia* para inclinar um sorteio, e usa os prazos para os avisos comerciais — mas
a intenção descrita para aquele dia da jornada não conduz a mensagem espontânea.

---

## 12. O caminho completo

**O que faz o sistema decidir escrever**
O relógio toca (8h, 12h, 15h ou 19h). O sistema lista as famílias cuja faixa de
horário contém aquele instante. Para cada uma, passa pelas onze verificações da
seção 4. Quem sobrevive a todas é candidata.

**Como escolhe o assunto**
Se for um tipo com condição própria (sumiço, prazo, acompanhamento de plano), o
assunto já está definido pelo próprio tipo. Se for a conversa do dia, o sistema
carrega o perfil da criança e mais cinco informações de estado, e sorteia uma
entre nove intenções.

**Como monta a mensagem**
Para quase todos os tipos: escolhe uma variação de texto pronto e preenche nome,
criança e concordância. Para a conversa do dia: monta uma orientação com os dados
daquela família, acrescenta a regra de concordância de gênero e a orientação
editorial (se houver), e pede ao modelo que escreva.

**Como envia**
Antes de enviar, o sistema faz uma reserva para garantir que dois processos não
escrevam à mesma família ao mesmo tempo. Envia pelo WhatsApp e registra a
mensagem, com o tipo e a intenção usada — o que permite consultar depois o que foi
enviado e por quê.

Se o modelo falhar, o texto pronto assume e a mensagem sai mesmo assim.

---

## RESUMO — COMO A FALA ESPONTÂNEA FUNCIONA HOJE

1. A Ayla só pode iniciar conversa em **quatro instantes do dia** — 8h, 12h, 15h
   e 19h. Fora deles, nada nasce.
2. **No máximo 2 mensagens espontâneas por família por dia.**
3. A família escolhe **uma entre quatro faixas de horário** no cadastro; quem não
   escolhe fica com 19h–21h.
4. **Se a família escreveu qualquer coisa naquele dia, a Ayla não puxa assunto.**
5. **Período grátis vencido corta as mensagens de acompanhamento**, mas não as
   comerciais.
6. Para a conversa do dia, o assunto é definido por um **sorteio fixo por família
   e por dia**, inclinado por cinco informações de estado, entre nove intenções.
7. **A decisão de puxar assunto não lê a conversa.** Ela sabe se a família já
   escreveu alguma vez — não o que foi dito, nem o que já foi perguntado.
8. **Usa o perfil da criança** (desafios, interesses, campos em branco); **não
   usa** estratégias tentadas, o que funcionou, relatórios, nem o conteúdo do
   plano — só se ele existe.
9. **Só um tipo é escrito por IA**: a conversa do dia. Todo o resto vem de textos
   prontos, e a IA tem sempre um texto pronto de reserva.
10. **Existe um só mecanismo em produção.** A jornada dia a dia do período grátis
    orienta a Ayla **quando a família escreve** — não as mensagens espontâneas.

---

### Sobre este levantamento

Feito por leitura do sistema e consulta ao banco de produção, sem alterar nada.
Nenhum dado pessoal, identificador de família ou conversa real foi incluído. Os
exemplos da seção 9 vêm dos textos do próprio sistema.
