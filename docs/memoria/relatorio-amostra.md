# Relatório final da amostra controlada — TEMPLATE

Preencher ao encerrar. Protocolo: [`amostra-controlada.md`](amostra-controlada.md)

**Regra que atravessa o documento: toda taxa vem com numerador e denominador.**
`13,2%` não é resultado. `7 de 53 (13,2%)` é.

## 1. Identificação

| Campo | Valor |
|---|---|
| Amostra | `AC-___` |
| Versão do protocolo | |
| Período | de ____-__-__ a ____-__-__ |
| Dias de coleta efetiva | |
| Commit | |
| Versão do extrator | |
| Migrações aplicadas | |

## 2. Participantes

| ID | Perfil | Canais | Membros | Dias ativos | Fatos |
|---|---|---|---|---|---|
| A1 | | | | | |
| A2 | | | | | |
| A3 | | | | | |
| A4 | | | | | |

Retiradas: ____ · Exclusões solicitadas: ____

## 3. Volume

| | n | % |
|---|---|---|
| fatos totais | | 100% |
| ativos | | |
| quarentena | | |
| rejeitados (não gravados) | | |
| duplicatas | | |
| falhas de persistência | | |

Por canal: WhatsApp ___ · Web manual ___ · Web automático ___ · Diário ___

## 4. Hipóteses

| # | Hipótese | Resultado | Evidência |
|---|---|---|---|
| H1 | PostgREST devolve `[]` em conflito | ( ) confirmada ( ) refutada | |
| H2 | Barreira de sujeito sobrevive à língua real | | |
| H3 | Quarentena filtra, não bloqueia | | |
| H4 | Granularidade sustenta a Fase 7 | | |
| H5 | `ctx.membros[0]` não gera quarentena em massa | | |
| H6 | Extração é fiel e atômica | | |

## 5. Métricas contra os limiares

| Métrica | n / N | % | Faixa |
|---|---|---|---|
| fato na pessoa errada | / | | |
| quarentena / ativos | / | | |
| `conceito = dominio` | / | | |
| sem proveniência | / | | |
| duplicação técnica | / | | |
| afirmação não atômica | / | | |
| afirmação infiel | / | | |
| evidência não recuperável | / | | |

Se algum limiar foi **alterado** durante a amostra, registre qual, por quê e
quando — limiar mudado depois de ver o resultado não é limiar.

## 6. Auditoria humana

| | |
|---|---|
| Fatos ativos revisados quanto a pessoa | ___ de ___ (meta: 100%) |
| Fatos revisados quanto a fidelidade / atomicidade / conceito | ___ (meta: ≥ 50) |

**Fidelidade:** fiel ___ · contraditório ___ · inventado ___ · generalização
indevida ___ · perdeu condição ___ · insuficiente ___

**Atomicidade:** atômico ___ · parcial ___ · composto ___ · múltiplo sujeito ___
· mistura evento e interpretação ___

**Conceito:** correto ___ · genérico aceitável ___ · errado ___ · domínio errado
___ · `conceito = dominio` ___ · taxonomia insuficiente ___

**Temporalidade:** correta ___ · expressão preservada ___ · data inventada ___ ·
imprecisa tratada como precisa ___ · perdida ___

## 7. Concordância entre revisores

Fatos revisados às cegas: ___

| Dimensão | Divergências | de |
|---|---|---|
| Fidelidade | | |
| Atomicidade | | |
| Pessoa | | |
| Conceito | | |
| Domínio | | |

Divergência acima de ~1 em 4 → **as taxas da seção 6 não são confiáveis.** Diga
isso aqui, com todas as letras, em vez de apresentar os números como se fossem.

## 8. Quarentena

| | n |
|---|---|
| itens em quarentena | |
| revisados | |
| liberados | |
| descartados | |
| expirados | |
| que pediriam reatribuição (bloqueado) | |

Revisões realizadas em: ____-__-__ e ____-__-__ (meta: ≥ 2)

Motivos mais frequentes:

## 9. Incidentes e pausas

| Data | Tipo | Gatilho | Ação | Retomada |
|---|---|---|---|---|

Dias sem auditoria: ___ · O acervo acumulado foi auditado antes de retomar? ( )

## 10. Limites desta amostra

Preencher com honestidade — esta seção é a que impede a conclusão errada.

- **Tamanho:** ___ fatos. Um erro que ocorra em 1 a cada ___ provavelmente não
  apareceria.
- **Composição:** 4 famílias escolhidas por perfil, não sorteadas. Não
  representam a base.
- **Duração:** ___ dias. Nada sazonal, nada longitudinal — nenhuma mudança real
  ao longo do tempo foi observável.
- **Riscos não observáveis nesta amostra:** correferência real · sujeito
  implícito sem marcador · foco errado na origem do orquestrador · atomicidade
  em relatos longos · comportamento sob concorrência.

> **A amostra não autoriza concluir que um erro não existe.**

## 11. Decisões arquiteturais que a amostra sustenta

Só o que os números sustentam. Se `conceito = dominio` ficou acima de 50%, a
Fase 7 não é viável com a taxonomia atual — e isso é uma decisão, não uma
observação.

## 12. Problemas que exigem correção

| # | Problema | Evidência | Gravidade | Bloqueia o Retrato? |
|---|---|---|---|---|

## 13. Classificação final

- [ ] **amostra inválida** — a execução não seguiu o protocolo
- [ ] **amostra inconclusiva** — volume ou concordância insuficientes
- [ ] **corrigir e repetir** — defeito encontrado; corrigir, nova versão, nova amostra
- [ ] **apta para continuar coleta controlada** — sem defeito, volume insuficiente
- [ ] **apta para Retrato em shadow sobre a amostra**

Autorizado por: ____________ em ____-__-__

## 14. Critérios de encerramento

| # | Critério | ( ) |
|---|---|---|
| 1 | contrato PostgREST verificado | |
| 2 | zero fato em pessoa errada, na revisão de 100% dos ativos | |
| 3 | quarentena revisada ≥ 2×, abaixo de 40% e estável | |
| 4 | ≥ 50 fatos revisados quanto a fidelidade, atomicidade e conceito | |
| 5 | evidência recuperável em 100% | |
| 6 | decisão consciente sobre `conceito = dominio` | |
| 7 | nenhuma falha de proveniência | |
| 8 | nenhum vazamento em logs | |
| 9 | relatório com numeradores e denominadores | |
| 10 | divergências da dupla auditoria registradas | |

Os dez atendidos autorizam **exatamente** isto, e nada além:

> O sistema demonstrou qualidade suficiente, nas condições e no tamanho desta
> amostra, para iniciar um Retrato em shadow sobre o mesmo acervo.

**Nunca autorizar leitura pela Ayla nesta fase.**
