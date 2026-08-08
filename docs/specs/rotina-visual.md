# SPEC — Rotina / Sequência Visual

**Estado:** DESEJADO consolidado · ATUAL auditado · **decisões D-R1 a D-R5
tomadas em 2026-08-08** · **não implementado**.
Fonte: decisões de produto do Sérgio (2026-08-08) + auditoria do código de
2026-08-08. Pendência: **PEND-004**.

> A família **não precisa conhecer o nome da funcionalidade**. A pergunta que
> decide tudo: *este problema pode melhorar se a criança conseguir visualizar o
> que vai acontecer e o que vem depois?*

---

## 1 · O fluxo desejado

```
necessidade aparece → a Ayla entende a situação → decide se sequência visual ajuda
→ usa o que já sabe da criança → pergunta só o que falta → constrói com a família
→ apresenta simples e visual → a família usa → a Ayla acompanha → ajusta → aprende
```

### 1.1 Detecção
Dois caminhos, nunca só um:
- **Pedido explícito** — rotina visual, sequência, cartões, passo a passo,
  quadro, figurinhas, equivalentes.
- **Necessidade implícita** — o relato indica previsibilidade, sequência,
  transição, autonomia, ou instrução verbal repetida todo dia.

**Não oferecer para qualquer birra ou desregulação.** Sequência visual não é a
resposta para "ele bate quando tiro o objeto".

**O critério não é "pedaço recorrente do dia" — é a sequência** (D-R4,
aprovada em 2026-08-08): *há uma sequência de acontecimentos em que visualizar o
que vai acontecer e o que vem depois pode aumentar a previsibilidade?* Um
**acontecimento único** vale: o Mario vem jantar, dentista, médico, viagem,
festa, primeiro dia num lugar novo.

Famílias de situação que valem (exemplos, **não** lista fechada de palavras):
momentos recorrentes (acordar, dormir, banho, dentes, vestir, refeições, tarefa,
mochila) · transições (sair de casa, escola, desligar tela, terminar
brincadeira, voltar para casa) · resistência previsível (guardar brinquedos,
começar tarefa, sair de um lugar) · **situações novas e especiais** (médico,
dentista, viagem, festa, visita, primeiro dia de aula) · autonomia.

### 1.2 A criança
A rotina pertence a **uma** criança. Uma criança disponível → não perguntar.
Duas ou mais → usar o contexto; se claro, confirmar em uma frase (*"É para o
Pedro, certo?"*); se não, perguntar. **Nunca uma rotina para duas crianças.**

### 1.3 Direção antes de interrogatório
A mãe não precisa saber explicar tecnicamente a criança para receber ajuda.
Usar primeiro: contexto da conversa · perfil · interesses · sensibilidades ·
rotina conhecida · histórico · o que já foi tentado · o que funcionou.
Faltando algo essencial: agrupar quando fizer sentido, preferir pergunta fácil,
dar exemplo de resposta. **Nunca entrevista longa antes de entregar valor.**

### 1.4 Mínimo para montar
Qual criança · qual momento · qual sequência básica. Além disso, avaliar: *existe
um ponto desta sequência que costuma ser especialmente difícil?* — mas **não
perguntar o que o contexto já trouxe**.

### 1.5 Antes / durante / depois
Quando a transição é difícil, o apoio pode ser maior que o artefato:
antecipação, escolha, combinado, preparo do ambiente, frase de transição ·
sequência visual, apoio, linguagem, pequenas escolhas, recurso lúdico ·
encerramento previsível, reconhecimento, próxima atividade.
**Nada disso vira cartão obrigatoriamente.** Os cartões são a sequência; a
orientação da Ayla pode ser mais rica que o artefato.

### 1.6 Tema e título
Tema sugerido a partir do que já se sabe da criança (*"como ele gosta de
dinossauros…"*), nunca um "qual tema?" genérico. Título humano e reconhecível
— *"Quando o Mario vem jantar"*, não `rotina-123`.

### 1.6-bis Confirmação antes de gerar (D-R1)
**A confirmação depende de quem construiu a sequência.**

- **A mãe informou a sequência** (*"Mario chega → jantar → vai embora →
  dormir"*): **não pedir confirmação redundante.** Avançar para tema, título e
  geração — salvo inconsistência real na sequência que ela deu.
- **A Ayla inferiu, acrescentou ou reorganizou etapas:** apresentar rapidamente
  o que propôs e pedir confirmação. *"Eu montaria assim: 1. Mario chega ·
  2. brincar um pouco · 3. jantar · 4. despedida · 5. dormir. Faz sentido ou
  quer mudar alguma etapa?"*

**Objetivo:** proteger contra inferência errada **sem** tornar a experiência
burocrática. Não é confirmar sempre nem nunca — é confirmar **o que é da Ayla**.

### 1.7 Entrega
**A Ayla não entrega PDF pela conversa.** Entrega **link** para a página da
rotina, que é o lugar oficial do artefato.
- **WhatsApp:** conversa, construção, confirmação, aviso de pronto, link.
- **App:** rotina, cartões, execução, edição, impressão, salvamento, feedback.

### 1.8 Na página
Título · para qual criança · objetivo/contexto quando útil · etapas · cartões ·
**como usar** · editar · imprimir · reencontrar. *Uma mãe que nunca usou cartões
visuais entende rapidamente o que fazer.*

### 1.9 Uso interativo
Marcar etapa feita · deixar claro o que terminou · destacar a próxima · manter
visível o que falta. A criança precisa responder: **o que já aconteceu? o que
acontece agora? o que ainda falta?**

### 1.10 Feedback (D-R5)
Leve, na própria página: *ajudou · ajudou em parte · ainda não usamos · quero
ajustar*. **A primeira versão não espera a arquitetura maior de aprendizado** —
guarda o mínimo que não se perde: **rotina · criança · timestamp · resposta**.
Nada de aprendizado automático agora; a arquitetura ampla segue em **PEND-023**.

### 1.11 Segunda rotina para o mesmo momento (D-R3, provisório)
**Nunca substituir em silêncio.** A rotina anterior é preservada e a nova nasce
como artefato próprio. **Não apagar artefato que a família possa já ter impresso
ou estar usando** — é o caso que motivou a regra.
Se um mecanismo explícito de versionamento/substituição vier depois, ele
substitui esta regra; enquanto não vier, duplicar é o comportamento. **Se a
duplicação já for segura no desenho atual, isto não bloqueia a implementação.**

---

## 2 · ATUAL × DESEJADO

Auditoria do código em 2026-08-08. **Não confiei em nome de função.**

| # | Item do desejado | Estado | Evidência |
|---|---|---|---|
| 1.1 | Pedido explícito | **EXISTE** | `pediuRotinaExplicitamente`, `pediuApoioVisual` (`rotina-guiada.ts:66,105`) |
| 1.1 | Necessidade implícita | **EXISTE** | intenção `organizacao` em `intent.ts`, e `prontidao-rotina.ts` decide o tamanho. O critério já trata *"todo dia dá briga pra sair do videogame"* explicitamente |
| 1.1 | Não oferecer para qualquer birra | **EXISTE** | `nao_e_rotina` no critério de suficiência |
| 1.1 | **Situações novas e especiais** | **LACUNA — DECIDIDA (D-R4)** | o critério exige *"QUAL PEDAÇO DO DIA"*; um evento não é pedaço do dia e cai em `falta_escopo`. **É o Caso C. Aprovado ampliar o critério para sequência de acontecimento único** |
| 1.2 | Uma criança, confirmar só na dúvida | **EXISTE** | `precisaEscolherMembro` no orquestrador; o critério recusa quando não está claro de quem é o dia |
| 1.3 | Direção antes de interrogatório | **EXISTE, forte** | *"NUNCA PERGUNTE O QUE VOCÊ JÁ TEM"*, uma pergunta por vez, e na dúvida gerar |
| 1.4 | Ponto difícil enriquece, não bloqueia | **EXISTE** | *"Segurar uma rotina pra descobrir onde trava é interrogatório"* |
| 1.5 | Antes / durante / depois | **EXISTE** | é exatamente o tamanho `orientacao` |
| **1.5** | **Quando VER ajuda** | **DIVERGIA — DECIDIDO (D-R2)** | o código exige que a família tenha dito que ver ajuda. **Aprovada a mudança:** o contexto basta para **oferecer**. Ver §3 |
| 1.6 | Tema pelo que sabe da criança | **EXISTE** | `marcarAguardandoTema`, `lerTemaEscolhido`, estado `aguardando` |
| 1.6 | Título humano | **EXISTE PARCIAL** | há `nome` editável na página; **não conferi se o gerador produz título reconhecível** |
| **1.6-bis** | **Confirmação antes de gerar** | **CONTRADIZIA — DECIDIDO (D-R1)** | `rotina-guiada.ts:422` diz *"MONTE — não peça confirmação antes"*. **Aprovado o meio-termo:** confirmar o que a Ayla inferiu; não confirmar o que a mãe ditou |
| 1.7 | Link, não PDF | **EXISTE** | decisão de 03/08 já implementada: PDF só quando pedem (`pediuParaImprimir`) |
| 1.8 | Página explica o que fazer | **LACUNA** | a página tem olho, nome e idade. **Não há objetivo/contexto nem "como usar"** |
| 1.9 | Marcar etapa feita | **EXISTE PARCIAL** | `toggleTarefa` + campo `concluida` + "Recomeçar". **Não há destaque da próxima etapa nem "o que falta"** |
| 1.10 | Feedback na página | **NÃO EXISTE — DESBLOQUEADO (D-R5)** | nenhuma ocorrência no editor; `rotina-feedback.ts` classifica fala do WhatsApp, é outra coisa. **Primeira versão não espera PEND-023** |
| 13 | Impressão óbvia | **EXISTE PARCIAL** | botão **Imprimir** no topo, ao lado do título, com CSS de impressão. **Mas só aparece em modo `cartoes`** — rotina em modo lista não imprime |
| 14 | Salvar e reencontrar | **EXISTE** | `/ludico/rotinas` lista e filtra pela criança ativa |
| 15 | Editar e reordenar | **EXISTE** | renomear, editar texto, reordenar, adicionar, excluir |
| 1.11 | Segunda rotina para o mesmo momento | **DECIDIDO (D-R3)** | provisório: preservar a anterior, nunca substituir em silêncio |

**Leitura geral:** a Rotina está **muito mais madura** do que o desejado
pressupõe. A maior parte de 1.1 a 1.7 já existe, com genealogia datada e casos
reais documentados no próprio código. **As lacunas reais são poucas e são quase
todas do lado do app**, não da condução: página que não ensina, execução sem
destaque do agora, feedback inexistente, impressão condicionada ao modo. Mais o
buraco de conteúdo do evento especial (Caso C).

---

## 3 · Decisões — TODAS TOMADAS em 2026-08-08

Aprovadas pelo Sérgio. **Não resta decisão de produto bloqueadora.**

### D-R1 · Confirmar a sequência antes de gerar — **DECIDIDO**
O desejado pede confirmação (*"não gerar silenciosamente algo que ela não
reconheça"*). O código decide o contrário **de propósito**, e o argumento está
escrito: *"é mais rápido corrigir algo pronto do que responder mais perguntas"*.
Hoje a confirmação existe só no tamanho pequeno.
**Aprovada a opção (c):** confirmar quando a Ayla **inferiu, acrescentou ou
reorganizou**; não confirmar quando a mãe **ditou** a sequência. Redação em
1.6-bis.

> ⚠️ **Mudança deliberada de produto.** A instrução de `rotina-guiada.ts:422`
> não estava errada — ela resolvia um problema real (evitar mais um turno de
> perguntas). O que muda é o escopo: ela passa a valer só para a sequência que a
> **família** deu. Quem for mexer no código **preserva o comentário e a data
> originais** e acrescenta esta decisão; não apagar a genealogia.

### D-R2 · Quando a Rotina Visual pode ser OFERECIDA — **DECIDIDO**
**Não se exige mais evidência prévia** de que "visual funciona para esta
criança". A Ayla **pode oferecer** quando o contexto indicar que previsibilidade,
sequência, transição ou autonomia podem ajudar: sair de casa, banho, dormir,
desligar tela, mudança de atividade, evento novo, visita, médico/dentista,
sequência com muitas instruções verbais, necessidade de autonomia.

**A distinção que não pode se perder:**
> "transição difícil" **não** significa *"esta criança precisa de apoio visual"*.
> Significa *"apoio visual é uma possibilidade relevante a oferecer"*.

Quem decide se vale propor é o julgamento sobre o caso — contexto, o que se sabe
da criança, histórico, situação de agora. **Não virar regra rígida por
palavra-chave.**

> ⚠️ **Mudança deliberada de produto, e a regra antiga tinha razão de ser.** A
> exigência de evidência nasceu em 03/08 para conter cartão gerado sem
> necessidade — custo de imagem e ruído na tela. O que mudou não é o diagnóstico,
> é a escolha: prefere-se **oferecer** e deixar a família decidir a **recusar**
> apoio visual a quem não sabe pedir. Ao mexer no código, **preservar o registro
> da regra de 03/08 e por que ela existia**; ela não foi um erro.

### D-R3 · Segunda rotina para o mesmo momento — **DECIDIDO (provisório)**
**Nunca substituir em silêncio.** Preservar a anterior, criar artefato novo.
Mecanismo explícito de versionamento fica para depois. Redação em 1.11.

### D-R4 · Evento especial é rotina — **DECIDIDO: sim**
Acontecimento único gera Rotina/Sequência Visual. O critério de suficiência
muda: o escopo passa a poder ser **o evento**, não só o período. Redação em 1.1.

### D-R5 · Feedback — **DECIDIDO: não bloqueia**
A página coleta feedback simples desde a primeira versão, guardando rotina,
criança, timestamp e resposta. A arquitetura ampla segue em **PEND-023**.

---

## 4 · O que reusar (nada de segunda Rotina)

Tudo o que segue existe e está bom o bastante para ser estendido:
`lib/ayla/rotina-guiada.ts` (condução) · `lib/ayla/prontidao-rotina.ts`
(porteiro e tamanho) · `lib/ludico/rotina-servico.ts` e `rotina-ia-core.ts`
(montagem) · `lib/ludico/rotina-pdf.ts` (impressão) ·
`app/(app)/ludico/rotinas/[id]/rotina-editor.tsx` (edição, execução,
impressão) · `api/ludico/rotinas/[id]/cartoes` (geração de cartões) ·
`gerarMagicLink` (entrega do link).

**Não criar** novo gerador, novo editor, nova rota de PDF, novo armazenamento
nem novo fluxo de link.

---

## 5 · Dependências, e o que não espera

| Depende de | Trava a Rotina? |
|---|---|
| PEND-016 · condução | **não** — a condução da Rotina já é própria e madura |
| PEND-017 · conhecimento | **não para o artefato**; sim para a *riqueza* da orientação antes/durante/depois |
| PEND-018 · memória | **não**; melhora tema, interesses e ponto difícil |
| PEND-023 · feedback | **não** — D-R5 desbloqueou a primeira versão |
| PEND-026 · Admin | não |

**Pode andar agora, sem esperar A+B+C — e nada mais depende de decisão:**
página que ensina (1.8) · execução com destaque do agora (1.9) · impressão em
qualquer modo (13) · feedback (1.10) · evento especial (1.1) · confirmação
seletiva (1.6-bis) · oferta de visual pelo contexto (D-R2) · preservar a rotina
anterior (1.11).

**Ponto de extensão a preservar:** a orientação antes/durante/depois deve poder
receber repertório recuperado quando a PEND-017 evoluir — sem reescrever o
condutor.
