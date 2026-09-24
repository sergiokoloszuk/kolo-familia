# Análise de produto — Kolo Família real

**Data:** 24/09/2026
**Modo:** leitura de produção, sem escrita em banco, sem WhatsApp e sem contato com famílias.
**Janela principal:** 06/09/2026 a 24/09/2026 — período posterior à publicação do Core v11.
**Produção conferida:** `main`, SHA `a89cad474f1b13ae5ef21eb477972e516ad8de2b`, health HTTP 200.
**Privacidade:** três contas internas excluídas; IDs pseudonimizados; nomes, contatos, documentos e links removidos dos exemplos.

## 1. Resumo executivo

O Kolo Família já entrega valor conversacional real quando responde a uma necessidade que a família acabou de trazer. No período, 40 famílias não internas enviaram 472 mensagens; 23 delas conversaram em dois ou mais dias. Entre 354 saídas reativas com janela completa de 72 horas, 238 receberam nova fala em até 24 horas (**67,2%**).

O maior vazamento de continuidade observado não está na resposta reativa principal. Está na passagem entre conversa, iniciativa e acompanhamento:

- 405 das 870 saídas foram proativas;
- a taxa observada de resposta em 24 horas foi **20,2%** para proativas, contra **67,2%** para reativas;
- `trial_d0`: 2 respostas em 42 mensagens maduras (**4,8%**);
- `trial_d3`: 5 em 36 (**13,9%**);
- `plano_seguimento`: 1 em 16 (**6,3%**);
- 36 planos foram criados para 25 famílias, mas apenas **1** tinha resultado registrado;
- não havia feedback nem NPS registrado.

Isso não prova que as mensagens causaram silêncio. Proativas partem de outra intenção e muitas respostas completas não exigem retorno. Mas o padrão é consistente o suficiente para priorizar testes de continuidade e acompanhamento antes de atribuir retenção à falta de conhecimento.

O baseline da incorporação da Pós também mostrou que parte das seis decisões já aparece no sistema atual: a Ayla entrou no padrão da brincadeira antes de variar, checou mudança abrupta sem alarmismo, propôs mediação escolar concreta e reduziu uma atividade ao primeiro passo. As lacunas mais claras foram reconhecer o puxar pela mão como comunicação já existente e considerar sensorial antes de transformar o mercado em treino de regra. Portanto, a Pós deve entrar apenas onde muda decisão — não como nova camada geral.

## 2. O que as famílias parecem valorizar

### Fatos

- 23 de 40 famílias com inbound voltaram em mais de um dia; 2 estiveram ativas em cinco ou mais dias.
- Houve 35 falas pedindo aprofundamento, como “como?”, “me mostra” ou “passo a passo”.
- Houve 7 falas com vocabulário de tentativa/resultado. A detecção textual é conservadora e alguns usos são ambíguos; os exemplos foram revisados qualitativamente.
- Nas respostas reativas seguidas de nova fala em até 24 horas, 40,3% continham uma ação concreta e 23,5% uma frase pronta.
- Boas-vindas tiveram 13 respostas em 35 mensagens maduras (**37,1%**) mesmo com mediana de aproximadamente 810 caracteres.

### O que isso sugere, sem afirmar causalidade

As famílias respondem quando há um assunto próprio em andamento, quando a Ayla organiza uma situação complexa e quando existe uma próxima fala natural. Comprimento isolado não explica continuidade: respostas reativas com e sem retorno tiveram a mesma mediana de 407 caracteres, e boas-vindas longas ainda abriram conversa. A pergunta de produto não é “como encurtar tudo?”, mas “qual parte desta mensagem muda a ação agora?”.

Os melhores exemplos combinam:

- priorização de uma frente;
- ação ou frase utilizável;
- uso de um dado concreto da criança;
- uma pergunta que discrimina o próximo passo;
- retomada do que a família acabou de corrigir ou acrescentar.

## 3. Onde perdemos continuidade

### 3.1 Iniciativas têm retorno muito menor

**Fato:** proativas maduras receberam resposta em 20,2% dos casos; reativas, 67,2%.

**Hipóteses:** iniciativa pode chegar fora da necessidade atual; alguns tipos pedem informação sem entregar valor; mensagens de artefato são contabilizadas individualmente; famílias podem ler sem responder.

**Evidência adicional:** entre proativas sem resposta, 90,8% continham pergunta, 39,9% mais de uma pergunta e 58,3% um CTA. O dado sustenta testar menos pedidos por mensagem, mas não prova que perguntas causam silêncio.

### 3.2 Trial cria entrada, mas pouco retorno no dia seguinte

Na coorte pós-Core v11:

- 72 contas não internas foram criadas;
- 51 concluíram onboarding;
- 34 enviaram alguma mensagem;
- entre 45 contas com D1 já observável, **17,8%** voltaram no dia seguinte;
- 21 das 34 que conversaram voltaram em algum outro dia (**61,8%**);
- entre 29 contas com oito dias completos, nenhuma aparecia como `active` em `subscription_accesses`.

**Fato:** não houve conversão registrada na coorte madura observada.

**Não sabemos:** se o motivo foi valor insuficiente, preço, timing, falha operacional, perfil da aquisição ou decisão externa. Não há dado para atribuir causa.

### 3.3 Acompanhamento não fecha o ciclo

- 36 planos / 25 famílias / 1 resultado registrado.
- 6 rotinas / 5 famílias / 4 resultados registrados.
- 17 mensagens `plano_seguimento`, com 1 resposta em 24 horas entre 16 maduras.
- Zero feedbacks e zero avaliações NPS.

O produto cria artefatos, mas quase não registra se ajudaram. Sem resultado, a Ayla perde a matéria-prima para dizer “isso funcionou nessa condição” e personalizar o próximo passo.

### 3.4 Telemetria mistura conceitos

Foram registradas 223 saídas com tipo `rotina`, mas apenas 6 linhas novas em `rotinas` no período. O tipo de mensagem está sendo usado para iniciativas, cartões e conduções diferentes. Isso dificulta responder qual recurso foi usado e qual mensagem gerou retorno.

## 4. O que já está muito bom e devemos proteger

1. **O caminho reativo oficial.** Houve 415 chamadas `ayla_experimental` e 406 `decisao_turno`; o classificador antigo apareceu apenas 42 vezes. O sistema avançou em direção a um decisor coerente com a fala final.
2. **Capacidade de organizar múltiplas frentes.** Em conversa real sobre escola, banho e celular, a Ayla priorizou a escola e depois adaptou o banho às limitações reais da casa.
3. **Frases utilizáveis.** Há exemplos consistentes de linguagem pronta para a família usar sem receber uma aula.
4. **Segurança proporcional.** O sistema consegue combinar ação cotidiana e ressalva de segurança sem transformar toda situação em emergência.
5. **Perfil Vivo disponível.** 228 famílias reais tinham Perfil Vivo; o sistema possui base para personalização longitudinal.
6. **Retorno em mais de um dia.** 23 das 40 famílias que conversaram voltaram em datas diferentes. Existe relação, não apenas uso pontual.
7. **Canal de áudio.** Foram 104 chamadas de transcrição, sinal de uso efetivo de uma modalidade importante para relatos espontâneos.

## 5. Principais oportunidades de melhoria

### A. Experiência conversacional

**Problema observado:** algumas respostas tentam resolver várias frentes e algumas iniciativas fazem duas ou mais perguntas.

**Evidência:** 10,1% das respostas reativas continuadas tinham múltiplas perguntas, contra 15,5% das reativas sem retorno; nas proativas, múltiplas perguntas ficaram próximas de 40%. Há respostas reais acima de 1.200 caracteres tentando cobrir escola, banho e celular de uma vez.

**Hipótese:** a família consegue continuar quando a resposta acompanha a complexidade, mas perde clareza quando não existe uma prioridade explícita.

**Mudança possível:** aplicar “uma decisão agora” também às proativas e aos casos multitema: escolher uma frente, ajudar e deixar as demais registradas.

**Onde mexeria:** Core/forma para reativas; templates e `mensagemEspontanea.ts` para proativas.

**Risco:** encurtar segurança ou ignorar uma segunda urgência.

**Teste:** replay de casos multitema e A/B de proativa com um único convite; medir resposta e qualidade, não só tamanho.

### B. Personalização

**Problema observado:** o produto possui Perfil, mas não registra qual fato sustentou a estratégia final.

**Evidência:** Perfil Vivo em 228 famílias, completude mediana de 27%; metadata de outbound registra entrega/lacuna, não a proveniência da personalização.

**Hipótese:** há personalização boa em casos individuais, mas não conseguimos medir cobertura nem distinguir nome citado de estratégia realmente adaptada.

**Mudança possível:** registrar somente IDs/categorias dos fatos usados — nunca o texto sensível — e se interesse, sensibilidade, habilidade ou tentativa anterior mudou a ação.

**Onde mexeria:** observabilidade do produtor e rastro do Perfil Vivo.

**Risco:** telemetria excessiva ou exposição de dado pessoal.

**Teste:** auditoria de 20 turnos com rastro mínimo e conferência manual.

### C. Conhecimento

**Problema observado:** duas decisões específicas do baseline ainda não ficaram corretas: puxar pela mão foi tratado principalmente como oportunidade de substituir por comunicação “mais clara”; no mercado, a primeira hipótese virou regra/resposta ao chamado, sem checagem sensorial.

**Evidência:** seis execuções com modelo real e fluxo local atual. Os demais quatro grupos da Pós já apareceram parcial ou integralmente.

**Hipótese:** faltam poucas entradas editoriais aderentes, não uma nova base.

**Mudança possível:** uma BP de comunicação funcional e complemento sensorial/foco; complementar atividade apenas se a bancada provar mudança. Proteger socialização, brincadeira e mudança abrupta onde já funcionam.

**Onde mexeria:** BPs existentes e, apenas onde não há equivalente, poucas BPs novas.

**Risco:** duplicar repertório, aumentar teoria ou ranquear uma BP genérica acima de outra mais aderente.

**Teste:** seis A/B, Perfil Karina/Manu e sete regressões PEND-209.

### D. Continuidade e memória

**Problema observado:** tentativas e resultados raramente fecham o ciclo de produto.

**Evidência:** 36 planos, 1 resultado; 6 rotinas, 4 resultados; apenas 7 inbounds com linguagem de tentativa/resultado na janela.

**Hipótese:** o produto cria a estratégia, mas o acompanhamento não encontra o momento ou a formulação certa.

**Mudança possível:** retomada específica da tentativa, com uma pergunta factual curta sobre o efeito, e persistência do resultado.

**Onde mexeria:** tentativas acompanhadas/continuidade. Há outra frente local trabalhando nisso; não deve ser misturada a esta missão.

**Risco:** cobrança invasiva, repetição ou conflito com Trial.

**Teste:** controlar uma tentativa, observar retorno em 24/72 horas e provar que o próximo turno muda com o resultado.

### E. Trial e retenção

**Problema observado:** D0/D3 têm pouco retorno e a coorte madura não converteu.

**Evidência:** D0 4,8%, D3 13,9%; D1 17,8% na coorte observável; 0 `active` em 29 contas maduras.

**Hipótese:** o Trial comunica prazo/convite melhor do que valor acumulado; também pode haver causas externas não medidas.

**Mudança possível:** cada contato do Trial deve retomar um fato/resultado ou entregar uma microajuda antes de falar de prazo.

**Onde mexeria:** jornada do Trial e iniciativas, não Core geral.

**Risco:** atribuir queda a copy quando aquisição/preço podem dominar.

**Teste:** coorte controlada, resposta D0/D3, D1, segundo dia ativo e conversão; manter origem de aquisição como estrato.

### F. Produto / UX

**Problema observado:** WhatsApp concentra uso; a web teve 36 mensagens de usuário de 11 famílias e nenhum relatório novo.

**Evidência:** telemetria do período.

**Hipótese:** os recursos web podem ser difíceis de descobrir ou dispensáveis no momento; volume não distingue as duas coisas.

**Mudança possível:** não empurrar recurso cedo. Oferecer a web quando ela resolve a necessidade atual, com retorno ao ponto exato da conversa.

**Onde mexeria:** links contextuais, descoberta e retomada WhatsApp ↔ web.

**Risco:** reduzir descoberta de recursos úteis.

**Teste:** evento de abertura/conclusão por recurso e retorno à conversa, sem rastrear conteúdo sensível.

### G. Iniciativa espontânea

**Problema observado:** a proativa usa prompt próprio, não o Core v11, embora carregue partes do Perfil.

**Evidência:** `mensagemEspontanea.ts` contém `SYSTEM_PROMPT` próprio; foram 305 chamadas `ayla_espontanea` e 405 saídas proativas.

**Hipótese:** duas experiências de voz e decisão coexistem; perguntas genéricas podem competir com o assunto real.

**Mudança possível:** primeiro alinhar os princípios mínimos do Prompt Mestre e limitar a uma pergunta; depois avaliar unificação arquitetural em missão separada.

**Onde mexeria:** iniciativa espontânea.

**Risco:** afetar cadência e volume de comunicação com famílias reais.

**Teste:** bancada com contexto real anonimizado e rollout pequeno com métrica de resposta/opt-out.

## 6. Ganhos rápidos

1. Incorporar apenas as duas lacunas de conhecimento claramente demonstradas — comunicação funcional e sensorial no contexto — e não duplicar as quatro decisões já presentes.
2. Fazer proativas entregarem uma única ajuda ou pergunta, nunca duas solicitações no mesmo envio.
3. Separar na telemetria `rotina_artefato`, `rotina_convite`, `rotina_followup` e `rotina_card`.
4. Registrar resultado de plano/rotina com uma pergunta factual e opção simples, sem abrir questionário.
5. Acrescentar rastreabilidade mínima de personalização: categoria do fato usado e se ele mudou a ação.

## 7. Mudanças estruturais

1. Um estado explícito de tentativa/resultado e assunto em acompanhamento, consumido por reativa e proativa.
2. Uma única disciplina de experiência para mensagens escritas por modelos, sem exigir que todos os recursos usem o mesmo motor.
3. Jornada do Trial orientada por valor acumulado e resultado observado, não apenas dia/calendário.
4. Taxonomia única de eventos e recursos, capaz de distinguir mensagem, artefato, abertura, uso e resultado.

## 8. Não conseguimos saber ainda

| Pergunta | Dado que falta | Instrumentação mínima e privada | Decisão que habilita |
|---|---|---|---|
| Qual resposta foi personalizada de verdade? | Proveniência do fato usado | IDs/categorias não textuais dos fatos que mudaram a ação | Priorizar Perfil e medir cobertura |
| Por que uma família não respondeu? | Feedback explícito ou experimento | Não inferir; amostra voluntária curta e opt-in | Separar silêncio normal de fricção |
| O plano foi executado? | Tentativa e resultado | `tentativa_id`, estado, data e resultado categórico | Melhorar acompanhamento |
| A família abriu/usou o recurso web? | Eventos de abertura/conclusão | Evento por recurso, sem conteúdo da criança | Avaliar descoberta e UX |
| Por que não converteu? | Razão declarada, origem e exposição à oferta | Evento de oferta + resposta opcional de motivo | Separar copy, preço, timing e aquisição |
| Quanto BP/Perfil mudou a fala em produção? | Rastro de decisão | IDs de BPs e categorias do Perfil injetadas/usadas | Investir em conhecimento ou recuperação |

## 9. Cinco conversas representativas

### 1. Complexidade bem organizada, mas resposta extensa

**Entrada:** responsável relata escola, banho e celular como três frentes difíceis.
**Resposta:** a Ayla prioriza a escola, oferece frase pronta e adapta banho/celular, em cerca de 1.200 caracteres.
**Reação:** a família responde em três minutos com detalhes sobre barulho, bullying e aprendizagem.
**Aprendizado:** comprimento não impediu continuidade porque houve entendimento e priorização; ainda assim, três orientações no mesmo turno excedem a “próxima informação certa”.

### 2. Personalização percebida e retorno no dia seguinte

**Entrada:** “Quero mais ideia prática para testar em casa.”
**Resposta:** brincadeira de espera usando desenho ou Lego, com timer, frase pronta e critério para encerrar.
**Reação:** no dia seguinte, “Não aceita não”. A Ayla responde com poucas palavras, escolha limitada e uma pergunta de contraste.
**Aprendizado:** interesse muda a mecânica e a família volta; falta rastro para provar se Lego veio do Perfil ou do histórico.

### 3. Ação escolar concreta

**Entrada:** relato de barulho, bullying, mudança de escola e dificuldade de aprendizagem.
**Resposta:** reunião com direção/coordenação, adulto de referência, local tranquilo, proteção nos momentos de risco e demandas reduzidas.
**Reação:** a família continua imediatamente, agora explicando por que a estratégia do banho não cabe na casa.
**Aprendizado:** a Ayla diferencia sofrimento escolar de “falta de esforço” e produz pedido adulto concreto; depois aceita a correção contextual.

### 4. Iniciativa genérica abre menu em vez de retomar

**Entrada da Ayla:** mensagem longa explicando que “quanto mais você me conta, mais consigo enxergar o panorama”.
**Reação:** a pessoa responde apenas “Bom dia”.
**Resposta seguinte:** menu com nove temas e pedido para escolher número.
**Aprendizado:** o produto fala sobre personalização em vez de demonstrá-la. É uma experiência que um chatbot genérico poderia reproduzir quase igual.

### 5. Resposta completa sem retorno — não confundir com rejeição

**Entrada:** pedido de atividades e brincadeiras.
**Resposta:** três atividades executáveis, aceitando gesto/apontar e orientando parar enquanto ainda estiver divertido.
**Reação:** nenhuma em 72 horas.
**Aprendizado:** o silêncio é fato; “não gostou” não é. A resposta pode ter resolvido o pedido, pode ter sido longa ou pode não ter sido executada. Sem resultado/feedback, não sabemos.

## 10. Distância para o Prompt Mestre da agência

| Princípio da agência | Produto atual | Evidência | Gap |
|---|---|---|---|
| Ajudar primeiro | Forte no reativo; fraco em parte das proativas | ações concretas em conversas reais; proativas quase sempre perguntam | iniciativa precisa entregar valor antes do pedido |
| Próxima informação certa | Parcial | boas priorizações, mas respostas multitema >1.200 chars | escolher uma frente com mais disciplina |
| Personalização percebida | Existe, não mensurável | Perfil em 228 famílias; exemplos com interesse/condição | falta rastro de qual fato mudou a ação |
| Continuidade | Parcialmente forte | 23/40 famílias em mais de um dia | resultados de planos/tentativas quase ausentes |
| Não repetir perguntas | Não mensurável em escala | histórico existe; exemplos de menus genéricos | falta estado explícito/pergunta já feita no rastro |
| Uma pergunta importante | Boa no reativo, pior na proativa | múltiplas perguntas: 10,1% nas reativas continuadas; ~40% nas proativas | aplicar a mesma disciplina às iniciativas |
| Conversa curta | Proporcional em muitos casos | mediana reativa 407 chars; complexidade gera respostas maiores | tamanho deve seguir decisão, não teto cego |
| Conhecimento por trás | Geralmente sim | termos técnicos raros nas falas | lacunas pontuais A/C, sem necessidade de nova base |
| CTA específico | Parcial | CTAs específicos existem; proativas usam CTA em excesso | convite precisa nascer da ajuda e não substituí-la |
| Acompanhamento | Fraco | 36 planos e 1 resultado | fechar o ciclo tentativa → efeito → próximo passo |

## 11. Recomendação de próxima missão

**Missão fechada: “uma tentativa, um resultado, um próximo passo no Trial”.**

Selecionar um único tipo de estratégia entregue durante o Trial, persistir qual ação foi proposta, fazer uma retomada factual no momento certo, registrar o resultado sem texto sensível e adaptar o próximo turno. Homologar com coorte pequena por: resposta ao follow-up, resultado registrado, retorno em outro dia e ausência de repetição/opt-out.

Essa missão ataca o maior gap sustentado por dados — continuidade acumulada — sem reescrever o Core, sem criar nova base e sem confundir silêncio com insatisfação.

## Fontes e limites

- Extração agregada e candidatos anonimizados: `docs/auditorias/produto-real-2026-09-24.json`.
- Documento-âncora: transcrição fiel do `AYLA_KOLO_FAMILIA_PROMPT_MESTRE.pdf` em `docs/documentos-ayla/prompt-mestre-agencia-v1.md`.
- Arquitetura e histórico: auditorias anteriores, rechecadas contra o SHA ativo quando usadas.
- Não houve acesso ao motivo subjetivo de abandono, nem experimento causal, nem contato com famílias.
