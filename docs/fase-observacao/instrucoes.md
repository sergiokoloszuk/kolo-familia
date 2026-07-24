# Fase de Observação — instruções (Perfil Vivo v2)

> **Objetivo:** entender como os dados REAIS se comportam antes de desenhar a taxonomia e o schema. **Sem tocar no banco.** Não criar `perfil_fatos`, não alterar o detector, não rodar reconciliação. Só observar e classificar à mão.

## Passo a passo

1. **Amostrar (estratificado).** Rode a **Query 1** (`amostragem.sql`). Escolha **30-50 crianças** cobrindo os extremos — NÃO só as de muito conflito:
   - muitos conflitos / poucos / **zero**; recente / antigo; muita info / pouca; com atualização recente.
   - Anote os `membro_id` e o critério de cada escolha (vai no resumo final).
2. **Extrair.** Cole os IDs nas **Queries 2, 3 e 4**. Exporte em CSV.
   - Query 2 = os conflitos (dois lados + alerta). Query 3 = os fatos de origem (audit). Query 4 = o resumo.
3. **Classificar à mão** na `planilha-classificacao.csv` — **uma linha por divergência** (ou conjunto relacionado). Ver campos abaixo.
4. **Fechar** com o resumo quantitativo (seção "Resultado esperado").

**Privacidade:** só `membro_id` interno, nunca nome. Se um texto trouxer o nome da criança, troque por `[nome]` ao colar.

## Unidade de análise

Não classifique só o **alerta**. Olhe também: os **textos de origem** de cada lado (`texto_a`/`texto_b`), a **área** de cada um, as **datas**, a **fonte/autor**, o **canal** (quando der), e o **texto consolidado** atual. Assim dá pra ver se o problema veio da **informação original**, da **consolidação por área**, ou do **detector**.

## Categorias (`classificacao_humana` — pode marcar 2ª em `classificacao_secundaria`)

| valor | quando |
|---|---|
| `evolucao_temporal` | as duas foram verdadeiras em **momentos diferentes** |
| `diferenca_contexto` | muda conforme **ambiente/pessoa/demanda** |
| `oscilacao_funcional` | a habilidade **existe mas não é estável** |
| `fontes_diferentes` | **pessoas distintas** observaram coisas diferentes |
| `granularidade_diferente` | descrevem **níveis diferentes** da mesma habilidade |
| `evento_isolado_virou_padrao` | um acontecimento pontual virou **traço** |
| `duplicacao_entre_areas` | o mesmo fato salvo em 2 domínios e evoluiu separado |
| `erro_extracao_ia` | a IA **entendeu/registrou errado** o relato |
| `erro_consolidacao` | fatos certos, mas o **parágrafo** os tornou contraditórios |
| `conflito_real` | mesmo conceito+contexto+período, **não podem coexistir** |
| `informacao_insuficiente` | falta contexto pra decidir |
| `nao_e_conflito` | o detector marcou algo **compatível** (falso positivo) |

## Ação ideal (`acao_ideal`)

`nenhuma` · `melhorar_redacao` · `conciliar_por_contexto` · `transformar_anterior_em_historico` · `confirmar_um_toque` · `pedir_explicacao_aberta` · `revisao_detalhada` · `corrigir_extrator` · `corrigir_detector` · `revisar_manual` · `nao_usar_em_automacoes_sensiveis`

## Criticidade (`criticidade`)

`baixo` (só visual) · `medio` (prejudica personalização) · `alto` (afeta relatório/orientação) · `critico` (saúde, alergia, medicação, regressão, risco, decisão importante)

## Conceito canônico candidato (`conceito_candidato`)

Qual habilidade transversal está **realmente** sendo descrita? Use as palavras que **surgirem nos casos reais** — NÃO invente uma taxonomia fechada agora. Ex.: `comunicacao.fala_expressiva`, `comunicacao.formacao_de_frases`, `comunicacao.narrativa`, `comunicacao.fluencia`, `socializacao.iniciativa`, `socializacao.participacao_em_grupo`, `regulacao.impacto_na_comunicacao`, `alimentacao.aversao_por_cheiro`. Depois a gente agrupa os repetidos.

## ⚠️ Cuidado essencial: IA sugere, humano decide

**A IA NÃO classifica os 50 casos e vira verdade.** Ela pode **pré-sugerir** pra acelerar, em coluna separada:
- `classificacao_sugerida_ia` — a categoria que a IA propôs.
- `classificacao_humana` — a decisão da pessoa (Karina/produto).
- `concordancia` — `sim`/`nao` (bate ou não).

Isso também **mede** o quanto a IA reconhece evolução × contexto × oscilação × conflito real — dado que vai decidir depois **o que pode ser automatizado**.

**Prompt pra pré-sugerir** (rodar por linha, preenchendo só `classificacao_sugerida_ia`):
> Dado um "conflito" detectado no perfil de uma criança neurodivergente, com os dois textos, áreas, datas e fontes abaixo, classifique em UMA das categorias: evolucao_temporal, diferenca_contexto, oscilacao_funcional, fontes_diferentes, granularidade_diferente, evento_isolado_virou_padrao, duplicacao_entre_areas, erro_extracao_ia, erro_consolidacao, conflito_real, informacao_insuficiente, nao_e_conflito. Responda só a categoria. Lembre: variação por contexto, oscilação, evolução no tempo ou fontes diferentes NÃO são conflito real.
>
> texto_a: {…} | area_a: {…} | data_a: {…} | fonte_a: {…}
> texto_b: {…} | area_b: {…} | data_b: {…} | fonte_b: {…}

## Resultado esperado (o que a fase precisa responder)

1. Que proporção dos alertas é **conflito real**?
2. Quantos são **evolução / contexto / oscilação / fontes diferentes**?
3. Quais **conceitos** aparecem mais?
4. Quais **áreas** mais duplicam?
5. Os erros vêm do **extrator, da consolidação ou do detector**?
6. Em que situações a **automação seria segura**?
7. Em que situações a **confirmação é indispensável**?
8. Que informações **não deveriam** entrar como traço (eventos isolados)?
9. Qual a **taxonomia mínima** da v1?
10. Quais **travas objetivas** compõem os níveis 1 a 4?

## O que NÃO fazer nesta fase

Não criar `perfil_fatos`. Não alterar o detector. Não rodar reconciliação automática. Não mudar nada no banco. Só observar.
