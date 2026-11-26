O Plano V5.1 passa a ter percurso próprio: relato → convite → investigação → escolha → combinado → dia 1 vazio → tentativa → resultado observado → conquista apenas com melhoria relatada e confirmação. O documento legado é preservado; somente novos planos versionados usam a candidata, restrita a staff.

## Revisão

- [Matriz de reaproveitamento](https://github.com/sergiokoloszuk/kolo-familia/blob/codex/ayla-web-v5-interna-20261126/docs/specs/plano-web-v51.md)
- [Checklist das 15 regras](https://github.com/sergiokoloszuk/kolo-familia/blob/codex/ayla-web-v5-interna-20261126/outputs/plano-v51/CHECKLIST-15-REGRAS.md)
- [Relatório e quadro G00–G10](https://github.com/sergiokoloszuk/kolo-familia/blob/codex/ayla-web-v5-interna-20261126/outputs/plano-v51/RELATORIO-PLANO-V51.md)

![Desktop](https://github.com/sergiokoloszuk/kolo-familia/blob/codex/ayla-web-v5-interna-20261126/outputs/plano-v51/prints/desktop-descobrir.png?raw=true)
![Celular](https://github.com/sergiokoloszuk/kolo-familia/blob/codex/ayla-web-v5-interna-20261126/outputs/plano-v51/prints/celular-experimentar-dia1.png?raw=true)

## Validação local

77 testes do recorte reproduzível do PR aprovados, zero falhas e zero pulados; lint/typecheck e build Next/Webpack aprovados. A rodada anterior de 95 incluía 18 testes da Home que não fazem parte deste PR. Quatro percursos de navegador, incluindo retomada após recarregar com o repositório real sobre um banco simulado. Isolamento família/criança/plano, idempotência, erro de escrita e conflito de revisão exercitados. Sem modelo real e sem banco real.

## O que falta

IA real com avaliação semântica, continuidade WhatsApp, teste em Postgres descartável com RLS/CAS, triagem de risco/texto de cuidado revisado, conversa livre persistente, prioridade persistente e integração com diário global. O percurso completo dentro do chrome autenticado também precisa ser validado. Não liberar às famílias com esses pontos abertos.

Sem migração, alteração de registros existentes, Stripe, Home ou Core. Nenhuma publicação autorizada. A configuração de Git impede deploy automático apenas desta branch; main e flags funcionais não mudam. PR em rascunho, sem merge ou deploy.
