# Rotina Visual — fechamento técnico da Etapa 1

**Data:** 30/09/2026
**Pendências relacionadas:** PEND-004, PEND-038, PEND-058 e PEND-215
**Estado:** publicada em produção no SHA `b24eb93`; nova prova humana pendente

## Problema observado

No teste da Manu, o pedido de ajuda para sair de casa e ir ao mercado recebeu
primeiro orientação genérica e depois o menu “dia inteiro / manhã / depois da
escola / noite”. A resposta não ajudava a família a descobrir **qual situação**
precisava de cartões, não explicava que a Ayla podia sugerir uma sequência
editável e demorou 19,794 s para concluir o turno.

## Baseline congelado

O rastro do turno real de 29/09 registrou:

- total: 19,794 s;
- primeira resposta: 19,388 s;
- espera para agrupar balões: 3,280 s;
- prontidão/segurança da rotina: 2,868 s;
- condutor que redigiu a pergunta: 4,659 s;
- persistência e envio: 2,138 s.

A janela global continua com portão final de 10 s, mas o preparo já começa aos
3 s. Reduzi-la sem nova prova recriaria a fragmentação da PEND-058.

## Causa raiz

1. O contrato ainda permitia transformar um pedido de ajuda em um cardápio de
   períodos do dia, em vez de localizar a situação concreta.
2. Depois que o porteiro já decidia que faltava escopo ou uma única informação,
   um segundo modelo era chamado só para reescrever essa pergunta.
3. Leituras independentes de Perfil, proposta, histórico, rotinas anteriores e
   irmãos eram feitas em série.
4. Reencontrar uma sequência pelo WhatsApp não tinha uma rota explícita, embora
   o artefato já estivesse salvo.
5. Em balões enviados com alguns segundos de intervalo, o primeiro podia ser
   claimado por uma execução depois cancelada. A execução seguinte via apenas a
   continuação e herdava a criança da conversa anterior.
6. Um exemplo de sequência era só prosa. “Pode ser essa” não tinha uma proposta
   estruturada para aceitar, então o gerador recompunha e acrescentava etapas.
7. A origem de `NEXT_PUBLIC_APP_URL` era usada mesmo quando continha espaços.

## Etapa 1 entregue

- Pedido genérico pergunta **qual situação está difícil**, com texto livre ou
  áudio; não oferece manhã/noite/dia inteiro.
- Situação conhecida oferece uma escolha contextual: jornada inteira ou trecho
  difícil. O porteiro usa exemplos da própria situação, como fila, barulho ou
  espera.
- A Ayla explica que sugere os cartões e que a família pode trocar, tirar,
  acrescentar ou mudar a ordem antes das imagens.
- Uma criança disponível não gera pergunta desnecessária. Com irmãos, o contexto
  atual continua valendo; só há pergunta quando o alvo é realmente ambíguo.
- Rotinas recebem nomes humanos, permanecem separadas e não substituem um
  artefato antigo em silêncio.
- “Quais rotinas já criamos?” lista os nomes da criança em foco. “Traz a fila no
  mercado” reabre a existente por link autenticado, sem duplicar nem regenerar.
- O fechamento ensina que a família pode contar se ajudou, pedir ajuste ou pedir
  outra sequência para outro momento difícil.
- Calendário semanal permanece fora deste fluxo, conforme a decisão de produto.
- Balões consecutivos antes da resposta são recompostos para resolver a criança;
  nome explícito como “Manu” vence o contexto antigo de Bento.
- Em situação contida, a sequência mostrada é persistida como proposta. “Pode
  ser essa” gera exatamente aquelas etapas, sem aviso, escolha ou recompensa
  inventados.
- O turno após montar mostra quadro + pergunta de tema. O link fica para a
  resposta seguinte, evitando duas decisões e uma escrita inútil de token.
- URL pública inválida cai no domínio canônico; espaços nunca chegam ao link.

## Latência — mudança desta entrega

- O portão clínico da prontidão foi preservado.
- Quando o resultado já é `falta_escopo` ou `falta` com uma pergunta definida,
  a resposta é composta pelo código e o segundo modelo não é chamado.
- A exceção é intencional: numa passagem curta, o condutor continua sendo usado
  quando precisa **propor uma sequência**, porque ali ele não está apenas
  reescrevendo uma pergunta.
- Perfil e proposta são lidos em paralelo. Depois, histórico, rotinas anteriores
  e irmãos também são lidos em paralelo.
- O rastro distingue `pergunta_escopo_sem_condutor` e
  `pergunta_unica_sem_condutor`, permitindo medir a melhora em produção.

Pelo baseline, o caminho de pergunta simples deixa de pagar os 4,659 s do
condutor, além de reduzir esperas de banco. Isso é uma projeção estrutural, não
um número de produção: P50/P95 só podem ser afirmados depois do novo deploy e de
turnos reais autorizados.

## Prova local

- 30 arquivos da frente: **685/685 testes passaram**.
- Regressões literais cobrem Manu/Bento entre balões, “pode ser essa”, as cinco
  etapas do banho, formatação sem recuo e a URL com espaços vista em produção.
- Build Next.js de produção: compilação, TypeScript e 106 páginas concluídos.
- `/api/health` confirmou `b24eb93` em `main`, ambiente `production`, com banco
  saudável após o deploy.
- `tsc --noEmit --incremental false`: nenhuma falha nos arquivos alterados; o
  comando isolado ainda encontra os `PageProps` globais ausentes em 14 páginas
  preexistentes. O build oficial gera esses tipos e passou.
- Nenhuma mensagem de WhatsApp foi enviada e nenhuma conta de família foi
  alterada durante a validação.

## Prova que ainda falta

Depois do deploy, uma pessoa autorizada deve testar no WhatsApp:

1. “Quero ajuda para montar uma rotina visual.”
2. Informar em dois balões: “Manu tem dificuldade no banho. A água fria e o
   barulho incomodam.” e depois “Ela gosta da toalha fofinha.”
3. Escolher jornada inteira ou trecho difícil.
4. Conferir a proposta e responder “Pode ser essa”; verificar que nenhuma etapa
   nova foi acrescentada.
5. Escolher o tema; só então abrir o link autenticado, gerar os cartões e verificar todas
   as imagens.
6. Pedir a lista de rotinas e reabrir a mesma pelo nome.

O rastro deve provar fala, persistência, link, artefato e tempo até a primeira
aceitação do provedor. Até essa prova, o veredito é **PASSOU COM RESSALVAS**.
