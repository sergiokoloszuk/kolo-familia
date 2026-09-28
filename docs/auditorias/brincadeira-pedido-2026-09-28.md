# Pedido de brincadeira — baseline e gate

Data: 28/09/2026. Família da bancada sintética; Core, classificador, BP e
modelo reais. Banco somente leitura e nenhuma mensagem enviada. Reproduzir com
`scripts/bancada/brincadeira-pedido-ab.mjs` e Node 24 com
`--experimental-transform-types --use-system-ca` e env local do projeto.

## Baseline congelado antes da correção

| Pedido | Skills / BPs | Resposta A | Julgamento |
|---|---|---|---|
| Brincadeira para lidar com barulho no mercado, gestos | sensorial + comunicação / 2 | “Mercado dos dinossauros”; escolher alimento, acrescentar sons suaves, treinar pausa | É ensaio sensorial, não jogo compartilhado; reproduz queixa da prova real |
| Brincadeira para foco, começa e abandona | foco / 2 | “Bolo do dinossauro”, três etapas e observação | Executável, mas mais tarefa estruturada do que brincadeira |
| Brincadeira nova após restaurante de dinossauros | nenhuma / 0 | “Cozinha dos dinossauros”, mistura e serve | Repetição da mecânica anterior com novo nome |
| Como ajudar com barulho no mercado | sensorial / 2 | Horário vazio, observar e combinar saída | Correto para *manejo*; não deve ser forçado a virar jogo |

Produção, 28/09 09:45 BRT, SHA `151ff36f04e4192453a7a30a0a4b43e7cff152c7`:
pedido explícito de brincadeira para Manu → “mercadinho” com gestos e som →
tutorial do Lúdico. Metadado marcou `historia_whatsapp.origem=resposta_ao_tema`;
não havia pedido atual de história. A primeira bolha chegou ~14,6 s após o
início; duração total do turno ~26,6 s. O mecanismo de detecção leu histórico
familiar, mas o motivo exato da falsa origem ainda não é reconstituível pelos
eventos persistidos. Não inferir que o gerador recebeu uma BP de brincar:
classificação da prova real foi sensorial + comunicação.

## Aceite antes de publicar

1. Um pedido de brincadeira gera **três opções**, com mecânicas distintas,
   objetivo lúdico, começo, papéis reais e escolha da criança; cada uma
   funciona mesmo retirando o objetivo terapêutico. Participação por gesto
   vale, sem exigir fala ou olhar. Alternativas aparecem em bullets, não como
   passos numerados. Cada uma indica, em linguagem simples, uma capacidade
   efetivamente convidada pela ação; não promete ganho nem transforma jogo em
   exercício. O perfil e a idade calibram a complexidade, sem inferir atraso
   só pela idade.
2. Sensibilidade sensorial não vira exposição graduada automática. Há saída
   e ajuste quando a criança não quer continuar.
3. A atividade nova não reembala o jogo anterior; interesse é veículo, não
   o único enredo disponível.
4. Pedido de manejo continua recebendo manejo; pedido de história legítimo
   continua entregando história; pedido de brincadeira não dispara guia do
   Lúdico nem suprime botões de aprofundamento por história falsa.
5. BPs pertinentes continuam disponíveis; a resposta B muda uma decisão útil
   e não só a redação. Sem nova chamada LLM, sem latência relevante adicional.
6. A/B com mesmo Perfil e histórico, regressões, typecheck, build e prova
   interna no WhatsApp antes de qualquer ativação global.

## Candidata local — ainda não publicada

Uma instrução de comportamento limitada a pedidos explícitos de brincar foi
injetada no produtor, depois das BPs e sem modelo adicional. O detector de
história veta pedido atual explícito de brincadeira, mesmo diante de um aceite
ou pergunta anterior sobre história. O tutorial só segue quando a resposta
tem forma de história. Replay somente leitura: das quatro respostas de
produção marcadas como história, as três narrativas passam no verificador e
o “mercadinho” incorretamente marcado é recusado (3/4).

No A/B sintético, a primeira candidata ainda propôs sons suaves no mercado:
**reprovada e refinada**. Depois, três replays do caso de mercado não
introduziram som de propósito e passaram a trazer brincadeira compartilhada.
A preferência da usuária por três alternativas foi incorporada ao desenho:
os dois replays mais recentes geraram três bullets separados, com título e
participação por gesto. Uma amostra intermediária ainda reembalou uma busca em
três nomes, e outra colocou a primeira opção no preâmbulo; por isso o gate
agora exige mecânicas diferentes e três blocos visuais. O pedido-controle
“como ajudar no barulho” continuou recebendo manejo, não jogo.

Em 28/09 a usuária explicitou que prefere **três alternativas** e quer ver
o que cada uma contribui para aquela criança: foco, comunicação ou apenas
diversão e vínculo, quando corresponder à brincadeira. O primeiro replay com
esse enriquecimento trouxe três jogos no mercado, mas repetiu o recurso de
"erro de propósito" em mais de uma opção. Outro replay omitiu o benefício
da primeira opção. Ambos são falhas editoriais; o critério foi apertado e
precisa de novo replay, sem inferir aprovação desses exemplos.

A usuária também reprovou o nível de detalhe das três ideias: não dava para
saber o que o adulto fala nem como a filha participa. Gate acrescido: cada
brincadeira mostra cenário, fala pronta do adulto, resposta possível da criança
segundo seu modo de comunicação e reação seguinte do adulto. Para Manu, gesto
é resposta válida; não inventar uma fala obrigatória. Novo replay local do
mercado gerou três blocos com esses turnos explícitos e uma contribuição por
jogo, com 2 BPs injetadas e ~9,6 s de geração. Ainda há pontos editoriais a
avaliar (por exemplo movimento do carrinho no mercado); não é validação real.

Isto é evidência de direção, não prova de robustez geral nem do canal real.
O gerador ainda decide a redação; sem schema de três itens, o texto do prompt
sozinho não é garantia matemática de sempre haver três. Não declarar o
produto pronto até regressão, QA interna e auditoria de latência.

## Portões técnicos e publicação de preview

Commit isolado `93d96a73cb9486c0998c7b10b73b0304d0518307` no branch
`codex/historia-whatsapp-entrega`; diff de 10 arquivos só desta missão,
sem memória, latência ou formatação de outras frentes. Última suíte local:
4.108 testes passaram, 7 pulados, 2 falhas já presentes no baseline
(PEND-205 e PEND-214); typecheck e build Next/webpack passaram.

O preview Vercel `GbH5cktwqM2uGW2CrVBxvtBNXGCm` ficou **Ready** para esse
SHA. Produção permaneceu em `151ff36f04e4192453a7a30a0a4b43e7cff152c7`.
O domínio de preview redireciona `/api/health` para a proteção de acesso da
Vercel; não foi possível provar health externo nem executar um turno WhatsApp
real por esse endpoint. Não contornar a proteção. Nenhuma família recebeu a
candidata e não houve ativação global.
Health público da produção em 28/09 às 12:15 BRT: `ok: true`, banco `ok: true`,
commit `151ff36f04e4192453a7a30a0a4b43e7cff152c7` em `main`.

Replays locais adicionais com o modelo real: mercado (3 amostras), foco,
pedido livre, fala emergente (3 anos), adolescente (14 anos) e manejo-controle.
O prompt mais recente trouxe três blocos com turnos concretos, mas qualidade
do caso de mercado ainda oscilou entre jogo envolvente e escolha comum com
fantasia superficial. Uma comparação única com `gpt-6-sol` foi só bancada e
não mostrou ganho suficiente para justificar mudança de modelo/latência.
Por isso o **gate editorial e o gate de canal real seguem abertos**.

## Continuação: repertório de mecânicas (candidata local, não publicada)

Em vez de somar mais uma proibição genérica, acrescentei uma seleção curta de
três mecânicas candidatas ao pedido explícito de brincar. O contexto de mercado
recebe mímica com personagem, apelido absurdo seguro e história de superpoder;
outros pedidos recebem pistas, faz-de-conta e construção. É material de
planejamento para o mesmo gerador, depois das BPs, sem chamada de modelo extra
e com precedência explícita do Perfil/BPs. Não é resposta fixa à família.

O A/B sintético no caso decisivo de mercado mostrou melhora na separação das
três opções e preservou gestos, pausas e duas BPs recuperadas. Porém, as três
amostras ainda expuseram falhas diferentes: (1) escolha de trajeto travestida
de jogo e repetição do dinossauro; (2) exemplo inseguro de sabonete como
comida; (3) terceira opção sem a consequência concreta que o adulto deve
encenar. Os dois primeiros desvios foram removidos do estímulo, mas o terceiro
permaneceu no último replay. O caso de foco trouxe três jogos mais executáveis.
Testes unitários 6/6 e typecheck passaram. **Veredito editorial: FALHOU** para
publicação; a candidata segue apenas no working tree. Não houve novo commit,
deploy ou envio WhatsApp nesta continuação. Próximo passo: trocar a
dependência de uma única geração livre por saída estruturada de três jogos,
validar cada roteiro (fala → ação da criança → virada específica → segunda
rodada) e regenerar apenas a opção insuficiente, sem aumentar a resposta final.

Primeiro subpasso dessa validação: auditoria estrutural local sem modelo extra,
registrando apenas contagem e códigos das falhas (não as falas). Ela reconhece
três blocos visuais e verifica fala do adulto, ação da criança, virada e
continuidade; também sinaliza uma virada explicitamente genérica como “conte
uma consequência”. Ficou em **observação**, sem bloquear ou regenerar resposta,
pois a regra lexical não substitui avaliação editorial. Testes específicos
8/8 e typecheck passaram. Falta medir falsos positivos/negativos em amostras
reais autorizadas e então comparar a estratégia de correção com a latência;
nenhuma publicação foi feita nesta etapa.

## Replay de seis cenários e calibração da auditoria

Bancada com família sintética, BPs reais somente leitura e mesmo gerador; a
auditoria passou a ser impressa junto com a resposta. Nos cinco pedidos de
brincadeira vieram três opções, enquanto o controle de manejo recebeu manejo,
sem auditoria de jogos. O caso de mercado ainda repetiu o dinossauro em duas
opções e deixou a terceira virada vaga (“encene a escolha dela de modo
engraçado”). Foco e pedido livre trouxeram mecânicas mais distinguíveis. Na
fala emergente, uma opção usou a fala “Ayla virou Leo!”, inadequada para a mãe
representar; no adolescente, o tom e a autonomia ficaram mais apropriados à
idade. Estes são julgamentos editoriais da bancada, não prova com família real.

A versão inicial da auditoria marcou falsamente opções escritas em linha
corrida (“Ela pode...”, “Então, ...”, “na rodada seguinte”) e contou zero jogos
quando o título vinha com um asterisco, formato válido no WhatsApp. O parser
foi alargado para esses casos e recebeu testes de regressão. A última suíte
focada passou 55/55, e o typecheck passou. Ainda há falsos negativos semânticos
possíveis: um validador lexical não pode garantir que a opção seja divertida,
segura, diferente das demais nem verdadeiramente personalizada. **O gate de
publicação segue FALHOU**, sem commit, deploy ou ativação nesta continuação.

## Diretrizes compartilhadas entre canais (candidata local)

Pedido posterior da usuária: a qualidade de uma brincadeira precisa valer em
qualquer lugar da plataforma que a apresente, não só no pedido direto ao
WhatsApp. Mapeei os produtores vivos: Ayla oficial, fallback residual do
WhatsApp, conversa web, `output_type=brincadeiras` (botão de apoio e ramo
Brincar / passear) e sugestão espontânea de repertório. Plano está suspenso;
quando usa a seção de brincadeiras, ela passa pelo mesmo `output_type`.
Lúdico gera histórias/rotinas, e Galeria gera imagens de uma ideia já pronta;
não são produtores de roteiro de brincadeira neste escopo.

Uma diretriz editorial comum agora chega a esses produtores: jogo que exista
como experiência prazerosa; idade e comunicação reais; Perfil/histórico,
interesses e sensibilidades; fala literal de quem cuida; participação possível
da pessoa em foco; virada causada por sua ação; segunda rodada; benefício
pertinente sem promessa; segurança e recuo respeitados. O contrato não impõe
três opções ao ramo de aprofundamento (que entrega uma ideia) nem à proativa
(também uma). Pedido direto continua com três alternativas. A proativa anexa
a regra em tempo de execução inclusive quando o prompt salvo no banco for
antigo; o seed foi alinhado para novas instalações. Não foi adicionada uma
chamada ao modelo. Testes de roteamento e formato: 63/63; typecheck passou.

Replay sintético do pedido de mercado após a diretriz comum: três jogos com
turnos e viradas explícitas, 2 BPs no contexto, ~6,9 s. Ainda há julgamento
semântico a fazer (se o interesse muda de fato a mecânica e se as três opções
são suficientemente diferentes). Teste em conversa web, botão de apoio,
proativa e WhatsApp real autorizado ainda falta. **Não interpretar prompt
presente como garantia de saída boa nem ativar globalmente nesta fase.**

### A/B comportamental dos caminhos web

Harness novo com família sintética, `output_type=brincadeiras` real e duas BPs
recuperadas somente leitura; geração real GPT, sem escrita ou envio. A primeira
versão com contrato comum mas sem mecânicas deu à conversa web três jogos que
eram sobretudo escolher trajeto/cor/produto e, ao botão, uma expedição que
voltava à escolha de corredor. **Reprovada**: o mesmo texto de diretrizes não
mudou o jogo.

Incluí as mecânicas candidatas também no contexto do pedido web; elas são
opções internas, não uma ordem de quantidade. A segunda rodada trouxe conversa web
com mímica, apelido e poder imaginário, com turnos concretos. O botão melhorou
a virada mas produziu “rugido bem baixinho” para pessoa sensível a sons:
**reprovado por segurança/Perfil**. Explicitei que nem estímulo suave deve ser
provocado; nova rodada do botão trouxe jogo silencioso, fala adulta, gesto da
Manu, consequência e segunda rodada (~5,5 s). Caso adolescente de 14 anos,
interesse por música, produziu jogo de pistas musicais sem infantilização
(~6,4 s). São amostras pontuais, não taxa de aprovação.

Uma regra curta e condicional foi adicionada aos turnos comuns da Ayla oficial,
web e fallback residual: se a resposta sugerir espontaneamente uma brincadeira,
os mesmos mínimos de jogo, Perfil e segurança continuam valendo; ela não manda
oferecer brincadeira em todo turno. O roteiro completo só entra nos caminhos
de brincadeira. Última regressão dirigida 57/57, typecheck e build passaram.
A suíte completa antes do ajuste de paridade teve 4118 passes, 7 pulados e
3 falhas: duas conhecidas do baseline (PEND-205/PEND-214) e uma nova do teste
Oficial × Legacy; a terceira foi corrigida e o teste específico passou.
Não houve nova suíte completa depois da correção, nem prova real dos quatro
caminhos. **PEND-208 permanece aberta; sem commit/deploy/ativação.**

### Cardinalidade do apoio ≠ aprofundamento

Revisão do diff encontrou colisão real: ambos usam a chave
`output_type=brincadeiras`, mas o template ativo do apoio diz “2 a 3
brincadeiras”, enquanto a receita do clique Brincar / passear diz “Crie UMA
ideia principal”. Uma nota genérica que mandava escolher uma fez o apoio
responder com só uma, violando a promessa visível da página. Agora a montagem
detecta a quantidade do template recebido e a reafirma: 2–3 completas no
apoio, uma completa no aprofundamento. Replay com o template ativo trouxe
três jogos para Manu (~8 s); replay com a receita do clique trouxe um roteiro
único, com gesto, virada e segunda rodada (~6,1 s). A regressão focada 58/58,
typecheck e build passaram. A última suíte completa terminou com 4118 passes,
7 pulos e 3 falhas: PEND-205, PEND-214 e uma expectativa do teste novo ainda
presa à regra anterior de quantidade. Esta expectativa foi corrigida; a
regressão dirigida passou (58/58) e a suíte completa repetida na versão final
teve 4.120 passes, 7 pulos e apenas as duas falhas antigas PEND-205/PEND-214.
Isto ainda é bancada com Perfil sintético e BPs reais
em leitura, não prova de canal real ou da sugestão espontânea.
