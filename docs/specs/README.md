# SPECs de funcionalidade

Uma SPEC descreve **como uma funcionalidade específica deve se comportar**.
As regras de trabalho estão em [../AI-ENGINEERING-PROTOCOL.md](../AI-ENGINEERING-PROTOCOL.md);
os portões de entrega, em [../FEATURE-DELIVERY-PROTOCOL.md](../FEATURE-DELIVERY-PROTOCOL.md).

Arquivo: `docs/specs/<funcionalidade>-SPEC.md`.

## O que torna uma SPEC viva

A SPEC é **portadora da evidência dos portões**. Cada portão fechado deixa nela
uma linha com data e commit. SPEC sem portões preenchidos é rascunho, não
especificação — e é assim que ela deixa de ser documento que ninguém mantém.

Nível PEQUENA não precisa de SPEC. MÉDIA usa a versão curta (seções 1, 2, 3 e
6). CRÍTICA usa tudo.

## Formato

```markdown
# <Funcionalidade> — SPEC
Nível de risco: PEQUENA | MÉDIA | CRÍTICA (+ gatilho de escalada, se houver)
Estado: DESENHADA | APROVADA | IMPLEMENTADA | TESTADA | PUBLICADA |
        VALIDADA EM PRODUÇÃO | PRONTA

## 1. Problema e dono
Quem pede, quem usa, quem imprime. Que frase a mãe deixa de dizer.

## 2. Corpus de disparo
10 a 20 frases como as mães realmente escrevem, cada uma marcada
DEVE DISPARAR / NÃO DEVE DISPARAR. Vira fixture de teste e é a prova
executável do portão P2.

⚠️ O corpus vem do uso real, não de conversa sintética em escala.

| Frase | Esperado | Por quê |
|---|---|---|

## 3. Comportamento
Jornada, canais, perguntas mínimas, decisões da IA, confirmação humana,
estados do meio (rascunho, abandonado, gerado-sem-entrega).

## 4. Contrato de artefato   (quando houver artefato persistente)
Onde grava · como a mãe reencontra · como a Ayla referencia ·
como não duplica · como se edita · como se apaga · como se imprime.

## 5. Portões
| Portão | Resultado | Data | Commit | Evidência |
|---|---|---|---|---|
| P1 Problema e dono | | | | |
| P2 Descoberta | | | | |
| P3 Conversa mínima e dados | | | | |
| P4 Jornada e canais | | | | |
| P5 Identidade, alvo e permissão | | | | |
| P6 Continuidade | | | | |
| P7 Quando dá errado | | | | |
| P8 Prova e entrega | | | | |

PASS · FAIL · BLOQUEADO · NÃO SE APLICA (com motivo).

## 6. O que esta funcionalidade NÃO faz
A seção que mais evita retrabalho.

## 7. Dívidas conhecidas
Só por ID: PEND-XXX. Nunca repetir o texto da pendência aqui.
```

## Regras

- Uma SPEC por funcionalidade. Não criar SPEC para correção de defeito.
- Dívida conhecida vive em [../PENDENCIAS.md](../PENDENCIAS.md) e é
  referenciada por ID — texto duplicado diverge em uma semana.
- SPEC não é PRD nem laudo: se passar de duas telas, o excedente vira
  documento próprio em `docs/` e a SPEC aponta.
