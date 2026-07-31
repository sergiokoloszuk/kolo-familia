# Prompt mestre — Memória Longitudinal da Kolo

> **Referência permanente.** Este documento estabelece a arquitetura, os
> princípios, os limites e a sequência oficial de implementação da memória
> longitudinal. Vale para todas as rodadas seguintes.
>
> Em cada rodada será informada explicitamente **qual fase** executar. Não
> execute fases posteriores por antecipação. Não redesenhe decisões já
> consolidadas sem uma razão técnica concreta baseada no código real.

## Estado das fases

| Fase | Situação | Onde |
| --- | --- | --- |
| 1 — Fact Store em modo sombra | **concluída** (commit `81aa526`) | `0073_perfil_fatos.sql`, `lib/kolo-vivo/fatos/`, `docs/memoria-viva-fact-store.md` |
| 2 — Auditoria da implementação | pendente | — |
| 3 — Auditoria de fatos reais | pendente (depende de a flag ficar ligada por alguns dias) | — |
| 4 — Correção da extração | pendente | — |
| 5 — Retrato em modo sombra | pendente | — |
| 6 — Comparação Retrato × perfil antigo | pendente | — |
| 7 — Vitalidade e maturação | pendente | — |
| 8 — Escopos completos (Neuro Copa) | pendente | — |
| 9 — Resumo Ativo | pendente | — |
| 10 — Troca gradual da leitura | pendente | — |
| 11 — Interlocutor e audiência | pendente | — |
| 12 — Mapa de Conhecimento Esperado | pendente | — |
| 13 — Estratégias | pendente | — |
| 14 — Deliberação | pendente | — |

Débitos conhecidos da Fase 1, a tratar na Fase 2:

- o caminho do **diário** (`incorporar.ts` → `aplicarItensNoMembro`) ainda não
  tem escrita sombra;
- o conceito é derivado como `dominio.subcampo` — grosseiro de propósito,
  marcado por `extractor_version = kv-blob-v1`;
- as três implementações de escrita no perfil (`aplicar.ts`,
  `orchestrator.ts`, `incorporar.ts`) continuam separadas.

---

# 1. Objetivo do sistema

A Kolo deve acompanhar uma pessoa durante muitos anos. O objetivo não é guardar
conversas. O sistema deve preservar, ao longo do tempo: o que foi relatado;
quando; quem relatou; em qual contexto; com qual grau de confirmação; o que
mudou; o que permanece atual; o que deixou de ser relevante; quais estratégias
foram testadas; quais objetivos estão ativos; quais hipóteses seguem abertas.

Esse conhecimento alimenta conversas da Ayla, relatórios, escola, profissionais,
estratégias, evolução e inteligência de produto — **sem múltiplas fontes
concorrentes de verdade**.

---

# 2. Diagnóstico técnico consolidado

O repositório tem o Perfil Vivo v1: `perfil_vivo_membro`, blobs `jsonb` por
domínio, informação incorporada por concatenação de texto.

Problemas identificados: ausência de fatos atômicos, de data por informação, de
proveniência individual, de interlocutor, de escopo, de status temporal e de
status de verificação; impossibilidade de reconstrução histórica; hipótese e
fato tratados igual; evento isolado podendo virar característica permanente;
duplicação entre `lib/kolo-vivo/aplicar.ts` e `lib/kolo-vivo/incorporar.ts`;
fila de sugestões existente mas contornada pelo fluxo principal; Neuro Copa sem
representação de campanha; coluna de idade legada convivendo com derivação por
data de nascimento.

O Perfil Vivo v2 está documentado (`docs/perfil-vivo-fatos-versionados.md`) e
não foi implementado substancialmente.

---

# 3. Arquitetura consolidada

**3.1 Conversa bruta** — mensagem original e contexto do turno. É a evidência
original e **não** é substituída pela extração estruturada.

**3.2 Candidato a fato** — interpretação estruturada produzida pelo sistema.
Ainda pode conter erro. Preserva origem, mensagem, pessoa acompanhada,
interlocutor, data, contexto, versão do extrator e confiança da extração.

**3.3 Fact Store** — a fonte de verdade acumulada e irreproduzível sobre a
pessoa. Cada fato é atômico, datado, rastreável, auditável, associado à origem,
corrigível **por supersessão, nunca por destruição**, e separado de
interpretações derivadas. Não é resumo, não é perfil narrativo, não é dashboard.

**3.4 Retrato** — quem a pessoa parece ser hoje, segundo as evidências.
Projeção derivada, **sem estado próprio como fonte de verdade**. Cache é
permitido desde que *apagar todo o cache não cause perda de conhecimento*.

**3.5 Resumo Ativo** — o recorte do Retrato usado numa conversa específica:
contextual, estruturado, **orçado**, filtrado por relevância, interlocutor e
audiência. Não é memória permanente.

**3.6 Mapa de Conhecimento Esperado** — conhecimento curado sobre o que importa
saber numa fase/contexto. Distingue bem conhecido, parcialmente conhecido,
antigo, pouco conhecido, não explorado e não aplicável. **A lacuna informa a
Deliberação; não ordena que uma pergunta seja feita.**

**3.7 Deliberação** — decide como agir: acolher, investigar, orientar, sugerir
estratégia, pedir confirmação, produzir material, gerar relatório, declinar com
utilidade, atualizar objetivo. Consome o Resumo Ativo. **Não** organiza memória,
não corrige fatos, não calcula vitalidade, não reconcilia contradições, não
decide proveniência, não constrói o Retrato.

---

# 4. Separação entre repositórios

Memória da pessoa · conhecimento clínico e educacional curado (BIA, Boas
Práticas, Mapa) · estratégias individuais · repertório de estratégias da
plataforma · Inteligência de Produto · conhecimento operacional.

**A memória individual nunca escreve automaticamente conhecimento clínico.**
Dados agregados geram sinais para investigação, não recomendações clínicas.

---

# 5. Natureza dos fatos

`event · pattern · trait · preference · ability · trigger · support · goal ·
tested_strategy · milestone`

Taxonomia pequena e extensível. Na dúvida, a classificação mais conservadora.

> **Regra obrigatória:** um evento isolado nunca se transforma automaticamente
> em traço, padrão ou tendência.

---

# 6. Status epistemológico

`reported · observed · inferred · confirmed · uncertain · contested`

Relato da família não é observação clínica. Interpretação da IA é `inferred`.
Hipótese não confirmada não aparece como verdade. **Silêncio da família não é
confirmação.** Recomendação da Ayla não é fato sobre a pessoa. Resposta
produzida pela Ayla não vira memória da pessoa.

---

# 7. Tempo e vitalidade

**Confiança** = quanto acreditamos que está correto.
**Vitalidade** = quanto acreditamos que ainda está atual.

A confiança **não** cai só pela passagem do tempo. A vitalidade pode cair, e o
comportamento temporal varia por tipo: interesse perde vitalidade rápido;
preferência muda; estratégia deixa de funcionar; sensibilidade exige mais
evidência para ser rebaixada; diagnóstico não expira por silêncio; alergia e
risco crítico exigem revisão explícita; objetivo é encerrado explicitamente.

---

# 8. Maturação

Fora do caminho crítico sempre que possível.

**Promoção** com evidência nova: `observação → recorrência → padrão → possível
traço`. **Rebaixamento** pode depender de tempo e ausência de reforço — e como
ausência não gera evento, exige processamento agendado.

Toda promoção ou rebaixamento preserva regra aplicada, evidências, data, versão
do cálculo e capacidade de auditoria.

---

# 9. Escopos

`context · campaign · school · professional · life_phase · conversation`

Fato com escopo temporário não vira característica permanente automaticamente.

**Neuro Copa (caso obrigatório):** durante, `escopo_tipo = campaign`,
`escopo_id = neuro-copa`. Ao final o fato **não é apagado**, permanece no
histórico, **sai da projeção padrão**, e só amadurece fora da campanha se
receber evidência independente.

---

# 10. Interlocutor e audiência

Distinguir mãe, pai, cuidador, professor, terapeuta, profissional, pessoa
acompanhada e indefinido. O interlocutor compõe a proveniência; a audiência
define quem pode receber cada informação.

**A filtragem de audiência acontece antes de o conteúdo chegar ao modelo
gerador.** Não confiar em prompt para proteger informação sensível.

Antes de a pessoa acompanhada conversar diretamente com a Ayla, precisam
existir: identificação do interlocutor, classificação de audiência, filtro
técnico e testes de segurança.

---

# 11. Fase da vida

A data de nascimento é o dado cronológico principal; idade e fase são
derivadas. Sem enums rígidos espalhados. Derivar traços: registro linguístico,
autonomia esperada, participação da pessoa, recursos aplicáveis, expectativas de
suporte. Autonomia funcional pode sobrepor a expectativa cronológica.

**Não tratar adulto neurodivergente como criança por dependência funcional.**

---

# 12. Tendências

Calculadas a partir de evidências numa janela, nunca armazenadas como verdade.

`improving · stable · declining · variable · insufficient_evidence`

Toda tendência informa janela, número de evidências, contextos, fontes,
confiança e versão do cálculo. O padrão pode ser `insufficient_evidence`. **Uma
única observação não gera seta de evolução.**

---

# 13. Princípios de implementação

Incremental, reversível, observável, testável, compatível com produção, atrás de
feature flag quando afetar comportamento, em commits pequenos. Evitar Big Bang.

> escrever primeiro · comparar depois · ler por último

---

# 14. Regras de segurança (bloqueadores de release)

1. Resposta da Ayla não vira fato sobre a pessoa.
2. Hipótese não aparece como fato confirmado.
3. Informação de outra pessoa não é associada ao perfil errado.
4. Informação de cuidador não é revelada indevidamente à pessoa acompanhada.
5. Texto sensível não aparece em logs.
6. Falha de memória não quebra o turno.
7. Toda informação relevante possui proveniência.
8. A extração estruturada não substitui a mensagem original.

---

# 15. O que não construir

Digital Twin persistido · Modelo Vivo com estado próprio · Retrato persistido
como segunda fonte · resumo narrativo materializado · tendência a partir de
evento isolado · porcentagem rígida de completude para a família · aprendizado
clínico automático · reconciliação automática de contradições · backfill
agressivo de blobs · enum rígido de fase da vida · privacidade só por prompt.

---

# 16. Sequência oficial de fases

1. **Fact Store em modo sombra** — migration, tipos, serviço único, flag,
   escrita paralela, idempotência, proveniência, escopo, testes,
   observabilidade. A leitura atual não muda.
2. **Auditoria da implementação** — migration, índices, serviço, integrações,
   cobertura, flag, falhas, logs, rollback, duplicação entre caminhos.
3. **Auditoria de fatos reais** — atomicidade, origem, conceito, classificação,
   pessoa correta, contexto, duplicidade, inferência, recomendações gravadas
   indevidamente.
4. **Correção da extração e validação** — sem aumentar chamadas de IA sem
   justificativa técnica.
5. **Retrato em modo sombra** — motor de projeção derivado e versionado, sem
   alterar respostas.
6. **Comparação Retrato × perfil antigo** — equivalência, perdas, contradições,
   informação antiga, qualidade, custo, latência.
7. **Vitalidade e maturação** — promoção, rebaixamento, silêncio, regras por
   natureza, **relógio injetável**, testes longitudinais.
8. **Escopos completos** — encerramento e filtragem de campanhas, escolas,
   professores, terapias, fases, contextos. Neuro Copa é teste obrigatório.
9. **Resumo Ativo** — recorte contextual, orçado, filtrado, estruturado.
10. **Troca gradual da leitura** — por flag, canal, grupo, ambiente, com
    rollback para o perfil antigo.
11. **Interlocutor e audiência** — proteção técnica antes do modelo.
12. **Mapa de Conhecimento Esperado** — curado e versionado; lacunas informam.
13. **Estratégias** — testada individualmente × repertório curado × sinal
    agregado × conhecimento aprovado.
14. **Deliberação** — só depois de memória e contexto confiáveis.

---

# 17. Regra de execução de cada rodada

Cada rodada informa: **FASE A EXECUTAR · OBJETIVO · ARQUIVOS OU ÁREAS
PRIORITÁRIAS · RESTRIÇÕES ADICIONAIS · CRITÉRIOS DE CONCLUSÃO.**

Execute apenas a fase indicada. Antes de alterar código: inspecione o
repositório, confirme os caminhos reais, apresente um resumo curto da
abordagem, identifique riscos, e então implemente.

**Não interrompa para pedir confirmação quando o código permitir resolver a
dúvida.** Tome a melhor decisão técnica conservadora e documente a escolha.

---

# 18. Formato de entrega de cada fase

Resumo executivo · decisões tomadas · arquivos alterados · migrations ·
contratos · integrações · testes · resultado da suíte · observabilidade · riscos
restantes · rollback · commits · itens deixados para fases posteriores.

---

# 19. Pergunta obrigatória ao final de cada fase

> Esta fase está suficientemente segura para avançar para a próxima?

Responder **sim** / **sim, com ressalvas** / **não**, justificando com
evidências do código e dos testes.

**Uma fase não está concluída só porque o código compila.**
