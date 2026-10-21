# Central de comunicação — Missão 1, baseline congelado (20/10/2026)

**Nível:** CRÍTICA (WhatsApp proativo). **Dona:** Karina. **Modo:** EXECUTAR após investigação. **Escopo:** texto e links no Admin, públicos, permissão, fila, pausa, deduplicação e relatório. Arquivos e concessão de trial/preço não fazem parte desta missão.

## Antes de alterar

- Produção serve o SHA `25e8891daf1e0d5bd881512e6f128742fdcd0184` (health consultado às 16:28:52Z de 20/10). O Admin oferece campanhas, mas não a central segura da PEND-109.
- `dispararCampanha` insere destinatários sem verificar resultado, muda a campanha para `enviando` sem verificar resultado e envia até 200 mensagens na própria requisição. O cron processa até 500 por execução. Não há unicidade de `(campanha_id, family_account_id)` nem reserva exclusiva por destinatário.
- `cancelarCampanha` recusa campanhas em envio. `janela_inicio` é gravada, mas a ação de disparo não a respeita. A seleção vazia pode resolver um público padrão; `assinante` não separa pagamento de cortesia.
- `sendCampanha` consulta opt-out sem conferir erro. O onboarding autoriza acompanhamento da Ayla; não foi localizada prova por família de aceite para ofertas. Karina decidiu que conteúdo, públicos e disparo são escolhas dela no Admin; não criar bloqueio promocional adicional por inferência do agente. A lacuna deve ficar visível, sem apresentar aceite da Ayla como prova de oferta.
- PR #148 é rascunho, só acrescenta listagem de públicos no Admin; CI `c60760c` falhou. O ID antes duplicado para o CI foi renumerado neste checkout para PEND-241; a ficha de cartas de conversa continua PEND-232 em outra frente.

## Causa raiz

O envio foi construído como ação síncrona do Admin e extensão da cadência geral da Ayla, sem estado transacional próprio de campanha. Assim, duplo clique/cron concorrente, falha de gravação após aceite do provedor e pausa não têm resposta segura. O consentimento de campanha também foi inferido do acompanhamento, sem registro específico de origem e escopo.

## Gates de liberação

| Gate | Sucesso exigido | Estado inicial |
|---|---|---|
| G0 — baseline e desenho | Fonte de produção, fluxo, SPEC, população e riscos registrados | PARCIAL: código e health; população/consentimentos do banco ainda não reconciliados |
| G1 — públicos e preferências | União sem duplicatas; vazio é erro; pagante ≠ cortesia; opt-out e pedido global de parar conferidos por destinatário; falha de leitura bloqueia; decisão de Karina registrada | BLOQUEADO |
| G2 — fila | Clique só enfileira; reserva durável única; lotes pequenos; pausa/cancelamento interrompem pendentes; estado incerto não é reenviado automaticamente | BLOQUEADO |
| G3 — experiência | Editor/preview do texto WhatsApp, links HTTPS conferidos, horário de Brasília, relatório por contato e motivo de exclusão | BLOQUEADO |
| G4 — testes | Repetição, concorrência, falha DB/provedor, pausa em voo, público legítimo não bloqueado, duas crianças, suite/typecheck/build verdes | BLOQUEADO |
| G5 — produção | CI verde, merge/deploy, SHA health, migração/cron, ensaio de transporte para celular autorizado pela Karina sem usar conta de família como QA, pausa e retomada exercitadas em fila isolada, autorização por campanha e canário antes de lote real | BLOQUEADO |

**Destino do ensaio de transporte:** Karina autorizou o próprio celular em 20/10. O número não entra no código, na SPEC nem no público da campanha; será informado apenas no momento do teste. A prova deve usar uma mensagem identificada como teste, sem alterar perfil, trial, histórico ou métricas de sua família, e não deve gerar resposta automática da Ayla. Isso comprova o recebimento no aparelho, mas não substitui as provas de segmentação, permissão, deduplicação e pausa da campanha.

**Regra:** não usar o botão atual de disparo; não considerar publicada uma mudança presente apenas no PR. A PEND-109 só baixa com campanha real por lotes, pausa comprovada, ausência de duplicatas e relatório por família.

## Avanço local de 20/10 — ainda sem publicação

- O formulário começa sem público marcado; a resolução recusa seleção vazia. A consulta de assinaturas percorre páginas e falha explicitamente se o banco falhar ou exceder o limite seguro. A leitura de preferências também falha explicitamente. O filtro de consentimento da Ayla permanece uma opção **legada**; não representa a decisão de autorização de campanha que Karina pediu.
- A redação assistida recebe o objetivo de Karina, sugere uma mensagem, aceita pedido de ajuste e só copia a sugestão para o texto final quando ela escolhe. Não salva, aprova ou dispara. O formato é normalizado para WhatsApp e link não informado é rejeitado. O briefing ainda não é persistido; este é um ponto de continuidade a resolver antes do gate de experiência.
- Três arquivos de testes locais passaram, **30 testes**; lint dos seis arquivos alterados passou. Typecheck e build completos não foram validados neste worktree: faltam dependências locais; a tentativa de checagem com dependências de outro checkout produziu erros de resolução não conclusivos. O [CI do PR #148 no commit `d6edb59`](https://github.com/sergiokoloszuk/kolo-familia/actions/runs/39620345352) passou pelo typecheck, mas falhou em dois testes da Ayla fora desta frente; build foi pulado. Ver PEND-241.
- **Não mudou:** botão atual ainda é síncrono, cron ainda processa lote grande, não há reserva única/pausa, a seleção do formulário ainda usa os grupos legados e pode chamar `active` de “Assinante” mesmo em cortesia. Nenhum envio é seguro por esta fatia isolada.
