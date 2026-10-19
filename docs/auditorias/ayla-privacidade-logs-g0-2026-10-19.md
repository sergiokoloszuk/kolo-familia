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

- Teste dinâmico do webhook: conteúdo e erro fictícios, inclusive identificador LID, não aparecem no stdout. Os testes de áudio do PR #145 e os testes de privacidade foram integrados no mesmo arquivo. Regressão focada após a integração — webhook, turno, lookup e desconhecido: **65/65 passaram**.
- Após integrar o PR #145, `next typegen` e `tsc --noEmit --incremental false` passaram; lint dirigido sem erros, com cinco avisos preexistentes no orquestrador. O índice de pendências passou com 184 fichas naquela etapa; após registrar a PEND-242, passou com 185 fichas e IDs únicos. `git -c core.whitespace=cr-at-eol diff --check` passou; `PENDENCIAS.md` já usa CRLF, por isso essa opção trata o CR como fim de linha, sem reformatar 11 mil linhas alheias.
- Na base `25e8891`, antes de integrar o PR #145, a suíte completa reproduziu **4.207 passaram, 7 pulados e 3 falharam**; são os três testes já estabilizados no PR #145 (`experimental-onboarding`, `memoria-pertinente`, `provider`). Na branch empilhada, a suíte completa terminou com **4.227 passaram e 7 pulados**, em 223 arquivos. O [PR #147](https://github.com/sergiokoloszuk/kolo-familia/pull/147) passou os **2 checks exibidos** (deploy de preview e comentários do preview). Esses checks não substituem a suíte local nem provam o SHA em produção.
- `eventos_app` tem RLS de leitura administrativa na migration `0006`; a purga de `info/debug` após 30 dias e `warn/error/fatal` após 180 dias está codificada em `runCleanup`. **`apps/web/vercel.json` não agenda `?tipo=cleanup` e a tela autenticada de Cron Jobs da Vercel, consultada em 19/10/2026, também não o lista entre os 14 jobs ativos.** Não há prova de execução por outro agendador nem de retenção efetiva. Não disparar o cleanup como teste: ele apaga registros.
- Antes de agendar esse cleanup, a revisão estática encontrou outro risco (PEND-242): o comentário promete limite por `DEL_LIMIT`, mas as operações `.delete()` não têm limite; as condições de `links_vivos` e `beta_invites` ainda apagam registros `revogado=true` sem exigir a idade descrita. É um risco latente do código, **não** prova de que a purga tenha rodado. Não ligar o job atual sem delimitar e testar as exclusões.
- Retenção/acesso ao stdout da hospedagem e políticas aplicadas no banco precisam de conferência somente leitura no ambiente real, sem abrir conteúdo. A PEND-240 só pode ser baixada após prova do SHA servido e desses controles.
- O painel Supabase não estava autenticado nesta sessão; não foi feita autenticação nem consulta a políticas aplicadas. A RLS descrita acima é prova do arquivo de migration, **não** do estado atual do banco.
- O health público consultado novamente em 19/10/2026 mostrou `ok: true`, ambiente `production`, ref `main` e SHA `25e8891daf1e0d5bd881512e6f128742fdcd0184`. Portanto o patch do PR #147 **não** está no SHA servido.

**Veredito de publicação:** BLOQUEADO. Este patch é uma etapa preparatória; não autoriza publicar a medição G0 ou a nova conversa.
