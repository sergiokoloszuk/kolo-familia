# Ayla — duas camadas convivendo

A Ayla tem duas gerações de arquitetura coexistindo neste módulo. Esse README
explica como elas se relacionam.

## Camada v1 — Ayla transacional (PRD §12, em produção)

Arquivos no nível raiz deste módulo. Sistema **template-based** + parser IA:

- `orchestrator.ts` — `sendRotinaDiaria`, `sendBoasVindas`, `sendEngajamento`,
  `sendTrial`, `sendEmocionalStreak`, `sendProximoInsight`, `sendCampanha`,
  `processInbound`
- `rules.ts` — regras duras (consentimento, 2 proativas/dia, comercial pós-crise,
  silêncio 10d)
- `parser.ts` — parser IA inbound (Anthropic)
- `messageTemplates.ts` — templates determinísticos
- `whatsappSender.ts` — integração Z-API
- `anthropic.ts` — cliente Anthropic
- `insightEngine.ts` — geração de insights
- `metrics.ts` — telemetria
- `types.ts` — vocabulário operacional (`AylaCategoria`, `AylaTipoProativa`,
  `AylaTipoReativa`, `ParserResult`, `Comando`)

**Status**: em produção, suportando WhatsApp + parser + templates +
sugestões de Kolo Vivo. **Não tocar sem necessidade**.

## Camada v2 — Manual Operacional (esta fase, fundação apenas)

Subdiretório `manual/`. Arquitetura comportamental derivada do **Manual
Operacional da Ayla v2** (documento externo de Karina).

Em vez de templates + tipos transacionais, esta camada define:

- **5 modos operacionais** (acolhimento / orientação / investigação / follow-up /
  registro) que a Ayla alterna dinamicamente conforme contexto
- **Classifier contextual** (intent, estado emocional, intensidade, urgência,
  domínio, necessidade principal)
- **Guardrails de linguagem** (anti-genérico, anti-coaching, anti-robótico)
- **Memória longitudinal** (eventos, padrões hipotéticos, sugestões revisáveis)
- **Política de proatividade** (regras de silêncio, cadência adaptativa)
- **Separação canal** (WhatsApp conversa / app jornada)

**Status**: **fundação apenas** — tipos, regras como dado, contratos. **Nenhuma
chamada LLM ou DB acontece nesta camada ainda**. A implementação real virá
em fases futuras quando começarmos a migrar comportamentos do v1 pro v2.

Ver `manual/README.md` pra detalhes.

## Como as duas camadas se relacionam

Hoje: convivem **lado a lado, sem interferência**. O v1 continua atendendo
WhatsApp em produção; o v2 é fundação que define o vocabulário e o desenho
pra evolução.

Futuro: cada comportamento do v1 (ex: `sendRotinaDiaria`) será refatorado pra
usar o motor do v2 — classifier decide modo → política decide se envia →
composer gera texto seguindo guardrails — mantendo as regras duras do v1
(consentimento, 2/dia, silêncio 10d) como invariantes.

A tabela `ayla_messages` continua sendo o append-only oficial.
`sugestao_perfil_vivos` continua sendo o único caminho pra mutar perfil.

## Princípios não-negociáveis (válidos pras duas camadas)

1. **A mãe é sujeito ativo** — a Ayla nunca afirma como diagnóstico. Sugere,
   interpreta, oferece.
2. **Sem mutação silenciosa do perfil** — toda inferência sobre a criança vira
   `sugestao_perfil_vivos` revisável.
3. **Hierarquia operacional** — Regular → Interpretar → Orientar → Aprofundar →
   Registrar.
4. **Linguagem humana** — não coaching, não positividade tóxica, não tom
   robótico, não dramatização.
5. **Saber desaparecer** — reduz interação em sinais de sobrecarga.
6. **WhatsApp é conversa, app é jornada** — o app não é grande chat.

## Próximas fases (planejadas, não implementadas)

1. **Bridge v1↔v2**: extrair regras de `rules.ts` como invariantes que o motor
   v2 herda
2. **Classifier ativo**: substituir o parser determinístico de `processInbound`
   pelo classifier rico do v2 (Haiku 4.5)
3. **Composer com modos**: o atual `montarAcolhimento + montarOrganizacao + acao`
   vira gerador modal (Sonnet 4.7) com seleção dinâmica de modo
4. **Memória longitudinal**: alimentar `ayla_eventos_longitudinais` a partir do
   stream de `ayla_messages` + `diarios` + `check_ins_diarios`
5. **Padrões emergentes**: cron semanal preenche `ayla_padroes` derivados de
   eventos
