# Plano Web V5.1 — execução local

Referência aprovada: `Downloads/index.html`, SHA-256
`a7899a119ea91c2bdf1fe2ab0f07c3877aa759ee76f692a9ca0b85ec942c7a2d`.
Risco CRÍTICO: identidade, múltiplos membros, informações comportamentais e continuidade.

## Matriz de reaproveitamento anterior à implementação

| Decisão | Existente | Tela V5.1 / tratamento |
|---|---|---|
| Manter | Autenticação `requireAdmin`, autorização no servidor | Painel interno; nenhuma autorização baseada apenas em menu |
| Manter | Motor `ia/engine.ts`, gerador legado `ia/plano.ts`, contexto, skills, boas práticas | Adaptador de saída V5.1 usa `montarContextoDeSecoes`, `assemblePrompt` e provider existentes; não altera motor/recuperador |
| Adaptar | Seções `PlanoSecao` e renderização Markdown | Entender / Descobrir / Combinar; conteúdo recebido, sem inferir fatos de seções antigas |
| Adaptar | Resultado agregado em `planos` | Cinco estados verificáveis; o agregado antigo não comprova tentativa ou conquista |
| Adaptar | Layout e navegação do plano | Trilha / conteúdo / Ayla; gaveta no celular; título e etapa sempre visíveis |
| Não tocar | Home e `lib/web-v5/*` | Frente independente |
| Adaptar | `/planos/[id]` | Apenas reconhecer novos envelopes V5.1 e redirecionar à retomada; nenhum plano legado é convertido |
| Não tocar | `/planos` (lista), `/conversar`, Core e WhatsApp | Preservar contratos e candidata; nada de troca silenciosa |
| Não tocar | Esquema, migrações, Stripe, flags e produção | Escritas existentes autorizadas SOMENTE para novos registros, testadas com banco simulado |

Baseline: o plano atual é um documento de seções e resultado agregado. Não representa
seleção, tentativa, resultado e confirmação de conquista separadamente. O HTML aprovado
tem datas fixas, respostas simuladas, confirmação fictícia de envio e converte resposta
positiva em conquista. Só a composição visual é reaproveitável nesses trechos.

## Limite operacional

Karina esclareceu a autorização: usar gravações existentes, sem alterar esquema nem
registros atuais, testando fora de produção. O adaptador usa novos registros em
`planos.secoes`, envelope V5.1, revisão condicional, origem Web fixada pelo servidor,
família da sessão, membro validado e leitura após escrita. O painel interno usa personagens
fictícios, inicia vazio e identifica o conteúdo demonstrativo. Nenhuma família real é
consultada para QA. Não apresentar estado em memória como gravação confirmada.
Não oferecer áudio, notificações, geração no Lúdico ou integração WhatsApp como disponíveis
sem adaptadores reais. Lembretes começam desligados; indisponibilidade impede ativação.

## Critérios de aceite

- Caminho completo sem atalhos, perguntas uma por vez e lacunas opcionais.
- Cinco estados sem salto; eventos escopados por família e membro; repetição idempotente.
- Resultado positivo não é conquista. Texto do que melhorou e confirmação explícita são obrigatórios.
- Experimento nasce dia 1, diário vazio, formulário novo vazio, datas calculadas.
- Navegação não conclui etapas. Resultados, feedback e conquistas não se misturam.
- Vários planos por membro e no máximo um prioritário; troca de membro não mistura dados.
- Interrupção/retomada não reativa autorização de lembretes.
- Nenhuma inferência de passado, cadastro ou intenção sem origem.
- Desktop e celular: 44×44, sem overflow; nome/etapa visíveis; gavetas acessíveis.

Reversão local: remover apenas os arquivos novos desta fatia e o reconhecimento V5.1
em `/planos/[id]`. Não restaurar em bloco o checkout nem a ficha compartilhada.
Sem migração ou efeito em produção. Não encerrar G02/G04/G07/G08 pela interface.

## Limitações para revisão

- Prioridade entre vários planos é explícita e apenas de sessão. Garantia persistente de
  um prioritário por criança precisa de decisão e operação atômica próprias; proposta separada.
- Conversa livre ainda não usa `conversa_id` para persistir turnos; não confundir com os
  eventos/relatos do plano, que possuem adaptador confirmado. Reutilizar `conversas` futuramente.
- A interface tem estado de cuidado e trava de domínio; triagem na entrada e texto revisado
  ainda não estão conectados. Não disponibilizar a famílias antes dessa validação.
- Sem emissor de lembretes; não ligar, não prometer pausa de proativas existentes.
- Sem ponte WhatsApp e sem botão de criação fictícia no Lúdico.
- Provider/contexto/referências integrados em código; testes substituem os transportes.
  Nenhum resultado semântico de modelo real, latência real ou uso dos livros novos foi comprovado.
- O laboratório verifica protocolo Supabase com test double. JSONB/CAS, RLS e retomada em
  Postgres descartável ainda exigem prova própria, sem usar produção ou famílias reais.
