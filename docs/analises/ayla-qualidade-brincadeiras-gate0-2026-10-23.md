# Gate 0 — qualidade da Ayla e brincadeiras

Data: 23/10/2026 (America/Sao_Paulo)
Base: `origin/main` em `25e8891daf1e0d5bd881512e6f128742fdcd0184`
Produção confirmada no health público: o mesmo SHA, `ref=main`, ambiente `production`
Nível: **CRÍTICA** — IA fala com famílias, usa dados comportamentais de criança e precisa preservar o alvo entre irmãos.

## Isolamento e estado encontrado

Esta missão usa o worktree limpo `ayla-qualidade-brincadeiras`, criado de
`origin/main`. O checkout principal, que contém mudanças de Black Friday e
outras frentes, foi consultado somente para inventariar trabalho anterior.
Nenhum arquivo dele será alterado ou levado em bloco para esta branch.

PRs abertos relacionados: #142 (primeiro contato), #144 (turno de clique),
#145 (instrumentação G0), #146 (baseline de CI) e #147 (privacidade dos logs,
baseada na #145). Nenhum deles será incorporado nesta missão: #144 toca a
continuidade dos botões; #145/#147 alteram observabilidade sensível e precisam
de revisão própria; #142 altera primeiro contato. A branch atual não toca os
arquivos de Black Friday, preço, checkout, Stripe, trial ou cadastro.

Também existem mudanças não commitadas no checkout principal para PEND-209,
PEND-225 e PEND-243. O arquivo `experimental.ts` está misturado entre essas
frentes, portanto não pode ser copiado. Só conceitos pequenos, reavaliados
contra `origin/main`, poderão ser reimplementados aqui.

## Gate 0 — mapa das frentes

| Frente | Problema para a família e comportamento atual | Código/teste/produção | Risco · esforço · conflito BF | Recomendação |
|---|---|---|---|---|
| PEND-104 | Material especializado contém partes úteis, mas também contato visual forçado, afirmações frágeis e inferências clínicas. | Original preservado; não ativo. | alto · alto · nenhum direto | Não importar. Revisão humana em frente própria. |
| PEND-126 | A jornada de trial não alcança a maioria das famílias. | Medida, não corrigida. | alto · alto · **fora do escopo comercial** | Não tocar. |
| PEND-152 | Famílias engajadas não recebem convite. | Medida, causa ainda não isolada. | alto · médio · **fora do escopo comercial** | Não tocar. |
| **PEND-208** | Pedido de brincadeira recebe ideia comum, incompleta ou até reutiliza estímulo que incomoda a criança. | Regras e testes existem no SHA servido; prova de valor e bloqueio estrutural ainda faltam. | alto · médio · arquivos Ayla isoláveis | **Frente escolhida 2.** |
| **PEND-209** | Com pouco contexto, a Ayla pode inventar sensibilidade, causa ou alvo e soar alarmista. | Mudança local misturada, não publicada; origem tem partes do contexto e foco. | crítico · médio · arquivos Ayla isoláveis | **Frente escolhida 1.** |
| PEND-213/226 | Botões estão ligados, mas texto concorrente, repetição e entrega no aparelho não têm prova conclusiva. | Produção parcial; PR #144 aberto. | crítico · alto · exige QA de canal | Não ampliar nem alterar flag. Registrar como dependência de continuidade. |
| PEND-225 | Conteúdo temático das skills foi implementado em piloto local, ainda sem arena e sem publicação. | Flag própria desligada; build/testes locais antigos. | alto · alto · conflita em `experimental.ts` | Não integrar como terceira frente. |
| PEND-229 | Core v12 e concisão estão em produção; falta prova natural e latência ponta a ponta. | Publicada, suíte antiga verde. | médio · baixo para observar | Usar como contrato existente; não reabrir o Core. |
| PEND-231 | Jornada adaptativa de descoberta, pergunta mínima e feedback ainda é desenho. | SPEC/proposta em branch; implementação proibida antes da aprovação. | crítico · alto | Não implementar nesta missão. |
| PEND-232 | Cartas de conversa são proposta, não produto aprovado. | Sem implementação. | crítico · alto | Preparar conteúdo só depois de aprovação. |
| PEND-234 | PDF pode ser ignorado antes de persistir. O incidente ainda não foi localizado. | Parser suspeito; sem caso reproduzido. | crítico · médio | Investigar em missão própria; não misturar mídia com qualidade textual. |
| PEND-243 | Fábrica/biblioteca tem protótipo e contrato local, mas catálogo persistido/publicado depende de backup e revisão editorial. | Não está na `origin/main`; PEND-092 bloqueia banco. | crítico · alto · terceira frente | Não integrar; aproveitar apenas os critérios editoriais na bancada. |

## Gate 1 — baseline congelado antes do código

Fonte oficial mais recente consultada: auditoria somente leitura de 22/10/2026,
janela de 30 dias. Foram 896 entradas e 1.339 saídas. O detector conservador
encontrou quatro pedidos explícitos de brincadeira/atividade, todos anteriores
ao SHA hoje servido. Nas quatro respostas pareadas:

- 0/4 trouxeram de forma completa uma fala inicial utilizável pelo adulto;
- 1/4 mostrou claramente como a criança poderia participar;
- 2/4 mostraram a virada ou continuidade do jogo;
- 1/4 ligou a ação a uma capacidade sem transformar a resposta em aula;
- 1/4 transformou sensibilidade a som em ensaio com som — falha grave;
- o recorte amplo encontrou 66 propostas executáveis, mas só 12 explicitaram a
  participação da criança e nenhuma usou de modo consistente a abertura esperada.

O baseline histórico da PEND-208 continua relevante: o melhor braço da arena
antiga obteve 24% de alto valor, e pedido explícito de brincadeira obteve 0%.
Portanto o mínimo de conclusão (>50% de alto valor, zero falha grave, zero troca
entre irmãos e interesse mudando a mecânica) ainda não foi demonstrado.

Para PEND-209, o caso sentinela é “minha filha está agressiva e triste”: a Ayla
atribuiu sensibilidade a sons/toque sem evidência. A implementação local antiga
passou em testes dirigidos, mas não foi isolada, publicada ou validada com o
Core servido. O risco principal é o modelo transformar conhecimento geral em
fato individual; a proteção existente não impediu porque o perfil recuperado,
a lacuna sugerida e a disciplina de evidência não chegam ao produtor como um
contrato único.

## Causa raiz

1. **PEND-209:** contexto disponível não é o mesmo que evidência utilizável. O
   modelo recebe perfil, história e repertório, mas não uma fronteira curta que
   separe fato registrado, episódio atual e hipótese. Em pouco contexto, a
   instrução genérica de ser útil compete com a cautela e pode vencer.
2. **PEND-208:** a resposta é auditada somente depois de pronta e o resultado é
   apenas telemetria. Uma brincadeira incompleta ou que reproduz estímulo
   sensível continua saindo. O prompt já contém a regra correta; repetir a regra
   sem mudar a decisão de entrega não fecha o defeito.

## Proposta aprovada pela própria missão

Implementação mínima, reversível e atrás de `AYLA_QUALIDADE_RESPOSTA_V2`,
ausente/desligada por padrão:

1. acrescentar um contrato curto de evidência ao contexto somente com a flag;
2. extrair apenas categorias de sensibilidade já registradas para a criança em
   foco, sem logar texto do perfil;
3. transformar a auditoria de brincadeira em portão local: uma regeneração com
   os códigos objetivos; se a segunda resposta ainda reproduzir sensibilidade
   registrada, usar um piso seguro e transparente em vez de enviar a falha;
4. persistir somente códigos e estado do portão, nunca fala ou perfil;
5. criar corpus cego de pelo menos 20 casos, com alvo, idade, comunicação,
   sensibilidade, repetição, “não funcionou”, pouco contexto e risco.

Não haverá tabela, migração, chamada paga extra no caminho saudável, nova UI,
catálogo, PDF, imagem, link, WhatsApp de QA nem alteração de produção. Rollback:
remover/desligar a flag restaura byte a byte o comportamento servido.

## Portões P1–P8

| Portão | Estado antes da implementação | Evidência/limite |
|---|---|---|
| P1 problema e dono | PASS | Responsável recebe ajuda; criança participa sem coerção; Admin só observa códigos. A frase que deve sumir é “ela inventou uma característica e a brincadeira nem dá para fazer”. |
| P2 descoberta | PASS | Não há feature a descobrir: o contrato acompanha qualquer turno elegível; brincadeira é reconhecida por pedido em linguagem natural, com negativos no corpus. |
| P3 conversa mínima e dados | PASS | Usa perfil/histórico já lidos; no máximo uma pergunta que muda a conduta; desconhecido não vira negativo. |
| P4 jornada e canais | BLOQUEADO para produção | Implementação cobre o produtor compartilhado; prova em aparelho/WhatsApp é proibida nesta missão. Preview valida apenas código desligado. |
| P5 identidade, alvo e permissão | PASS local esperado | Categoria sensorial só existe com foco único; dois irmãos e alvo ambíguo entram no corpus. Nenhum dado novo é persistido. |
| P6 continuidade | NÃO SE APLICA à persistência | Não cria artefato nem memória. Histórico já existente continua sendo a fonte; “não funcionou” precisa mudar a mecânica no corpus. |
| P7 falha e observabilidade | PASS local esperado | Eventos guardam modo, quantidade e códigos, sem texto. Falha após regeneração usa piso seguro; flag é rollback. |
| P8 prova e entrega | BLOQUEADO | Exige corpus, suíte, typecheck, build, CI, preview e aprovação humana. Produção e QA real não estão autorizados. `/ajuda` não muda enquanto a flag está desligada. |

## Decisão

Avançar somente PEND-209 e PEND-208. PEND-243 fica como dependência futura de
repertório aprovado; PEND-213/226 como dependência de prova do canal. O relatório
final não poderá chamar a frente de pronta nem validada em produção.

## Gate 2 — implementação isolada

Flag: `AYLA_QUALIDADE_RESPOSTA_V2`, ausente/off por padrão.

- `qualidade-resposta.ts` acrescenta o contrato curto que separa fato
  registrado, relato atual e hipótese; limita perguntas e manda mudar o
  mecanismo depois de uma tentativa que não funcionou;
- o pedido explícito recebe uma única brincadeira executável, com interesse
  alterando a ação central, comunicação acessível e recusa respeitada;
- somente categorias aversivas registradas da criança em foco entram no portão;
- o portão bloqueia reprodução de som, inclusive onomatopeia, toque, textura,
  cheiro ou luz; faz no máximo uma correção e usa piso seguro se ela falhar;
- falhas apenas estruturais continuam como telemetria: a arena demonstrou que
  obrigar rótulos em toda prosa podia degradar uma brincadeira boa;
- logs persistem somente quantidade e códigos, nunca fala ou Perfil.

Não houve tabela, migração, UI, catálogo, PDF, imagem, disparo de WhatsApp ou
escrita externa.

## Gate 3 — bancada cega final

Artefato: `docs/auditorias/ayla-qualidade-cego-2026-10-23.json`.

Ambiente: 20 famílias sintéticas, produtor real, juiz real sem identificação
dos braços, Supabase limitado a GET, sem WhatsApp e sem persistência externa.
Treze casos eram pedidos explícitos de brincadeira. Os fixtures passaram a usar
o campo canônico `como_e.interesses`; o juiz recebeu definições fechadas para
alvo errado e dado inventado, sem converter personalização ausente em falha
grave.

| Medida | A — publicado | B — candidata |
|---|---:|---:|
| Alta qualidade | 19/20 (95%) | **20/20 (100%)** |
| Falha grave | 1 | **0** |
| Vitórias cegas | 4 | **7** |
| Empates | \- | 9 |
| Respostas com alerta estrutural determinístico | 5 | **4** |

O caso sentinela de sensibilidade sonora demonstrou a diferença material: o
braço A transformou som em parte do jogo; o braço B terminou sem falha grave.
Em uma rodada intermediária, o B tentou `quack!`; o detector interceptou a
onomatopeia, a correção ocorreu antes do envio e o caso focal seguinte passou.

## Gate 4 — engenharia

- testes focados: **24/24**;
- testes focados + rede de segurança: **51/51**;
- suíte completa: **4.218 passaram**, 7 pulados, 3 falharam;
- as três falhas são de baseline e fora do diff: expectativa antiga de marca
  temporal em `experimental-onboarding`, teto antigo de memória em
  `memoria-pertinente` e teste de provedor dependente de rede;
- `next typegen`: passou;
- `tsc --noEmit`: passou;
- ESLint dos cinco arquivos TypeScript tocados: passou;
- `next build --webpack`: passou, incluindo TypeScript, 106 páginas estáticas
  e coleta de traces. Duas tentativas anteriores foram ambientais: DNS do
  Google Fonts e ausência de `.env.local` no worktree; a execução final
  carregou as variáveis apenas em memória e concluiu.

## Veredito antes de PR/preview

**PASSOU COM RESSALVAS.** A candidata superou a régua sintética, zerou falhas
graves na rodada final e passou os portões de compilação. Ainda não está em
produção e não foi validada em aparelho ou WhatsApp. Faltam revisão do diff,
PR, CI/preview e aprovação humana. A flag permanece desligada por padrão.
