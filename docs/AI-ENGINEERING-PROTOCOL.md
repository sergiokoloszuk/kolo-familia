# Protocolo de Engenharia para Agentes de IA — Kolo Família

Regras obrigatórias para qualquer agente de IA que trabalhe neste repositório.
Não substitui julgamento; substitui o hábito de começar a mexer no código
assim que se lê a descrição de um problema.

Este documento é a **fonte única**. `AGENTS.md` (raiz) aponta para cá.

---

## Princípio central

> Um agente nunca começa uma alteração relevante só porque recebeu a
> descrição de um problema.

A ordem padrão é:

**INVESTIGAR → MEDIR BASELINE → CAUSA RAIZ → PROPOR → IMPLEMENTAR → TESTAR →
VALIDAR → AUDITAR → VEREDITO.**

Quando a missão estiver marcada como INVESTIGAR, PROPOR ou AUDITAR, **não
alterar código funcional** (ver §19).

### Por que esta regra existe

Três episódios reais deste repositório, que o protocolo inteiro tenta evitar:

- **Rochelle (23/07/2026).** Pagou às 17:23. O webhook do Stripe chegou,
  autenticou, o handler rodou sem exceção — e o acesso não foi liberado. A
  Ayla mandou 15 convites para assinar, 11 deles depois do pagamento. Quem
  descobriu foi a cliente; quem diagnosticou e consertou foi uma pessoa, pelo
  painel admin, 19 horas depois. Nenhum handler do webhook confere o resultado
  do próprio `.update()`, então até hoje não se sabe *por que* a escrita não
  pegou: o sistema não guarda essa informação. Ver §7, §10, §11.
- **O dedup que não deduplicava.** A função chamava-se
  `convidouAssinarRecente` e o comentário dizia "dedup do convite". Ela só
  escolhia entre dois textos; o envio saía sempre. O nome e o comentário
  passaram meses convencendo quem lia que o problema estava resolvido.
  Ver §1, §3.
- **Cartões da rotina, 100% → 32%.** Uma correção de prompt derrubou uma
  taxa que ninguém estava medindo. Sem baseline, a regressão só apareceu
  semanas depois. Ver §2, §12.

---

## 1. Investigar antes de alterar

Antes de editar, mapear o fluxo **real** — não o fluxo que o nome das funções
sugere.

Identificar, quando couber: ponto de entrada · funções · prompts · decisões ·
APIs · banco · tabelas · leituras · escritas · integrações externas · filas ·
locks · reservas · retries · jobs · cron · componentes Web · WhatsApp · Admin ·
autenticação · autorização · armazenamento de artefatos · logs · métricas.

Procurar **sempre** também:

- código antigo e código morto;
- implementações duplicadas;
- regras conflitantes;
- fallbacks silenciosos;
- funções equivalentes que já existem;
- mecanismos reaproveitáveis.

**Não adicionar infraestrutura antes dessa investigação.**

> ⚠️ Nome e comentário não são evidência. Ler o corpo da função e o caminho de
> chamada. Um comentário pode estar descrevendo a intenção de quem escreveu, e
> não o que o código faz.

---

## 2. Estabelecer baseline

Antes da correção, registrar **objetivamente** o comportamento atual.

Medir: casos afetados · casos corretos · frequência · timestamps · estado
anterior · estado posterior · erros · repetições · rajadas · esperado versus
observado.

Com dados reais de produção, preferir sempre **leitura, replay, dry-run ou
simulação**, sem efeito colateral.

O baseline precisa permitir comparação **ANTES → DEPOIS**. Congele-o por
escrito antes de tocar no código — depois da alteração ele não existe mais.

---

## 3. Identificar causa raiz

Não corrigir o sintoma. Responder:

1. O que está errado?
2. Onde ocorre?
3. Por que ocorre?
4. Em quais condições?
5. **Por que as proteções existentes não impediram?**
6. Que outros casos sofrem do mesmo problema?

Investigar explicitamente, quando pertinente: concorrência · idempotência ·
eventos repetidos · eventos fora de ordem · retries · timeouts · estados
intermediários · estados órfãos · inconsistência entre sistemas · falha após
reserva · falha após escrita · **escrita não conferida** · erro engolido ·
**2xx apesar de falha** · fallback silencioso.

A pergunta 5 é a que mais rende. Quase sempre existe uma proteção que deveria
ter pegado o caso e não pegou — e entender por que ela não pegou vale mais do
que a correção do sintoma.

---

## 4. Reutilizar antes de criar

Antes de criar mecanismo novo, procurar se a Kolo já tem helper · função ·
tabela · lock · reserva · reconciliador · retry · componente · serviço ·
abstração · padrão que resolva total ou parcialmente o problema.

Preferir extensão ou reutilização segura a infraestrutura paralela. Evitar
duplicar regra de negócio.

Reutilizar **não** significa chamar a função existente de qualquer jeito: se
ela carrega semântica que não serve (checa outra coisa, compete por outro
recurso, aplica isenções que não valem aqui), reusar o **padrão** e dizer por
escrito por que a função em si não serviu.

Ordem de preferência, sempre: **remover → simplificar → consolidar →
restaurar → religar → corrigir → só então acrescentar.**

---

## 5. Propor antes de implementar

Depois de investigar, explicar: causa raiz · solução recomendada · arquivos
que mudam · o que será reutilizado · o que será removido · impacto · riscos ·
alternativas descartadas · rollback · testes necessários.

Se a missão exige aprovação, **PARAR aqui**.

> Investigação não é autorização. Ter descoberto a causa não autoriza corrigir.

---

## 6. Implementação mínima e isolada

Quando autorizado:

- alterar somente o necessário;
- nada de refatoração cosmética não relacionada;
- não misturar frentes;
- não adicionar dependência sem necessidade;
- preservar comportamento correto existente;
- manter compatibilidade quando necessária;
- preferir alterações reversíveis.

### Higiene de commit (obrigatória)

Antes de commitar, revisar **integralmente**:

```
git status
git diff
```

- **Não usar `git add -A` cegamente.** Adicionar por caminho.
- Confirmar que nenhum arquivo de outra frente entrou.
- Arquivos não relacionados no working tree **ficam intocados** — não são
  seus para commitar, nem para apagar.

> Caso real: um `git add -A` levou junto dois módulos de outra frente que não
> eram importados por nada. Só apareceu na revisão do `--stat`.

### Perigos específicos deste repositório

- **`git worktree remove` no Windows segue junctions.** Uma remoção entrou em
  `node_modules` por um junction e apagou arquivos rastreados de
  `packages/shared`. Conferir o que a remoção alcança antes de rodar.
- **`core.autocrlf`.** Vários testes leem o próprio código-fonte e casam com
  `\n`. Com `autocrlf=true` a troca de branch reescreve dezenas de arquivos e
  quebra os testes localmente enquanto o CI (Linux) segue verde. Manter
  `core.autocrlf=false`.
- **Conteúdo publicado ≠ commit ancestral.** `git checkout <sha> -- arquivos`
  publica conteúdo sem trazer o commit. Conferir por **diff**, nunca por
  ancestralidade.

---

## 7. Persistência crítica tem que ser conferida

Toda escrita crítica verifica explicitamente o próprio resultado.

Não é aceitável que `.update()`, `.insert()`, `.upsert()`, uma chamada externa
ou qualquer alteração de estado possa falhar e o fluxo seguir como sucesso.

Havendo falha: capturar · registrar · propagar ou tratar · **nunca produzir
falso sucesso**.

### Pergunta obrigatória

> **"Este fluxo pode falhar e mesmo assim parecer concluído?"**

Se sim, corrigir ou tornar a falha observável.

> No cliente Supabase, `.update()` **devolve** o erro; não lança. Um `await`
> sem checar `error` engole a falha inteira. Foi assim que o acesso da
> Rochelle sumiu: seis handlers do webhook do Stripe, nenhum conferindo a
> escrita, todos devolvendo 2xx — o que faz o Stripe nunca reenviar.

---

## 8. Concorrência e idempotência

Para fluxo crítico, responder sempre:

- E se executar duas vezes?
- E se duas requisições rodarem ao mesmo tempo?
- E se os eventos chegarem fora de ordem?
- E se houver retry?
- E se houver timeout?
- E se a reserva acontecer e a ação seguinte falhar?
- E se o sistema externo repetir o evento?

Operação repetida não pode corromper, duplicar nem se comportar mal.

> Ambiente serverless: cada invocação é um processo novo. Cache em memória,
> `Map`, `Set` ou variável de módulo **não** enxergam a concorrência. Estado
> de coordenação vive no banco.
>
> Numa rajada, *ler antes de escrever* não basta — as leituras acontecem todas
> antes da primeira escrita. O padrão que funciona é **reservar primeiro,
> depois resolver quem chegou antes**, e quem perde apaga a própria reserva.
> Referência: `reservarEnvioProativo` em `lib/ayla/cadencia.ts` e
> `reservarConviteAssinatura` em `lib/ayla/orchestrator.ts`.
>
> Cuidado com a janela da reserva: se ela for tão longa quanto o cooldown, uma
> reserva órfã (a ação seguinte falhou) silencia o fluxo por todo o período,
> por uma ação que nunca aconteceu. Reserva cobre a rajada; o cooldown se
> apoia no registro do que **de fato** aconteceu.

---

## 9. Estados intermediários

Não testar só estado inicial e final. Identificar todos os estados relevantes
do domínio e testar as **transições**, inclusive as inesperadas e as
parcialmente persistidas.

Em pagamento, por exemplo: `trialing` · `active` · `incomplete` · `past_due` ·
`paused` · `canceled` · trial vencido que continua `trialing` · **pagamento
confirmado no externo com acesso interno ainda não confirmado**.

> `incomplete` do Stripe é transitório e chega em **todo** checkout. O mapa
> interno o traduz para `past_due`. Ou seja: todo pagamento passa, por alguns
> segundos, por um estado que significa inadimplência. Quem só testa "pagou →
> ativo" não vê isso.

Para as outras funcionalidades, identificar os estados equivalentes (rotina
sem tema · artefato gerado sem entrega · plano sem seção prática · membro
ambíguo · família com mais de uma criança · magic link sem criança).

---

## 10. Reconciliação

Para fluxo crítico que depende de sistema externo, responder:

> **"Se o evento principal falhar, existe algum processo posterior que detecta
> a divergência entre o sistema externo e a Kolo?"**

Avaliar: reconciliação · retry · job · cron · alerta · recuperação manual
documentada.

Não assumir que um webhook único basta. Ele pode não chegar, chegar fora de
ordem, chegar duplicado, ou ser processado com sucesso aparente e efeito nulo.

> O reconciliador que existe (`runAlertaAssinatura`, em
> `api/ayla/cron/route.ts`) varre apenas `status = 'past_due'`. Ele **reage a
> um estado errado específico**; nunca pergunta "existe pagamento no externo
> sem acesso na Kolo?". Reconciliador que só enxerga um estado não é
> reconciliação — é um remendo com escopo.

---

## 11. Observabilidade

Para fluxo importante, tem que ser possível reconstruir o que aconteceu.

Registrar, com segurança e quando aplicável: família · criança (quando
pertinente) · evento · timestamp · estado anterior · estado pretendido ·
decisão · operação tentada · **resultado** · erro · provider · modelo ·
tentativa/retry.

**Nunca registrar segredo nem dado sensível desnecessário.**

### Pergunta obrigatória

> **"Se isso falhar amanhã em produção, a gente descobre sem depender primeiro
> da reclamação de uma família?"**

Se não, apontar a lacuna explicitamente — mesmo que a correção fique para
depois.

> Neste repositório, `logEvent` só **persiste** severidade de erro; `info` vai
> para stdout e some com a retenção da Vercel. Um fluxo cujo único rastro é um
> log `info` é, na prática, não observável depois de alguns dias.

---

## 12. Testes de regressão

Uma correção não prova só que o novo comportamento funciona. Prova que o
comportamento correto antigo **continua** funcionando.

Cobrir, quando pertinente:

| | Caso |
|---|---|
| A | caso normal |
| B | o caso que originou o bug |
| C | repetição |
| D | concorrência |
| E | eventos fora de ordem |
| F | falha de persistência |
| G | retry |
| H | estado intermediário |
| I | **caso legítimo que não pode ser bloqueado** |
| J | regressões conhecidas |

O caso **I** é o mais esquecido: quase toda correção que suprime algo suprime
demais. Medir o falso positivo, não só o verdadeiro positivo.

Executar, quando aplicável: teste específico · suíte relacionada · **suíte
completa** · `npx tsc --noEmit` · `npm run build` · lint do projeto.

**Relatar números reais. Nunca afirmar que testes passaram sem executá-los.**

> Teste que lê o próprio código-fonte (`readFileSync` + regex) prende uma
> decisão estrutural e é legítimo — mas ele testa o texto, não o
> comportamento. Onde der para exercitar a função de verdade (inclusive com um
> cliente de banco falso, em memória), exercitar.

---

## 13. Validação com dados reais

Quando for possível e seguro, confrontar a regra nova com dados históricos
reais, por **leitura, replay ou dry-run**.

Comparar **ANTES → DEPOIS** e medir: correções · falsos positivos · falsos
negativos · bloqueios indevidos · efeitos colaterais.

### Regras invioláveis de QA

- **Não disparar WhatsApp, cobrança, e-mail ou alteração de conta** durante
  validação de leitura.
- **Não usar conta ou conversa de família real** para teste que possa
  contaminar o contexto. Só contas autorizadas de QA.
- **Marcar não é isolar.** Dado de teste marcado com prefixo continua
  aparecendo para a família na tela e nas escolhas da Ayla. **Apagar ao
  final** faz parte do teste.
- **Não expor segredo** em log, teste ou documentação.

---

## 14. Experiência é parte da correção

A Kolo não considera uma funcionalidade correta só porque o backend funciona.

Avaliar, quando pertinente: experiência da mãe/responsável · experiência da
criança · clareza da Ayla · quantidade de perguntas · contexto já conhecido ·
continuidade da conversa · Web · WhatsApp · Admin · armazenamento ·
recuperação · edição · impressão/artefatos · comportamento depois do erro.

### Pergunta obrigatória

> **"Mesmo tecnicamente correto, isso produz a experiência que a Kolo quer?"**

Régua de qualidade: *a sofisticação de hoje com a confiabilidade de junho.*
Uma resposta sofisticada que chega errada é pior que uma resposta simples que
chega certa.

---

## 15. Ayla: contexto e conhecimento

Em alteração que envolva a Ayla, investigar **separadamente**:

1. informação disponível;
2. informação recuperada;
3. informação injetada;
4. informação efetivamente entregue ao modelo;
5. informação usada na resposta;
6. regras determinísticas;
7. prompts;
8. ferramentas;
9. memória;
10. histórico;
11. conhecimento genérico do modelo.

São camadas diferentes e falham por motivos diferentes. Um dado pode existir
no banco, não ser recuperado, ser recuperado e não ser injetado, ser injetado
e ser ignorado.

**Não assumir que acrescentar prompt resolve problema de recuperação ou de
orquestração.** Antes de acrescentar conteúdo, auditar o que já existe.

> Regra que falha em prompt se corrige **estruturalmente**. Uma proibição
> genérica no prompt compete com a instrução de ser prestativo, e perde. O que
> não perde é o orquestrador só oferecer ao modelo o que existe.
>
> Corolário: **um dono para cada decisão.** Se uma decisão é estado do
> artefato ("há tema pendente?", "existe rotina recente?"), o dono é o código,
> não o modelo. Duas fontes para a mesma decisão sempre divergem.

---

## 16. Segurança e privacidade

Toda mudança relevante avalia: autenticação · autorização · isolamento entre
famílias · **isolamento entre irmãos** · acesso cruzado · endpoints ·
secrets/env · logs · dados pessoais · arquivos · URLs · artefatos
compartilhados.

**Nenhuma família pode acessar dado ou artefato de outra.** A regra de escopo
por membro vive em `lib/ayla/membro-escopo.ts`.

Endpoint que consome API paga é **fail-closed**: sem o segredo configurado,
recusa; não passa a valer para todo mundo.

> ⚠️ Antes de criar variável de ambiente nova, conferir quem já a lê. Criar
> `AYLA_WEBHOOK_SECRET` emudece o WhatsApp inteiro — três consumidores passam
> a exigir assinatura que ninguém está mandando.

---

## 17. Rollback

Antes de publicar mudança crítica, saber: como desativar · como reverter · se
há migração irreversível · se precisa de feature flag · se existe provider ou
modelo de rollback · quais dados podem precisar de reparo.

> Migração é o ponto sem volta. Conferir a numeração contra **todos** os
> branches vivos antes de criar uma — números já foram reivindicados em
> paralelo neste repositório. Migração aplicada em produção não volta com
> `git revert`.

---

## 18. Deploy não é sinônimo de PASSOU

Distinguir explicitamente:

| Estado | Significa |
|---|---|
| implementado | o código existe no working tree |
| commitado | está no histórico do git |
| publicado | está no branch que a Vercel serve |
| configuração aplicada | env/cron/segredo existem no ambiente |
| smoke realizado | alguém exercitou o caminho real |
| produção validada | há evidência de que funcionou com dado real |

**Nunca declarar produção validada quando só build e testes locais passaram.**

Se depender de Vercel, Supabase, Stripe, Meta, OpenAI ou outro ambiente
inacessível ao agente, marcar **BLOQUEADO** ou **NÃO VALIDADO** e dizer o que
falta.

> `tsc` não pega SDK vazando para o bundle do cliente. Rodar `npm run build`
> antes de dizer que está no ar — este repositório já teve deploy falhando em
> silêncio com typecheck verde.

---

## 19. Tipos de missão

Se o prompt especificar um modo, respeitá-lo **rigorosamente**.

| Modo | Permitido | Proibido |
|---|---|---|
| **INVESTIGAR** | leitura, consulta a produção sem efeito colateral, diagnóstico | alterar código funcional |
| **PROPOR** | desenhar a solução a partir dos achados | implementar |
| **EXECUTAR** | implementar o que foi autorizado, testar, validar | ampliar o escopo autorizado |
| **AUDITAR** | revisar de forma independente trabalho já feito | presumir que a implementação está correta |

Sem modo declarado, o padrão é o do princípio central: investigar antes de
alterar, e propor antes de implementar quando a mudança for relevante.

Em AUDITAR, o relato de quem implementou não é evidência — nem se foi o
próprio agente numa sessão anterior. Todo achado carrega **data, estado e
commit**; conferir o código atual antes de repetir achado de laudo antigo.

---

## 20. Relatório padrão

Ao terminar missão técnica relevante, informar:

1. PROBLEMA
2. BASELINE
3. CAUSA RAIZ
4. EVIDÊNCIAS
5. SOLUÇÃO
6. O QUE FOI REUTILIZADO
7. O QUE FOI REMOVIDO
8. ARQUIVOS ALTERADOS
9. TESTES
10. REGRESSÃO
11. VALIDAÇÃO REAL
12. PERSISTÊNCIA
13. CONCORRÊNCIA/IDEMPOTÊNCIA
14. OBSERVABILIDADE
15. SEGURANÇA
16. ROLLBACK
17. RISCOS/PENDÊNCIAS RESTANTES
18. COMMIT/BRANCH
19. DEPLOY
20. VEREDITO

Veredito, somente: **PASSOU** · **PASSOU COM RESSALVAS** · **FALHOU** ·
**BLOQUEADO**.

**Nunca substituir evidência por "parece funcionar".** Item que não se aplica
recebe "não se aplica" e o motivo — não some do relatório.

---

## 21. Portões de fechamento

Frente crítica só fecha depois de avaliar os quinze:

1. BASELINE
2. CAUSA RAIZ
3. IMPLEMENTAÇÃO
4. TESTES
5. REGRESSÃO
6. VALIDAÇÃO REAL
7. PERSISTÊNCIA
8. CONCORRÊNCIA/IDEMPOTÊNCIA
9. RECONCILIAÇÃO
10. OBSERVABILIDADE
11. SEGURANÇA
12. UX / REGRA DE NEGÓCIO
13. ROLLBACK
14. DEPLOY/SMOKE
15. VEREDITO

Portão que não puder ser comprovado é registrado como **NÃO VALIDADO** ou
**BLOQUEADO**, com o motivo. Portão não comprovado **não** vira portão
aprovado por omissão.

**Teste verde não é produto bom.** Os portões medem se a correção é
verdadeira; a régua de §14 mede se ela vale a pena.
