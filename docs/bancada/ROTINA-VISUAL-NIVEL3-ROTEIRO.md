# Rotina Visual — Nível 3, roteiro operacional

**Não executado.** Escrito em 07/09/2026, para quando existir um número de
WhatsApp QA controlado pela equipe.

O que os níveis anteriores já fecharam, e que **não** se reabre aqui:

- **Nível 1** (`scripts/bancada/rotina-nivel1/`) — modelo real, banco em
  memória: decisão, tema, memória que não vira etapa, geração única, posse do
  turno, Plano estruturalmente inalcançável.
- **Nível 2** ([rotina-visual-nivel2-2026-09-07.md](rotina-visual-nivel2-2026-09-07.md))
  — pipeline real em produção: `aguardando → gerando → pronto`, 4 cards,
  imagens em bucket privado, URLs assinadas, magic link, página.

**O Nível 3 prova uma coisa só: o canal.** Webhook, inbound, outbound, e a
experiência no aparelho. Tudo o mais já está provado; repetir aqui é gastar
número e tempo com o que já se sabe.

---

## Pré-requisito

Um número de WhatsApp **ativo, novo, da equipe**, que não esteja em nenhuma
conta. Ver [QA-CONTA-DEDICADA.md](../QA-CONTA-DEDICADA.md), trilha
"QA comportamental": signup pelo caminho real, onboarding padrão, criança
fictícia `Teste QA`, e `ayla_preferences.desativada = false` **durante** a
bateria.

⚠️ **Checklist de roteamento antes da primeira mensagem.** `whatsapp_e164` não
tem `UNIQUE`, e em 07/09/2026 a base já tinha **um número duplicado**. Provar
que o número QA devolve **exatamente uma** família, e que é a QA. Falhar aqui
significa conversar com a conta de outra pessoa.

---

## Preparação do perfil QA — a memória histórica

Antes do Caso Manu, semear no perfil da criança QA uma transição **sem relação
nenhuma** com o pedido que será feito — o equivalente ao "passeio de barco" do
caso real. Em `perfil_vivo_membro.categorias_extras`, chave `transicoes`:

```json
{"momento": "ida ao circo",
 "funcionou": null,
 "estrategia": "rotina visual para antecipar os passos",
 "merece_plano": false}
```

Escolher um momento que **não** apareça no pedido do dia. A `estrategia`
mencionando "rotina visual" é intencional: é ela que puxava o fato para dentro
do artefato no caso real.

E semear também um interesse, que será o tema oferecido:
`preferencias.temas = ["dinossauros"]`.

---

## CASO MANU — pedido explícito, memória que não pode virar etapa

Um turno por vez, **esperando a resposta completa** antes do próximo. Entre
turnos, registrar o estado da rotina.

| # | Mensagem do aparelho QA | O que precisa acontecer |
|---|---|---|
| 1 | `Hoje teremos Brincadeira, Banho, Almoço, Shopping. Monta a rotina visual` | a Ayla monta a sequência e **pede o tema** |
| 2 | `Pode ser` | o aceite vira o tema oferecido, e a geração começa |
| 3 | — | a entrega chega com o link |

### Provas do Caso Manu

- [ ] **Exatamente uma rotina** criada. `select count(*) from rotinas where family_account_id = '<qa>'`
- [ ] **As etapas são só as quatro pedidas.** Nenhuma linha de `rotina_tarefas` menciona circo — é o gate central. Se aparecer, **parar e reportar**.
- [ ] A Ayla **sugeriu** o tema (`dinossauros`) em vez de exigir que a família inventasse um.
- [ ] O `Pode ser` foi entendido **por posse do turno**, não por texto. A mensagem anterior da Ayla saiu com `tipo = 'rotina_conversa'`.
- [ ] `rotinas.tema` = exatamente o tema oferecido.
- [ ] **Exatamente uma geração**: um `artefato_reconciliado` ou um `gerando` só, e `cards_status` nunca volta a `aguardando`.
- [ ] **Nenhum Plano Estratégico** em nenhum dos turnos. `select count(*) from planos where family_account_id = '<qa>'` = 0.
- [ ] Nenhuma fala afirma "pronto" enquanto `cards_status` não for `pronto`.
- [ ] O link chegou **no aparelho**, e abre.
- [ ] A página mostra a rotina certa, os quatro passos e as imagens carregando.
- [ ] Uma resposta por turno — zero duplicidade.

---

## CASO MARIO — aceite curto retomando ação pendente

| # | Mensagem | O que precisa acontecer |
|---|---|---|
| 1 | `Mario precisa ir ao médico depois da avó. Queria imagens pra mostrar a sequência pra ele` | a Ayla propõe a sequência e pergunta se está certa |
| 2 | `Sim` | **retoma a ação** — não pede o pedido de novo |
| 3 | `Pode ser` (ou o tema) | tema aplicado, geração começa |

### Provas do Caso Mario

- [ ] O `Sim` **não** produziu "não entendi", nem uma pergunta repetindo o pedido.
- [ ] A sequência foi persistida em `rotina_tarefas` conforme confirmada.
- [ ] **Exatamente uma geração** no fluxo inteiro.
- [ ] Link recebido, página abre, cards corretos.
- [ ] Nenhum Plano no meio.

---

## CONTROLES NEGATIVOS — sem ação pendente

Fora de qualquer conversa de rotina (depois de a Ayla ter dado um desfecho),
mandar, um por vez: `sim` · `pode` · `ok` · `isso`.

- [ ] **Nenhuma Rotina Visual criada** por nenhum deles.
- [ ] Nenhum tema aplicado a rotina nenhuma.
- [ ] Nenhuma geração disparada.
- [ ] A Ayla responde conversacionalmente, sem tomar o turno para uma feature.

---

## GATES — só é homologado com os dez

1. exatamente **um dono por lote** (mensagens próximas viram um turno só);
2. exatamente **uma rotina por pedido**;
3. exatamente **uma geração**;
4. **zero** memória histórica virando etapa atual;
5. **zero** perda de continuidade em turno curto;
6. **zero** Plano sequestrando turno da Rotina;
7. **zero** promessa de `pronto` antes do estado real;
8. link **recebido no WhatsApp**;
9. página abrindo, cards e imagens corretos;
10. **zero** interação com famílias reais.

Portão que não puder ser comprovado vira **NÃO VALIDADO** com o motivo e uma
pendência com ID — não vira portão aprovado por omissão (§21).

---

## Como medir, sem depender de impressão

Durante a bateria, ler (nunca escrever) a cada turno:

```sql
-- estado do artefato
select id, nome, tema, cards_status, mascote_url, updated_at
from rotinas where family_account_id = '<qa>' order by created_at desc;

-- as etapas, que é onde a memória indevida apareceria
select ordem, texto, nome_tematico, imagem_url is not null as tem_imagem
from rotina_tarefas where rotina_id = '<rotina>' order by ordem;

-- quem respondeu, e com que tipo (o tipo decide a posse do turno seguinte)
select created_at, direcao, tipo, left(texto, 80)
from ayla_messages where family_account_id = '<qa>' order by created_at;

-- um dono por lote: mensagens do mesmo lote compartilham processada_em
select created_at, processada_em, left(texto, 40)
from ayla_messages where family_account_id = '<qa>' and direcao = 'inbound'
order by created_at;

-- Plano não pode nascer
select id, titulo, tema, origem, created_at
from planos where family_account_id = '<qa>';

-- geração e falhas
select created_at, kind, severity, message
from eventos_app where family_account_id = '<qa>' order by created_at;
```

`processada_em` é o que separa **um lote com dois balões** de **dois turnos**:
mesmo valor = mesmo dono. Foi essa leitura que refutou a hipótese de rajada
concorrente em 07/09 (PEND-170).

---

## Encerramento

- [ ] Rotinas, planos e artefatos da bateria apagados.
- [ ] Objetos do storage sob o prefixo da família QA apagados **antes** de
      qualquer delete em cascata.
- [ ] Contagens conferidas contra o snapshot inicial.
- [ ] Se a conta QA for mantida entre baterias:
      `ayla_preferences.desativada = true` **entre** elas, senão ela entra em
      cron de proativa e em métrica de produto.
- [ ] Pendências abertas com ID para todo gate não comprovado.

---

## O que continua fora de escopo

- **PEND-171** — a rotina real `ec61feee` da Manu, em `aguardando` com etapas de
  barco. Não tocar sem autorização explícita.
- **PEND-169** — o Plano ainda pode nascer por `Boolean(tema)`, sem
  `pedidoExplicito`. Se um Plano aparecer numa bateria de rotina, é aqui que a
  investigação começa.
- **PEND-170** — repetição de correção entre turnos consecutivos. Não é
  concorrência; medir frequência antes de qualquer mudança funcional.
