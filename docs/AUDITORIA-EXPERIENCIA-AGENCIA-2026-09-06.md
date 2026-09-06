# Auditoria — Experiência Agência

**Modo:** AUDITAR. Nenhum código, banco, prompt, flag, cron ou produção foi
alterado. 06/09/2026.

---

## GATE 0 — qual produção estamos auditando

| | |
|---|---|
| HEAD local | `2678c3f04cb47879bd2208a26aa2a3b987fdfd7a` |
| `origin/main` | `2678c3f04cb47879bd2208a26aa2a3b987fdfd7a` |
| SHA servido (`/api/health`) | `2678c3f04cb47879bd2208a26aa2a3b987fdfd7a` |
| ref · ambiente | `main` · `production` |
| `apps/web/src` modificado | **0 arquivos** |
| Coletado em | 2026-09-06T19:26:16Z |

**Os três SHAs coincidem e a árvore está limpa.** Isto é o que autoriza esta
auditoria a ler o código local para afirmar comportamento de produção — condição
que não vale sempre e que foi verificada, não presumida.

**Flags servidas:** `ayla_experimental_todas: true` · `ayla_pos_trial: true`
**Chaves presentes:** `anthropic: true` · `openai: true`

**Documentos ativos no banco:**

| chave | versão ativa | chars | publicado |
|---|---|---|---|
| `core` | **v11** | 27.994 | 2026-09-05T20:58 |
| `trial` | v5 | 11.048 | 2026-08-26T21:11 |
| `plano` | **nenhuma** | — | só `arquivado` |
| `cartoes_visuais` | **nenhuma** | — | só `arquivado` |

> ⚠️ `plano` e `cartoes_visuais` existem no banco e **não têm versão ativa**.
> Quem editar esses documentos esperando afetar o produto não afeta nada.

---

## 1 — Quem pode "ser Ayla" hoje

### Tráfego real de saída (14 dias, `ayla_messages`, 484 outbound)

| tipo | n | % |
|---|---:|---:|
| `resposta_registro` | 240 | 50% |
| **`rotina`** | **152** | **31%** |
| `boas_vindas` | 21 | 4% |
| `trial_d3` | 16 | 3% |
| `plano_seguimento` | 14 | 3% |
| `trial_d0` | 8 | 2% |
| `rotina_conversa` | 8 | 2% |
| `fim_de_semana` | 7 | 1% |
| `entrada_guiada` | 6 | 1% |
| outros 6 tipos | 12 | 2% |

**Metade do que a família recebe não vem do caminho conversacional.**

### Chamadas de modelo (14 dias, `api_calls`, 1.320 chamadas)

| feature | n | provider / modelo |
|---|---:|---|
| **`classificar_intencao`** | **252** | anthropic / **claude-haiku-4-5** |
| `ayla_experimental` | 221 | openai / gpt-5.6-luna |
| **`ayla_espontanea`** | **173** | anthropic / **claude-haiku-4-5** |
| `ayla_parser_pos` | 166 | anthropic / claude-haiku-4-5 |
| `ayla_dedup_diario` | 107 | anthropic / claude-haiku-4-5 |
| `classificar_area_diario` | 83 | anthropic / claude-haiku-4-5 |
| `ayla_rotear_kv` | 69 | anthropic / claude-haiku-4-5 |
| `ayla_conflito_kv` | 53 | anthropic / claude-haiku-4-5 |
| `conversa_web` | 27 | openai / gpt-5.6-luna |
| **`ayla_repertorio`** | **21** | anthropic / claude-sonnet-4-6 |

**Por provider: anthropic 990 (75%) · openai 330 (25%).**

O decisor mais chamado da Kolo não é o GPT — é o **Haiku do
`classificar_intencao`**, com 252 chamadas contra 221 do GPT.

### Tabela de emissores

| Caminho | Detecta | Interpreta | Decide | Escreve a fala | Modelo | Core v11 | Perfil | Histórico | Estado conv. | Toma turno sem GPT | Envia sozinho |
|---|---|---|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `experimental.ts` (oficial) | webhook | GPT | GPT + código | **GPT** | gpt-5.6-luna | ✅ | ✅ | 10 linhas | parcial | não | não |
| `classificarIntencao` (`intent.ts`) | — | **Haiku** | **Haiku** | — | claude-haiku-4-5 | ❌ | ❌ | 2 falas | ❌ | **sim** | não |
| `mensagemEspontanea.ts` | cron | **Haiku** | **Haiku** | **Haiku** | claude-haiku-4-5 | ❌ | parcial | parcial | ❌ | **sim** | **sim** |
| `rotina-guiada.ts` | código | modelo próprio | **código** | código + modelo | sonnet-4-6 | ❌ | parcial | próprio | próprio | **sim** | **sim** |
| `responder.ts` (Legacy) | webhook | modelo | modelo | modelo | — | parcial | ✅ | ✅ | parcial | **sim** | **sim** |
| Trial D0/D3 (cron) | cron | código | **código** | doc `trial` v5 | via experimental | ✅ | ✅ | ✅ | ✅ | não | **sim** |
| `boas_vindas` | evento | código | código | template | — | ❌ | ❌ | ❌ | ❌ | **sim** | **sim** |
| `entrada_guiada` | código | código | código | menu | — | ❌ | ❌ | ❌ | ❌ | **sim** | **sim** |
| `repertorio.ts` (BP) | — | **Sonnet** | **Sonnet** | — | sonnet-4-6 | ❌ | parcial | ❌ | ❌ | **sim** | não |
| `plano_seguimento` | cron | código | código | doc `plano` (**sem versão ativa**) | — | ❌ | ✅ | parcial | ❌ | **sim** | **sim** |
| `fim_de_semana` | cron | código | código | template | — | ❌ | parcial | ❌ | ❌ | **sim** | **sim** |
| `verificacao.ts` (OTP) | código | — | código | template | — | ❌ | ❌ | ❌ | ❌ | **sim** | **sim** |
| `admin/notificacoes` | admin | humano | humano | humano | — | ❌ | ❌ | ❌ | ❌ | **sim** | **sim** |

**Veredito da seção 1: não temos uma Ayla.** Temos **um** caminho que recebe o
Core v11 e **doze** emissores capazes de falar com a família sem ele.

---

## 2 — GPT é o cérebro?

**Não.** É a voz de metade do que sai, e não participa das decisões materiais
que acontecem antes dele.

| Decisão material | Entrada | Decisor | Modelo/lógica | Consequência | GPT participa |
|---|---|---|---|---|:-:|
| Intenção do turno | texto | `intent.ts` | **Haiku** | qual caminho responde | ❌ |
| Tema do turno | texto | `intent.ts` | **Haiku** | qual domínio do perfil ganha profundidade | ❌ |
| Skills acionadas | texto | `intent.ts` | **Haiku** | quais BPs ficam elegíveis | ❌ |
| Seleção de Boas Práticas | skills | `repertorio.ts` | **Sonnet** | **que conhecimento o GPT vê** | ❌ |
| Recorte do perfil | domínio | `experimental-contexto.ts` | código + teto | que fatos o GPT vê | ❌ |
| Corte do histórico | — | código | **últimas 10 linhas** | o que o GPT lembra | ❌ |
| Fala da espontânea | cron | `mensagemEspontanea.ts` | **Haiku + prompt de 1.139 chars** | **a mensagem que chega** | ❌ |
| Condução da Rotina | texto | `rotina-guiada.ts` | código + Sonnet | toma o turno inteiro | ❌ |
| Retomada de artefato | texto | `rotina-retomada.ts` | **regex** | toma o turno inteiro | ❌ |

### O achado mais grave

`mensagemEspontanea.ts` **não importa Core, `nucleoConducao` nem documento
ativo**. Ela roda com um `SYSTEM_PROMPT` de **1.139 caracteres hardcoded no
arquivo** — **4% do Core v11**, que tem 27.994.

São **173 chamadas em 14 dias**, escritas por Haiku, indo para famílias reais.
Quem editar o Core v11 no Admin acreditando estar mudando "a Ayla" não muda
nada nessa metade.

### O gargalo do conhecimento

`ayla_repertorio` rodou **21 vezes** contra **221 conversas** — cerca de **9%
dos turnos**. Em ~91% dos turnos o GPT responde **sem nenhuma Boa Prática na
mão**, e quem decidiu isso foi o Haiku do classificador, não ele.

---

## 3 — O que o GPT realmente recebe

Ordem do `system` em `experimental.ts:1067`:
`core → contexto → jornada → doc Trial → repertório → pós-Trial → comercial → formato → instrução extra`

E `messages: [{ role: "user", content: params.mensagem }]` — **só a mensagem
atual**. Não há histórico de turnos no array de mensagens.

| Item | Existe | É carregado | Entra no contexto | Formato | Limitação |
|---|:-:|:-:|:-:|---|---|
| Nome, idade, responsável | ✅ | ✅ | ✅ | `<o_que_ja_sabemos>` | — |
| Interesses, desafios | ✅ | ✅ | ✅ | idem | teto de 1.200 chars |
| Perfil / Kolo Vivo | ✅ | ✅ | **recortado** | idem | só o domínio do turno + vizinhos, 320 chars |
| Lacunas conhecidas | ✅ | ✅ | ✅ | `<o_que_ainda_nao_sei>` | **some no pós-Trial** |
| Perfil da família | ✅ | ✅ | ✅ | `blocoDaFamilia` | **some no pós-Trial** |
| Histórico recente | ✅ | ✅ | ✅ | `<conversa_recente>`, **prosa, 10 linhas** | busca 12, usa 10 |
| Pergunta pendente | ✅ | ✅ | ✅ | `<continuidade>` | **só quando a resposta é curta** |
| Sujeito atual | ✅ | ✅ | ✅ | `blocoDeFoco` | — |
| Boas Práticas | ✅ | ~9% dos turnos | quando selecionadas | `repertorio` | decidido por Haiku/Sonnet |
| Jornada / dia do Trial | ✅ | ✅ | ✅ | `<jornada>` | — |
| **Artefato pendente (rotina em `aguardando`)** | ✅ no banco | ❌ | ❌ | — | **não existe no contexto** |
| **Oferta pendente** | ✅ | ❌ | ❌ | — | fora do bloco |
| **Estratégia sugerida + resultado** | parcial | ❌ | ❌ | — | write-only |
| **Perguntas já feitas** | ✅ nas falas | só via as 10 linhas | parcial | prosa | perde-se além de 10 |
| **Correções da família** | ✅ nas falas | só via as 10 linhas | parcial | prosa | perde-se além de 10 |
| **BASE2** | ✅ | ❌ | ❌ | — | **só no Legacy** |
| **Pós em Neurodesenvolvimento** | arquivo em `docs/` | ❌ | ❌ | — | **não existe no runtime** |

### A distinção que a missão pediu

- **Está armazenado:** perfil completo, todo o histórico, todos os artefatos,
  todas as estratégias, BASE2, a Pós.
- **O GPT recebe:** o perfil recortado por domínio, **10 linhas de conversa em
  prosa**, e Boas Práticas em 9% dos turnos.

**A memória longitudinal do produto é de dez linhas.** Tudo além disso existe
no banco e nunca chega ao modelo.

---

## 4 — Continuidade longitudinal

O mecanismo é `lib/conducao/continuidade.ts`, que emite `<continuidade>` **só
quando** a resposta é curta **e** há pergunta pendente detectável nas falas
recentes. O comentário do próprio arquivo reconhece a causa:

> "O histórico chega ao modelo como prosa… Ler isso e ligar o '3' à lista certa
> é justamente o que falhou com a Lucila, com a Vanessa e com a Samara."

| Resposta | Tratamento hoje |
|---|---|
| `sim`, `isso`, `ok`, `3`, `tudo` | `<continuidade>` reconstrói a pergunta — **se** estiver nas 10 linhas |
| `como?`, `me mostra`, `me ensina` | sem tratamento próprio; depende do GPT ler a prosa |
| `e agora?`, `consegue trazer?` | desde `a02ddcb`, retomada por **regex** + estado da rotina |

> ⚠️ **Não provado nesta auditoria:** os replays nominais de Vanessa/Miguel,
> Lucila/Heitor, Claire/Maria, Samara e Milena/Maria Julia **não foram
> executados**. O mecanismo foi lido, não exercitado. Classificação:
> **INVESTIGADO**, não comprovado.

---

## 5 — Fidelidade F1–F20

**Não auditada nesta sessão.** A bancada de fidelidade existe
(`scripts/bancada/fidelidade/`) e não foi rodada contra o SHA `2678c3f`.

A pendência conhecida — *"Me mostra" ainda apresentou lista em parte do bench* —
**continua sem nova prova** e não deve ser considerada resolvida.

Classificação: **INVESTIGADO / não medido**.

O que a arquitetura já permite dizer: F12 (continuidade) e F19 (conhecimento
atrás) têm causa **arquitetural**, não de Prompt Mestre — o Core não pode
lembrar o que não recebeu, nem esconder conhecimento que nunca chegou.

---

## 6 — Fontes de conhecimento

| Fonte | Onde está | Runtime | Conversa principal | Plano | Recuperação dinâmica |
|---|---|:-:|:-:|:-:|---|
| Perfil / Kolo Vivo | `perfil_vivo` | ✅ | ✅ recortado | ✅ | por domínio do turno |
| Boas Práticas | `boas_praticas` | ✅ | **~9% dos turnos** | parcial | skills do Haiku |
| **BASE2** | `lib/conducao/base2*.ts` | ✅ | ❌ **só Legacy** | ❌ | — |
| **Pós em Neurodesenvolvimento** | `docs/` | ❌ | ❌ | ❌ | **nenhuma** |

`experimental.ts` **não importa BASE2**. A verificação foi direta: os únicos
consumidores fora de `lib/conducao/` são `responder.ts` e `orchestrator.ts`.

A Pós é **apenas arquivo de documentação**. Não há tabela, embedding, índice ou
qualquer caminho de leitura em runtime.

### A pergunta da missão

> *Quando uma mãe traz uma situação, o GPT consegue escolher autonomamente entre
> Perfil, BP, BASE2, Pós, combinação ou nenhuma?*

**Não.** O que impede, em ordem de peso:

1. O GPT **nunca vê** BASE2 nem a Pós — não estão no seu contexto.
2. As BPs chegam **já escolhidas** por outro modelo, em 9% dos turnos.
3. O recorte do perfil é decidido pelo **tema do Haiku**, antes do GPT ler.
4. O GPT **não tem ferramenta de busca** — o contexto é montado antes e é fixo.

O GPT não escolhe conhecimento. Ele recebe o que sobrou de três decisões
tomadas por outros modelos.

---

## 7 — Trial D0–D7

Parcialmente auditado. **Provado:** o Trial usa o documento `trial` v5 **dentro
do `experimental.ts`**, no bloco `<jornada>` + `conducaoTrial`, com Core v11,
perfil e histórico. Nisto ele **é** a mesma Ayla — é o caso mais bem resolvido
do sistema.

**Provado:** `podeIniciarConversa` arbitra a iniciativa do dia, e `trial_d0`/
`trial_d3` consomem o slot (decisão de produto de sessão anterior).

**Não provado:** duração real observada, repetição de perguntas, encerramento,
e se a necessidade atual prevalece sobre o roteiro. Classificação:
**INVESTIGADO parcial**.

---

## 8 — Iniciativa espontânea

| | |
|---|---|
| Modelo | **claude-haiku-4-5** (`AYLA_MODEL`) |
| Haiku ainda existe? | **Sim — é o autor da mensagem** |
| Core v11 | **❌ não recebe** |
| Prompt | `SYSTEM_PROMPT` hardcoded, **1.139 chars** |
| `max_tokens` | 300 |
| Perfil | parcial |
| Histórico | parcial |
| Tema aberto / lacunas | ❌ |
| Limite 1/família/dia | ✅ (`podeIniciarConversa`) |
| Arbitragem com Trial | ✅ |
| Arbitragem com conversa ativa | ✅ (30 min) |
| Volume | **173 chamadas / 14 dias** |

Replays de Vanessa e Samara **não executados** — o mecanismo foi lido, não
exercitado.

---

## 9 — Latência

Chamadas de modelo por turno reativo típico: **2 sequenciais** —
`classificar_intencao` (Haiku) → `ayla_experimental` (GPT). A proporção
252 : 221 no período confirma ~1:1.

Quando há Rotina ou repertório, sobe para 3–4.

> ⚠️ `api_calls` não guarda duração. Mediana e p95 **não são calculáveis** com
> os dados atuais. Classificação: **lacuna de observabilidade**, registrada.

---

## 10 — GAP MAP

| Indicador | Estado | Evidência | Gap | Sev. | Causa |
|---|:-:|---|---|:-:|---|
| Uma única Ayla | 🔴 | 12 emissores; 50% do outbound fora do caminho oficial | Core v11 governa 1 de 13 caminhos | Alta | arquitetura |
| GPT como cérebro | 🔴 | anthropic 990 × openai 330; Haiku é o mais chamado | decisões materiais antes do GPT | Alta | arquitetura |
| Core v11 | 🟡 | v11 ativo, 27.994 chars | ativo só no `experimental.ts` | Alta | arquitetura |
| Não começar do zero | 🔴 | `messages` = 1; histórico = 10 linhas em prosa | memória de 10 linhas | Alta | arquitetura |
| Continuidade | 🟡 | `<continuidade>` existe, só p/ resposta curta | replays não executados | Alta | não medido |
| Sujeito correto | 🟢 | `blocoDeFoco` + etiquetagem por criança | — | — | — |
| Conhecimento certo | 🔴 | `ayla_repertorio` 21 × 221 conversas | 91% dos turnos sem BP | Alta | orquestração |
| Conhecimento invisível | 🟡 | BPs vão como material de consulta | não medido em produção | Média | não medido |
| Proativa inteligente | 🔴 | Haiku + prompt de 1.139 chars, sem Core | outra Ayla, outro cérebro | Alta | arquitetura |
| Trial integrado | 🟢 | doc v5 dentro do experimental, com Core e perfil | duração/encerramento não medidos | Baixa | — |
| Artefatos / features | 🔴 | `rotina` = 31% do outbound; sem Core | feature fala sozinha | Alta | arquitetura |
| Plano | 🔴 | doc `plano` **sem versão ativa** | prompt editável que não afeta nada | Média | configuração |
| N1→N2→N3, ajuda antes de investigar, forma, CTA, venting | ⬜ | — | **bancada F1–F20 não rodada** | — | não medido |
| Personalização | 🟡 | perfil recortado por domínio | teto de 320 chars por domínio | Média | orquestração |
| Segurança / isolamento | 🟢 | `membro-escopo.ts`, etiquetagem cruzada | — | — | — |
| Latência | ⬜ | 2 chamadas/turno | **duração não instrumentada** | Média | observabilidade |
| Produção real | 🟢 | 3 SHAs coincidem, árvore limpa | — | — | — |

🟢 verde · 🟡 amarelo · 🔴 vermelho · ⬜ não medido

**Nenhum verde foi dado por existência de código.**

---

## 11 — Arquitetura-alvo (proposta, não implementada)

A menor mudança capaz de produzir a experiência, preservando o que funciona.

### O princípio

> Hoje o código **decide** e o GPT **redige**. A inversão é: o código **prepara
> e executa**, o GPT **decide**.

### O que fica onde

**Código (determinístico, antes da chamada):**
identidade e autorização · isolamento entre irmãos · estado dos artefatos ·
o que já foi enviado · janela e arbitragem de iniciativa · execução de recursos ·
conferência de escrita · portões de publicação.

**Estado (o que o código apura e entrega pronto):**
pergunta pendente · oferta pendente · **artefato pendente** · tema aberto ·
sujeito · estratégias sugeridas e seus resultados · perguntas já feitas ·
correções da família · dia do Trial · recursos já oferecidos.

**GPT (uma chamada, decisão semântica inteira):**
o que a família quis dizer · qual conhecimento buscar · se investiga ou orienta ·
qual é a próxima informação certa · a fala.

**Core v11:** governa a fala de **todos** os caminhos, não de um.

### Cinco movimentos, na ordem

**1. Um só cérebro por turno.** Fundir `classificar_intencao` na chamada do
GPT. Ele já lê a mensagem; classificar separadamente com Haiku é pagar uma
chamada para que um modelo menor decida o que o maior vai poder ver. Elimina
252 chamadas/14 dias **e** o gargalo de conhecimento.

**2. Estado explícito em vez de prosa.** Um bloco `<estado>` montado por código,
com artefato pendente, pergunta pendente, oferta, tema e correções. Não é mais
memória — é a memória que já existe, **entregue de forma legível**. Resolve o
caso Karina estruturalmente: o GPT saberia da rotina órfã.

**3. Conhecimento por demanda.** Dar ao GPT uma ferramenta de busca sobre BPs,
BASE2 e Pós, em vez de pré-selecionar. Ele pede o que precisa; o código serve.
É o que torna a pergunta da seção 6 respondível com "sim".

**4. A espontânea passa a ser a mesma Ayla.** `mensagemEspontanea.ts` deixa de
ter prompt próprio e passa a chamar o mesmo caminho, com Core v11, em modo
"iniciativa". O motor leve continua leve — o que muda é quem escreve.

**5. Features falam pela Ayla.** Rotina, Plano e fim de semana continuam donos
da **decisão** (estado de artefato é do código), mas a **fala** volta pelo
caminho com Core.

### Latência

Movimentos 1 e 2 **reduzem** de 2 chamadas para 1. O movimento 3 acrescenta
latência **só quando o GPT pede** conhecimento — que é a diferença entre carregar
sempre e consultar quando pertinente.

---

## 12 — Ordem recomendada e critérios de homologação

| # | Movimento | Prova exigida |
|---|---|---|
| 0 | Instrumentar duração em `api_calls` | mediana e p95 por feature |
| 1 | Rodar a bancada F1–F20 contra `2678c3f` | baseline F1–F20, incluindo "me mostra" |
| 2 | Executar os 6 replays nominais | para cada: o que a família quis × o que o sistema viu |
| 3 | Bloco `<estado>` | replay Karina: GPT enxerga a rotina órfã |
| 4 | Fundir classificador no GPT | F1–F20 não piora; 1 chamada/turno; BP > 9% |
| 5 | Espontânea sob Core v11 | replays Vanessa e Samara sem repetição |
| 6 | Conhecimento por demanda | GPT escolhe fonte; sem despejo |
| 7 | Features sob Core | Rotina e Plano com forma da agência |

**Nada disto foi implementado.** Esta missão termina aqui, como pedido.

---

## Ressalvas honestas

- Seções **4, 5 e 7** foram lidas, não exercitadas. Os replays nominais e a
  bancada F1–F20 **não rodaram**. Classificação: **INVESTIGADO**.
- Latência: `api_calls` **não guarda duração**. Mediana e p95 não existem hoje.
- As proporções de tráfego são de **14 dias** e podem não representar outros
  períodos.
- Nenhuma família foi contatada. Toda leitura foi sem efeito colateral.
