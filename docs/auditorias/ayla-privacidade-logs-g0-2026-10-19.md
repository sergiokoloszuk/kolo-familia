# Ayla · PEND-240 · saneamento de logs antes da medição G0

**Estado em 19/10/2026:** patch local isolado, sem merge, deploy, consulta a conteúdo de famílias ou envio de WhatsApp. A ficha PEND-240 está no PR #145, ainda fora de `main`; este registro não a baixa.

## Baseline e causa

O SHA `25e8891` servido pelo health continha `console.log` do payload bruto e do telefone/texto parseados no webhook. Em `processInbound`, falha de busca incluía telefone, chave e trecho da mensagem tanto em stdout quanto no `logServerError` persistido em `eventos_app`; número desconhecido e possível não-titular imprimiam telefone. O registro de marcos do Perfil imprimia o texto dos marcos. A revisão é estática: não foram abertos logs ou registros de famílias.

## Correção proposta

- O webhook registra apenas `tem_texto` e tipo de mídia; o caso LID registra somente a classe do identificador. Erros de processamento não propagam a mensagem arbitrária do provedor para stdout.
- Falha de busca mantém um evento inequívoco `ayla_lookup_familia_falhou`, mas com erro técnico fixo, sem payload de telefone ou fala. Desconhecido conserva somente o resultado booleano de atendimento; não-titular conserva o ID interno da família; marco do Perfil conserva apenas contagem.
- O rastro do turno deixa de persistir `e.message` arbitrária em `motivo`; falha ao persistir o rastro não imprime a mensagem do erro. Um teste guarda a saída técnica fixa e o relançamento da exceção.
- As decisões de resposta, identificação, alerta e escrita no Perfil não foram alteradas.

## Provas locais e limites

- Teste dinâmico do webhook: conteúdo e erro fictícios, inclusive identificador LID, não aparecem no stdout. Regressão focada após a última proteção do rastro — webhook, turno, lookup e desconhecido: **59/59 passaram**.
- `next typegen` e `tsc --noEmit --incremental false` passaram; lint dirigido sem erros, com cinco avisos preexistentes no orquestrador; `git diff --check` passou.
- Suíte completa iniciada antes da última proteção do rastro: **4.207 passaram, 7 pulados e 3 falharam**. As três falhas são as mesmas reproduzidas anteriormente na base limpa `25e8891` (`experimental-onboarding`, `memoria-pertinente`, `provider`); não foram causadas por este patch. Como o rastro mudou durante essa execução, os **59/59 focados posteriores** são a prova atual do arquivo tocado. A estabilização desses testes já está no PR #145, mas ainda não em `main`. CI deste patch permanece pendente; CI verde do #145 não testa automaticamente este branch.
- `eventos_app` tem RLS de leitura administrativa na migration `0006`; a purga de `info/debug` após 30 dias e `warn/error/fatal` após 180 dias está codificada em `runCleanup`. **`apps/web/vercel.json` não agenda `?tipo=cleanup` e a tela autenticada de Cron Jobs da Vercel, consultada em 19/10/2026, também não o lista entre os 14 jobs ativos.** Não há prova de execução por outro agendador nem de retenção efetiva. Não disparar o cleanup como teste: ele apaga registros.
- Retenção/acesso ao stdout da hospedagem e políticas aplicadas no banco precisam de conferência somente leitura no ambiente real, sem abrir conteúdo. A PEND-240 só pode ser baixada após prova do SHA servido e desses controles.
- O painel Supabase não estava autenticado nesta sessão; não foi feita autenticação nem consulta a políticas aplicadas. A RLS descrita acima é prova do arquivo de migration, **não** do estado atual do banco.

**Veredito de publicação:** BLOQUEADO. Este patch é uma etapa preparatória; não autoriza publicar a medição G0 ou a nova conversa.
