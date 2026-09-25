# Aprofundamento contextual no WhatsApp — SPEC

Nível de risco: **CRÍTICA** — altera a conversa de IA no canal principal e
processa contexto comportamental de criança.

Estado: **PUBLICADA COM FLAG DESLIGADA — BOTÕES RENDERIZAM; RAMOS AINDA NÃO VALIDADOS**

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
| “Ele precisa melhorar foco” → “desengaja ao terminar” | DEVE considerar brincar, após orientar | a família não precisa saber que uma experiência compartilhada pode praticar a habilidade |
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
   Quando o pedido é desenvolver uma habilidade, `aprofundar_brincar` deve ser
   considerado proativamente se houver experiência compartilhada útil; a mãe
   não precisa conhecer ou pedir esse formato para descobri-lo.
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
| P4 Jornada e canais | FAIL | 2026-09-24 | `311570f` | Z-API aceitou a mensagem, mas o WhatsApp da QA não renderizou os reply buttons |
| P5 Identidade, alvo e permissão | FAIL | 2026-09-24 | `311570f` | a oferta manual ficou sem membro; no turno seguinte um convite concorrente falou de Bento e abriu Mário |
| P6 Continuidade | PASS | 2026-09-24 | — | origem inbound/outbound persistida |
| P7 Quando dá errado | FAIL | 2026-09-24 | `311570f` | HTTP 200 do provedor foi tratado como oferta utilizável; não há prova de renderização no aparelho |
| P8 Prova e entrega | BLOQUEADO | 2026-09-24 | `311570f` | rollback global executado; falta aceitar/verificar termos dos botões na Z-API e repetir a prova |

### Prova real que reprovou o gate

- oferta `93b4893a-047d-4ca8-99e2-4cc28ccb315b`;
- mensagem do provedor `3EB04B465B6CF8B1637846`;
- Z-API respondeu sucesso e a persistência ficou `oferecida`, mas a Karina viu
  apenas o texto, sem ação clicável;
- a oferta foi encerrada como `falhou`, com
  `QA_BOTOES_NAO_RENDERIZADOS`, e a flag global voltou para `false`;
- a documentação oficial da Z-API afirma que o recurso é instável e exige
  aceite prévio dos termos de uso dos botões. O painel da conta ainda precisa
  ser verificado antes de novo envio.

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
