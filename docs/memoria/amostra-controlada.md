# Amostra controlada da Memória Viva — protocolo operacional

**Versão do protocolo:** 1.0 · **Commit de referência:** `cdfafb2` ·
**Extrator:** `kv-blob-v2`

> Este documento é o roteiro oficial. Quem for conduzir a amostra deve conseguir
> executá-la lendo apenas isto e os arquivos referenciados — sem depender de
> nenhuma conversa anterior.
>
> **Nada aqui foi executado.** Migrações não aplicadas, flag desligada, nenhuma
> família contatada.

Documentos referenciados (não duplicar decisão aqui):

- [`ativacao-shadow-fact-store.md`](ativacao-shadow-fact-store.md) — ordem de
  aplicação, rollback, comportamento em erro
- [`auditoria-fact-store.sql`](auditoria-fact-store.sql) — consultas de auditoria
- [`consultas-amostra.sql`](consultas-amostra.sql) — consultas **desta** operação
- [`../memoria-viva-fact-store.md`](../memoria-viva-fact-store.md) — contratos
  do fato, evidência, datas, domínio sensível
- [`ambiente-minimo-de-teste.md`](ambiente-minimo-de-teste.md) — ambiente local

---

## 1. Objetivo

Descobrir, com fatos reais, se a Memória Viva coleta com qualidade suficiente
para sustentar um Retrato — **e nada além disso**. A Ayla não lê nada, não muda
de comportamento, e nenhuma família percebe diferença.

## 2. Hipóteses que só esta amostra responde

| # | Hipótese | Como se responde | Quando aparece |
|---|---|---|---|
| H1 | `upsert(ignoreDuplicates).select()` devolve `[]` em conflito | primeira duplicata real | **primeira hora** |
| H2 | A barreira de sujeito sobrevive à língua real | triagem de falso negativo | dias |
| H3 | A quarentena filtra, não bloqueia | razão quarentena/ativos | semana 1 |
| H4 | A granularidade do conceito sustenta a Fase 7 | taxa `conceito = dominio` | semana 1 |
| H5 | `ctx.membros[0]` não gera quarentena em massa | taxa na família multi-filho | semana 1 |
| H6 | **A extração é fiel e atômica** | leitura humana | semanas 2–3 |

H6 é a mais importante e a menos discutida: **o extrator nunca foi medido.**
Todo o resto do pipeline foi.

**O que a amostra NÃO responde:** eventos raros. Com o volume previsto, um erro
que ocorra em 1 a cada 200 fatos provavelmente não aparece. Silêncio não é
prova de ausência.

## 3. Papéis

| Papel | Responsabilidade |
|---|---|
| **Responsável técnico** | aplica migrações, liga/desliga a flag, executa a Fase interna, decide interrupção técnica |
| **Responsável pela auditoria** | roda a auditoria diária, a revisão humana e a quarentena semanal |
| **Segundo revisor** | revisa 15–20 fatos às cegas (§12) — não pode ser quem fez a revisão principal |
| **Responsável pelo consentimento** | conduz o convite, registra aceite e retirada |

O técnico e o auditor **não devem ser a mesma pessoa**. Quem constrói tende a
ler o próprio resultado com generosidade.

---

## 4. Fases

```
Fase 0  preparação        migrações aplicadas, flag DESLIGADA, 48h de espera
Fase 1  interna           só a equipe, flag LIGADA, 48–72h  → fecha H1
Fase 2  famílias reais    4 famílias, 3 semanas             → H2 a H6
Fase 3  encerramento      relatório e decisão
```

Não pule fases. A Fase 0 existe para o schema falhar sem custo; a Fase 1 existe
para fechar a última hipótese externa antes de qualquer família entrar.

---

## 5. Fase 0 — preparação

### 5.1 Checklist pré-migração

Ver [`checklist-pre-migracao.md`](checklist-pre-migracao.md). **Nenhum item é
opcional.**

> **Sem snapshot confirmado, não aplicar migração.**

> ⚠️ **O restore deste banco nunca foi testado.** O snapshot da Hostinger
> recuperou o banco no incidente de 08/06/2026, então funcionou uma vez — mas
> nunca foi exercitado deliberadamente. Isto é um **risco aceito e declarado**,
> não resolvido. Não é pendência da Memória Viva; é anterior a ela.

### 5.2 Aplicação

**Ordem: `0071` → validar → `0072` → validar → `0073` → validar.**

**Uma migração por vez.** Verificamos que nenhuma das três contém instrução que
o PostgreSQL proíba dentro de transação — sem `CREATE INDEX CONCURRENTLY`, sem
`VACUUM`, sem `ALTER TYPE ... ADD VALUE`. Tecnicamente as três caberiam numa
transação única.

**Ainda assim, aplique uma por vez.** O ganho da transação única é atomicidade
entre migrações independentes, que não é um ganho: se a `0072` falhar, não há
razão para desfazer a `0071`. E validar entre uma e outra transforma uma falha
genérica em um diagnóstico preciso. Cada uma, individualmente, roda em `begin;
… commit;`.

```sql
begin;
  \i supabase/migrations/0071_bia.sql
commit;
-- validar (§5.3) antes de seguir
```

Registre **início e fim de cada uma** no registro da execução (§6). Na primeira
falha: pare, não avance, e não tente a seguinte.

> **Por que não usar o botão Deploy do Easypanel:** um redeploy do stack
> Supabase **zerou o banco em 08/06/2026**. O bind do `PGDATA` é frágil e o
> redeploy pode recriar o volume. A aplicação é por sessão SQL no host, e só.

### 5.3 Validações pós-migração

Ver [`consultas-amostra.sql`](consultas-amostra.sql), bloco 1. Cada consulta traz
objetivo, resultado esperado, interpretação de divergência e ação.

### 5.4 Espera

**48 horas com a flag desligada.** Se o schema tem problema, ele aparece sem
nenhum fato gravado e sem nenhuma família envolvida.

**Critério de saída da Fase 0:** as 10 validações passam, a tabela está vazia,
nenhum código lê o fact store, e 48h se passaram sem incidente.

---

## 6. Registro da execução

Ver [`registro-amostra.md`](registro-amostra.md) — preencher **antes** de ligar
a flag e manter atualizado. Sem ele, o relatório final não é interpretável.

---

## 7. Fase 1 — interna

Só as contas da equipe. Flag ligada.

### 7.1 O experimento do PostgREST (H1)

Este é o motivo da fase existir. Toda a idempotência do serviço depende de uma
suposição nunca verificada: que
`upsert(…, { onConflict, ignoreDuplicates: true }).select("id")` devolve `[]`
quando há conflito. Se devolvesse a linha existente, o serviço reportaria
"gravado" onde houve duplicata — **e as métricas de recorrência nasceriam
erradas, sem sintoma visível.**

**Procedimento:** mande a mesma mensagem duas vezes pelo WhatsApp, com o mesmo
texto, no mesmo dia. Registre, para a **primeira** e para a **repetição**:

| Observar | Onde |
|---|---|
| `data` retornado | log de aplicação |
| `error` | idem |
| status HTTP, se disponível | idem |
| nº de linhas devolvidas | idem |
| evento de telemetria emitido | `eventos_app` / stdout |
| nº de linhas no banco | `consultas-amostra.sql`, bloco 2 |
| `idempotency_key` das duas | idem |

**Não basta ausência de linha duplicada.** É preciso confirmar que o serviço
**classificou** corretamente:

```
1ª chamada  →  perfil_fato_gravado     + 1 linha no banco
2ª chamada  →  perfil_fato_duplicado   + 1 linha no banco (a mesma)
```

**Autoriza marcar `CONTRATO_POSTGREST.verificado = true`:** exatamente esse
par de eventos, com uma linha só no banco e a mesma `idempotency_key`. Registrar
quem verificou e quando, em `scripts/db/pglite-supabase.mjs`.

**Se divergir:**

1. desligar a flag imediatamente;
2. preservar os fatos e os logs — a evidência é o produto do experimento;
3. corrigir o serviço (provavelmente a leitura de `data.length === 0`);
4. criar teste de regressão;
5. recomeçar a Fase 1 do zero.

### 7.2 Os outros quatro objetivos

- **Shadow write não altera a experiência:** compare o tempo de resposta da Ayla
  antes e depois; nenhuma mensagem de erro deve chegar à conversa.
- **Telemetria em produção:** os cinco eventos aparecem (`gravado`, `duplicado`,
  `rejeitado`, `quarentena`, `falhou`).
- **Evidência recuperável:** todo fato tem `source_content_id` e ele resolve.
- **Duplicatas classificadas:** ver 7.1.

**Critério de saída da Fase 1:** H1 fechada, zero incidente do bloco vermelho
(§15), nenhuma alteração perceptível na conversa.

---

## 8. Fase 2 — famílias reais

### 8.1 Composição

Quatro perfis. **Composição importa mais que tamanho.**

| # | Perfil | Por que é indispensável |
|---|---|---|
| A1 | dois ou mais membros acompanhados | é onde vive o risco de `ctx.membros[0]`; sem ela a amostra não testa o principal |
| A2 | uso intenso de WhatsApp | volume e linguagem natural |
| A3 | uso de Web **e** Diário | cobre os outros três caminhos |
| A4 | adolescente ou adulto acompanhado | o vocabulário muda, e o produto assume criança em vários lugares |

Uma família pode cobrir mais de um perfil. **A1 não é substituível.**

### 8.2 Ficha de seleção

Ver [`ficha-selecao-familia.md`](ficha-selecao-familia.md). **Sem nomes reais
neste documento nem nos relatórios** — use `A1`…`A4`. O vínculo entre
identificador e família fica fora do repositório, com o responsável pelo
consentimento.

### 8.3 Consentimento

Ver [`consentimento-amostra.md`](consentimento-amostra.md).

> ⚠️ **Rascunho. Pendente de revisão jurídica e de privacidade antes de
> qualquer uso.** Não declaramos conformidade.

### 8.4 Duração e volume

**3 semanas.** Estimativa: 3–6 fatos por família por dia ativo, com engajamento
parcial → **150 a 300 fatos**.

Isso dá taxas com precisão aproximada de ±6 a 8 pontos percentuais. **Toda taxa
no relatório deve vir com numerador e denominador** (§14).

---

## 9. Congelamento

Durante a amostra, **não mude**: versão do extrator · regras de foco · regras de
sujeito · taxonomia de conceito · chave de idempotência · formato do fato ·
critérios de auditoria.

Se uma mudança se tornar inevitável:

1. **pausar a coleta**;
2. registrar a razão no registro da execução;
3. **encerrar a amostra anterior** e abrir uma nova (novo identificador, novo
   `extractor_version`);
4. registrar o novo commit.

**Como comparar períodos:** só agrupando por `extractor_version` — nunca
somando. Duas versões produzem fatos com semântica diferente, e a soma esconde
exatamente o que a mudança causou. Se as duas janelas forem pequenas demais para
comparar, **a comparação não existe** — diga isso no relatório em vez de
inventar uma tendência.

---

## 10. Auditoria diária — 5 minutos

Ver [`consultas-amostra.sql`](consultas-amostra.sql), bloco 3. Rode **todos os
dias**, mesmo nos de volume baixo.

A coleta é invisível: a família não vê nada, então **nada avisa que deu errado
exceto estas consultas.** Elas são a única rede.

O bloco 3 já traz, para cada consulta, a classificação do resultado: `normal`,
`investigar hoje`, `pausar`, `interromper imediatamente`.

**Três dias consecutivos sem auditoria → pausar a coleta.** Registre o período
não auditado e audite o acervo acumulado inteiro antes de retomar.

---

## 11. Auditoria humana dos fatos

Ver [`ficha-auditoria-fato.md`](ficha-auditoria-fato.md).

Meta: **100% dos fatos ativos** revisados quanto a pessoa; **≥ 50 fatos** quanto
a fidelidade, atomicidade e conceito.

Não copie o texto do fato para planilha externa. A ficha trabalha por `id` e
comentário curto.

## 12. Concordância entre revisores

Um **segundo revisor** avalia 15–20 fatos **sem ver** a classificação anterior.
Comparar divergências em fidelidade, atomicidade, pessoa, conceito e domínio.

Sem cálculo estatístico. O objetivo é descobrir se os critérios são
compreensíveis. **Divergência frequente (acima de ~1 em 4) significa que as
taxas não são confiáveis** — revise as definições antes de tratar qualquer
número como resultado.

## 13. Quarentena — revisão semanal

Para cada item: confirmar origem, confirmar pessoa, classificar motivo, decidir
entre `liberado` / `descartado` / `reatribuido` / `expirado`, registrar
responsável, data e justificativa curta. **Preservar a linhagem.**

### O que pode e o que não pode ser feito hoje

**Não existe serviço de transição.** O schema tem os campos
(`quarentena_resolucao`, `quarentena_resolvido_em`, `quarentena_resolvido_por`)
e nada os escreve.

| Pode | Não pode |
|---|---|
| registrar a resolução por `UPDATE` (bloco 5 do SQL) | `DELETE` para "resolver" |
| liberar (`status = 'ativo'`) | reatribuir membro — muda `membro_atipico_id`, que é parte da identidade do fato |
| descartar (`status = 'invalidado'`) | alterar `afirmacao`, `conceito` ou `observado_em` |
| expirar | resolver sem `quarentena_resolvido_em` |

**Reatribuição fica bloqueada nesta amostra.** Mudar o membro de um fato
existente reescreveria história; o correto é invalidar o fato e criar um novo
com `invalidates_fact_id`, e isso é serviço que não existe. Se aparecerem muitos
casos de reatribuição, **registre a contagem** — ela é resultado da amostra.

### Decisão necessária antes de ligar

> **Script operacional controlado ou implementação mínima?**
>
> **Recomendação: script operacional controlado.** O volume esperado é de
> dezenas de itens, a revisão é semanal e humana, e um serviço construído antes
> de sabermos como as resoluções se distribuem provavelmente seria refeito.
> O bloco 5 do SQL traz os `UPDATE` com as constraints respeitadas.
>
> Esta decisão é do responsável técnico e **deve ser registrada** no registro da
> execução, não deixada implícita.

---

## 14. Métricas

**Sempre com numerador e denominador.** Nunca só percentual.

> `7 de 53 fatos ativos apresentaram afirmação composta: 13,2% (n=53).`

Registrar: fatos totais · ativos · quarentena · rejeitados · duplicatas ·
falhas · por canal · por família · por versão do extrator · erro de pessoa ·
fidelidade · atomicidade · `conceito = dominio` · sem proveniência · evidência
não recuperável · domínios sensíveis · foco frágil · quarentena na família com
múltiplos membros.

## 15. Limiares

| Métrica | Verde | Amarelo | Vermelho |
|---|---:|---:|---:|
| fato na pessoa errada | 0 | — | ≥ 1 |
| quarentena / ativos | < 15% | 15–40% | > 40% |
| `conceito = dominio` | < 30% | 30–50% | > 50% |
| sem proveniência | 0 | — | > 0 |
| duplicação técnica | 0 | — | > 0 |
| afirmação não atômica | < 15% | 15–30% | > 30% |
| afirmação infiel | 0 | — | ≥ 1 |

> Estes limiares são **hipóteses operacionais iniciais**, não padrões
> científicos validados. Foram escolhidos por julgamento. Se a amostra mostrar
> que um deles é irrealista, **mude o limiar e diga que mudou** — não force o
> sistema a caber num número inventado.

**"Afirmação infiel" é qualquer um destes:** contradição com o relato ·
invenção de informação ausente · generalização indevida (um evento virando
característica) · perda de condição importante ("na escola", "quando cansado") ·
atribuição à pessoa errada.

Duas métricas mudam decisões de **arquitetura**, não de operação:
`conceito = dominio` acima de 50% significa que **a Fase 7 não é viável** com a
taxonomia atual; atomicidade acima de 30% torna a divisão de frases compostas
prioridade, não débito.

---

## 16. Interrupção, pausa e exclusão

### Interromper imediatamente — desligar a flag na hora

- fato da cuidadora atribuído à criança
- fato de uma criança no perfil de outra
- qualquer leitura do fact store por código de produção
- qualquer falha que afete a conversa da Ayla
- perda de proveniência
- vazamento de texto da família em log

### Pausar e investigar

duplicação técnica · estado epistemológico inválido · escopo fora do padrão ·
quarentena > 40% · três dias sem auditoria · evidência não recuperável ·
divergência relevante entre revisores

### Exclusão — quatro coisas diferentes

| Finalidade | Ação | Bloco SQL |
|---|---|---|
| preservar para investigação | **nada** — não mexa | — |
| invalidação lógica | `status = 'invalidado'` + motivo | 5 |
| exportação para auditoria | `COPY … TO` antes de qualquer remoção | 6 |
| exclusão a pedido da família | `DELETE` por família, **após exportar** | 6 |

> **`DELETE` nunca é mecanismo de correção.** Fato errado se invalida, não se
> apaga — apagar destrói a evidência de que o erro existiu, que é o produto do
> experimento.

---

## 17. Critérios para encerrar a amostra

Dez condições:

1. contrato do PostgREST verificado;
2. zero fato em pessoa errada, na revisão de **100% dos ativos**;
3. quarentena revisada ≥ 2 vezes, abaixo de 40% e estável;
4. ≥ 50 fatos ativos revisados quanto a fidelidade, atomicidade e conceito;
5. evidência recuperável em 100% dos fatos;
6. decisão consciente sobre `conceito = dominio`;
7. nenhuma falha de proveniência;
8. nenhum vazamento em logs;
9. relatório com numeradores e denominadores;
10. divergências da dupla auditoria registradas.

**A amostra pequena não autoriza concluir que um erro não existe.** Ela autoriza
exatamente isto, e nada além:

> O sistema demonstrou qualidade suficiente, **nas condições e no tamanho desta
> amostra**, para iniciar um Retrato em shadow sobre o mesmo acervo.

**Nunca autorizar leitura pela Ayla nesta fase.**

---

## 18. Relatório final

Ver [`relatorio-amostra.md`](relatorio-amostra.md).

## 19. O que não fazer

Não contar às famílias que a Ayla "agora lembra" — ela não usa nada disso. Não
ligar leitura, nem "só para ver". Não mudar o extrator. Não ampliar de quatro
para vinte porque foi bem. Não inferir campanha. Não iniciar o Retrato em
paralelo: construído sobre um acervo que ainda pode ser reprocessado, ele
congela as decisões erradas.

**O maior risco desta operação não é técnico.** Três semanas de números verdes
criam a sensação de que está provado. Não está — a amostra é pequena e as
famílias foram escolhidas. Por isso o tamanho anda junto com cada taxa.
