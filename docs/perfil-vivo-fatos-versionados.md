# Perfil Vivo v2 — fatos versionados, proveniência e visão derivada

> **Norte (Sérgio + Karina + ChatGPT, 24/07):** o Perfil Vivo NÃO deve buscar uma única "verdade textual" apagando registros. Deve manter **fatos versionados, datados e com contexto**, **calcular** um estado atual, e apresentar divergências **agrupadas por conceito**. A IA pode atualizar automaticamente evoluções explícitas e diferenças contextuais de alta confiança, **desde que preserve histórico e auditabilidade**. Na ambiguidade real, propõe reconciliação simples pra a família confirmar (incluindo **"depende da situação"**). **Nunca** exclui silenciosamente dado sensível nem substitui um fato sem registrar origem, versão e motivo.
>
> Padrão de referência: **saúde (FHIR-like: proveniência + versionamento), não CRM (last-write-wins).**

---

## 1. O problema que isso resolve

Hoje o perfil guarda **texto consolidado por área** (`perfil_vivo_membro`: um blob por domínio). Isso mistura três coisas num lugar só:
- **estado atual** ("está mais falante"),
- **contexto** ("na escola fica quieta"),
- **histórico** ("antes não verbalizava").

Consequências vistas no perfil da Manu:
- **Contradições empilhadas** ("mais falante" ao lado de "não verbaliza nada").
- **Falsos positivos** de conflito: "chega quieta" ≠ "ama conversar"; "fala em casa" ≠ "fala na escola" — são **variação de contexto/oscilação**, não contradição.
- **Duplicação**: "comunicação" aparece em Comunicação, Regulação, Socialização, Escola, Desafios.
- **Tela punitiva**: 4 alertas grandes + "56% preenchido" + "dispensar" → a mãe sente que "a Ayla não conhece minha filha".

## 2. Modelo de dados — o fact-store

Nova tabela **`perfil_fatos`** (append-only + versionamento). Cada observação vira um fato com metadados:

```
perfil_fatos
  id                uuid pk
  family_account_id uuid
  membro_atipico_id uuid
  conceito          text     -- chave canônica (ex.: "comunicacao.fala_expressiva")
  area              text     -- área de exibição (ex.: "comunicacao") p/ agrupar
  afirmacao         text     -- o fato em 1 frase ("consegue contar sobre a escola")
  contexto          text     -- "em casa" | "na escola" | "quando ansiosa" | null
  observado_em      date     -- quando foi verdade/observado (pode ser aproximado)
  registrado_em     timestamptz default now()
  fonte             text     -- relato_mae | inferencia_ia | documental | profissional
  status            text     -- current | historical | superseded | uncertain
  confianca         numeric  -- 0..1
  supersedes_id     uuid null -- fato que este substitui (cadeia de evolução)
  origem_detalhe    jsonb    -- conversa_id, mensagem, canal (whatsapp/web), etc.
  ativo             boolean default true  -- soft-delete (NUNCA delete físico)
```

**Princípios:**
- **Nada é apagado fisicamente** — `status`/`supersedes_id`/`ativo` marcam, não deletam (LGPD + auditoria).
- O `perfil_vivo_membro` atual **vira cache de uma visão derivada** (ou é aposentado) — deixa de ser "o único lugar onde a verdade existe".
- A **linha do tempo** (`eventos_membro`, já existe) continua sendo a camada de marcos datados — o fact-store e ela se complementam (marcos = fatos de evolução destacados).

## 3. Camada canônica de habilidades

Conceitos **transversais** que as áreas referenciam (não copiam). Ex. inicial:

```
comunicacao.fala_expressiva      comunicacao.compreensao
comunicacao.narrativa            comunicacao.fluencia
comunicacao.pedido_de_ajuda
socializacao.iniciativa          socializacao.participacao_em_grupo
regulacao.gatilhos               regulacao.estrategias_que_acalmam
alimentacao.aceitacao            alimentacao.sensorial
...
```

A MESMA habilidade aparece em áreas diferentes **como contexto**, não como cópia:
- Comunicação → estado geral da linguagem.
- Regulação → "quando desregulada, a fala reduz".
- Escola → "na sala, tende a falar menos".

Isso **não é contradição — é a habilidade variando por contexto.** A taxonomia é **conteúdo clínico → a Karina define** (começamos com um conjunto mínimo e expandimos).

## 4. Incorporação (os 2 canais escrevem FATOS)

Hoje: WhatsApp auto-incorpora texto; web propõe→confirma texto. **Novo:** os dois extratores emitem **fatos** (`conceito, afirmacao, contexto, observado_em, fonte, confianca`) em vez de texto consolidado. A gravação passa pelos **4 níveis**:

**Nível 1 — Autoatualização segura (sem alerta).** Quando: mesmo conceito + marca temporal clara + relato mais recente + mudança explícita da mãe + histórico preservado + reversível/auditável. Ex.: *"antes não falava, agora conta a escola"*, *"passou a aceitar brócolis"*. Ação: novo fato vira `current`, o antigo vira `historical` (`supersedes_id`), registra marco na linha do tempo, **sem alerta**.

**Nível 2 — Conciliação por contexto (sem alerta).** Quando os relatos **coexistem** (contextos claros). Ex.: *"ama conversar em casa"* + *"na escola fica quieta"* → a visão derivada mostra: *"Em casa mostra interesse em conversar; na escola, sobretudo na chegada/ansiedade, tende a ficar mais quieta."* Automático quando o contexto está explícito.

**Nível 3 — Confirmação de 1 toque.** Provável evolução, mas falta data/contexto. A Ayla pergunta, com a opção **essencial "depende da situação"**:
> *"Você contou que a Manu está mais falante, mas temos registrado que usa principalmente palavras soltas. O que descreve melhor o momento?"* → [Já fala em frases] [Ainda usa mais palavras soltas] [**Depende da situação**] [Quero explicar]

**Nível 4 — Revisão detalhada.** Só pra ambiguidade que afeta **relatório/estratégia/terapeuta/regressão/saúde-medicação-alergia-risco**. A Ayla **propõe**, não aplica sem confirmar.

## 5. Visão atual derivada

A "área" (Comunicação, etc.) **deixa de ser texto salvo** e passa a ser **calculada** dos fatos `current` daquele conceito, conciliando contexto. É o que a mãe vê e o que o relatório usa. Regenerável a qualquer momento a partir dos fatos → sem drift, sem contradição empilhada.

## 6. Detector de conflito — matar os falsos positivos

O detector atual sinaliza frases semanticamente opostas como contradição. Novo comportamento: **só é conflito** quando é o MESMO conceito, MESMO contexto, e realmente incompatível no tempo. Diferença de **contexto**, **oscilação da habilidade**, **evolução no tempo** ou **fontes diferentes** → **não é conflito** (é conciliação, Nível 2). Agrupa por **conceito** (os 4 avisos de comunicação viram 1 revisão).

## 7. UI do Perfil (tirar o tom punitivo)

- **Sem "56% preenchido"** → "**9 áreas já conhecidas · 7 que podemos descobrir aos poucos**" ou "O retrato da Manu está ganhando forma".
- **Sem 4 alertas grandes** → uma seção compacta *"Alguns pontos pra revisar — algumas coisas podem ter mudado ou acontecer de formas diferentes conforme a situação."*, agrupada por conceito.
- **"Dispensar"** → *[As duas estão certas] [Isso mudou com o tempo] [Atualizar agora] [Revisar depois]* (e cada escolha vira **dado** pra melhorar o classificador).
- Revisão de comunicação única, tipo: *"Como está a comunicação da Manu hoje? Temos registros de momentos diferentes: … Qual frase representa melhor?"* + a opção "depende da situação" → **ensina a mãe a observar e limpa vários campos de uma vez.**

## 8. LGPD (requisitos mínimos)

Dado de saúde de criança = dado pessoal **sensível** + melhor interesse da criança + consentimento específico do responsável. O risco não é "a IA reescrever", é fazer tratamento automatizado **opaco, irreversível ou sem correção**. Requisitos:
- **Nenhuma exclusão física automática**; soft-delete + versionamento.
- **Proveniência** de cada fato (origem, autoria, data do relato e, quando possível, do acontecimento).
- **Correção simples** pela família + **registro de toda alteração automática**.
- **Explicabilidade**: como o Perfil Vivo é construído.
- **Distinção clara**: relato da família × inferência da IA × documento profissional.
- Avaliação jurídica de base legal, consentimento, retenção e compartilhamento.

## 9. Migração (backfill)

Uma passada de IA lê o `perfil_vivo_membro` atual + a linha do tempo e **emite fatos** com proveniência (`fonte=inferencia_ia`, `confianca` conservadora, `observado_em` aproximado). **Staged e reversível** — e ⚠️ **o Supabase é sensível a migração** (ver incidente de persistência): schema novo aplicado com cuidado, backfill idempotente, sem tocar o texto atual até a visão derivada estar validada.

## 10. Fases de implementação (sem quebrar produção)

- **Fase 0 — Fundação.** Taxonomia canônica mínima (Karina) + schema `perfil_fatos` (migração) + helpers.
- **Fase 1 — Dual-write (não quebra nada).** Os 2 extratores passam a gravar FATOS **além** do texto atual. Visão derivada calculada em background, mas a tela ainda lê o texto antigo. Valida que os fatos batem.
- **Fase 2 — Leitura derivada + detector novo.** Perfil e relatório passam a ler a **visão derivada**; detector de conflito para de dar falso-positivo (conceito+contexto); UI redesenhada (itens 6-7).
- **Fase 3 — Reconciliação 4 níveis.** Autoatualização segura (N1), conciliação por contexto (N2), confirmação 1-toque com "depende da situação" (N3), revisão detalhada (N4).
- **Fase 4 — Aposentar o texto legado** como fonte de verdade (vira cache/derivado).

## 11. Decisões abertas

1. **Taxonomia canônica** — a Karina define o conjunto inicial de conceitos por área (é conteúdo clínico). Começar mínimo (comunicação + socialização + alimentação + regulação) e expandir.
2. **`perfil_vivo_membro`**: vira cache derivado ou é aposentado? (Recomendo: vira cache na Fase 2, aposenta na Fase 4.)
3. **Backfill**: rodar pra todas as famílias de uma vez ou por família sob demanda? (Recomendo: sob demanda / gradual, dado o Supabase sensível.)
4. **Base legal / consentimento** (LGPD): revisar antes da Fase 3 (quando o perfil passa a influenciar mais decisões).
