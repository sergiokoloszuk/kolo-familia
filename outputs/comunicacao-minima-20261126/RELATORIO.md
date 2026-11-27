# Comunicação mínima — entrega local, sem publicação

Base `8a18707de242ca877842bf102b7dba08e47d1eaa`; branch `codex/ayla-comunicacao-minima-20261126`. Escopo: seis diferenças autorizadas, propostas de duas BPs em arquivo local e bancada curta. Pacote de 78 unidades, Plano V5.1, Home, candidata principal, banco, migrações, Stripe e flags de runtime ficaram fora da alteração. A proposta posterior de sete conversas longas é outra auditoria: não foi substituída por esta bancada.

**Veredito do conteúdo: FALHOU.** A candidata não está aprovada para publicação. Há correções técnicas verificadas localmente, mas persistem inferências indevidas, pouca investigação e expectativas sobre fala não sustentadas. Nenhum gate G00–G10 foi encerrado.

## FATO — código e medição

| Item | Evidência | Resultado local |
|---|---|---|
| Crença tratada como algo que não podia ser discutido | `apps/web/src/lib/conhecimento/recuperar.ts:384` | Agora possibilidade editorial, só explorada como hipótese apoiada no relato, sem acusação ou culpa. O rótulo histórico foi preservado para não alterar contratos. |
| Seis frases sobre apoio ao adulto | `apps/web/src/lib/conducao/diretrizes.ts:27` | Definidas uma vez, usadas no núcleo e no fallback; teste conta ocorrência única por prompt. Texto do Core do banco somente em `PROPOSTA-CORE.md`, sem escrita/publicação. |
| Fallback antigo | `git log` do `experimental-prompt.ts`: último commit anterior `818e004`, 15/08/2026 | Revisão incremental de apoio ao adulto e segurança em `experimental-prompt.ts:29`, sem substituir o documento ativo do Admin. Não é cópia da versão atual do banco. |
| “Só CVV e pare” | Base `apps/web/src/lib/ia/prompt.ts:90` | Regra exclusiva removida; botões e Plano reutilizam `SEGURANCA_COMPARTILHADA`, definida no arquivo existente `diretrizes.ts:105`. Nenhum novo arquivo de voz. |
| Tags rejeitadas | 372 BPs do snapshot local histórico; 461 tags distintas | Regex de slug descartava 248/461 (53,8%). A nova validação aceita valores editoriais literais seguros, sem normalizar acentos ou mudar a correspondência. Restam 35/461 (7,6%) rejeitadas: agregações de vários termos e expressões malformadas. Não há tentativa automática de separar conteúdo editorial. |
| Proteção da consulta | `recuperar.ts:188–197` | Slugs de skill mantêm a validação anterior. Tags admitem letras Unicode, números, espaços, ponto, barra, hífen e sublinhado; aspas, vírgulas, controles e operadores são rejeitados. Mesmo limite de 12 tags e duas consultas. Testes positivos e de injeção exercitam a função. |
| Erro não é vazio | `recuperar.ts`, callback `aoFalhar`; `experimental.ts:1083` | Erro na fase principal e no detalhe é sinalizado. Falha do detalhe preserva as BPs leves; o rastro informa a falha mesmo se o bloco não está vazio. |
| Rastro oficial WhatsApp | `experimental.ts:1312`; `conhecimento/rastro.ts:170–181` | Reutiliza logger e evento existentes: correlação por turno, membro, IDs recuperados/enviados, vazio e erro. Sem títulos, relatos, nomes ou prompt no evento. Best-effort, sem esperar a escrita; durabilidade em produção não foi testada. |

O rastro registra o que foi passado à função de geração, não recebimento remoto confirmado nem uso semântico. Retentativas reutilizam o mesmo identificador de turno. O laboratório interceptou também o pedido HTTP ao provider para conferir a projeção; isso é evidência diferente do evento de observabilidade.

## INFERÊNCIA — causa e limites

1. As duas BPs têm `comunicacao` e campos etários/condições vazios na base. A seleção prioriza a skill e, sem aderência lexical suficiente, conserva a ordem recebida. Isso explica sua repetição em desafios distintos. O baseline reproduziu a presença das duas na Web em ecolalia, resposta ao nome, inglês e expectativa de fala; WhatsApp também selecionou referências inadequadas. Isso não mede sua frequência atual em produção.
2. Conteúdo oferecido ao modelo influencia a resposta, mas não prova uso. Trocar fontes não garante voz, personalização nem fidelidade: as 24 respostas mostram isso. O modelo ainda trouxe certezas e gestos não relatados.
3. A revisão do fallback não muda as conversas que resolvem um Core ativo no Admin. As seis frases precisam de sua revisão para eventual publicação do Core; nada foi aplicado ao banco.
4. O roteador foi executado novamente nos dois braços; houve diferenças de skills. Portanto, parte da variação de fontes, contexto e latência não pode ser atribuída exclusivamente à correção. Testes determinísticos complementam a comparação, sem transformar esta amostra em ensaio causal.

## PROPOSTA — duas BPs, sem gravação

Arquivo: `data/curadoria/comunicacao-minima-20261126.json`.

| ID preservado | BP | Proposta |
|---|---|---|
| `854864cc-4189-4e77-bb7e-89498ff70193` | Aviso prévio de 5 minutos | Associar a rotina/transições; tags específicas; condições de uso; não repetir como receita após tentativa sem ajuda. |
| `363fd1e4-7f89-4815-8c83-4ce2a5edf39d` | Limite firme + acolhimento | Associar a limites/emocional; distinguir observação e emoção suposta; orientar tom, momento, presença e capacidade adulta. |

**A faixa 3–12 é proposta editorial experimental para a formulação literal infantil, não faixa comprovada pela fonte nem marco do desenvolvimento.** Está explicitamente pendente de revisão antes de eventual publicação. O princípio de previsibilidade ou limite respeitoso pode ser pertinente fora dela, com outra formulação. Idade desconhecida continua elegível/incerta. Os testes não provam validade científica dessa faixa. Não foi retirada nenhuma unidade, nem escrito qualquer patch no banco real.

Na bancada, as alterações foram sobrepostas somente às linhas em memória. Fora dela, a aplicação continua dependendo dos dados reais. Não há importador, SQL, migração, segundo recuperador ou nova skill nesta entrega.

## Respostas e qualidade

[24 respostas completas](RESPOSTAS-COMPLETAS.md), [avaliação por caso](AVALIACAO.json), [métricas](METRICAS.json), [manifesto](MANIFESTO.json), [proposta de Core](PROPOSTA-CORE.md).

Seis casos congelados: ecolalia, não atender pelo nome, inglês dos desenhos, esgotamento, expectativa de fala e tentativa anterior sem ajuda. Nome, idade técnica e histórico são fictícios. Antes/depois, Web e WhatsApp: 24 respostas reais de modelo; nenhum diálogo foi reescrito para parecer melhor. As notas Traduzir/Conectar/Encantar/Provocar/Valorizar são revisão qualitativa do Codex, não feedback de famílias ou auditoria independente. Falha de fidelidade não é compensada pelas notas.

Reprovações principais da candidata:

- Web REF02: infere condição de processamento auditivo a partir de reação a som.
- Web REF03: atribui fluência, aprendizagem e função ao inglês sem confirmação.
- Web REF04: consolo automático e afirmação não sustentada sobre crianças que crescem mais.
- Web REF05 e WhatsApp REF05: gestos atuais não confirmados e fala tratada como destino esperado.
- REF06: mudança prática sem investigar adequadamente a tentativa; atribuição de intenção e capacidade adulta.

São falhas de aplicação apesar de regras de hipótese/verdade já existirem. Não é possível apontar uma linha isolada como causa demonstrada. O caminho exato e os pedidos com hash estão nos JSONs; as explicações causais são inferências, não provas experimentais. Não acrescentei instruções genéricas para maquiar essas reprovações.

## Latência e tokens

Uma execução por caso/versão/canal; N=6 por célula. Tempo local até resposta completa, incluindo chamadas do classificador/roteador. Não mede primeira resposta útil, entrega de WhatsApp, rede móvel nem produção. P95 é o maior valor desta amostra pequena, pelo método de posto mais próximo.

| Canal | Braço | P50 | P95 | Falhas de geração |
|---|---|---:|---:|---:|
| Web | Antes | 11.764 ms | 13.923 ms | 0/6 |
| Web | Depois | 11.168 ms | 14.283 ms | 0/6 |
| WhatsApp | Antes | 6.485 ms | 7.607 ms | 0/6 |
| WhatsApp | Depois | 4.550 ms | 7.088 ms | 0/6 |

Não há prova de melhora de latência com uma rodada. A Web fez três chamadas por turno; WhatsApp duas, exceto REF04 antes (três: a fronteira clínica regenerou). Nenhuma chamada de modelo foi acrescentada ao código. O rastro acrescenta uma escrita assíncrona por tentativa de geração no mecanismo existente; seu custo remoto não foi medido.

Estimador comum: `ceil(caracteres do pedido / 4)`. Acima do limite de referência de 10%, individualmente:

| Caso WhatsApp | Antes | Depois | Aumento | Interpretação |
|---|---:|---:|---:|---|
| REF02 | 7.600 | 8.830 | 16,18% | Fallback enriquecido e duas BPs distintas com mais conteúdo. |
| REF03 | 7.953 | 9.005 | 13,23% | Mesmo acréscimo de fallback e troca do aviso genérico por outra fonte. |
| REF06 | 7.157 | 8.860 | 23,79% | Antes não houve BP; depois o classificador escolheu emocional/bem-estar e recuperou duas. Não atribuir todo aumento ao texto das seis linhas. |

O orçamento desses três casos continua ressalva, sem esconder na média. Os campos nativos de entrada da Anthropic registrados na bancada excluem cache; não são apresentados como total de tokens do prompt. As chamadas preservam modelo, HTTP, duração, estimativa, hash e projeção. Tokens/custo real total com cache exigem captura adicional em futura medição, não inferência.

## Testes, build e regressão

Resultados consolidados estão em `RESUMO-VALIDACAO.json` (gerado ao término das verificações). Primeira rodada ampla: 4.370 testes, 4.358 aprovados, cinco falhos, sete pulados. As cinco falhas eram verificações antigas dos trechos deliberadamente alterados: catch literal, proibição de qualquer import no fallback, texto do piso e teto do núcleo. Foram atualizadas preservando seus propósitos e os novos testes de comportamento. Uma regex de teste chegou a confundir comentários com imports; corrigida antes da rodada de entrega. Resultados intermediários foram preservados localmente, sem anunciar todos verdes.

O teto explícito do núcleo passou de 57.000 para 58.000 caracteres (+1,75%), para as seis linhas autorizadas e o esclarecimento de segurança; o texto atual tem 57.897 caracteres. Teste impõe seis linhas e menos de 900 caracteres para o bloco novo. Nenhum limite de qualidade foi relaxado nas conversas: suas reprovações permanecem.

Build local `next build --webpack`: passou, 108 páginas. Typegen/typecheck e lint dos arquivos afetados passaram. Sem `.env` real no build; valores fictícios equivalentes ao CI. A primeira tentativa no sandbox falhou por DNS/permissões; a repetição fora do sandbox passou. A instrumentação da dependência existiu só em memória para observar URL, sem corrigir o loader.

**CI anterior / fonte:** o erro no loader exigia uma URL sem extensão reconhecida, mas os logs do PR #167 não registraram qual. As três consultas públicas atuais (Geist Mono, Fraunces, Plus Jakarta Sans) não apresentaram URL inválida e o build local passou. `fontes-diagnostico.json` lista as URLs efetivamente consultadas. A URL exata que falhou no CI continua **NÃO COMPROVADA**. Não foi alterado layout, fonte, dependência ou CI.

O teste `experimental-contexto.test.ts` permaneceu excluído conforme o CI/PEND-257, por procedência não verificada da fixture. Os sete pulados da suíte não viram aprovações. Nenhuma família real foi usada para QA.

## Conflitos, reversão e produção

Esta branch parte da main, não da candidata principal modificada. Não houve merge com G02/G03/G04/KBC nem cópia sobre seus arquivos de trabalho. Mudanças futuras nesses arquivos exigem conciliação novamente. Os rascunhos das 78 unidades permaneceram fora do commit.

`apps/web/vercel.json` ganhou exclusivamente `deploymentEnabled: false` para o nome desta branch, para impedir preview automático ao abrir o rascunho. Não altera flags do runtime nem habilita deploy em produção. Nenhum comando de deploy ou merge foi executado.

Rollback futuro do código: reverter o commit desta branch, antes de qualquer integração. Não há esquema, migração ou dado a reparar. As duas propostas de BP não foram aplicadas e o Core do banco não foi publicado. O mecanismo de segurança continua independente de consulta de boas práticas vazia.

PEND-100, PEND-106, PEND-185 e PEND-253 receberam atualização local, **sem baixa**. Nenhuma pendência nova foi criada. Índice regenerado e conferido. Persistência de eventos, frequência de referências e comportamento em produção continuam não comprovados.

## G00–G10

| Gate | Estado | Evidência e pendência |
|---|---|---|
| G00 — Ambiente | BLOQUEADO | Runtime e latência atuais dos dois canais não comprovados nesta rodada. |
| G01 — Fontes | PARCIAL | Duas propostas locais; recorte etário editorial não aprovado para publicação. |
| G02 — Memória | Validação local; fechamento pendente | Esta branch não altera aplicador, identidade ou dados de famílias. |
| G03 — Conversa | FALHOU | Respostas completas preservadas; falhas de fidelidade e voz persistem. |
| G04 — Referências | PARCIAL / não encerrado | Tags e curadoria testadas; seleção ainda exige revisão semântica e validação do acervo real. |
| G05 — Combinados | Preparação | Sem mudança nesta rodada. |
| G06 — Feedback | Preparação | Notas desta bancada não são avaliações de famílias. |
| G07 — Qualidade | Validação local | Ver resumo de testes; limites de tokens e produção permanecem. |
| G08 — Sua avaliação | PENDENTE | Candidata não aprovada; auditoria longa solicitada é próxima entrega. |
| G09 — Publicação | BLOQUEADA | PR em rascunho; sem merge/deploy desta conversa. |
| G10 — Produção | NÃO VALIDADO | Nada desta rodada foi comprovado em produção. |

0/11 encerrados. Próxima fase liberada: auditoria somente leitura e simulação longa com Core ativo do banco, sem implementar correções a partir dela. Integração/publicação não estão liberadas.
