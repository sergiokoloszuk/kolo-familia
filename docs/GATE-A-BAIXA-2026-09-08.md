# GATE A — BAIXA · PRODUÇÃO PROVADA — SEM REGRESSÃO

**SHA homologado:** `7a384fb` · **Data:** 08/09/2026
**Escopo:** semântica temporal do dado, e o que ela desencadeou.

---

## 1. O que o Gate A provou em produção

Turno real, 08/09/2026 11:27:48 → 11:28:14, família `9c14b56b`, criança Mario.

**Pedido:** `Mario / Rotina visual / Fazer bolo / Guardar na geladeira / Colocar
vela / Cantar parabéns / Comer bolo e brigadeiros`

| # | Pedido | Artefato `9e1b69d4` | Imagem |
|---|---|---|---|
| 1 | Fazer bolo | Fazer o bolo | ✅ |
| 2 | Guardar na geladeira | Guardar na geladeira | ✅ |
| 3 | Colocar vela | Colocar a vela | ✅ |
| 4 | Cantar parabéns | Cantar parabéns | ✅ |
| 5 | Comer bolo e brigadeiros | Comer bolo e brigadeiros | ✅ |

5 pedidas · 5 gravadas · mesma ordem · tema `Festa` · `pronto` · 5/5 imagens ·
link entregue · **1 rotina** · alarme silencioso (`motivo=null`).

---

## 2. As invariantes conquistadas — regressões obrigatórias dos gates seguintes

| Invariante | Onde está presa |
|---|---|
| **barco = 0** · episódio histórico não vira etapa | `transicoes-temporais.test.ts` |
| **Sudoku = 0** · idem, e o ponto difícil não sai de `transicoes[0]` | `transicoes-temporais.test.ts` |
| sequência explícita preservada, inteira e na ordem | `rotina-anterior-nao-contamina.test.ts` |
| estratégia reutilizável **sem** transportar o contexto antigo | `transicoes-temporais.test.ts` |
| legado sem data e sem tipo é tratado conservadoramente | `transicoes-temporais.test.ts` · `perfil-temporal.test.ts` |
| informação antiga chega **marcada**; recente, limpa | `perfil-temporal.test.ts` |
| pedido novo explícito vence pendência antiga | `rotina-anterior-nao-contamina.test.ts` |
| pendência de um filho **nunca** governa conversa sobre o outro | `rotina-pendencia.test.ts` |
| pendência vencida não governa conversa | `rotina-pendencia.test.ts` |
| `gerando` / `pronto` / `erro` não são pendência | `rotina-pendencia.test.ts` |
| "não há" ≠ "não consegui saber" | `rotina-pendencia.test.ts` |
| tema nunca é o nome do artefato | `rotina-anterior-nao-contamina.test.ts` |
| duas sugestões de tema + outro + **sem tema** | `rotina-anterior-nao-contamina.test.ts` |
| pedido telegráfico roteia (piso determinístico) | `rotina-portao.test.ts` (frases reais) |
| falar *sobre* rotina não abre o fluxo | `rotina-portao.test.ts` |
| nenhum sítio lê a rotina anterior sem a moldura | `rotina-anterior-nao-contamina.test.ts` |
| os dois destinos do histórico usam a mesma poda | `rotina-anterior-nao-contamina.test.ts` |
| todo desfecho deixa rastro — nenhum `null` mudo | `rotina-rastro.test.ts` |
| o rastro não vaza conteúdo de família | `rotina-rastro.test.ts` |

**Suíte no fechamento:** 3.551 testes · `tsc --noEmit` limpo · `build` OK.

---

## 3. Observabilidade que passa a existir

Duas linhas persistidas em `eventos_app`, sem tabela nova:

- **`rotina_portao`** — por turno plausivelmente sobre o artefato: `intent`,
  `pedidoExplicito`, o que a regex viu, o `ato`, e se abriu. É o que revela
  quando o portão **fecha**, que antes era silêncio.
- **`rotina_turno`** — por turno de `conduzirRotina`: prontidão (desfecho,
  motivo, tamanho, visual), ação, **saída e motivo de cada `return null`**,
  rotinas criadas ou reutilizadas, tema e a **fonte** dele, geração, status,
  leituras de perfil, chamadas de modelo e **tempo por etapa**. Flush em
  `finally` — nenhuma das nove saídas escapa.

Alarme próprio: quando a família ditou a sequência e nasce **mais de uma
rotina**, o rastro sobe para `warn` com o motivo. Ele disparou sozinho na quinta
porta e nomeou o defeito antes de a investigação começar.

---

## 4. As seis portas do mesmo defeito

| | Porta | SHA |
|---|---|---|
| 1ª | `categorias_extras.transicoes` — episódio × padrão sem data | `95941d9` |
| 2ª | rotina anterior no prompt do condutor ("use como base") | `5f09818` |
| 3ª | conversa recente no prompt | `84ea311` |
| 4ª | rotina anterior **no gerador** | `80620da` |
| 5ª | conversa recente **no gerador** | `b69ac3a` |
| 6ª | **`pontoDificil` saindo de `transicoes[0]` cru** | `7a384fb` |

⚠️ **A lição que custou seis tentativas.** As cinco primeiras eram do **texto**.
A que resolveu era do **dado**: `pontoDificil = transicoesConhecidas[0]?.momento`
virava a instrução literal *"quebre esse momento em passos menores, com uma
etapa de preparação antes dele"*, e por isso toda rotina inventada começava com
"Respirar fundo". O sinal esteve visível três vezes antes de ser lido.

E o padrão de fundo, repetido: **criar o dono único não basta — é preciso provar
que nenhum consumidor lê o dado cru.** Hoje um teste varre o arquivo e falha se
algum voltar a ler.

---

## 5. Ganhos colaterais medidos

- leituras de `perfil_vivo_membro` por turno: **3 → 1**; contexto **879 ms → 432 ms**;
- interesses: a Manu tinha 4 registrados e a Ayla via **1**; o Mario tinha 3 e
  via **zero**. Causa: `carregarInteresses` procurava `como_e` dentro de
  `categorias_extras`, e `como_e` é **coluna**;
- sugestões de tema: de 1 (ou nenhuma) para **duas, numeradas, com "sem tema"**.

---

## 6. Pendências abertas por este gate

Registradas em [PENDENCIAS.md](PENDENCIAS.md), **fora do escopo do Gate B**:

| ID | Assunto | P |
|---|---|---|
| PEND-173 | janela de 60 dias ainda é heurística sobre base de 4 meses | P3 |
| PEND-174 | escritores de `categorias_extras` sem merge (onboarding) | P1 |
| PEND-175 | `aguardando` não expira | P2 |
| PEND-176 | 2 rotinas em `erro` nunca investigadas, e nada alerta | P2 |
| PEND-177 | artefatos reais incorretos ainda visíveis às crianças | P3 |
| PEND-178 | **o decisor não reconhece pedido telegráfico** (5 turnos medidos) | P1 |
| PEND-179 | **Core §16 nega capacidades reais** — a mãe corrigiu a Ayla | P1 |
| PEND-180 | linguagem dos cartões ignora a compreensão da criança — **benchmark do Gate F** | P2 |

---

## 7. Débito explícito: latência

O turno homologado levou **26 s**. Estão explicados **8,05 s** (interior de
`conduzirRotina`: condutor 5,2 s · prontidão 2,4 s · contexto 0,43 s). **~18 s
seguem sem medição** — recebimento do webhook, debounce de 10 s, orquestrador,
decisor, persistência e envio.

Fechar esse orçamento é a etapa imediatamente anterior ao Gate B, e a latência
passa a ser regressão cumulativa.

---

**Veredito: PASSOU.**
