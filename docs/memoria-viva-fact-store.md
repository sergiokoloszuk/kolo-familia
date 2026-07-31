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
| diário | `kolo-vivo/incorporar.ts` → `aplicarItensNoMembro` |

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

## Escopo (campanha, escola, contexto)

`fatos/escopo-ativo.ts` é o **único** lugar que decide sob qual escopo um fato
nasce, e é chamado pelos quatro caminhos. Hoje devolve sempre `sempre`.

**Não existe no repositório uma fonte de participação em programa.** A tabela
`campanhas` é disparo de mensagens (informacional/promocional/avaliação/
operacional) com destinatários — usá-la marcaria fatos de uma família só porque
ela recebeu um comunicado, o que é pior que não ter escopo. Criar essa fonte é
Fase 8.

O que já existe é o CANAL: quando a fonte existir, o escopo passa a fluir sem
tocar em nenhum dos quatro caminhos de escrita. Os testes de integração provam
a travessia injetando o resolvedor.

**Proibido inferir campanha por palavras do texto.** "Ele adorou o jogo" não
prova participação em nada.

## Proveniência por fluxo

| Fluxo | source_type | canal | status | mensagem |
| --- | --- | --- | --- | --- |
| web manual | `caregiver_report` | `web` | `confirmed` (clique explícito) | — |
| web automático | `caregiver_report` | `web` | `uncertain` (a IA recortou) | — |
| WhatsApp | `caregiver_report` | `whatsapp` | `reported` | `messageId` |
| diário | `manual_entry` | `diario` | `confirmed` | — (autor: `user.id`) |

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

## Quatro identidades, que se confundem com facilidade

| Campo | O que identifica | Muda quando |
| --- | --- | --- |
| `source_content_id` | a **evidência** — o conteúdo que o extrator leu | nunca, para a mesma evidência |
| `extraction_run_id` | a **execução** do extrator | a cada passada; compartilhado pelos fatos da mesma |
| `source_message_id` | a **mensagem**, quando o canal tem uma | por mensagem; o diário não tem, e inventar seria mentir |
| `idempotency_key` | o **fato** | distingue reprocessamento de repetição legítima |

**Unidade de evidência por canal** — fingir que é sempre "uma mensagem" seria falso:

| Canal | `source_content_id` | Unidade real |
| --- | --- | --- |
| web manual | `web_conversation:<id>` | a conversa; o botão age sobre ela |
| web automático | `web_conversation:<id>` | a conversa inteira — o extrator lê o transcript |
| WhatsApp | `whatsapp_turn:<msgId>` | o **turno**, que pode agrupar a rajada |
| diário | *(pendente)* | a entrada do diário |

`resolverEvidenciaOriginal()` devolve o caminho até o conteúdo e a situação da
origem — `existente`, `apagada`, `inacessivel`, `desconhecida`. Origem que sumiu
nunca some em silêncio: o fato fica visivelmente irreprocessável.

## Data civil

`observado_em` é **string `YYYY-MM-DD`, nunca `Date`**. Dois defeitos medidos
contra Postgres justificam a regra: o banco aceita um ISO com hora e trunca em
silêncio; e ler `date` como `Date` desloca um dia no Brasil
(`2026-08-10` → `09/08/2026`). `normalizarDataCivil` trunca **conscientemente**,
com `truncou: true`; `exibirDataCivil` formata sem passar por `Date`.

`tempo_original` guarda a expressão como a família disse ("desde a troca de
professora"). Não resolve — preserva. Perdida na captura, não volta.

## Domínio sensível

`dominios_sensiveis text[]`, marcado na escrita por `marcarDominiosSensiveis`.
**Não é o motor de Governança**: não bloqueia, não cita fonte, não muda resposta.
Marca porque inferir "isto é médico" depois, sobre texto livre acumulado, é o
pior momento para inferir. Ausência é `[]`, nunca `null` — array vazio diz
"avaliado e não é sensível".

Domínio funcional ≠ domínio sensível: `dominio = sono` com
`dominios_sensiveis = [medical]` é um fato de sono que envolve medicação.
