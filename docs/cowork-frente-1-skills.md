# Frente 1 — Reescrever 11 skills com voz v3

> **Atualizado em 2026-05-17** (devolutiva da Karina aplicada no DB):
> - `regulacao_emocional` foi renomeada para `emocional`
> - `transicoes` foi renomeada para `rotina`
> - `comportamento_e_limites` foi **desativada** (cobertura pulverizada nas outras)
> - `meu_bem_estar` ficou com `routing_priority=0` — não é roteada pela LLM, só acessível por entrada explícita da mãe no app

## Estado atual no DB

Existem **12 skills** úteis no banco. `comportamento_e_limites` está inativa e não entra na curadoria.

### 6 ativas (precisam ser reescritas com voz v3)

Estão funcionando no app, mas com conteúdo do PRD original (antes da calibração de tom):

- `sensorial`
- `comunicacao`
- `emocional` *(ex-`regulacao_emocional`)*
- `sono`
- `rotina` *(ex-`transicoes`)*
- `meu_bem_estar` (skill especial — fala com a mãe sobre o bem-estar dela mesma; nunca roteada por LLM, só via entrada explícita no app)

### 6 em rascunho (esqueleto criado, sem conteúdo real)

`ativo=false` no DB. Foram criadas pelo Sérgio com placeholders durante a implementação do schema. Precisam de conteúdo verdadeiro antes de virarem ativas:

- `socializacao`
- `imitacao`
- `motor`
- `autonomia`
- `aprendizado`
- `foco`
- `nutricional`

> Obs: `comportamento_e_limites` continua na tabela como `ativo=false` por compatibilidade histórica. **Não reescrever** — o tema é tratado dentro de `emocional`/`rotina`/skills específicas conforme o caso.

A skill **Emocional** já tem versão v3 finalizada — está no documento `05_PROMPT_SKILL_EMOCIONAL_v3.md`. É a **referência canônica** para as outras 10 (excluindo `meu_bem_estar`, que tem tom próprio).

---

## O que cada skill precisa ter

As skills ativas/rascunho são **variações do template Emocional v3**. A maior parte da estrutura é compartilhada:

**Compartilhado (não precisa reescrever a cada skill):**
- Anatomia da resposta-base (180-300 palavras em 4 partes: abertura direta, leitura técnica, orientação prática, selo)
- Os 5 elementos do Nível 2 (coleta com 1 pergunta, crença com gancho, frase pronta, convite ao botão, sugestão de registro)
- Paleta de 6 famílias de imagens
- Vetos absolutos (já no validador, automático)
- Glossário de tradução

**Específico por skill (é o que a Karina vai escrever):**
- `objective` — 1 frase com o que a skill faz
- `tone` — Camada 2 padrão, com nuances específicas dessa área
- `scope` — o que a skill cobre
- `limits` — o que ela NÃO faz (sempre inclui "não diagnostica, não prescreve")
- `kolo_vivo_fields` — quais gavetas do Kolo Vivo ela lê (Sérgio já configurou no commit `a73a236`)
- `routing_keywords` — 8-15 palavras-chave em PT-BR que ativam a skill no roteador
- `routing_priority` — 50-85 normalmente (mais alto = mais prioridade quando há ambiguidade). `meu_bem_estar` fica em `0` por decisão da Karina.
- `fallback_questions` — exatamente 4 perguntas para manter conversa aberta quando a skill não tem certeza

**Específico por skill (conteúdo livre, para a Karina escrever em prosa):**
- Identidade da especialista — "Você é a especialista em [área] do Kolo Família..."
- Como pensa nesta área especificamente — princípios próprios
- Vetos específicos desta área (além dos universais)
- Repertório de tom — expressões "Jeito Kolo" próprias desta skill
- Quando encaminhar para profissional humano (TO, fono, neuropsi, nutri etc dependendo da área)

---

## Template de entregável por skill

Um arquivo `.md` por skill no seguinte formato (espelhando o `05_PROMPT_SKILL_EMOCIONAL_v3.md`):

```markdown
# Skill [Nome] — Prompt v3

**Versão:** 3
**Data:** [data]

## Você é

[3-4 parágrafos de identidade da especialista — quem é, com quem fala, postura]

## Como você pensa

[Princípios epistêmicos específicos desta área. Hipóteses não causa,
função do comportamento, agência da mãe. Pode reutilizar muito do
template Emocional]

## Como você escreve

[Estilo específico — pode reutilizar do template]

## Estrutura da resposta

[Anatomia em camadas — pode reutilizar do template]

## Personalização via KoloVivo

[Como usar nome, idade, perfil. Que gavetas específicas desta skill ler:
{kolo_vivo_fields da skill no DB}]

## Vetos absolutos

[Vetos universais + vetos específicos desta área]

## Repertório de tom

[Expressões "Jeito Kolo" próprias desta skill]

## Quando você não é a skill certa

[Encaminhamento pra outras skills + pra profissional humano]
```

Mais os campos estruturados que vão para a tabela `specialist_prompt_templates`:

```yaml
name: [nome técnico, snake_case]
display_name: [2-4 palavras pra mostrar em UI]
objective: [1 frase]
tone: [parágrafo curto]
scope: [parágrafo]
limits: [parágrafo]
kolo_vivo_fields: [array — já configurado pelo Sérgio]
routing_keywords: [array de 8-15 strings]
routing_priority: [50-85, ou 0 para meu_bem_estar]
fallback_questions:
  - [pergunta 1]
  - [pergunta 2]
  - [pergunta 3]
  - [pergunta 4]
```

---

## Sugestão de ordem (por valor e proximidade da Emocional)

A Karina pode mudar essa ordem. A lógica é começar pelas mais próximas da Emocional (ganho de momentum) e pelas mais valiosas para mãe de TEA (público inicial).

1. `emocional` *(ex-`regulacao_emocional`)* — referência canônica, já v3
2. `comunicacao` — alta prioridade para mãe de TEA
3. `sensorial` — alta prioridade para mãe de TEA
4. `socializacao` — nova, importante para TEA
5. `sono` — alta dor diária
6. `rotina` *(ex-`transicoes`)* — alta dor diária
7. `autonomia` — nova
8. `foco` — nova, relevante para mãe de TDAH
9. `motor` — nova
10. `imitacao` — nova, mais técnica
11. `nutricional` — nova
12. `aprendizado` — nova
13. `meu_bem_estar` — pra mãe (skill especial, tom diferente, não roteada por LLM)

---

## Como entregar para o Sérgio

3 opções, escolher a que for mais prática:

### A. Direto na UI do admin (mais rápido)

1. Karina já tem acesso de admin em `https://kolo-familia-web.vercel.app/admin`
2. Acessa `/admin/skills/[id]` (uma página por skill)
3. Cola os campos: objective, tone, scope, limits, keywords, fallback
4. Salva — vira ativa quando aprovado

### B. Arquivos `.md` e Sérgio importa

1. Karina gera um arquivo `.md` por skill no formato do template
2. Envia para o Sérgio
3. Sérgio roda script que parseia e popula o DB

### C. Híbrida (recomendado para volume)

1. Gerar tudo no Cowork em batch (arquivos `.md` numa pasta)
2. Sérgio importa em lote
3. Karina revisa no `/admin/skills` e ativa uma por vez

Combinar com o Sérgio antes de começar.

---

## Vetos que se aplicam (não esquecer)

Algumas regras importantes que valem para todas as skills:

- **Sem nomes de método na resposta** — PNL, Joe Dispenza, REAC nunca aparecem. A técnica entra dissolvida.
- **Sem citar autores** — Siegel, Bryson, Greene, Delahooke, Prizant, Grandin, Shanker, Barkley nunca aparecem na resposta. Pode aparecer no campo "Origem" (uso interno).
- **Sem performar empatia** — "querida mãe", "compreendo perfeitamente", "que situação delicada" estão proibidos como abertura.
- **Sem clichês de maternidade** — guerreira, supermãe, sua tribo, jornada da maternidade.
- **Sem clichês corporativos** — transformação, revolução, destrave.
- **Hipóteses, não causa** — "uma hipótese é", "às vezes acontece de", nunca "ela está sentindo X" como se a skill soubesse.

O Validador do app pega esses vetos automaticamente — se a skill escapar deles na resposta, regenera. Mas evitar de saída economiza tokens e mantém a coerência.
