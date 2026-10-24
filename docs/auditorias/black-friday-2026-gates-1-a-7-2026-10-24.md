# Black Friday 2026 — prova dos Gates 1 a 7

Data da conferência: **24/10/2026** · branch:
`codex/black-friday-2026-core` · base de produção:
`25e8891daf1e0d5bd881512e6f128742fdcd0184`.

## Resumo para decisão

O pacote está **preparado localmente e desligado**. Ele não está em produção,
as migrações não foram aplicadas, nenhuma mensagem foi enviada e nenhuma
cobrança foi feita. O veredito para lançamento continua **BLOQUEADO**.

## Situação por portão

| Gate | Situação | Prova | O que falta |
|---|---|---|---|
| 1 · regras | PASSOU | `docs/specs/black-friday-2026.md`; testes das datas, 15 dias, preço e 30 minutos | nenhuma decisão comercial aberta para este recorte |
| 2 · banco | BLOQUEADO | migrações 0096 e 0097 escritas, chave nasce `desligada` | PEND-092: backup externo e restauração comprovada; depois aplicar em banco isolado e conferir |
| 3 · Stripe | PASSOU COM RESSALVAS | preço informado e conferido em leitura: `price_1UTQfzPAH1xSrJeSwmrOEor2`, BRL 3990, mensal e ativo; código recusa qualquer divergência | repetir leitura no dia da ativação e fazer checkout controlado somente com autorização |
| 4 · jornada | PASSOU COM RESSALVAS | tela de preços/assinatura, 15 dias, anual oculto, reativação voluntária e prazo individual implementados | prova visual e humana no celular em preview |
| 5 · checkout | PASSOU COM RESSALVAS | teste preserva trial, expira em 30 minutos, registra sessão antes de aceitar webhook e evita duplicidade | teste com Stripe em modo de teste/conta fictícia; sem cobrança real |
| 6 · Admin | PASSOU COM RESSALVAS | estado, preço, backup, ativar e pausar preparados; ativação falha fechada | migração isolada, perfil admin de QA e ensaio de pausa; Central de mensagens continua PEND-109 |
| 7 · preview | PARCIAL | 134/134 testes dirigidos, lint dirigido e typecheck sem erro | build no CI, banco isolado, QA mobile, exportação/exclusão e smoke test completo |
| 8 · produção | NÃO AUTORIZADO | health atual ainda serve a base antiga e saudável | backup, CI, preview, QA, aprovação expressa, migração, deploy e prova do SHA servido |

## Produção hoje

Leitura de `https://kolo-familia-web.vercel.app/api/health` em 24/10/2026 às
09:04 BRT:

- `ok: true`, banco saudável, 367 ms;
- branch `main`, SHA `25e8891daf1e0d5bd881512e6f128742fdcd0184`;
- Stripe em modo real;
- mensal normal R$ 54,90 e anual R$ 603,90;
- sem código, estado ou preço da Black Friday neste SHA.

Isso prova saúde do estado atual; não prova a campanha nova.

## Proteções preparadas

- preço promocional é validado pelo ID, valor, moeda, atividade e recorrência;
- a oferta falha fechada quando o banco ou o Stripe não confirmam;
- cadastrar cartão durante o trial não antecipa a cobrança;
- cancelar a assinatura promocional antes da cobrança preserva os dias grátis;
- cancelamento de assinatura foi separado da exclusão da conta;
- exclusão durante período pago é agendada para o fim do acesso;
- exclusões automáticas chegam em modo de simulação e exigem flags próprias;
- falha no cancelamento do Stripe impede apagar a conta;
- marketing exige aceite positivo e revogável; ausência de recusa não basta;
- cookies não essenciais só carregam depois de aceitar;
- Termos, Privacidade, Cookies e Regulamento foram preparados com identidade e
  regras aprovadas.

## Privacidade de IA

O código envia conteúdo familiar principalmente às APIs comerciais da Anthropic
e da OpenAI. As políticas oficiais consultadas em 24/10/2026 informam que dados
de API não são usados para treinar modelos por padrão; as duas citam retenção
padrão de até 30 dias e exceções de segurança/lei. Isto sustenta a redação de
"não autorizar treinamento", mas ainda não comprova a configuração das contas
da Kolo nem substitui DPA/contrato.

Antes da publicação jurídica, conferir e guardar prova de:

1. compartilhamento para treinamento desativado nas contas OpenAI e Anthropic;
2. nenhum programa voluntário de compartilhamento/feedback ativo;
3. DPA e transferências internacionais revisados;
4. fornecedores de WhatsApp, e-mail, banco, armazenamento e analytics listados;
5. acesso humano, retenção e exclusão em cada fornecedor.

## Decisões e aprovações ainda necessárias

1. **Karina:** aprovar a redação pública final após revisão jurídica do plugin/
   profissional; os arquivos V2 não bastam enquanto houver campos ou promessa
   sem prova técnica.
2. **Responsável pelo banco:** produzir backup externo e restaurá-lo em ambiente
   separado. Registrar data, local, hash, comando e resultado.
3. **Karina:** após preview e CI verdes, autorizar separadamente o Gate 8.
4. **Karina:** só depois do ensaio escolher se liga
   `ACCOUNT_DELETE_ENABLED` e `BF2026_RETENTION_DELETE_ENABLED`; a recomendação
   é manter ambas desligadas no primeiro deploy e validar primeiro o `dry-run`.
5. **Central de mensagens:** continua fora deste pacote. Nenhuma campanha deve
   ser disparada até PEND-109 ter fila gradual, canário, pausa e relatório.

## Prova automatizada

- 12 arquivos dirigidos, **134 testes aprovados**;
- teste específico do cancelamento promocional incluído;
- lint dirigido dos arquivos tocados: **exit 0**;
- typecheck após `next typegen`: **exit 0**;
- `git diff --check`: sem erro após normalização de fim de linha;
- build local: **sem veredito**, porque o ambiente não alcançou
  `fonts.googleapis.com` na primeira tentativa e não validou o certificado na
  tentativa externa, inclusive com os certificados do Windows; não foi contado
  como aprovado nem como defeito funcional comprovado. A segurança TLS não foi
  desativada para fabricar um resultado verde.

## Veredito

**BLOQUEADO para produção.** Gate 7 parcial; Gate 8 não autorizado.
