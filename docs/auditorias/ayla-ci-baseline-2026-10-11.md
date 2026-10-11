# Baseline da CI — 11/10/2026

Escopo isolado: corrigir asserções de testes preexistentes para que a CI volte
a testar o comportamento atual, sem alteração funcional da Ayla e sem tocar no
PR de instrumentação G0 (#145).

Base: `origin/main`/HEAD `25e8891daf1e0d5bd881512e6f128742fdcd0184`.
O mesmo trio de falhas ocorre no PR G0 e nesta base; no PR, 52 dos 55 casos dos
três arquivos passam. A suíte completa do PR teve 4.221 aprovados, 7 pulados e
3 falhas; a CI não executou o build após a etapa de unit tests vermelha.

| Teste | Esperado | Observado | Causa a verificar |
| --- | --- | --- | --- |
| `experimental-onboarding.test.ts` | `sono: Acorda 3x` | mesma informação mais `[informação antiga: há ~2 meses]` | asserção anterior ao carimbo temporal do perfil |
| `memoria-pertinente.test.ts` | linha inteira <= 160 caracteres | 186 caracteres | teto de conteúdo medido junto ao carimbo temporal |
| `provider.test.ts` | erro de rede contém `anthropic` | `fetch failed` | teste chama rede externa em vez de isolá-la |

Portões atuais: baseline reproduzido; causa raiz provável nos testes, ainda
sem veredito de implementação. PEND-214 já cobre o provider; os outros dois
precisam de ficha própria. Não há prova de produção nova neste documento.

## Depois da correção isolada

Branch `codex/ayla-ci-baseline`, só três testes e documentação. O código
funcional não mudou. `experimental-onboarding` e `memoria-pertinente` medem o
conteúdo antes do sufixo temporal; `perfil-temporal` continua cobrindo o
carimbo. `provider` recebe uma resposta 401 de `fetch` falso, sem rede real, e
confere cabeçalho e erro normalizado. A PEND-214 foi atualizada; a PEND-241
registra as duas asserções temporais.

Provas locais de 11/10/2026:

- quatro arquivos relacionados: 65/65 testes passaram;
- suíte completa da base: 4.207 aprovados, 7 pulados, zero falhas;
- índice de pendências: 5/5 testes e `--check` passaram;
- `next typegen` e `tsc --noEmit` passaram;
- lint dos três arquivos: zero erros, um aviso preexistente (`img` não usada
  em `provider.test.ts`);
- `next build --webpack` passou com as variáveis **fictícias** do workflow CI
  e `node --use-system-ca`. Sem essa CA, o download de fontes falhou; sem as
  variáveis fictícias, o prerender exigiu URL/chave Supabase. Nenhum dos dois
  era falha de código desta branch.
- `git -c core.whitespace=cr-at-eol diff --check` passou. O `diff --check`
  padrão sinaliza o CRLF preexistente de `PENDENCIAS.md` nas linhas alteradas.

O commit `e665b9180aa56efa8b4b30d3cff92ef075e72049` foi enviado à branch;
o [PR #146](https://github.com/sergiokoloszuk/kolo-familia/pull/146) foi
aberto em rascunho. A [CI #976](https://github.com/sergiokoloszuk/kolo-familia/actions/runs/38167629822)
passou em 11/10/2026 às 16h26 de São Paulo, incluindo testes e build. Este
adendo documental exige sua própria CI após o push; não atribuir-lhe a prova
do commit anterior.

Ainda falta: revisão, reconciliação com os outros branches de pendências,
merge autorizado e SHA servido conferido. O PR G0 #145 permanece separado e
vermelho no seu SHA atual. Não houve merge, deploy, alteração de Core/acervo,
smoke no canal real nem teste com famílias.
