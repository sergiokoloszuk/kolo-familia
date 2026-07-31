# Registro da execução — amostra controlada

Preencher **antes** de ligar a flag e manter atualizado. Sem este registro, o
relatório final não é interpretável: taxas sem contexto de versão, período e
participantes não significam nada.

Protocolo: [`amostra-controlada.md`](amostra-controlada.md)

## Identificação

| Campo | Valor |
|---|---|
| Identificador da amostra | `AC-001` |
| Versão do protocolo | 1.0 |
| Data prevista de início | |
| Data real de início (flag ligada) | |
| Data de encerramento | |

## Configuração congelada

| Campo | Valor |
|---|---|
| Commit da aplicação | |
| Versão do extrator | `kv-blob-v2` |
| Migrações aplicadas | 0071 ( ) · 0072 ( ) · 0073 ( ) |
| Data/hora de cada aplicação | 0071: · 0072: · 0073: |
| Feature flag | `PERFIL_FATOS_SHADOW_WRITE` |

Qualquer mudança em extrator, foco, sujeito, taxonomia, idempotência ou formato
do fato **encerra esta amostra e abre outra**. Ver protocolo §9.

## Responsáveis

| Papel | Pessoa |
|---|---|
| Responsável técnico | |
| Responsável pela auditoria | |
| Segundo revisor (cego) | |
| Responsável pelo consentimento | |

O técnico e o auditor **não devem ser a mesma pessoa**.

## Decisão sobre a quarentena

Protocolo §13 exige decisão explícita antes de ligar:

- [ ] script operacional controlado (bloco 5 do SQL) — *recomendado*
- [ ] implementação mínima de serviço

Decidido por: ____________ em ____-__-__
Justificativa:

## Participantes

Sem nomes reais. Ver [`ficha-selecao-familia.md`](ficha-selecao-familia.md).

| ID | Perfil | Canais | Membros | Entrada | Saída | Retirada? |
|---|---|---|---|---|---|---|
| A1 | dois ou mais membros | | | | | |
| A2 | WhatsApp intenso | | | | | |
| A3 | Web + Diário | | | | | |
| A4 | adolescente/adulto | | | | | |

## Estado

Marcar o atual e registrar cada transição.

- [ ] planejada
- [ ] preparada — migrações aplicadas, flag desligada
- [ ] interna — Fase 1
- [ ] famílias reais — Fase 2
- [ ] pausada
- [ ] interrompida
- [ ] encerrada

| Data | De → Para | Motivo |
|---|---|---|
| | | |

## Motivo de pausa ou interrupção

| Data | Tipo (pausa / interrupção) | Gatilho | Ação tomada | Retomada em |
|---|---|---|---|---|
| | | | | |

## Hipótese H1 — contrato do PostgREST

| Campo | Valor |
|---|---|
| Verificado? | ( ) sim ( ) não ( ) divergente |
| Data | |
| Por quem | |
| 1ª chamada — evento / linhas | |
| 2ª chamada — evento / linhas | |
| `CONTRATO_POSTGREST.verificado` atualizado no código? | ( ) sim ( ) não |

## Dias sem auditoria

| Data | Motivo | Acervo auditado depois? |
|---|---|---|

Três dias consecutivos → **pausar** (protocolo §10).

## Decisão final

- [ ] amostra inválida
- [ ] amostra inconclusiva
- [ ] corrigir e repetir
- [ ] apta para continuar coleta controlada
- [ ] apta para Retrato em shadow sobre a amostra

Decidido por: ____________ em ____-__-__
Relatório: [`relatorio-amostra.md`](relatorio-amostra.md)
