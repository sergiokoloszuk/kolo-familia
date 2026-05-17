# Sessão Karina no Cowork — sprint pré-lançamento Kolo Família

**Data:** maio/2026
**Para:** Karina Koloszuk (fundadora) executar no Claude Cowork
**Objetivo:** consolidar conteúdo + decisões para o lançamento de 30/05/2026 (25 mães-beta)

---

## Contexto

Sérgio (dev) fechou a parte técnica do MVP. Schema do banco, página de admin, validador, Stripe em test mode, Mapa Familiar estruturado — tudo pronto. Agora dependem da Karina **3 frentes de conteúdo** + **algumas decisões** pré-lançamento.

Lançamento dia 30/05 para 25 mães-beta.

---

## Documentos canônicos (referências permanentes)

Esses documentos das Sessões 1-3 prevalecem sobre o PRD original quando há conflito. Compartilhar no chat do Cowork ao começar cada frente:

- `ADENDO_PRD_v1.md` — 6 decisões consolidadas (anatomia da resposta, validador, mapa familiar, 26 categorias, 5 fundamentos, calibração por idade)
- `REGUA_DE_TOM_v3.md` — voz, anatomia da resposta, paleta de 6 famílias de imagens, vetos absolutos, glossário
- `05_PROMPT_SKILL_EMOCIONAL_v3.md` — template das outras 11 skills (a Emocional foi a primeira reescrita)
- `respostas_teste_v3.md` — 3 casos da Emocional validados (boa, birra, esgotamento)
- `Dicionario_Traducao_Kolo_Familia.xlsx` — 35 termos clínicos dissolvidos na voz Kolo

---

## As 3 frentes

### Frente 1 — Reescrever 11 skills com voz v3

Existem 14 skills no DB. A Emocional já está reescrita. As outras 11 (7 ativas com conteúdo do PRD original + 7 rascunhos com conteúdo placeholder) precisam ser reescritas seguindo a régua v3.

Detalhamento completo: [`cowork-frente-1-skills.md`](./cowork-frente-1-skills.md)

### Frente 2 — Processar 12 PDFs em 250-400 Boas Práticas

A fundadora tem 12 PDFs de aulas/conteúdos. Cada PDF rende aproximadamente 20-30 Boas Práticas curadas que entram no DB e são consumidas pelas skills nas respostas.

Detalhamento completo: [`cowork-frente-2-boas-praticas.md`](./cowork-frente-2-boas-praticas.md)

### Frente 3 — Completar Dicionário de Tradução

O dicionário cobre 3 dos 5 fundamentos (Dispenza, PNL, Psicologia Positiva). Faltam:

- **Neurociência** — vários termos já em uso no app (regulação, salva-vidas, córtex pré-frontal, função executiva, co-regulação, amígdala). Cerca de 15-20 termos a catalogar.
- **Neuropsicologia** — cognição social, teoria da mente, modulação, displacement, etc. Cerca de 10-15 termos.

Adicionar ao arquivo existente seguindo a mesma estrutura:

| Fundamento | Termo técnico | Significado | Voz Kolo dissolvida | Frase pronta | Quando NÃO usar |

Não é urgente — esses termos já estão sendo usados dissolvidos no app. Formalizar serve para revisões futuras.

---

## Decisões pendentes para Sérgio executar

Karina decide e avisa o Sérgio:

### 1. Beta Gate

`BETA_GATE_ENABLED` no lançamento: `true` ou `false`?

- **ON**: mães precisam de código de convite para entrar (Karina gera os códigos via `/admin/convites`).
- **OFF**: qualquer pessoa pode fazer signup (mais aberto, mas pode entrar gente fora da curadoria).

### 2. Stripe LIVE

A partir de quando ativar cobrança real?

- Hoje está em modo TEST (cartão `4242 4242 4242 4242` não cobra).
- Para cobrar de verdade, Sérgio troca para LIVE (operação de ~30 min).
- Decisão: ativar LIVE no dia 30 (primeiras assinaturas reais) ou esperar 1-2 semanas em test para ajustar conteúdo?

### 3. SMTP no Supabase

Hoje email de signup é autoconfirmado (não exige confirmação real). Para lançamento aberto ao público, precisa SMTP real.

- Provedor de email do domínio kolofamilia.com.br já existe?
- Ou usamos serviço genérico (Resend, Postmark, SendGrid)?

### 4. Domínio kolofamilia.com.br

Hoje aponta para outro site (Render antigo, app Python). Sérgio precisa apontar para o Vercel.

- O que está no Render é descartável? Pode ser desativado?
- Ou precisamos manter em outro endereço?

---

## Como trabalhar com a Claude no Cowork

**Frente 1 (skills):** para cada skill, a fundadora passa o que quer **enfatizar** e **evitar** daquela área. A Claude gera o draft no formato esperado. A fundadora revisa, a Claude ajusta. Quando estiver bom, vai para o admin do app.

**Frente 2 (BPs):** para cada PDF, a fundadora compartilha o documento. A Claude lê, identifica candidatas a BPs e devolve uma lista para revisão. A fundadora marca quais manter/cortar/editar. A Claude finaliza no schema.

**Decisões:** discutir sempre que aparecer dúvida durante o trabalho.

---

## Sugestão de ordem

1. Frente 1, começar pela `regulacao_emocional` (prima da Emocional, transição suave).
2. Em paralelo, ir processando os PDFs da Frente 2 (intercalar para não cansar).
3. Decisões pendentes resolver à medida que aparecerem.
4. Frente 3 (dicionário) por último ou em momentos de folga.

---

*Este documento é a porta de entrada do trabalho. Os detalhes operacionais estão nos arquivos linkados.*
