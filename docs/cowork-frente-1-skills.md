# Frente 1 — Reescrever 11 skills com voz v3

## Estado atual no DB

Existem **14 skills** no banco de dados:

### 7 ativas (precisam ser reescritas com voz v3)

Estão funcionando no app, mas com conteúdo do PRD original (antes da calibração de tom):

- `sensorial`
- `comunicacao`
- `regulacao_emocional`
- `sono`
- `transicoes`
- `comportamento_e_limites`
- `meu_bem_estar` (skill especial — fala com a mãe sobre o bem-estar dela mesma)

### 7 em rascunho (esqueleto criado, sem conteúdo real)

`ativo=false` no DB. Foram criadas pelo Sérgio com placeholders durante a implementação do schema. Precisam de conteúdo verdadeiro antes de virarem ativas:

- `socializacao`
- `imitacao`
- `motor`
- `autonomia`
- `aprendizado`
- `foco`
- `nutricional`

A skill **Emocional** já tem versão v3 finalizada — está no documento `05_PROMPT_SKILL_EMOCIONAL_v3.md`. É a **referência canônica** para as outras 11.

---

## O que cada skill precisa ter

As 11 skills são **variações do template Emocional v3**. A maior parte da estrutura é compartilhada:

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
- `routing_priority` — 50-85 normalmente (mais alto = mais prioridade quando há ambiguidade)
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
routing_priority: [50-85]
fallback_questions:
  - [pergunta 1]
  - [pergunta 2]
  - [pergunta 3]
  - [pergunta 4]
```

---

## Sugestão de ordem (por valor e proximidade da Emocional)

A Karina pode mudar essa ordem. A lógica é começar pelas mais próximas da Emocional (ganho de momentum) e pelas mais valiosas para mãe de TEA (público inicial).

1. `regulacao_emocional` — quase prima da Emocional, transição suave
2. `comunicacao` — alta prioridade para mãe de TEA
3. `sensorial` — alta prioridade para mãe de TEA
4. `socializacao` — nova, importante para TEA
5. `comportamento_e_limites` — geral, todas as mães
6. `sono` — alta dor diária
7. `transicoes` — alta dor diária
8. `autonomia` — nova
9. `foco` — nova, relevante para mãe de TDAH
10. `motor` — nova
11. `imitacao` — nova, mais técnica
12. `nutricional` — nova
13. `aprendizado` — nova
14. `meu_bem_estar` — pra mãe (skill especial, tom diferente)

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

Algumas regras importantes que valem para todas as 11 skills:

- **Sem nomes de método na resposta** — PNL, Joe Dispenza, REAC nunca aparecem. A técnica entra dissolvida.
- **Sem citar autores** — Siegel, Bryson, Greene, Delahooke, Prizant, Grandin, Shanker, Barkley nunca aparecem na resposta. Pode aparecer no campo "Origem" (uso interno).
- **Sem performar empatia** — "querida mãe", "compreendo perfeitamente", "que situação delicada" estão proibidos como abertura.
- **Sem clichês de maternidade** — guerreira, supermãe, sua tribo, jornada da maternidade.
- **Sem clichês corporativos** — transformação, revolução, destrave.
- **Hipóteses, não causa** — "uma hipótese é", "às vezes acontece de", nunca "ela está sentindo X" como se a skill soubesse.

O Validador do app pega esses vetos automaticamente — se a skill escapar deles na resposta, regenera. Mas evitar de saída economiza tokens e mantém a coerência.
