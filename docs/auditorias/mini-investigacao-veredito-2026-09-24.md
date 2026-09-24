# Mini-investigação inteligente — veredito de 24/09/2026

## Veredito

**PASSOU COM RESSALVAS.** A exceção foi aprovada e ativada somente em
**alimentação/seletividade** e **atividade**. Em **regulação emocional** e
**comunicação**, a pergunta única atual produziu orientação equivalente com
menos sensação de interrogatório; esses dois temas continuam no comportamento
anterior.

## Escopo aprovado

- O padrão continua sendo ajudar primeiro e fazer no máximo uma pergunta.
- A mini-investigação só entra quando a família relata que tentativas anteriores
  não funcionaram e ainda faltam 2–3 informações decisivas no Perfil.
- A primeira resposta oferece uma ajuda segura antes das perguntas, informa
  quantas serão e permite resposta conjunta por áudio.
- Perguntas sobre fatos já presentes no Perfil são removidas antes de o prompt
  ser montado.
- O turno seguinte é estruturalmente marcado para sintetizar, orientar, dar uma
  ação, uma frase pronta e um critério de observação — sem nova bateria.
- A memória fica em `ayla_messages.metadata`, sem tabela ou migração nova e com
  escopo por criança.

## A/B com modelo real

O braço A usou a condução anterior; o braço B usou a exceção. Cada braço recebeu
somente a resposta às perguntas que realmente fez. O material completo está em
`mini-investigacao-ab-2026-09-24.json`.

| Tema | Resultado | Decisão |
|---|---|---|
| Alimentação/seletividade | B significativamente melhor | ativado |
| Atividade | B significativamente melhor | ativado |
| Regulação emocional | B não foi significativamente melhor | não ativado |
| Comunicação | B não foi significativamente melhor | não ativado |

Nos dois casos aprovados, B transformou informação adicional em mudança de
conduta: na alimentação, usou textura/cheiro e alimento seguro para escolher a
exposição; na atividade, separou compreensão, início e sustentação e encontrou
o excesso de materiais visíveis. Nos dois casos reprovados, a ação central
permaneceu praticamente a mesma.

## Regressão e build

- Testes focados: **64/64** passaram na rodada final.
- Suíte completa: **3.996 passaram**, **7 pulados**, **2 falhas preexistentes**
  (`perfil-marcos` e `provider`), já fora do escopo desta missão. A terceira
  falha inicialmente observada era uma expectativa de schema afetada por esta
  mudança e foi corrigida; a regressão correspondente passou.
- Typecheck: passou.
- Build Next.js `--webpack`: passou com as variáveis do ambiente de build.
- Sete cenários comportamentais da PEND-209: executados com leitura real do
  Perfil autorizado, sem persistência e sem WhatsApp; nenhum acionou a exceção
  e não apareceu regressão de condução.

## Rollback e observabilidade

`AYLA_MINI_INVESTIGACAO=off` restaura o comportamento anterior sem deploy de
schema. O evento `lacuna_decisao` registra ação, tema, motivo, campos sugeridos e
campos confirmados. A mensagem só recebe `mini_investigacao_campos` quando o
envelope estruturado confirma exatamente as perguntas autorizadas.
