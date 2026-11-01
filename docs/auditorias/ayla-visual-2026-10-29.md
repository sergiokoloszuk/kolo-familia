# Ayla — correção visual isolada

29/10/2026 · branch `codex/ayla-visual-respostas` · base `1cb11c5577db05b56d1d23a971746b132adbc70d`.

## Escopo e isolamento

Autorizada somente a apresentação: títulos naturais na conversa Web, listas
numeradas com espaços, Markdown e falas destacadas, consistência entre resposta
em transmissão e salva, agrupamento do WhatsApp por unidade de conteúdo.

Antes das edições: PR #150 aberta em `014580e`, com sobreposição nas duas telas
da conversa e no caminho de publicação; PR #151 de latência já integrada na base
`1cb11c5`. O checkout principal tinha muitas alterações locais e o worktree da
#150 tinha três documentos modificados. Nada deles foi copiado, descartado ou
incluído. Esta branch nasceu limpa da `origin/main`, em outro worktree.

`qualidade-resposta.ts`, prompts, perfil, extração de memória, fontes de
conhecimento, modelo, raciocínio, trial, Black Friday e botões ficaram fora do
diff. Descoberta Inteligente e a auditoria de profundidade são propostas em
artefatos locais separados, sem código nem fixture de qualidade neste commit.

## Problema, baseline e causa

- O renderizador impunha `uppercase` aos títulos de nível 3 ou inferior.
- Linhas em branco encerravam cada lista: `1 / 2 / 3` aparecia `1 / 1 / 1`.
- No WhatsApp, parágrafo e mensagem eram tratados como a mesma separação.
- Baseline executado antes da correção: **7 falhas e 4 acertos em 11 testes**.
  Na fixture completa de três atividades, o divisor retornou **29 mensagens**.
- A revisão encontrou outro contraexemplo reproduzido: um subtítulo interno
  `Preparação` separava material de execução, impedindo reconhecer as três
  atividades. O teste falhou com **1 mensagem em vez de 3** antes do ajuste.

Esses números são de entradas sintéticas e funções locais. Não medem frequência
em famílias nem comprovam recebimento em um aparelho WhatsApp.

## Solução e reutilização

1. `RespostaConversa` reutiliza `RespostaMarkdown` e a limpeza já existente.
   A resposta salva e o streaming chamam o mesmo componente. A variante de
   conversa aplica capitalização natural, largura de leitura, respiro e citação
   destacada. Outras telas preservam seus estilos anteriores.
2. O parser continua listas espaçadas e preserva início e reinício explícitos.
   Não reescreve mensagens salvas nem introduz HTML arbitrário.
3. `dividirEmBolhas` conserva orientações completas. Reconhece unidades com
   material e execução, incluindo subtítulos internos; introdução acompanha a
   primeira atividade e continuidade acompanha a última. Três atividades
   reconhecíveis e dentro do tamanho resultam em três mensagens.
4. Um teto **operacional conservador de 4.000 unidades UTF-16** divide conteúdos
   extensos por parágrafo, linha ou palavra. Tokens longos respeitam caracteres
   compostos quando possível. Não se afirma que 4.000 seja o limite oficial da
   Z-API: o máximo numérico desse endpoint não foi confirmado.
5. O Legacy já usava o divisor. A resposta principal experimental passa a optar
   explicitamente pelo mesmo agrupamento no helper de publicação. Proativas e
   demais chamadores não optam; botões e remetente permanecem intactos.

Foi removida a regra de uma mensagem por separação visual. Nenhum serviço,
agente, dependência, tabela ou mecanismo paralelo de memória foi acrescentado.

## Persistência, concorrência e observabilidade

Uma resposta completa continua como **uma linha lógica no histórico**, com
todos os IDs aceitos nos metadados de entrega. O primeiro ID continua na coluna
que tem unicidade; nenhuma alteração de schema ou reparo retroativo.

Se uma parte falhar, o retorno é `enviada:false`. O log conserva texto original,
aceites e contagem prevista/aceita. O histórico registra somente as partes
aceitas, com `entrega.incompleta=true`; não carrega âncoras de ofertas que podem
estar na parte não enviada. Zero partes aceitas não vira mensagem enviada.

O controle do turno é revalidado entre partes. A métrica de primeira resposta
continua marcando o primeiro aceite; tempo total de provedor cobre as partes.
Esses são registros de **aceite pelo provedor**, não prova de recebimento/leitura.
Não foram adicionadas chamadas de IA, retries automáticos, cadências ou regras
comerciais.

## Testes e prova visual

- Renderização: numeração contígua/espaçada, início em 4, listas independentes,
  reinício, Markdown, citações, HTML escapado, texto longo e prefixos parciais.
- Agrupamento: orientação curta/prática, três atividades, títulos em diferentes
  formatos, subtítulos internos, palavras/URLs/números preservados, limites e
  emojis compostos.
- I/O substituído: três partes com uma linha histórica, falha sem aceite,
  aceite parcial verdadeiro, âncora preservada no sucesso, proativas intactas
  e primeira resposta no primeiro aceite.
- Os testes estruturais antigos que exigiam o literal da regra substituída
  foram alinhados ao novo contrato, mantendo os testes comportamentais de
  persistência e preservando a lógica de cooldown.
- Prova do componente real com CSS do build: **9 combinações**, três formatos
  em 320/360/736 px, sem extravasamento horizontal, títulos sem caixa alta e
  sequência `1 / 2 / 3`. Conteúdo sintético, sem acesso à conta da família.
- As fixtures de apresentação retornaram **1 / 1 / 3 mensagens**, respectivamente
  para curto, prático e atividades. Não houve envio real de WhatsApp.

O build local usa variáveis fictícias do CI. Um erro inicial de certificado no
download das fontes foi resolvido usando a cadeia de confiança do Windows
(`--use-system-ca`), sem desativar TLS. O teste preexistente do provedor também
passou após o mesmo ajuste. Dependências já instaladas foram reutilizadas por
junctions; nenhum lockfile mudou. Não remover esse worktree recursivamente
seguindo junctions.

Resultado local final: **223 arquivos de teste, 4.235 testes aprovados, 7
ignorados e zero falhas**; mais **5 testes do índice de pendências**, índice
sincronizado e `git diff --check` sem erros. Build final e TypeScript passaram.
Lint dos arquivos da frente sem erros, com cinco avisos preexistentes de símbolos
não usados no orquestrador. A reprodução nova de subtítulos foi corrigida e está
incluída na suíte final, assim como os reforços de aceite parcial e métrica.
CI remoto e URL de Preview ficam no PR e no fechamento da missão. Não tratar
uma rodada anterior como prova de um commit posterior.

## Segurança, riscos, rollback e entrega

O renderizador produz nós React e conserva HTML escapado. Nenhuma opção textual
vira ação executável. Mesma pessoa/família dos chamadores; sem novas permissões,
consultas de perfil, endpoints de geração ou mutações de conta.

Riscos restantes: textos sem organização reconhecível podem permanecer juntos
até o teto operacional; o transporte precisa ser validado no aparelho em etapa
autorizada. Limite do endpoint e recebimento efetivo não foram medidos por esta
missão. A prova responsiva é do componente e CSS reais em uma bancada local;
não substitui aceite humano da Preview nem smoke autenticado completo.

Rollback: reverter o commit desta branch; sem migração ou reparo de dados. Não
há merge nem publicação de produção autorizados. A Preview é para avaliar esta
correção visual, sem integrar a inteligência do PR #150.

**PEND-145 atualizada**, sem baixa. PEND-146 e PEND-231 consultadas e intactas.
Nenhuma nova pendência duplicada. A medição real e a autorização de produção
continuam portões abertos da PEND-145.

**Veredito: PASSOU COM RESSALVAS.** Implementação candidata; produção não validada.
