# Experiência de Rotina — auditoria antes de implementar

03/08/2026. A especificação funcional está aprovada. Isto compara a experiência
pedida com a arquitetura unificada que já existe (`5e1031f` + branch
`feat/rotina-unificada`) e propõe a menor adaptação.

**Nada foi implementado.**

## A. O que a arquitetura já suporta

| Passo da spec | Onde já vive | Estado |
|---|---|---|
| 1 — identidade | `membro-alvo.ts` → `alvoDaRotina` + `perguntarQualCrianca` | ✅ pronto, sem fallback silencioso |
| 2 — ensinar como informar | `CONTRATO_ROTINA`, "A FAMÍLIA NÃO SABE O QUE PEDIR" | ✅ inclusive "pode mandar áudio, que eu organizo" |
| 3 — organização sem questionário | `CRITERIO_SUFICIENCIA_ROTINA` (mínimo = escopo + sequência) | ✅ |
| horário opcional | `validacao-rotina.ts` + `hora: string \| null` | ✅ política única nos 2 canais |
| áudio | transcrição a montante, chega como texto | ✅ nada a fazer |
| 4 — memória primeiro | `carregarTransicoes` → `transicoesConhecidas` entra no contexto e no `pontoDificil` | ✅ |
| 5 — ponto difícil não bloqueia | está escrito no critério: "ENRIQUECE muito, mas NÃO é requisito" | ✅ |
| 11 — aprendizado | `transicoes[].funcionou` + `merece_plano` gravam no Kolo Vivo | ⚠️ estrutura sim, pergunta não (ver C) |
| guarda de publicação | `validarRotina` antes de gravar/PDF/link | ✅ |

Cerca de **70% da spec já está de pé.** O que falta não é infraestrutura.

## B. Existe, mas está no lugar errado

**B1. A escolha do tamanho da intervenção não existe como decisão — existe como
efeito colateral da prontidão.** Hoje `avaliarProntidaoParaRotina` devolve
`nao_e_rotina` para o Caso 2 ("dá briga pra sair do videogame") e o orquestrador
cai na conversa comum. O resultado pode até ser bom, mas **ninguém decidiu** que
a resposta certa ali era orientação em vez de artefato. Foi o porteiro dizendo
"não é comigo".

**B2. `transicoes` é o Caso 2 inteiro, preso dentro da ferramenta de rotina.**
O schema já tem `{momento, estrategia, funcionou, merece_plano}` — é exatamente
a orientação de transição da spec. Só que só é coletado **quando a conversa já
é de rotina**. Quem chega dizendo "todo dia dá briga no banho" sem pedir rotina
não passa por lá.

**B3. O ponto difícil vira PDF, não vira orientação.** `pontoDificil` +
`fraseDeApoio` alimentam o bloco "UMA AJUDA NESTA TRANSIÇÃO" do PDF. Não existe
antes/durante/depois em lugar nenhum do código — nem como estrutura, nem como
instrução. O que sai é o que o modelo improvisar.

**B4. A separação adulto × criança já existe de fato, sem nome.** As `tarefas`
são da criança; o bloco de apoio do PDF é do adulto. A spec formaliza uma
distinção que o código já respeita — barato de manter, e vale um teste que a
proteja.

## C. Comportamentos que precisam mudar

**C1. "A menor ajuda suficiente" não está escrito em lugar nenhum.** O contrato
diz o oposto por omissão: *"AYLA SEMPRE ENTREGA — se já dá pra montar, MONTE"*.
Esse texto nasceu pra matar o interrogatório e continua certo para o Caso 1.
Para o Caso 4 ele empurra na direção errada.

Não é contradição real: "sempre entrega" quer dizer *nunca deixa a mãe sem nada*,
não *sempre gera artefato*. Mas está escrito de um jeito que só admite a segunda
leitura.

**C2. Cards e PDF são automáticos, não decididos.**

- PDF: `if (params.phoneE164)` — ou seja, **sempre**, no WhatsApp.
- Cards: `if (!temSemana && tema && ids.length)` — dispara sozinho **porque existe
  tema**, nunca porque ver a sequência ajudaria.

A spec inverte a condição: o gatilho do visual é *a criança precisa enxergar*, e
o tema é decoração que entra depois. Hoje o tema é o gatilho.

**C3. A pergunta de aprendizado é "gostou?".** Literal, em
`orchestrator.ts:500`: *"Conseguiu ver os cartões? Me conta o que você achou"*.
A spec pede "onde funcionou / onde ainda travou" — e o campo `funcionou` já
existe esperando essa resposta.

**C4. A unidade não é um período.** O gerador aceita semana inteira
(`dia_semana: 0..6`), e o link tem ramo `temSemana → /ludico/rotinas/semana`.
Não é bug — é a semana construída de uma vez, em vez de nascer de dias já
organizados.

**C5. Não existe mini sequência.** Nenhuma ocorrência no código. Hoje só há dois
tamanhos: conversa, ou rotina completa com PDF e cards.

## D. Dados que já temos

Nada de schema novo é necessário para os 4 casos.

- `membros_atipicos.categorias_extras.transicoes[]` — momento, estratégia,
  funcionou, merece_plano. **É a memória do Caso 2.**
- `corpo_rotina`, `desafios_regulacao`, `sensorial`, `essencial`, `como_e` — já
  carregados em `jaSabemos.perfil`.
- Rotinas existentes + tarefas — `jaSabemos.rotinaExistente`.
- Interesses — já no perfil, com a política de veículo de `INTERESSE_COMO_VEICULO`.
- Tema — campo no schema da proposta.

**O que não existe:** um registro de que apoio visual ajuda *esta* criança. A spec
cita isso ("se a memória já mostra que apoio visual funciona"). Cabe em
`transicoes[].estrategia` como texto, sem coluna nova.

## E. Onde a decisão "orientação × mini visual × rotina" deveria viver

**Em `prontidao-rotina.ts`, ampliando o desfecho — não num módulo novo.**

O porteiro já roda antes de tudo, já recebe mensagem + conversa + contexto +
idade, já é uma chamada barata, e já é onde mora `CRITERIO_SUFICIENCIA_ROTINA` em
português para a Karina editar. Ele já responde *"isto é caso de rotina?"*. A
spec só pede que a resposta tenha mais resolução:

```
"suficiente"      → hoje: gera rotina
                  → vira: gera no TAMANHO decidido
```

Concretamente, um campo a mais no JSON que ele já devolve:

```
tamanho: "orientacao" | "mini" | "rotina"
```

E `LIMITE_DE_ATUACAO_ROTINA` ganha um irmão em português —
`CRITERIO_TAMANHO_ROTINA` — com os gatilhos do Passo 7: transição recorrente,
necessidade de previsibilidade, a família relata que visual ajuda, compreensão
verbal não basta, a criança precisa consultar agora/depois.

**Por que não em `rotina-servico.ts`:** o serviço decide *como gerar*, não *o que
a família precisa*. Ele é chamado depois de a conversa já ter concluído que é
rotina.

**Por que não no orquestrador:** virava roteamento, e roteamento por regex foi o
que produziu 13 de 20 execuções erradas em `2c96f69`.

## F. Como evitar outro roteador paralelo

Esta é a maior armadilha da frente, e a que mais custou neste ciclo. Três regras
que saem direto dos incidentes:

1. **Um porteiro, um serviço, uma validação.** `orientacao` e `mini` entram como
   desfechos do porteiro que já existe. Nada de `prontidao-orientacao.ts`.
2. **`mini` é a mesma rotina com menos etapas** — mesmo `RotinaProposta`, mesmo
   `interpretarRotina`, mesmo `validarRotina`. Muda a INSTRUÇÃO ("2 a 4 etapas,
   só a passagem"), não o tipo. Um segundo gerador seria repetir exatamente o
   erro que `rotina-servico.ts` foi criado para matar.
3. **`orientacao` não é ferramenta — é conversa com forma.** Antes/durante/depois
   pertence à camada de formas (`formas.ts`), onde o repertório de entrega já
   vive, e não a um módulo de rotina. O repertório já tem *"O que eu faria
   primeiro"*, *"O que você pode dizer"*, *"Uma pequena mudança na rotina"*.
   Falta uma forma de transição.

## G. A menor alteração possível

Sete mudanças, nenhuma estrutural:

| # | Onde | O quê |
|---|---|---|
| 1 | `prontidao-rotina.ts` | campo `tamanho` no JSON + `CRITERIO_TAMANHO_ROTINA` em português |
| 2 | `formas.ts` | uma forma de transição (antes / durante / depois) no repertório |
| 3 | `rotina-servico.ts` | `tamanho` chega ao gerador; `mini` = 2–4 etapas, só a passagem |
| 4 | `rotina-guiada.ts` | PDF deixa de ser automático: sai quando imprimir acrescenta |
| 5 | `rotina-guiada.ts` | cards deixam de disparar por existir tema; disparam por o visual ajudar |
| 6 | `orchestrator.ts:500` | a recuperação pergunta "onde funcionou / onde travou" |
| 7 | `CONTRATO_ROTINA` | "AYLA SEMPRE ENTREGA" ganha a segunda metade: entregar é resolver, não é gerar artefato |

Fora de escopo, por decisão: **construir a semana a partir de dias**. É a única
parte da spec que muda estrutura de dados e navegação. A semana atual continua
funcionando; a spec só diz para não *começar* por ela.

## H. Riscos

**H1 — desfazer o "AYLA SEMPRE ENTREGA" e voltar ao interrogatório.** É o risco
grave. Uma Ayla autorizada a "não gerar" pode virar uma Ayla que nunca gera, e o
interrogatório custou uma frente inteira para ser morto. Mitigação: o Caso 1
continua gerando direto, e a bancada de jornadas (5/5) é o alarme.

**H2 — a mãe pediu rotina e recebeu conselho.** Se `tamanho` errar para baixo num
pedido explícito, repete o incidente de 03/08 ao contrário. Mitigação: pedido
explícito de organizar um período nunca desce abaixo de `rotina`.

**H3 — tráfego pago.** Rotina é P0 comercial: há anúncio ativo dizendo que a Kolo
gera rotinas. Menos PDF é menos prova de entrega. **Isto é decisão do Sérgio, não
minha** — a spec pede PDF só quando imprimir tem utilidade, e a campanha promete
o artefato.

**H4 — instabilidade de julgamento.** Ver
`docs/bancada-experiencia-limitacoes-2026-08-03.md`. `tamanho` é uma decisão de
modelo a mais por turno; não dá pra validar com uma execução por caso.

**H5 — custo.** Sem chamada nova: `tamanho` viaja no JSON que a prontidão já
devolve.

## I. Testes necessários

**Determinísticos (suíte):**
1. `tamanho` ausente ou inválido → cai em `rotina` (nunca some, nunca vira `orientacao` por acidente).
2. Falha da prontidão → segue no comportamento inócuo de hoje.
3. `mini` usa `interpretarRotina` e `validarRotina` — os mesmos (guarda anti-segundo-gerador).
4. Pedido explícito de período nunca resolve abaixo de `rotina` (H2).
5. Cards não disparam só porque há tema (C2).
6. PDF não é incondicional no WhatsApp (C2).
7. A recuperação pergunta onde funcionou / onde travou (C3).
8. Card mantém a atividade legível com tema aplicado (Passo 8).
9. Contrato: tarefas não carregam estratégia do adulto (Passo 9, B4).
10. `orientacao` não grava rotina, não gera PDF, não manda link.

**Bancada (`jornadas-rotina.mjs`), os 4 casos obrigatórios:**
- Caso 1 → gera, uma transição, rápido — **e as 5 jornadas atuais continuam 5/5**.
- Caso 2 → antes/durante/depois, sem rotina completa.
- Caso 3 → mini sequência 2–4 cards.
- Caso 4 → nada é gerado.

O Caso 4 é o teste mais importante da frente inteira: é o único que prova que a
Ayla sabe **não** usar a ferramenta que tem à mão.

---

**Aguarda aprovação. Nada implementado.**
