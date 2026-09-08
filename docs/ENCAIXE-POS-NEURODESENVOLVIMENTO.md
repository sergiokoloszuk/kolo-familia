# Mapa de encaixe — resumo da pós × Perfil × decisor de lacunas

**08/09/2026 · Gate B.** Mapa apenas. **Nada foi conectado ao prompt vivo,
nenhum contexto aumentou, nenhuma pergunta por faixa etária foi criada.**

Fonte mapeada: [`material-pos-v1-ORIGINAL.md`](documentos-ayla/material-pos-v1-ORIGINAL.md)
(20.695 caracteres, 10 seções). Existem 4 variantes em `~/Downloads` ainda não
comparadas — ver §5.

Classificação pedida: **A** fato da criança · **B** critério de decisão ·
**C** conhecimento de orientação (Gate F) · **D** referência por idade.

---

## 1. O encaixe, seção a seção

| Seção da pós | Campos do Perfil | Classe | Uso no decisor de lacuna | Risco |
|---|---|---|---|---|
| **§3 A · Atenção social / contato visual** | `comunicacao.contato` | **B** | diz que, sem contato social, perguntar sobre vocabulário é perguntar o degrau errado | criar questionário de marcos |
| **§3 B · Atenção compartilhada** | `comunicacao.iniciativa`, `mostra` | **B** | idem — é o degrau abaixo de gestos | idem |
| **§3 C · Imitação** | `imitacao.*`, `motor.imita_mov` | **B** | pré-requisito da fala; se ausente, a lacuna decisiva não é "fala" | idem |
| **§3 D · Troca de turnos** | `comunicacao.conversa`, `iniciativa` | **B** | idem |  |
| **§3 · "Prática de Intervenção"** (seguir a liderança, modelo com espera) | — | **C** | **não** entra no Gate B | virar orientação sem contexto |
| **§4 · Perfil sensorial** | `sensorial.perfil`, `sons`, `toques`, `luz`, `movimento` | **B** | **ordena a investigação**: dispersão em público pede sensorial antes de foco | prescrever protocolo clínico (§8.3) |
| **§4 · Coordenação / cerebelo** | `motor.padrao`, `grosso`, `fino` | **B/C** | sinal de encaminhamento, não pergunta de turno |  |
| **§5 · Autonomia por maturidade** | `autonomia.padrao`, `precisa_ajuda` | **D** | contextualiza a expectativa; **não** gera pergunta | virar régua de idade |
| **§6 · Foco, atenção e regulação** | `foco.*`, `emocional.gatilhos`, `sinais` | **B** | `gatilhos` é a lacuna que mais muda estratégia — já é o 1º da lista |  |
| **§7 · Matriz SE… ENTÃO** | vários | **B** | **é o coração do encaixe** — ver §2 | duplicar a Rotina |
| **§2 · DSM-5, CID-11, incidência** | `essencial.diagnostico` | **A/D** | fato relatado; nunca inferido | virar diagnóstico |
| **§8 · Limites éticos** | — | **C** | **já coberto** — ver §4 | **duplicação real** |
| **§9 · Referências, filmes, leituras** | — | **C** | fora do Gate B |  |
| **§10 · 20 princípios de ouro** | — | **C** | sobreposto ao Core v11 | duplicação parcial |

---

## 2. O que deveria alimentar o decisor — e só isso

A pós contribui com **uma coisa** que o decisor atual não tem: **ordem de
investigação**. Hoje `CAMPOS_DECISIVOS` ordena por intuição minha; a pós ordena
por mecanismo.

Três regras da §7 são decisionais de verdade:

1. **Dispersão em lugar público → sensorial antes de foco.** *"Um sistema
   nervoso central sob estresse físico é incapaz de manter atenção voluntária
   sustentada."* Hoje o tema `foco` puxa `foco.padrao` primeiro. A pós diz que,
   quando o relato menciona ambiente público, a lacuna decisiva é
   `sensorial.sons`/`luz`.
2. **Atraso de fala + "entende tudo" → marcos pré-verbais.** A lacuna decisiva
   deixa de ser `comunicacao.vocabulario` e passa a ser `imitacao` /
   `comunicacao.contato`.
3. **A escada da §3 é uma ordem de pré-requisitos.** Fala funcional exige troca
   de turnos, que exige gestos, que exige imitação, que exige atenção
   compartilhada, que exige atenção social. **A lacuna decisiva é o degrau mais
   baixo ainda desconhecido** — não o mais alto.

⚠️ **É por isso que a pós entra como CRITÉRIO e não como conteúdo.** Ela não
acrescenta o que perguntar; ela diz **qual pergunta vale mais**, e essa é
exatamente a decisão do Gate B.

---

## 3. O que **não** deve entrar

- **As perguntas literais** ("Quando você entra no quarto, a criança desvia o
  foco do brinquedo para olhar seu rosto?"). São boas, mas viram questionário se
  virarem lista. O decisor escolhe o CAMPO; a redação é da Ayla, no tom dela.
- **As práticas de intervenção** (§3, §4) — são Gate F.
- **Qualquer régua por idade** (§5) como gatilho de pergunta. Contextualiza a
  expectativa do adulto; não autoriza interrogar.
- **A escada inteira no prompt.** Ela cabe em `CAMPOS_DECISIVOS` como ORDEM, sem
  um caractere a mais de contexto.

---

## 4. Duplicações encontradas

| O que | Onde já existe | Recomendação |
|---|---|---|
| §8 limites éticos (diagnóstico, medicação, dieta) | Core v11 §14 · `diretrizes.ts` FRONTEIRA_CLINICA · `deteccao-clinica.ts` · `fronteira-clinica.ts` | **não** duplicar. A pós não acrescenta nada aqui |
| §7 regra de transições → previsibilidade | fluxo da Rotina Visual inteiro (`prontidao-rotina`) | já implementado como capacidade |
| §10 princípios de ouro | Core v11 §1–§21 | sobreposição alta; comparar antes de qualquer uso |
| §2 níveis de suporte | `essencial` do Perfil (relatado) | **A** — só o que a família contou |

---

## 5. Lacuna do próprio mapa

Há **quatro variantes** do resumo em `~/Downloads`
(`resumo-geral-pos-neurodesenvolvimento*.md`) e **uma** versionada no repositório.
**Não comparei as cinco.** Antes de o Gate F usar qualquer uma, é preciso saber
qual é a canônica e o que diverge — é a mesma disciplina que o Gate A cobrou de
`transicoes`: um conceito, um dono.

---

## 6. Recomendação

1. **No Gate B, usar apenas as três regras de ORDENAÇÃO da §2 deste mapa**, como
   ajuste de `CAMPOS_DECISIVOS` — zero contexto novo, zero pergunta automática.
   Não fazer isso agora: primeiro o bench atual precisa passar, para se medir o
   ganho da ordenação separadamente.
2. **PEND-180** (linguagem dos cartões da Manu) segue como benchmark do Gate F.
3. **Comparar as cinco variantes** e eleger a canônica — pré-requisito do Gate F.
4. **Não conectar conteúdo da pós ao prompt vivo** até o Gate F, e lá com o bench
   de condução, não de recuperação.
