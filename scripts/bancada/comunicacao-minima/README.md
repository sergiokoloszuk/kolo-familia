# Bancada curta de comunicação — somente laboratório

Executa a rota Web e o classificador + gerador oficial do WhatsApp com banco
fictício. Não executa webhook nem envia mensagem. Só o provider de modelo pode
receber rede; qualquer outro host é recusado. O Core desta rodada é o fallback
de código, não o Core ativo do banco. Não usar esta bancada como substituta da
auditoria posterior de conversas longas.

Dependências: Node 24 com transform-types e as dependências do monorepo já
instaladas. Os casos estão em `casos.json`; não alterar os oráculos após a rodada.

Entradas externas, sem copiá-las para um pacote compartilhável:

- `KOLO_QA_CORPUS`: JSON com BPs em campos nativos, sem texto original dos livros,
  dados de famílias ou Core. O hash JSON usado está nos resultados.
- `KOLO_QA_CATALOGO`: snapshot nome/keywords das 13 skills, sem inventar campos.
- `KOLO_QA_PROVIDER_ENV`: caminho local da configuração existente. O roteiro lê
  somente autenticação dos providers em memória; não copia o arquivo, não
  importa credenciais de banco e não imprime valores. Na máquina da missão,
  os caminhos locais conhecidos são usados quando esses parâmetros faltam.

O snapshot do corpus não acompanha o PR: não criar um segundo acervo no produto.
Os testes unitários portáveis usam somente fixtures pequenas no próprio teste.
Na Web, os sete registros do seed versionado são **fixture de configuração**;
não há fallback de catálogo implementado no produto e não são a configuração
atual de produção. Essa limitação acompanha todos os resultados.

Na raiz:

```powershell
node --experimental-transform-types --use-system-ca scripts/bancada/comunicacao-minima/rodar.mjs antes web
node --experimental-transform-types --use-system-ca scripts/bancada/comunicacao-minima/rodar.mjs antes whatsapp
node --experimental-transform-types --use-system-ca scripts/bancada/comunicacao-minima/rodar.mjs depois web
node --experimental-transform-types --use-system-ca scripts/bancada/comunicacao-minima/rodar.mjs depois whatsapp
node scripts/bancada/comunicacao-minima/relatar.mjs
```

`antes` carrega os seis módulos afetados diretamente do commit-base em memória.
`depois` usa os arquivos locais e as duas propostas editoriais sobrepostas ao
banco fictício. Nada publica essas propostas. A origem de cada etapa fica no
manifesto; não assumir que uma BP projetada foi semanticamente usada.

As 24 respostas foram geradas antes da parametrização dos caminhos do roteiro;
as entradas, os módulos funcionais e os pedidos estão identificados por hashes
nos quatro JSONs. A alteração posterior do roteiro foi operacional, sem mudar
prompts ou oráculos. Resultados da tentativa inicial com catálogo omitido foram
preservados localmente como inválidos e não entram na comparação aprovada.

`build-diagnostico.cjs` usa valores fictícios e só observa em memória uma URL de
fonte sem extensão; não corrige dependências ou CI. A falha antiga não se
reproduziu. Nenhum resultado autoriza merge, deploy ou escrita em banco real.
