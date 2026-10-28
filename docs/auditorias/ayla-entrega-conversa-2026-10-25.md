# Entrega da candidata de conversa da Ayla

## Alinhamento editorial e bloqueio atual — 28/10/2026

Depois da bancada, Karina simulou o relato da professora (distração e atividade
não concluída), aprovou a direção e pediu foco no que a mãe observa e pode
experimentar em casa. Confirmou três brincadeiras por pedido, permitindo
opções fora dos interesses habituais. Decisões registradas na SPEC: não são
mudança funcional já publicada, resultado de modelo no app ou atualização de
perfil. Exemplos de cinco anos não foram escritos na Manu. Falta implementar
essa última direção e testá-la; os 4.290 testes/build relatados abaixo antecedem
essa incorporação funcional, não a comprovam.

Health no navegador integrado em `2026-10-28T19:27:55.721Z`: branch
`codex/ayla-qualidade-brincadeiras`, SHA `51600b883d374cad101e10b8e0da96ec7ee300af`,
V2/isolamento ativos, serviço Supabase e chaves de IA ausentes no runtime,
`db.ok=false`, `conversa_web_configurada=false`. A Vercel mostrou o deploy
`76mDwK3PBCJ7NWgGwnVDmBuKcbWi` Ready, mas isso não significou conversa pronta.
Nova tentativa autorizada de redeploy Preview (mesmo branch, sem cache)
retornou **Reauthenticate / Send Code to Email**. Nenhum código foi solicitado
ou preenchido pelo agente e nenhum novo deploy foi confirmado. Aba preservada
para a titular e solicitada abertura à direita; retorno da abertura foi
`queued`, não prova de visibilidade. Screenshot:
`C:/Users/karin/.codex/visualizations/2026/10/24/01a16b9a-fa1d-7593-b07b-e8bb45919def/vercel-foco-reauth-20261028.jpg`.

Main remota reconfirmada como `25e8891daf1e0d5bd881512e6f128742fdcd0184`.
Nenhum commit/push para contornar a autenticação. PEND-208 atualizada e aberta;
PEND-104 preservada; nenhuma nova pendência ou baixa. **Veredito: BLOQUEADO**
para teste humano na Web até reautenticação, configuração efetiva, atualização
da candidata e login da conta fictícia autorizada. Esta etapa só alterou
documentação; nenhum novo teste de código foi atribuído a ela.

## Atualização de 28/10/2026 — primeiro piloto: Foco na Web

**Escopo autorizado.** Karina escolheu Foco, sem Base44, como primeira prova de
qualidade. Risco CRÍTICO mantido; somente o worktree desta PR foi alterado.
Main remota conferida como `25e8891daf1e0d5bd881512e6f128742fdcd0184`. HEAD do
baseline: `51600b883d374cad101e10b8e0da96ec7ee300af`, mais os dois registros locais
de configuração/reautenticação já existentes. Nenhuma modificação no checkout
original, em perfis familiares, no catálogo Brinca ou na produção.

**Prova e causa observada.** A bancada existente ganhou cinco casos/nove turnos
com pessoas sintéticas: referência adulta, tema sem dados, dados parciais,
orientação com refinamento e dois irmãos. Reusa `prepararRespostaStream`,
contexto, compositor, classificador real e gerador real. Supabase remoto aceita
somente GET da biblioteca/templates; demais tabelas e telemetria em memória.
Não exercita o handler HTTP, a autenticação, a renderização ou a memória remota.
As saídas não são reescritas. No baseline, o pedido “Me dê ideias de outras
coisas que posso te pedir” foi classificado como desabafo: o formato rico ficou
fora. Abertura com interesses, mas sem dados de atenção, ofereceu menu sem
perguntas. Os testes anteriores de contrato não detectavam esses comportamentos
do classificador/gerador reais: verificavam composição ou usavam modelos falsos.

**Correção mínima e rollback.** Orientação ao classificador sobre pedido atual
vs. emoção passada, restrita a área Foco com V2 ativa; abertura diferencia
interesse conhecido de padrão de atenção conhecido. Mantida a chamada existente
e preservados crise/desabafo genuínos; nenhuma regex reclassifica o relato.
Desligar V2 preserva o contrato anterior. Não altera persistência, autorização,
reconciliação, transportes ou modelo. Sem nova escrita de negócio ou migração.

**Modelo real, não aprovação.** Nove saídas no baseline e nove na candidata,
ambos com `gpt-5.6-luna`, pessoas em memória e biblioteca corrente. Pedido de
ideias voltou a `duvida` e recebeu exemplos em bullets; a abertura parcial
retomou interesses e perguntou pelas lacunas. Foco permaneceu área ativa nos
nove turnos da candidata. São observações de uma rodada antes/depois, sem juiz
independente e sem garantia de estabilidade. Caso Lia ainda deslocou a tarefa
concreta para desenho e as ofertas não têm destaque uniforme. A abertura com
dados conhecidos acumulou três perguntas e quatro caminhos; concisão e pergunta
parcialmente repetida continuam em revisão. Karina ainda precisa aprovar riqueza,
acolhimento e apresentação. Não afirmar equivalência. A nota de abertura é
compartilhada entre canais, mas só a Web foi exercitada nesta rodada; não
atribuir a ela prova do WhatsApp.

Artefatos: `ayla-piloto-foco-2026-10-28-baseline-1.json` e
`ayla-piloto-foco-2026-10-28-candidata-1.json`; exportação integral sem edição em
`ayla-piloto-foco-2026-10-28-comparativo.md`. SHA-256 dos JSONs:
`7ad288a1f36d19921213f6891bf340b2b00d6c22038b9d449b496e634ac5e613` e
`e3e38bff2fb1116f6511b3c7e126838d7e58bbc29eb3e1c9068a7bb6cd3eb7d6`.
Seções BASE2 por ID, identidade,
idade, fatos sintéticos entregues e respostas preservados. Logs da execução
registraram BPs recuperadas/enviadas e `uso_efetivo=nao_observavel`: não provar
consulta integral à pós a partir desses IDs. PEND-104 continua aberta.

**Verificação até esta atualização.** Cinco testes de integridade da bancada e
30 testes dirigidos passaram (classificação, abertura, engine, formato legado,
flag off e controles crise/desabafo). Sintaxe do runner validada. A primeira
tentativa de executar a bancada parou antes do modelo por suporte TypeScript
do Node; repetida com `--experimental-transform-types`, sem alterar o runtime
do app. **Regressão completa: 4.290 passaram, sete pulados, 227 arquivos
aprovados e três pulados (230), 402,23 segundos, limites padrão e dois workers.**
Build Webpack aprovado, incluindo TypeScript e 107 páginas estáticas, executado
após a suíte; lint dos quatro arquivos TypeScript alterados sem erro/aviso.
Índice de pendências sincronizado (182 fichas, IDs únicos), diff sem erro.
Configuração/auth/deploy e smoke humano não foram
revalidados nesta etapa. Nenhum commit/push enquanto o portão de reautenticação
da Vercel continuar pendente. PEND-208 atualizada e aberta, nenhuma criada ou
concluída. **Prontidão para produção: BLOQUEADO.**

25/10/2026. Risco CRÍTICO: a IA decide o que dizer e usa informações comportamentais por pessoa. Esta entrega prepara a Preview A para aceite de Karina. Não publica o catálogo Brinca nem ativa a candidata em produção. Avaliação por estrelas e memória automática na web permanecem etapas seguintes.

## Resultado para a família

A web passa a mostrar doze áreas, mantendo uma única Ayla. Ao abrir uma área, ela considera os dados recebidos antes de apresentar possibilidades ou perguntar. A orientação ganha espaço para explicar, propor ações, oferecer falas prontas e continuar por caminhos pertinentes. A área pode mudar sem trocar de pessoa nem apagar a conversa. Áudio vira texto editável antes do envio.

A comparação com o Base44 usa as perguntas e os dados de demonstração fornecidos por Produto, sem consultar contas familiares. O Base44 não foi executado novamente. As saídas reais da candidata estão preservadas sem edição nos JSONs das rodadas.

## Baseline e causa raiz

- Na rodada inicial, Foco repetia informações e a brincadeira vazava rótulos de instrução. Na v2, o produtor oficial caiu em um piso infantil para uma adulta.
- Na continuidade v3, a orientação alimentar não ofereceu caminhos; a mensagem seguinte escolheu uma opção que não existia. A falha não era apenas falta de histórico.
- O envelope do WhatsApp proibia anunciar opções na fala e as reservava para outra mensagem. A candidata pedia o contrário. Além disso, o classificador cortava o histórico pelo começo e perdia ofertas no final de respostas longas.
- A abertura de área concorria com a investigação de uma lacuna; a recuperação de brincadeira rejeitava linguagem natural por heurísticas, mesmo após corrigir estrutura e risco.

## Solução e limites

Os dois produtores reutilizam guias temáticos, biblioteca BASE2 existente, templates, perfil consultável e histórico. O envelope agora escolhe um único dono da oferta: na candidata, os caminhos pertencem à fala e o código impede um segundo menu legado. O contrato publicado permanece selecionável com a flag desligada. O trecho do histórico preserva começo e final; não acrescenta chamada de classificação.

O novo formato não retira os fluxos próprios de crise, história ou atendimento comercial. Não muda o modelo para atribuir ao prompt um ganho que poderia vir de outra variável. Os guias não são profissionais separados nem um novo banco de perfis.

O catálogo XLSX/JSON v6 segue fora do produtor. A biblioteca integral da pós não foi ativada; apenas seções canônicas existentes e BPs recuperadas são entregues. Identificadores de fonte demonstram entrega ao modelo, não uso correto nem validação clínica. PEND-104 permanece aberta.

## Evidência do modelo

| Rodada | Execuções | Resultado observado |
|---|---:|---|
| Referências v4 | 12, seis casos nos dois produtores | Aberturas Foco com resumo e quatro caminhos; brincadeira adulta completa, sem piso infantil. O Oficial corrigiu estímulo sonoro antes da saída. Ofertas ainda oscilaram. |
| Continuidade v4 | 12, dois temas e três turnos por canal | Escolha da primeira opção reconhecida; alimentação ainda oferecia caminhos inline em vez de bullets. |
| Continuidade v5 | 12, mesmo desenho após retirar a exceção concorrente | Alimentação oferece caminhos em bullets nos dois produtores e entrega a refeição escolhida; Foco apresenta quatro caminhos, reconhece a escolha e responde a pedidos de ideias. |

Arquivos: `ayla-temas-modelo-2026-10-25-referencias-base44-v4.json`, `ayla-temas-modelo-2026-10-25-continuidade-v4.json` e `ayla-temas-modelo-2026-10-25-continuidade-v5.json`, nesta pasta. Rodadas anteriores continuam como histórico de falhas. A v4 de referências antecede o último ajuste da exceção; não é medição da versão final em todos os seis casos.

Isto exercita produtores e classificadores com pessoas sintéticas em memória, biblioteca somente leitura e APIs de modelo. Não exercita a entrega completa do orquestrador WhatsApp, os efeitos de uma intenção classificada como plano, a gravação no banco remoto nem a apresentação em celular. A oferta ainda varia em continuações e o negrito não aparece em todos os títulos de opções. A equivalência editorial não está aprovada.

## Testes de código

98/98 testes focados passaram após a mudança do envelope e do controle de rollback. Uma execução completa posterior encontrou uma expectativa literal antiga de montagem do prompt: 4.263 passaram, uma falhou e sete foram puladas. A expectativa foi ajustada para conferir a escolha explícita entre contrato candidato e publicado; o comportamento das duas posições da flag também é executado no produtor real com modelo simulado.

A suíte final passou: **4.264 testes aprovados e sete pulados**, 225 arquivos aprovados e três pulados, em 367,98 segundos. O build Webpack final passou, incluindo TypeScript e geração das 107 páginas estáticas. Lint dos arquivos TypeScript alterados: zero erros, oito avisos preexistentes de símbolos não usados em contexto/engine.

## Persistência e falhas

A resposta web confere a inserção antes de aparecer como entregue. Se a gravação falhar, mostra erro em vez de falso sucesso; se a conexão cair depois de salvar, a resposta pode ser reencontrada. Troca de área falha com registro de erro, sem regenerar uma resposta já salva. Primeira mensagem que falha não devolve conversa vazia como sucesso; a limpeza confere seu retorno. A autorização de membro verifica família e estado ativo.

**Não comprovado:** rajada de criação/retomada de área, chamadas simultâneas de geração e conflito de atualização do contexto. A retomada procura o tema original; após troca explícita, o cartão original pode abrir a conversa na área atual. Esses estados precisam de decisão e teste antes da produção. Testes em memória não provam RLS ou durabilidade remota.

Não há migração de banco nesta entrega. O extrator automático do WhatsApp não foi reimplementado e a web ainda depende da proposta/confirmação existente para guardar informações no perfil. Nunca anunciar atualização automática completa com base nesta mudança.

## Revisão de engenharia

- **Arquivos:** páginas/actions de Estratégias e conversa, streamer, áudio e transcrição; produtores/contexto/classificador web; produtor oficial, envelope, brincadeira e continuidade; health, ajuda, testes e bancada. A lista exata pertence ao diff da PR #150.
- **Regressão:** controles executados para flag off, crise, caso concreto versus abertura, sensibilidade sonora legítima versus pista escrita, adulta versus criança e escolha entre contrato publicado/candidato. Foram removidas instruções concorrentes, não os controles de identidade ou conteúdo.
- **Observabilidade e segurança:** health expõe a flag efetiva; metadados expõem área e fontes entregues. Transcrição exige sessão, família, acesso ativo e chave, valida tamanho/formato e não salva áudio ou perfil. A verificação de isolamento executada é local; RLS remota permanece no aceite de QA.
- **Reconciliação:** não há novo estado em serviço externo a reconciliar. Resposta salva pode ser recuperada ao recarregar; falha de escrita é erro, não confirmação. Retomada e concorrência remotas continuam nos portões, sem job novo ou promessa de correção automática.

## Portões da entrega

| Portão | Resultado | Evidência ou falta |
|---|---|---|
| P1 Problema e dono | PASS | Mãe/responsável encontra áreas e recebe ajuda personalizada, com autonomia da pessoa atendida. |
| P2 Descoberta | BLOQUEADO | Doze cartões e corpus de contrato; falta smoke autenticado e descoberta humana. |
| P3 Conversa e dados | BLOQUEADO | Aberturas e continuidade sintéticas; falta cobertura real das lacunas e atualização factual nos dois canais. |
| P4 Jornada e canais | BLOQUEADO | Web e produtores testados; entrega completa WhatsApp e áudio real não exercitados. |
| P5 Identidade e permissão | BLOQUEADO | Testes de família/irmãos em memória; faltam provas remotas isoladas. |
| P6 Continuidade | BLOQUEADO | Histórico preservado; faltam concorrência, retomada no dia seguinte e memória automática web. |
| P7 Falha e observabilidade | BLOQUEADO | Escritas conferidas, flag e fontes rastreáveis; faltam smoke remoto e métricas de adoção/feedback. |
| P8 Prova e entrega | BLOQUEADO | Preview exige login; aceite, celular, microfone e produção pendentes. |

## Operação e próximos passos

Branch `codex/ayla-qualidade-brincadeiras`, PR #150 em rascunho. Antes de commit, o branch estava seis commits à frente de `origin/main`, sem commits exclusivos da main. O checkout original com outras alterações não foi editado.

Publicar o branch não autoriza merge. Verificar SHA e `flags.ayla_qualidade_resposta_v2` no health da Preview; estado verde da Vercel não basta. Reverter a flag desativa os guias, a interface temática e os novos contratos, sem migração ou remoção de histórico. Não há nova escrita em perfis ou ativação de rascunhos editoriais.

Em 25/10, a navegação na Preview encontrou a tela de login. O teste autenticado deve usar conta de QA isolada; nenhuma credencial foi procurada e nenhuma mensagem foi enviada a famílias. A skill de documentação orientou o registro das provas e limites; a de navegação separou inspeção de interface de publicação.

Depois do aceite da conversa: implementar avaliação por mensagem, com estrelas 1–5, zero separado, ausência distinta, comentário opcional, edição idempotente e autorização; depois unificar captura factual e provar escrita → leitura → nova consulta por pessoa. A investigação local encontrou NPS 0–10 e feedback textual, não um contrato pronto de estrelas por resposta: não reaproveitar esses números com outro significado nem lançar nota dentro do perfil.

**Pendências:** PEND-208 atualizada e aberta; nenhuma criada ou concluída nesta entrega. PEND-104 não foi baixada. **Veredito da prontidão para produção: BLOQUEADO**, pelos portões acima. A candidata serve ao próximo aceite em Preview, não à declaração de entrega completa.

## Publicação isolada e acesso para o teste

O commit funcional `ad9809896ce5675b03ffb3676ea3a7f8040e4ed5` foi enviado à PR #150. A API do GitHub confirmou Vercel `success`, build `completed/success` e Vercel Preview Comments `completed/success`. Deploy: <https://vercel.com/kolo-familia/kolo-familia-web/GCKRATFnCWn7Yf7ATQQDEhj3SwWg>. Entrada: <https://kolo-familia-web-git-codex-ayla-qualidade-b-b848a6-kolo-familia.vercel.app/estrategias>.

A consulta não autenticada ao health recebeu HTML, não metadados verificáveis; o navegador continuou em `/login`. Portanto configuração efetiva, SHA servido e smoke autenticado ainda precisam ser conferidos. Checks verdes não substituem essas provas.

Karina esclareceu que sua conta é fictícia e autorizou o teste nela com os dados já cadastrados da Manu. Essa é a conta de teste indicada por Produto, não autorização para procurar senha, inventar fatos, apagar o perfil ou acessar outra família. O login fica com a responsável. Nenhum teste ou escrita foi executado nessa conta nesta entrega.

Baseline adicional para a etapa de memória: `proporAtualizacao` lê o transcript com `.slice(0, 8000)`. Em uma conversa longa, fatos recentes podem ficar fora da proposta. Registrado na PEND-208 para a implementação de captura contínua; não corrigido silenciosamente junto da entrega de conversa.

## Bloqueio de configuração confirmado em 26 de outubro

O health acessado pelo navegador com sessão Vercel em `2026-10-26T12:00:17.051Z` confirmou SHA `2a96b691a1fda3ff1cdf4f00334f3d99aa3a6c71`, ambiente Preview e `ayla_qualidade_resposta_v2=true`. Porém `db.ok=false`; `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` estão ausentes. A Vercel mostra `OPENAI_API_KEY` como Secret, somente Production e sem cópia/revelação do valor. Nenhum segredo foi lido ou alterado.

Isso corrige o diagnóstico anterior: o acesso à conta não era o único bloqueio. A Preview não estava pronta para gerar respostas, apesar de build e checks verdes. Não pedir outro teste humano antes de resolver as dependências e conferir o retorno real.

O health também reporta Z-API token e cron secret presentes. Sua presença não prova disparo, mas habilitar serviço de banco/IA exige verificar antes as portas de webhook, cron e envio para não ativar efeitos fora do QA web. Não copiar indiscriminadamente todas as variáveis da produção nem configurar Stripe para este teste.

Proposta mínima, sujeita à autorização de acesso: disponibilizar apenas credenciais de servidor compatíveis com o banco da Preview e as APIs de IA, restritas ao branch `codex/ayla-qualidade-brincadeiras`; preservar configuração de produção; isolar rotas com efeitos fora do teste; novo deploy; provar SHA/flag e chamadas de banco/modelo; só então login e teste da conta fictícia com Manu. Não enviar valores de chaves no chat. Nenhuma alteração de ambiente ou código funcional foi executada nesta investigação. PEND-208 atualizada e aberta; veredito do teste humano: **BLOQUEADO**.

## Etapa 2 — isolamento da Preview em 27 de outubro

**Problema e baseline.** Preview com flag ligada, sem credenciais de banco/IA e com variáveis Z-API/cron presentes. Webhook e crons não tinham bloqueio por ambiente. O aceite humano não podia começar. Karina autorizou o acesso necessário exclusivamente nessa Preview; não autorizou merge ou ativação em produção.

**Causa e solução mínima.** A presença de variáveis compartilhadas não garante isolamento. `lib/preview-conversa.ts` centraliza a decisão por `VERCEL_ENV=preview`: webhook Ayla, cron Ayla e cron de exclusão retornam 403 antes de payload ou banco; Z-API e mailer SMTP recusam antes de conexão, mesmo com credenciais presentes ou transporter cacheado. Em produção/local a regra não interfere na autenticação ou nos transportes. Sem dependência, migração ou segredo novo.

**Observabilidade.** Health publica `flags.preview_somente_conversa`, `capacidades.conversa_web_configurada` e provedor efetivo. A saúde global conserva seus requisitos de Stripe; não configurar cobrança para fazê-la ficar verde. Configuração da conversa não comprova validade das chaves, uso correto do perfil ou resposta do modelo.

**Testes.** 29 testes dirigidos passaram: cinco entradas HTTP com segredo válido, repetição, segredo ausente e autenticação fora da Preview; três envios Z-API e status; SMTP incluindo cache prévio; helper e contrato existente do health. Banco, fetch e SMTP substituídos em memória: nenhum envio externo. Build Webpack/TypeScript aprovado (107 páginas), lint dos nove arquivos TypeScript alterados sem erro/aviso. Primeira suíte completa: 4.285 passaram, sete pulados e um timeout de 5s em `stripe/semear-vinculo.test.ts`, em 614,90s, executada em paralelo ao build. Repetição isolada ainda concorrendo com a suíte também excedeu 5s; após encerrar ambos, o arquivo passou 7/7 com limite explícito de 20s e duração total de 3,85s. Não houve alteração de teste ou código de pagamentos. **Suíte final com limites padrão, dois workers e sem build concorrente: 4.286 passaram, sete pulados, 227 arquivos aprovados e três pulados (230), 555,22s, código de saída zero.** Índice regenerado/conferido sem alteração do painel e cinco testes do índice passaram. `git diff --check` limpo após normalização somente das linhas novas de pendências.

**Estado externo.** Main remota conferida como `25e8891daf1e0d5bd881512e6f128742fdcd0184`; API GitHub confirmou PR #150 aberta, rascunho e `merged=false`, head anterior `699efdb42e41237198df80b34e68276d7ba0c88f`. A tentativa de acesso à janela Chrome expirou aguardando aprovação, antes da leitura do painel. A busca de integração Vercel não pôde ser executada neste contexto; não é prova de inexistência de plugin. Nenhum segredo foi exposto, copiado para o painel ou alterado. O build carregou as variáveis locais sem imprimir valores. Configuração ainda pendente, sem novo smoke remoto ou conversa na conta Manu.

**Persistência e concorrência.** Esta alteração não cria escrita de negócio, reserva, fila ou confirmação de sucesso: as portas bloqueadas retornam antes do processamento. A repetição foi exercitada; não se atribui a esses testes prova de concorrência/idempotência da conversa. Reconciliação de serviço externo não se aplica ao bloqueio: nenhuma operação é iniciada para reconciliar.

**Limites.** O bloqueio não é isolamento de banco: a conta de QA autorizada continua necessária, e os dados já cadastrados devem ser preservados. E-mails de autenticação pertencem ao Supabase Auth, não ao mailer; não testar signup, magic link ou recuperação de senha. Não extrapolar os testes dos transportes para todas as escritas de rotas autenticadas. Persistência/concorrência de conversa, memória automática, estrelas, corpus integral da pós e catálogo continuam nas etapas próprias.

**Rollback e entrega.** Não há merge. Se houver regressão do bloqueio na Preview, reverter a alteração antes de adicionar credenciais; não desativar a proteção para facilitar o teste. Após acesso ao painel: adicionar apenas variáveis compatíveis e restritas ao branch, declarar o provedor usado, redeploy, conferir SHA/flag/capacidades e bloqueios remotos, depois teste autenticado pela responsável. Credencial de servidor nunca deve ser enviada no chat nem exposta ao cliente.

**Publicação desta etapa.** Código e testes no commit `cb498844e5a9f2f25cbc91fc535e2dceef794b1f`, branch da PR #150. Push confirmado; status Vercel `success`, deploy <https://vercel.com/kolo-familia/kolo-familia-web/BZ9TpM4Vs9DorHmxFpkKwZbjDFYY>. API GitHub reconfirmou checks `build` e `Vercel Preview Comments` concluídos com `success`. O status da plataforma não comprova SHA lido pelo runtime, 403 remoto, validade das chaves ou geração da conversa. Não houve configuração de credenciais nem alteração de produção.

**Veredito:** teste humano **BLOQUEADO** por configuração e acesso ao painel. PEND-208 atualizada, sem baixa; PEND-104 preservada. O isolamento local é avanço da etapa 2, não comprovação de Preview funcional nem de produção.

## Configuração autorizada e reautenticação — 27/10/2026

O acesso pelo navegador integrado funcionou. Health observado em `2026-10-27T15:37:55.991Z`: SHA `51600b883d374cad101e10b8e0da96ec7ee300af`, ambiente Preview, candidata e isolamento ligados, banco/credenciais de IA ainda ausentes no runtime. GETs dos dois crons exibiram `preview_somente_conversa`; não se mede aqui o código HTTP pela árvore de acessibilidade. Nenhuma mensagem, cobrança ou exclusão foi disparada.

Após confirmação humana específica, configuração local compatível foi carregada sem exibir valores e copiada para entradas novas restritas ao branch `codex/ayla-qualidade-brincadeiras`. Três Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. Três Configs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `IA_PROVIDER=openai` (mesmo provedor da bancada). A chave do cliente foi verificada como anônima. Nenhuma entrada de produção foi editada; não foram criadas/copiadas variáveis Stripe, SMTP, Z-API ou cron.

**Escrita parcial conferida:** a tentativa de salvar as cinco credenciais como Secret retornou validação que proíbe `NEXT_PUBLIC_` nesse tipo, mas as três privadas foram persistidas. Leitura de volta no painel identificou cada entrada e seu branch; não houve reenvio cego. Os dois campos públicos e o provedor foram salvos em lote Config separado. Toast confirmou sucesso; leitura posterior confirmou tipo e escopo. Valores não foram expostos no chat, logs, screenshots ou arquivos novos. A referência em memória às credenciais foi descartada após o preenchimento; o `.env.local` original foi preservado.

**Deploy e bloqueio:** origem `76mDwK3PBCJ7NWgGwnVDmBuKcbWi`, SHA `51600b8`; modal de redeploy confirmou Preview, branch e alias corretos, sem cache de build. Ao confirmar, a Vercel exigiu reautenticação com código enviado por e-mail. O agente parou antes de enviar/preencher o código e manteve a tela para a titular. Não acionar GitHub/API/outro mecanismo para contornar essa verificação. Nenhum redeploy novo ou geração autenticada foi comprovado; não chamar a Preview de funcional. Prova visual local: `preview-reauth-20261027.jpg` na pasta de visualizações desta tarefa.

Código funcional inalterado; nenhuma nova suíte executada para esta mudança de configuração. Os resultados anteriores permanecem identificados pelos commits correspondentes, não validam o novo ambiente. Não houve escrita em perfil/conversa, teste de concorrência, ativação da pós integral ou importação Brinca. Main reconferida como `25e8891daf1e0d5bd881512e6f128742fdcd0184`; checkout da PR em `51600b8`, limpo antes deste registro.

**Rollback:** se for necessário, revogar somente as seis entradas novas desse branch, preservando as entradas prévias de produção e Preview geral; isso exige a confirmação aplicável. Não remover dados nem enfraquecer o bloqueio para concluir o teste. **Próximo passo:** titular conclui reautenticação no painel; depois conferir conclusão do redeploy, configuração efetiva, persistência dos bloqueios e login na conta fictícia autorizada. Documentação fica local, sem commit/push enquanto a confirmação de segurança do deploy estiver pendente. PEND-208 atualizada e aberta; nenhuma criada ou concluída, PEND-104 inalterada. **Veredito: BLOQUEADO** pela reautenticação/deploy e smoke pendentes.

## Etapa 3 — piloto Foco e configuração efetiva, 28/10/2026

**Problema, dono e escopo.** Karina quer qualidade comparável às referências
Base44 na conversa da família, começando por Foco. O aceite inclui apresentação,
leitura do conhecido, perguntas só pelas lacunas, orientação prática em casa,
reflexão sem culpa, formatação legível, continuidade e jogos completos. Esta
etapa prepara candidata na PR #150; não autoriza merge/produção. Risco CRÍTICO.

**Baseline e causa raiz.** Nove turnos sintéticos no engine real identificaram
pedido de ideias classificado como desabafo (que retirava o formato rico) e
abertura parcial sem perguntas sobre o tema. Em quatro turnos de alinhamento,
a orientação começava pela escola; a pergunta natural “teria alguma brincadeira”
não recebia o contrato esperado; o contrato candidato mandava entregar uma só.
As primeiras três opções ainda repetiam cozinha. Os baselines e todas as
repetições ficam preservados, sem editar respostas do modelo.

**Solução e reutilização.** Usa o classificador, compositor, perfil/histórico,
biblioteca e provedor existentes. A instrução do classificador prioriza o pedido
atual somente em Foco/V2; não sobrepõe crise/desabafo por regex. Abertura reconhece
relatos livres de atenção e diferencia interesses de dados efetivos do tema.
A orientação web prioriza apoio viável em casa; pedido explícito sobre escola
continua atendido. Uma fábrica conserva o corpo executável de brincadeira e
retira a ordem conflitante de uma só no piloto: três por padrão, quantidade
explícita respeitada. O reconhecimento de perguntas naturais fica restrito ao
piloto, preservando as outras superfícies. Nenhuma chamada extra ou modelo novo.

**Ajustes editoriais do piloto.** Interesses são portas opcionais, não fronteiras
do repertório. Cada jogo explica “O que vocês exercitam”, relacionando uma
capacidade à ação e ao vínculo pela criação/iniciativa compartilhada quando
presente. Repertório aberto a memória, imitação, movimento, percursos e chefinho
com troca de papéis. Respiração/movimento podem ser pausa confortável, não
condição nem obrigação. Não prometer transferência de jogo para desempenho na
escola. Estes ajustes não publicam atividades KB nem aprovam o catálogo.

**Evidências do modelo.** Arquivos `ayla-piloto-foco-2026-10-28-*.json` nesta
pasta. Baseline e candidata inicial: cinco cenários/nove turnos. Alinhamento:
três cenários/quatro turnos, baseline e candidatas 1, 2, 3-vinculo e 4-repertorio.
A rodada `candidata-2-final` repete os nove turnos com o código final; a
`alinhamento-candidata-4-repertorio` repete os quatro. Classificador e gerador
reais; dados pessoais/históricos em memória, biblioteca apenas GET. Não são
testes HTTP autenticados nem execução no navegador ou WhatsApp.

Na rodada final, a orientação da professora começou por casa e usou a atenção
na cozinha já conhecida sem perguntar de novo. O pedido de jogo entregou três
propostas, incluindo percurso fora dos favoritos. O caso massinha ofereceu
pistas, robô com movimentos e desenho sem exigir massinha. O pedido explícito
de uma recebeu uma só. Todos trouxeram explicação ligada à ação. Nos nove turnos,
o pedido de ideias foi `duvida`, a adulta teve continuidade de estudos, os dados
parciais geraram perguntas, e o refinamento passou de início a medo de errar.

**Ressalvas editoriais.** Não há equivalência/estabilidade comprovada ao Base44.
Respostas de jogos chegaram a cerca de quatro mil caracteres; avaliar carga
visual. Há exemplos ainda pouco fechados (“a boneca encontrou uma surpresa”)
e hipótese tratada como fato (“apaga, sente alívio”). Não declarar os critérios
editoriais integralmente aprovados. A abertura sem dados ainda acumulou perguntas
e menu em uma repetição. A revisão humana deve julgar utilidade e dosagem.

**Consulta ao conhecimento e limites.** Saídas guardam `base2Ids`, incluindo
`foco/triagem-inicial-duas-perguntas-que-separam-caminhos-rapidamente` e
`foco/principio-central`. Logs `conhecimento_consultado` mostraram dois trechos
recuperados e dois enviados por turno; `uso_efetivo=nao_observavel` conserva o
limite: envio não prova aplicação. As seções de Base 2 continuaram iguais mesmo
no refinamento, então não afirmar recuperação específica de todo subtema.
O material integral da pós está localizado e não ativo (PEND-104); parte da
origem já existe no Compilado. O lote Brinca em rascunho e seu guia não foram
importados. Não chamar jogos gerados de atividade aprovada do catálogo.

**Configuração e segurança remotas.** A titular concluiu a reautenticação.
Redeploy Gtdkqzrsw87tkZQKrPP2CZW1L13h Ready, SHA ainda `51600b8`, Preview
`https://kolo-familia-c9knpifmh-kolo-familia.vercel.app`.
Health `2026-10-28T19:45:28.384Z`: `db.ok=true`, credenciais necessárias
presentes, `conversa_web_configurada=true`, provedor OpenAI, V2 e isolamento
ligados. Stripe ausente mantém saúde global negativa sem bloquear a conversa;
não configurar pagamentos para fazer o health ficar verde. GETs dos crons
mostraram `preview_somente_conversa`; árvore de acessibilidade não mede status
HTTP. Branch alias `/estrategias` direcionou a `/login`. Nenhuma conversa
autenticada, mensagem externa ou escrita no cadastro da Manu nesta etapa.

**Testes e regressão.** Vitest completo executado em 28/10, 17:00:48–17:10:21:
227 arquivos passaram, três ignorados; **4.296 testes passaram, sete ignorados**,
572,75 s, `--maxWorkers 2`, timeouts normais. Dirigidos: 62 passaram em cinco
arquivos. Integridade dos cenários: seis passaram. Lint dos oito TS alterados
sem erros/avisos; scripts da bancada/exportador com sintaxe válida. As últimas
mudanças de texto (habilidades/vínculo/repertório) foram posteriores ao início
da suíte completa: rodada real final concluída; conferência dirigida e build
final em conclusão, registrados abaixo quando terminarem.

**Persistência, concorrência e reconciliação.** Esta etapa não cria escritor,
fila, reserva ou confirmação de negócio. BancoMemoria contém os perfis de teste;
guarda remota do histórico, concorrência, idempotência e retomada permanecem
NÃO VALIDADAS nesta rodada. Memória automática web e estrelas não implementadas;
provas previstas na SPEC e PEND-208, sem inventar baixa. Cadastro da Manu deve
permanecer intacto; exemplos sintéticos não viram fatos.

**Arquivos e remoções.** Classificador/compositor web, guias temáticos e fábrica
do pedido de brincadeira; testes respectivos; casos/runner/exportador de bancada,
JSONs de evidência, SPEC, relatório e PEND-208. Removida a ordem concorrente de
uma só para o piloto; preservado contrato das outras áreas e o publicado.
Sem dependência, migração, transporte ou implementação de outro provedor.

**Rollback e portões.** Desligar V2 volta à condução anterior; mudanças não
apagam histórico ou migram dados. Isolamento Preview deve continuar ligado,
independentemente do aceite. P1 problema/aceite documentados; P2 descoberta,
P3 dados reais, P4 canais/áudio, P5 alvo/RLS remoto, P6 continuidade/memória,
P7 falhas/adoção e P8 aceite/produção continuam abertos conforme PEND-208.
Portões de persistência/concorrência/reconciliação não se aplicam à alteração
de texto, mas não estão aprovados para a entrega completa da funcionalidade.

**Operação e veredito.** Main e branch remoto reconferidos: `25e8891d` e
`51600b8`, respectivamente; checkout original preservado. Commit/push da nova
candidata seguem após o fechamento do build e conferências. Configuração resolvida
não aprova respostas. **PASSOU COM RESSALVAS** para a avaliação sintética;
**BLOQUEADO** para declarar produção pronta. PEND-208 atualizada e aberta;
nenhuma criada/concluída; PEND-104 inalterada. Próximo aceite é Karina na Preview,
com a conta fictícia já autorizada e os dados existentes da Manu.

**Fechamento local da candidata.** Build Next 16.2.5 com webpack passou:
compilação, TypeScript e 107 páginas estáticas, exit 0. Após as últimas mudanças
editoriais, os mesmos cinco arquivos dirigidos passaram novamente: 62 testes,
7,05 s, 17:20:08; lint dos oito TS exit 0, sem avisos. `git diff --check` e
índice oficial de pendências passaram (182 fichas, IDs únicos). Regressão completa
anterior e dirigida final estão separadas para não atribuir o texto novo a um
teste iniciado antes dele. Rodadas reais finais concluídas e revistas, com as
ressalvas acima. Não ampliar testes sem nova alteração/falha.

SHA-256 dos artefatos finais (respostas integrais, sem edição):

- `ayla-piloto-foco-2026-10-28-candidata-2-final.json`:
  `a8d856030b6253c753565e61e969752230056f9d3d6859569e6f6f3ed17f6dd3`.
- `ayla-piloto-foco-2026-10-28-alinhamento-candidata-4-repertorio.json`:
  `b73230a58c58df4ebe92a666469ac0e5108e6e0e25494d9ff85d25dad77ee7c6`.
