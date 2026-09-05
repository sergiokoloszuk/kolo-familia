# Bancada A/B — a Base da Pós melhora o raciocínio da Ayla?

**05/09/2026 · 36 execuções · 0 alarmes · VEREDITO: não ligar em produção.**

Branch de bancada. **Nada aqui vai para a `main`** e nada foi ligado: a flag
`BIA_PROMPT_ENABLED` continua desligada, o Core v10 intacto e
`experimental.ts` não foi tocado.

## O que foi medido

- **A** = produção no commit `4fefcbb` (Core v10 + contexto + Boas Práticas)
- **B** = exatamente A **+ o bloco `<conhecimento_de_apoio>`** da BIA

Única variável: o bloco. `rodar.mjs` intercepta `fetch`, libera **só** o
endpoint da OpenAI, injeta o bloco apenas no braço B, alterna a ordem A/B a
cada execução e caça cópia literal em janelas de 12 palavras. A chave de
service-role é apagada do ambiente antes de qualquer import — **a bancada não
consegue escrever em lugar nenhum**. As famílias são sintéticas, em memória.

## Resultado

| | |
|---|---|
| jargão clínico vazando | **0 em 36** |
| menção à fonte · cópia literal · resposta > 900 ch | **0** |
| conflito BIA × Boa Prática | **0** |
| custo | **+490 tokens/turno** (~+5,6%) |

**As proteções funcionaram perfeitamente.** O ganho é que não veio:

| caso | veredito |
|---|---|
| Mario · socialização (18a) | **SEM GANHO** — B ficou *pior* no registro adulto (3/6 → 1/6) |
| Mario · limite/frustração | **SEM GANHO**, e sem dano |
| Manu · mapa (6a) | **GANHO PARCIAL** — reenquadra objetivo/pré-requisito **4/6 (B) × 0/6 (A)** |

## Por que o ganho foi magro

A ingestão produziu **14 chunks temáticos gigantes**, todos
`tipo_conhecimento: conceito` — e as COTAS dão no máximo **2** para esse tipo.
**61% do texto é descartado** no corte de 600 ch (13 dos 14 estouram). E os
campos de que o mecanismo vive ficaram **todos vazios**:
`perguntas_investigativas`, `hipoteses`, `estrategias`, `o_que_evitar`,
`habilidades_relacionadas`, `muda_conduta` — **0 de 14**.

A bancada mediu dois fragmentos truncados de prosa, não conhecimento
estruturado. **Não mediu a capacidade da BIA.**

## E o documento

`resumo-geral-pos-neurodesenvolvimento.md` é um **compêndio clínico-acadêmico**
— critérios do DSM-5, instrumentos de rastreio, etiologia. A seção de vida
adulta trata de **emprego e adaptação de trabalho**, não de como um jovem
ansioso aprende a iniciar contato social. Não há nada sobre tolerância à
frustração. Para os três casos testados, **não tem o conhecimento operacional
que faltava**.

## Arquivos

- `rodar.mjs` — a bancada
- `resultados.json` — evidência enxuta (texto, métrica, contexto, seleção). Os
  `system` completos das 36 chamadas foram removidos: 5MB de repetição,
  reconstruíveis a partir de `coreHash` + corpus + este script.
- `../../data/bia/corpus-pos-2026-09.json` — os 14 chunks ingeridos
- `../bia/` — chunker (ajustado para ler Markdown), importador, leitor de docx

O `.md` de origem **não está no repositório** — é material da Karina. O corpus
versionado torna a bancada reproduzível sem ele.
