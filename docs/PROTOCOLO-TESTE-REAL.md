# Protocolo de rastreamento para teste real no WhatsApp

**Vale a partir do Gate B.** Aplica-se a todo teste humano em produção.

> O objetivo não é confirmar o comportamento esperado. É responder:
> **"por quais caminhos este turno poderia ter passado, inclusive os que ainda
> não mapeamos?"**

Este documento nasceu do Gate A, em que **seis correções** pareceram fechar o
mesmo defeito e cinco delas não fecharam — porque existiam outros consumidores
do mesmo dado, outros donos da mesma decisão e outras rotas produzindo o mesmo
efeito. Ver [GATE-A-BAIXA-2026-09-08.md](GATE-A-BAIXA-2026-09-08.md), §4.

Não substitui [AI-ENGINEERING-PROTOCOL.md](AI-ENGINEERING-PROTOCOL.md); é o
procedimento específico do teste com família real.

---

## Regra principal

Para cada teste, reconstruir de ponta a ponta:

```
entrada → roteamento → contexto → decisão → capacidade → persistência
        → resposta → ação → estado final
```

**Não assumir que o caminho nominal foi o caminho realmente usado.**

---

## 1 · Antes do teste

Registrar, sem alterar nada para "limpar o cenário":

SHA servido · Core ativo · Trial ativo · flags · família e criança alvo ·
estados pendentes · artefatos em `aguardando`/`gerando`/`erro` · contexto que
pode competir com o novo pedido · versão do código da frente em teste.

Se houver estado pré-existente, **registrar antes** — é como se sabe depois se
ele interferiu. Isolar só quando o teste exigir explicitamente.

## 2 · Durante o turno — rastrear todas as portas

Todo classificador ou decisor que teve **oportunidade** de atuar entra no
relato, **inclusive os que devolveram falso**: segurança · alvo/criança ·
intenção · pedido explícito · ato sobre artefato · rotina pendente · proposta
pendente · tema pendente · decisor de pergunta · Perfil · memória/histórico ·
Core · Trial · contrato especializado · fallback · conversa comum · capacidade
de artefato · ponte pós-resposta · reconciliadores e jobs.

Para cada um: **entrou? · resultado · por quê · que dado leu · que estado
escreveu.**

## 3 · Procurar caminhos que não imaginamos

Pergunta obrigatória:

> **"Existe outro lugar no sistema capaz de produzir o mesmo efeito por uma rota
> diferente?"**

Procurar em: outros consumidores do mesmo dado · estado em outra tabela ·
`metadata` de mensagem · histórico recente · Perfil/Kolo Vivo · contratos
legados · código especializado · fallback · jobs e reconciliadores · callbacks
pós-envio · **funções que transformam o mesmo conceito com outro nome**.

> Aprendido no Gate A: não bastava procurar "barco" em `transicoes`. Havia
> `rotinaExistente`, o histórico da conversa (em dois destinos), o `pontoDificil`
> e o fluxo de tema — cinco rotas para o mesmo efeito.

## 4 · Registrar todas as saídas possíveis

Para cada função decisional crítica, enumerar: sucesso · `return null` ·
fallback · erro tratado · **erro silencioso** · timeout · estado parcial ·
resposta comum · artefato não criado · **artefato criado mas não entregue** ·
entrega sem ação · **ação sem mensagem** · **mensagem sem ação**.

**Nenhum `return null`, `undefined`, `catch` silencioso ou fallback fica sem
interpretação no rastro.** Saída não instrumentada é lacuna registrada, e a
observabilidade se corrige **antes** de o teste valer como prova.

## 5 · Fala ≠ ação

Provar separadamente **o que a Ayla disse** e **o que o sistema fez**.

- "vou gerar" não prova geração;
- "ficou combinado" não prova persistência;
- "já atualizei" não prova escrita;
- "a sequência ficou assim" não prova que o artefato contém aquela sequência.

Para cada afirmação operacional: **mensagem → ação → registro → estado →
artefato real**.

## 6 · Perfil e memória

Registrar: criança selecionada · linha de Perfil usada · fatos considerados ·
fatos descartados **e por quê** · quais eram atuais, históricos, hipóteses,
estratégias anteriores · houve correção recente da família? · **algum dado de
outro filho apareceu?**

Não basta provar que o Perfil foi carregado. É preciso provar **qual dado
influenciou a decisão**.

## 7 · Conhecimento (a partir do Gate F)

Boas Práticas · base2 · pós — separadamente: por que a fonte foi necessária · o
que mudou na decisão · **o que teria sido respondido sem ela** · trouxe
conhecimento irrelevante? · aumentou latência sem melhorar a orientação?

**Conhecimento recuperado nunca vira fato sobre a criança.**

## 8 · Latência — regressão cumulativa

Orçamento por turno: webhook → debounce → orquestrador → contexto → decisor →
Perfil → conhecimento → capacidade especializada → LLM → persistência → envio.

Registrar duração · número de chamadas · modelo · tokens quando disponíveis ·
**consultas repetidas** · **operações em série que poderiam ser paralelas**.
Comparar com os gates anteriores.

## 9 · Depois do teste — relatório em três blocos

**A · O que a família percebeu** — comportamento visível e qualidade da conversa.

**B · O que o runtime realmente fez** — cadeia com IDs, estados, decisões, ações.

**C · O que quase aconteceu** — caminhos alternativos encontrados que poderiam
ter produzido comportamento errado, **mesmo sem terem disparado**.

⚠️ **O bloco C é obrigatório.** É onde os próximos defeitos aparecem antes da
família.

## 10 · Caça a saídas não imaginadas — ao final de cada gate

1. Existem outros consumidores do mesmo dado?
2. Existem outros donos da mesma decisão?
3. Existem estados antigos que ainda podem competir?
4. Existem janelas temporais diferentes para o mesmo conceito?
5. Existem fallbacks que pulam o novo comportamento?
6. Existe caminho em que a **fala ocorre sem a ação**?
7. Existe caminho em que a **ação ocorre para o objeto errado**?
8. Existe outro filho ou família que pode contaminar?
9. Existe branch legado ainda acionável?
10. Existe alguma saída sem telemetria?

**Qualquer "sim" ou "não sei" impede o encerramento do gate.**

## 11 · Padrão de conclusão

**PRODUÇÃO PROVADA — SEM REGRESSÃO** exige, junto: comportamento correto ·
rastro do runtime · estado correto · **ação real** · regressões acumuladas ·
nenhuma saída crítica sem observabilidade · nenhum caminho alternativo relevante
por investigar.

> **Teste passou ≠ arquitetura fechada.**
> Cada gate precisa reduzir o número de caminhos ambíguos do sistema.
