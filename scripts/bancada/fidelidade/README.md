# Bancada de fidelidade — a Ayla conversa como a agência mandou?

Rubrica **F1–F20**, extraída do PDF `AYLA_KOLO_FAMILIA_PROMPT_MESTRE` (o
documento da agência), rodada contra a produção real.

`rodar-A.mjs` executa **só o braço A** — Core v10 do banco, `experimental.ts`,
contexto, repertório e `notaDeProporcao` exatamente como estão. Nenhuma
alteração, nenhuma escrita: a chave de service-role é apagada do ambiente antes
de qualquer import do app, e a rede só aceita os endpoints do modelo.

## Linha de base — 05/09/2026, Core v10 sha `791c6637`

**66 turnos · 6 cenários · 6 execuções cada.**

Onze critérios fecharam em **100%**: F1 (N1 curto) · F5 (sem suspense) ·
F8 (uma pergunta) · F9 (sem interrogatório) · F10 (personalização não
anunciada, **0 de 66**) · F11 (não inventa) · F12 (continuidade) ·
F13 (correção prevalece) · F14 (CTA específico, **0 de 66** genérico) ·
F18 (emoji × gravidade, **0 de 6** na urgência) · F19 (sem jargão, **0 de 66**).

Duas violações recorrentes:

- **F4** — *"Me mostra"* virou lista numerada em **3 de 6**. O PDF §59 usa
  exatamente essa frase e responde em prosa.
- **F20** — desabafo: **0 de 6** ofereceram a escolha do §46; **6 de 6** deram
  instrução de ação e **5 de 6** rastrearam risco. A mensagem não dispara
  `RISCO_INEQUIVOCO` — foi o modelo escolhendo a leitura mais segura.

## Duas correções minhas, registradas

1. Eu havia afirmado que `notaDeProporcao` inflava as respostas. **Falso.** O
   modelo fica abaixo do teto em 10 dos 11 turnos (51% a 87% da meta). Ele é
   teto, não piso. O único ponto onde aperta é o turno de passo a passo, que
   cai em `continuacao` (500) por a mensagem ser curta — **teto invertido em
   relação à progressão da agência**.
2. Meu detector de "hipótese que volta" acusou 6/6 no cenário de correção.
   Lendo as respostas, as seis **abandonam explicitamente** ("vou tirar essa
   hipótese"). Era o reconhecimento sendo contado como reincidência.

## Reproduzir

```bash
EXECUCOES=6 npx tsx scripts/bancada/fidelidade/rodar-A.mjs
```

`resultados-A-ANTES.json` é a linha de base congelada. `resultados-A.json` é a
última execução.
