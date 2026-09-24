# Pós + Perfil real autorizado — A/B

**Data:** 24/09/2026
**Família:** Karina/Manu, explicitamente autorizada para QA
**Execução:** Supabase somente leitura; sem WhatsApp; sem persistência de
conversa; contexto bruto não foi copiado para o novo artefato
**Resultados brutos:** `pos-conhecimento-perfil-ab-2026-09-24.json` e
`pos-conhecimento-perfil-comunicacao-final-2026-09-24.json`

O decisor foi executado uma vez por caso e reutilizado nos ramos A e B. Assim,
nesta bancada a única variável foi a projeção em memória das quatro BPs da
Pós. As tentativas internas de registrar custo em `api_calls` foram bloqueadas
pelo guard de I/O e apareceram como `billing_nao_gravou`; nenhuma escrita foi
realizada.

## Resultado

| Caso | O que o Perfil já trazia | Mudança B | Personalização percebida | Veredito |
|---|---|---|---|---|
| Comunicação | Manu fala palavras soltas e mostra pouco o que quer. | Reconheceu puxar pela mão como comunicação; orientou atender o pedido e modelar uma palavra curta sem exigir repetição antes de ajudar. | A revisão final escolheu deliberadamente palavras isoladas, compatíveis com o nível conhecido, e não perguntou de novo como ela se comunica. | **PASSOU APÓS REVISÃO** |
| Atividade | Interesses em cozinha, dinossauros, contos/princesas; registro recente de que conseguiu iniciar uma atividade de forma independente. | Aplicou o primeiro passo pequeno a uma brincadeira de cozinha ou história com dinossauro, com escolha de continuar ou parar e contraste entre iniciar e sustentar. | O interesse mudou a mecânica, não apenas a decoração. O conflito artificial de identidade da bancada neutra desapareceu. | **PASSOU** |
| Mercado/sensorial | Sensibilidade significativa a sons, incômodo com luz forte e comunicação que precisa de apoio. | Testou somente horário mais vazio, observando se corre menos ou responde mais, sem somar treino de regra. | Cruzou explicitamente som/luz conhecidos com o contexto do mercado e manteve a hipótese condicional. | **PASSOU** |
| Socialização | Pouca iniciativa com pares, maior facilidade com adultos, preferência por ficar só e interesses em dinossauros/cozinha. | Pediu uma colega tranquila, atividade curta ligada a interesse real, dois papéis complementares e adulto apoiando apenas o início. | Usou disposição, interlocutor e interesses para desenhar a mediação. | **PASSOU COM RESSALVA** |

## Ressalvas de produto

1. **Atividade B ficou mais densa do que o neutro**, mas não virou aula: trouxe
   uma ação, exemplos personalizados, o que observar e uma pergunta decisiva.
   Passa pelo critério "menor resposta que ajuda de verdade".
2. **Socialização perguntou se Manu tenta se aproximar**, embora o Perfil
   registre pouca iniciativa. O dado está marcado como antigo (cerca de dois
   meses), então atualizar o estado pode mudar a conduta; ainda assim, uma
   conversa excelente deveria explicitar continuidade: "ela continua ficando
   afastada desde o começo...?". O ramo A fez a mesma pergunta. Portanto, não
   é regressão causada pela Pós nem justificativa para poluir a BP com regra de
   conversa; fica como ressalva de continuidade do sistema atual.

## Portão do Prompt Mestre

- **Conhecimento por trás:** passou; nenhuma resposta citou teoria, Pós ou
  categoria clínica.
- **Ajudar primeiro:** passou nos quatro casos.
- **Personalização percebida:** passou; a estratégia mudou com forma de
  comunicação, interesses, sensibilidades e funcionamento social de Manu.
- **Continuidade:** passou com a ressalva acima; nenhuma pergunta repetiu dados
  atuais essenciais, mas a atualização de uma informação antiga poderia ter
  sido formulada de modo mais contínuo.
- **Densidade de valor:** passou; as respostas não foram encurtadas até virar
  somente "faça X e me conte".

## Teste contrafactual de IA genérica

Pergunta de aceite: **se Perfil, histórico e repertório Kolo forem removidos, a
resposta fica funcionalmente igual?** Em conversa cotidiana com contexto
relevante disponível, "sim" reprova.

| Caso | Decisão que depende do Kolo | Resultado |
|---|---|---|
| Comunicação | Escolher modelagem de uma palavra isolada, em vez de exigir frase ou investigar novamente o nível de fala, porque esse é o meio expressivo registrado de Manu. | **PASSOU**, embora a personalização seja mais percebida pela adequação da conduta do que por uma referência verbal ao Perfil. |
| Atividade | Usar cozinha/dinossauros como mecânica do primeiro passo e respeitar a capacidade recente de iniciar. | **PASSOU** |
| Mercado/sensorial | Priorizar som/luz e horário vazio porque essas sensibilidades estão registradas para Manu. | **PASSOU** |
| Socialização | Escolher colega tranquila, apoio adulto inicial, dinossauros/cozinha e papéis complementares a partir do funcionamento social e interesses reais. | **PASSOU** |

"Melhor que outra IA" não foi interpretado como resposta maior ou mais
técnica. O diferencial exigido é uma decisão mais precisa que decorre do que a
Kolo já sabe. Em urgência, segurança continua prevalecendo; na ausência de
contexto, a Ayla não inventa personalização.

## Veredito

**PASSOU COM RESSALVAS.** O conhecimento novo combinou com o Perfil em vez de
substituí-lo, e a personalização foi preservada. A ressalva identificada é
preexistente nos dois ramos e não autoriza editar Core ou módulo compartilhado
nesta missão.

Próximo portão autorizado: repetir os sete cenários comportamentais da
PEND-209 com a mesma projeção em memória, antes de escrever em produção.
