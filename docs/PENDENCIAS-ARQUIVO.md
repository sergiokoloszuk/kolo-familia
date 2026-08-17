# Pendências concluídas e canceladas — Kolo Família

Histórico. As abertas vivem em [PENDENCIAS.md](PENDENCIAS.md).

Nada é apagado daqui: **ID não é reciclado**, e uma pendência cancelada com
motivo é registro de decisão — sem ela, o que se decidiu não fazer volta a ser
proposto seis meses depois.

Ordem cronológica inversa: a mais recente no topo.

---

## 2026

### PEND-010 · Triar as 26 pendências do laudo de 06/08
Documentação · P2 · **CONCLUÍDA**
Aberta em: 2026-08-08 · Concluída em: 2026-08-08

- **O que resolveu:** o laudo `docs/pendencias-2026-08-06.md` deixou de ser uma
  segunda lista de verdade. Cada item recebeu destino, e o registro passou a
  organizar as frentes por **bloco e dependência** em vez de lista plana —
  porque funcionalidades que compartilham cérebro, memória, recuperação ou
  decisão não podem ser investigadas como independentes.
- **Destino dos 26 itens:**

  | Itens | Destino |
  |---|---|
  | 1, 2, 17 | **já resolvidos** — o próprio laudo os marcava ✅ |
  | 10, 26 | **já resolvidos** — viraram PEND-008 (funil + segmentação), concluída em 2026-08-08 |
  | 20 | **já coberto** — é a PEND-007 |
  | 19, 21, 22 | **incorporados à PEND-007** (resíduos da migração OpenAI, nenhum bloqueia ativação) |
  | 3, 4, 12, 13, 15 | **incorporados à PEND-016** (condução) |
  | 5, 6 | **incorporados à PEND-019** (estratégias) |
  | 8 | **incorporado à PEND-019** — a causa dos 3 planos é o item 5 |
  | 23, 24, 25 | **incorporados à PEND-021** (jornada e conversão) |
  | 11, 14 | **incorporados à PEND-016** como dívida de precisão e de UX da web |
  | 7, 9 | **mantidos como não reproduzidos** — destino do fluxo `/auth/wa` e causa 2019→2002; ficam em PEND-016 sem prometer investigação própria |
  | 16, 18 | **obsoletos como bloqueador** — decisão de produto de 06/08 tirou a avaliação cega do portão; o que resta de artefatos entra em PEND-017 |

- **Aprendizado:** consolidar não é transformar cada item antigo numa pendência.
  Dos 26, **cinco** já estavam resolvidos e **dezesseis** pertenciam a cinco
  frentes que compartilham o mesmo cérebro. Tratá-los como 26 pendências
  independentes teria produzido implementações paralelas da mesma inteligência —
  o retrabalho mais caro que existe aqui.


### PEND-008 · Contagens e segmentações usando `status` cru de assinatura
Dados/Banco · P2 · **CONCLUÍDA**
Aberta em: 2026-08-08 · Concluída em: 2026-08-08

- **Causa raiz:** o trial não expira sozinho no banco — a linha continua
  `status = 'trialing'` depois de `trial_ends_at` passar, e quem decide acesso é
  `assinaturaLiberada`, que confere a data. Medido em produção: **163 linhas
  `trialing`, 121 com o trial já vencido**.
- **O que resolveu:** parar de derivar leitura do `status` cru, em vez de
  corrigir o dado em lote — um UPDATE consertaria o retrato de hoje e voltaria a
  divergir amanhã. Duas frentes, uma regra: o **funil** (`/dashboards` e
  `/admin/comportamento`) separa "em teste" de "trial vencido"; a **segmentação
  de campanha** ganhou segmentos semânticos, com "Trial vencido" como público
  próprio para retomada. Os dois usam `trialValido`, extraída em
  `lib/auth/assinatura.ts` — a mesma função do gate de acesso.
- **Evidência final:** a tela dizia **"163 em teste"**; passa a dizer **42 em
  teste · 121 trial vencido · 2 assinante**, com a soma dos baldes igual ao
  total. 25 testes novos, todos conferidos por mutação. Publicado em `f22e43e`
  (funil) e no merge da segmentação, ambos com Production `success`.
  Zero escrita no banco.
- **Aprendizado:** a mesma causa técnica em dois lugares não merece o mesmo
  tratamento — na contagem, o erro mostra um número errado; na segmentação, ele
  manda mensagem errada para a casa da família. O corte de escopo que funcionou
  foi por **quem sofre o efeito**, não pela causa. E o caso que ninguém tinha
  previsto (`trialing` sem data) apareceu porque um teste cruzava duas fontes
  que deveriam concordar, em vez de conferir um número esperado.

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

### PEND-087 · Proativa imprimia o texto cru do campo do nome como nome da criança
F · Limites · P1 · **CONCLUÍDA**
Aberta em: 2026-08-17 · Concluída em: 2026-08-17

- **O que resolveu:** as cinco proativas escritas à mão no orquestrador
  (`video_guia`, `plano_seguimento`, `rotina_seguimento`, `recuperacao_plano`,
  `recuperacao_rotina`) passaram a citar a criança por `citarCrianca()` — nome
  só quando é nome (`primeiroNomeCriancaConfiavel`), concordância só com gênero
  registrado, neutro em qualquer dúvida, e a mensagem nunca deixa de sair por
  falta de nome. `ctx.nomeMae` não precisou de conserto: `loadFamiliaParaEnvio`
  já o passava pelo detector.
- **Evidência:** merge `5edafd0` (PR #122), em produção com health verde e zero
  erro novo. 12 testes cobrindo nome inválido (`"Meu Filhos"`, `"meu filho"`,
  frase inteira, vazio), gênero conhecido e fallback neutro. Provado por
  execução: revertendo só a `video_guia`, o teste do `"Meu Filhos"` reprova.
- **Achado extra, corrigido junto:** uma das cinco decidia o gênero da criança
  pela ÚLTIMA LETRA do nome (`endsWith("a") ? "a" : "o"`). Todo Nicolas virava
  menina. Não estava no laudo original — apareceu na varredura.
- **Aprendizado:** um detector só protege o caminho que o consulta. `crianca-nome.ts`
  existia, funcionava e era chamado pela conversa reativa — enquanto cinco
  proativas montavam a citação à mão, do lado, e erravam. Quando a mesma decisão
  aparece escrita em mais de um lugar, ela já está divergindo; a pergunta certa
  não é "o detector existe?", é "quem NÃO está passando por ele?".

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
