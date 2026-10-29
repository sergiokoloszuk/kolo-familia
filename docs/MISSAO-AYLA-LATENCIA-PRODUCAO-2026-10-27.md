# Missão — publicar a redução de latência da Ayla

**Modo:** EXECUTAR, com gates de aprovação humana para merge e produção

**Frente:** PEND-038

**Origem:** branch `codex/ayla-latencia`, commit `1d2f8bb418c419212001338a6c39ae0db907ce34`

**Objetivo:** publicar a paralelização das leituras pré-decisão sem interferir
nas outras frentes e provar, em produção, redução de latência sem regressão de
segurança, continuidade ou fragmentação.

## Regra de avanço

Cada gate recebe um único estado: **PASS · FAIL · BLOQUEADO · NÃO SE APLICA**.
Não avançar com gate em FAIL ou BLOQUEADO. Toda marcação precisa ter evidência
ao lado: comando/CI, commit, URL do deploy ou consulta com data e amostra.

## Estado de entrada

- [x] 0.1 Diagnóstico e baseline documentados.
- [x] 0.2 Correção implementada em worktree isolado.
- [x] 0.3 Commit local criado: `1d2f8bb`.
- [x] 0.4 Testes diretamente afetados: 120/120.
- [x] 0.5 Typecheck local passou após `next typegen`.
- [x] 0.6 Suíte completa verde no runner Linux da GitHub Actions, no PR #151.
- [x] 0.7 Build de produção verde no mesmo runner Linux.
- [ ] 0.8 Branch publicada e PR #151 aberto; merge e deploy ainda não
  realizados.

**Estado atual da missão (29/10/2026):** Gates 1 e 2 passaram. O PR #151 está
aberto e pronto para revisão, com CI Linux verde. A primeira auditoria
independente encontrou uma escrita indireta de observabilidade dentro da onda
paralela; a correção mínima está local e passou 154/154 testes relacionados e
`tsc --noEmit`. Gate 3 aguarda nova auditoria sobre o commit corrigido; Gate 4
aguarda essa revisão, a nova CI e autorização humana específica para
merge/deploy. Produção permanece bloqueada até os Gates 3–4 passarem.

---

## Gate 1 — Janela de integração sem colisão

**Dono:** agente executor + responsável pelas outras frentes

**Objetivo:** levar somente esta mudança para uma base atual, sem sobrescrever
trabalho paralelo.

1. [x] Listar quais frentes ainda alteram `orchestrator.ts`, testes da Ayla ou
   `docs/PENDENCIAS.md`.
2. [x] Definir a ordem de integração dessas frentes.
3. [x] Atualizar `origin/main` com `git fetch`.
4. [x] Criar/reusar um worktree limpo a partir da `origin/main` atualizada.
5. [x] Aplicar `1d2f8bb` nessa base por cherry-pick ou rebase.
6. [x] Se houver conflito em `orchestrator.ts` ou `PENDENCIAS.md`, parar e
   reconciliar por comportamento; nunca escolher “ours/theirs” às cegas.
7. [x] Confirmar que o diff final contém somente os arquivos necessários desta
   frente e eventuais ajustes explícitos de integração.
8. [x] Confirmar `core.autocrlf=false` e `git diff --check` limpo, tratando o
   CRLF histórico de `PENDENCIAS.md` como `cr-at-eol` quando necessário.

**PASS quando:** base atualizada, conflitos auditados e nenhuma mudança de
outra frente foi perdida.

**FAIL quando:** algum arquivo paralelo foi sobrescrito ou o comportamento de
um portão mudou sem decisão explícita.

**Estado: PASS (28/10/2026).** `origin/main=25e8891`; worktree
`codex/ayla-latencia` isolado e limpo. `git merge-tree --write-tree` simulou a
integração com `origin/codex/black-friday-2026-core` e
`origin/codex/ayla-qualidade-brincadeiras`, ambas sem conflito. Os hunks de
`orchestrator.ts` são distintos; `PENDENCIAS.md` auto-mergeia. Configuração
`core.autocrlf=false`; CRLF histórico conferido como `cr-at-eol`.

---

## Gate 2 — CI limpa e reproduzível

**Dono:** agente executor

**Objetivo:** cumprir exatamente a CI do repositório antes de abrir caminho ao
deploy.

1. [x] Rodar `npm ci` em ambiente limpo.
2. [x] Rodar `node --test scripts/pendencias-index.test.mjs`.
3. [x] Rodar `node scripts/pendencias-index.mjs --check`.
4. [x] Rodar `npx next typegen` em `apps/web`.
5. [x] Rodar `npx tsc --noEmit` em `apps/web`.
6. [x] Rodar a suíte completa com `npm test` em `apps/web`.
7. [x] Resolver os dois testes sensíveis à data em commit separado, ou provar
   que a `main` mais nova já os resolveu. Se a solução exigir mudar o produto,
   abrir frente própria; não esconder mudança funcional como ajuste de teste.
8. [x] Rodar `npx next build --webpack` em ambiente capaz de acessar as fontes.
9. [x] Não desabilitar TLS nem aceitar build parcial para atravessar o gate.

**PASS quando:** todos os passos da CI terminam com código 0 em base limpa.

**BLOQUEADO quando:** fontes externas, dependências ou runner impedem o build;
o log do bloqueio deve ser anexado e a publicação não avança.

**Estado: PASS (28/10/2026).** No PR #151, a GitHub Actions executou o workflow
`CI` em runner Linux limpo: índice/IDs, `npm ci`, `next typegen`,
`tsc --noEmit`, suíte completa e `next build --webpack` terminaram com código
0. Run `40760820029`, job `123071947109`, commit `50e9219`, duração 6m12s.
Isso resolveu a incerteza ambiental do Windows sem desabilitar TLS nem aceitar
build parcial. O preview da Vercel também passou.

---

## Gate 3 — Auditoria independente da mudança

**Dono:** revisor que não presume o relato da implementação

**Objetivo:** provar que a otimização não mudou decisões nem abriu concorrência
perigosa.

1. [x] Comparar o diff contra a `main` que será publicada.
2. [ ] Confirmar que todos os itens adicionados aos `Promise.all` são somente
   leitura.
3. [ ] Confirmar que não há `insert`, `upsert`, `update`, `delete`, envio de
   WhatsApp ou chamada de modelo dentro das ondas novas.
4. [x] Confirmar que a segurança continua abaixo do gate de acesso e antes dos
   handlers de entregáveis.
5. [x] Confirmar isolamento por `family.id` e que a promessa de histórico é
   local ao turno.
6. [x] Confirmar que janela de 10 s, prompts, modelos, fallbacks e textos não
   mudaram.
7. [x] Confirmar que não há migração, variável de ambiente, cron ou segredo
   novo.
8. [x] Revisar a seção de rollback desta missão.

**PASS quando:** revisão sem achado P0/P1 e todos os invariantes acima têm
evidência em código/teste.

**FAIL quando:** houver escrita concorrente, risco entre famílias/irmãos ou
mudança de comportamento não coberta por teste.

**Auditoria independente: FALHOU (29/10/2026, HEAD `987193c`).** A leitura
`carregarCatalogoSkills` participava da onda, mas seu caminho de falha chamava
`void logEvent`, que inicia um `insert` em `eventos_app` antes de as demais
leituras necessariamente terminarem. Não houve risco de mistura entre famílias
nem mutação de domínio, mas a escrita indireta contradizia os itens 2–3 e o
critério explícito deste gate.

**Correção local (29/10/2026):** a leitura agora apenas devolve
`indisponivel`; depois de o `Promise.all` terminar, o orquestrador dispara
explicitamente o alarme best-effort. O teste de falha prova que nenhum evento é
iniciado durante a leitura e que a persistência continua ocorrendo depois.
Testes relacionados 154/154 e `tsc --noEmit` passaram. O gate segue
**BLOQUEADO** até revisão independente do novo commit e CI verde do novo HEAD.

---

## Gate 4 — PR e aprovação para publicação

**Dono:** agente executor + aprovador humano

**Objetivo:** tornar a integração revisável e só então autorizar merge.

1. [x] Publicar a branch de integração no remoto.
2. [x] Abrir PR para `main`, anexando o diagnóstico, a PEND-038 e este checklist.
3. [x] Conferir no PR que não há arquivos de outras frentes.
4. [x] Aguardar a GitHub Actions `CI` ficar verde em todos os passos.
5. [ ] Registrar aprovação da revisão.
6. [ ] Registrar autorização humana explícita para merge/deploy.

**PASS quando:** PR aprovado, CI verde e merge autorizado.

**BLOQUEADO quando:** CI, revisão ou autorização estiver pendente.

**Estado: BLOQUEADO (29/10/2026).** PR
`https://github.com/sergiokoloszuk/kolo-familia/pull/151` aberto e pronto para
revisão. A CI do HEAD anterior ficou verde; a correção do achado P1 ainda
precisa ser commitada, publicada, revisada e validada pela CI. Depois disso,
falta autorização humana específica para merge/deploy.

---

## Gate 5 — Publicação comprovada

**Dono:** agente executor

**Objetivo:** distinguir merge de deploy real.

1. [ ] Fazer merge do PR em `main` somente após o Gate 4.
2. [ ] Anotar SHA do merge: `____________________________`.
3. [ ] Acompanhar o deploy da Vercel até estado de sucesso.
4. [ ] Consultar `/api/health` em produção.
5. [ ] Confirmar HTTP 200, banco saudável e SHA publicado igual ao merge.
6. [ ] Confirmar que nenhuma configuração/env precisava ser aplicada.
7. [ ] Se o deploy falhar ou o SHA divergir, marcar BLOQUEADO; não declarar a
   mudança publicada.

**PASS quando:** a aplicação saudável responde com o SHA novo.

**FAIL quando:** deploy falha ou health fica vermelho.

---

## Gate 6 — Smoke seguro em produção

**Dono:** agente executor; humano apenas se houver teste autorizado

**Objetivo:** detectar regressão imediatamente sem usar família real como QA.

1. [ ] Preferir observação passiva dos primeiros 5 turnos orgânicos de texto
   tratado; não disparar mensagem de teste para família real.
2. [ ] Se houver conta/número de teste autorizado, obter autorização explícita
   antes do envio e seguir `PROTOCOLO-TESTE-REAL.md`.
3. [ ] Confirmar zero `null_excecao` causado pela versão nova.
4. [ ] Confirmar zero resposta duplicada, obsoleta ou enviada antes do fim do
   turno.
5. [ ] Confirmar que `ayla_oficial_cedeu` não aumentou por contexto nulo.
6. [ ] Reconstruir qualquer anomalia de ponta a ponta, incluindo as portas que
   não dispararam e o bloco “o que quase aconteceu”.

**PASS quando:** 5 turnos reais sem regressão funcional/operacional.

**FAIL e rollback imediato quando:** houver duplicidade, resposta obsoleta,
quebra de segurança/isolamento ou silêncio causado pela mudança.

---

## Gate 7 — Prova quantitativa de latência

**Dono:** agente executor

**Janela:** 72 horas após o deploy; se houver menos de 20 textos tratados,
estender até 7 dias ou até `n >= 20`, o que ocorrer primeiro.

Baseline de comparação:

- texto, `n=22`: primeira aceitação P50 13,453 s; P95 15,733 s;
- pré-decisão P50 1,619 s;
- áudio é acompanhado separadamente, sem decisão com `n=4`.

Checklist:

1. [ ] Fixar início/fim da janela e SHA publicado.
2. [ ] Separar texto de áudio e contar apenas turnos tratados comparáveis.
3. [ ] Calcular `pre_decisao` P50/P95.
4. [ ] Calcular tempo até primeira aceitação P50/P95.
5. [ ] Contar quedas para Legacy, exceções, cancelamentos e duplicidades.
6. [ ] Comparar com o baseline sem somar percentis de etapas diferentes.
7. [ ] Aplicar os critérios abaixo.

Critérios:

- **sucesso primário:** `pre_decisao` P50 cai pelo menos 15%, para no máximo
  **1,376 s**;
- **sucesso percebido:** primeira aceitação P50 cai pelo menos 5%, para no
  máximo **12,780 s**;
- **guardrail de cauda:** primeira aceitação P95 não pode piorar mais de 10%,
  teto **17,306 s**;
- **guardrail funcional:** zero duplicidade, resposta obsoleta ou regressão de
  segurança atribuível à versão.

**PASS:** sucesso primário + sucesso percebido + guardrails.

**PASS COM RESSALVA NO RELATÓRIO:** pré-decisão melhora, mas a latência total
fica inconclusiva por variação de modelo/amostra; a PEND-038 permanece aberta.

**FAIL:** pré-decisão não melhora ou qualquer guardrail rompe.

---

## Gate 8 — Fechamento e continuidade

**Dono:** agente executor

**Objetivo:** deixar o estado oficial verdadeiro e indicar o próximo passo.

1. [ ] Atualizar PEND-038 com SHA, janela, `n`, P50/P95 antes/depois e veredito.
2. [ ] Não baixar PEND-038 apenas por esta fatia: Web, Plano e percepção de
   múltiplos balões continuam fora do escopo desta correção.
3. [ ] Registrar se a mudança ficou, foi revertida ou exige segunda otimização.
4. [ ] Se ficou, indicar o próximo gargalo medido; não otimizar por hipótese.
5. [ ] Entregar relatório final com um dos vereditos permitidos: PASSOU,
   PASSOU COM RESSALVAS, FALHOU ou BLOQUEADO.

**PASS quando:** PEND-038 e relatório refletem exatamente produção e o próximo
passo tem dono.

---

## Rollback

Esta mudança não tem migração, env nova nem escrita de dados; o rollback é de
código.

1. [ ] Abrir PR de `git revert` do commit de integração/merge da latência.
2. [ ] Exigir CI verde também no revert.
3. [ ] Fazer merge e aguardar novo deploy da Vercel.
4. [ ] Confirmar no `/api/health` o SHA revertido e banco saudável.
5. [ ] Repetir o smoke passivo do Gate 6.
6. [ ] Registrar causa e evidência na PEND-038.

Nunca usar `git reset --hard`, sobrescrever `main` ou reverter junto mudanças de
outras frentes.

## Painel resumido

| Gate | Estado | Evidência |
|---|---|---|
| 1 · Integração | PASS | Base `25e8891`; simulações de merge sem conflito |
| 2 · CI | PASS | PR #151; run `40760820029`, job `123071947109`, 6m12s |
| 3 · Auditoria | BLOQUEADO | Revisão encontrou escrita indireta; correção local aguarda nova auditoria |
| 4 · PR/aprovação | BLOQUEADO | PR #151 aberto; correção aguarda push, CI, revisão e autorização de merge |
| 5 · Publicação | BLOQUEADO | Depende dos Gates 2–4 |
| 6 · Smoke | BLOQUEADO | Depende do deploy |
| 7 · Métrica 72 h | BLOQUEADO | Depende do deploy e `n >= 20` |
| 8 · Fechamento | BLOQUEADO | Depende da prova em produção |
