# Pendências concluídas e canceladas — Kolo Família

Histórico. As abertas vivem em [PENDENCIAS.md](PENDENCIAS.md).

Nada é apagado daqui: **ID não é reciclado**, e uma pendência cancelada com
motivo é registro de decisão — sem ela, o que se decidiu não fazer volta a ser
proposto seis meses depois.

Ordem cronológica inversa: a mais recente no topo.

---

## 2026

### PEND-003 · Preview da Vercel vermelho há vários PRs
Infra/Deploy · P1 · **CONCLUÍDA**
Aberta em: 2026-08-08 · Concluída em: 2026-08-08

- **Causa raiz:** o build do Next **prerenderiza páginas que instanciam o
  cliente Supabase**, o que exige `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` **no momento do build**. Elas existiam só em
  Production. Sem elas o export morre em `/boas-vindas` e `/ludico/desenhos`
  com *"@supabase/ssr: Your project's URL and API key are required"*. Como o
  prerender roda independente do que mudou, commit só de markdown falhava igual.
- **O que resolveu:** as duas variáveis — **e apenas elas** — adicionadas ao
  ambiente **Preview**. Nenhuma variável sensível: as duas são `NEXT_PUBLIC_*`,
  embutidas no bundle do navegador por construção, e a anon key é protegida por
  RLS.
- **Evidência final (2026-08-08):** build de Preview `Ready` em 1m44s (branch
  `docs/pend-003-causa-raiz`, commit `c8d134c`); URL de preview abriu; Vercel
  Authentication com Standard Protection **intactas**; Production seguiu
  `Ready`. Antes da correção, uma tentativa com valor inválido produziu
  *"Invalid supabaseUrl"* — prova de que a variável chega ao build e é ele quem
  a consome.
- **Aprendizado:** investigação bloqueada por falta de acesso pode não estar
  bloqueada — a causa saiu de dois builds locais de trinta segundos
  (sem env → falha; só com as duas públicas → passa), sem nunca ler o log
  remoto. E CI que compila mas não publica não sente falta das variáveis do
  ambiente de destino: dois checks verdes e um vermelho não eram ambiguidade,
  eram medidas de coisas diferentes.

---

## Formato

Ficha arquivada é curta — o detalhe fica no commit e no relatório da missão:

```markdown
### PEND-XXX · Título
Categoria · Prioridade final · **CONCLUÍDA** (ou **CANCELADA**)
Aberta em: AAAA-MM-DD · Concluída em: AAAA-MM-DD

- **O que resolveu:** uma ou duas frases.
- **Evidência:** commit/PR, número medido, log, ou o que comprova.
- **Aprendizado:** uma frase. Obrigatória.
```

**Cancelada** troca "o que resolveu" por **"por que não vamos fazer"**.

> O campo `Aprendizado` é o motivo de este arquivo existir. Quando três fichas
> disserem a mesma coisa, aquilo virou padrão — e padrão sobe para
> [AI-ENGINEERING-PROTOCOL.md](AI-ENGINEERING-PROTOCOL.md) ou
> [FEATURE-DELIVERY-PROTOCOL.md](FEATURE-DELIVERY-PROTOCOL.md).
