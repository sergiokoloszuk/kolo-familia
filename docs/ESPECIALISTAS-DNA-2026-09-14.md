# Os especialistas da Kolo e o DNA deles — 14/09/2026

| | |
|---|---|
| **Fonte** | `specialist_prompt_templates`, banco de produção, lido em 14/09 |
| **Total** | 14 especialistas · 13 ativos |
| **Escopo** | levantamento. Nada foi ligado, alterado ou publicado |

---

## 1. Onde eles estão, e quem os lê

A tabela tem exatamente os campos que a missão pediu para mapear:

`name` · `display_name` · `objective` · `tone` · `scope` · `limits` ·
`kolo_vivo_fields` · `knowledge_tags` · `routing_keywords` ·
`routing_priority` · `fallback_questions` · `versao` · `ativo`

### ⚠️ O achado que governa tudo: o DNA não alcança o canal principal

| quem lê | o que lê | canal |
|---|---|---|
| `lib/ia/prompt.ts` → `buildIdentityBlock` | **`objective` · `tone` · `scope` · `limits`** | **WEB** |
| `lib/ayla/catalogo-skills.ts` | apenas `name` + `routing_keywords` | **WhatsApp** |

`buildIdentityBlock` monta, para cada skill roteada:

```
## Skill N: <display_name>
- Objetivo: <objective>
- Tom: <tone>
- Escopo: <scope>
- Limites: <limits>
```

e injeta no prompt da **web**. O caminho experimental — que atende **todas** as
famílias no WhatsApp desde 17/08 — não injeta nada disso. Provado por ausência:
`grep -n "skillsBlock\|loadActiveSkills\|specialist" experimental.ts` volta
vazio.

**Ou seja:** a inteligência dos especialistas existe, está no banco, e chega ao
canal menor. `kolo_vivo_fields` e `fallback_questions` não são lidos por
nenhum dos dois.

---

## 2. A matriz

| especialista | prio | insumos (`kolo_vivo_fields`) | raciocínio (`objective`) | BP (`knowledge_tags`) | entrega | o que vale preservar |
|---|---|---|---|---|---|---|
| **aprendizado** | 65 | aprendizado · essencial · como_e | etapa do gargalo: reconhecer → recuperar → copiar → produzir → segmentar sons → sustentar | aprendizado, escola, leitura, escrita | próximo passo com apoio e redução gradual | decompor + reduzir apoio |
| **autonomia** | 60 | autonomia · essencial · corpo_rotina | achar a **menor ajuda necessária**, cadeia para frente/trás, uma camada por vez | autonomia, independencia | menor ajuda | *"progresso se mede por redução de suporte, não por faz/não faz"* |
| **foco** | 65 | foco · essencial · como_e | distinguir iniciar · sustentar · manter o fio · demanda · ambiente · movimento · transição | foco, atencao, hiperfoco | **a menor mudança testável** | *"sustentar no que gosta é dado, não prova de má vontade"* |
| **imitacao** | 60 | imitacao · essencial · como_e | achar onde a imitação **já** acontece e construir dali | imitacao, modelagem | brincadeira, não avaliação | *"começando por imitar a criança, não por 'faz igual'"* |
| **motor** | 60 | motor · essencial · corpo_rotina | qual componente funcional trava: estabilizar · segurar · força · planejar · coordenar · sustentar | motor, coordenacao, postura | brincadeira **com objetivo** | *"copiar bem e falhar no ditado é Aprendizado"* — diferencial cruzado |
| **nutricional** | 65 | nutricional · essencial · sensorial | barreira (textura/novidade/previsibilidade/marca/ambiente/permanência) + etapa da escada | nutricional, seletividade | **mover UM passo** | *"quase nunca começa em 'comer'"* |
| **socializacao** | 65 | socializacao · essencial · como_e | micro-habilidade: querer · entrar · permanecer · alternar · aceitar a ideia do outro · lidar com o "não" · encerrar | socializacao, pares | uma por vez, do que já funciona | *"ensina repertório, não jeito certo de ser"* |
| *comunicacao* | 60 | comunicacao · essencial · como_e | "apoiar comunicação verbal/não-verbal" | comunicacao, linguagem | frases prontas | — |
| *emocional* | 80 | desafios_regulacao · como_e | "apoiar leitura e regulação emocional" | regulacao, crise | estratégias aplicáveis | — |
| *rotina* | 60 | corpo_rotina · desafios_regulacao | "apoiar transições difíceis" | transicao, previsibilidade | ferramentas visuais | — |
| *sensorial* | 70 | sensorial · essencial · corpo_rotina | "entender e ajustar ambiente"; abre hipóteses | sensorial, ambiente | ajuste ambiental | *"abre hipóteses, não afirma causas"* |
| *sono* | 65 | sono · corpo_rotina · sensorial | "apoiar a higiene de sono" | sono, dormir | ajustes de ambiente | — |
| *meu_bem_estar* | 0 | dinamica · recursos · composicao | bem-estar do adulto | mae, exaustao | — | *"acolhedor, sem performar empatia"* |
| *comportamento_e_limites* | 70 | desafios_regulacao · como_e | **DESATIVADO** | comportamento, limite | — | — |

**Negrito = geração reescrita (7). Itálico = geração original (7).**

A diferença entre as duas gerações é visível numa linha: o `objective`
reescrito **decompõe a habilidade e manda localizar onde trava**; o original
diz *"apoiar X"*. É nos sete reescritos que o padrão se repete — e é deles que
o DNA foi extraído.

---

## 3. O DNA transversal

Nove princípios, cada um com a citação literal que o sustenta, em
[`lib/pos/dna-especialistas.ts`](../apps/web/src/lib/pos/dna-especialistas.ts):

1. **Decompor** a habilidade em etapas nomeadas e localizar onde trava
2. **Partir do que já funciona**, nunca do que falta
3. **Um passo**, a menor mudança testável — não um programa
4. **Progresso = redução de suporte**, não faz/não faz
5. **Nomear a etapa, não o rótulo** — descrever o que acontece, não o caráter
6. **Descartar o domínio vizinho** antes de escolher a conduta
7. **Brincadeira com objetivo**, nunca ficha de exercício
8. **O que ela consegue em outro contexto é dado**, não má vontade
9. **Encaminhamento tem gatilho nomeado** — não é resposta padrão

Isso mapeia exatamente na cadeia que a missão pediu:

```
SINAL OBSERVADO      → o que a mãe relatou
HIPÓTESE/MECANISMO   → princípios 1, 6, 8
O QUE PRECISO SABER  → princípio 1 (qual etapa)
O QUE POSSO FAZER    → princípios 3, 7
COMO ADAPTAR         → princípio 2 (o que já funciona, o interesse)
O QUE OBSERVAR       → princípios 3, 4
```

**O princípio 9 ficou de fora do bloco injetado**, e está registrado: o Core v11
e a fronteira clínica de `diretrizes.ts` já são o piso da recusa. Repeti-lo
criaria duas fontes para a mesma regra.

---

## 4. O que NÃO foi feito, de propósito

- **Não copiei prompt de especialista.** O bloco tem 6 itens e nenhum nome de
  persona.
- **Não restaurei a arquitetura multi-especialista.** Uma instrução transversal,
  zero chamadas de modelo a mais.
- **Não mexi nos 14 registros do banco.** Nem nos 7 originais, que ganhariam
  muito com a mesma reescrita — isso é decisão da Karina, não minha.

---

## 5. A pergunta que o levantamento abre

Se o DNA chega à web e não ao WhatsApp, e o WhatsApp é onde estão todas as
famílias, **a hipótese mais barata para o problema de valor é que falta
exatamente isto** — não Pós, não Boas Práticas.

A arena de 6 braços existe para decidir isso com evidência, e não por
plausibilidade: `scripts/bancada/arena-valor/`.
