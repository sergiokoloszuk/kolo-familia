# Fact Store do Perfil Vivo — primeiro corte

Migração `0073_perfil_fatos.sql`. **Escrita em modo sombra: ninguém lê.**

## Por que existe

A memória de hoje é destrutiva. `appendFato` cola texto num blob `jsonb` e
some a data, quem disse, o contexto, e a diferença entre o que a família
relatou e o que a IA inferiu. Um fato errado incorporado hoje fica
indistinguível de um certo, para sempre.

Este corte tem um objetivo só: **parar de perder origem, tempo, contexto e
natureza a partir de agora**. Cada dia sem ele é conhecimento que não volta —
o blob não guarda o necessário para reconstruir os fatos depois.

## Ativação

`PERFIL_FATOS_SHADOW_WRITE=1` (ou `true`). Qualquer outro valor, ou ausente,
mantém tudo desligado — e aí o serviço retorna **antes de qualquer I/O**.

**Rollback: apagar a variável.** Os fatos gravados ficam e não são lidos por
ninguém. Nenhuma resposta da Ayla depende deles.

Ativação gradual sugerida: ligar, observar `perfil_fato_gravado` por alguns
dias, conferir a proporção de `sem_proveniencia` e de `duplicado`. Só depois
pensar em ler.

## Contrato

Um fato é uma unidade atômica de conhecimento com:

- **conceito** e **domínio** — derivados do campo/subcampo do extrator atual,
  sem chamada de IA nova (`extractor_version = kv-blob-v1`)
- **afirmação** e **contexto** ("na escola", "quando ansiosa")
- **observado_em** — quando aconteceu, ≠ `created_at`
- **escopo** — `sempre`, `campaign`, `school`, `context`…
- **proveniência** — tipo, autor e canal, três coisas separadas; referência à
  mensagem original, nunca cópia do texto
- **verification_status** × **temporal_status** — epistemologia e tempo são
  eixos independentes

## Integração

Um serviço, três pontos:

| Caminho | Arquivo |
|---|---|
| web manual + web automático | `kolo-vivo/aplicar.ts` → `aplicarPropostaNoPerfil` |
| WhatsApp | `ayla/orchestrator.ts` → `aplicarSugestaoNoMembro` |
| diário | *(pendente — ver abaixo)* |

A escrita sombra roda **depois** de o perfil atual já ter sido atualizado.
Falha nela nunca desfaz nada e nunca vira mensagem da Ayla.

## Idempotência

A chave separa **reprocessamento técnico** de **repetição legítima**:

- com mensagem de origem → a chave inclui o `messageId`. Reprocessar não
  duplica; a mãe contando de novo noutro dia vem de outra mensagem e **entra**.
- sem mensagem (tela, diário) → cai na data da observação.

Se a chave usasse só (membro + conceito + afirmação), a repetição legítima
seria descartada e a memória nunca acumularia recorrência — o que mataria a
maturação antes de ela existir.

## O que este corte NÃO faz

Não promove, não rebaixa, não calcula vitalidade nem tendência, não monta
Retrato nem Resumo Ativo, não muda leitura, não muda prompt, não faz backfill.
Nada grava `trait` nem `pattern`: generalizar exige recorrência, e recorrência
é trabalho da maturação.

## Observabilidade

`perfil_fato_gravado` · `perfil_fato_duplicado` · `perfil_fato_rejeitado` ·
`perfil_fato_ignorado` · `perfil_fato_falhou`.

Cada evento leva membro, conceito, domínio, canal, tipo de fonte e
`sem_proveniencia`. **Nunca a afirmação** — é conteúdo clínico sobre uma
criança.
