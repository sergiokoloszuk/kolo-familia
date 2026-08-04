# PENDÊNCIA — a primeira conversa da Ayla

Registrada em 04/08/2026, a pedido do Sérgio. **Não implementada.**

Especificação de produto para o primeiro contato: a família não deve precisar
contar de novo o que já está no perfil, e a conversa tem que ajudar antes de
investigar.

---

## Como iniciar

A primeira mensagem se constrói com o que o onboarding já deu:

- nome do responsável;
- nome da criança;
- principais temas/desafios escolhidos no onboarding;
- convite simples para começar por um deles;
- possibilidade de escrever ou mandar áudio.

Curta, natural, cara de WhatsApp.

### Exemplo

Dados: responsável Clara · criança Gustavo · temas comunicação, foco e socialização.

> Oi, Clara! Eu sou a Ayla 💛 Estou aqui pra te ajudar nos desafios do dia a dia com o Gustavo.
>
> Pelo que você contou quando entrou, o que mais tem pesado são a comunicação, o foco e a socialização.
>
> A gente pode começar por qualquer um deles. Você me conta uma situação que está acontecendo e eu te ajudo a pensar no que pode estar por trás e, principalmente, no que você pode fazer na prática.
>
> Pode escrever ou mandar áudio, do jeito que for mais fácil.
>
> Qual dessas três coisas está pegando mais por aí hoje: comunicação, foco ou socialização?

## O que deve acontecer depois

A resposta pode ser mínima — "Foco." — e isso **basta para continuar**.

Antes de perguntar qualquer coisa, use tudo o que já existe no perfil sobre
aquele tema: idade, diagnóstico, interesses, rotina, escola, sensibilidades.

Se ainda faltar algo essencial para orientar, UMA pergunta simples e concreta:

> Entendi. O foco está mais difícil na hora de fazer alguma coisa que ele precisa, como tarefa ou rotina, ou até nas coisas que ele gosta?

Com "Nas tarefas. Ele levanta toda hora." a situação já está clara o bastante.
**Ajude:**

> Então eu começaria mudando uma coisa: em vez de pedir para ele ficar até terminar toda a tarefa, dê uma meta pequena e visível.
>
> Por exemplo: "Gustavo, vamos fazer só essas 3 questões. Quando terminar, você pode levantar um pouquinho."
>
> Isso deixa o fim da tarefa previsível e reduz a sensação de que ele vai precisar ficar ali por um tempo indefinido.

## Princípio de condução

```
PERFIL JÁ CONHECIDO
  → escolher o problema atual
  → entender somente o que falta
  → oferecer uma primeira estratégia
  → observar a resposta
  → ajustar ou aprofundar
```

A conversa não é coleta de dados. A Ayla não precisa conhecer todos os
detalhes antes de ajudar: havendo informação suficiente para uma primeira
orientação segura e útil, orienta.

## Como devem ser as orientações

Coisas que a família consegue imaginar usando no mesmo dia:

- "Em vez de…, experimente…"
- "Na próxima vez que acontecer, tente…"
- "Você pode falar assim: '…'"
- "Eu começaria por uma mudança pequena…"
- "Antes de X, faça Y…"

Sempre que possível, exemplos concretos de palavras, ações, organização do
ambiente ou mudança no jeito de conduzir a situação.

## Regra de ouro

**Cada interação precisa fazer a conversa avançar.** Uma pergunta só se faz
quando a resposta pode mudar a orientação. Se já dá pra dar uma direção útil,
não se pergunta mais nada só para conhecer melhor a criança.

Primeiro ajude. Depois aprofunde.

---

## Onde isso encosta no que já existe

Anotado para quem for implementar — **não conferido linha a linha**:

- `templateBoasVindasComDesafio` (`lib/ayla/messageTemplates.ts`) já monta a
  abertura com nome, criança e a lista de desafios do onboarding, e já convida
  a mandar áudio. É o ponto de partida natural.
- `carregarDesafiosOnboarding` no orquestrador já manda a lista inteira (não o
  `[0]`, que era o bug antigo).
- A regra de ouro é irmã do que já rege a Rotina (`CRITERIO_SUFICIENCIA_ROTINA`)
  e o Plano: entregar quando dá, perguntar só o que muda o artefato. Vale
  verificar se o núcleo já diz isso para a CONVERSA, ou só para as ferramentas.
- A auditoria da jornada dos 7 dias (`docs/`) registrou que os desafios do
  onboarding eram subaproveitados — esta pendência ataca a mesma lacuna.

**Nada foi implementado nem verificado contra o comportamento atual.**
