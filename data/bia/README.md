# Corpus da BIA

`corpus-volume-1-2026-07-30.json` — os 1.120 chunks gerados do
`BIA_Kolo_Familia_Compilado_Final.docx` pelo chunker
(`scripts/bia/importar-bia.mjs`).

**Gerado, não editado.** Ninguém mexe neste arquivo à mão: ele é reproduzível a
partir do .docx, e uma edição manual sumiria na próxima geração. Para mudar o
conteúdo, muda-se o documento; para mudar a classificação, muda-se o chunker.

```bash
node scripts/bia/importar-bia.mjs \
  --arquivo "caminho/BIA_Kolo_Familia_Compilado_Final.docx" \
  --versao 2026-07-30 --json data/bia/corpus-volume-1-2026-07-30.json
```

Está versionado porque o .docx de origem não está no repositório: sem ele, a
auditoria (`scripts/bia/auditar-revisao.mjs`) e as bancadas
(`consultar.mjs`, `bancada-bloco.mjs`) não teriam contra o que rodar, e nenhuma
das medições poderia ser conferida por outra pessoa.

Os `hash` são estáveis — dependem de documento, núcleo, seção e texto. Enquanto
o documento não mudar, regerar produz exatamente os mesmos identificadores.

Nada aqui foi importado para banco nenhum. Ver `docs/bia-aplicacao-0071.md`.
