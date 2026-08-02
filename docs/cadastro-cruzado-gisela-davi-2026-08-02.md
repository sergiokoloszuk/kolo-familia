# Cadastro cruzado — família Gisela/Davi (02/08/2026)

**Decisão: NÃO alterar o banco.** Há ambiguidade real sobre a quem pertencem
parte dos dados, e ela envolve dado clínico de criança. Nada foi escrito.

O SQL está pronto abaixo, para ser executado **depois** de confirmar dois
pontos com a família.

---

## O que aconteceu

`family_account_id` `4748506b-9180-4b98-8eec-f0c8566e5419`
`membro_atipico_id` `e81ab779-0033-4e96-adca-e3de321f1a3d`

```
family_profiles.nome_mae = "Meu Nome e Gisela Meu Filgo e Davi Ele e Autista"
family_profiles.como_chamar = null

membros_atipicos:
  nome             = "Gisela Fróes Mathias Duarte"
  genero           = "feminino"
  data_nascimento  = 1984-04-09          → 42 anos
  perfil           = "TEA"
  idade            = null
  diagnosticos_formais = ["TEA","TDAH","Dislexia","Deficiência intelectual",
                          "Hipótese: TEA","Hipótese: TDAH"]
```

A pessoa cadastrada como "membro atípico" é **a própria mãe** — nome, gênero e
data de nascimento dela. **Davi não existe no sistema.** O nome dele só aparece
dentro da frase que foi parar no campo "seu nome".

Era por isso que a Ayla dizia "a comunicação da Gisela", "como **ela** fica à
noite", "o cérebro **dela**": estava obedecendo o registro.

## Identidade — inequívoca

As mensagens da própria mãe, na ordem:

> "Eu o meu **filho** que e autista" · "**ele** vai para escola de manhã" ·
> "levo **na terapia**" · "**ele** faz aula de reforço" ·
> "A noite **ele** fica no quarto no celular"

Somado ao conteúdo do campo `nome_mae` ("Meu Nome e **Gisela** Meu Filgo e
**Davi**"): Gisela é a mãe, Davi é o filho autista, em idade escolar. Sem dúvida.

## Linha do tempo — separa o que veio do formulário do que veio da conversa

| Hora (UTC) | O quê | Origem |
|---|---|---|
| 22:31:44 | família criada | — |
| 22:34:19 | membro + perfil criados | **formulário de onboarding** |
| 22:35:58 | membro atualizado | formulário |
| 22:37:26 | `diarios` (1 linha) | **conversa** |
| 22:41:53 | `categorias_extras.sono` + `sugestao_perfil_vivos` | **conversa** |

## Dependências — 24 tabelas têm FK para `membros_atipicos`

Apenas **4** têm linhas:

| Tabela | Linhas | Origem |
|---|---:|---|
| `ayla_messages` | 11 | conversa |
| `perfil_vivo_membro` | 1 | formulário + conversa |
| `diarios` | 1 | conversa |
| `sugestao_perfil_vivos` | 1 | conversa |

As outras 20 (`rotinas`, `planos`, `relatorios_gerados`, `evolucao_snapshots`,
`eventos_membro`, `historias`, `desenhos`, `conversas`, …) estão **vazias**.

## Classificação

**A. Pertencem ao Davi** — tudo que veio da conversa:
- `categorias_extras.sono` = "O que atrapalha: celular à noite" ← "A noite ele fica no quarto no celular"
- `diarios` (1) — sobre a noite/agenda dele
- `sugestao_perfil_vivos` (1, campo `sono`, valor vazio)
- `ayla_messages` (11)

**B. Pertencem à Gisela (a mãe)** — as três colunas de identidade:
- `nome` = "Gisela Fróes Mathias Duarte"
- `genero` = "feminino"
- `data_nascimento` = 1984-04-09

**C. AMBÍGUOS — e é isto que trava a correção automática:**
- `diagnosticos_formais` — **seis** entradas, com `"TEA"` e `"Hipótese: TEA"`
  ao mesmo tempo (contraditório), e `"Deficiência intelectual"`. Num cadastro
  que sabidamente foi preenchido errado, renomear o registro transformaria
  esses seis rótulos em diagnósticos **do Davi, por afirmação nossa**. É dado
  de saúde de criança.
- `desafios_onboarding` = `["comunicacao","nutricional","emocional"]` — marcados
  na seção da pessoa atípica, que é justamente onde ela pôs a própria
  identidade. Provavelmente do Davi, mas não comprovado.
- `como_e.interesses` / `preferencias.temas` = `["música","cinema"]` — mesma
  seção, e **nunca mencionados na conversa**. Podem ser dela.

**D. Sem dependência:** as 20 tabelas vazias.

## Por que NÃO executei

A identidade é inequívoca, mas **o que está pendurado nela não é**. Renomear o
registro de Gisela para Davi não move só o nome: move junto seis diagnósticos
formais, três desafios e dois interesses cuja origem não conseguimos provar.

Isso é exatamente o risco nomeado na autorização — *"não houver risco de
atribuir dados da mãe ao filho"* — e ele existe, com dado clínico no meio.

A regra dada foi: **havendo ambiguidade real, registrar e seguir.** É o que foi
feito.

## O que precisa ser confirmado com a família (2 perguntas)

1. **Data de nascimento do Davi** — não existe no banco. Não inventar.
2. **Quais dos seis diagnósticos são do Davi**, e quais foram marcados por
   engano. Se ela não confirmar, o correto é deixar `["TEA"]` (o único que ela
   afirmou por escrito: *"meu filho que é autista"*) ou vazio.

Bônus, se ela quiser responder: os interesses (música/cinema) são dele?

---

## SQL

### A. Leitura (rodar antes — a saída É o rollback)

```sql
SELECT id, family_account_id, nome, genero, data_nascimento, idade,
       perfil, diagnosticos_formais, ativo, created_at, updated_at
FROM public.membros_atipicos
WHERE id = 'e81ab779-0033-4e96-adca-e3de321f1a3d';

SELECT family_account_id, nome_mae, como_chamar
FROM public.family_profiles
WHERE family_account_id = '4748506b-9180-4b98-8eec-f0c8566e5419';

-- confirma que só estas 4 tabelas têm linhas
SELECT 'ayla_messages' t, count(*) FROM public.ayla_messages         WHERE membro_atipico_id = 'e81ab779-0033-4e96-adca-e3de321f1a3d'
UNION ALL SELECT 'diarios',        count(*) FROM public.diarios               WHERE membro_atipico_id = 'e81ab779-0033-4e96-adca-e3de321f1a3d'
UNION ALL SELECT 'sugestoes',      count(*) FROM public.sugestao_perfil_vivos WHERE membro_atipico_id = 'e81ab779-0033-4e96-adca-e3de321f1a3d'
UNION ALL SELECT 'perfil_vivo',    count(*) FROM public.perfil_vivo_membro    WHERE membro_atipico_id = 'e81ab779-0033-4e96-adca-e3de321f1a3d';
```

### B. Correção proposta — **corrigir o registro existente**, não criar outro

**Por quê esta e não "criar Davi e migrar":** as 4 tabelas com linhas contêm
**exclusivamente dados do Davi** (vieram da conversa sobre ele). O que está
errado são as 3 colunas de identidade. Renomear preserva 100% dos dados com
zero movimentação de FK. Criar um membro novo exigiria mover 4 tabelas e depois
apagar o registro antigo — e `on delete cascade` **destruiria as 11 mensagens e
o diário** se algo escapasse da migração. Renomear é estritamente mais seguro.

```sql
-- Só depois de confirmar (1) e (2) com a família.
BEGIN;

UPDATE public.membros_atipicos
SET nome            = 'Davi',        -- só o primeiro nome: o sobrenome não está comprovado
    genero          = 'masculino',   -- comprovado: "meu filho", "ele" em 5 mensagens
    data_nascimento = NULL,          -- DESCONHECIDA — não inventar
    idade           = NULL,
    diagnosticos_formais = '["TEA"]'::jsonb,  -- ou o que a família confirmar
    updated_at      = now()
WHERE id = 'e81ab779-0033-4e96-adca-e3de321f1a3d';

-- O nome da mãe: "Gisela" está comprovado no texto que ela mesma escreveu.
UPDATE public.family_profiles
SET nome_mae = 'Gisela', updated_at = now()
WHERE family_account_id = '4748506b-9180-4b98-8eec-f0c8566e5419';

COMMIT;
```

`perfil` fica em `'TEA'` (ela escreveu "meu filho que é autista").
`categorias_extras` **não é tocado** — o `sono` é do Davi, e os campos
ambíguos ficam como estão até a família confirmar.

### C. Rollback

```sql
BEGIN;
UPDATE public.membros_atipicos
SET nome            = 'Gisela Fróes Mathias Duarte',
    genero          = 'feminino',
    data_nascimento = '1984-04-09',
    idade           = NULL,
    perfil          = 'TEA',
    diagnosticos_formais = '["TEA","TDAH","Dislexia","Deficiência intelectual","Hipótese: TEA","Hipótese: TDAH"]'::jsonb,
    updated_at      = now()
WHERE id = 'e81ab779-0033-4e96-adca-e3de321f1a3d';

UPDATE public.family_profiles
SET nome_mae = 'Meu Nome e Gisela Meu Filgo e Davi Ele e Autista', updated_at = now()
WHERE family_account_id = '4748506b-9180-4b98-8eec-f0c8566e5419';
COMMIT;
```

### D. Linhas alteradas
2 — uma em `membros_atipicos`, uma em `family_profiles`.

### E. Tabelas tocadas
`membros_atipicos`, `family_profiles`. Mais nenhuma.

### F. Risco de perda de dados
**Nenhum.** Não há `DELETE`, e nenhuma FK se move. As 11 mensagens, o diário,
a sugestão e o perfil vivo continuam ligados ao mesmo `id`.

### G. Como validar depois

```sql
SELECT nome, genero, data_nascimento, perfil, diagnosticos_formais
FROM public.membros_atipicos WHERE id = 'e81ab779-0033-4e96-adca-e3de321f1a3d';
-- esperado: Davi | masculino | NULL | TEA | ["TEA"]

SELECT count(*) FROM public.ayla_messages
WHERE membro_atipico_id = 'e81ab779-0033-4e96-adca-e3de321f1a3d';
-- esperado: 11 (inalterado)
```

E, na conversa: a próxima mensagem da Ayla deve falar de **Davi**, no
masculino, e a saudação deve usar **Gisela**.

---

## Nota sobre uma linha que fica estranha

O `diarios` de 22:37 registra *"À noite fica **agitada** com dificuldade para
dormir…"*. Duas coisas erradas ali: o feminino, e o fato de que **a mãe nunca
confirmou agitação nem dificuldade de dormir** — a Ayla perguntou e, antes da
resposta, afirmou como se soubesse. Não apaguei (seria perda de dado e não foi
autorizado). Fica registrado: depois da correção, essa linha continuará no
feminino e com uma premissa que a família não confirmou.

O comportamento que gerou essa linha — afirmar antes de a mãe responder — é o
que a VOZ nova proíbe (`SÓ AFIRMO O QUE SUSTENTO`), e produção ainda não a tem.
