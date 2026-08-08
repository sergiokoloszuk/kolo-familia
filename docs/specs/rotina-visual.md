# SPEC — Rotina / Sequência Visual

**Estado:** DESEJADO consolidado · ATUAL auditado · **não implementado**.
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

### 1.10 Feedback
Leve, na própria página: *ajudou · ajudou em parte · ainda não usamos · quero
ajustar*. Sem sistema de aprendizado automático agora — mas **o feedback não se
perde**: fica associado à rotina, à criança, ao contexto e à conversa de origem.

---

## 2 · ATUAL × DESEJADO

Auditoria do código em 2026-08-08. **Não confiei em nome de função.**

| # | Item do desejado | Estado | Evidência |
|---|---|---|---|
| 1.1 | Pedido explícito | **EXISTE** | `pediuRotinaExplicitamente`, `pediuApoioVisual` (`rotina-guiada.ts:66,105`) |
| 1.1 | Necessidade implícita | **EXISTE** | intenção `organizacao` em `intent.ts`, e `prontidao-rotina.ts` decide o tamanho. O critério já trata *"todo dia dá briga pra sair do videogame"* explicitamente |
| 1.1 | Não oferecer para qualquer birra | **EXISTE** | `nao_e_rotina` no critério de suficiência |
| 1.1 | **Situações novas e especiais** | **LACUNA** | o critério exige *"QUAL PEDAÇO DO DIA"*. Um evento (*o Mario vem jantar*, médico, viagem) **não é pedaço do dia** — cai provavelmente em `falta_escopo`. **É o Caso C, e não está coberto** |
| 1.2 | Uma criança, confirmar só na dúvida | **EXISTE** | `precisaEscolherMembro` no orquestrador; o critério recusa quando não está claro de quem é o dia |
| 1.3 | Direção antes de interrogatório | **EXISTE, forte** | *"NUNCA PERGUNTE O QUE VOCÊ JÁ TEM"*, uma pergunta por vez, e na dúvida gerar |
| 1.4 | Ponto difícil enriquece, não bloqueia | **EXISTE** | *"Segurar uma rotina pra descobrir onde trava é interrogatório"* |
| 1.5 | Antes / durante / depois | **EXISTE** | é exatamente o tamanho `orientacao` |
| **1.5** | **Quando VER ajuda** | **DIVERGE** | o desejado diz que transição/previsibilidade indicam sequência visual; o código diz **"TRANSIÇÃO DIFÍCIL NÃO É EVIDÊNCIA DE VISUAL"** e exige que a família tenha dito que ver ajuda. **Decisão aberta — ver §3** |
| 1.6 | Tema pelo que sabe da criança | **EXISTE** | `marcarAguardandoTema`, `lerTemaEscolhido`, estado `aguardando` |
| 1.6 | Título humano | **EXISTE PARCIAL** | há `nome` editável na página; **não conferi se o gerador produz título reconhecível** |
| **1.7** | **Confirmação antes de gerar** | **CONTRADIZ** | `rotina-guiada.ts:422`: *"Se já dá pra montar uma primeira versão, **MONTE — não peça confirmação antes**"*. Só o tamanho pequeno propõe e confirma (`:1066`). **Decisão aberta — ver §3** |
| 1.7 | Link, não PDF | **EXISTE** | decisão de 03/08 já implementada: PDF só quando pedem (`pediuParaImprimir`) |
| 1.8 | Página explica o que fazer | **LACUNA** | a página tem olho, nome e idade. **Não há objetivo/contexto nem "como usar"** |
| 1.9 | Marcar etapa feita | **EXISTE PARCIAL** | `toggleTarefa` + campo `concluida` + "Recomeçar". **Não há destaque da próxima etapa nem "o que falta"** |
| 1.10 | Feedback na página | **NÃO EXISTE** | nenhuma ocorrência de feedback no editor. Existe `rotina-feedback.ts`, mas ele classifica o que a mãe diz **no WhatsApp** — é outra coisa |
| 13 | Impressão óbvia | **EXISTE PARCIAL** | botão **Imprimir** no topo, ao lado do título, com CSS de impressão. **Mas só aparece em modo `cartoes`** — rotina em modo lista não imprime |
| 14 | Salvar e reencontrar | **EXISTE** | `/ludico/rotinas` lista e filtra pela criança ativa |
| 15 | Editar e reordenar | **EXISTE** | renomear, editar texto, reordenar, adicionar, excluir |
| 15 | Segunda rotina para o mesmo momento | **NÃO INVESTIGADO A FUNDO** | **decisão de produto — §3** |

**Leitura geral:** a Rotina está **muito mais madura** do que o desejado
pressupõe. A maior parte de 1.1 a 1.7 já existe, com genealogia datada e casos
reais documentados no próprio código. **As lacunas reais são poucas e são quase
todas do lado do app**, não da condução: página que não ensina, execução sem
destaque do agora, feedback inexistente, impressão condicionada ao modo. Mais o
buraco de conteúdo do evento especial (Caso C).

---

## 3 · Decisões que precisam de produto

Nenhuma destas é técnica. **Não implementar nenhuma antes do aval.**

### D-R1 · Confirmar a sequência antes de gerar?
O desejado pede confirmação (*"não gerar silenciosamente algo que ela não
reconheça"*). O código decide o contrário **de propósito**, e o argumento está
escrito: *"é mais rápido corrigir algo pronto do que responder mais perguntas"*.
Hoje a confirmação existe só no tamanho pequeno.
**As duas posições são defensáveis e se excluem.** Opções: (a) manter como
está; (b) confirmar sempre; (c) confirmar só quando a Ayla **inferiu** parte da
sequência, e gerar direto quando a mãe a ditou — que é o caso G.
**Recomendo (c)**: preserva a rapidez onde a mãe já deu tudo e protege
exatamente o caso que motivou o desejado.

### D-R2 · O que conta como evidência de que VER ajuda?
Hoje exige-se que a família tenha dito. O desejado sugere que transição
recorrente e necessidade de previsibilidade bastam. Afrouxar aumenta cartão
gerado sem necessidade (custo de imagem e ruído na tela); manter recusa apoio
visual a quem não sabe pedir. **Karina decide.** Registrar que a regra atual
nasceu de decisão de 03/08 e é deliberada.

### D-R3 · Segunda rotina para o mesmo momento — substituir, versionar ou duplicar?
Não decidir automaticamente. **Karina.** Observação: duplicar é o mais seguro
para não destruir o que a família já imprimiu e colou na parede.

### D-R4 · Evento especial é rotina?
*"O Mario vem jantar"* não é pedaço do dia, e o critério atual não o acomoda.
É preciso decidir se a Rotina cobre **sequência de acontecimento único** — e,
se sim, o critério de suficiência muda (o escopo passa a ser *o evento*, não *o
período*).

### D-R5 · Feedback: onde vive?
Precisa existir na página (1.10). Onde ele é gravado e como se liga à conversa
de origem depende de **PEND-023**.

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
| PEND-023 · feedback | **sim, para D-R5** — só o destino do dado |
| PEND-026 · Admin | não |

**Pode andar agora, sem esperar A+B+C:** página que ensina (1.8) · execução com
destaque do agora (1.9) · impressão em qualquer modo (13) · UI de feedback
(1.10, com o destino marcado como ponto de extensão) · evento especial (1.1),
se D-R4 aprovar.

**Ponto de extensão a preservar:** a orientação antes/durante/depois deve poder
receber repertório recuperado quando a PEND-017 evoluir — sem reescrever o
condutor.
