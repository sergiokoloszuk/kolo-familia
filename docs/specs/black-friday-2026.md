# Black Friday 2026 — contrato do produto

**Dona:** Karina · **criticidade:** CRÍTICA · **estado padrão:** desligada

Esta especificação é a fonte técnica da campanha. Ela não autoriza publicação,
mensagem, cobrança, alteração no Stripe ou escrita em produção.

O roteiro operacional e as provas exigidas para a virada estão em
[`docs/BLACK-FRIDAY-2026-CHECKLIST-DE-VIRADA.md`](../BLACK-FRIDAY-2026-CHECKLIST-DE-VIRADA.md).

## O que uma família recebe

- A campanha aceita novas entradas de **01/11/2026 00:00** até
  **30/11/2026 23:59**, horário de Brasília.
- Quem entra recebe **15 dias completos de teste**, sem cartão e sem cobrança
  automática ao final.
- Os avisos de encerramento são relativos à data real de cada família e valem
  tanto para o teste normal de 7 dias quanto para o promocional de 15 dias:
  D-3 oferece alternativas simples para a família dizer o que ajudou, se usou
  pouco ou se ainda não sentiu ajuda, sem vender; D-1 informa a data e que não
  haverá cobrança automática; D-0 apresenta a decisão de continuar; depois do
  fim, a família pode assinar ou dizer que não quer.
- Se a família disser que não quer continuar, a Ayla pode perguntar **uma única
  vez**, de forma opcional, o principal motivo. Depois disso, encerra sem
  insistir. A própria resposta fica no histórico; o painel agregado de motivos
  ainda precisa ser construído e validado antes de ser tratado como métrica.
- Assinar antes do fim do teste preserva os 15 dias: a primeira cobrança fica
  para depois do término do teste.
- O plano promocional é somente mensal, por **R$ 39,90/mês**. O anual fica
  oculto enquanto a oferta estiver sendo apresentada.
- O preço promocional fica disponível até o fim do dia mais tardio entre
  30/11/2026 e o dia em que termina o teste daquela família. Não existe janela
  adicional de sete dias.
- Um checkout iniciado antes do limite tem **30 minutos** para ser concluído.
  Apenas abrir a página não reserva preço. Uma confirmação do processador que
  chegue depois continua válida se a conclusão ocorreu dentro da sessão.

## Quem pode receber o benefício

- Novo cadastro durante a campanha: 15 dias a partir da ativação do teste.
- Teste em curso na abertura: completar 15 dias totais, sem encurtar acesso.
- Teste encerrado e ex-assinante: pode pedir voluntariamente um novo teste de
  15 dias durante novembro, uma única vez por conta.
- Assinante paga, cortesia vigente ou pagamento em recuperação: não recebe o
  benefício e não tem o acesso alterado.

A tabela de participação tem chave única por família. Assim, repetição de
clique, reenvio ou duas requisições simultâneas não concedem dois benefícios.

## Chave administrativa e falhas

- O código chega a produção **desligado**.
- A ativação exige, ao mesmo tempo: administradora autenticada, janela pública
  aberta, preço Stripe ativo e exatamente igual a R$ 39,90/mês, migração
  instalada e prova registrada de backup restaurado com sucesso.
- Pausar impede novas entradas. Quem já recebeu o benefício mantém os dias e
  pode contratar dentro do prazo individual já adquirido.
- Falha ou dado ambíguo fecha a oferta; nunca concede ou cobra por suposição.
- Toda mudança da chave registra quem fez, quando fez, estado anterior e novo.

## Privacidade, aceite e exclusão

- Novidades, parcerias e promoções exigem aceite positivo e revogável. A
  ausência de recusa não é autorização. Mensagens necessárias para usar a conta
  ficam separadas dessa escolha.
- Termos e Privacidade registram data e versão aceitas; a escolha de marketing
  tem histórico próprio. Cookies não essenciais oferecem apenas aceitar ou
  rejeitar, com o mesmo destaque.
- Cancelar a renovação não apaga a conta. Se a pessoa pedir a exclusão durante
  um período pago, a renovação é cancelada e a eliminação fica agendada para o
  final desse acesso. Sem período pago, a exclusão pode ocorrer imediatamente.
- Trial promocional sem assinatura é eliminado 30 dias depois do prazo
  individual da oferta. O registro mínimo antifraude não contém o conteúdo da
  criança.
- Rotinas destrutivas chegam em modo de simulação e só podem ser ligadas após
  backup/restauração, conta fictícia, conferência de isenções e autorização.
- A Kolo não autoriza treinamento com dados das famílias. As APIs comerciais de
  Anthropic e OpenAI declaram exclusão de treinamento por padrão, mas o Gate 8
  exige provar as configurações das contas e os contratos/DPA; política pública
  não substitui essa verificação.

## Portões de entrega

1. **Contrato fechado:** regras acima aprovadas e testes de fronteira verdes.
2. **Banco preparado:** migração revisada, ainda não aplicada enquanto a
   PEND-092 estiver aberta.
3. **Preço conferido:** ID, valor, moeda, recorrência e modo do Stripe provados.
4. **Jornada preparada:** entrada, 15 dias, preço individual, anual oculto e
   avisos D-3/D-1/D-0 funcionando pelo prazo real de cada família.
5. **Checkout seguro:** 30 minutos, preservação do teste e idempotência.
6. **Admin preparado:** prévia, contagens, bloqueios, ativar, pausar e auditoria.
7. **Preview validado:** testes automatizados, build, revisão, migrações em
   banco isolado e teste humano em dados fictícios. Conferir cadastro, aceite,
   trial, checkout, cancelamento, exportação e exclusão em modo de simulação.
   Nenhum envio ou cobrança real.
8. **Produção:** somente com aprovação expressa de Karina, backup restaurado,
   migração aplicada, smoke test e provas de SHA, banco, Stripe e jornada.

`IMPLEMENTADA` não significa `PRONTA`. Antes do portão 8, o veredito de
produção permanece **BLOQUEADO**.
