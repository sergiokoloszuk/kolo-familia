# Primeiro contato conversacional da Ayla — SPEC

Estado: **implementação local, ainda não publicada nem validada em produção**.
Risco: **CRÍTICA** — IA orienta família e usa dados de criança; pode haver irmãos.
Relacionadas: PEND-009, PEND-016, PEND-018, PEND-163, PEND-229 e PEND-230.

## Decisão de produto

A Ayla se apresenta em uma mensagem curta, reconhece no máximo três temas já
marcados no onboarding e oferece dois caminhos: a pessoa relata a situação de
hoje e recebe ajuda no próximo turno, ou aceita até três perguntas rápidas
para começar. Perguntas são opcionais; recusa é respeitada sem insistência.
Nenhuma pergunta repete fato que o perfil já fornece. A resposta não é triagem
clínica, diagnóstico nem interpretação da causa de um comportamento.

O padrão de concretude é uma cena e uma ação possível, com o apoio de que a
pessoa precisa. Exemplo de granularidade, não resposta fixa: na transição da
brincadeira à porta, **antes de chamar**, mostrar o próximo passo por objeto,
foto, gesto ou palavras compreensíveis; se possível, combinar onde o brinquedo
ficará. A Ayla não deve presumir que a criança usa uma dessas formas nem
retirar apoio automaticamente.

## Os oito portões

| Portão | Decisão e prova exigida | Estado antes da publicação |
| --- | --- | --- |
| P1 · Problema e dono | Família não deve ter de descobrir uma palavra-chave nem repetir onboarding; interlocutor pode ser responsável, outro cuidador ou a própria pessoa adulta. A frase que deixa de dizer é “não sei por onde começar”. | PASS no desenho |
| P2 · Descoberta | Abertura após onboarding; “sim”, “ok” e sinônimos isolados aceitam perguntas, mas um relato concreto segue como pedido comum. “Não” isolado encerra a oferta. Testar verdadeiros e falsos positivos, inclusive confirmações de segurança/Rotina. | PASS sintético; canal real pendente |
| P3 · Conversa mínima e dados | Nome confiável, idade e temas já conhecidos não são perguntados de novo. Uma pergunta inicial por faixa de idade; depois dela, primeira ajuda concreta se houver situação. Idade sem situação pede exemplo, nunca ação inventada. Máximo de três perguntas, não meta a cumprir. | PASS sintético; qualidade real pendente |
| P4 · Jornada e canais | WhatsApp: boas-vindas → escolha livre ou pergunta opcional → ajuda → continuidade. Se houver guia, link discreto por último. Web conserva sua própria entrada; não prometer que o questionário exista ali. | PASS de código; exibição real pendente |
| P5 · Identidade e alvo | Convite e pergunta usam o ID do membro associado à abertura, não o primeiro filho da família. Correção de idade só vale para membro nomeado e não muda data de nascimento. Vínculo só entra após afirmação explícita e não é inferido de “minha filha/sobrinha”. | PASS sintético para idade/vínculo explícitos e irmãos; linguagem livre e canal real pendentes |
| P6 · Amanhã | Idade e vínculo explicitamente corrigidos são anexados ao inbound com família, membro e data; idade leva nascimento-base e é invalidada quando esse dado muda. Ambos são relidos no turno seguinte. A pergunta inicial fica no histórico; não gera formulário nem artefato duplicado. | PASS sintético; persistência real pendente |
| P7 · Falhas e observabilidade | Falha de leitura/escrita da idade gera evento, nunca mensagem dizendo que cadastro foi alterado. Medir oferta, aceite, recusa, primeira ajuda, uma bolha, tempo até aceitação e fallback do motor principal. | PARCIAL; métricas de adoção agregadas pendentes |
| P8 · Prova/entrega | Regressão completa, typecheck, build, CI de PR e main, SHA no health, Core/flag global e auditoria natural/conta interna autorizada sem família real como QA. Só então declarar produção validada. Rollback por commit anterior, preservando registros. | BLOQUEADO até publicação e prova operacional |

## Corpus mínimo de disparo e não disparo

| Entrada após abertura | Esperado |
| --- | --- |
| `Sim`, `Ok`, `pode perguntar` | Uma pergunta curta para o membro correto |
| `Agora não` | Um fechamento curto, sem insistência |
| `Sim, ele bateu na irmã` | Pedido concreto; não abrir questionário |
| `1` após menu da Rotina | Manter estado da Rotina; não reinterpretar como primeiro contato |
| `Ok` após ajuda concluída | Portão de confirmação curta, não primeira pergunta |
| `Lia tem 4 anos` com duas crianças | Corrigir só o contexto de Lia e preservar o cadastro |
| Resposta só com idade | Pedir situação antes de orientar |

## Limites de prova

O harness usa banco e modelo falsos: prova roteamento, persistência, contexto
entregue ao modelo e texto determinístico, não prova que um modelo real dará
uma orientação útil nem que o WhatsApp exibiu a formatação. Build local não é
publicação. O nome interno `experimental` é legado: a flag global precisa ser
confirmada no health e a taxa de fallback deve ser medida; flag ligada não
significa que todos os turnos terminaram no mesmo motor.
