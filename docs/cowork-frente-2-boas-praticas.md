# Frente 2 — Importar as 349 Boas Práticas curadas pela Karina

> **Atualizado em 2026-05-17** — devolutiva da Karina:
> - **Não vamos mais gerar BPs a partir dos 12 PDFs** no Cowork. A Karina já curou **349 BPs** offline e vai entregar em XLSX.
> - O fluxo de extração via Claude no Cowork (descrito no fim deste doc) fica disponível como **trilha futura/opcional** para expandir o acervo depois do beta, se ela quiser.
> - **Skills válidas para `skills_relacionadas`**: `sensorial`, `emocional`, `comunicacao`, `rotina`, `sono`, `meu_bem_estar`, mais as 6 em rascunho (`socializacao`, `imitacao`, `motor`, `autonomia`, `aprendizado`, `foco`, `nutricional`). **Não usar mais** `regulacao_emocional`, `transicoes`, `comportamento_e_limites`.

## O que é uma Boa Prática (BP)

Uma BP é uma **orientação curta e aplicável** que as skills do app consomem dentro de respostas para a mãe. Não é resumo de aula. É uma dica concreta que a mãe pode usar no dia a dia.

Cada BP deve:

- Ser autocontida (entendível sem o resto da aula).
- Trazer uma ideia/estratégia/dica clara e aplicável.
- Estar em português direto, sem jargão clínico.
- Abrir hipóteses, nunca afirmar causas.

---

## Origem

A fundadora consolidou **349 BPs** curadas a partir das aulas, conteúdos e materiais autorais dela. Cada BP foi escrita/aprovada por ela diretamente, com nomes técnicos das skills já mapeados.

A entrega para o Sérgio será um **XLSX** (uma linha por BP, colunas espelhando os 17 campos do schema). O Sérgio escreve um importer que parseia o XLSX e popula `boas_praticas`.

---

## Schema da tabela `boas_praticas`

Cada BP é uma linha na tabela `boas_praticas` do banco. Campos preenchidos pela Karina:

| Campo | Tipo | Descrição |
|---|---|---|
| `titulo` | text | Frase curta de 3-12 palavras. Resume a BP. |
| `texto_original` | text | 1-2 frases auto-contidas. O coração da BP. |
| `versao_curta` | text | Versão de 1 frase punchy (pode ser título mais elaborado). |
| `versao_conversa` | text | Versão pra a skill usar dentro de uma resposta — 3-4 frases que fluem natural na conversa. |
| `passos_praticos` | jsonb (array) | 2-4 itens curtos com ação concreta. |
| `quando_usar` | text | 1 frase descrevendo o contexto/momento em que essa BP serve. |
| `erros_comuns` | text | 1-2 frases sobre o que a mãe costuma errar nesse tema. |
| `crencas_adulto` | text | **Prosa livre** — qual crença limitante da mãe essa BP ajuda a derrubar + direção possível de reframe. **NÃO usar o formato "Tríplice rotulada"** (CrenÇa limitante / CrenÇa saudável / Mecanismo). Esse formato foi descartado na Virada 7. A crença é texto que a skill vai transformar em "gancho" na hora. |
| `atividades_praticas` | jsonb (array) | Opcional. 0-3 atividades específicas que a mãe pode fazer com a criança ligadas à BP. |
| `skills_relacionadas` | jsonb (array) | Nomes técnicos das skills que se beneficiam dessa BP (use os 12 nomes válidos — ver acima). Pode ser mais de uma. |
| `tags` | jsonb (array) | 2-5 palavras-chave temáticas. |
| `nivel` | text (opcional) | `iniciante` / `intermediario` / `avancado`. |
| `faixa_etaria_min` | int (opcional) | Idade mínima em anos onde a BP se aplica. |
| `faixa_etaria_max` | int (opcional) | Idade máxima em anos. |
| `perfis_aplicaveis` | jsonb (array, opcional) | Perfis específicos: TEA, TDAH, Dislexia, AHSD, todos. |
| `status` | text | `rascunho` (Karina revisa antes de virar ativa) ou `ativo` |
| `origem` | text | `admin` (Karina curou) ou `aula` (extraído de aula via IA) |
| `aula_id` | uuid (opcional) | Se veio de uma aula específica, FK para `aulas.id` |

---

## Exemplo de BP completa

```yaml
titulo: "Conta o que vai acontecer antes"
texto_original: "Em transições difíceis, avisar a criança 2-3 minutos
  antes do que vai mudar reduz a reação. O sistema de alerta dela ainda
  está sendo construído — você empresta a previsibilidade."
versao_curta: "Antecipa a próxima mudança em 2-3 minutos"
versao_conversa: "Uma coisa que costuma ajudar em transições é avisar
  com um pouco de antecedência o que vai acontecer. Tipo, 2-3 minutos
  antes você fala: 'em uma musiquinha a gente vai desligar a TV'. Não é
  ameaça nem cobrança — é dar ao cérebro dele tempo de fazer a curva."
passos_praticos:
  - "Cronometra mentalmente 2-3 minutos antes da troca de atividade"
  - "Anuncia em tom calmo: 'em pouco tempo a gente vai [próxima coisa]'"
  - "No momento da troca, repete: 'agora é hora de [...]'"
quando_usar: "Em qualquer transição que costuma ter resistência —
  desligar tela, sair de casa, ir dormir, parar de brincar pra jantar."
erros_comuns: "Avisar com pressa no momento exato da mudança (sem o
  tempo de transição) ou usar como ameaça ('se você não desligar, vou
  desligar eu')."
crencas_adulto: "Mãe costuma pensar que avisar antes é 'mimo' ou que vai
  ensinar a criança a contestar mais. A pesquisa mostra que dar
  previsibilidade não enfraquece o adulto — fortalece a transição. A
  criança não está manipulando ao reagir; o cérebro dela ainda está
  aprendendo a parar uma atividade que está gostando. Reframe: 'avisar
  antes não é frouxidão, é assistência cognitiva'."
atividades_praticas:
  - "Cronômetro visual de 3 minutos antes do desligar tela"
  - "Música-jingle curta que sinaliza 'agora a gente troca'"
skills_relacionadas: ["rotina", "emocional"]
tags: ["transicao", "antecipacao", "limite", "previsibilidade"]
nivel: iniciante
faixa_etaria_min: 2
faixa_etaria_max: 12
perfis_aplicaveis: ["todos"]
status: rascunho
origem: admin
```

---

## Vetos que se aplicam (não esquecer)

- **Sem termos clínicos prescritivos** — diagnóstico, prognóstico, tratamento, cura, medicação, "deveria tomar".
- **Sem clichês de maternidade** — guerreira, supermãe, sua tribo, jornada da maternidade.
- **Sem nomes de método** — PNL, Joe Dispenza, REAC nunca aparecem nos textos das BPs.
- **Sem citar autores de neurodivergência** — Siegel, Greene, Delahooke, Prizant etc. nunca no texto. Eles podem ser referenciados no campo `referencia_bibliografica` (uso interno).
- **Sem comparar com outras crianças** — "outras crianças costumam", "o normal seria" nunca.
- **Sem alarmismo** — preocupante, grave, urgente só quando realmente é risco real.
- **Hipóteses, nunca causa afirmada** — "pode ser que", "às vezes acontece de", "uma possibilidade é".

O Validador do app pega esses no momento da resposta, mas pegar de saída ao escrever a BP economiza tempo de revisão.

---

## Como entregar para o Sérgio

### Formato preferido: XLSX

Uma linha por BP, com todos os 17 campos acima. Os campos `jsonb` (array) entram como **strings JSON** dentro da célula (entre `[ ]` com aspas duplas nos itens).

Cabeçalho da planilha (exatamente nesta ordem):

```
titulo | texto_original | versao_curta | versao_conversa | passos_praticos | quando_usar | erros_comuns | crencas_adulto | atividades_praticas | skills_relacionadas | tags | nivel | faixa_etaria_min | faixa_etaria_max | perfis_aplicaveis | status | origem
```

Exemplo de célula `skills_relacionadas`:

```
["rotina", "emocional"]
```

Exemplo de célula `passos_praticos`:

```
["Cronometra mentalmente 2-3 minutos antes", "Anuncia em tom calmo", "No momento da troca, repete"]
```

Notas importantes:
- Manter o cabeçalho na primeira linha.
- Deixar células vazias quando o campo for opcional e não se aplicar (não usar `null` literal, só vazio mesmo).
- `status` default = `rascunho` — Karina revisa em `/admin/boas-praticas` antes de marcar como `ativo`.
- `origem` = `admin` para tudo curado por ela.

### O que o Sérgio faz

1. Recebe o XLSX.
2. Roda `scripts/import-boas-praticas.mjs <caminho-do-xlsx>` (a ser escrito no momento do import).
3. O script valida cada linha contra o schema do Validator (mesmos vetos), reporta linhas problemáticas, e popula `boas_praticas` em lote.
4. Karina abre `/admin/boas-praticas`, filtra `status=rascunho`, revisa as que quiser editar, e ativa.

### Alternativa: direto na UI

Para BPs pontuais (não em lote), Karina pode acessar `/admin/boas-praticas/nova` no app e preencher os campos manualmente. Útil para BPs novas que surgem após o lançamento.

---

## Trilha futura — Extrair BPs novas de PDFs no Cowork (opcional, pós-beta)

> Esta seção fica como referência para depois. **Não é prioridade do beta.** O acervo de 349 BPs curado pela Karina é o que entra no app no lançamento.

Caso a Karina queira expandir o acervo depois (a partir das aulas em PDF ou novos conteúdos), o fluxo seria:

1. **Karina compartilha o PDF** no chat do Cowork.
2. **Claude lê e identifica candidatas** — uma lista resumida (título + 1 frase de cada BP candidata), agrupadas pela skill provável.
3. **Karina marca** quais manter, quais cortar, quais editar.
4. **Claude finaliza** cada BP aprovada no schema completo (17 campos).
5. **Claude gera XLSX/CSV parcial** ao fim de cada PDF.
6. **Sérgio importa** em lote.

Esse fluxo evita revisão tardia — Karina valida na origem.

---

## Notas técnicas

- **Tamanho das versões**: `versao_curta` é frase única, `versao_conversa` é 3-4 frases que fluem em conversa de mãe. A skill pode usar uma ou outra dependendo do contexto.
- **`crencas_adulto` em prosa livre**: este é o ponto mais importante do Adendo §3. Não usar formato rotulado. A skill na resposta gera o "gancho" na hora (título em negrito + 2-3 frases) usando uma das 6 famílias de imagens da Régua v3. O texto aqui é apenas matéria-prima.
- **`skills_relacionadas`**: uma BP pode atender mais de uma skill (ex: `emocional` + `rotina`). Listar todas que se aplicam. **Nomes válidos**: `sensorial`, `emocional`, `comunicacao`, `rotina`, `sono`, `meu_bem_estar`, `socializacao`, `imitacao`, `motor`, `autonomia`, `aprendizado`, `foco`, `nutricional`.
- **`perfis_aplicaveis`**: usar `["todos"]` para BPs gerais. Para específicas, listar: `["TEA"]`, `["TDAH"]`, ou combinar.
- **`faixa_etaria`**: deixar em branco se a BP vale para qualquer idade. Preencher quando a aplicação só faz sentido em faixa específica.
