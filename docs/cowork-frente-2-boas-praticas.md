# Frente 2 — Processar 12 PDFs em 250-400 Boas Práticas

## O que é uma Boa Prática (BP)

Uma BP é uma **orientação curta e aplicável** que as skills do app consomem dentro de respostas para a mãe. Não é resumo de aula. É uma dica concreta que a mãe pode usar no dia a dia.

Cada BP deve:

- Ser autocontida (entendível sem o resto da aula).
- Trazer uma ideia/estratégia/dica clara e aplicável.
- Estar em português direto, sem jargão clínico.
- Abrir hipóteses, nunca afirmar causas.

---

## Origem

A fundadora tem 12 PDFs (aulas, conteúdos, materiais autorais). Cada PDF rende aproximadamente 20-30 BPs curadas. Total estimado: **250-400 BPs**.

A extração não é automática — é semi-curada: a Claude no Cowork lê o PDF, identifica candidatas, e a Karina aprova/edita/descarta. Daí vai pro DB.

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
| `skills_relacionadas` | jsonb (array) | Nomes técnicos das skills que se beneficiam dessa BP (use os mesmos da Frente 1). Pode ser mais de uma. |
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
skills_relacionadas: ["transicoes", "regulacao_emocional"]
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

### Formato preferido: CSV

Uma linha por BP, com todos os 17 campos acima (jsonb fields como strings JSON entre aspas).

Cabeçalho da CSV:

```csv
titulo,texto_original,versao_curta,versao_conversa,passos_praticos,quando_usar,erros_comuns,crencas_adulto,atividades_praticas,skills_relacionadas,tags,nivel,faixa_etaria_min,faixa_etaria_max,perfis_aplicaveis,status,origem
```

Exemplo de linha:

```csv
"Conta o que vai acontecer antes","Em transições difíceis...","Antecipa a próxima mudança em 2-3 minutos","Uma coisa que costuma ajudar...","[\"Cronometra mentalmente...\", \"Anuncia em tom calmo...\"]","Em qualquer transição...","Avisar com pressa...","Mãe costuma pensar que avisar antes é 'mimo'...","[\"Cronômetro visual...\"]","[\"transicoes\", \"regulacao_emocional\"]","[\"transicao\", \"antecipacao\"]",iniciante,2,12,"[\"todos\"]",rascunho,admin
```

Sérgio fará um script de import que lê o CSV e popula `boas_praticas` no DB. As BPs entram com `status='rascunho'` — Karina revisa pelo `/admin/boas-praticas` antes de ativar.

### Alternativa: direto na UI

Para BPs pontuais (não em lote), Karina pode acessar `/admin/boas-praticas/nova` no app e preencher os campos manualmente. Mais lento, mas útil para BPs novas que surgem após o lançamento.

---

## Como trabalhar com a Claude no Cowork

Para cada PDF:

1. **Karina compartilha o PDF** no chat do Cowork.
2. **Claude lê e identifica candidatas** — uma lista resumida (título + 1 frase de cada BP candidata), agrupadas pela skill provável.
3. **Karina marca** quais manter, quais cortar, quais editar.
4. **Claude finaliza** cada BP aprovada no schema completo (17 campos).
5. **Claude gera CSV parcial** ao fim de cada PDF.
6. **Sérgio acumula CSVs** e importa em lote ao final.

Esse fluxo evita revisão tardia — Karina valida na origem.

---

## Notas técnicas

- **Tamanho das versões**: `versao_curta` é frase única, `versao_conversa` é 3-4 frases que fluem em conversa de mãe. A skill pode usar uma ou outra dependendo do contexto.
- **`crencas_adulto` em prosa livre**: este é o ponto mais importante do Adendo §3. Não usar formato rotulado. A skill na resposta gera o "gancho" na hora (título em negrito + 2-3 frases) usando uma das 6 famílias de imagens da Régua v3. O texto aqui é apenas matéria-prima.
- **`skills_relacionadas`**: uma BP pode atender mais de uma skill (ex: regulação emocional + transições). Listar todas que se aplicam.
- **`perfis_aplicaveis`**: usar `["todos"]` para BPs gerais. Para específicas, listar: `["TEA"]`, `["TDAH"]`, ou combinar.
- **`faixa_etaria`**: deixar em branco se a BP vale para qualquer idade. Preencher quando a aplicação só faz sentido em faixa específica.
