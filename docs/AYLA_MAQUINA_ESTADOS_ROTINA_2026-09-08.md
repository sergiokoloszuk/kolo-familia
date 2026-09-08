# MÁQUINA DE ESTADOS DA ROTINA VISUAL — MAPA DO RUNTIME VIVO

**Data:** 08/09/2026 · **Modo:** AUDITAR · **Nenhum código alterado neste mapa.**
**SHA em produção:** `694aee5` · Peça 1 do Gate A (observabilidade) já no ar.

Este mapa é o item 3 da ordem do Gate A: mapear de ponta a ponta antes de
qualquer correção nova, e procurar especificamente **dois donos da mesma
decisão** — o padrão que já produziu três incidentes hoje (`transicoes`,
`rotinaExistente`, `tema`).

---

## 0. Resposta curta

A decisão **"existe uma rotina pendente?"** tem **cinco donos**, com **quatro
janelas de tempo diferentes** e **dois escopos diferentes**. Nenhum deles sabe
dos outros.

E o estado não tem quem o encerre: **`cards_status='aguardando'` não expira**.
Há uma rotina presa há **18 dias** na base, além do teto de 7 dias do
reconciliador — e ela continua sendo apresentada ao cérebro conversacional como
"pendência de agora", em toda conversa daquela família, sobre qualquer filho.

---

## 1. Os portadores de estado

| # | Portador | Onde vive | O que representa |
|---|---|---|---|
| E1 | `rotinas.cards_status` | coluna | `nenhum` · `aguardando` · `gerando` · `pronto` · `erro` |
| E2 | `rotinas.tema` | coluna | o tema dos cartões, ou `NULL` |
| E3 | `rotina_tarefas` | tabela | as etapas e as imagens |
| E4 | `ayla_messages.tipo` | coluna | `rotina_proposta` · `rotina_conversa` · `rotina_pronta` |
| E5 | `ayla_messages.metadata.proposta` | jsonb | as etapas propostas esperando "sim" |
| E6 | `perfil_vivo_membro.categorias_extras.transicoes` | jsonb | episódios/padrões (Gate A, A2) |
| E7 | `rotinas.modo_exibicao` | coluna | `lista` · `cartoes` |

---

## 2. E1 — `cards_status`: **quatro escritores independentes**

| Escritor | Arquivo | Transições que implementa |
|---|---|---|
| **W1 · Web** | `app/(app)/ludico/rotinas/actions.ts` | `nenhum` (206, 241, 835) · `gerando` (710, 865) · `pronto` (759, 908) · `erro` (764, 912) |
| **W2 · API** | `app/api/ludico/gerar-rotina/route.ts` | `gerando` (132) · `pronto` (163) · `erro` (167) |
| **W3 · WhatsApp** | `lib/ayla/rotina-guiada.ts` | `nenhum` (823, 1557, 2896) · `aguardando` (1013) |
| **W4 · Reconciliador** | `lib/ayla/rotina-reconciliacao.ts` | `erro` (324) |

**W1 e W2 implementam o MESMO ciclo `gerando → pronto/erro` de forma
independente.** São dois caminhos completos de geração, com a mesma
responsabilidade, escritos separadamente. Qualquer correção no ciclo de geração
precisa ser feita duas vezes, e nada garante que seja.

**W3 nunca escreve `gerando`, `pronto` nem `erro`** — o WhatsApp delega a
geração a W2 via `dispararGeracao`. Isso está certo: um dono para a geração.
O problema não é aqui.

### Leitores de E1

`semana/page.tsx` (71, 72, 142, 150) · `[id]/page.tsx` (26) ·
`cron/route.ts` (299, 1082) · `gerar-rotina/route.ts` (69) ·
`rotina-guiada.ts` (1031, 1416, 2417, 2637, 2769, 2781, 2892) ·
`rotina-reconciliacao.ts` (162, 173, 232, 269, 306) ·
`conducao/estado-do-turno.ts` (179).

---

## 3. A DECISÃO COM CINCO DONOS: "há rotina pendente?"

Esta é a resposta à pergunta que a missão manda fazer.

| # | Dono | Arquivo:linha | Janela | Escopo | O que faz com a resposta |
|---|---|---|---|---|---|
| D1 | `propostaPendente` | `rotina-guiada.ts:196` | **48 h** | família | lê `metadata.proposta` da última mensagem; se a última não for `rotina_proposta`, desiste |
| D2 | `rotinaConversaPendente` | `rotina-guiada.ts:236` | **48 h** | família | decide se o turno é continuação da montagem |
| D3 | `rotinaAguardandoTema` | `rotina-guiada.ts:1035` | **6 h** | família **+ membro** | captura a mensagem como tema e dispara geração |
| D4 | `lerArtefatoPendente` | `conducao/estado-do-turno.ts:179` | **nenhuma** | família (**sem membro**) | injeta a pendência no prompt do cérebro conversacional |
| D5 | `runArtefatosOrfaos` | `cron/route.ts:299` | (varredura) | global | reconcilia órfãs |
| D6 | reconciliador | `rotina-reconciliacao.ts:232, 269, 306` | **teto de 7 dias** | rotina | decide gerar ou perguntar |

**Quatro janelas para o mesmo fato: 48 h, 6 h, nenhuma, 7 dias.** Uma rotina de
10 horas atrás é "pendente" para D1, D2 e D4, e **não existe** para D3. Isso não
é configuração — é o mesmo fato respondido de quatro formas.

### D4 é o mais perigoso, e está vivo agora

```ts
.from("rotinas")
.eq("family_account_id", familyId)
.eq("cards_status", "aguardando")
.order("created_at", { ascending: false })
.limit(1)
```

- **sem filtro de tempo** — uma rotina presa há semanas continua sendo "a
  pendência de agora";
- **sem filtro de membro** — a rotina pendente do Mario aparece no bloco de
  estado quando a conversa é sobre a Manu.

MEDIDO na base hoje: **2 rotinas presas em `aguardando`**, uma há **1 dia**
(`ec61feee`, a evidência da PEND-171) e outra há **18 dias** (`f0c052a4`, família
`f824762d`). A de 18 dias está **além do teto de 7 dias** do reconciliador — ele
não a alcança mais. E D4 a apresenta ao modelo, em toda conversa daquela família,
como pendência atual. Há 18 dias.

**Nenhum estado tem expiração.** `aguardando` não vira `nenhum` por tempo. Quem
poderia encerrar é o reconciliador, e ele desiste em 7 dias.

---

## 4. E2 — `tema`: três fontes, uma sem dono claro

| Fonte | Onde | Confiabilidade |
|---|---|---|
| **F1** · `lerTemaEscolhido(mensagem atual)` | `rotina-guiada.ts` | escrita para o turno logo após "qual tema?"; **sobre qualquer outra mensagem, captura lixo** |
| **F2** · `temaJaDitoNoHistorico` | `rotina-guiada.ts` | usa `temaEnunciado`, que exige marcador explícito — mais seguro |
| **F3** · formulário da web | `ludico/rotinas/actions.ts:241, 710` | a família escolhe; sem ambiguidade |

O incidente das 09:13 foi F1 aplicada a uma mensagem que não era resposta de
tema: capturou **"sequencia visual"** — o nome do próprio artefato. Corrigido em
`34c8da4` com a guarda de pedido novo e a lista de recusa. **A causa estrutural
permanece:** F1 é um extrator permissivo por desenho, e nada no tipo diz "esta
mensagem é uma resposta de tema" — isso é inferido do estado, pelos donos
divergentes da seção 3.

O rastro novo (`tema_fonte`) passa a registrar qual das três decidiu.

---

## 5. E4/E5 — o estado que vive na conversa

O estado conversacional é **inferido de `ayla_messages`**, não guardado:

```
Ayla propõe sequência   → tipo=rotina_proposta + metadata.proposta=[etapas]
Ayla monta e falta tema → tipo=rotina_conversa  (conversa fica ABERTA)
Ayla monta e está pronto→ tipo=rotina_pronta    (conversa FECHA)
```

**Precedência declarada** (`rotina-guiada.ts:1469`): proposta pendente vence
tema. Está correta e é explícita.

**Precedência que faltava** e foi acrescentada em `34c8da4`: pedido novo vence
estado pendente.

⚠️ **A fragilidade:** o estado é a **última mensagem outbound** dentro de 48 h.
Qualquer mensagem que a Ayla envie por outro motivo (proativa, nudge, seguimento)
entra na frente e apaga o estado da rotina — porque D1 desiste se a última não
for `rotina_proposta`. Não medi com que frequência isso acontece; é candidato a
pendência.

---

## 6. Os três incidentes de hoje, no mapa

| Incidente | Estado envolvido | Padrão |
|---|---|---|
| **Barco (Gate A)** | E6 `transicoes` | um campo com **duas semânticas** (episódio × padrão) |
| **Barco (08:53)** | E3 via `carregarOQueJaSabemos` | o mesmo dado com **duas molduras** ("não é a sequência de agora" × "use como base") |
| **Tema (09:13)** | E1+E2 via D3 | **cinco donos** de "há pendência?", e nenhum perguntava se a mensagem era um pedido novo |
| **Sem artefato (09:23)** | — | `conduzirRotina` devolveu `null` e **ninguém registrou por quê** |

O padrão é sempre o mesmo, e não é falta de cuidado em cada correção: **a mesma
decisão tem mais de um dono, e o dono que eu corrijo não é o que roda.**

---

## 7. A invariante 5 da missão: **fala ≠ ato**

Confirmada como violação estrutural, não como caso isolado.

`lerArtefatoPendente` (D4) entrega a pendência ao **cérebro conversacional**
(`experimental.ts`), que consegue falar da sequência e do tema com fluência —
mas **não tem capacidade de criar artefato nenhum**. Quando `conduzirRotina`
devolve `null`, o turno cai nesse cérebro, que conversa perfeitamente sobre um
ato que não vai acontecer.

Foi exatamente o turno das 09:23: etapas certas, ordem certa, tema perguntado,
tema aceito, confirmação — e zero linhas em `rotinas`.

**Não existe hoje nenhuma verificação de que uma fala sobre artefato corresponda
a estado real.** `falaCoerenteComEstado` existe e cobre o caminho de dentro do
`conduzirRotina`; o caminho conversacional não passa por ela.

Isto converge com a regra de capacidade condicional do Core (§16 / Gate E): a
Ayla só pode afirmar execução quando o sistema executou. Hoje ela pode afirmar
sem que nada exista.

---

## 8. O que este mapa recomenda (não implementado)

Por ordem de risco, e cada um é uma correção **estrutural**, não sintomática:

1. **Um dono para "há rotina pendente?"** — uma função, uma janela, escopo por
   membro, usada pelos cinco pontos. É a causa comum de dois dos três incidentes.
2. **D4 ganha janela e filtro de membro** — hoje mostra pendência de 18 dias e de
   outra criança. É a correção de menor risco e maior efeito imediato.
3. **`aguardando` precisa expirar** — ou o reconciliador perde o teto de 7 dias,
   ou o estado vira `nenhum` por idade. Rotina presa não pode ser eterna.
4. **Fala sobre artefato exige estado** — estender a verificação ao caminho
   conversacional, não só ao `conduzirRotina`.
5. **W1 e W2 viram um só ciclo de geração** — dois donos do mesmo
   `gerando → pronto/erro`.

---

## 9. Estado do parque, medido hoje

| `cards_status` | rotinas |
|---|---|
| `pronto` | 42 |
| `nenhum` | 46 |
| `erro` | **2** |
| `aguardando` | **2** (uma há 18 dias, além do teto do reconciliador) |
| `gerando` | 0 |

92 rotinas. Os dois `erro` e a presa de 18 dias nunca foram investigados — e não
apareceriam em lugar nenhum, porque nada alerta sobre eles.
