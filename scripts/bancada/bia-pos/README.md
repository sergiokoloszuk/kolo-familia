# Bancada — re-chunking operacional da base da pós

**10/09/2026 · 15 chunks piloto · 5 casos · recuperação OFFLINE.**

Nada aqui foi importado, ligado ou publicado. `bia_chunks` continua com **0
linhas** em produção, `BIA_PROMPT_ENABLED` continua desligada, `lib/bia` não foi
tocada e nenhum arquivo de produção importa esta pasta.

## O que roda

`rodar.mts` carrega `chunks-piloto.json` e chama as funções **reais** de
julgamento — `filtrarDuro`, `pontuar`, `selecionar` (`lib/bia/pontuacao.ts`) e
`aplicarCotas`, `aplicarOrcamento` (`lib/bia/bloco.ts`). O `retriever.ts` de I/O
**não** é usado, de propósito: ele iria ao Postgres, e a decisão que interessa
medir é pura.

```
cd apps/web && npx tsx ../../scripts/bancada/bia-pos/rodar.mts
```

## A regra de chunking que a arquitetura impõe

Descoberta lendo `bloco.ts` antes de escrever o primeiro chunk:

1. **Só `texto_original` chega ao modelo.** `montarBlocoBia` renderiza
   exclusivamente esse campo. `perguntas_investigativas`, `hipoteses`,
   `estrategias`, `o_que_evitar` e `quando_encaminhar` são gravados e **nunca
   renderizados**. Portanto: **o que precisa chegar à Ayla tem de estar dentro do
   `texto_original`** — os arrays servem para curadoria, revisão e futuro.
2. **Teto de 600 caracteres por chunk** (`MAX_CHARS_POR_CHUNK`), 2.000 no total,
   **máximo 5 chunks**. Texto acima de 600 é truncado com "…".
3. **Tipo sem cota não entra no prompt, mesmo com score alto.** As cotas são:
   1 segurança · 1 interpretação · 1 pergunta · 2 regras · 2 prático
   (`estrategia`|`conceito`). `principio_de_ouro`, `explicacao_para_familia`,
   `fundamento`, `ferramenta`, `brincadeira`, `atividade` e `cautela_cientifica`
   **são descartados sempre**.
4. **`nucleo` vale +50** — mais que qualquer outro sinal. Um chunto cujo núcleo
   não bate com o domínio do turno depende de situação e texto para sobreviver.

Foi exatamente isso que a ingestão de 05/09 violou: 14 chunks gigantes, todos
`conceito` (peso 2), 61% truncados. Não mediu a BIA; mediu uma ingestão quebrada.

## Os três achados da bancada

**1 · O sinal de risco não reconhece mudança abrupta.**
No caso "crise súbita", `piloto-11` ("procurar dor antes de comportamento") — o
único chunk que responde ao caso — leva **−40** ("encaminhamento sem sinal de
risco no contexto") e cai para 6º, sendo descartado pela cota. Entra no lugar
`piloto-04`, hierarquia de dicas de imitação, irrelevante ali.
Causa: `contextoTemSinalDeRisco` (pontuacao.ts:244) não tem padrão para *"começou
do nada"*, *"nunca foi assim"*, *"de repente"*, *"mudou de uma hora para outra"*.

**2 · O domínio decide o resultado, e o turno tem mais de um.**
O turno real do Mario teve `tema: ["comunicacao","emocional"]`. Com
`dominio: "comunicacao"` o topo é apraxia e escada pré-verbal — inútil ali. Com
`dominio: "emocional"` o topo é exatamente "dispersão não é preguiça" (126) e "na
crise, a calma do adulto" (100). **`ContextoBia.dominio` aceita UM domínio.**

**3 · Metade do raciocínio da pós é cross-domain, e a pontuação é single-domain.**
"Dispersão no foco → investigue o sensorial" é uma regra que vive em dois
núcleos. `nucleos_relacionados` existe no schema (0071) e **não está em
`ChunkParaPontuar` nem no `SELECT_CHUNK` do retriever** — é gravado e nunca lido.
O mesmo vale para `habilidades_relacionadas`.

## Arquivos

- `chunks-piloto.json` — 15 chunks, cada um com `_procedencia_nota` (A / B /
  sobreposição com o Core v11) e `_criterio` (qual das cinco perguntas ele muda).
  Os dois campos com `_` são da bancada; não existem no schema.
- `rodar.mts` — a bancada.
