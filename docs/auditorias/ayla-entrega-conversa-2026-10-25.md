# Entrega da candidata de conversa da Ayla

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
