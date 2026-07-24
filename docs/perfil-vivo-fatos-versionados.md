# Perfil Vivo v2 — fatos versionados, proveniência e visão derivada

> **v2 (24/07) — incorpora a revisão do ChatGPT** (5 correções obrigatórias no fim). Norte: o Perfil Vivo NÃO busca uma "verdade textual" única apagando registros. Mantém **fatos datados, com contexto e proveniência**, **calcula** um estado atual, e apresenta divergências **agrupadas por conceito**. A IA atualiza automaticamente só evoluções explícitas e diferenças contextuais de alta confiança, **preservando histórico e auditabilidade**. Na ambiguidade real, propõe reconciliação simples pra a família confirmar (incluindo **"depende da situação"**). **Nunca** exclui silenciosamente nem substitui um fato sem registrar origem, versão e motivo.
>
> **Ressalva (ChatGPT):** somos **inspirados nos princípios de proveniência do FHIR** (registrar agentes, momentos e entidades de cada criação/revisão) — **não** implementamos prontuário nem conformidade FHIR.
>
> **Princípio-síntese:** *a mesma habilidade pode variar por contexto sem que exista contradição* — igual ao próprio neurodesenvolvimento (a criança não é uma descrição fixa; as habilidades aparecem diferente conforme ambiente, segurança, demanda, pessoas e momento).

---

## 1. O problema

Hoje o perfil guarda **texto consolidado por área** (`perfil_vivo_membro`: um blob por domínio), misturando **estado atual + contexto + histórico** num lugar só. Sintomas no perfil da Manu: contradições empilhadas ("mais falante" ao lado de "não verbaliza"), **falsos positivos** ("chega quieta" ≠ "ama conversar"; "fala em casa" ≠ "na escola" = variação de contexto), duplicação (comunicação em 5 áreas), tela punitiva ("56%", 4 alertas, "dispensar").

## 2. Modelo de dados — o fact-store

**O fato ORIGINAL é imutável.** Mudanças de estado/validade/interpretação vão em **campos de controle** (não sobrescrevem o conteúdo capturado). Começamos pela **opção simples** (atualizar só controle); a opção rigorosa (tabela `perfil_fato_eventos` separada) fica pra depois — complexidade demais agora.

Tabela **`perfil_fatos`**:

```
-- IMUTÁVEIS (nunca sobrescrever depois de criados):
  id                 uuid pk
  family_account_id  uuid
  membro_atipico_id  uuid
  conceito           text     -- chave canônica ("comunicacao.fala_expressiva")
  area               text     -- área de exibição, p/ agrupar
  afirmacao          text     -- o fato em 1 frase ("conta acontecimentos da escola")
  contexto           text     -- "em casa" | "na escola" | "quando ansiosa" | null
  fact_kind          text     -- trait|pattern|preference|trigger|support|skill|
                              --   event|milestone|concern|clinical_information
  -- tempo do ACONTECIMENTO (a mãe raramente sabe a data — NÃO forçar precisão):
  observado_em       date null
  observado_em_preciso boolean default false
  tempo_original     text null -- a expressão crua: "desde a troca de professora"
  -- proveniência (tipo + AUTOR separados):
  source_type        text     -- caregiver_report|child_report|professional_report|
                              --   document|system_inference|direct_observation
  source_actor_label text null -- "mãe" | "professora" | "fono" | ...
  source_actor_id    uuid null
  registrado_em      timestamptz default now()
  origem_detalhe     jsonb    -- conversa_id, mensagem, canal (whatsapp/web)

-- CONTROLE (podem mudar — registram estado/revisão, não reescrevem o fato):
  temporal_status    text     -- current | historical | unknown
  verification_status text    -- asserted | inferred | confirmed | disputed | uncertain
  confianca          numeric  -- 0..1 (FILTRO, nunca decisão sozinha)
  superseded_by_id   uuid null
  superseded_at      timestamptz null
  reviewed_at        timestamptz null
  review_reason      text null
  -- migração (fatos vindos do texto legado ficam marcados e isolados):
  migration_batch_id uuid null
  legacy_source_id   text null
  migration_status   text null -- proposed | validated | rejected
```

**Por que separar `temporal_status` de `verification_status` (correção 1):** um fato pode ser *histórico e confirmado*, *atual e incerto*, *substituído mas ainda importante no histórico*. Ex.: *"não verbalizava em maio"* = `temporal_status=historical` + `verification_status=asserted` (não virou "falso"). *"a IA inferiu que fala menos quando ansiosa"* = `current` + `inferred`.

**REGRA DE OURO (correção 2):** **evento isolado NÃO atualiza o retrato atual automaticamente.** *"Chegou cansada e não quis conversar hoje"* é um `event` — vai pra timeline ou fica como evidência, e só vira `pattern`/`trait` do conceito quando há **recorrência** ou **declaração explícita de padrão** pela família.

## 3. Camada canônica de habilidades — começar MENOR

Conceitos transversais que as áreas **referenciam** (não copiam). Começar **só pelos que já causam conflito real** (correção do ChatGPT — não modelar os 16 domínios na v1):

- **Comunicação:** modalidade predominante · formação de frases · narrativa · fluência · comunicação por contexto.
- **Socialização:** iniciativa · resposta ao convite · participação em grupo · preferência por adultos/crianças.
- **Regulação:** gatilhos · sinais iniciais · impacto da desregulação na comunicação · estratégias que ajudam.
- **Alimentação:** aceitos · recusados · textura · cheiro · apresentação/separação.

A taxonomia **não é só "conteúdo clínico"**: a Karina define o significado funcional, mas **produto + engenharia definem junto** granularidade, estados possíveis, contexto, evidências necessárias, e **quais conceitos permitem atualização automática**.

## 4. Incorporação (os 2 canais escrevem FATOS) — os 4 níveis com TRAVAS objetivas

Os extratores (WhatsApp + web) emitem **fatos** (conceito, afirmacao, contexto, fact_kind, source_type/actor, tempo aproximado, confianca). A gravação passa pelos 4 níveis — **a confiança numérica é filtro adicional, nunca a decisão sozinha (correção 3):**

**Nível 1 — Autoatualização segura.** Só quando **TODAS** forem verdadeiras: mesmo conceito; fonte é **declaração explícita** da responsável ou documento confiável; marcador claro de mudança ("antes/agora", "passou a", "não faz mais"); sem negação ambígua; **NÃO** envolve medicação/alergia/diagnóstico/risco/dado clínico crítico; registro anterior preservado; reversível; origem salva. Ação: novo fato `current`, antigo `historical` (+`superseded_by_id`), marco na timeline, **sem alerta**.

**Nível 2 — Conciliação por contexto.** Só quando os contextos forem **explicitamente diferentes**. NÃO inferir contexto só porque as frases vieram de áreas diferentes. Ex.: *"ama conversar em casa"* + *"na escola fica quieta"* → visão conciliada, sem alerta.

**Nível 3 — Confirmação de 1 toque.** Provável evolução, faltando data/contexto — e **só quando a resposta limpar VÁRIOS registros** (evitar mini-confirmações o tempo todo). Sempre com **"depende da situação"**.

**Nível 4 — Revisão detalhada (propõe, não aplica).** Relatório/estratégia/terapeuta + **diagnóstico, regressão, violência/negligência, direitos e decisões escolares, e qualquer info que possa mudar recomendações importantes** + saúde/medicação/alergia/risco.

## 5. Visão atual derivada — ESTRUTURA antes da narrativa (correção 4)

Não gerar um parágrafo por LLM toda vez (trocaria um drift por outro). **Duas camadas:**

1. **Camada estruturada** (a verdade): `fala_expressiva: { current_level: "frases_em_contextos_familiares", variability: "reduz_quando_ansiosa", previous_level: "palavras_soltas", confidence: 0.86 }`.
2. **Camada narrativa** (só redação): a LLM **traduz** a estrutura → *"A Manu já consegue formar frases e contar acontecimentos em algumas situações. Quando fica ansiosa ou em ambientes menos familiares, a comunicação pode diminuir."*

A **estrutura determina o significado; a LLM só a redação.** Reduz muito o risco de nova contradição na própria visão.

## 6. Detector de conflito — matar os falsos positivos

Só é conflito quando é **mesmo conceito + mesmo contexto + fontes comparáveis + realmente incompatível no tempo**. Diferença de **contexto**, **oscilação**, **evolução no tempo** ou **fontes/autores diferentes** ("mãe diz X, professora diz Y") → **NÃO é conflito** (é conciliação, N2). Agrupa por **conceito** (os 4 avisos de comunicação viram 1 revisão).

## 7. UI do Perfil (tirar o tom punitivo)

- Sem **"56% preenchido"** → "**9 áreas já conhecidas · 7 que podemos descobrir aos poucos**".
- Sem 4 alertas grandes → uma seção compacta agrupada por conceito: *"Alguns pontos pra revisar — algumas coisas podem ter mudado ou acontecer de formas diferentes conforme a situação."*
- **"Dispensar"** → *[As duas estão certas] [Isso mudou com o tempo] [Atualizar agora] [Revisar depois]* (cada escolha vira **dado** pro classificador).
- Revisão única por conceito, com **"depende da situação"** → ensina a mãe a observar e limpa vários campos de uma vez.

## 8. LGPD (redação ajustada pelo ChatGPT)

Os dados podem incluir informações **sensíveis** de saúde e desenvolvimento de crianças. O tratamento deve observar o **melhor interesse da criança**, **base legal adequada** (não necessariamente só consentimento — a ANPD admite hipóteses dos arts. 7º/11 observado o melhor interesse), **transparência reforçada**, **segurança**, e **mecanismos simples de acesso e correção**. Base legal, consentimentos e prazos de retenção **validados juridicamente**.

Requisitos de engenharia:
- **Nenhuma exclusão automática silenciosa.** Alterações comuns preservam histórico; pedidos de exclusão/encerramento seguem **política jurídica de retenção e eliminação** (a LGPD também prevê eliminação — "nunca apagar" absoluto seria problemático). Conciliar auditabilidade + correção + retenção necessária + direito à eliminação.
- Proveniência de cada fato; correção simples pela família; registro de toda alteração automática; explicabilidade; distinção **relato × inferência × documento**.

## 9. Backfill — ainda mais conservador

Fatos migrados do texto legado **não entram como fatos normais**. Recebem `migration_batch_id`, `legacy_source_id`, `migration_status: proposed`. Inicialmente **excluídos das automações sensíveis**: não geram conclusões importantes, não alteram relatórios críticos, não disparam atualização automática, não substituem fatos novos de maior qualidade. Alimentam a tela **em modo comparação** até validados. Gradual, lotes pequenos, logs, rollback. ⚠️ Supabase sensível a migração.

## 10. Fases de implementação

- **Fase de OBSERVAÇÃO (antes de tudo, sem tabela nova em prod).** Pegar 30-50 perfis reais e classificar à mão: quantos "conflitos" eram evolução × contexto × fontes diferentes × erro real; quais conceitos mais se repetem; o que era evento isolado; quais alertas realmente exigiam confirmação. **A taxonomia sai do uso real, não da teoria.**
- **Fase 0 — Fundação.** Taxonomia mínima (Karina + produto + eng) + schema `perfil_fatos` + helpers. **Revisão jurídica ANTES do dual-write** (a tabela já muda finalidade/retenção/proveniência).
- **Fase 1 — Dual-write.** Os 2 extratores gravam FATOS além do texto atual. Visão derivada calculada em background; tela ainda lê o legado. Valida que batem.
- **Fase 2 — Leitura derivada + detector novo + UI.** Perfil/relatório leem a visão derivada; detector para de dar falso-positivo; UI redesenhada.
- **Fase 3 — Reconciliação 4 níveis** (com as travas objetivas).
- **Fase 4 — Aposentar o texto legado** (vira cache; mantém um tempo como fallback de comparação).

## 11. Decisões abertas (respostas iniciais)

1. **Taxonomia:** Karina define o significado funcional; **produto + eng** definem granularidade, estados, contexto, evidências e o que permite auto-update. Sair da Fase de Observação.
2. **`perfil_vivo_membro`:** cache derivado na Fase 2, aposentado na Fase 4, mantido um tempo como fallback de comparação.
3. **Backfill:** gradual, por família ativa / no primeiro acesso, lotes pequenos, logs, rollback.
4. **Jurídico:** revisar **antes do dual-write** (Fase 0/1), não só antes da Fase 3.

## 12. As 5 correções obrigatórias (veredito do ChatGPT — todas aceitas)

1. **Separar** fato original de estado e verificação (`temporal_status` × `verification_status`).
2. **Evento isolado NÃO** vira característica da criança automaticamente (`fact_kind` + regra de recorrência).
3. **Não** depender da confiança numérica da LLM pra auto-reconciliação (travas objetivas no N1).
4. **Estrutura antes da narrativa** na visão derivada.
5. Trocar "nunca apagar fisicamente" por **política de histórico + eliminação juridicamente definida**.
