# Missão crítica — condução adaptativa da Ayla no WhatsApp

Estado: **DESENHO GERAL APROVADO; FALAS POR TEMA EM REVISÃO; G1 LOCAL TESTADO,
QA E CI PENDENTES**.
Nenhum comportamento novo desta SPEC foi publicado ou validado em produção.
Dona do produto e da decisão de fala: Karina. Donos técnicos: Ayla/WhatsApp,
memória e Trial. Relacionadas:
PEND-213 (transporte e concorrência), PEND-231 (desenho integrado), PEND-016,
PEND-018, PEND-023, PEND-021, PEND-074, PEND-110, PEND-126 e PEND-229.

Nível **CRÍTICA**: IA fala com famílias, usa informação de crianças, pode
persistir memória e atuar no Trial. A publicação será global, sem coorte ou
uso de dados de família real como QA. Conta sintética interna autorizada pode
ser usada para prova no aparelho, sem tomar seu resultado como amostra das
demais famílias.

Decisão da Karina em 06/10: **desenho geral aprovado** e primeira ordem de
trabalho **Rotina/transições → Comunicação/socialização**. Alimentação
personalizada, especialmente “receita”, permanece bloqueada até resolver a
fronteira clínica e a revisão dos exemplos por tema. Os exemplos específicos
de botão ainda são propostas para revisão, não textos aprovados para envio.

## P1 · Problema, dono e resultado da família

A família recebe ajuda útil logo no primeiro balão, mas não sabe que outras
formas de ajuda existem e pode não saber quais dados faltam para uma sugestão
segura. A Ayla deve oferecer, só quando pertinente, uma próxima ação que a
família reconheça e queira usar. Frase que deve desaparecer: “eu não sabia que
ela podia me ajudar nisso”. Clique não é satisfação; resultado é ajuda recebida
e aproveitada, inclusive no retorno posterior.

## P2 · Descoberta e corpus obrigatório

O disparo vem da situação descrita, não de uma palavra mágica. A oferta é
opcional, depois da primeira ajuda, no máximo três botões renderizáveis e sem
menu quando a ajuda inicial já é suficiente. Corpus automatizado e revisão
humana cobrem, no mínimo:

| Contexto | Esperado |
|---|---|
| Relato alimentar com desafio concreto, sem urgência | Primeira ajuda; uma próxima ação alimentar só se pertinente |
| Pedido de receita com alergia desconhecida | Uma pergunta de segurança antes de qualquer receita personalizada |
| Restrição/alergia conhecida e atual da criança certa | Não perguntar de novo; não sugerir ingrediente conflitante |
| Dados contraditórios ou criança ambígua | Esclarecer alvo/fato antes da sugestão personalizada |
| Dificuldade de sair da brincadeira para a porta | Próxima ajuda contextual, não “Quero uma receita” |
| Desabafo, risco, pedido administrativo ou pergunta ainda aberta | Nenhum menu ou avaliação |
| Dois irmãos com hábitos distintos | Alvo explícito; zero mistura de dados |
| Mensagem livre antes/durante/depois de clique | Ambas recebem continuidade, sem duplicar nem perder |
| Clique repetido, tardio, texto equivalente ou retorno após silêncio | Estado recuperável e resposta idempotente |

Os testes incluem falso positivo (oferta indevida) e falso negativo (ajuda não
descoberta). A pessoa sempre pode responder por texto ou áudio livre.

## P3 · Conversa mínima, dados e falas para aprovação

Cada exemplo abaixo é **proposta ilustrativa**, não transcrição de produção.
Nenhuma pergunta de perfil antecede a primeira ajuda possível. Uma pergunta
adicional só entra quando muda a ação ou impede risco. Dado ausente jamais
significa ausência de alergia; dado salvo deve ter criança, fonte, data e
estado de confiança. Escrita crítica confere erro e relê antes de prometer
continuidade. Não afirmar que cadastro foi atualizado quando só a conversa
foi registrada.

| Situação | A conversa vai mudar de | Para |
|---|---|---|
| Alimentação | “Como lidar agora / Brincar / passear / Quero os dois” | Depois de uma ajuda curta: “Se quiser, posso pensar numa opção de lanche para [nome].” Botão: “Ideia de lanche” — somente quando o contexto sustenta isso. |
| Lacuna de segurança após escolha | “Aqui vai uma receita...” com restrição desconhecida | “Antes de sugerir ingredientes para [nome]: há alguma alergia ou restrição alimentar que preciso respeitar?” |
| Dado já conhecido | “Ela tem alguma alergia?” repetidamente | “Considerando a restrição a [alimento] que você me contou, ...” — apenas se a fonte e a atualidade estiverem confirmadas. |
| Saída de casa | Oferta alimentar genérica | “Quer montar uma sequência curta da brincadeira até a porta?” — sem prometer cartões prontos. |
| Descoberta sem pedido de recurso | “Posso ajudar em mais alguma coisa?” | “Se essa passagem ainda pesa, posso transformar estes passos numa rotina para conferir.” |
| Retorno positivo após uso | “Avalie minha resposta.” | “Deu para experimentar? O que ajudou mais?” — opcional, sem insistência. |
| “Não ajudou” | Repetir a mesma dica com outras palavras | “Entendi. Em que ponto travou: avisar, guardar o brinquedo ou sair?”; então mudar o mecanismo. |
| “Ainda não testei” | Contar como insatisfação ou insistir | “Tudo bem. Quando testar, me conte o que aconteceu; posso ajustar a partir daí.” |

Rótulos cabem no limite real do provedor e serão congelados no corpus antes de
serem enviados. “Receita” não é sinônimo de orientação nutricional segura; a
primeira versão pode oferecer apenas ideia de lanche quando não houver base
suficiente para personalização. Alimentação requer revisão humana pertinente.

### Proposta por tema para revisão da Karina

Estas fontes são **editoriais** (`docs/skills/*.md` e os dois originais da Pós),
não prova de que a respectiva skill esteja ativa ou de que o conteúdo esteja
no prompt de produção. Os documentos de skill dizem explicitamente “não
ativada”; não ampliar rótulos sem reconciliar conteúdo recuperado, Core ativo
e fronteira clínica. A Pós informa o raciocínio; não virar questionário,
diagnóstico, protocolo terapêutico ou alegação causal automática.

| Tema e fonte | Próxima possibilidade, só após ajuda | Dado mínimo que pode mudar a ação | Entrega se escolhida | Não oferecer quando |
|---|---|---|---|---|
| Alimentação — `skills/nutricional.md`, Pós B Tema 5 | “Explorar um alimento” (não “receita” por padrão). “Ideia de lanche” só se a família quiser preparar e houver segurança alimentar suficiente | Criança/idade; alergias e restrições atuais; aceitos/rejeitados; onde está na escada tolerar→provar; ânsia/engasgo/dor/perda de repertório | Uma ponte próxima ao alimento seguro **ou** exploração sem obrigação de comer; receita só com ingredientes conferidos | Engasgo/tosse/dor/perda de peso ou repertório em queda; alvo ou alergia incertos; tensão entre fonte nutricional e `FRONTEIRA_CLINICA` não resolvida |
| Rotina/transição — `skills/rotina.md`, exemplo “Da brincadeira à porta” | “Montar passos da saída” | A dificuldade é encerrar a brincadeira, atravessar a mudança ou iniciar a próxima etapa? Se o relato já respondeu, não perguntar | Um sinal compreensível para o próximo passo e um acordo sobre onde fica o brinquedo; rotina visual só se fizer sentido | Mudança súbita importante, risco, ou a barreira principal ser banho sensorial, medo, compreensão ou autonomia |
| Comunicação — `skills/comunicacao.md`, Pós A §3 e Pós B Tema 2 | “Testar outro jeito de pedir” | Qual via a criança já usa espontaneamente: palavra, gesto, imagem, objeto, olhar/ação? | Uma situação curta com apoio acessível, sem exigir fala ou contato visual | Perda de habilidade, emergência ou inferência de que “não comunica” sem observar a via existente |
| Socialização — `skills/socializacao.md`, Pós B Tema 6 | “Ensaiar entrada na brincadeira” | Quer participar e não sabe entrar, ou prefere brincar só? Depois de entrar, onde trava? | Uma fala, gesto ou mediação que caiba naquela criança; observar se conseguiu participar | Brincar só sem incômodo; grupo sobrecarregante; menu para “fazer amigos” como meta universal |
| Sono — `skills/sono.md`, diretriz transversal da Pós B | “Preparar a hora de dormir” | O problema é chegar à cama, adormecer ou manter o sono? Ronco/pausas ou mudança abrupta? | Um ajuste testável no trecho certo da noite, preservando apoio necessário | Sinal respiratório, sonolência inexplicada ou perda de funcionamento: priorizar avaliação, não menu |
| Sensorial — `skills/sensorial.md`, Pós B Tema 4 | “Ajustar uma coisa no ambiente” | Qual estímulo, quando aparece, e o que muda ao reduzi-lo? | Uma adaptação ambiental segura e uma observação, não protocolo de Integração Sensorial | Dor, suspeita auditiva ou explicação sensorial assumida sem evidência |

**Idade:** escolher gesto/objeto, frase ou autonomia compatível com o que se
sabe da criança, não por faixa rígida nem por marco usado como diagnóstico.
Idade ausente não autoriza supor. Revisar a pergunta mínima antes do primeiro
botão que dependa dela. A matriz acima é proposta editorial; só após aprovação
vira corpus e contrato de implementação.

## P4 · Jornada e canais

Relato → ajuda inicial completa → oferta contextual opcional → clique ou fala
livre → pergunta mínima se necessária → entrega executável → estado conferido
→ retorno suave depois de oportunidade real de uso. Abandono, silêncio, clique
tardio, envio aceito mas não renderizado, falha de escrita e retomada no dia
seguinte são estados distintos. WhatsApp não promete artefato Web antes de a
pessoa abrir ou gerar. Trial não recebe catálogo nem sete mensagens fixas;
descobre uma capacidade útil no contexto e preserva opt-out/cadência.

## P5 · Identidade, alvo e permissão

Oferta, escolha, dado, resposta e feedback pertencem à mesma família e à
criança correta. Quando há dois irmãos e o texto não identifica o alvo, a
Ayla pergunta antes de personalizar. IDs de botão não autorizam outra família
nem outro membro. Testes negativos cobrem link/callback adulterado, troca de
criança, assinatura expirada, opt-out e contexto de segurança aberto.

## P6 · Continuidade amanhã

A oferta não duplica o conteúdo da conversa: mantém referências e estados
`preparada → oferecida → escolhida → respondida` ou `falhou`.
Fatos novos entram na memória só com escrita conferida, fonte e escopo de
criança, e são relidos no turno seguinte. Feedback “não ajudou” muda a próxima
estratégia; “ainda não testei” não muda a avaliação. Não repetir pergunta já
respondida. Se a família voltar amanhã, a Ayla sabe qual ajuda foi tentada,
qual ficou pendente e para quem era, sem reapresentar menu automaticamente.

## P7 · Falhas, observabilidade e rollback

Gate de publicação bloqueia qualquer versão que perca uma fala no par
texto+clique, mesmo se o clique for entregue. Logs e contagens agregadas
separam: ajuda inicial aceita pelo provedor, oferta aceita, botão **renderizado
em QA interno**, escolha, resposta concluída, falha, feedback, “não testei”,
retorno no dia seguinte, latência primeira aceitação P50/P95/máximo, custo e
bolhas por turno. Clique não é contado como satisfação. Nenhum texto sensível
entra na telemetria de produto. Alertas cobrem aumento de silêncio, duplicata,
falso menu, erro de escrita e regressão de latência. Rollback global por flag
e commit conhecido; rollback não apaga estado já salvo. Não ocultar uma falha
de memória com resposta de sucesso.

## P8 · Gates de execução e prova de produção

| Gate | Condição objetiva de saída | Estado em 06/10/2026 |
|---|---|---|
| G0 · Baseline | SHA servido, Core/flags, CI e 7 dias de métricas com denominadores e limite de latência | PARCIAL: health serviu `70d322dcf5e1c11020015747166ebfaee7ba6ee2`, `main`, DB OK, flags globais de aprofundamento e experimental ligadas; Core ativo único v12, SHA-256 `d11c8134f04e8b7a02c9b55bf725deda29776d03565ba28ceee1095b5d25c7a7`; contagens abaixo. Falta reconciliar CI publicado e renderização atual. |
| G1 · Segurança do turno | Testes reais de relógio: texto+clique antes e depois do claim, clique rejeitado, fala livre, segurança, retry e dois irmãos; nenhum inbound órfão | PARCIAL: baseline 15/17, os dois novos casos falharam; candidata local 19/19 e 79/79 regressões focadas, com isolamento entre famílias, typecheck limpo. Faltam integração de segurança/dois irmãos, CI e QA interno. |
| G2 · Desenho aprovado | SPEC e falas de→para aprovadas por Karina; revisão humana pertinente para alimentação | PARCIAL: desenho geral e ordem Rotina → Comunicação/socialização aprovados; rótulos/falas por tema aguardam revisão, e alimentação aguarda decisão clínica |
| G3 · Implementação | Modelo de estados, botões contextuais, pergunta mínima, memória/feedback e trial, cada escrita verificada | NÃO INICIADO |
| G4 · Regressão | Corpus positivo/negativo, duas crianças, segurança, falhas, custo e latência; build e CI verdes | PARCIAL para G1: 4.190 testes passaram com dois workers, excluída apenas a falha conhecida PEND-214 do provedor; `base2.test.ts` passou 20/20 em execução isolada após EPERM do sandbox; typecheck e build completo passaram. Isso não é CI nem regressão da futura ampliação temática. |
| G5 · QA interno | WhatsApp da conta autorizada pela Karina, cujo cadastro familiar ela declarou inteiramente fictício; provar o que apareceu no aparelho e reconstruir o turno inteiro, incluindo portas que não dispararam; não extrapolar essa conta para famílias reais | NÃO INICIADO; número não documentado por privacidade |
| G6 · Publicação global | PR revisado e mergeado, CI verde, migração/flag aplicadas, health SHA = merge, Core/hash/flags conferidos, sem coorte | NÃO INICIADO |
| G7 · Resultado das famílias | Leitura agregada 24h/7d por tema e Trial, comparação antes/depois, segurança/latência/qualidade; auditoria de fala anonimizada autorizada, sem confundir aceite do provedor com leitura da família | NÃO INICIADO |

Se G1, G2, G4 ou G5 falhar, **não ampliar botões**. Se G6 não for comprovado,
o estado é implementado ou publicado, não “produção validada”. Se G7 ainda
não tiver janela de observação, o resultado familiar permanece **parcial**.
Não há piloto por família. A validação interna anterior ao rollout não é uma
coorte de produção.

**Baseline agregada somente leitura, 06/10, janela 29/09 15h36Z–06/10
15h36Z:** 7 ofertas, 5 escolhas, 5 respostas e 0 falhas registradas; tabela
operacional: 5 `respondida`, 2 `oferecida`, 0 `falhou`. Houve 354 rastros
`turno_externo`; 299 mensagens comuns com primeira aceitação medida (P50
13.792 ms; P95 24.624 ms; máximo 32.118 ms) e 8 interações estruturadas
(P50 9.540 ms; P95/máximo 16.792 ms). As outras 47 saídas não têm primeira
aceitação registrada (13 `nao_tratada`, 32 `tratada`, 2
`capacidade_rotina`); **não equivalem automaticamente a 47 mensagens
perdidas**. O P95 estruturado excede o limite atual de 15 s da PEND-215,
mas n=8 mistura botões/listas e não é prova de efeito desta missão. Cliques e
eventos não medem satisfação nem renderização no aparelho.

### Relatório final obrigatório

Veredito único: PASSOU, PASSOU COM RESSALVAS, FALHOU ou BLOQUEADO. Informar
SHA local, SHA servido, versão/hash do Core, CI, flag e alcance, migrações,
prova no WhatsApp interno, contagens de produção, latência, resultado para
famílias, rollback e “o que quase aconteceu”. Só baixar PEND-213/PEND-231
quando o critério respectivo estiver provado. Atualizar `/ajuda` na mesma
entrega de produto.
