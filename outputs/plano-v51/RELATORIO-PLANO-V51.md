# Plano Web V5.1 — entrega local e limites

**Veredito: PASSOU COM RESSALVAS para a fatia local. BLOQUEADO para disponibilização às famílias.**
Base `8a18707de242ca877842bf102b7dba08e47d1eaa`, branch
`codex/ayla-web-v5-interna-20261126`. Sem commit, merge, push, deploy ou mudança de produção.

**Adendo de preparação do PR, 26/11/2026:** a autorização posterior permite commit/push
da branch e PR em rascunho, sem merge/deploy. O recorte reproduzível do PR tem 77 testes;
os 18 testes locais da Home incluídos na rodada de 95 permanecem fora do PR.
`REGRESSAO-PR.json` é a evidência desse recorte. `apps/web/vercel.json` bloqueia apenas o
deploy automático desta branch de revisão; não muda flags funcionais ou main.

## O que funciona no laboratório

Entrada pela Ayla, escolha explícita do membro, relato em branco e convite para plano
de um único assunto. Trilha Entender/Descobrir/Combinar/Experimentar/Evoluir, três áreas
no desktop e gavetas no celular. Leitura completa dos olhares como padrão, guia opcional.
Perguntas uma por vez; perguntas conhecidas são dispensadas; “não sei” preserva a lacuna.
Ficha distingue relato, cadastro, hipótese ancorada e desconhecido. Não há confirmação
“Certo/Mudou” obrigatória para cada dado cadastrado.

O combinado começa escolhido, sem tentativa. Experimentar nasce dia 1, diário vazio e
datas calculadas. O formulário de relato abre sem preenchimento. Resultado positivo
é resultado observado; conquista exige descrição da melhoria e confirmação separada.
Avaliação da orientação em estrelas não altera o resultado da tentativa.

O adaptador grava SOMENTE novos planos V5.1 em `planos.secoes`, com envelope identificado
e versionado. A família vem da sessão; o membro é validado na família; eventos da Web
não podem alegar origem WhatsApp. A atualização recusa planos legados, usa revisão
condicional e relê para confirmar. Repetição após gravação parcial não duplica evento.
Campos digitados são rascunhos; avançar confirma o lote. `/planos/[id]` reconhece apenas
os novos envelopes para retomar a candidata, preservando o documento legado.

Rotas candidatas, ainda locais: `/admin/plano-v51` (demonstração identificada) e
`/planos/desenvolvimento` (adaptador conectado, restrito a staff na página e nas actions).
Não foram acrescentadas à Home nem ao menu público. Autenticação/RLS efetivas em HTTP
ainda não foram exercitadas com um banco descartável.

## Inteligência e fontes

O adaptador usa `montarContextoDeSecoes`, `assemblePrompt`, o provider conversacional e
as proteções existentes. Não há novo recuperador, skill, biblioteca ou memória.
O formato de saída estruturada tem contrato próprio; o motor compartilhado não mudou.
Desenvolver a devolutiva após as perguntas usa respostas e disponibilidade da família.
Digitar e navegar não chamam o modelo. Custos/tokens/referências selecionadas são enviados
à telemetria existente, sem relato ou telefone. Uma saída rejeitada também é contabilizada.

**Não houve chamada a modelo real.** Os testes substituem transporte/contexto por fixtures.
Não comprovam uso dos novos livros/pós, qualidade semântica, custo ou latência real. Não
foram atribuídas notas artificiais de Traduzir/Conectar/Encantar/Provocar/Valorizar.

## Evidências executadas

| Verificação | Resultado | Limite da prova |
|---|---|---|
| Regressão focada | 95 aprovados, 0 falhas, 0 pulados | `REGRESSAO.json`; domínio, repositório, adaptador, actions, entrada e guardas adjacentes; não é regressão global G07 |
| Lint dos arquivos da fatia | Sem erros | `LINT.json`; não reformatou outros módulos |
| Typecheck | Passou | CLI e etapa TypeScript do build |
| Build Next/Webpack | Passou, 110 páginas estáticas geradas | `BUILD.log`; configuração sintética, nenhuma publicação |
| Navegador | 4 percursos passaram | `QA-BROWSER.json`: desktop 1440, celulares 390/320 e persistência simulada |
| Retomada após recarregar | Passou com um plano, resultado e conquista preservados | Mesmo repositório, banco simulado em memória; NÃO é prova Postgres/RLS |
| Isolamento | Família/criança/plano nos testes do repositório; troca de irmão no browser | Sem conta real ou dados reais |
| Acessibilidade medida | Sem overflow; botões visíveis ≥44×44; nome/etapa fixos e Escape | Viewports e estados exercitados; não é auditoria WCAG integral |
| Integridade | 19 arquivos inventariados; 6 protegidos idênticos à base | `MANIFESTO.json`; Home, engine, contexto, orchestrator, gerador legado e webhook funcional intactos |

Os primeiros builds falharam por DNS/TLS das fontes. O build final usou as CAs do Windows,
sem desativar a validação TLS. A tentativa anterior do browser está preservada; o teste
de retomada precisava de um seletor que aceitasse a data dentro do bloco da conquista.
O oráculo continuou exigindo a mesma melhoria no repositório e na tela.

## O que não cabe declarar pronto / escopo para o PR

1. Validar JSONB, revisão condicional, RLS e retomada em Postgres descartável. O test double
   não prova trigger, política ou configuração do banco publicado.
2. Avaliar respostas reais com as fontes ativas e com as cinco capacidades de produto.
   A integração com os novos materiais preparados segue como frente própria, sem atalhos.
3. Conectar triagem de risco atual e revisar o texto de cuidado. O domínio possui trava,
   mas a entrada ainda não oferece o percurso completo. Isso bloqueia exposição às famílias.
4. Conversa livre está disponível por adaptador, mas turnos ainda não são persistidos em
   `conversas`. Reutilizar esse contrato e `planos.conversa_id`; não criar outra memória.
5. Prioridade por criança é apenas de sessão. Vários planos são preservados; não há garantia
   persistente/transacional de um prioritário. Proposta de migração separada, NÃO executada:
   campo opcional de prioridade em `planos`, unicidade por família/membro e operação atômica
   para trocar o prioritário. Conferir alternativas existentes antes de escrever SQL/número.
6. Resultados do plano não são copiados automaticamente ao diário global/Perfil/Evolução.
   Conciliação com os aplicadores e procedência da G02 ainda é necessária.
7. WhatsApp, agendador e ferramentas do Lúdico não foram conectados. Não há botão que finja
   criar história ou mensagem. Lembretes ficam desligados e ativação pelo browser é recusada.
   Pausar aqui não prova interrupção de proativas existentes (PEND-248).
8. O percurso completo dentro do chrome autenticado e a descoberta pelo menu não foram
   aprovados; os prints são do mesmo componente no harness interno isolado.

## Conciliação, segurança e reversão

Matriz entregue antes das alterações em `docs/specs/plano-web-v51.md`.
A página compartilhada de detalhe foi conferida em leitura na candidata principal: não
havia modificação local nesse arquivo. A adaptação é só o reconhecimento do novo envelope.
Não integrar o teste Stripe já modificado no checkout nem `lib/web-v5/*` como parte deste PR.
Nenhum arquivo da candidata principal foi editado. Nenhum banco, migração, flag, Core,
Home, Lúdico, Stripe ou dado familiar foi alterado. Sem env real para build ou QA.

Reversão: retirar exclusivamente os novos módulos/rotas V5.1 e o redirecionamento específico.
Não há migração a reverter. Um registro novo V5.1 deverá manter sua leitura disponível
se uma integração futura for revertida; não apagar estados nem reinterpretá-los como legados.

Persistência real, concorrência transacional de prioridades, prova de produção e publicação
permanecem bloqueadas. Observabilidade técnica foi preparada, não exercida com provider real.
PEND-217 e PEND-248 atualizadas, sem baixa. Na revisão do Lúdico, PEND-220/PEND-221 receberam
somente evidências/limites de leitura. Índice sincronizado, 192 fichas, IDs únicos.

## Quadro G00–G10

| Gate | Estado nesta entrega | Produção / próximo passo |
|---|---|---|
| G00 — Ambiente | BLOQUEADO | Runtime/banco/roteamento/latência dos canais não comprovados nesta rodada |
| G01 — Fontes | PARCIAL | Preparação/curadoria anterior; novos materiais não comprovados no runtime |
| G02 — Memória | Validação local parcial | Novos eventos escopados testados; não encerra escritores/identidade Web–WhatsApp |
| G03 — Conversa | Candidata não aprovada | Adaptador estruturado local; simulações reais e revisão semântica pendentes |
| G04 — Referências | Falhas anteriores permanecem | Recuperador não foi corrigido ou integrado nesta frente |
| G05 — Combinados | Parcial local | Cinco estados e persistência simulada; banco/diário/canais pendentes |
| G06 — Feedback | Parcial local | Estrelas separadas do resultado; agregação e utilização pendentes |
| G07 — Qualidade | Regressão focada aprovada | 95 testes e build; regressão integrada e prova operacional pendentes |
| G08 — Avaliação da Karina | Interface pronta para revisão local | IA integrada real ainda pendente; prévia não é aprovação integral |
| G09 — Publicação | BLOQUEADA para esta candidata | Entrada Web anterior é histórico; nada novo publicado nesta execução |
| G10 — Produção | Não validada | Nenhuma prova operacional nova |

**0 de 11 gates formalmente encerrados.** Não confundir a fatia de interface/persistência
simulada aprovada com a liberação da nova inteligência.
