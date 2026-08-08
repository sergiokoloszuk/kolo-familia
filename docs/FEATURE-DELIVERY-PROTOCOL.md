# Protocolo de Entrega de Funcionalidade — Kolo Família

Regras obrigatórias para qualquer agente de IA (ou pessoa) que **crie ou altere
algo que uma família percebe** neste repositório.

Este documento não substitui
[AI-ENGINEERING-PROTOCOL.md](AI-ENGINEERING-PROTOCOL.md); ele acrescenta.

| Documento | Governa |
|---|---|
| [AI-ENGINEERING-PROTOCOL.md](AI-ENGINEERING-PROTOCOL.md) | **COMO** trabalhar com segurança — vale para toda alteração |
| **Este documento** | **O QUE** precisa ser provado para uma funcionalidade ser considerada pronta |
| [specs/](specs/) | **COMO** cada funcionalidade específica deve se comportar |
| [PENDENCIAS.md](PENDENCIAS.md) | o que ficou aberto, com ID estável |

**Regra de precedência:** onde os dois protocolos falarem do mesmo assunto,
vale o de engenharia — aqui só há ponteiro. Em conflito, vale o mais
restritivo.

---

## Princípio central

O protocolo de engenharia nasce da descrição de um **problema**. Este nasce de
um risco diferente: o pedido é atendido à risca, o código faz exatamente o que
foi descrito, e ainda assim a funcionalidade não existe para a família.

> **Pergunta central: "Esta funcionalidade pode estar inteiramente
> implementada e mesmo assim não existir para a família?"**

Há três jeitos de não existir, e os três já aconteceram aqui:

- **ninguém descobre** — só dispara com a palavra mágica;
- **não sobrevive ao dia seguinte** — foi gerada, não é reencontrável, e a
  própria Ayla não sabe que existe;
- **existe só no caminho feliz** — um canal, uma criança, um estado.

---

## Quando este protocolo se aplica

> Aplica-se quando a mudança **cria ou altera algo que uma família percebe**.

Correção de defeito, refatoração, ajuste de infraestrutura, mudança de texto
isolada e trabalho de investigação seguem **somente** o protocolo de
engenharia. Uma alteração de uma linha não vira oito portões.

Na dúvida, a pergunta é: *alguém de fora do repositório notaria a diferença?*
Se sim, este protocolo vale.

---

## Níveis de risco

| Nível | O que é | Portões obrigatórios | Artefato |
|---|---|---|---|
| **PEQUENA** | melhoria dentro de funcionalidade que já existe e já passou pelos portões | P1 (três linhas) · P7 (só o que ela toca) · P8 | nenhum — o relatório é o corpo do PR |
| **MÉDIA** | funcionalidade nova em um canal só, sem dinheiro e sem artefato persistente | P1 · P2 · P3 · P4 · P6 · P7 · P8 | SPEC curta |
| **CRÍTICA** | os oito portões, e nenhum fecha por omissão | todos | SPEC completa + corpus + relatório de uma página |

### Escalada automática para CRÍTICA

Sobe de nível automaticamente quando tocar **qualquer** um destes:

- pagamento ou acesso;
- dado sensível ou comportamental de criança;
- IA decidindo sozinha o que dizer a uma família;
- mensagem proativa (WhatsApp, e-mail);
- mais de uma criança;
- artefato que persiste (rotina, plano, relatório, PDF);
- canal novo;
- exclusão de dado.

### Proibição de rebaixamento silencioso

O nível se declara **no início** e vai para o relatório. Rebaixar exige dizer
**por escrito** qual gatilho de escalada não se aplica e por quê. Nível
rebaixado sem justificativa registrada invalida o veredito.

---

## Os oito portões

Cada portão termina em **PASS · FAIL · BLOQUEADO · NÃO SE APLICA**.
`NÃO SE APLICA` exige motivo escrito. Portão não comprovado é **BLOQUEADO** —
nunca some da tabela, nunca vira PASS por omissão.

### P1 · Problema e dono

Que problema da família isto resolve. Quem é o usuário real — **mãe, criança e
admin não são a mesma pessoa**, e uma funcionalidade costuma ter os três em
papéis diferentes (quem pede, quem usa, quem imprime). O que muda no dia dela.
O que acontece se não construirmos.

> **Pergunta obrigatória: "Se isto sair perfeito, qual frase a mãe deixa de
> dizer?"**

### P2 · Descoberta — *funciona para quem NÃO sabe que existe?*

Gatilho explícito. Detecção implícita. Linguagem natural, sinônimo, relato
indireto. Contexto suficiente **sem** palavra-chave. Onde aparece na interface
para quem nunca ouviu falar. E o que acontece quando dispara **errado**.

Prova exigida: **corpus de disparo** (ver [specs/](specs/)) rodando como teste,
com verdadeiro positivo **e** falso positivo medidos. Medir só o acerto é
metade do trabalho — vale o caso **I** da matriz do §12 do protocolo de
engenharia: *quase toda correção que suprime algo suprime demais*.

> A detecção não pode depender de palavra mágica. Já houve aqui conversa de
> dias terminando sem entrega porque a mãe precisava dizer a palavra "plano".
> Funcionalidade que exige a palavra certa não foi entregue: foi escondida.

### P3 · Conversa mínima e dados

O que já se sabe (perfil, conversa, artefatos anteriores) e **não** pode ser
perguntado de novo. O mínimo que falta. Agrupamento de perguntas. O que a IA
decide sozinha e onde a humana confirma.

Em qualquer coisa que envolva a Ayla, separar as camadas do **§15** do
protocolo de engenharia: informação que existe ≠ recuperada ≠ injetada ≠
efetivamente entregue ao modelo ≠ usada na resposta.

> **Pergunta obrigatória: "Quantas perguntas a mãe responde antes de receber
> algo de valor?"**

### P4 · Jornada e canais

Entrada, meio, saída. Divisão entre Web, WhatsApp e Admin, e o **handoff**
entre eles. Abandono no meio. Retomada depois. E o estado **"entregue mas não
visto"**, que existe em quase toda funcionalidade da Kolo e quase nunca tem
nome.

Os estados intermediários do domínio são governados pelo **§9** do protocolo de
engenharia; aqui o acréscimo é o estado de *produto*: rascunho, abandonado,
gerado-sem-entrega, entregue-sem-visto.

> **Pergunta obrigatória: "Onde exatamente ela larga isso pela metade, e o que
> encontra quando volta?"**

### P5 · Identidade, alvo e permissão

Para qual criança. Família com mais de uma. Membro ambíguo. O alvo sobrevive
ao link, ao cookie e à troca de canal. Permissões.

Isolamento entre famílias e entre irmãos é **§16** do protocolo de engenharia —
aqui não se repete a regra, se prova que ela foi exercida com uma família de
duas crianças.

> **Pergunta obrigatória: "Isto pode chegar com o nome da criança errada?"**

### P6 · Continuidade — *o que acontece amanhã?*

Onde ficou salvo. Como a mãe reencontra. Como **a Ayla** sabe que existe e
referencia. Reabertura. Edição. Duplicata evitada — pedir de novo não pode
criar um segundo artefato. Exclusão. Impressão e compartilhamento. O que entra,
e o que **não** entra, na memória.

> **Pergunta obrigatória: "Amanhã, sem procurar, ela reencontra isto — e a Ayla
> lembra que existe?"**

### P7 · Quando dá errado e como sabemos

Falha, fallback, erro de interface, estado vazio, carregando. Idempotência e
concorrência: **§7 e §8**. Observabilidade: **§11**.

O acréscimo deste portão é a **métrica de adoção** — quantas foram oferecidas,
aceitas, concluídas, reusadas — com a **definição visível na tela** de cada
indicador. Mais custo por uso e performance percebida.

> **Pergunta obrigatória: "Se isto parar de funcionar amanhã, a gente descobre
> — e descobre que parou de ser *usado*, não só que quebrou?"**
>
> A régua vem de um caso real: a taxa de cartões da rotina caiu de 100% para
> 32% por causa de uma correção de prompt, e a queda só apareceu semanas
> depois, porque ninguém estava medindo. O que não é medido regride em
> silêncio.

### P8 · Prova e entrega

Regressão: **§12**. Rollback: **§17**. Estados de publicação: **§18**.

O acréscimo: smoke no **canal real** (respeitando as regras invioláveis de QA
do §13 — nada de disparar WhatsApp para família real, dado de teste é apagado
no fim), mobile, acessibilidade, caminho de feedback da mãe, e o **`/ajuda`
atualizado**: mudança de produto atualiza o mapa do suporte junto. Isso faz
parte do "pronto", não é tarefa posterior.

---

## Definição de feito

| Estado | Significa | Corresponde no §18 |
|---|---|---|
| **DESENHADA** | SPEC escrita, portões P1–P6 respondidos (não provados) | — |
| **APROVADA** | uma pessoa aprovou o desenho | — |
| **IMPLEMENTADA** | o código existe e passa nos testes locais | implementado · commitado |
| **TESTADA** | regressão **e** descoberta executadas, com números reais | — |
| **PUBLICADA** | está no branch que a Vercel serve, com env/cron/segredo aplicados | publicado · configuração aplicada |
| **VALIDADA EM PRODUÇÃO** | alguém exerceu o caminho real e há evidência | smoke · produção validada |
| **PRONTA** | validada **e** P2 e P6 comprovados **e** `/ajuda` atualizado | — |

> **IMPLEMENTADA ≠ PRONTA.** Já houve aqui funcionalidade inteira construída,
> testada e fiada nos dois canais — atrás de uma flag desligada, num branch
> fora da `main`. Estava implementada. Não existia.

O **veredito final** da funcionalidade usa o vocabulário do §20 do protocolo de
engenharia, e somente ele: **PASSOU · PASSOU COM RESSALVAS · FALHOU ·
BLOQUEADO**. Os portões usam PASS/FAIL/BLOQUEADO/NÃO SE APLICA. São duas
escalas, uma por camada — não são sinônimos.

---

## Relatório de uma página

Obrigatório em nível CRÍTICA. Português comum, sem jargão, uma linha de
evidência por resposta. Os detalhes técnicos vêm abaixo, no formato do §20.

| # | Pergunta | Resultado | Como sabemos |
|---|---|---|---|
| 1 | A mãe descobre isto sozinha? | | |
| 2 | Funciona se ela não usar a palavra certa? | | |
| 3 | Quantas perguntas antes de receber algo? | | |
| 4 | Funciona nos canais que prometemos? | | |
| 5 | Se ela parar no meio, consegue voltar? | | |
| 6 | Vai para a criança certa? | | |
| 7 | Amanhã ela reencontra? | | |
| 8 | A Ayla lembra que isto existe? | | |
| 9 | Se quebrar, a gente descobre antes da mãe? | | |
| 10 | Sabemos se está sendo usada? | | |
| 11 | Está no ar de verdade? | | |
| 12 | Dá para desfazer? | | |
| 13 | O `/ajuda` foi atualizado? | | |

**Veredito:** _(uma das quatro palavras do §20)_

---

## Pendências

Portão que fechar em **FAIL** ou **BLOQUEADO** vira pendência registrada em
[PENDENCIAS.md](PENDENCIAS.md), com ID, **antes** de a funcionalidade ser
declarada PRONTA. A SPEC referencia a pendência por ID — nunca repete o texto.

Achado relevante **fora do escopo** da missão não se corrige em silêncio e não
amplia a missão: registra-se como pendência e informa-se no relatório.

---

## O que este documento NÃO faz

- Não repete regra técnica já governada pelo protocolo de engenharia — se você
  sentir vontade de copiar um parágrafo de lá para cá, o assunto não pertence
  a este documento.
- Não se aplica a correção de defeito, refatoração ou investigação.
- Não substitui julgamento: portão é o piso, não o teto.
