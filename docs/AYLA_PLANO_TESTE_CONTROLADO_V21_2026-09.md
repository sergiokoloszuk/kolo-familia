# Plano de entrada da v2.1 em produção — teste controlado

> ## ⚠️ RETIFICAÇÃO — 05/09/2026
>
> **Este documento afirmou que Claude e GPT eram dois providers conversacionais
> válidos em produção. Está errado, e a correção importa.**
>
> **PROVEI POR EXECUÇÃO:** `lib/ayla/experimental.ts:969` fixa
> `const provider = "openai" as const`. O caminho oficial do WhatsApp — 97,4%
> dos turnos — **nunca** usa Claude e ignora o seletor de provider. Eu li o
> registro `MODELO_CONVERSA` inteiro (que contém os dois) e reportei o lado
> errado.
>
> **Consequência:** onde este documento fala em "Claude × GPT" ou "fallback
> Claude", leia **GPT nas duas colunas**. As diferenças que atribuí a providers
> eram variação entre execuções do mesmo modelo.
>
> **DECISÃO DE PRODUTO (05/09/2026):** GPT é o cérebro conversacional e
> interpretativo da Ayla. Claude não responde família em canal nenhum. O
> endurecimento arquitetural disso é frente própria — ver
> `docs/AYLA_ATIVACAO_V10_2026-09.md`.



**Nada ativado.** Core v9 e Trial v5 seguem ativos; banco, flags, tráfego e
famílias intactos. O patch da seção 9 **não foi aplicado**.

Levantado em 05/09/2026, por leitura de código e consulta de produção.

---

## 1. Arquitetura atual relevante

**VI NO CÓDIGO** — o ponto único onde o Core entra no turno oficial:

```
experimental.ts:759
  cron("core", resolverDocumento(supabase, "core", params.rascunhoCore ?? null))
                                                   └── já é o override
```

`resolverDocumento` (`lib/ayla/documentos.ts`) tem **três** caminhos, nesta
ordem: rascunho passado por parâmetro → documento `status = 'ativo'` no banco →
fallback do código. **O override por parâmetro já existe e já é usado** — é o que
o simulador do Admin passa (`admin/inteligencia/actions.ts:130`).

Hoje, só o simulador o usa. A conversa real sempre passa `null`.

---

## 2. Mecanismo existente para reutilizar — **há, e é completo**

Não é preciso criar nada de arquitetura. Quatro peças já existem, testadas e em
produção:

| Peça | Onde | O que resolve |
|---|---|---|
| **Rollout em três estados** | `lib/conducao/rollout.ts` | `estadoDeRollout` · `listaDeFamilias` · `alcancaFamilia`. **Fail-closed por construção:** sob `teste`, lista vazia = ninguém. Ir para todos exige digitar `on`, que é decisão, não descuido |
| **Referência de uso** | `lib/conducao/piloto.ts` | 14 linhas. O piloto da Fase 4A já faz exatamente isto, por `family_account_id` |
| **Override do Core** | `documentos.ts` → `resolverDocumento(_,_, rascunho)` | injeta um Core alternativo sem publicar |
| **Leitura do rascunho** | `documentos.ts` → `lerRascunho(supabase, "core")` | lê a versão com `status = 'rascunho'` |

E o versionamento do documento já suporta o teste: `ayla_documentos` guarda
várias versões por chave, com `status` em `ativo` / `rascunho` / `arquivado`.
**PROVEI POR EXECUÇÃO:** existem 9 versões de `core` no banco, uma ativa (v9) e
uma em rascunho (v7).

⚠️ **Uma consequência disso:** o slot de rascunho está **ocupado pela v7**.
Publicar a v2.1 como rascunho sobrescreve o que está lá. É decisão, não
obstáculo — mas precisa ser consciente.

## 3. Telemetria — **já existe, completa, sem precisar de nada novo**

**PROVEI POR EXECUÇÃO** (produção, turno reativo de 05/09 às 14:33):
`ayla_send_log.payload.meta` tem **36 chaves**, entre elas:

```
ayla_path      experimental
coreVersao     9              ← distingue os grupos sozinho
coreOrigem     admin
provider       openai
modelo         gpt-5.6-luna   ← responde "qual provider respondeu"
msTotal        5665           ← latência
jornada_dia    2
bpInjetadas    2
tokensEntrada  10280
forma_modo     off
foco           unica
```

**Nenhum log novo é necessário.** `coreVersao` já separa v9 de v2.1, e `provider`
/ `modelo` já dizem quem respondeu. Não é preciso registrar telefone — a chave é
`family_account_id`, que é o identificador interno adequado.

⚠️ Observação, não recomendação: `ayla_send_log.payload.phone` **já** guarda o
telefone hoje, em todos os envios. É estado anterior a este plano; não estou
propondo acrescentar nem remover nada.

---

## 4. Plano de seleção das famílias

**Entrada explícita, por `family_account_id`, escrita à mão.** Nenhuma seleção
automática, nenhuma amostragem, nenhum hash de telefone.

Sequência proposta:

1. **Onda 0 — só contas nossas.** Uma ou duas contas de operação. Objetivo: ver
   a v2.1 no WhatsApp real, com Perfil real, e conferir a telemetria chegando
   com `coreVersao` diferente de 9.
2. **Onda 1 — 3 a 5 famílias reais acompanhadas.** Critérios sugeridos, a
   decidir por vocês: com Trial ativo ou assinatura (para não misturar com
   condução comercial), com Perfil já povoado (senão não se mede continuidade) e
   com histórico de escrever com alguma frequência (senão não há conversa para
   revisar).
3. **Onda 2 — só depois da revisão humana da Onda 1.**

**Grupo de comparação:** não é preciso sortear. Todas as demais famílias
continuam na v9 e já geram os mesmos dados. A comparação é v2.1 (poucas) contra
v9 (todas), com a ressalva de que os grupos não são equivalentes — ver §7.

## 5. Rollback

Três níveis, do mais rápido ao mais completo:

| Precisa | Como | Efeito |
|---|---|---|
| Tirar **uma** família | remover o id da variável de allowlist | **turno seguinte** |
| Tirar **todas** | apagar a variável de estado | **turno seguinte**, sem deploy |
| Desfazer tudo | remover o rascunho do banco | o `resolverDocumento` cai na v9 ativa |

⚠️ **O rollback não exige deploy** — é o mesmo padrão de
`AYLA_EXPERIMENTAL_TODAS`, cuja reversão documentada é "apagar a variável no
ambiente; volta todo mundo no turno seguinte".

E o fail-closed protege o acidente mais provável: se a variável da lista sumir
por engano, sob `teste` isso significa **ninguém na v2.1**, não "todo mundo".

---

## 6. Como comparar v9 × v2.1 com o que já temos

Tudo abaixo sai de `ayla_send_log.payload.meta` + `ayla_messages.texto`, sem
instrumentação nova:

| O que medir | De onde |
|---|---|
| Tamanho da resposta | `length(ayla_messages.texto)` |
| Nº de perguntas | contagem de `?` no texto |
| **Resposta que só pergunta** | texto sem verbo de orientação — precisa de leitura humana para o caso limite; a contagem automática serve de filtro |
| Repetição de informação já conhecida | comparar a resposta com o bloco de contexto do turno — **não é automático**, ver §7 |
| Sinais de invenção | **não é automático.** Cruzar afirmações sobre a criança com `perfil_vivo_membro` |
| Promessa de capacidade inexistente | regex sobre "vou montar / vou gerar / salvei / registrei / atualizei" — automático e confiável |
| Segurança | `respostaOrientouEmergencia()` **já existe** e é determinística (§8) |
| CTA/pergunta final | resposta termina em `?` |
| Latência | `meta.msTotal` |
| Provider | `meta.provider` + `meta.modelo` |
| Grupo | `meta.coreVersao` |
| Repertório recebido | `meta.bpInjetadas` — **importante para não confundir efeito do Core com efeito do classificador (§10)** |

## 7. Revisão humana — a parte que não pode ser só número

Métrica não responde *"essa família parece estar sendo mais compreendida?"*.
Proponho o mais simples que funciona:

**Uma tela de leitura, no Admin, com a conversa inteira de uma família** —
inbound e outbound em ordem, com `coreVersao` marcado em cada resposta. Sem
recorte por turno.

E **três perguntas por conversa**, respondidas por uma pessoa, com uma frase de
justificativa:

1. **A Ayla usou o que já sabia sobre esta criança, ou perguntou de novo?**
2. **A conversa avançou, ou ficou girando no mesmo ponto?**
3. **Se você fosse essa mãe, teria se sentido ajudada hoje?**

Escala de três pontos (pior / igual / melhor), comparando contra a leitura de
uma conversa da mesma família **antes** de entrar no teste. É a comparação mais
honesta disponível: a mesma família consigo mesma.

⚠️ **Quem revisa não deve saber qual Core respondeu.** O `coreVersao` pode ficar
oculto na tela de revisão e ser revelado só na hora de tabular. Sem isso, a
revisão confirma a expectativa de quem revisa.

## 8. Continuidade — como revisar sem tocar a experiência

O objetivo central da v2.1 (**lembrar → não repetir → usar o que aconteceu →
dar o próximo passo**) não se vê em mensagem isolada.

**Tudo já está gravado.** `ayla_messages` guarda inbound e outbound com
`family_account_id`, `direcao`, `created_at`. Ler uma janela de vários dias é uma
consulta — **nenhuma alteração de experiência, nenhum toque na família**.

Três recortes propostos, todos por leitura:

1. **Janela de 7 dias por família**, conversa inteira. É o que responde as três
   perguntas da §7.
2. **Pares pergunta-resposta repetidos:** a mesma pergunta da Ayla aparecendo
   duas vezes na janela. Detectável por semelhança de texto entre outbounds.
3. **Retomada:** a Ayla citou algo que a mãe contou em um dia anterior? Precisa
   de leitura humana — mas o filtro pode ser automático: outbound que contém um
   termo raro presente só em inbound de dias anteriores.

⚠️ **Uma janela de 7 dias é curta para medir continuidade** e é o que dá para
observar rápido. Para o objetivo real, o horizonte é o do Trial inteiro — mas aí
o resultado sai em duas semanas, não em dois dias.

---

## 9. O patch mínimo — **não aplicado**

Três arquivos, ~20 linhas. Espelha `piloto.ts` linha por linha.

**(a) `lib/conducao/piloto-core.ts`** — novo, ~15 linhas:

```
FLAG_CORE_PILOTO           = "AYLA_CORE_PILOTO"
FLAG_CORE_PILOTO_FAMILIAS  = "AYLA_CORE_PILOTO_FAMILIAS"

estadoCorePiloto()  → estadoDeRollout(env, "teste", "on")
familiaNoCorePiloto(familyAccountId) → alcancaFamilia(estado, lista, id)
```

**(b) `lib/ayla/experimental.ts`** — 3 linhas na montagem, antes do `Promise.all`:

```
const corePiloto = familiaNoCorePiloto(params.familyId)
  ? await lerRascunho(supabase, "core")
  : null;
```
…e trocar `params.rascunhoCore ?? null` por `params.rascunhoCore ?? corePiloto`.

**A ordem importa:** o rascunho do simulador continua vencendo, para não quebrar
o Admin.

**(c) Ambiente (Vercel), sem deploy de código:**
```
AYLA_CORE_PILOTO=teste
AYLA_CORE_PILOTO_FAMILIAS=<ids, separados por vírgula>
```

**(d) Banco:** publicar a v2.1 como `status = 'rascunho'` da chave `core`.
⚠️ Isso **substitui o rascunho v7** que está lá hoje.

**O que este patch NÃO faz:** não toca o Core v9 ativo, não toca Trial v5, não
toca o montador de prompt (só o argumento de uma chamada), não cria tabela, não
cria log, não muda tráfego de ninguém fora da lista.

**Custo do erro:** se `AYLA_CORE_PILOTO` não existir, `estadoDeRollout` devolve
`off` e `alcancaFamilia` devolve `false` para todos. O caminho de falha é
"continua tudo como está".

---

## 10. O papel do Haiku — e ele afeta a medição

**MEDI** (produção, 200 chamadas recentes a `claude-haiku-4-5`):

| Feature | Chamadas | O que decide |
|---|---|---|
| `classificar_intencao` | **60** | ⚠️ **as skills do turno** |
| `ayla_espontanea` | 40 | escreve a mensagem proativa |
| `ayla_parser_pos` | 38 | interpreta a mensagem |
| `ayla_dedup_diario` | 18 | evita registro duplicado |
| `classificar_area_diario` | 18 | área do registro |
| `ayla_rotear_kv` | 16 | onde o fato entra no Perfil |
| `ayla_conflito_kv` | 9 | detecta contradição no Perfil |
| `conversa_titulo` | 1 | título |

⚠️ **Sim, o caminho leve afeta materialmente o que queremos medir — e por uma
via específica:**

`classificar_intencao` decide as **skills** do turno. As skills decidem se
`recuperarBoasPraticas` devolve alguma coisa. Se devolve, o bloco 5 existe; se
não, **nenhuma Boa Prática chega ao modelo** — e o código registra que
`skills = []` em **55% dos turnos**.

Ou seja: duas famílias podem receber quantidades diferentes de repertório clínico
**por decisão do classificador, não do Core**. Comparar v9 × v2.1 sem olhar isso
mede uma soma de duas coisas.

**Mitigação sem tocar em nada:** `meta.bpInjetadas` e `meta.bpChars` já estão
gravados em todo turno. Basta **estratificar a comparação** por "recebeu
repertório × não recebeu" e conferir se os dois grupos ficaram equilibrados.

O arnês `__harness/prova-real.ts` já tinha percebido isto e fixa o classificador
de propósito, *"para que a única variável entre as duas rodadas seja o texto do
núcleo"*. Em produção não dá para fixar — dá para medir.

**Nada do caminho leve foi alterado.**

---

## 11. CVV/SAMU — a garantia determinística já tem onde morar

**Registro do achado:** na validação de 05/09, no desabafo com sinal de risco, o
Claude fez a pergunta de risco em **3/3** mas citou CVV/SAMU em **2/3**. O GPT,
3/3. Ocorrência isolada, não repetida.

**VI NO CÓDIGO — o que já existe em `lib/ayla/estado-seguranca.ts`:**

| Peça | O que faz | Determinística? |
|---|---|---|
| `RISCO_INEQUIVOCO` | 8 regex de risco explícito (suicídio, automutilação, overdose…) | **sim, sem IA** |
| `mensagemPedeSeguranca(texto)` | a mensagem, sozinha, já pede encaminhamento? | **sim** |
| `textoSegurancaSemAcesso(nome)` | texto fixo **com 192, 188 e CAPS** | **sim** |
| `respostaOrientouEmergencia(texto)` | ⚠️ **a resposta gerada citou CVV/188/SAMU/192/CAPS?** | **sim** |
| `segurancaAberta`, `riscoEhAtual` | estado de risco pelas últimas 12h | usa IA |

**A resposta à pergunta é: sim, o ponto adequado existe — e é
`respostaOrientouEmergencia`.** Ele já roda sobre a resposta pronta e já sabe
dizer se as linhas de ajuda estão lá.

**O que falta é a ação.** Hoje ele **detecta e registra estado**; não acrescenta
nada quando devolve `false`. E o formato da correção também já existe: as
fronteiras (`lib/conducao/fronteiras.ts`) têm o padrão **detector → instrução de
refazer → piso**, com `respostaSeguraClinica` e `respostaSeguraDeDiagnostico`
como pisos prontos.

Ou seja: uma "fronteira de encaminhamento" caberia no padrão vigente, sem
mecanismo novo.

⚠️ **Duas ressalvas de escopo, medidas:**
1. `mensagemPedeSeguranca` só roda hoje para famílias **sem acesso** — é o piso
   de quem o gate barrou (PEND-071). Para quem tem acesso, o caminho é
   emergente.
2. `RISCO_INEQUIVOCO` é **narrow de propósito**. A mensagem da bancada ("hoje eu
   não aguento mais… chorei no banheiro escondida") **não casa** com nenhum dos
   8 padrões — e não deveria: o comentário no código diz que falso positivo aqui
   "manda CVV e SAMU para quem perguntou sobre cobrança", e assustar uma família
   que não está em crise é dano real.

**Não implementei nada.** Fica registrado que o ponto existe, que o padrão
existe, e que a decisão sobre alargar o gatilho é de produto, não técnica.

---

## Classificação

# PRONTO PARA IMPLEMENTAR TESTE CONTROLADO

Não há bloqueador. O mecanismo de allowlist existe e é fail-closed; o override do
Core existe e já é usado; a leitura do rascunho existe; a telemetria existe
completa, com `coreVersao`, `provider` e `modelo`; o rollback é apagar uma
variável e vale no turno seguinte.

O patch é de ~20 linhas, espelhando um arquivo que já está em produção.

### Três coisas para decidir antes de aplicar

1. **O rascunho de `core` está ocupado pela v7.** Publicar a v2.1 ali substitui.
2. **Quem revisa deve ler às cegas** — senão a revisão confirma a expectativa.
3. **A comparação não é entre grupos equivalentes.** Poucas famílias escolhidas a
   dedo contra todas as demais. Serve para detectar problema, **não** para
   afirmar que a v2.1 é melhor. A afirmação forte exigiria a mesma família
   consigo mesma, antes e depois — que é o que a revisão da §7 propõe.
