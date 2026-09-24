# Dados fiscais no pagamento

## Resultado esperado

Nenhuma nova sessão de pagamento de assinatura abre sem nome completo, CPF
válido e endereço completo. Depois que uma fatura é paga, Rosangela recebe no
WhatsApp apenas um link administrativo de uso único. O link abre uma tela com
os dados necessários para emitir a nota fiscal.

## Jornada

1. A família escolhe o plano na tela de assinatura.
2. Antes do Stripe, informa nome completo, e-mail fiscal, CPF, CEP,
   logradouro, número, bairro, cidade e UF; complemento é opcional.
3. O servidor valida todos os campos. Dado ausente ou inválido não abre o
   Checkout.
4. Nome, CPF e endereço são gravados somente no Customer Stripe. Não entram no
   Perfil Vivo, nas conversas da Ayla nem em telemetria comportamental.
5. O webhook de `invoice.payment_succeeded` cria uma pendência fiscal
   idempotente por Invoice.
6. O cron fiscal envia ao número configurado em
   `ROSANGELA_FISCAL_WHATSAPP_E164` um link opaco, sem PII na mensagem.
7. O link expira em 36 horas, pode ser consumido uma vez e mostra nome, CPF,
   e-mail, logradouro/número, bairro/complemento, cidade/UF, CEP, valor e Invoice.

## Segurança e falhas

- A tabela `fiscal_alertas` guarda referências Stripe, hash do token e estado
  operacional; nunca guarda nome, CPF ou endereço.
- Sem o telefone de Rosangela, o envio falha fechado e a pendência volta para
  `falha`, permitindo nova tentativa após a configuração.
- Erro ao persistir a pendência fiscal faz o webhook responder com falha para
  que o Stripe tente novamente.
- O endpoint legado e a ação da tela usam a mesma função de Checkout fiscal;
  não há rota alternativa que aceite apenas o plano.
- O health expõe somente o booleano `fiscal_rosangela_configurada`.

## Critério de aceite

- [ ] Produção tem `ROSANGELA_FISCAL_WHATSAPP_E164` com o número confirmado por Rosangela.
- [x] Nome e sobrenome, CPF e endereço completo são obrigatórios antes do pagamento.
- [x] Os dois caminhos de Checkout usam a mesma validação.
- [x] Fatura paga gera no máximo uma pendência fiscal por Invoice.
- [x] A mensagem contém o link e não contém os dados fiscais.
- [x] A página do link mostra todos os campos necessários.
- [ ] Migração aplicada e prova controlada em ambiente autorizado, sem cobrança real nem envio real na suíte.

## Limite conhecido

Assinaturas antigas que renovam automaticamente sem passar novamente pela tela
podem ainda não ter endereço no Customer Stripe. O fluxo novo garante os dados
para contratações e recontratações que passam pelo Checkout; o saneamento da
base legada exige uma ação operacional separada antes da próxima renovação.
