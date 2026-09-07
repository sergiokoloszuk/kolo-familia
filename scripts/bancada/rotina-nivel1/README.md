# Bancada Nível 1 — Rotina Visual reativa

Prova reproduzível da correção `cfd500b` (continuidade da rotina, aceite curto,
memória que não vira etapa), com **modelo real** e **zero contato com produção**.

```bash
npx tsx scripts/bancada/rotina-nivel1/rodar.mjs
```

Sai com código 0 se todos os asserts passarem, 1 se algum falhar.

## Pré-requisitos

`apps/web/.env.local` com `ANTHROPIC_API_KEY` (a condução da rotina roda no
Claude) e `OPENAI_API_KEY` (o decisor do turno, usado para reproduzir o portão
do orquestrador). Nada mais precisa estar configurado — e a chave de service role
do Supabase é **apagada** do processo, então ter ou não ter é indiferente.

## As três travas, e por que são físicas

1. **`SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_SERVICE_KEY` são apagadas do
   ambiente ANTES de qualquer import do app.** Sem elas nenhum cliente real de
   banco se constrói. A trava morde de verdade e isso aparece no log:
   `[ayla:ponte] falha ao gerar magic-link: Your project's URL and Key are
   required` — o código tentou e não conseguiu.
2. **`globalThis.fetch` é substituído por um guarda com allowlist.** Só
   `api.anthropic.com` e `api.openai.com` passam. Z-API, Supabase e qualquer
   outro host **estouram**, e o estouro é contado e reportado no fim.
3. **O endpoint de geração é interceptado, contado e emulado.** Ele reproduz o
   que o endpoint real faz — grava `cards_status='gerando'` antes de responder
   (`gerar-rotina/route.ts` l.132) e recusa quando já está `gerando`/`pronto`
   (l.75-78) —, mas não desenha nada.

O banco é `BancoMemoria` (`lib/ayla/__harness/banco-memoria.ts`), que registra
toda escrita em `db.escritas`. É assim que o roteiro prova o que foi persistido.

## O que o roteiro cobre

| Cenário | O que prova |
|---|---|
| **Manu** | pedido explícito abre o portão real · exatamente 1 rotina · nenhuma etapa contém "barco" (com a transição de 24/07 semeada no perfil) · tema sugerido do perfil · aceite curto `"Pode ser"` aplica o tema sugerido · **exatamente 1 geração** · estado vai a `gerando` · a entrega encerra a posse · `"Nao tem barco"` e `"Ok"` depois do desfecho **não** reabrem o portão |
| **Mario** | pedido de imagens vira proposta · `"Sim"` retoma a ação sem exigir novo pedido · o turno do tema é reproduzido (não forçado) · **exatamente 1 geração** |
| **Controles negativos** | `sim`, `pode`, `pode ser`, `ok`, `isso` sem ação pendente não abrem o portão, não escolhem tema, criam **0 rotinas e 0 gerações** · memória não mencionada fica fora · memória mencionada continua valendo |
| **Trava estrutural** | a porta da rotina retorna `tratada: true` **antes** de `ponteDePlano`, e emite tipo de rotina, nunca `resposta_registro` |

## O que ele NÃO prova

Estado final real (`gerando → pronto` com arte no bucket), imagens e link
`/auth/wa`. Isso depende de banco e geração reais — é o **Nível 2**, e exige
família de QA. O comportamento ponta a ponta no WhatsApp é **Nível 3**, hoje
bloqueado pela conta de QA que não existe (`docs/QA-CONTA-DEDICADA.md`).

O portão aqui é uma **cópia** de `orchestrator.ts` l.2947-2963, não o
orquestrador rodando: reproduz as quatro condições e chama o decisor de verdade,
mas `processInbound` inteiro segue coberto só pela trava estrutural.

## Dois erros que este roteiro já cometeu

Ficam registrados porque instrumento que não guarda os próprios erros os repete.

1. **Chamava `conduzirRotina` em todo turno.** O orquestrador nunca faz isso —
   há um portão antes. Medido: para `"Ok"` e `"Nao tem barco"`, `pedeRotina`,
   `pediuRotinaExplicitamente` e `abreFluxoDeArtefato` devolvem todos `false`. O
   roteiro acusou como defeito do produto uma rotina que ele mesmo mandou criar.
2. **Interceptava a geração sem gravar `cards_status='gerando'`.** A rotina
   continuava visível como `aguardando` e era reprocessada — e a idempotência do
   endpoint real nunca era exercitada.

E um terceiro, de método: o assert do Mario era `<= 1`, que **passa com zero**.
Um assert que não pode falhar não é prova. Aqui todos são `===`.
