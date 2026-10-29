# Ayla — referência de conversa Base44

Data: 2026-10-25 · Risco: CRÍTICO · Dona: Produto Kolo Família.

## Problema e baseline

A responsável rejeitou a entrega compacta de brincadeira na Preview e aprovou
como referência respostas com acolhimento, leitura do perfil, explicação,
ações concretas, falas prontas e caminhos de aprofundamento. Não basta aumentar
o texto. O caso alimentar de referência relaciona preocupação do cuidador,
repertório já registrado, autonomia da pessoa e próxima refeição.

Baseline técnico antes desta candidata: `experimental.ts` injeta o DNA
transversal e duas BPs elegíveis, mas não lê a BASE 2 de condução. O formato
final recomenda aproximadamente 700 caracteres para orientação. Na web,
`buildSystemTextConversa` já recebe Objetivo/Tom/Escopo/Limites dos especialistas;
a consulta seletiva da BASE 2 depende do piloto 4A. O contrato local anterior
da candidata limitava a resposta a três blocos curtos. Os resultados sintéticos
da PR #150 anteriores não medem a nova régua editorial.

## Decisões de produto confirmadas na conversa

- Uma identidade visível: Ayla. Os doze temas têm apresentação, propósito,
  perguntas próprias e caminhos; não se apresenta como outra pessoa/profissional.
- Abertura de tema sem caso concreto: acolher, explicar o propósito, reconhecer
  um ou dois fatos pertinentes e oferecer menu curto com escrita livre.
- Caso concreto: orientar no turno atual, com a riqueza necessária. Pode reunir
  compreensão, crença explicitamente relatada, orientações e reflexão.
- Menu de aprofundamento não obriga a consumir blocos numa ordem fixa.
- Todos os doze temas oferecem, depois de uma orientação substancial, duas ou
  três formas concretas de continuar explorando, com bullets, destaque e emoji
  discreto. Não é menu fixo em cada mensagem: acompanha o pedido, o que já foi
  entregue e a idade. Escolher uma opção deve entregar essa opção, sem reiniciar
  a abertura. Pedir ideias do que perguntar recebe exemplos de pedidos.
  Cumprimento, agradecimento, recusa, resposta curta e necessidade imediata não
  exigem ofertas. Código Base44 conferido: `sensorial.jsonc` e `foco.jsonc`
  declaram opções ao final; `nutricao.jsonc` remete às regras do Sensorial.
- Perguntas próprias do tema são repertório: consultar cadastro e histórico
  antes. Na abertura sem dados, até três perguntas relacionadas podem ser
  agrupadas. Depois, perguntar apenas o que muda a ajuda.
- Refinamento humano de 25/10: a Ayla verifica se há registros do tema antes
  de redigir a abertura. Com dados, resume o que já sabe; sem dados, lista em
  bullets o que precisa conhecer e lembra que pode responder por áudio; com
  dados parciais, resume o conhecido e pergunta apenas pelas lacunas. Não
  transfere a verificação à família com "se ainda não tivermos informações".
  Consulta indisponível não é prova de cadastro vazio.
- Tom aprovado para retomar dados compartilhados: "Pelo que você já me contou
  sobre ela…", ajustando nome e pronome. Não anunciar perfil/cadastro nem
  repetir a fórmula em todo turno. A leitura permanece; muda a maneira de
  conversar. Biblioteca, hipótese e informação ausente não viram lembrança
  atribuída à família. Candidata local, ainda sem novo teste de geração.
- Perfil, relato atual e histórico são fontes sobre a pessoa; materiais e
  prompts oferecem conhecimento e condução. Divergência é esclarecida.
- Apoio prático inclui demonstração, fazer junto e ajuda leve aceita. Não
  transformar ressalvas em conteúdo principal da resposta.
- Perfil, histórico e atualização permanecem nos fluxos atuais da Kolo.

## Aplicação da implementação descrita pelo Base44

Fonte: relatório, prompts e ZIP fornecidos pela responsável em 25/10. O ZIP
`kolo-de-mae-copy-244ff1c1 (1).zip` foi lido sem extração e tem SHA-256
`cf709124c3efc2c8a410c830346115a290b78be2e02c9cecc04f6af5be8714f7`.
Foram conferidos `base44/agents/*.jsonc`, `robotScripts.jsx`, `RoboChat.jsx`
e o formulário KoloVivo. O código confirma os doze temas, leitura do perfil,
diários e BPs; não confirma a execução atual do app Base44. Reaproveitar:
prompt por tema, contexto antes da redação,
abertura personalizada, histórico e caminhos de retrato/orientação/atividade/
crenças/reflexão/resumo. Adaptar: identidade única, leitura seletiva da biblioteca
Kolo, idade e comunicação reais. Modelo Base44 não identificado; sem hipótese
de modelo superior nem integração externa.

## Entrega e portões

1. Descoberta: entrada por tema e pedido natural; caso concreto não depende de
   escolher menu. Testar entrada vaga, tema novo e pedido já detalhado.
2. Dados: reusar o perfil e histórico existentes; BASE 2 gerada em build e BPs
   com filtro etário. Provar recuperação/injeção por IDs; uso por leitura de
   respostas reais do modelo em casos sintéticos.
3. Canais: contrato compartilhado em conversa web e Ayla oficial. História,
   output types, crise e pós-trial preservam seu próprio fluxo.
4. Identidade: nome/idade corretos, irmãos separados e autorrelato adulto.
5. Continuidade: menu respondido em linguagem natural; retomada com histórico
   e atualização continuam pelos mesmos fluxos. Não criar memória paralela.
6. Falha: tema desconhecido não inventa especialista/material; sem acervo, usar
   perfil e pedido. Nenhuma nova chamada de IA para escolher módulo.
7. Prova: suíte relacionada, typecheck, build, casos sintéticos com produtor real,
   Preview e aprovação da responsável. Nunca afirmar uso só porque foi injetado.
8. Rollout: `AYLA_QUALIDADE_RESPOSTA_V2`, já existente na PR #150. Off preserva
   comportamento publicado. Produção aguarda aprovação; rollback é off/revert.

Pendências relacionadas: PEND-208 (experiência candidata), PEND-207 (DNA),
PEND-017 (conhecimento) e PEND-229 (qualidade da fala). Nenhuma baixa por build.

## Comparativo editorial de 25 de outubro

[Seis perguntas e doze respostas reais](../auditorias/ayla-comparativo-base44-2026-10-25.md)
foram geradas com dados de demonstração fornecidos na conversa, sem acessar
contas familiares. Os casos cobrem alimentação, socialização/autoimagem,
autonomia, comunicação, brincadeira adulta e abertura de Foco. Área fixada,
contexto em memória e produtores reais: prova de texto, não de roteamento,
persistência ou entrega. A responsável pediu avaliar também negrito, respiro,
bullets e emojis; a comparação visual usa o componente real de markdown da
web e a normalização/divisão em bolhas reais do WhatsApp.

**FALHOU na equivalência editorial pretendida.** A abertura de Foco pergunta
novamente sobre atenção em interesses já registrada; faltam a apresentação e
os caminhos do exemplo. A brincadeira ainda vaza rótulos de instrução e propõe
adaptação não oral desnecessária para pessoa fluente. A web entrega mais
explicação e o WhatsApp continua mais restrito. Não liberar produção nem
considerar a nova experiência pronta com base em testes de código.

O material da pós completo permanece na PEND-104: não ativado por esta
candidata. A BASE 2 e as BPs publicadas são consultadas por tema; parte curada
da pós já integra BPs, mas isso não prova consulta a todo o corpus. Para a
pessoa de 19 anos do primeiro ensaio, Alimentação ficou sem BP elegível;
no comparativo de 18 anos há duas BPs. Não ampliar faixas automaticamente.
O XLSX v6 não foi integrado; testes por código KB permanecem pendentes.

Portões ainda abertos na PEND-208: aceite editorial, persistência/concorrência
em ambiente real isolado, acesso de áudio no navegador, responsividade e
smoke da nova Preview. Sem migração, importação ou alteração de produção.

## Plano de ação atualizado em 25 de outubro

Plano candidato para aprovação da responsável. Dona de produto e aceite:
Karina. Implementação, testes, rastreabilidade e entrega: Codex. Revisão do lote:
Claude, com decisões de conteúdo pela Kolo. Validação profissional da 013:
responsável ainda a definir. O plano não autoriza publicação automática.

### Estado conferido

- Produção em `main`, SHA `25e8891daf1e0d5bd881512e6f128742fdcd0184`,
  health às 18:33:55 de 25/10/2026 (São Paulo), com aplicação e banco saudáveis.
  Isso não comprova qualidade de resposta nem ativação desta candidata. O
  health atual não expõe a flag `AYLA_QUALIDADE_RESPOSTA_V2`.
- Worktree isolado `ayla-qualidade-brincadeiras`, branch
  `codex/ayla-qualidade-brincadeiras`, HEAD `6b94e96`, PR #150 em rascunho.
  As novas áreas, áudio e refinamentos ainda têm alterações locais não
  commitadas. A Preview anterior não comprova estes arquivos.
- Última rede focada: 44/44 testes, em cinco arquivos. A suíte anterior de
  4.244 aprovados e sete pulados e o build anterior não validam as mudanças
  feitas depois deles. Reexecutar antes do próximo envio.
- Ensaio v2: seis casos, dois produtores, 12 respostas reais com dados
  sintéticos. A abertura Foco apresentou propósito, fatos conhecidos, quatro
  caminhos e convite a áudio nos dois canais, sem repetir a pergunta anterior.
  A brincadeira adulta no produtor oficial caiu no piso infantil: segue
  reprovada. Artefato:
  `docs/auditorias/ayla-temas-modelo-2026-10-25-referencias-base44-v2.json`.
- Continuidade com duas ou três ofertas específicas já está no contrato local
  compartilhado; esse ensaio v2 foi iniciado antes do ajuste. Mindset,
  reflexão e alinhamento integral por tema com a pós ainda precisam de
  implementação/revisão e prova própria. Não estão aprovados por esses números.

### Entregas e dependências

**Entrega A: conversa da web e Ayla.** Melhorar a conversa com dados existentes,
temas, biblioteca já aprovada, acolhimento, reflexão e continuidade. Publicar
somente após Preview e aceite. Não depende de aprovar ou importar o lote Brinca.

**Entrega B: catálogo Brinca.** Contrato e carregamento isolado para QA,
correções candidatas, aprovação por versão e seleção/entrega rastreáveis.
Conteúdo em rascunho continua invisível à família. A integração em QA pode
avançar enquanto a Kolo decide as propostas; publicação do catálogo depende
dessas decisões. O bloqueio de uma atividade não paralisa as demais.

### Camadas e prova de aceite

| Camada | Ação e resultado esperado | Dificuldade | Prova exigida |
|---|---|---|---|
| 1. Identidade e leitura | Manter Kolo como fonte de dados. Resolver família e pessoa antes de recuperar fatos; preservar adultos e irmãos. Reusar idade, interesses, sensorial e comunicação existentes. | Alta | Cenários de adulto, duas pessoas na mesma família e acesso de outra família. Rastro de alvo e fontes, sem conteúdo sensível desnecessário. Zero troca de pessoa. |
| 2. Doze temas | Sensorial, Comunicação, Socialização, Imitação, Motor, Autonomia, Aprendizado, Foco, Rotina, Sono, Alimentação e Emocional, cada qual com propósito, consulta, perguntas e diferenciação próprios; uma Ayla visível. | Média | Doze introduções por canal. Para cada tema, dados presentes, ausentes e parciais. Caso concreto recebe ajuda sem exigir passar pela introdução. |
| 3. Abertura personalizada | Com informação, resumir o pertinente; com lacuna, pedir só o que falta em bullets e lembrar áudio. Texto livre não é campo vazio. Usar tom de continuidade: “Pelo que você já me contou…”, sem anunciar cadastro nem inventar a origem de um fato. | Média | Repetir o caso Foco e casos sem/parte dos dados. Zero pergunta já respondida, zero falsa lembrança e ausência de consulta não tratada como ausência de informação. |
| 4. Pós e biblioteca | Mapear cada área aos trechos aprovados e às BPs pertinentes, com versão e procedência. Distinguir fonte original, conteúdo curado e trecho efetivamente enviado ao produtor. Não ligar o corpus bruto inteiro nem afirmar cobertura integral sem prova. | Alta | Para cada área: fonte/seção, decisão que ela orienta, ID recuperado, ID entregue e leitura da resposta mostrando uso útil. Caso sem trecho pertinente declarado internamente, sem fonte inventada. PEND-104 permanece aberta até cumprir seu critério. |
| 5. Compreensão e hipóteses | Explicar possibilidades compatíveis com os fatos: o que pode estar difícil, como a pessoa pode estar vivendo a situação e qual observação ajuda a distinguir os caminhos. Não transformar hipótese em causa confirmada. | Alta | Pares de casos com o mesmo comportamento e contextos diferentes devem produzir orientações diferentes. Nenhuma emoção, intenção ou diagnóstico apresentado como fato sem evidência. |
| 6. Mindset e reflexão | Acolher, destacar recursos e conquistas reais, mostrar o que ajuda e o que pode atrapalhar, trabalhar a crença expressa e devolver uma ação ao alcance da família. Não chamar a mãe de vítima, culpá-la ou exigir positividade. | Média/alta | Casos de medo alimentar, “não quer aprender”, autoimagem e frustração após tentativa. A resposta identifica a crença relatada, oferece outra leitura e uma ação concreta; não inventa pensamentos da pessoa. |
| 7. Orientação completa | Entregar compreensão e possibilidades práticas no turno atual, com falas prontas e adaptação pertinente. Retirar conflitos de concisão que produzam ajuda incompleta. | Alta | Mesmas seis perguntas Base44, dados iguais e comparação sem edição da saída. Web e WhatsApp avaliados separadamente. Mais texto sozinho não aprova. |
| 8. Continuidade e descoberta | Após orientação substancial, duas ou três formas pertinentes de continuar: atividade, próximos passos, reflexão, retrato/conquistas ou outra entrega cabível. Oferecer exemplos quando pedirem ideias do que perguntar. | Média | Conversa com pelo menos três turnos: oferta → escolha em linguagem natural → entrega escolhida. Testar “primeira”, “outra opção”, “não funcionou” e “não quero continuar”, sem reiniciar apresentação ou repetir estratégia. |
| 9. Troca de assunto | Acolher tema complementar sem trocar a área sem necessidade. Mudança explícita acompanha o pedido e mantém a pessoa e o histórico. | Alta | Alimentação → sono → retorno à alimentação. Interesses, recusa alimentar e fatos do sono continuam vinculados ao mesmo indivíduo; nada é reapresentado como desconhecido. |
| 10. Apresentação e áudio | Negrito, respiro, bullets e emojis funcionais. Web com markdown renderizado; WhatsApp com normalização real, sem cortes ruins. Áudio transcrito, conferido e enviado conscientemente na web. | Média | Capturas da tela real no celular e desktop, navegação por teclado, áudio permitido/negado/interrompido e transcrição editada. Teste no canal, não só HTML de demonstração. |
| 11. Catálogo e brincadeira | Preservar fonte, código e versão. Separar status editorial, bloqueio de segurança e integração/testes. Filtrar elegibilidade antes de fornecer opções ao modelo; personalização muda a mecânica sem alterar limites ou inventar materiais. | Alta | 20 cenários gerais e 16 de catálogo, com saída real, código/versão, candidatos elegíveis e motivos de exclusão. Zero rascunho ou bloqueada entregue como recomendação. Adulto nunca recebe piso infantil. |
| 12. Registro e amanhã | Reusar fluxos de registro/atualização da Kolo e respeitar as confirmações de cada canal. Não salvar hipóteses como fatos. Retomar conversa e área; repetição, concorrência e falha não podem duplicar nem fingir sucesso. | Alta | Proposta → confirmação quando prevista → escrita conferida → nova leitura → conversa retomada. Injetar falha e duas requisições simultâneas. Testes com pessoas sintéticas em ambiente isolado, limpeza verificada. |
| 13. Produção e acompanhamento | Código, configuração, conhecimento e catálogo precisam ter versão identificável; logs reconstruíveis e retorno à versão anterior. Atualizar ajuda junto. | Alta | SHA e ambiente do deploy, flag efetiva, versão do prompt e fontes, resultado no canal real autorizado, registros persistidos e leitura de volta. Tempo até resposta útil, falhas e repetição acompanhados após publicação. |

As dificuldades são estimativas técnicas, não duração prometida. A janela
anterior de 30–60 minutos referia-se à Preview da conversa, não à integração
completa da pós, à correção das 28 propostas nem à publicação de todas as camadas.

### Pacote Brinca conferido

Arquivos recebidos em `C:/Users/karin/Downloads/`, preservados:

| Arquivo | SHA-256 |
|---|---|
| `Kolo_Brinca_Lote01_v6_Revisao_Critica.xlsx` | `97e1fe60eccc2e4b037902c3b35a5bea30918008497e1c820aacc973662f9e5b` |
| `Kolo_Brinca_Lote01_v6_pacote_integracao.json` | `5d7af04cb37e9e6495965729a711493329eb4cbd54b4ed22c2c0c1f70d9634c4` |
| `Kolo_Brinca_Lote01_v6_bancos_de_teste.json` | `6bb8cdf622cd3ed8f2db1299ce77a607a988ba804d6f0eb78c95d5d551015e28` |
| `Kolo_Brinca_Lote01_v6_guia_selecao.json` | `fbe625d22656cd5c9aae01917914392a0e437de4fc6503e733542c06846f8b38` |

Conferência independente: hash da origem v6 corresponde ao declarado;
ATIVIDADES (15 linhas × 32 campos), PASSOS (65 × 9) e CENAS_OPCIONAIS (2 × 6)
correspondem ao JSON sem divergência nos valores. Os cabeçalhos da v6 estão
na linha 4, não na linha 1. A revisão crítica contém 28 propostas (duas altas,
20 médias, seis baixas), decisões vazias e uma linha separada de exclusão da
013. O banco tem 20 cenários gerais e 16 futuros; campos de resultado vazios.
Nenhum desses cenários recebeu resultado por associação aos testes de código.

O pacote registra bloqueio explícito somente na 013, mas a revisão mais recente
aponta segurança alta na 001 e na 005. Há também achados de segurança na 006
(baixo) e na 011 (médio). O importador não poderá se guiar apenas pelo booleano
do JSON ignorando a revisão crítica. Proposta: manter 001/005 fora da entrega
até correção e revisão, e 013 fora até validação profissional; revisar também
006/011. Como todas as 15 são rascunho, nenhuma é elegível hoje para publicação.
As medidas sugeridas por Claude não constituem validação profissional automática.

Contrato proposto para integração, ainda a desenhar contra o banco existente:

- Reusar `codigo` como identidade editorial estável e definir identidade interna,
  versão imutável, hash de origem e eventos de aprovação/publicação. Não apagar
  v5/v6 nem promover revisões candidatas como se já fossem aprovadas.
- Reusar fontes de perfil existentes: `membros_atipicos.data_nascimento`,
  domínio sensorial (subcampo `sons`), comunicação (`forma`) e interesses
  (`como_e`/gostos), além do foco e histórico. Não criar outro perfil do catálogo.
  Oralidade/busca oral/pica exigem mapa de origem e estado conhecido/negado/
  desconhecido; relato de levar à boca não é diagnóstico de pica.
- Estruturar materiais obrigatórios/opcionais, limites, alternativas e eixos de
  adaptação para seleção; preservar o texto original ao lado da representação
  validada. Não depender de procurar uma frase livre para bloquear atividade.
- Idade ausente não vira idade presumida nem filtragem falsamente validada.
  Para escolher atividade dependente de faixa, pedir a idade ou recuperá-la se
  já existir; enquanto isso, não escolher código de faixa não verificada.
- Guia de seleção é derivado e não aprovado. Validar regras contra o conteúdo,
  incluindo idades, participantes, materiais e interesses não exemplificados.
  Não modificar o jogo de modo que elimine seu diferencial ou suas restrições.
- Em QA isolado, permitir testar candidatos claramente identificados; no caminho
  das famílias, exigir aprovação da versão, liberação de segurança e publicação.
  Zero elegível produz saída explícita e útil, não acesso oculto aos rascunhos.

### Ordem de execução e quem aprova

1. **Codex fecha a candidata de conversa.** Resolver fallback infantil, consolidar
   abertura, continuidade e reflexão; conferir biblioteca por área. Comparar
   respostas reais, incluindo turno seguinte. Rodar regressão, tipos, lint e
   build; revisar diff e reconciliar com a main atual sem sobrescrever outras
   frentes. Commitar e atualizar a PR #150, sem merge automático.
2. **Karina testa a Preview A.** Entregar link, SHA, estado da configuração e
   roteiro curto. Primeiro teste com pessoas sintéticas, sem poluir a conta
   real de Manu/Mario. Uso natural autorizado de Manu pode vir depois, com
   observação, sem fabricar fatos ou disparar mensagens por conta do agente.
   Aprovar texto, formato, opções, reflexão e continuidade; reprovação volta
   à implementação, não é escondida por ajuste manual da resposta comparada.
3. **Kolo decide o conteúdo do Brinca.** Aceitar/ajustar/recusar propostas por
   item. Recomendação: não ampliar a faixa da 004 sem nova revisão; padronizar
   “sensibilidade auditiva registrada”; definir profissional e local do laudo
   de validação da 013. Claude prepara nova candidata somente com decisões
   aceitas. Aprovar separadamente o conteúdo e sua entrega pela Ayla.
4. **Codex integra em QA e oferece Preview B.** Validar contrato, mapa de perfil,
   bloqueios, fonte/versões e seletor; executar os 20 + 16 cenários com
   evidência por caso e regressão das áreas que não usam catálogo. Nenhuma
   aprovação editorial nasce de um teste automatizado.
5. **Publicação por entrega, depois do aceite e da autorização.** Conferir
   código servido e configuração efetiva, não só status verde da Vercel.
   Não alterar Core/modelo/biblioteca/catálogo sem versionar o que mudou.
   A entrega A pode ser publicada antes da B; o sistema deve provar que a
   melhora não tornou rascunhos acessíveis. Plano de retorno validado antes:
   flag off ou reversão do código, fonte e versão anterior identificadas,
   sem apagar o histórico das famílias.
6. **Prova de produção e acompanhamento.** Em ambiente de produção, primeiro
   verificações somente leitura; testes de escrita apenas com QA realmente
   isolado e autorizado. Envio humano autorizado no WhatsApp segue
   `PROTOCOLO-TESTE-REAL.md`, reconstruindo turno, portas não disparadas,
   fala versus ação e “o que quase aconteceu”. Não disparar WhatsApp/e-mail
   pelo agente como validação. Conferir retomada no dia seguinte e revisar
   leitura de falhas/latência após 24 e 72 horas; automação apenas se solicitada.

### Dossiê exigido para declarar cada camada em produção

Cada caso aprovado precisa carregar ambiente, data/hora, SHA, identificadores
de QA/turno sem exposição pública de dados pessoais, pessoa em foco, versão de
prompt, fontes selecionadas/enviadas, entrada, saída sem edição, captura do
canal e resultado esperado/obtido. Quando houver escrita: operação tentada,
retorno conferido e leitura posterior. Fala “salvei” sem registro não aprova.

Medidas de qualidade: cobertura dos doze temas nos dois produtores, falhas de
identidade, fatos inventados, perguntas repetidas, qualidade editorial por tema,
seleção e entrega do caminho aceito, adequação etária e publicação indevida.
Comportamentos críticos exigem zero falha nos cenários obrigatórios. Qualidade
de texto exige aceite de Karina, não apenas juiz automático. Latência e custo
devem ser comparados à linha de base; o aceite vigente de PEND-215 é referência
para investigar regressão, não resultado já alcançado por esta frente.

Nenhuma camada recebe baixa apenas por estar no código, ter teste de contrato,
retornar health saudável ou constar num relatório como PASSOU. Se falhar uma
prova, registrar camada, causa, correção, novo ensaio e limite de publicação.

**Pendências:** PEND-208 atualizada e aberta; PEND-104 permanece como dependência
de conhecimento. PEND-017/207 e PEND-018 são consultadas para recuperação e
procedência, sem baixa ou nova numeração neste worktree. O estado oficial de
cada frente continua em `docs/PENDENCIAS.md`.

**Veredito da entrega completa neste momento: FALHOU.** Há melhora comprovada
na abertura sintética; a brincadeira adulta e as provas de publicação,
persistência e continuidade em produção ainda não cumprem o aceite. Este plano
define os portões para mudar esse veredito, não os antecipa.

## Avaliação de utilidade e atualização do perfil

Adição solicitada pela responsável em 25/10, para desenho e aprovação antes
de implementar novos registros. Não está implementada pelo contrato de tom.

### Fechamento da resposta

Depois de entregar ajuda e caminhos pertinentes, apresentar uma avaliação
discreta, sem obrigar a família a responder outra pergunta para continuar:

> Para eu saber se estou sendo útil, avalie esta resposta.

Na web: cinco estrelas selecionáveis (1 a 5), com opção separada
**0 — não ajudou**. Sem avaliação é `null`, nunca zero. Mostrar o significado
da nota ao selecionar e permitir corrigir a avaliação. Comentário opcional:
“Se não ajudou como você esperava, o que faltou ou poderia ser melhor?”.
Não exigir comentário para nota baixa; permitir comentar também nas demais.
As estrelas ficam fora do texto gerado, vinculadas à mensagem correta.

No WhatsApp: entrada inequívoca, como “nota 3” ou “avaliar resposta”, e
confirmação curta. Número solto não é avaliação automática: pode ser escolha
de caminho ou resposta a outra pergunta. Não acrescentar novo envio pelo
agente sem autorização. Definir frequência no aceite: resposta substancial
encerrada, sem pedidos em cascata durante crise, agradecimento ou recusa.

Campos mínimos propostos: mensagem/turno avaliado, canal, nota 0–5, comentário
opcional, data e versão de resposta/deploy; relação com família pela mensagem,
sem duplicar conteúdo pessoal. Validar autorização no servidor, repetição/
edição idempotentes, falha sem falso sucesso e consulta administrativa isolada.
Nota e comentário sobre a Ayla pertencem ao feedback, não ao perfil do membro.

Provas de aceite: seis valores possíveis e ausência distintos; teclado e leitor
de tela; avaliar/editar sem duplicar; família não avalia mensagem alheia;
nota baixa sem comentário funciona; falha de gravação aparece; número de
menu não vira nota e nota não dispara orientação/artefato. A média nunca
transforma zero em ausência nem usa apenas notas positivas; mostrar quantidade,
distribuição e comentários, com segmentação por tema/canal/versão.

### Memória útil na próxima consulta

Requisito: informação nova, relevante e explicitamente relatada pela família
precisa chegar ao perfil correto e estar disponível na próxima consulta.
Reusar o escritor e os campos existentes, sem outro perfil por especialista.
Não registrar avaliação da Ayla, hipótese, sugestão ainda não experimentada ou
uma fala sobre terceiro como fato do indivíduo em foco. Mudança de informação
deve preservar contexto temporal e histórico, sem apagar silenciosamente o
relato anterior. Ambiguidade de pessoa ou contradição que altere o sentido exige
esclarecimento, não preenchimento por inferência.

Estado investigado: o WhatsApp possui o escritor do extrator em
`lib/ayla/extrator-escrita.ts`; a produção reportou alcance `todas` no health
conferido, mas alcance não prova que um fato concreto foi salvo. A web possui
proposta e confirmação em `conversar/actions.ts`; a rota de resposta não
executa esse fluxo automaticamente. Portanto não afirmar “sempre atualiza”
antes de unificar a cobertura e provar os dois canais. A nova decisão de
captura contínua precisa conciliar os fluxos de confirmação e a procedência
dos fatos, sem dois escritores concorrentes.

Prova obrigatória em QA isolado: contar dado novo → extrair só fatos elegíveis
→ escrever e conferir retorno → ler o registro → abrir nova consulta, inclusive
em outro tema/canal, e demonstrar que o dado muda a orientação sem ser
perguntado outra vez. Exercitar dois irmãos, adulto, correção de um dado,
duplicata, falha, requisições simultâneas e consulta seguinte antes de terminar
um trabalho em background. Falha não pode produzir “guardei”; hipótese nunca
vira memória factual. Registrar origem por turno e resultado de escrita.

Essas duas camadas ampliam a Entrega A. A Preview da conversa pode demonstrar
texto e navegação antes delas, mas não será declarada entrega completa nem
produção aprovada até as provas de avaliação e memória serem cumpridas.

## Piloto escolhido em 28/10/2026 — Foco, sem Base44

Karina escolheu **Foco** como primeiro tema para demonstrar a qualidade na Web,
sem integração com o Base44. A decisão substitui Alimentação como primeiro
piloto, não elimina os outros temas nem aprova produção. Risco CRÍTICO mantido.
O código existente de áreas, contexto, produtor e apresentação será reutilizado;
nenhuma migração, modelo novo, perfil paralelo ou importação do Brinca.

Aceite editorial: apresentação com propósito; resumo fiel do conhecido; lacunas
em até três bullets e convite a áudio quando faltam dados; orientação completa
com explicação, ações e fala pronta; reflexão sobre a crença expressa sem culpa;
opções pertinentes para continuar; informação nova muda a orientação. Atenção
em interesses não prova má vontade; movimento não é prova de desatenção. Pessoa
adulta preserva sua autonomia. Interesse sozinho não prova padrão de atenção.

Primeira prova: cinco cenários sintéticos e nove turnos no engine/compositor
reais da Web, classificadores e gerador de IA reais, biblioteca apenas leitura.
Inclui referência adulta fornecida, abertura sem dados, dados parciais,
iniciação → refinamento por medo de errar e dois irmãos com alvo explícito.
Não lê/escreve o cadastro da Manu. Registro de expectativas não é nota de
aprovação; cada resposta integral fica preservada para revisão humana.

Baseline e repetição candidata estão em
`docs/auditorias/ayla-piloto-foco-2026-10-28-{baseline-1,candidata-1}.json`.
O pedido de ideias foi classificado como `desabafo` no baseline, retirando o
formato rico; a candidata classificou como `duvida` e entregou exemplos em
bullets. Na abertura parcial, o baseline ofereceu apenas caminhos; a candidata
retomou interesses e perguntou pelo padrão de atenção desconhecido. Correções
locais limitadas a Foco com `AYLA_QUALIDADE_RESPOSTA_V2` ativa, sem nova chamada
de IA ou heurística que sobrescreva uma classificação de crise/desabafo.

Os demais portões e bloqueios desta SPEC permanecem abertos. Uma repetição
melhor não prova estabilidade, equivalência ao Base44, apresentação no navegador,
isolamento remoto, memória persistida ou consulta integral à pós. A saída sobre
Lia ainda trocou a tarefa concreta por um exemplo de desenho e terminou com
ofertas sem destaque uniforme: ressalvas para o aceite, não aprovação automática.
A abertura conhecida ainda acumulou perguntas e menu; revisar redundância e
carga antes de aprovar. A nota de abertura é compartilhada, mas esta rodada
não comprova o canal WhatsApp. Testes e build no relatório de entrega.
Antes de ampliar: revisão por Karina, questões novas e conversa autenticada na
Preview com os dados existentes da Manu, sem gravar como fatos os exemplos
sintéticos. Reautenticação/deploy pendentes não podem ser contornados por push.

### Alinhamento humano de Foco após a simulação — 28/10/2026

A resposta sobre distração em sala recebeu avaliação positiva de Karina, com
ajustes: priorizar o que a mãe observa e pode experimentar em casa; escola é
fonte complementar, não condição para começar. Diferenciar iniciar, sustentar,
sequenciar e retomar em atividades reais e convites lúdicos, sem transformar a
casa em extensão da cobrança escolar nem prometer transferência automática.
Consultar os fatos já disponíveis antes das perguntas; não repetir perguntas
sobre interesse/atenção que já foram respondidas. Perguntar por exemplos e apoios
domésticos ainda desconhecidos, sem inventar que o perfil foi consultado.

Ao pedir brincadeiras, oferecer três propostas completas com mecânicas
distintas, salvo quantidade diferente pedida pela família. Cada uma deve
permitir começar sem improvisar, com materiais, convite, participação real,
surpresa/virada e continuidade. A criança ou pessoa adulta também escolhe e
conduz; exercício de obedecer ordens não vira brincadeira só por ganhar título.
Interesses são portas de entrada, não uma restrição a todas as opções: pode
haver propostas sem cozinhar, bonecas, água ou massinha, mantendo adequação à
idade, comunicação, preferências e limites. Quando o interesse for usado, deve
ajudar a experiência, não apenas trocar a decoração de uma mecânica repetida.

Os exemplos de cinco anos e interesses são **cenários de simulação**, não
atualizações do cadastro da Manu, e não aprovação/publicação de atividade KB.
Este alinhamento é aceite de direção editorial, não prova de que o modelo no
app já a segue. Falta incorporá-lo ao contrato candidato e repetir os casos
exatos com o produtor real, preservando o baseline e os controles de rollback.

Em `2026-10-28T19:27:55.721Z`, health da Preview ainda servia `51600b8`, flag
V2 e isolamento ligados, `db.ok=false`, credenciais de servidor/IA ausentes no
runtime e `conversa_web_configurada=false`. A tentativa de redeploy somente
Preview, branch exato e sem cache, voltou a exigir **Reauthenticate**. Código
de e-mail deve ser solicitado/preenchido pela titular diretamente na Vercel.
Nenhum novo deploy, código de autenticação, commit/push ou conversa de QA foi
concluído nesta etapa. Não pedir teste da família antes da configuração efetiva.

### Complementos editoriais e configuração resolvida — 28/10/2026

Interesse é pista opcional também nas orientações, não assunto obrigatório.
Personalizar inclui idade, comunicação, contexto, experiências e apoios já
conhecidos; ampliar o repertório pode ser mais pertinente do que repetir o favorito.
No piloto de Foco, cada brincadeira explica brevemente **O que vocês exercitam**,
ligando a habilidade à ação real do jogo e, quando presente, ao vínculo pela
iniciativa acolhida, criação conjunta e diversão compartilhada. Sem lista genérica,
promessa de resultado ou transferência automática para a sala de aula.
O repertório pode incluir memória, imitação com troca de papéis, movimento,
percursos e chefinho mandou com iniciativa também da criança. Banco temático
orienta e amplia, não limita a criação. Pausas de movimento/respiração são
possibilidades pertinentes, sem ritual obrigatório nem condição para participar.

A titular concluiu a reautenticação. O redeploy Preview Gtdkqzrsw87tkZQKrPP2CZW1L13h
ficou Ready com SHA `51600b8`; health em `2026-10-28T19:45:28.384Z` confirmou
`db.ok=true`, credenciais necessárias presentes, `conversa_web_configurada=true`,
provedor OpenAI e isolamento Preview ligado. Os dois crons continuaram exibindo
`preview_somente_conversa`. O bloqueio de reautenticação desta etapa foi resolvido;
as provas anteriores permanecem como histórico. A conversa exige login da titular.
Esse deploy ainda não contém os ajustes locais de Foco e não prova aceite humano.
