# data/import

Pasta para arquivos de import temporários (XLSX, CSV) — conteúdo curado
que vai pro DB via scripts em `apps/web/scripts/`.

Arquivos `.xlsx`/`.xls`/`.csv` aqui dentro são **ignorados pelo git** —
não vão pro repositório público. Coloque o arquivo, rode o importer
correspondente e o arquivo permanece local.

## Arquivos esperados

- `boas-praticas-karina.xlsx` (ou nome semelhante) — 349 BPs curadas
  pela fundadora, importadas via
  `apps/web/scripts/import-boas-praticas.mjs`.
