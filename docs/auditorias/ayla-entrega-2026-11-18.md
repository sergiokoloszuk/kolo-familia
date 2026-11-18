# Ayla — acolhimento e orientação em tópicos · 18/11/2026

**Veredito local: PASSOU COM RESSALVAS.** Pronta para Preview/revisão; não publicada em produção nem validada no aparelho da usuária.

## Problema, baseline e causa

Um relato autorizado de 18/11 sobre uma separação temporária e cuidados de alimentação, sono e emoções recebeu uma resposta em dois parágrafos, sem tópicos. A resposta continha cuidados úteis, mas não acolhia explicitamente a preocupação. O texto original foi congelado somente no artefato privado local, sem telefone, segredos ou conteúdo familiar neste commit.

O SHA servido confirmado no health foi `8a7110d7ae15760b9753da1d6fc1310987576479`, igual ao remoto antes da edição. Core ativo v12, inalterado. Havia pressão cumulativa: referência de 700 caracteres, primeira bolha com 20–45 palavras, 1–2 negritos e uma forma/ação por turno. O agrupador legado separava parágrafos em mensagens. O caminho oficial observado já enviou a resposta original em uma mensagem; não se atribui a ele uma fragmentação não observada.

## Correção mínima e reutilização

- `conducao/formas.ts`: orientação suficiente para o pedido, acolhimento da emoção expressa, possibilidade realista quando útil, bullets com chamada em negrito e uma ideia por item. Remove cotas de caracteres para orientação e de trechos em negrito. Mantém proporção de cumprimentos, continuidade, urgência, desabafo, idioma e uma pergunta pertinente por vez.
- `ia/prompt.ts`: alinha a Web aos tópicos e deixa caber cuidados complementares do mesmo pedido; mantém a sintaxe de títulos de seção e as exceções conversacionais.
- `ayla/bolhas.ts`: reaproveita somente o agrupador da PR visual #152 (`d638064`), preservando conteúdo e respiro, uma orientação por unidade e atividades completas quando identificáveis. Limite de 4.000 é operacional da aplicação, não limite certificado do provedor. Não traz renderer nem outras alterações daquela PR.
- Testes correspondentes atualizados porque os contratos anteriores exigiam fragmentação e prosa; nenhum teste de segurança, identidade, memória ou cobrança foi removido.

Core, DNA, 13 skills, perfil, memória, recuperação de conhecimento, trial, campanha, modelos e orçamento de saída permanecem sem alteração. Nenhuma migração ou dependência nova. A prioridade do roteamento de outra candidata não integra este commit.

## Evidência de modelo real

Captura do produtor do SHA servido com leitura do perfil hoje e histórico limitado ao turno original. A classificação foi fixada para comparar (`rotina` e `nutricional`), não recuperada do trace original. O simulador omite a jornada comercial. Portanto, trata-se de replay reconstruído; não é reprodução byte a byte do turno original. Nenhuma resposta foi enviada ou persistida na conta.

Modelo `gpt-5.6-luna`, teto 1.200, esforço low e schema iguais. O prefixo do contexto e a mensagem são idênticos no A/B. Apenas o bloco final de instruções de entrega mudou; duas BPs chegaram nesse replay, sem alegar que isso prova uso da Pós no turno original.

| Medida | Controle (2 gerações) | Candidata final (2 gerações) |
|---|---|---|
| Bullets com título em negrito | 0, 0 | 4, 4 |
| Entrada, tokens | 12320, 12320 | 12319, 12319 |
| Saída total, inclui raciocínio | 226, 302 | 524, 501 |
| Tempo da geração em ms | 4600, 4220 | 7068, 6422 |
| Encerramento normal | 2/2 | 2/2 |

Foram oito gerações de orientação ao todo, incluindo candidatas intermediárias preservadas. A primeira revisão melhorou a organização, mas não produziu bullets; foi corrigida. As duas finais acolhem a preocupação, cobrem cuidados concretos e usam quatro bullets. A reflexão inspiradora não é obrigatória nem foi demonstrada consistentemente: depende da aprovação humana da utilidade. Não se promete melhora universal de todas as skills.

Os tempos acima são geração isolada, não latência ponta a ponta. A amostra é pequena; houve variação entre rodadas. Não se afirma latência menor ou sem aumento. Entrada final: um token abaixo do controle; saída maior. Sem novas chamadas no runtime, buscas ou mecanismos de espera.

## Testes, regressão e portões

- Suíte completa final: **4335 aprovados, 0 falhas, 7 pulados**. Certificados do Windows usados na execução; uma tentativa anterior sem eles falhou na chamada de erro do provider (PEND-214), sem alteração desse teste.
- Build webpack concluiu 108 páginas estáticas/entradas de geração; typecheck posterior passou. O primeiro build falhou ao buscar fontes por certificado e passou com system CA, sem desligar TLS.
- Agrupamento exercita listas espaçadas, falas prontas, orientação extensa, três atividades completas, preservação de conteúdo e emojis compostos.
- Nenhum WhatsApp, e-mail ou cobrança disparado. Leituras de conta somente do escopo autorizado; telemetria da bancada em memória. Sem escrita em perfil, conversa ou banco editorial.
- Concorrência, idempotência, reconciliação: sem novo estado, alteração nesses mecanismos ou novo envio. Transporte mantém contratos existentes; não prova novos cenários operacionais por inferência.
- Observabilidade: métricas existentes mantidas; capturas de I/O, versões e hashes no artefato privado. Não adiciona logs com conteúdo familiar.
- P1–P3: pedido e formato reproduzidos, sem novas perguntas obrigatórias. P4: geração e agrupamento validados em bancada, tela/aparelho ainda pendentes. P5: escopo de pessoa preservado, isolamento coberto pela suíte; sem novo teste humano. P6: persistência/retomada não alteradas, sem afirmar prova longitudinal nova. P7: erros técnicos registrados e corrigidos no ambiente de validação. P8: Preview, CI e prova humana ainda pendentes.

## Entrega e rollback

Branch `codex/ayla-acolhimento-20261118`, sobre `8a7110d`. Publicar somente Preview para avaliação; merge/produção aguardam aprovação da usuária. Rollback por revert do commit, sem migração ou reparo de dados. Mensagens já persistidas não são reescritas.

PEND-229 atualizada sem baixa; PEND-213/231, inteligência aprofundada e latência continuam frentes distintas. Não fecha nenhuma ficha por teste local. O limite principal é a falta de validação humana da resposta e da apresentação efetiva no canal real.
