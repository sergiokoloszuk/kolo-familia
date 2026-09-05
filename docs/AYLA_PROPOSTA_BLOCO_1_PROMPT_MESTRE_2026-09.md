# Proposta conceitual do futuro bloco 1 — Prompt Mestre + o que sobrevive do Core v9

**Proposta. Nada foi ativado.** O prompt real de produção continua exatamente
como está: bloco 1 = `core` v9 do banco. Este documento descreve como o bloco 1
*ficaria*, para decisão — não é o texto final e não é injetado em lugar nenhum.

Base: `docs/AYLA_AUDITORIA_PROMPT_MESTRE_2026-09.md` (auditoria de 05/09) e
`docs/documentos-ayla/prompt-mestre-agencia-v1.md` (transcrição versionada).

---

## O princípio que orienta a proposta

> **Não construir "Prompt Mestre + pedaços enormes do Core".**

O Core v9 tem 21.395 caracteres e o Prompt Mestre tem 28.164 — **31,6% maior**.
Somar os dois inteiros produziria ~49.500 caracteres de bloco 1, quase o dobro
do que existe hoje, com dezenas de regras ditas duas vezes.

O critério para uma regra do Core sobreviver é **um só, e é restritivo**:

1. **não existe** no Prompt Mestre; **e**
2. é necessária para **segurança** ou para o **funcionamento atual**; **ou**
3. sua retirada causaria **perda comprovada** (há caso, medição ou código que
   prove).

Regra que o Prompt Mestre já cobre adequadamente **não é copiada**, mesmo com
redação diferente.

---

## Como ficaria o bloco 1

```
┌─ BLOCO 1 (o único que muda) ─────────────────────────────┐
│                                                          │
│  PARTE A — PROMPT MESTRE (agência, integral)             │
│  §1 a §62, como transcrito                    ~28.164 ch │
│                                                          │
│  PARTE B — ADENDO DE PROTEÇÕES DA KOLO         ~3.500 ch │
│  só o que a tabela abaixo marca como                     │
│  "precisa sobreviver"                                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
        ↓  os blocos 2 a 10 NÃO mudam
```

**Por que um adendo separado, e não regras costuradas dentro do Prompt Mestre:**
o documento da agência é deles e vai ser revisado por eles. Um adendo com
fronteira visível permite auditar, a qualquer momento, exatamente o que a Kolo
acrescentou e por quê — e permite que a agência entregue a v2 sem que nada da
Kolo se perca na troca.

**Tamanho estimado do bloco 1 proposto:** ~31.700 caracteres, contra 21.395
hoje. **≈ +48%.**

---

## A tabela — o que sobrevive do Core v9

| Regra/tema do Core v9 | Já está no Prompt Mestre? | Precisa sobreviver? | Motivo / evidência |
|---|---|---|---|
| **Limites jurídicos e previdenciários (BPC, guarda, processo)** — §14, seção inteira: não dar aconselhamento individualizado, não avaliar elegibilidade, não calcular tempo de contribuição, não interpretar lei para o caso | **NÃO** — §45 cobre só saúde | **SIM — crítico** | O Prompt Mestre não tem uma palavra sobre jurídico. Sem isso, o único freio seria o julgamento do modelo diante de uma mãe perguntando se tem direito ao BPC |
| **A distinção INFORMAR × AVALIAR** e a frase-modelo do BPC | **NÃO** | **SIM** | É o que permite ajudar (critérios oficiais, canais) sem decidir direito. Sem ela, ou a Ayla recusa demais ou avalia elegibilidade |
| **"Se a situação jurídica afeta a criança, continue ajudando no escopo da Kolo"** (rotina, previsibilidade, comunicação, regulação) | **NÃO** | **SIM** | Sem isso, o limite vira porta fechada: a família em disputa de guarda fica sem ajuda nenhuma |
| **Criança ambígua** — "se nome, pronome, idade ou outro dado indicar outra criança, não use os dados da cadastrada antes de esclarecer" | **NÃO** | **SIM — crítico** | Face-prompt do isolamento entre irmãos (`lib/ayla/membro-escopo.ts`). O vazamento entre irmãos foi corrigido em 4 vetores em agosto (`af59c30`); a regra de prompt é a quinta camada |
| **"Informações de irmãos ou terceiros podem ser contexto, mas nunca devem ser salvas como fatos da criança acompanhada"** | **NÃO** | **SIM — crítico** | Mesma frente. Dado de uma criança gravado no perfil de outra é erro que não se desfaz sozinho |
| **"WhatsApp e Web devem usar a mesma identidade, Perfil e memória"** | **NÃO** | **SIM** | Os dois canais leem o mesmo documento `core`, mas têm montadores diferentes (`experimental.ts` × `lib/ia/prompt.ts`). É a regra que impede a Ayla virar duas |
| **"Boas Práticas são repertório, não limite"** — pode usar, adaptar, combinar; não copiar mecanicamente, não limitar a resposta ao recuperado, não forçar BP inadequada, não repetir repertório recente | **NÃO** | **SIM — crítico** | O bloco 5 injeta até 2 BPs. Sem instrução de uso, o modelo tende a copiar o que recebeu. E a frase "a personalização prevalece sobre a aplicação literal do acervo" é o que impede a BP atropelar a criança concreta |
| **"Nunca diga que criou, salvou ou gerou Plano ou Cartões se isso não aconteceu"** | Parcialmente — §49, mas condicionado a "se uma ferramenta executou" | **SIM, reescrita** | **A Ayla não tem ferramentas** (`grep tools:\|tool_use` em `experimental.ts` e `provider.ts` → zero). O condicional do §49 nunca se realiza. A regra precisa ser incondicional |
| **Não prometer artefato** — Plano e Rotina nascem de decisor determinístico, não de decisão do modelo | **NÃO** — §52/§53 mandam o oposto ("eu organizo isso com você") | **SIM — crítico** | `ponte.ts` → `montarPlanoDoRelato`; `rotina-guiada.ts` (2.356 linhas). O modelo não sabe se o decisor vai disparar. Já existe no bloco 8, que não muda — **mas §52/§53 passariam a contradizê-lo dentro do mesmo prompt** |
| **Vídeo institucional** | §51 autoriza o modelo a mandar a URL | **SIM — proibir, não autorizar** | O vídeo é campanha proativa, uma vez por família, com idempotência pelo próprio link já enviado (`jaRecebeuVideoGuia`, cron `video_guia`). Autorizar o modelo cria um segundo caminho **sem idempotência** |
| **Conflitos de necessidades** (§5) — autonomia × ajuda excessiva, previsibilidade × mudança, sensorial × ambiente, e as outras cinco duplas | **NÃO** | **SIM** | Nenhum equivalente no documento novo. É ferramenta de compreensão, não de estilo |
| **Hipóteses numeradas para observação** (§4) — as 6 possíveis explicações | Parcialmente — §24 tem alternativas para *relato vago* | **SIM** | São coisas diferentes: §24 ajuda a **nomear o que acontece**; §4 ajuda a **levantar por que acontece**. E "nunca afirme uma causa sem evidência suficiente" não tem equivalente |
| **Coleta inicial estruturada** (§1–2) — os 5 dados e "por qual deles você quer começar?" | **NÃO** | **NÃO** — mas registrar | O onboarding já coleta os 5 dados e a boas-vindas já pergunta por qual começar (template). No WhatsApp, a Ayla raramente faz o primeiro contato do zero. **Decisão de produto**, não de segurança |
| **Base de raciocínio** (§7) — TCC, princípios comportamentais, Terapia Ocupacional (criança + atividade + ambiente) | **SIM** — §30, §35, §36 cobrem com mais detalhe | **NÃO** | O Prompt Mestre é mais completo aqui |
| **Menção a Joe Dispenza** (§7) | **NÃO** | **DECIDIR** | Some se o Core sair. Não é segurança; é decisão editorial da Kolo |
| **Comunicação** (§9) — fala, gestos, apontar, ecolalia, comunicação funcional | **SIM** — §32, praticamente igual | **NÃO** | Duplicata |
| **Não reduzir ao diagnóstico** (§8) | **SIM** — §31, com o mesmo exemplo ("Ele faz isso porque é autista") | **NÃO** | Duplicata |
| **Desabafo** (§13) | **SIM** — §46, quase literal | **NÃO** | Duplicata |
| **Perguntar só se muda a orientação** (§3) | **SIM** — §22, com a mesma pergunta silenciosa | **NÃO** | Duplicata |
| **Relato vago com alternativas** (§3) | **SIM** — §24, mesmo caso | **NÃO** | Duplicata |
| **Correção da família prevalece** | **SIM** — §21, mesmo título | **NÃO** | Duplicata |
| **Continuidade / não recomeçar investigação** | **SIM** — §20 | **NÃO** | Duplicata |
| **Estilo** (§15) | **SIM** — §29, mais específico | **NÃO** | Duplicata |
| **Regra de ouro** | **SIM** — §62 | **NÃO** | Duplicata |
| **Limites de saúde** (§14, primeira parte) | **SIM** — §45, equivalente | **NÃO** | Duplicata |
| **"Não termine automaticamente com uma pergunta"** (§16) | **NÃO** — §26/§27 incentivam CTA | **DECIDIR** | Conflito de doutrina, não de segurança. Um CTA é quase sempre uma pergunta. Ver "decisões pendentes" |
| **"Trial/assinatura não reiniciam a relação"** (§16) | **SIM** — §56 | **NÃO** | Duplicata; e o Trial v5 detalha |
| **"Vídeo ou mídia que a Ayla não consiga interpretar nunca deve deixar a família sem resposta"** (§16) | **NÃO** | **SIM** | Regra operacional: a Ayla recebe áudio e imagem. Sem ela, mídia não interpretável vira silêncio |
| **"O tamanho da resposta depende da necessidade… não acrescente listas, exemplos ou perguntas apenas para completar"** (§16) | Parcialmente — §8 fixa "1 a 3 frases" | **NÃO** | O bloco 8 (formato) já carrega isto e **não muda** |

### Resumo da tabela

**Sobrevivem 12 itens** — jurídico/BPC (3), identidade e irmãos (3), uso das
Boas Práticas (1), artefatos e registro (3), compreensão (2). São proteções e
regras operacionais, não estilo.

**Não sobrevivem 12 itens** — todos duplicados adequadamente pelo Prompt Mestre.

**3 ficam para decisão:** coleta inicial, Joe Dispenza, CTA × pergunta final.

---

## O que o adendo NÃO deve conter

Registro explícito para evitar que ele cresça sozinho:

- nada de tom, estilo, tamanho ou emoji — é do Prompt Mestre e do bloco 8;
- nada de progressão, CTA ou investigação — é do Prompt Mestre;
- nada de Trial dia a dia — é do Trial v5 e do `<jornada>`;
- nada de conteúdo clínico — é do Prompt Mestre §31–44, e a base aprofundada
  fica para a etapa separada;
- nada de formato de canal — o bloco 8 é sempre injetado e não muda.

---

## Impacto estimado de tamanho

| | Hoje | Proposto | Δ |
|---|---|---|---|
| Bloco 1 (caracteres) | 21.395 | ~31.700 | **+48%** |
| Bloco 1 (tokens estimados) | ~5.350 | ~7.900 | +48% |
| Blocos 2 a 10 | inalterados | inalterados | — |

O bloco 1 é o **prefixo cacheado**. Ver a análise de custo/latência/cache no
relatório desta etapa.

---

## O que ainda impede implementar

1. **§9 (negrito markdown)** conflita com o bloco 8, que não muda. Enquanto o
   Prompt Mestre demonstrar `**assim**` nos exemplos, ele ensina o formato que
   quebra na tela da família. **Ver a investigação da Etapa 4.**
2. **§52/§53** contradizem "não prometa artefato" dentro do mesmo prompt.
3. **§51 (vídeo)** cria um caminho paralelo sem idempotência.
4. **§18** manda usar dados que chegam só em parte (estratégias tentadas, o que
   funcionou). Mandar usar o que não chega tende a produzir invenção — o que o
   §19 do próprio documento proíbe.
5. **Sem prova em conversa real.** Nenhuma medição comparou o Prompt Mestre com
   o Core v9 em turnos de verdade. `AYLA_FORMA_MODO` existe e permite observar
   sem alterar a resposta — não foi usado nesta frente.
