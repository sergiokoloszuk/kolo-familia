# Aprofundamento contextual no WhatsApp — SPEC

Nível de risco: **CRÍTICA** — altera a conversa de IA no canal principal e
processa contexto comportamental de criança.

Estado: **DESENHADA**

## 1. Problema e dono

A família já recebeu uma primeira orientação útil, mas pode querer seguir por
ângulos diferentes sem precisar descobrir o que escrever. A família é dona da
escolha; a Ayla é dona de oferecer somente bifurcações que tenham conteúdo bom.

Frase que deixa de existir: “não sei como pedir para ela aprofundar isso”.

## 2. Corpus de disparo

| Frase/contexto | Esperado | Por quê |
|---|---|---|
| “Ela não empresta o carrinho de jeito nenhum.” | DEVE, após ajudar, se houver 2 caminhos bons | lidar, brincar e falas podem mudar a continuação |
| “Meu filho não consegue brincar com as outras crianças.” | DEVE, após ajudar | manejo e experiência social são caminhos distintos |
| “Ela não presta atenção em nada.” | PODE | só se o contexto sustentar 2 aprofundamentos |
| “Ela não quer fazer nenhuma atividade.” | PODE | primeiro distingue barreira e dá ação concreta |
| “Quando tiro o tablet ela entra em crise.” | PODE, sem sobrecarregar | orientação vem antes; risco continua soberano |
| “Estou exausta. Nada funciona.” | NÃO DEVE | acolhimento, não menu |
| Urgência/risco atual | NÃO DEVE | ação de segurança não espera escolha |
| Mensagem administrativa | NÃO DEVE | não é conversa de desenvolvimento |
| Resposta que fez mini-investigação | NÃO DEVE | perguntas e menu não se acumulam |
| Resposta com apenas um próximo passo útil | NÃO DEVE | botão não cria falsa escolha |
| Clique em “Brincar / passear” | DEVE aprofundar a conversa exata | clique não é assunto novo |
| Clique repetido na mesma oferta | NÃO DEVE duplicar resposta | webhook é at-least-once |

## 3. Comportamento

1. A Ayla responde primeiro com a menor resposta que ajuda de verdade.
2. O mesmo turno pode declarar zero a três ramos candidatos em estrutura
   fechada; essa declaração nunca aparece na fala.
3. Um portão determinístico veta oferta em segurança, desabafo, pergunta ainda
   aberta, mini-investigação, convite concorrente, conversa simples, decisão
   incerta ou menos de dois ramos bons.
4. A oferta é uma segunda mensagem curta com dois ou três reply buttons.
5. Cada botão carrega ramo lógico e ID opaco da oferta. O callback também é
   validado contra família e, quando disponível, mensagem referenciada.
6. O primeiro clique válido reivindica a oferta atomicamente. Reentrega ou
   segundo clique não gera outra resposta.
7. O aprofundamento reutiliza `output_types`, Perfil Vivo, BPs e o par exato de
   mensagens que originou a oferta. Não reclassifica o clique como conversa
   genérica.
8. A conversa segue naturalmente e não reoferece menu no mesmo ciclo.
9. Os ramos não são três embalagens para o mesmo conselho:
   - **Como lidar** maneja aquela situação concreta;
   - **Brincar / passear** desenvolve ou vive a habilidade em uma experiência
     compartilhada executável, com papéis, falas, objetivo e facilitação;
   - **Crenças + falas** trabalha possíveis interpretações da criança e do
     adulto, sempre como hipótese, e mostra como pensar, falar e agir diferente.
10. Cada aprofundamento reconstrói o contexto pelo mesmo motor de conhecimento
    da Ayla. A prova registra skills e IDs de BPs enviados ao modelo; uma
    resposta produzida apenas pela receita do ramo reprova o gate.

Ativação: uma única flag global, desligada por padrão e usada apenas como
rollback. Não há coorte, allowlist ou tratamento diferente entre famílias.
Depois dos portões pré-produção e da prova interna autorizada, liga para todas
as conversas elegíveis ao mesmo tempo.

## 4. Contrato de estado

`ayla_aprofundamento_ofertas` guarda somente referências, opções lógicas e
estado operacional; não duplica texto de conversa. Referencia a mensagem
inbound e a resposta outbound que já existem em `ayla_messages`.

Estados: `preparada → oferecida → escolhida → respondida`; falhas terminam em
`falhou`. A reivindicação é feita por função SQL atômica e expira. A telemetria
registra oferta, escolha, resposta e fallback sem copiar fala sensível.

## 5. Portões

| Portão | Resultado | Data | Commit | Evidência |
|---|---|---|---|---|
| P1 Problema e dono | PASS | 2026-09-24 | — | missão e critério final da agência |
| P2 Descoberta | PASS | 2026-09-24 | — | corpus acima + sete casos obrigatórios |
| P3 Conversa mínima e dados | PASS | 2026-09-24 | — | ajuda primeiro; estado só por referência |
| P4 Jornada e canais | PASS | 2026-09-24 | — | botão Z-API + fallback textual |
| P5 Identidade, alvo e permissão | PASS | 2026-09-24 | — | família, criança e oferta validadas |
| P6 Continuidade | PASS | 2026-09-24 | — | origem inbound/outbound persistida |
| P7 Quando dá errado | PASS | 2026-09-24 | — | fallback, expiração, idempotência e rollback |
| P8 Prova e entrega | BLOQUEADO | — | — | depende de implementação, bancada e prova interna real |

## 6. O que esta funcionalidade NÃO faz

- não mostra menu em toda resposta;
- não oferece “quero todos”, PDF, Plano, proativas ou nova curadoria;
- não usa botão no lugar de orientação;
- não afirma crença como diagnóstico;
- não transforma passeio em terapia;
- não cria piloto por família.

## 7. Dívidas conhecidas

- PEND-208
- PEND-210
- PEND-213
