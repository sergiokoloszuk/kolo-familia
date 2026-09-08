# Auditoria — V2 × código atual

**08/09/2026.** Código auditado: branch `feat/rotina-visual-v2`, a partir de
`f3994e6` (que já contém `94e2e6d`, a correção de metadata).

**Não confiei em nome de função.** Onde diz EXISTE, há linha citada ou medição
executada. Onde não consegui provar, diz **A CONFERIR** — e isso não conta como
aprovado.

⚠️ A tabela ATUAL da spec de 08/08 **não foi reaproveitada**: um mês de código
passou por cima dela. Tudo aqui foi levantado do zero.

---

## Matriz

| § V2 | Requisito | Estado | Evidência | Mudança necessária |
|---|---|---|---|---|
| **1** | Um único mecanismo; sem segundo sistema | **existe** | `conduzirRotina` é o único caminho; `rotina-servico.ts` é o único gerador | — |
| **1** | Nomes intercambiáveis na conversa (Rotina / Sequência / Cartões) | **a conferir** | `pedeRotina`, `pediuRotinaExplicitamente`, `pediuApoioVisual` (rotina-guiada.ts:54,84,123) cobrem variantes; não medi "cartões visuais" | medir as três formas contra os detectores |
| **2** | Ayla decide início, etapas, fechamento, quantidade | **existe** | `conduzirRotina` + `avaliarProntidaoParaRotina` (tamanho `orientacao`/`mini`/`rotina`) | — |
| **2** | Não acrescentar histórico como fato de hoje | **existe** | `transicaoPertenceAoPedido` + filtro em `pontoDificilDoTurno` (`cfd500b`) | — |
| **3** | Perguntar só o que muda o artefato | **existe** | contrato do condutor: *"NUNCA PERGUNTE O QUE VOCÊ JÁ TEM"*, uma pergunta por vez | — |
| **4A** | Organização/previsibilidade sem investigação | **existe** | `prontidao-rotina.ts:51` — *"ou um ACONTECIMENTO, mesmo que aconteça UMA VEZ SÓ… NÃO exija que se repita"*. D-R4 **foi implementada** | — |
| **4B** | Achar o momento crítico; 1 pergunta de alto valor | **existe** | `prontidao-rotina.ts:172` distingue `falta_escopo` de situação concreta | — |
| **5** | Momento crítico define onde a sequência começa | **parcial** | `pontoDificil` chega ao gerador; **não medi** se ele move o INÍCIO da sequência | bancada: banho cujo ponto crítico é largar a brincadeira |
| **6** | **Máximo 10 cartões** | **ausente** | varredura em `rotina-ia-core.ts`, `rotina-servico.ts`, `validacao-rotina.ts`: **nenhum teto** | impor teto de 10 na composição, com agrupamento |
| **7** | Família deu ≤10 → não pedir seleção por números | **existe** | nenhum ponto do código pede seleção numérica | — |
| **7** | Não reconfirmar o que a família ditou | **existe** | `rotina-guiada.ts:1642` — *"SE A FAMÍLIA JÁ DITOU A SEQUÊNCIA, ELA VAI INTEIRA"* | — |
| **8** | Confirmar quando a Ayla inferiu/alterou | **parcial** | `r.proposta` + tipo `rotina_proposta` + `propostaPendente` existem, mas **só funcionaram a partir de `94e2e6d`** — antes a metadata era apagada (0 de 4.498 mensagens tinham `proposta`) | provar em bancada que a proposta sobrevive e é retomada |
| **9** | Consideração curta junto, sem virar cartão | **existe** | tamanho `orientacao` em `prontidao-rotina.ts` | — |
| **10** | Duas sugestões de tema | **parcial** | `sugestoesDeTema` = 2 interesses (`rotina-guiada.ts:1311`), mas **não numeradas** e sem opção "outro" explícita | numerar 1/2 e oferecer "outro" e "sem tema" |
| **10** | "sem tema" aceito | **existe** | `recusouTema` (`rotina-guiada.ts:860`) | — |
| **10** | Interesse histórico ≠ preferência atual | **a conferir** | interesses vêm de `perfil_vivo_membro` sem carimbo de data | marcar histórico como histórico ao oferecer |
| **11** | Sequência + consideração + tema na mesma mensagem | **a conferir** | não medi a composição da mensagem | bancada: contar turnos até a geração |
| **12** | Resposta curta pertence à ação pendente | **existe** | `rotinaConversaPendente` reescrito em `cfd500b` — a fala da Ayla encerra, não a resposta da família | — |
| **12** | `1` / `o primeiro` selecionam a opção de tema | **ausente** | medido: `lerTemaEscolhido("1")` → `null`; `("o primeiro")` → `null` | mapear índice → sugestão quando há tema pendente |
| **12** | Não disparar Plano durante rotina pendente | **existe** | porta da rotina retorna `tratada: true` antes de `ponteDePlano` (índice 130547 < 140103) | — |
| **13** | **"pode gerar" é comando de execução** | **contradiz** | **medido:** `lerTemaEscolhido("pode gerar")` → `"pode gerar"`. Idem `gera`, `ok pode gerar`, `quero os cartoes`, `faz para mim`. O comando **vira o tema visual dos cartões** | reconhecer comandos de execução ANTES do extrator de tema |
| **14** | Geração real antes de dizer que gerou | **existe** | `dispararGeracao` devolve se o endpoint aceitou; a fala muda conforme (`rotina-guiada.ts:1298`) | — |
| **14** | Estados aguardando/gerando/pronto/erro | **existe** | `cards_status` com os 5 valores; `/api/ludico/gerar-rotina` grava `gerando` antes de responder e é idempotente | — |
| **15** | Link, não PDF; "pronto" só se pronto | **existe** | `falaCoerenteComEstado` + `podeAfirmarConclusao` (`rotina-fala-coerente.ts`) | — |
| **16** | Etapa concluída visualmente distinta | **parcial** | `rotina-editor.tsx:865` — `opacity-60` + borda. **Não é preto e branco** | aplicar `grayscale` na imagem concluída |
| **16** | Próxima etapa evidente | **ausente** | nenhuma marcação de "próxima" no editor | destacar a primeira não concluída |
| **16** | Impressão em todos os modos | **existe** | botão Imprimir fora do bloco condicional; "COMO USAR" nos dois modos (`:363`) | — |
| **17** | Mudança de plano | **ausente** | nenhuma ocorrência | fora do mínimo — registrar como pendência |
| **18** | Histórico ≠ acontecimento do dia | **existe** | `cfd500b` + regressão do barco em `rotina-continuidade.test.ts` | — |
| **19** | Feedback na página | **ausente** | `rotina-feedback.ts` classifica fala do WhatsApp; a página não coleta | fora do mínimo — D-R5 já desbloqueou |
| **Téc. 4** | Metadata funcional + entrega coexistem | **existe** | `94e2e6d` — `registroDeEnvio` é dono único da composição; 15 testes | — |
| **Téc. 11** | Dono único da rajada | **existe** | `aguardarTurnoDaMae`, claim atômico sobre `processada_em`; premissa de concorrência refutada em PEND-170 | — |
| **Téc. 14** | Imagens assinadas quando bucket privado | **existe** | `assinarImagens`/`pathDeImagem`; provado no Nível 2 (4 assinadas, 0 públicas) | — |

---

## Leitura

**A V2 está muito mais perto do código do que parecia.** Das 30 linhas, 17 já
existem com evidência, e várias das que faltavam foram fechadas nesta semana
(`cfd500b`, `94e2e6d`). D-R4 (evento único) já tinha sido implementada — a spec
antiga dizia que não, e estava desatualizada.

**Três coisas quebram o fluxo hoje, e uma delas é grave.**

### O achado que muda o dia da família

`lerTemaEscolhido("pode gerar")` devolve **`"pode gerar"`**. Com uma rotina
esperando tema, a mãe que escreve "pode gerar" não dispara a geração: ela **nomeia
o tema visual dos cartões**. A arte sai no tema "pode gerar".

É a mesma classe do caso de 17/08 (*"Vamos tomar sorvete depois"* virou tema), que
`lerTemaEscolhido` foi endurecido para conter — mas o endurecimento cobriu
aceites, negações e ordem, e **não cobriu comandos de execução**. Medido em cinco
formas: `pode gerar`, `gera`, `ok pode gerar`, `quero os cartoes`, `faz para mim`.

É exatamente o §13 da V2, e explica a forma do caso Atibaia.

### As outras duas

- **Sem teto de 10 cartões** em lugar nenhum do código. Uma família que traz 15
  acontecimentos recebe 15 cartões.
- **`1` e `o primeiro` não selecionam tema.** A V2 §12 os lista como respostas
  válidas; hoje devolvem `null` e a conversa fica presa pedindo o tema de novo.

### O que NÃO é gap, apesar de parecer

A confirmação seletiva (V2 §7/§8) **já é o comportamento**: o condutor não
reconfirma o que a família ditou, e emite `rotina_proposta` quando infere. O que
faltava não era a regra — era a **metadata**, que era apagada no envio e só passou
a sobreviver com `94e2e6d`. Sem aquela correção, a proposta existia no código e
nunca no banco (0 de 4.498 mensagens).

---

## Menor implementação capaz de tornar o fluxo aderente

Três mudanças, todas dentro de `rotina-guiada.ts`, nenhuma tocando o gerador, o
editor, a persistência ou o Prompt Mestre.

### 1 · Comando de execução vence o extrator de tema

**Onde:** `lerTemaEscolhido` + o bloco `pendente` de `conduzirRotina`.

Uma função pura `ehComandoDeExecucao(texto)` reconhece `pode gerar`, `gera`,
`gerar`, `quero os cartões`, `faz`, `pode fazer`, `manda`, `bora` e equivalentes.
No bloco de tema pendente, ela é consultada **antes** de `lerTemaEscolhido`:

- comando **com** tema já conhecido (`temaJaDitoNoHistorico` ou aceite de
  sugestão) → dispara a geração;
- comando **sem** tema → a Ayla repete as duas sugestões em uma linha, sem
  reabrir a investigação;
- e `lerTemaEscolhido` passa a recusar comando de execução, como já recusa aceite
  e negação.

**Risco:** suprimir demais. O caso I do §12 entra na bancada — `"dinossauros"`,
`"natureza"`, `"contos e princesas"` continuam sendo tema.

### 2 · Seleção numérica da sugestão

**Onde:** o mesmo bloco.

Quando há tema pendente e a última fala da Ayla ofereceu sugestões, `1`, `2`,
`o primeiro`, `o segundo` mapeiam para `sugestoesDeTema[n]`. Reusa a mesma trava
de `ofertaDeTemaNaUltimaFala` que já existe desde `cfd500b` — **só vale se a
oferta estiver escrita na fala anterior**.

Junto: numerar as sugestões na mensagem e acrescentar "ou me diga outro tema; se
preferir, faço sem tema".

### 3 · Teto de 10 cartões

**Onde:** a composição das etapas, antes de persistir.

Acima de 10, a Ayla agrupa e diz o que agrupou — não corta em silêncio. O
comentário de `rotina-guiada.ts:1642` (*"cinco etapas ditadas viram cinco etapas
no quadro"*) **permanece válido até 10**; o teto é para o que passa disso, e a
genealogia dele fica preservada.

### Fora do mínimo, e por quê

`grayscale` na etapa concluída, destaque da próxima, feedback na página e
"mudança de plano" são do **app**, não da condução. Não travam o fluxo
conversacional e merecem frente própria — viram pendências, não este commit.

---

## Dependências e ordem

1. `94e2e6d` (metadata) — **já no branch**, com 15 testes e genealogia preservada;
2. as três mudanças acima;
3. bancada conversacional com as 6 regressões obrigatórias (§16 da spec técnica),
   medindo **turnos até a geração**;
4. suíte completa + `tsc` + build;
5. QA ponta a ponta — **bloqueado** pela conta de QA no WhatsApp.

---

## O que esta auditoria não prova

- **§11 (tudo na mesma mensagem)** e **§5 (o crítico move o início)** precisam de
  bancada conversacional; leitura de código não decide.
- **Interesse histórico × atual** (§10) não tem carimbo de data no perfil hoje.
- Nada aqui foi exercitado contra família real. O gate de QA continua o mesmo.
