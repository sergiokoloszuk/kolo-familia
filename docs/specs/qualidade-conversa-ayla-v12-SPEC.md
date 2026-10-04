# SPEC — qualidade da conversa Ayla v12

Data: 2026-10-01

Risco: CRÍTICO — muda a fala percebida por todas as famílias

Dona: Produto Kolo Família

## Problema

A primeira resposta da Ayla pode funcionar como amostra, menu ou convite para
aprofundar; respostas objetivas alongam, brincadeiras viram várias opções e
participação apoiada pode ser tratada como etapa rumo à retirada de ajuda. A
família precisa receber uma ajuda curta, completa, segura e executável já no
turno atual.

## Contrato da conversa

- O primeiro turno útil entrega uma forma inteira: ação, frase, brincadeira,
  história, sequência visual ou pergunta realmente decisiva.
- A Ayla escolhe; não apresenta menu de especialidades ou de formatos.
- Normalmente são duas bolhas: ação/avanço e retorno simples. Título nunca ocupa
  uma bolha sozinho. Segurança e pedido técnico podem usar o espaço necessário.
- Situação temporal pode usar agora, depois da regulação e antes da próxima
  vez, como uma única orientação.
- “Não funcionou”, “ficou igual” e “outra sugestão” mudam mecanismo ou variável,
  não apenas as palavras.
- Emoção, intenção, causa e sensibilidade só entram com evidência. Comportamento
  observável não é traduzido automaticamente em estado interno.
- Participar com apoio é participação. O apoio atual é preservado até existir
  evidência específica de que uma etapa se sustenta com menos ajuda.
- Pedido explícito de brincadeira recebe um jogo completo, divertido e
  executável, sem exigir fala ou contato visual.
- Desabafo recebe acolhimento e escolha antes de estratégia, salvo sinal real
  de risco.
- Uma confirmação social isolada depois de uma resposta comum concluída recebe
  no máximo um fecho curto (até 40 caracteres), sem repetir orientação. Outra
  confirmação em seguida não abre pingue-pongue. “Sim” não é fecho social:
  pode autorizar entrega. Pergunta, oferta, segurança, trial e artefato pendente
  conservam seus próprios fluxos; o fecho nunca afirma que uma ação ocorreu.

## Conhecimento

Os materiais da Pós orientam o raciocínio, não são despejados no prompt. Entram
princípios seguros e consistentes — comunicação funcional, ecolalia com função,
marcadores de encaminhamento, distinções sensoriais, checagens orgânicas,
mediação escolar e interesses como veículo. Ficam de fora contato visual
forçado, retenção de objeto para obter olhar, explicações por “neurônios
espelho”, percentuais sem fonte e obrigação de iniciativa independente.

## Latência

Esta mudança não adiciona chamada ao modelo. Compactação de bolhas é
determinística e posterior à geração. Core menor reduz contexto, mas só
telemetria ponta a ponta autoriza afirmar ganho. Aceite continua o da PEND-215:
mensagem comum alvo P50 ≤ 20 s e P95 ≤ 28 s; nenhum resultado local isolado é
prova de produção.

## Publicação global e rollback

Não há piloto ou coorte. Antes da ativação global: teste sintético com o modelo
real, regressão completa, typecheck, build e verificação da versão arquivada.
Publicar primeiro o código; confirmar o SHA no health; depois ativar um único
Core v12 para todas as famílias. Rollback: reativar Core v11 e reverter o código
ao SHA anterior. A ausência de allowlist/flag por família faz parte da prova.

## Provas obrigatórias

1. Código: testes, typecheck e build executados.
2. Conteúdo: versão, tamanho e SHA do Core v12 conferidos após escrita.
3. Produção: health sem cache mostra `ref=main`, ambiente, banco e SHA exato.
4. Alcance: um Core ativo global e nenhuma coorte de famílias.
5. Conversa: turno interno/autorizado reconstruído com inbound, outbound,
   bolhas, versão do Core, chamadas de modelo e latência até primeira aceitação.
6. Veredito final apenas PASSOU, PASSOU COM RESSALVAS, FALHOU ou BLOQUEADO.
