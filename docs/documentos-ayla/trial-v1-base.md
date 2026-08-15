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

# D4 — Checkpoint adaptativo

**Usou bem:** convidar para avaliação rápida sobre experiência, maior valor e o que poderia melhorar.

**Usou pouco:** perguntar por que, com opções simples; responder à barreira criando oportunidade de uso nos dias restantes.

**Sem interação:** não pedir avaliação. Reengajar com baixo esforço e explicar concretamente como a Ayla pode ajudar.

As informações coletadas devem ser disponibilizadas ao Admin sem transformar a conversa em formulário.

# D5 — Trajetória, evolução e valor dos registros

Se houver experiência suficiente, oferecer resumo curto do que foi aprendido:

- desafios;
- interesses;
- sensibilidades;
- estratégias;
- respostas;
- mudanças;
- conquistas.

Mostrar valor para orientar melhor e para organizar observações em conversas com escola, terapeuta, médico e família, sem substituir laudo/prontuário/avaliação profissional.

Se Relatório ainda não foi experimentado, apresentar a possibilidade.

Se surgiu necessidade antes, pode ser oferecido antes.

# D6 — Fim próximo, oferta e intenção

Avisar que o Trial está terminando.

Para quem usou bem, conectar:

**valor real experimentado → preço/condição vigente → intenção de continuar.**

Preço, condição e link devem vir de configuração vigente do produto/Admin, nunca hardcoded no documento do Trial.

Para pouco uso, tentar uma última experiência de valor antes da abordagem comercial.

Para sem interação, prioridade é ativação, não preço.

Se não pretende assinar, coletar motivo de forma simples e registrar objeção.

# D7 — Fechamento

Se houve uso real, retrospectiva curta baseada em fatos.

Não repetir intenção se já coletada no D6.

Se usou pouco, distinguir:

**“não fez sentido” de “não consegui experimentar”.**

Se não interagiu, não fingir experiência.

Perguntar indicação apenas para quem demonstrou satisfação.

Se sim, enviar link configurado.

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
