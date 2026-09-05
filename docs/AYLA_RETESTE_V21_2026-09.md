# Reteste da v2.1 — a correção do turno-só-pergunta

> ## ⚠️ RETIFICAÇÃO — 05/09/2026
>
> **Este documento afirmou que Claude e GPT eram dois providers conversacionais
> válidos em produção. Está errado, e a correção importa.**
>
> **PROVEI POR EXECUÇÃO:** `lib/ayla/experimental.ts:969` fixa
> `const provider = "openai" as const`. O caminho oficial do WhatsApp — 97,4%
> dos turnos — **nunca** usa Claude e ignora o seletor de provider. Eu li o
> registro `MODELO_CONVERSA` inteiro (que contém os dois) e reportei o lado
> errado.
>
> **Consequência:** onde este documento fala em "Claude × GPT" ou "fallback
> Claude", leia **GPT nas duas colunas**. As diferenças que atribuí a providers
> eram variação entre execuções do mesmo modelo.
>
> **DECISÃO DE PRODUTO (05/09/2026):** GPT é o cérebro conversacional e
> interpretativo da Ayla. Claude não responde família em canal nenhum. O
> endurecimento arquitetural disso é frente própria — ver
> `docs/AYLA_ATIVACAO_V10_2026-09.md`.



**Nada publicado.** `core` v9 e `trial` v5 continuam ativos. Banco, montador,
flags, base da pós, BIA e Base2 intactos.

05/09/2026 · **36 execuções, 0 falhas** · modelo de produção · família sintética
de **uma criança só** · 6 execuções por braço · script:
`scripts/bancada/core-v9-vs-v2/reteste-v21.mjs`

---

## O que mudou da v2 para a v2.1

**Um único ajuste de conteúdo**, em §8. Provado por diff do texto do prompt:
**1 linha removida** (o título) e **23 acrescentadas** — todas no mesmo bloco.
Nenhuma outra regra foi tocada.

O trecho novo, literal:

> ⚠️ **Mesmo quando você precisa perguntar, entregue alguma coisa útil no mesmo
> turno.** Um relato vago não é motivo para devolver só uma pergunta. A ordem é
> **ajude + investigue**, nunca investigue agora para ajudar depois — quem
> escreve "ele grita muito" está no meio do problema hoje, não amanhã.
>
> Diante de um relato vago, na mesma mensagem:
>
> 1. **uma leitura ou direção segura** — o que costuma estar por trás disso, ou
>    o que vale observar;
> 2. **uma ação pequena que já ajuda hoje**, mesmo sem saber a causa;
> 3. **e só então**, se ainda for necessário, **uma** pergunta que realmente mude
>    a orientação.
>
> > "Se ele grita, antes de tentar corrigir o grito vale reparar no que acontece
> > logo antes. Enquanto você observa, fale pouco na hora e ofereça um jeito
> > simples de ele mostrar o que precisa — apontar, ou uma palavra como 'ajuda'.
> > Isso acontece mais quando ele é contrariado, quando precisa esperar ou quando
> > parece sobrecarregado?"
>
> **Um turno que só pergunta deixa a família sem nada.** "Isso acontece em que
> situação?" — e mais nada — não é investigação: é devolver o problema.

Tamanho: v2 26.780 ch → **v2.1 27.883 ch** (+1.103).

## Duas mudanças de método no reteste

1. **Família de uma criança.** A bancada anterior tinha dois filhos, e isso fazia
   toda mensagem sem nome virar ambígua — os dois braços gastavam o turno
   perguntando "é o Theo ou a Cecília?". Sete cenários ficaram inconclusivos por
   um defeito do meu desenho. Aqui a ambiguidade não existe.
2. **Seis execuções por braço**, não três. 3 de 6 é achado; 1 de 6 é ruído.

---

## Critério bloqueador — `vago` + `pouco_ctx`

| Braço | ajudou + perguntou | **só perguntou** |
|---|---|---|
| A — Core v9 | 10/12 = 83% | **2/12 = 17%** |
| **B — v2.1** | **12/12 = 100%** | **0/12 = 0%** |

**A v2.1 zerou o turno-só-pergunta.** E, no mesmo critério, **ficou melhor que a
produção**: o Core v9 falhou 2 de 12.

Detalhe por cenário:

| Cenário | A ok | B ok |
|---|---|---|
| vago | 4/6 (67%) | **6/6 (100%)** |
| pouco_ctx | 6/6 (100%) | **6/6 (100%)** |
| exatamente* | 4/6 (67%) | 4/6 (67%) |

\* `exatamente` não fazia parte do critério bloqueador. Empate: nos dois braços,
2 de 6 respondem só com um menu de temas. É defensável — "me fala exatamente o
que eu faço", sem tema, é genuinamente ambíguo — mas B#4 e B#6 provaram que dá
para ajudar **e** perguntar.

### As falhas do Core v9, literais

> **A · vago #6:** *"Entendo. Para eu te orientar melhor: ele grita mais quando
> está ansioso, frustrado, contrariado ou por causa de barulho?"*

> **A · vago #2:** *"Entendi. Quando o Theo grita, acontece mais em qual
> situação? 1. Quando é contrariado… 5. Outra situação"*

### A v2.1 nas mesmas mensagens

> **B · vago #2:** *"Antes de tentar corrigir o grito, observe o que acontece
> logo antes e fale pouco na hora. Você pode ensinar uma alternativa curta, como
> 'ajuda', 'pausa' ou 'mais', para ele pedir o que precisa. Isso acontece mais
> quando ele é contrariado, precisa esperar ou fica incomodado com barulho?"*

> **B · vago #5:** *"Quando ele gritar, fale pouco e ofereça uma forma simples de
> pedir: 'pausa', 'ajuda' ou 'quero sair'. Observe o que acontece logo antes —
> espera, mudança, barulho ou algo difícil — porque isso ajuda a escolher o apoio
> certo. Acontece mais em qual situação?"*

As seis seguem a mesma forma: **ação agora → o que observar → uma pergunta.**

---

## O ganho da v2 sobreviveu?

| | A (v9) | B (v2.1) | Δ |
|---|---|---|---|
| Mediana geral | 422 ch | **288 ch** | **−32%** |
| vago | 238 | 255 | +7% |
| pouco_ctx | 568 | 392 | −31% |
| exatamente | 580 | 271 | −53% |
| Perguntas por resposta | 1,39 | **1,06** | −24% |
| Markdown não convertível | 0 | **0** | — |
| `**` cru | 0 | **0** | — |

**Sim, e melhorou.** O encurtamento passou de −28% (v2, bancada de 05/09) para
**−32%**. A v2.1 não voltou a parecer o Core v9 longo — ficou mais curta que a v2
em proporção, e continua fazendo menos perguntas.

O único cenário em que B ficou maior que A é `vago` (+7%, 255 × 238 ch) — e é
exatamente onde a v2.1 passou a entregar ajuda que antes não existia. **Dezessete
caracteres a mais em troca de sair do zero.**

### Explicou demais?

Não. As respostas de `vago` na v2.1 têm 233 a 290 caracteres — duas a três frases
cada, no formato que o documento pede. Nenhuma virou aula. `pouco_ctx` caiu de
568 para 392.

---

## Conclusão

# CORRIGIDO

O bloqueio some: **0 de 12** no critério definido, contra 3 de 6 medidos na v2.
Sem nova regressão — o encurtamento aumentou, as perguntas diminuíram, o markdown
continua limpo e nenhuma resposta ficou prolixa.

**E há um achado a mais:** o Core v9 em produção falha o mesmo critério em **17%**
dos turnos de relato vago. A regra que escrevi para consertar a v2 conserta algo
que a produção também tem.

## O que este reteste não prova

- **Três cenários, um modelo, um avaliador.** A classificação de "só perguntou"
  é minha, feita lendo cada uma das 36 respostas.
- **Não mediu os outros 22 cenários.** O ajuste é local a §8, mas só o reteste
  completo provaria que não mexeu em nada mais. As métricas contadas (tamanho,
  perguntas, markdown) não sugerem efeito colateral.
- **O simulador não é uma família.** Sem histórico real, sem perfil construído ao
  longo de semanas, sem jornada de teste.
- **Não sei como a v2.1 se comporta no Claude**, que é o provider de fallback.
