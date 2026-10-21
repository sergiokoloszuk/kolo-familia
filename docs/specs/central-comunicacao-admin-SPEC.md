# Central de comunicação do Admin — proposta para validação

**Dona de produto:** Karina. **Risco:** CRÍTICO — WhatsApp proativo, dados de famílias e campanha comercial. **Estado em 20/10/2026:** desenho; nenhuma mensagem enviada e nenhum botão de produção alterado. **Pendência-mãe:** PEND-109. A campanha de novembro é um uso desta central, não uma segunda fila.

**Achado de consentimento em 20/10 (código, não auditoria de produção):** os dois onboardings registram autorização para a **Ayla escrever e acompanhar pelo WhatsApp**; não foi localizado campo/timestamp separado para ofertas. **Decisão de produto de Karina:** ela define no Admin o conteúdo, a categoria, os públicos e o disparo; não criar um bloqueio promocional novo por inferência do agente. A central deve mostrar essa lacuna e registrar a decisão e a autorização da campanha, sem fingir que o aceite da Ayla prova aceite de oferta. Pedidos de parar e bloqueios já registrados continuam respeitados.

## A conversa vai mudar de → para

**De:** texto livre, segmentos técnicos e um botão “Disparar agora” que tenta até 200 envios na própria requisição, sem pausa de campanha em curso.

**Para:** uma comunicação que Karina redige exatamente como quer, revisa no formato de WhatsApp, escolhe públicos que se somam sem duplicar famílias, vê elegíveis/excluídos, aprova e inicia lotes pequenos; pode pausar pendentes e acompanhar o resultado real. A Ayla é a remetente no WhatsApp, mas não reescreve a mensagem aprovada nem inventa personalização.

## P1 · Problema e donos

Karina precisa avisar famílias sobre conteúdos, encontros e promoções sem operar planilhas ou scripts. A família precisa receber mensagem pertinente, uma só vez, com link/anexo que funcione e opção de parar comunicações promocionais. Sérgio precisa autorizar cada campanha real, como exige a PEND-109. A frase a eliminar é: “Eu publiquei um aviso e não sei quem recebeu, quem ficou de fora nem se posso parar.”

## P2 · Entrada e públicos

Decisão de Karina em 20/10: a tela deve permitir abrir **quem são os contatos de cada grupo**, não só ver uma contagem. Mostrar nome, contato, situação e motivo da classificação; separar assinante pagante, cortesia, trial ativo, trial vencido, cancelamento solicitado ainda com acesso, assinatura cancelada e pagamento pendente/falhou. A lista é somente para Admin autenticado. Antes de confirmar uma campanha, mostrar destinatários únicos e exclusões por motivo; após o envio, permitir conferir o resultado por contato.

**Fatia de implementação de 20/10:** a página `/admin/campanhas/publicos` foi criada no código, com leitura somente para Admin, paginação de consulta sem truncar silenciosamente, filtros e contatos por grupo. Ainda é um retrato da Kolo, não uma simulação de elegibilidade de envio. O Admin existente continuou com a segmentação antiga; não confundir a lista nova com aprovação do público de uma campanha. Sem build, CI, deploy e conferência com banco real, esta fatia permanece **não validada em produção**.

Entrada visível no Admin: **Comunicações → Nova comunicação**. Seleções são união, nunca interseção: marcar “trial ativo” e “trial encerrado” inclui ambos, uma vez por família. “Todos cadastrados” já inclui os demais grupos; a prévia aponta seleções redundantes. Seleção vazia é erro, nunca vira público padrão. Cada segmento mostra definição humana e contagem, incluindo: todos cadastrados, trial ativo, trial encerrado, assinantes pagantes, cortesia válida, ex-assinantes com conta, pagamento pendente/falhou. “Assinante pagante” não é sinônimo de `status=active`: cortesia e divergência Stripe/Kolo têm tratamento separado. Família sem contato, sem permissão aplicável, com opt-out, excluída ou em estado comercial ambíguo não recebe; a tela mostra o motivo agregado. A campanha de novembro exclui pagantes, mas uma comunicação de conteúdo pode incluí-los.

## P3 · Conteúdo e dados mínimos

Karina escolhe o motivo: **conteúdo/vídeo**, **encontro**, **promoção** ou **aviso operacional**. O tipo classifica a comunicação e aplica os opt-outs existentes; a decisão de enviar pertence à operadora no Admin. Editor com títulos, linhas em branco, negrito WhatsApp e prévia após `paraWhatsApp`. Links diretos de Instagram, YouTube ou Kolo podem ser colados; o Admin valida URL HTTPS, exibe domínio/destino e não promete miniatura automática. Anexos da primeira versão: PDF, PNG e JPEG, com nome, tamanho, prévia e verificação de acesso antes do envio. Vídeo entra por link nesta versão. Arquivo é armazenado com acesso restrito e link temporário acessível ao provedor no momento do envio. Não inserir dados de criança na mensagem geral por padrão; personalização só com campos permitidos e prova de identidade.

**Decisão de Karina em 20/10:** no formulário de envio, ela escreve a mensagem, escolhe dia e hora de início (Brasília), seleciona os públicos e decide se marca uma **caixa opcional** para acrescentar ao final a informação de como parar de receber. A caixa inicia desmarcada; o texto final aparece na prévia e é congelado na aprovação. A ausência dessa frase não desativa o processamento de pedidos de parada nem substitui a prova de permissão inicial. O agendamento só pode aparecer como ativo se o cron respeitar a hora e se a fila segura estiver provada.

**Redação assistida, pedida em 20/10:** Karina pode escrever em linguagem livre o que quer comunicar, pedir uma sugestão com blocos, respiro e negritos adequados ao WhatsApp, solicitar ajustes sucessivos, editar o texto final e só então aprová-lo. Sugestão não salva, aprova ou envia por conta própria. A IA não pode inventar data, preço, oferta ou link; links novos são rejeitados antes de apresentar a sugestão. O texto aprovado deve ser o texto congelado para a campanha, não uma nova geração na hora do envio. A primeira fatia local usa o prompt `campanha_redacao` com fallback e apenas produz a sugestão; persistência do briefing e prévia final ainda exigem prova.

## P4 · Jornada e canais

1. Rascunho: texto, links/anexo e seleção podem ser editados; nada sai.
2. Simulação: total único por público, sobreposições, exclusões por motivo, prévia do que aparece no WhatsApp, estimativa de lotes e horário; nenhuma mensagem sai.
3. Aprovação: snapshot imutável do texto, arquivo, públicos e regras; autorização de Sérgio registrada para a campanha real. Mudança posterior volta a rascunho e requer nova aprovação.
4. Início: reserva os destinatários elegíveis e envia em lotes pequenos, com intervalo configurado e prioridade para respostas recebidas; o botão não faz fan-out.
5. Durante: painel mostra pendentes, em processamento, aceitos pelo provedor, confirmados por status quando houver, bloqueados, falhas e estado incerto. **Pausar** impede novas reservas imediatamente; só a chamada já em voo pode terminar.
6. Fim: relatório por família, sem texto sensível desnecessário. Retomar depois da pausa não duplica. Cancelar encerra pendentes, sem apagar histórico.

O aceite da Z-API não é prova de entrega ao aparelho nem de leitura. Abrir um PDF não é uma métrica garantida; não mostrar “arquivo aberto” sem evento que o prove.

## P5 · Identidade, alvo e permissão

Uma linha única por `campanha_id + family_account_id`. Antes de cada reserva, revalidar família, telefone, estado de assinatura e pedido de não receber/opt-out; falha de consulta bloqueia, não equivale a autorização. O Admin registra quem decidiu disparar e os públicos escolhidos. Não tratar consentimento de uso da Ayla como prova automática de aceite promocional, nem criar um bloqueio adicional de ofertas que Karina não aprovou. Ex-assinante com conta apagada não entra em “todos cadastrados”; o caso excepcional de retorno de novembro exige fluxo próprio. Não selecionar por criança, nem misturar irmãos numa mensagem geral. Admin autenticado pode redigir; autorização de envio real é separada.

## P6 · Continuidade

Rascunho, simulação, aprovação, envio e relatório persistem. Ao voltar no dia seguinte, Karina vê exatamente o que ainda está pendente. Links/anexos usados continuam referenciados no histórico, mesmo se o acesso de download expirar; não guardar uma URL pública permanente. Resposta da família entra na conversa normal da Ayla e não é tratada como novo disparo.

## P7 · Falhas, métricas e rollback

- Reserva atômica por destinatário antes de chamar o provedor; `UNIQUE(campanha_id, family_account_id)`. Duas abas ou cron concorrente não enviam duas vezes.
- Se o provedor aceitar e a persistência falhar, **não reenviar automaticamente** o estado ambíguo; registrar ID do provedor quando possível e pedir reconciliação. Se falhar antes do provedor, pode voltar a pendente após classificação segura.
- Cada escrita crítica confere erro e linha afetada. Falha de leitura de público/consentimento interrompe o lote, não vira “0 pessoas”.
- Registrar: criado, aprovado, reservado, pulado e por quê, aceito pelo provedor, entregue/lido quando o webhook fornecer, falhou, pausado, cancelado; evitar chamar “entregue” o que foi apenas aceito.
- Métricas de adoção: comunicações criadas, simuladas, aprovadas, concluídas; por campanha, tamanho do público único, alcance, bloqueios, falhas e respostas. Clique em link só com rastreamento consentido e destino que preserve privacidade; silêncio não é satisfação.
- Rollback: desabilitar início de novos lotes e pausar ativos; envio já aceito pelo provedor é irreversível. Não retirar acesso/trial concedido por rollback de mensagem.

## P8 · Gates de entrega

| Gate | Prova necessária | Estado em 20/10 |
|---|---|---|
| G0 — inventário/baseline | Código e produção: campanhas existentes, consentimentos, opt-outs, assinaturas/cortesias e eventos Z-API | PARCIAL: código auditado; produção não reconciliada; opt-in promocional não localizado |
| G1 — desenho humano | Karina aprova tela, públicos, prévia e linguagem; Sérgio confirma modelo de autorização por campanha | PENDENTE |
| G2 — segurança | Migração numerada sem conflito, backup PEND-092, reserva única, lote pequeno, pausa, estado incerto, revalidação por destinatário | PENDENTE |
| G3 — conteúdo | Link validado; PDF/imagem com armazenamento privado, tipo/tamanho, prévia e envio ao contato QA | PENDENTE |
| G4 — regressão | Concorrência, duplo clique, retry, pausa em voo, opt-out, pagante/cortesia, conta excluída, dois irmãos, falha de banco/provedor, canal real QA | PENDENTE |
| G5 — publicação | CI/build, SHA/health, migrations e configuração, smoke no Admin e WhatsApp QA, `/ajuda` atualizado, autorização da campanha e canário | PENDENTE |

**Veredito atual: BLOQUEADO para envio real.** Um rascunho e a simulação podem ser preparados sem disparo; botão “Disparar agora” existente não é prova de segurança. Nenhum gate é fechado por código local ou pela criação desta SPEC.
