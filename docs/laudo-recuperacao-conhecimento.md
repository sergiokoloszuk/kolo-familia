# Laudo — como o conhecimento chega ao raciocínio da Ayla

Missão **INVESTIGAR** (PEND-017 · sub-frente de arquitetura de recuperação).
Nada foi implementado, alterado ou publicado. Data: **2026-08-08**.
Medições feitas contra o banco de **produção**, por leitura, reproduzindo a
query real do código.

**A pergunta:** *quando a família fala alguma coisa, como o conhecimento chega
até o raciocínio da Ayla — e por que muitas vezes chega genérico ou repetido?*

---

## Correção de um enunciado meu anterior

Em 2026-08-08 eu registrei que *"mesma skill → mesmo bloco, para toda família,
toda vez"*. **Isso é forte demais e está corrigido aqui.** A idade filtra de
verdade e filtra bem: em `sono`, uma criança de 2 anos recebe ritual de
transição de cama e uma de 14 recebe atraso circadiano e mapa de cafeína.

O enunciado correto é: **o bloco é fixo por (skill, faixa etária)**. Ele não
varia com a família, com o perfil da criança, com o histórico, com o que já foi
tentado, nem com o que a mensagem de fato diz. Duas famílias diferentes, com
filhos da mesma idade, falando de coisas diferentes dentro do mesmo tema,
recebem o mesmo repertório.

---

## A · AS-IS técnico

### O caminho, etapa por etapa

| # | Etapa | Arquivo | Entrada → Saída | Log persistido |
|---|---|---|---|---|
| 1 | Mensagem chega | `api/ayla/webhook` → `lib/ayla/orchestrator.ts` | texto → contexto da família | não (o texto fica em `ayla_messages`) |
| 2 | Classificação | `lib/ayla/intent.ts` · `classificarIntencao` | texto + catálogo de skills → `intencao\|tema\|aceite\|skills` | **não** |
| 3 | Catálogo de skills | `lib/ayla/catalogo-skills.ts` | tabela `specialist_prompt_templates` onde `ativo = true` → `{name, routing_keywords}` | não |
| 4 | Consulta | `lib/conhecimento/recuperar.ts` · `recuperarBoasPraticas` | skills (+tags na web) → até 40 linhas | **não** |
| 5 | Filtro de idade | mesma função, em memória | 40 linhas + idade → candidatas | não |
| 6 | Ordenação final | mesma função | candidatas → skill principal na frente | não |
| 7 | Corte | mesma função | → **3 itens** | não |
| 8 | Bloco | `blocoBoasPraticas` | 3 itens → `<repertorio_kolo>` | não |
| 9 | Prompt | `lib/ayla/responder.ts` (WA) · `lib/ia/prompt.ts` (web) | bloco + contexto → system+user | não |
| 10 | Resposta | provider | → texto | a resposta sim (`ayla_messages`) |

**Nenhuma etapa entre a 2 e a 9 deixa rastro persistido.** É por isso que não se
consegue responder, para nenhuma resposta real já enviada, quais boas práticas a
sustentaram.

### Regra de cada etapa

- **Etapa 2 — quem decide o que buscar.** Um modelo, num campo de texto. O 4º
  campo da linha de classificação. `parseSkills` só aceita nomes que estejam no
  catálogo (`permitidas`); nome fora do vocabulário é **descartado em silêncio**.
  Máximo de duas skills: a primeira é a principal, a segunda é complementar.
- **Etapa 4 — a consulta.** Não usa o texto da mensagem. Não usa o perfil. Não
  usa o histórico. Usa **rótulos**.
- **Etapa 5 — idade.** Tolerante de propósito: BP sem faixa entra; idade
  desconhecida não elimina ninguém. É a única personalização real.
- **Etapa 6 — skill principal na frente.** Garante que o bloco seja sobre o
  problema trazido, e não sobre a skill complementar.
- **Etapa 7 — três.** Padrão do código; a web e o WhatsApp usam o mesmo.

### Fallbacks

| Situação | O que acontece |
|---|---|
| Classificador não devolve skill | `skills: []` → recuperação devolve `[]` → **bloco ausente**, conversa segue |
| Skill fora do vocabulário | descartada em `parseSkills` → mesmo efeito acima |
| Skill ativa sem acervo | consulta devolve 0 linhas → **bloco ausente** |
| Erro na consulta ao banco | `catch` → `console.warn` → devolve `[]` → **bloco ausente** |
| Catálogo de skills falha ao carregar | catálogo vazio → o prompt do classificador nem pede skill → `[]` |

**Os cinco casos produzem exatamente o mesmo resultado observável: nenhum
repertório, e nenhum registro.** Falha de infraestrutura e ausência legítima de
repertório são indistinguíveis, de dentro e de fora.

---

## Query real (§2)

Uma só função monta as duas. A diferença entre canais está **no argumento**, não
na query.

```
GET /rest/v1/boas_praticas
  select = titulo, versao_curta, versao_conversa, quando_usar, erros_comuns,
           passos_praticos, skills_relacionadas, tags, peso_relevancia,
           faixa_etaria_min, faixa_etaria_max
  status = in.("ativo")
  or     = ( skills_relacionadas.cs.["<skill1>"] ,
             skills_relacionadas.cs.["<skill2>"] ,
             tags.cs.["<tag1>"] , … até 12 tags )
  order  = peso_relevancia.desc
  limit  = 40
```

- **WHERE** — `status = 'ativo'` **E** (contém a skill **OU** contém a tag).
  `OR`, não `AND`: uma BP entra por qualquer cláusula que case.
- **ORDER BY** — `peso_relevancia desc`. **Sem critério de desempate.**
- **LIMIT** — 40 no banco; o corte para 3 é em memória, depois da idade.
- **skill** — no WhatsApp e na web.
- **tags** — **só na web**, teto de 12.
- **data / versão / validade** — **não existem na consulta.** As colunas
  `versao` e `updated_at` existem na tabela e **nunca** são lidas na
  recuperação. Não há como preferir conteúdo mais novo nem excluir conteúdo
  vencido.
- **`perfis_aplicaveis`** (TEA/TDAH/Outro) — a coluna existe, está preenchida, e
  **não é usada em lugar nenhum da recuperação**.
- **`nivel`** (iniciante/intermediário/avançado) — idem.
- Injeção: os nomes entram numa query string, então há um filtro
  `/^[a-z0-9_]{2,40}$/` — um valor com aspas quebraria o `or` inteiro.

---

## B · Causa provável do ranking inerte

**Não é descuido de curadoria. É um mecanismo que nunca foi construído.**

A coluna nasceu em `0001_init.sql:352`, sob o comentário literal
**`-- Aprendizado contínuo`**:

```sql
peso_relevancia numeric not null default 0.5 check (peso_relevancia between 0 and 1),
```

A intenção original, lida no próprio schema, era um **sinal aprendido com o
uso** — não um número que alguém digita. Essa é a leitura mais provável, e o
resto dos dados a sustenta:

- **Nenhum código escreve a coluna com valor calculado.** Os únicos escritores
  são a extração por IA (`lib/ia/extract-boas-praticas.ts:156`), que grava
  `0.5` fixo, e o seed.
- **O Admin não expõe o campo.** A tela de detalhe faz `select` da coluna, mas o
  formulário (`bp-form.tsx`) **não tem input para ela**. Ou seja: nem humano nem
  máquina pode mudar o peso pela interface do produto.
- **Nunca houve rotina de preenchimento.** Nenhum script, migração ou job.
- **As três exceções não são curadoria: são o seed de demonstração.** As três
  únicas BPs com peso ≠ 0,5 foram criadas em **2026-05-23**, todas com
  `origem = 'admin'`, e são exatamente as três linhas escritas à mão em
  `0003_seed.sql` quando o banco foi provisionado. As 368 que vieram depois (o
  acervo da Karina) entraram todas no default.
- **367 das 371 já foram editadas alguma vez** (`updated_at ≠ created_at`) — o
  acervo foi mexido, e o peso não.

**A consequência é o ponto:** como 99% empata, `ORDER BY peso_relevancia DESC`
**não ordena**. Quem decide as 40 linhas devolvidas — e portanto as 3
entregues — é a ordem física da tabela. E as três linhas do seed de
demonstração de 23/05, por terem 0,7 e 0,8, são as únicas que ganham de todo o
resto: aparecem no topo de `comunicacao`, `sensorial` e `transicoes` desde
sempre.

> **Não assumir que a solução é preencher pesos.** Um número global por BP não
> pode responder "isto serve para *esta* criança agora", que é a pergunta.
> Preencher pesos trocaria uma ordem arbitrária por uma ordem fixa — melhor,
> mas ainda sem relação com o caso. A decisão está em **J**.

---

## C · Web × WhatsApp (§6)

**A diferença é uma coluna a menos num `select`.**

- A web roteia sobre **linhas** da tabela `specialist_prompt_templates` e já tem
  o objeto inteiro, então passa `skills` **e** `knowledge_tags`
  (`lib/ia/context.ts:141-145`).
- O WhatsApp carrega o catálogo em `lib/ayla/catalogo-skills.ts`, que faz
  `.select("name, routing_keywords")` — e o tipo `SkillDoCatalogo` tem só esses
  dois campos. O classificador devolve **nomes**, então na hora de recuperar não
  há de onde tirar tag.

**É drift, não decisão.** Mesma tabela, mesma linha, mesma consulta possível:
falta `knowledge_tags` no `select`. Não há comentário, teste ou registro que
justifique a ausência — e todo o resto do módulo `lib/conhecimento` foi escrito
em 06/08 exatamente para acabar com a assimetria entre canais.

**Impacto medido hoje: pequeno.** Rodando as 13 skills ativas, com idade 6, o
bloco final muda em **1 de 12** (`sensorial`; a 13ª não tem acervo). Nas outras,
as tags aumentam as candidatas mas não alteram os 3 escolhidos, porque o teto de
40 e o empate de peso já dominam.

> Ou seja: **hoje a assimetria quase não muda a resposta — e isso é sintoma, não
> alívio.** As tags não mudam nada porque o ranqueamento não funciona. Consertar
> o ranqueamento faz a assimetria virar diferença real entre os canais. As duas
> coisas precisam ser resolvidas juntas, ou a web e o WhatsApp voltam a ser duas
> Aylas — desta vez no conhecimento.

---

## D · O que personaliza e o que não personaliza (§5)

| Dado | Existe? | Chega à query? | Chega ao modelo? | Influencia o ranking? |
|---|---|---|---|---|
| **Idade** | sim | **sim** | sim (`Em foco: nome, N anos`) | **sim — o único** |
| Perfil da criança (Kolo Vivo) | sim | **não** | sim (`<o_que_ja_sabemos_da_crianca>`) | não |
| Diagnóstico / hipótese | sim | **não** — e a coluna `perfis_aplicaveis` da BP existe e não é usada | sim | não |
| Preferências / interesses | sim | **não** | sim (com aviso de que pode estar velho) | não |
| Sensibilidades | sim | **não** | sim, dentro do perfil | não |
| Habilidades / o que já faz | sim | **não** | sim, dentro do perfil | não |
| Histórico da conversa | sim | **não** | sim (`<conversa_recente>`) | não |
| Estratégias já tentadas | sim (`carregarEstrategiasRecentes`) | **não** | sim (`<perguntas_recentes_nas_estrategias>`) | não |
| Estratégias que funcionaram | **parcial** — o feedback existe, mas não como campo consultável | não | não como tal | não |
| Contexto recente / tema ativo | sim | **não** | sim | não |
| Escola | parcial, dentro do perfil | não | quando está no perfil | não |
| Composição da família | **não** — e o prompt manda não presumir | não | não | não |
| Canal | sim | **sim, por omissão** (tags só na web) | sim (formato) | indiretamente |
| Lacunas do perfil | sim | não | sim (`<lacunas_do_perfil>`) | não |

**Leitura:** o modelo recebe um retrato razoavelmente rico da criança **e um
repertório escolhido sem olhar para esse retrato**. A personalização acontece
inteiramente **depois** da recuperação, dentro do modelo, que precisa adaptar
sozinho um conteúdo que foi selecionado para "criança de 6 anos com dificuldade
de sono", não para aquela criança.

E é isso que o próprio bloco pede, por escrito: *"adapte à idade e aos interesses
da criança que você já conhece, em vez de repetir o passo literal"*. **A
personalização é delegada ao modelo como instrução, porque não existe na
seleção.**

### Dois achados colaterais, do mesmo lugar

1. **`meu_bem_estar` é uma skill ATIVA com ZERO boas práticas.** Quando o
   assunto é o esgotamento de quem cuida — o desabafo mais comum desta base, 44
   ocorrências em 17 famílias —, o classificador pode rotear para ela e o bloco
   de repertório vem **vazio**. A Ayla responde de conhecimento genérico, e nada
   registra que foi isso que aconteceu.
2. **Quanto do acervo chega a aparecer**, somando **todas** as faixas etárias
   (1, 2, 3, 5, 7, 9, 11, 14, 17 e idade desconhecida):

   | skill | títulos distintos em 10 faixas | acervo da skill | % |
   |---|---|---|---|
   | comunicacao | 5 | 66 | **8%** |
   | emocional | 11 | 75 | 15% |
   | rotina | 11 | 45 | 24% |
   | sensorial | 10 | 38 | 26% |
   | sono | 11 | 31 | 35% |

   Ou seja: **entre 65% e 92% do acervo de cada skill nunca aparece para
   ninguém**, em nenhuma idade. Não porque foi julgado pior — porque empatou e
   ficou atrás na ordem física.

Correção de um dado antigo, de passagem: a memória de 30/07 dizia que ~55% do
acervo estaria inalcançável por skills inativas. **Isso não vale mais.** Hoje 13
das 14 skills estão ativas e **100% das BPs ativas têm ao menos uma skill no
catálogo ativo**. A inalcançabilidade de hoje é do ranking, não do catálogo.

---

## E · Rastreabilidade (§7)

**Hoje, não.** Não é possível responder *"esta resposta foi sustentada por quais
boas práticas?"* para nenhuma resposta já enviada. Não há registro de skill
classificada, de BPs recuperadas, nem de bloco montado.

Isso tem três consequências, em ordem de gravidade:

1. **Bloqueia a própria validação que a PEND-017 exige** — os 10–15 casos
   MENSAGEM → CONHECIMENTO RECUPERADO → RESPOSTA são impossíveis olhando para
   trás. Este laudo faz o que dá: **reconstitui** o que a recuperação *teria*
   devolvido, e marca isso como reconstituição.
2. **Impede medir qualquer melhoria.** Sem antes, não há depois — e o protocolo
   proíbe fechar frente sem baseline.
3. **Impede saber se a base foi usada.** Uma resposta boa e uma resposta boa
   *apesar* do repertório são indistinguíveis.

### O mínimo que resolveria

Um registro por turno, **uma linha, não uma camada nova**, reusando `logEvent` e
`eventos_app` (que já é o lugar de estado de conversa nesta base):

```
kind: "conhecimento_recuperado"
família · membro · skill principal · skill complementar · idade usada
· ids das BPs entregues (não os títulos) · quantas candidatas vieram
· houve erro? · canal
```

Três decisões de projeto que fazem isso não virar log inútil:
- **IDs, não texto.** O conteúdo já está na tabela; duplicá-lo envelhece.
- **Um evento por turno**, não por BP.
- **Severidade `warn` quando o bloco sai vazio**, porque hoje `info` não
  persiste nesta base — e bloco vazio é justamente o caso que ninguém vê.

Com isso, três perguntas passam a ter resposta: *quais BPs sustentaram esta
resposta* · *com que frequência o bloco sai vazio* · *quais BPs nunca são
entregues a ninguém*.

**Não implementado.** É proposta.

---

## F · Erros provavelmente mal classificados como prompt ou condução (§10)

Sintomas hoje atribuídos à redação, com origem mecânica plausível na
recuperação. **Isto é atribuição de causa provável, não prova por caso** — a
prova por caso depende de E.

| Sintoma | Origem mecânica | Confiança |
|---|---|---|
| **"Repete"** | mesmo (skill, faixa) → mesmos 3 itens, sem memória do que já foi entregue àquela família | **alta** — é determinístico e verificável |
| **"Genérica"** | o repertório é selecionado por rótulo de tema, sem nada da criança; e 8–35% do acervo é tudo o que circula | **alta** |
| **"Usa pouco a base"** | em parte é verdade e em parte é invisível: quando o bloco vem vazio (skill sem acervo, classificação vazia, erro engolido) a Ayla responde de conhecimento genérico e nada registra | **alta** |
| **"Recomenda fora do contexto"** | conteúdo de faixa vizinha entra quando a idade é desconhecida — e idade ausente **não** elimina ninguém, de propósito | **média** — depende de quantas famílias estão sem data de nascimento |
| **"Pergunta demais"** | hipótese herdada da D2: o acervo em versão genérica, sem os braços escritos, obriga a perguntar antes de orientar | **baixa — hipótese**, precisa de leitura de conteúdo, não de medição |

O corolário prático: **pelo menos os três primeiros não se corrigem com
prompt.** Já foram alvo de ajuste de redação antes; a causa não estava lá.

---

## G · Critérios de uma recuperação boa (§11)

Poucos e mensuráveis. Proposta a aprovar — **critério é decisão, não achado**.

1. **RELEVÂNCIA AO CASO.** O item serve à situação descrita, não ao tema dela.
   *Medida:* juízo humano numa amostra rotulada (dataset em H), com o `quando_usar`
   da BP como âncora. Não há atalho automático honesto aqui.
2. **ADEQUAÇÃO À CRIANÇA.** Idade **e** perfil. Hoje só idade.
   *Medida:* % de itens entregues incompatíveis com o que se sabe da criança.
3. **CIRCULAÇÃO DO ACERVO.** Quanto do material aprovado chega a alguém.
   *Medida:* % de BPs entregues ao menos uma vez em 30 dias. Hoje: ≤35% por
   skill, e isso é medível continuamente assim que E existir.
4. **NÃO REPETIR SEM MOTIVO.** A mesma família não recebe o mesmo item de novo,
   a menos que ele siga sendo o melhor.
   *Medida:* taxa de repetição por família por skill em 30 dias. Hoje: 100%.
5. **ATUALIDADE E NÃO CONTRADIÇÃO.** Nada vencido; nada que contradiga outro
   item do mesmo bloco.
   *Medida:* hoje **não é medível** — não há data nem validade na consulta.
   Registrar como lacuna, não como métrica falsa.
6. **EXPLICABILIDADE.** Para qualquer resposta, saber o que a sustentou.
   *Medida:* binária. Hoje: **não**.

> Deliberadamente **fora**: "diversidade". Diversidade sem relevância é ruído, e
> o risco desta base agora é o oposto do excesso de variedade.

---

## H · Dataset de validação (§12)

Casos **reais**, localizados na produção. Sem ground truth inventado: onde o
conhecimento desejável depende de julgamento clínico ou editorial, está marcado
**JULGAMENTO HUMANO NECESSÁRIO** — a Karina decide, não o agente.

| # | Tema | Mensagem real (resumida) | Data | O que torna o caso útil |
|---|---|---|---|---|
| 1 | Transição / banho | *"Todo dia, na hora de parar de brincar pra tomar banho, vira uma briga enorme — chora, grita e se joga no chão. Já faz semanas."* | 15/06 | pedido explícito, tema limpo, recorrência declarada — testa se o repertório fala de **transição** e não de "birra" |
| 2 | Socialização | *"Está sem brincar com amigas. Prefere ficar com adultos. Como converso com ela?"* | 09/06 | a mãe pede **como conversar**, não como fazer a criança brincar — testa se a recuperação segue o pedido ou o rótulo |
| 3 | Socialização adolescente | *"Ele está muito ansioso e queria tentar fazer novos amigos… alguma menina que ele esteja paquerando"* | 11/06 | idade alta + tema afetivo — testa a faixa etária num tema onde o acervo é de criança pequena |
| 4 | Comunicação / regressão | *"Não está falando. Tinha começado umas palavras e agora não quer falar nada."* | 14/06 | **regressão**, não atraso — testa se o acervo distingue; também é o caso que mais tenta puxar a fronteira do diagnóstico |
| 5 | Medo / sensorial | *"Está sem sair de casa, diz ter medo de tudo. Não aguenta barulho. Ao mesmo tempo não me obedece."* | 11/06 | três temas numa frase — testa a escolha da skill principal |
| 6 | Escola | *"Tem chegado muito cansada da escola. Acho que esta escola não é boa"* → mudança de professora há 2 meses | 22/07 | o caso que escalou para *"não aguento mais"*; testa recuperação **ao longo** de uma conversa, não num turno |
| 7 | Bem-estar de quem cuida | *"O dia está difícil. Não aguento mais."* | 24/07 | **repertório hoje é vazio** (`meu_bem_estar` sem acervo) — é o caso que prova o buraco |
| 8 | Sono | *a localizar* | — | ⚠️ não achei um caso limpo: os hits de "sono" se confundem com recusa escolar. **Precisa de leitura humana** |
| 9 | Alimentação | *a localizar* | — | ⚠️ meu filtro pegou "começou" por "comeu". A conversa da uva-passa é candidata. **Precisa de leitura humana** |
| 10 | Conquista / evolução | *a localizar* | — | ⚠️ mesmo problema. É o caso que testa se a Ayla sabe **não** entregar repertório quando a mãe só quer comemorar |

Para cada caso, o formulário de avaliação:

```
MENSAGEM · CONTEXTO · CRIANÇA (idade, perfil)
CONHECIMENTO DESEJÁVEL — e por quê
CONHECIMENTO INADEQUADO — e por quê (inclui "nenhum": há casos que não pedem repertório)
QUEM JULGOU · DATA
```

**Nota metodológica:** os casos 8, 9 e 10 estão vazios de propósito. Preencher
com um caso que eu escolhi por regex seria exatamente o ground truth arbitrário
que a missão proíbe.

---

## I · Opções de arquitetura (§13) — nenhuma escolhida

Ordenadas do mais barato ao mais caro. As três primeiras são **pré-requisito de
qualquer avaliação**, não melhoria de qualidade.

### I.0 · Rastro (E)
**Benefício:** torna tudo o mais mensurável; sem ele nenhuma outra opção pode
ser validada. **Risco:** baixo; é escrita adicional num caminho best-effort.
**Complexidade:** baixa. **Dados:** nenhum novo. **Como validar:** reconstruir
uma conversa real de ponta a ponta.

### I.1 · Tags no WhatsApp
Acrescentar `knowledge_tags` ao `select` do catálogo. **Benefício:** encerra a
assimetria entre canais. **Risco:** hoje muda 1 skill em 12 — e **cresce** se o
ranking melhorar; é por isso que anda junto. **Complexidade:** trivial.
**Como validar:** diff do bloco nas 13 skills, antes e depois.

### I.2 · Desempate estável e explícito
Trocar a ordem física por um critério declarado (por exemplo: skill principal,
depois aderência de faixa, depois rotação). **Benefício:** acaba com "os 3 de
sempre" sem construir nada novo; ataca o critério 3 e o 4. **Risco:** rotação
sem relevância pode piorar a resposta — troca repetição por sorteio.
**Complexidade:** baixa. **Dados:** o rastro, para medir circulação.

### I.3 · Peso curado por humano
Expor o campo no Admin e a Karina priorizar. **Benefício:** editorial de verdade
no ranqueamento. **Risco:** **não resolve a pergunta certa** — um número global
não sabe o que serve para esta criança agora; e cria trabalho manual permanente
sobre 370 itens. **Complexidade:** baixa. **Como validar:** só contra o dataset.

### I.4 · Filtros que já estão pagos e não são usados
Usar `perfis_aplicaveis` e `nivel` na consulta. **Benefício:** personalização
imediata sem nova infraestrutura — os dados já existem e estão preenchidos.
**Risco:** filtrar demais e esvaziar o bloco em família sem perfil registrado;
precisa da mesma tolerância da idade. **Complexidade:** baixa.

### I.5 · Busca semântica (embeddings) sobre a mensagem
**Benefício:** a consulta passa a olhar o que a família disse, não o rótulo.
**Risco:** é exatamente o "texto parecido com a mensagem" contra o qual a ficha
adverte — recupera o que ecoa as palavras, não o que ajuda a raciocinar; e não
resolve idade nem perfil sozinho. **Complexidade:** média-alta (coluna vetorial,
extensão no Supabase self-hosted, backfill de 371 itens, custo por turno).
**Dados:** embeddings do acervo. **Como validar:** dataset H, contra o AS-IS.

### I.6 · Híbrido com reranking
Recuperar largo por skill+tags+semântica, e reordenar com um passo que **enxerga
a criança** (idade, perfil, o que já foi tentado, o que já foi entregue).
**Benefício:** é a única opção que ataca os critérios 1, 2 e 4 juntos, e a única
que responde "para esta criança agora". **Risco:** latência e custo por turno
num caminho que hoje é uma query; mais peças para falhar em silêncio.
**Complexidade:** alta. **Dados:** rastro + dataset + embeddings.
**Como validar:** só com H, e só depois de I.0.

### I.7 · Conteúdo, não busca
Nada disso conserta `meu_bem_estar` sem acervo, nem o acervo escrito em versão
genérica que obriga a perguntar (D2). **Benefício:** o teto de qualquer
recuperação é o que existe para recuperar. **Complexidade:** editorial, não
técnica. **Depende da Karina.**

---

## J · Decisões que precisam do Sérgio (ou da Karina)

1. **O `peso_relevancia` continua a existir?** Ele nasceu como "aprendizado
   contínuo" e nunca aprendeu nada. As saídas são: (a) virar campo editorial que
   um humano mantém; (b) virar sinal calculado a partir de uso e feedback;
   (c) ser aposentado, e o ranqueamento passar a ser outra coisa. **Recomendo
   não decidir isto isolado** — é consequência de qual opção de I entra.
2. **Rastro entra antes de qualquer melhoria?** Minha recomendação é sim, e é
   a única coisa que eu faria antes do DESEJADO fechar: sem ele, nenhuma
   mudança pode ser provada, e a própria PEND-017 não fecha.
3. **Qual é a ambição desta frente?** Consertar o ranqueamento (I.1–I.4, dias)
   ou mudar a arquitetura de recuperação (I.5–I.6, semanas). São respostas
   diferentes para "por que chega genérico".
4. **Quem preenche os casos 8, 9 e 10 do dataset**, e quem julga o conhecimento
   desejável dos 10? Sem isso não há critério 1.
5. **`meu_bem_estar` sem acervo é lacuna de conteúdo ou de desenho?** Se a Kolo
   quer acolher quem cuida com repertório, alguém precisa escrevê-lo. Se não
   quer, a skill não deveria estar ativa roteando para o vazio.
6. **A tolerância a idade desconhecida se mantém?** Hoje idade ausente não
   elimina nada, e isso é deliberado. Se muitas famílias estão sem data de
   nascimento, essa escolha está entregando conteúdo de faixa errada com
   frequência — dá para medir assim que houver rastro.

---

## Portões

| Portão | Estado |
|---|---|
| BASELINE | **PARCIAL** — a estrutura está medida; o comportamento por conversa real **não**, por falta de rastro |
| CAUSA RAIZ | **ESTABELECIDA** para o ranking inerte e para a assimetria entre canais |
| VALIDAÇÃO REAL | **NÃO VALIDADO** — reconstituição, não observação. Marcado em todo o laudo |
| OBSERVABILIDADE | **LACUNA CRÍTICA** — apontada, não corrigida |
| IMPLEMENTAÇÃO / TESTES / DEPLOY | **NÃO SE APLICA** — missão INVESTIGAR |

**VEREDITO: PASSOU COM RESSALVAS.** As perguntas de A a J estão respondidas com
evidência, exceto a validação por conversa real, que está **bloqueada pela falta
de rastreabilidade** — e essa é a primeira decisão da lista.
