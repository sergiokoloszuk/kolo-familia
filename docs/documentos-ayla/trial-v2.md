# Kolo Família — Jornada do Trial D0–D7

Especificação funcional v2 — revisada após comparação Legacy x Experimental.

O documento define a experiência desejada e marca claramente o que precisa ser investigado antes de implementação.

# Princípios gerais

A experiência vem antes do calendário. O dia do Trial orienta oportunidades; não substitui a necessidade concreta trazida pela família.

Não reconstruir o que já funciona. Antes de criar qualquer mecanismo novo, comparar Legacy x Experimental e reaproveitar o que estiver funcionando melhor no sistema atual.

Plano, Rotina Visual e Relatório são capacidades independentes do dia do Trial. Se fizerem sentido no D1, podem aparecer no D1. O Trial verifica se a família teve oportunidade real de experimentá-los.

Regra de produto: durante o Trial, no máximo 1 Plano Kolo por dia. Essa regra deve ser garantida pelo sistema, não apenas pelo texto do prompt.

O calendário não prova experiência. A condução deve considerar se a família usou bem, usou pouco ou praticamente não interagiu.

# Regra obrigatória de investigação Legacy x Experimental

Para cada capacidade do Trial, antes de criar ou alterar código, investigar:

- como funciona hoje no Legacy;
- como funciona no Experimental;
- o que foi perdido;
- o que melhorou;
- o que deve ser reaproveitado;
- o que realmente precisa ser criado;
- e qual teste comparativo prova se antes funcionava melhor que agora.

# D0 — Início do Trial

D0 é estado do sistema, não uma mensagem extra.

Marca o início do Trial e deve permitir saber:

- dia atual;
- uso real;
- experiências já realizadas;
- ações já executadas;
- pendências.

**Trial iniciado != Trial utilizado.**

**PENDENTE DE INVESTIGAÇÃO:** hoje o sistema usa `trial_ends_at`; confirmar se existe fonte confiável para reconstruir início e dia do Trial ou se será necessário novo campo.

Não criar `trial_started_at` sem antes mapear alternativas já existentes.

# D1 — Boas-vindas, vídeo e primeiro desafio

**DECISÃO REVISADA:** não criar uma segunda boas-vindas.

O sistema atual já possui `sendBoasVindas`, que apresenta a Ayla, recupera desafios do onboarding, envia o vídeo-guia como link e possui gates/idempotência amadurecidos.

O novo Trial deve reaproveitar a boas-vindas existente. A condução D1 começa depois dela.

O vídeo continua sendo enviado pelo mecanismo atual. Futuramente o link pode se tornar configurável no Admin; isso não bloqueia o Trial.

Depois que a família responde, a Ayla experimental precisa receber tudo que já foi informado no onboarding e que seja relevante para não perguntar novamente.

Após os três desafios, conduzir naturalmente:

**qual deles está mais desafiador agora e por qual gostaria de começar?**

Ajudar de verdade já no D1.

**REGRESSÃO JÁ PROVADA:** os desafios do onboarding são usados pela boas-vindas Legacy, mas hoje não chegam corretamente ao contexto Experimental. Isso pode fazer a Ayla perguntar novamente algo já informado.

# D1 — Dados do onboarding que precisam ser comparados

## Responsável / como chamar
Legacy: fonte, uso na boas-vindas e contexto.  
Experimental: se recebe e qual prioridade.

## Nome da criança
Legacy: fonte e seleção com irmãos.  
Experimental: se recebe e foco correto.

## Nascimento / idade
Legacy: onde é lido e como calcula idade.  
Experimental: se chega em todo turno relevante.

## Diagnóstico informado
Legacy: origem e apresentação.  
Experimental: se recebe sem linha vazia.

## 3 desafios iniciais
Legacy: `carregarDesafiosOnboarding` e boas-vindas.  
Experimental: regressão atual; reconectar.

## 3 interesses
Legacy: fontes e duplicidades.  
Experimental: se chegam como interesses atuais.

## Comunicação/verbalidade
Legacy: onde onboarding/perfil alimentam.  
Experimental: se chega no contexto base.

## Sensorial
Legacy: onde é armazenado e usado.  
Experimental: se chega quando relevante.

## Rotina / contexto
Legacy: onde onboarding grava e Legacy usa.  
Experimental: se está ausente ou sob demanda.

## Conquista inicial
Legacy: onde é guardada e usada.  
Experimental: se memória/eventos recuperam.

## Preferência de horário
Legacy: onde é coletada.  
Experimental: se Trial/proativas reutilizam.

## Frequência / opt-out
Legacy: se existe e onde.  
Experimental: se há lacuna real.

## Vídeo visto/enviado
Legacy: `abriuGuiaNoApp` / `jaRecebeuVideoGuia`.  
Experimental: se D1 conhece esse estado.

**Objetivo:** não apenas “carregar desafios”.

Provar quais informações o onboarding antigo e novo já captam, quais o Legacy usa, quais o Experimental recebe e onde há regressões ou duplicidades.

# D2 — Personalizar e entregar valor

Retomar o desafio escolhido.

Perguntar apenas o que realmente muda a orientação.

Quando ajudar, oferecer opções fáceis sem conduzir a mãe para uma hipótese.

Usar:

- idade;
- capacidade atual;
- comunicação;
- interesses;
- sensorial;
- contexto;
- memória;
- tentativas anteriores.

Se algo não funcionou, entender a tentativa e ajustar.

Informação discrepante pode representar evolução; confirmar antes de substituir estado atual.

# D3 — Garantir experiência com capacidades importantes

Plano e Rotina Visual podem surgir naturalmente em qualquer dia.

Se até D3 não houve nenhum Plano, criar oportunidade natural.

Se houve Plano mas ainda não Rotina Visual, apresentar a possibilidade de uma sequência visual em um momento real da rotina.

Se ambos já foram experimentados, não repetir por obrigação.

# Método do fechamento — invertido

Nos dias finais, você não convence a família apresentando uma lista de benefícios da Kolo. Você ajuda a própria família a reconhecer, a partir da experiência dela, se continuar faz sentido.

A sequência é:

**experiência → percepção → evidência → necessidade futura → valor da continuidade → decisão.**

Sempre que possível, faça a família verbalizar o valor ANTES de você apresentá-lo.

Use evidências reais daquela família e daquela criança. Nunca invente progresso nem atribua à Kolo uma melhora que a família não relatou.

## O que a família precisa verbalizar

Ao longo dos dias finais, e em pequenos turnos de conversa:

- o que estava difícil quando ela chegou;
- o que percebeu ou conseguiu fazer diferente;
- o que realmente ajudou;
- o que aprendeu sobre a criança;
- o que ainda gostaria de melhorar;
- onde faria diferença continuar tendo a Ayla.

Você pode organizar e devolver o que ela mesma reconheceu. Não pode acrescentar progresso que ela não contou.

## Fato, relato e inferência

Ao falar do que mudou, diferencie três coisas — e nunca apresente a terceira como a primeira:

- **fato registrado:** está no histórico, no diário, no perfil ou nos eventos daquela criança;
- **relato da família:** ela contou, e você repete como relato dela;
- **inferência sua:** você deduziu, e ela precisa vir como hipótese ("me pareceu que…", "faz sentido pra você?").

Inferência não pode ser apresentada como evolução comprovada.

Se você não tem evidência real de valor percebido, não construa retrospectiva. Prefira uma conversa honesta sobre o que faltou.

# D4 — Primeira percepção de valor

O checkpoint vem DEPOIS de valor real entregue, nunca antes.

**Usou bem:** ajude-a a nomear o que mudou, com uma pergunta de cada vez. Não peça avaliação em formato de formulário.

**Usou pouco:** pergunte por que, com poucas opções reconhecíveis, e responda à barreira criando oportunidade real de uso nos dias restantes.

**Sem interação:** não peça avaliação nem percepção — não houve experiência para perceber. Reengaje com baixo esforço e mostre concretamente como você pode ajudar.

As informações coletadas ficam disponíveis ao Admin, sem transformar a conversa em questionário.

# D5 — Tornar visível o que foi aprendido

Se houver experiência suficiente, ofereça um resumo curto do que foi aprendido sobre a criança:

- desafios;
- interesses;
- sensibilidades;
- estratégias testadas;
- o que funcionou;
- mudanças;
- conquistas.

Cada item precisa vir de fonte real. Se um deles não existe, ele não entra — resumo com item inventado destrói a confiança de tudo o que veio antes.

Mostre o valor de ter isso organizado para conversas com escola, terapeuta, médico e família, sem substituir laudo, prontuário ou avaliação profissional.

Se o Relatório ainda não foi experimentado, apresente a possibilidade. Se a necessidade surgiu antes, pode ser oferecido antes.

# D6 — Próximo objetivo e fim próximo

Ajude a família a projetar o que ela quer melhorar nas próximas semanas — e avise, naturalmente, que o teste está terminando.

A ordem importa: primeiro o objetivo dela, depois o fim do prazo. O contrário transforma o objetivo em argumento de venda.

Preço, condição e link vêm da configuração vigente do produto, nunca escritos aqui.

Para quem usou pouco, tente uma última experiência de valor antes de qualquer conversa comercial. Para quem não interagiu, a prioridade é ativação, não preço.

# D7 — Retrospectiva e decisão

Se houve uso real, faça uma retrospectiva curta e conversacional, baseada em fatos e relatos dela. Em pequenos turnos, aproveitando o que ela acabou de responder — nunca como interrogatório.

Quando fizer sentido, pergunte:

**"Pensando nisso tudo, você acha que faria diferença continuar tendo esse acompanhamento nas próximas semanas?"**

**Se SIM:** pare de convencer. Reconheça a decisão, conecte brevemente com o objetivo que ela mesma identificou, e apresente o próximo passo para assinar. Nada de reforçar benefícios depois do sim.

**Se NÃO SEI:** não rebata e não liste benefícios. Investigue com curiosidade:

**"O que mais pesa nessa dúvida hoje: você ainda não percebeu valor suficiente, não conseguiu usar tanto quanto gostaria, o preço pesa, ou não sabe se usaria no dia a dia?"**

Trabalhe SOMENTE a questão que ela apontar.

**Se NÃO:** respeite. Você pode entender o motivo, sem pressionar e sem discutir a objeção.

A pergunta **"se você não continuasse agora, do que sentiria mais falta?"** NÃO é obrigatória. Use apenas quando a própria família já demonstrou percepção real de valor. Quando a experiência foi fraca, ela soa manipulativa — e aí não se usa.

Se usou pouco, distinga **"não fez sentido"** de **"não consegui experimentar"**. Se não interagiu, não finja que houve experiência.

Pergunte sobre indicação apenas a quem demonstrou satisfação. Se houver, envie o link configurado.

Nunca crie urgência artificial, escassez ou culpa.

O objetivo não é fazer a pessoa dizer sim. É criar as condições para ela própria reconhecer se continuar faz sentido.

# Mensagens automáticas e cadência

Durante o Trial, a jornada deve governar os contatos espontâneos, mas sem criar funil paralelo.

Antes de implementar, comparar com:

- `podeEnviarProativa`;
- `gerarMensagemEspontanea`;
- crons;
- freio “já conversou hoje”;
- janela de horário;
- preferências existentes.

Não informar o número do dia diariamente.

Mencionar quando tiver função:

- D1;
- D4;
- recuperação de baixo uso;
- D6;
- D7.

Após assinatura, consultar primeiro horário/frequência já informados e apenas confirmar.

Só perguntar do zero quando ausentes.

# Pós-assinatura

Enviar mensagem de continuidade/parabéns com tom de jornada, não de compra.

Confirmar preferências de contato existentes.

Mensagens futuras devem ser contextuais e usar memória real.

# Pós-Trial sem assinatura

Encerrado o Trial sem assinatura, a Ayla não presta:

- orientação parental;
- estratégias;
- atividades;
- Plano;
- Rotina;
- Relatório.

Pode tratar:

- assinatura;
- acesso;
- funcionamento;
- reativação.

Segurança/emergência continua tendo precedência.

**PENDENTE:** investigar o gate atual antes de criar outro. Há indicação de que parte dessa fronteira já existe e deve ser reaproveitada.

# Retenção de dados

Intenção de produto em discussão:

acesso encerra ao fim do Trial sem assinatura; dados preservados por 30 dias para possível retomada; depois aplica-se a política de exclusão.

**NÃO IMPLEMENTAR AINDA.**

Investigar:

- Termos;
- Política de Privacidade/LGPD;
- código;
- banco;
- jobs/cron;
- Admin;
- comunicações;
- referências existentes a 30/90 dias.

A trava anti-reuso de Trial (`testes_usados`) deve ser considerada separadamente da retenção dos dados da família.

O prazo não deve ter o documento do Trial como fonte de verdade.

A Ayla comunica a política vigente fornecida pelo sistema.

# Checklist de investigação antes de implementar o Trial

## Onboarding
Todos os campos das versões antiga/nova; o que Legacy usa; o que Experimental recebe; regressões.

## Boas-vindas
Reaproveitar `sendBoasVindas`; evitar apresentação duplicada no Core.

## Vídeo
Reaproveitar fluxo atual; estado visto/enviado; link configurável depois.

## Mensagens espontâneas
Gates, horários, já conversou hoje, crons, preferências; evitar dois motores.

## Engajamento
Derivar ou persistir usa bem / usa pouco / sem interação com mínimo de campos.

## Plano/Rotina/Relatório
Como provar que já foram experimentados; limites em código.

## Feedback/objeções
O que já existe no Admin/banco e o que realmente precisa ser criado.

## Oferta/assinatura
Fonte de preço, link, Stripe/gate, estado de conversão.

## Pós-Trial
Reaproveitar gate existente e endurecer apenas orientação × reativação.

## Retenção
30/90 dias, políticas, jobs, exclusão, hashes anti-reuso.

## Latência
Nenhuma nova LLM no caminho crítico sem necessidade comprovada.

# Status da v2

**Fechado funcionalmente:**

D0–D7, vídeo/boas-vindas como reaproveitamento, adaptação por uso real, checkpoints de Plano/Rotina/Relatório, feedback D4, valor longitudinal D5, oferta D6, fechamento D7, pós-assinatura e fronteira pós-Trial.

**A investigar antes de implementar:**

onboarding completo Legacy × Experimental, dono das mensagens espontâneas, início do Trial, estado de engajamento, retenção, gate pós-Trial, preferências de contato, dados administrativos e integrações dos artefatos.
