# Como escrever um documento de skill

Guia para os cinco temas que ainda não têm documento: **sono, emocional,
sensorial, comunicação e rotina**. Ele não substitui o `README.md` desta pasta —
que continua sendo a arquitetura. Aqui está só o **formato**, porque a partir de
2026-08-09 o formato deixou de ser cosmético.

## Por que o formato importa agora

O `scripts/gerar-base2.mjs` recorta estes documentos **pelos títulos** e produz
`apps/web/src/lib/conducao/base2-conteudo.ts`, que é o que a Ayla consegue
consultar por seção. Um título fora do padrão vira conteúdo perdido.

> **Aconteceu de verdade.** `nutricional.md` escreve os títulos em caixa alta,
> sem `#`. Na primeira geração ele saiu com **zero seções** — o documento
> inteiro, aprovado e íntegro, simplesmente não existia para o sistema. O
> gerador passou a aceitar os dois formatos, mas **escreva com `#`**: é o que
> todos os outros seis usam e o que o parser trata como caminho principal.

---

## O esqueleto

````markdown
> ⚠️ FONTE CANÔNICA EDITORIAL — conteúdo aprovado, salvo VERBATIM.
> Não compactar, não resumir, não reformatar. O bloco YAML da Camada 1, no fim
> do arquivo, é a única parte editável. Ver `README.md` desta pasta.
> Estado: DD/MM/AAAA. **Skill NÃO ativada.**

---

SKILL: NOME DO TEMA

# MISSÃO

O que esta skill ajuda a família a fazer, e a lista de situações em que ela
atua (uma por linha, com ponto e vírgula).

O objetivo NÃO é [o desvio mais provável — diagnosticar, culpar, medicalizar].

A pergunta funcional é:

"[a pergunta que distingue esta skill de todas as outras]"

# PRINCÍPIO CENTRAL

A frase ampla demais que a família usa ("não dorme", "é agressivo") e por que
ela não basta.

Antes de orientar, diferencie:

1. …
2. …

A estratégia depende de qual desses cenários está acontecendo.

# REGRA DE CONDUÇÃO

Quando perguntar, quanto perguntar, quando parar de perguntar e entregar.

# TRIAGEM INICIAL — DUAS PERGUNTAS QUE SEPARAM CAMINHOS RAPIDAMENTE

As duas perguntas que mais dividem o problema, com o que cada resposta indica.

# ANTES DE ORIENTAR, DIFERENCIE

## 1. NOME DO CENÁRIO

Como reconhecer · o que costuma estar por trás · o que fazer · o que NÃO fazer.

## 2. OUTRO CENÁRIO

…

# <SUBTEMA> — MAPA DE RACIOCÍNIO

Só quando o tema tiver subtemas de verdade. Ver a seção sobre isto abaixo.

# ATIVIDADES

# FRASES PARA O CUIDADOR

# ERROS COMUNS

# O QUE OBSERVAR

# PROGRESSÃO

# USO DE INTERESSES

# IDADE

Só onde a idade **realmente** muda a conduta. Ver a seção sobre isto abaixo.

# SEGURANÇA E LIMITES

O que esta skill NÃO faz, e quando encaminhar.

# RESULTADO ESPERADO

As duas frases que a família deveria conseguir dizer no fim.

---

## CAMADA 1 — destilação para `specialist_prompt_templates`

```yaml
name: sono
display_name: Sono
objective: >
  …
tone: >
  …
scope: >
  …
limits: >
  …
routing_priority: 60
```
````

---

## As cinco regras de formato que o parser exige

1. **Títulos com `#` (nível 1) e `##` (nível 2).** Linha em branco antes e
   depois.
2. **`# SUBTEMA — MAPA DE RACIOCÍNIO`** usa **travessão** (`—`), não hífen. É
   por esse padrão exato que o sistema descobre que existe um subtema e
   consegue levar "dificuldade de leitura" ao mapa certo.
3. **Cenários numerados** viram `## 1. NOME`, `## 2. NOME` — dentro de
   `# ANTES DE ORIENTAR, DIFERENCIE`.
4. **A `## CAMADA 1` fica por último.** O parser para nela: tudo depois é
   ignorado de propósito, porque aquilo já vive no banco.
5. **Nenhum título sem corpo.** Título seguido de outro título é descartado.

Rode `node scripts/gerar-base2.mjs` depois de escrever. Se você esquecer, o
teste `base2.test.ts` falha e diz o que fazer.

## Sobre subtema

Só crie `MAPA DE RACIOCÍNIO` quando o tema tiver **subtemas de verdade** — como
aprendizado tem leitura, escrita e matemática, que pedem raciocínios diferentes.

Se o tema for uma coisa só, **não invente subtema**: use
`# ANTES DE ORIENTAR, DIFERENCIE` com cenários. Subtema falso faz a recuperação
escolher errado.

## Sobre idade

O material existente é **agnóstico de idade por desenho**, porque descreve
mecanismos. Escreva assim também.

Só use a seção `# IDADE` — ou uma marcação dentro de um cenário — quando a
idade **mudar a conduta**, não quando ela apenas mudar o exemplo. "Aos 2 anos
isso é esperado; aos 8 vale investigar" é diferença real. "Uma criança de 6
anos…" num exemplo é só exemplo.

## Sobre o que NÃO escrever

- **Não escreva atividade que já existe em `boas_praticas`.** São centenas nesses
  temas. O documento serve para **achar lacuna**, não para duplicar acervo —
  duas versões da mesma orientação competindo na recuperação é pior que uma
  lacuna.
- **Não afirme mecanismo cerebral de indivíduo.** "No TEA o cérebro dele…" é
  exatamente o que a `FRONTEIRA_DIAGNOSTICO` bloqueia.
- **Não escreva o layout da resposta.** A skill decide o que perguntar e quando
  parar — não o formato da mensagem.
