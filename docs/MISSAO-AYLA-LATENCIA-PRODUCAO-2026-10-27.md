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
- [ ] 0.6 Suíte completa verde: hoje há 2 testes antigos sensíveis à data
  falhando fora dos arquivos alterados.
- [ ] 0.7 Build verde: o build local foi bloqueado pelo proxy no carregamento
  de Google Fonts; não vale como prova de compilação.
- [ ] 0.8 Branch publicada, PR aberto, merge e deploy: ainda não realizados.

**Estado atual da missão:** Gate 1 ainda não iniciado; produção permanece
bloqueada até os Gates 1–4 passarem.

---

## Gate 1 — Janela de integração sem colisão

**Dono:** agente executor + responsável pelas outras frentes

**Objetivo:** levar somente esta mudança para uma base atual, sem sobrescrever
trabalho paralelo.

1. [ ] Listar quais frentes ainda alteram `orchestrator.ts`, testes da Ayla ou
   `docs/PENDENCIAS.md`.
2. [ ] Definir a ordem de integração dessas frentes.
3. [ ] Atualizar `origin/main` com `git fetch`.
4. [ ] Criar/reusar um worktree limpo a partir da `origin/main` atualizada.
5. [ ] Aplicar `1d2f8bb` nessa base por cherry-pick ou rebase.
6. [ ] Se houver conflito em `orchestrator.ts` ou `PENDENCIAS.md`, parar e
   reconciliar por comportamento; nunca escolher “ours/theirs” às cegas.
7. [ ] Confirmar que o diff final contém somente os arquivos necessários desta
   frente e eventuais ajustes explícitos de integração.
8. [ ] Confirmar `core.autocrlf=false` e `git diff --check` limpo, tratando o
   CRLF histórico de `PENDENCIAS.md` como `cr-at-eol` quando necessário.

**PASS quando:** base atualizada, conflitos auditados e nenhuma mudança de
outra frente foi perdida.

**FAIL quando:** algum arquivo paralelo foi sobrescrito ou o comportamento de
um portão mudou sem decisão explícita.

---

## Gate 2 — CI limpa e reproduzível

**Dono:** agente executor

**Objetivo:** cumprir exatamente a CI do repositório antes de abrir caminho ao
deploy.

1. [ ] Rodar `npm ci` em ambiente limpo.
2. [ ] Rodar `node --test scripts/pendencias-index.test.mjs`.
3. [ ] Rodar `node scripts/pendencias-index.mjs --check`.
4. [ ] Rodar `npx next typegen` em `apps/web`.
5. [ ] Rodar `npx tsc --noEmit` em `apps/web`.
6. [ ] Rodar a suíte completa com `npm test` em `apps/web`.
7. [ ] Resolver os dois testes sensíveis à data em commit separado, ou provar
   que a `main` mais nova já os resolveu. Se a solução exigir mudar o produto,
   abrir frente própria; não esconder mudança funcional como ajuste de teste.
8. [ ] Rodar `npx next build --webpack` em ambiente capaz de acessar as fontes.
9. [ ] Não desabilitar TLS nem aceitar build parcial para atravessar o gate.

**PASS quando:** todos os passos da CI terminam com código 0 em base limpa.

**BLOQUEADO quando:** fontes externas, dependências ou runner impedem o build;
o log do bloqueio deve ser anexado e a publicação não avança.

---

## Gate 3 — Auditoria independente da mudança

**Dono:** revisor que não presume o relato da implementação

**Objetivo:** provar que a otimização não mudou decisões nem abriu concorrência
perigosa.

1. [ ] Comparar o diff contra a `main` que será publicada.
2. [ ] Confirmar que todos os itens adicionados aos `Promise.all` são somente
   leitura.
3. [ ] Confirmar que não há `insert`, `upsert`, `update`, `delete`, envio de
   WhatsApp ou chamada de modelo dentro das ondas novas.
4. [ ] Confirmar que a segurança continua abaixo do gate de acesso e antes dos
   handlers de entregáveis.
5. [ ] Confirmar isolamento por `family.id` e que a promessa de histórico é
   local ao turno.
6. [ ] Confirmar que janela de 10 s, prompts, modelos, fallbacks e textos não
   mudaram.
7. [ ] Confirmar que não há migração, variável de ambiente, cron ou segredo
   novo.
8. [ ] Revisar a seção de rollback desta missão.

**PASS quando:** revisão sem achado P0/P1 e todos os invariantes acima têm
evidência em código/teste.

**FAIL quando:** houver escrita concorrente, risco entre famílias/irmãos ou
mudança de comportamento não coberta por teste.

---

## Gate 4 — PR e aprovação para publicação

**Dono:** agente executor + aprovador humano

**Objetivo:** tornar a integração revisável e só então autorizar merge.

1. [ ] Publicar a branch de integração no remoto.
2. [ ] Abrir PR para `main`, anexando o diagnóstico, a PEND-038 e este checklist.
3. [ ] Conferir no PR que não há arquivos de outras frentes.
4. [ ] Aguardar a GitHub Actions `CI` ficar verde em todos os passos.
5. [ ] Registrar aprovação da revisão.
6. [ ] Registrar autorização humana explícita para merge/deploy.

**PASS quando:** PR aprovado, CI verde e merge autorizado.

**BLOQUEADO quando:** CI, revisão ou autorização estiver pendente.

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
| 1 · Integração | ⬜ | |
| 2 · CI | ⬜ | |
| 3 · Auditoria | ⬜ | |
| 4 · PR/aprovação | ⬜ | |
| 5 · Publicação | ⬜ | |
| 6 · Smoke | ⬜ | |
| 7 · Métrica 72 h | ⬜ | |
| 8 · Fechamento | ⬜ | |
