# Black Friday 2026 — checklist de virada

**Dona da decisão:** Karina

**Campanha:** 01/11/2026 00:00 a 30/11/2026 23:59, horário de Brasília

**Regra de segurança:** nenhum item marcado como prova pode ser substituído por
“o código existe”. A campanha permanece desligada até a aprovação expressa de
Karina.

Este roteiro organiza o trabalho que pode ficar pronto antes de 1º de novembro
e a sequência curta do dia da ativação. Ele não autoriza mensagem, cobrança,
migração, deploy ou alteração no Stripe.

## Situação em 27/10/2026

| Portão | Estado | Prova atual | O que falta |
|---|---|---|---|
| Regras comerciais e técnicas | PASS | `docs/specs/black-friday-2026.md` | Manter sem reabrir decisões já aprovadas |
| Código da campanha | PASS | PR #149, CI verde no commit funcional `ad3b5fb` e no commit final `53f291e` | Merge e produção somente depois dos portões abaixo |
| Banco e recuperação | BLOQUEADO | PEND-092; o Easypanel tem somente `Local Disk`, sem rotina externa e sem restore provado | Cópia fora do servidor e restauração comprovada |
| Segurança das credenciais | BLOQUEADO | PEND-015; segredos continuam legíveis no painel autenticado | Revisar acessos e planejar rotação coordenada, sem copiar valores |
| Preview isolado | BLOQUEADO | Não há banco isolado funcional para exercer migrações e jornada | Restaurar o backup em destino isolado e testar ali |
| Stripe promocional | BLOQUEADO | Produto mensal de R$ 39,90 criado; ID informado por Karina | Conferir modo, moeda, recorrência e ativação sem alterar preço |
| Jornada humana | BLOQUEADO | Testes automatizados e build verdes | Conta fictícia no celular, sem cobrança, cobrindo todos os públicos |
| Central de mensagens | BLOQUEADO | PEND-109 | Não fazer disparo até prévia, aprovação, pausa e antirrepetição provadas |
| Produção | BLOQUEADO | Health saudável no código anterior em 27/10 | Banco, deploy inerte, smoke e autorização de Karina |

## Portão 1 — recuperação do banco

Responsável: pessoa técnica com acesso ao servidor e ao destino de backup.

- [ ] Escolher um destino fora do servidor atual.
- [ ] Gerar uma cópia nova do banco, sem interromper o atendimento.
- [ ] Registrar horário, tamanho e verificação de integridade sem expor dados.
- [ ] Restaurar essa cópia em um banco isolado.
- [ ] Provar que a restauração abre e contém as tabelas esperadas.
- [ ] Apagar ou proteger o ambiente de teste segundo a LGPD.
- [ ] Guardar a prova em local restrito e registrar somente o resumo no projeto.

**Parar se:** a cópia estiver apenas no mesmo disco, a restauração não terminar
ou a pessoa não conseguir confirmar de qual horário são os dados.

## Portão 2 — segurança das credenciais

- [ ] Listar quem possui acesso administrativo ao Easypanel.
- [ ] Ativar ou exigir autenticação em duas etapas, se a edição permitir.
- [ ] Não copiar senha, chave ou token para documento, WhatsApp ou tarefa.
- [ ] Mapear quais serviços dependem de cada categoria de credencial.
- [ ] Definir a ordem de rotação e a volta segura antes de trocar qualquer valor.
- [ ] Rotacionar credenciais consideradas expostas somente com backup provado e
      janela coordenada.
- [ ] Confirmar o health depois de cada troca.

**Parar se:** houver dúvida sobre qual serviço usa a credencial ou se a troca
derrubar autenticação, banco, e-mail, IA ou WhatsApp.

## Portão 3 — ensaio isolado

- [ ] Restaurar o banco em ambiente que não atende famílias reais.
- [ ] Aplicar as migrações 0096 e 0097 nesse ambiente.
- [ ] Confirmar que uma segunda aplicação não duplica nem destrói dados.
- [ ] Exercitar cadastro, aceite, trial, checkout, cancelamento, exportação e
      exclusão em modo de simulação.
- [ ] Usar somente contas e crianças fictícias e apagá-las no final.
- [ ] Provar a volta: recriar o ambiente a partir do backup inicial.

**Parar se:** qualquer tela usar produção, uma cobrança puder ser concluída ou
um dado fictício chegar a uma família real.

## Portão 4 — publicação inerte

Ordem obrigatória:

1. [ ] Criar uma cópia nova imediatamente antes da mudança e conferir sua
       integridade.
2. [ ] Aplicar as migrações aprovadas, registrando início, fim e resultado.
3. [ ] Fazer merge do PR #149 somente se o CI do cabeçalho estiver verde.
4. [ ] Aguardar o deploy e conferir o SHA servido por `/api/health`.
5. [ ] Confirmar banco, ambiente e integrações no health, sem imprimir segredos.
6. [ ] Confirmar que a campanha chegou **desligada**.
7. [ ] Abrir o Admin e provar que ativar continua bloqueado sem todos os gates.

**Parar se:** o SHA não for o esperado, o health ficar vermelho, a campanha
nascer ativa ou uma tela essencial depender de migração ausente.

## Portão 5 — conferência do Stripe

Este é o momento de dizer: **“Agora é hora de falar com a Rosângela.”**

A confirmação precisa mostrar, sem compartilhar chaves:

- [ ] ambiente correto do Stripe;
- [ ] preço ativo de R$ 39,90;
- [ ] moeda BRL;
- [ ] recorrência mensal;
- [ ] produto correto da Kolo Família;
- [ ] nenhuma alteração do preço mensal normal;
- [ ] nenhum link público permitindo contratar fora da regra da campanha.

Mensagem preparada para Karina enviar:

> Rô, chegamos à conferência do Stripe da Black Friday da Kolo Família. Por
> favor, abra o preço promocional que você criou e me mande uma captura que
> mostre apenas: produto Kolo Família, R$ 39,90, BRL, cobrança mensal, preço
> ativo e se o ambiente é o correto. Não envie senha, chave ou dados de cliente
> e não altere nem arquive o preço normal de R$ 54,90. Aguarde minha confirmação
> antes de fazer qualquer outra mudança.

## Portão 6 — teste humano sem cobrança

- [ ] Criar conta fictícia nova e confirmar 15 dias completos.
- [ ] Confirmar que não pede cartão para iniciar.
- [ ] Confirmar que não cobra automaticamente ao terminar.
- [ ] Simular trial antigo em curso e confirmar 15 dias totais.
- [ ] Simular trial encerrado e confirmar reentrada voluntária uma única vez.
- [ ] Simular ex-assinante e confirmar a mesma regra.
- [ ] Confirmar que pagante, cortesia e cobrança em recuperação não entram.
- [ ] Confirmar R$ 39,90 e anual oculto para participante elegível.
- [ ] Confirmar que assinar antes preserva todos os 15 dias.
- [ ] Confirmar o prazo individual e os 30 minutos do checkout.
- [ ] Confirmar que falha do Stripe não troca a oferta por R$ 54,90.
- [ ] Confirmar a pausa e a preservação de quem já entrou.
- [ ] Apagar os dados fictícios e guardar a prova da limpeza.

Nenhum passo deste portão conclui pagamento real.

## Portão 7 — ativação em 1º de novembro

Só executar com a frase explícita de Karina autorizando a ativação.

- [ ] Reconfirmar health, SHA, banco, Stripe e estado desligado.
- [ ] Registrar contagens por público antes de ativar.
- [ ] Ativar a campanha no Admin.
- [ ] Guardar prova de quem ativou, quando, estado anterior e estado novo.
- [ ] Fazer um cadastro fictício pelo caminho público e confirmar 15 dias.
- [ ] Conferir que o mensal mostrado é R$ 39,90 e o anual não aparece.
- [ ] Pausar imediatamente se qualquer prova divergir.

Mensagem promocional em massa não faz parte desta chave. Ela permanece
bloqueada pela PEND-109 até aprovação da prévia e teste isolado no celular de
Karina.

## Volta segura

Na primeira divergência:

1. pausar novas entradas no Admin;
2. preservar os dias e o preço de quem já entrou corretamente;
3. não apagar participações e não desfazer migração de forma destrutiva;
4. se o defeito for da aplicação, voltar o deploy para o último SHA saudável;
5. se houver risco de dados, interromper operações e usar a restauração provada;
6. registrar horário, alcance, famílias afetadas e evidência da recuperação;
7. só reativar com nova autorização de Karina.

## Pacote de provas para declarar produção validada

- [ ] prova do backup fora do servidor e do restore;
- [ ] resultado das migrações 0096 e 0097;
- [ ] URL do PR, SHA do merge e CI verde;
- [ ] SHA servido em produção e health sem segredos;
- [ ] captura do Admin desligado, ativado e pausado;
- [ ] conferência do Stripe sem dados de clientes;
- [ ] datas de trial e prazo da oferta das contas fictícias;
- [ ] prova de que não houve cobrança nem mensagem real;
- [ ] prova de limpeza dos dados de teste;
- [ ] decisão final de Karina.

## Veredito atual

**BLOQUEADO** para produção. Código e documentação estão preparados, mas
PEND-092, PEND-015, preview isolado e teste humano ainda impedem a virada.
