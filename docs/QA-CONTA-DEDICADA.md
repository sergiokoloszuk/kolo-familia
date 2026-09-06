# Conta QA dedicada — Rotina Visual, caminho reativo

Procedimento para ter uma família de teste **em produção** sem usar conta de
família real. Escrito em 06/09/2026, para homologar a retomada reativa de
artefato pendente (`b816ef2`).

> **Estado:** preparado até onde não depende de telefone. Os passos 1 a 3
> exigem um número de WhatsApp disponível e **não foram executados**.

---

## Por que uma conta nova, e não uma que já existe

Há três famílias com `controle_acessos.ativo = true` — isentas de paywall e de
trial por `ehStaffPorUserId` (`lib/auth/acesso.ts`). Nenhuma serve:

- **`9c14b56b`** é a família da **Karina**: 2 crianças, 41 rotinas, uso real e
  diário. Foi nela que a rotina órfã da Manu apareceu. É produção de verdade.
- **`a376ba52`** e **`4135061b`** têm cara de conta de desenvolvimento (1
  criança, 1 e 5 rotinas), mas **o proprietário não está identificado de forma
  inequívoca**. Não se mexe numa conta sem saber de quem ela é.

Decisão de 06/09/2026: **criar a quarta, dedicada e descartável.**

---

## O que NÃO fazer

- **Não criar a família por SQL direto.** `handle_new_user` cria a família e o
  trial, e é onde vive o hash que faz "um teste por pessoa". Uma família
  inserida à mão não se parece com as reais — que é o oposto do que um QA serve
  para fazer. Além disso, nada pode estourar dentro desse gatilho.
- **Não reaproveitar número de ninguém.** `whatsapp_e164` **não tem constraint
  UNIQUE** (pendência conhecida). Hoje a base tem zero duplicados; um repetido
  rotearia a conversa da Ayla para a família errada.
- **Não pôr dado de família real.** Nome, idade e diagnóstico da criança são
  fictícios, e ficam fictícios.

---

## Pré-requisito que custa mundo real

**Um número de WhatsApp ativo, novo, que alguém nosso segure.**

Não há como contornar, por duas razões independentes:

1. Desde 21/08/2026 o único caminho que grava `whatsapp_e164` é
   `concluirVerificacao`, **depois de conferir um código** — e o código chega
   **pelo próprio WhatsApp**. Sem um aparelho que receba, o cadastro não fecha.
2. A Ayla responde por Z-API **para o número da família**. Testar entrega exige
   um telefone que receba a resposta.

Chip pré-pago ou um segundo WhatsApp Business resolvem. O número não pode já
estar em nenhuma conta: `numeroDeOutraConta` recusa no onboarding, antes mesmo
de o código sair.

---

## Passo 1 — signup pelo caminho real

Em `https://kolo-familia-web.vercel.app/signup`, com:

| Campo | Valor |
|---|---|
| E-mail | `qa+rotina@kolofamilia.com.br` (ou outro que você receba) |
| Nome da família | **`QA Kolo`** |

O `+rotina` no e-mail deixa a conta **identificável de longe** em qualquer
listagem, e permite criar `qa+outracoisa@` no futuro sem caixa nova.

Confirmar o e-mail normalmente (SMTP Brevo, já funciona).

---

## Passo 2 — onboarding padrão, criança fictícia

Seguir o onboarding sem pular etapa — é justamente o caminho que queremos
exercitar.

| Campo | Valor |
|---|---|
| Nome | **`Teste QA`** |
| Nascimento | uma data que dê **6 anos** |
| Gênero | qualquer |
| Diagnóstico / desafios | fictícios, genéricos |

Seis anos porque é a faixa central da Rotina Visual: o filtro de idade do
repertório e o `rotuloDoSujeito` se comportam como no caso comum.

**Uma criança só.** O limite de uma criança por família é validado no servidor
(`checarLimiteDeCriancas`); admin é isento, mas não há motivo para usar a
isenção aqui.

Na etapa do WhatsApp, informar o número QA e **confirmar o código** que chegar.
É esse passo que grava `whatsapp_e164`.

---

## Passo 3 — isentar de paywall e trial

Pelo Admin, em **`/admin/admins`** (ação `addAdmin`), incluir o `user_id` da
conta QA com `ativo = true`.

Isso a torna staff para efeito de acesso (`ehStaffPorUserId`), e some com toda
interferência de assinatura no meio do teste — inclusive o trial de 7 dias
vencendo no meio de uma bateria.

> Não usar `/admin/setup`: aquela rota é para inicializar o **primeiro** admin.

---

## Passo 4 — checklist de roteamento

**Antes de mandar qualquer mensagem**, provar que o número aponta para essa
família e só para ela. Falhar aqui significa conversar com a conta de outra
pessoa.

- [ ] `select id, nome_familia, whatsapp_e164 from family_accounts where whatsapp_e164 = '<numero>'` devolve **exatamente uma** linha, e é a `QA Kolo`.
- [ ] O mesmo número não aparece em nenhuma outra família (a coluna não é única — conferir é obrigatório, não opcional).
- [ ] `onboarding_completed = true`.
- [ ] Exatamente **uma** criança ativa em `membros_atipicos`, chamada `Teste QA`.
- [ ] `controle_acessos.ativo = true` para o `user_id` da conta.
- [ ] `ayla_preferences.desativada` **não** é `true` (senão o reativo ignora a família inteira).
- [ ] Nenhuma rotina pré-existente: a bateria começa do zero.

---

## Passo 5 — criar uma Rotina Visual deliberadamente em `aguardando`

O estado que interessa é: **rotina gravada, com etapas, sem tema,
`cards_status = 'aguardando'`** — o mesmo em que a Manu e a Maria Julia ficaram.

Pelo WhatsApp, do número QA:

1. `Quero uma rotina visual pra manhã`
2. Quando a Ayla pedir a sequência: `acordar, escovar os dentes, café, vestir, escola`
3. Quando ela pedir confirmação: `Isso`

**Não dizer o tema em momento nenhum.** É a ausência do tema que produz o
`aguardando`.

Conferir o estado antes de seguir:

```sql
select id, nome, tema, cards_status from rotinas
where family_account_id = '<qa>' order by created_at desc limit 1;
```

Esperado: `tema = null`, `cards_status = 'aguardando'`, e etapas em
`rotina_tarefas`.

> ⚠️ Se a Ayla disser "pronto" ou "está montada" neste ponto, **isso é a falha
> que o portão 3 deve impedir** — anotar a fala literal, é evidência.

---

## Passo 6 — os seis turnos

Um por vez, esperando a resposta completa antes do próximo. Entre turnos,
registrar o estado da rotina.

| # | Mensagem | O que precisa acontecer |
|---|---|---|
| 1 | `cadê?` | encontra a rotina pendente e **pergunta o tema**, nomeando a rotina |
| 2 | `e agora?` | idem — não repete pergunta genérica, não troca de assunto |
| 3 | `consegue trazer?` | idem |
| 4 | `não apareceu` | idem |
| 5 | `manda pra mim` | idem |
| 6 | `e as figuras?` | idem |

Depois dos seis, responder **`Tema dinossauro`** e provar o ciclo até o fim:
tema gravado → `gerando` → `pronto` → `imagem_url` preenchida e recuperável →
entrega → fala que afirma conclusão **só então**.

### O que cada turno tem de provar

- [ ] **Uma única resposta.** Zero duplicidade — é a concorrência
      `resposta_registro` × `rotina_conversa`, ainda não fechada.
- [ ] **Nenhum Plano** foi gerado por acidente.
- [ ] **Nenhum "pronto" falso** enquanto `cards_status` não for `pronto`.
- [ ] **Nenhuma rotina nova** criada — a cobrança não pode virar pedido novo.
- [ ] A pergunta é **específica** ("falta o tema desta rotina"), nunca
      "sobre quem você está falando?".
- [ ] A pergunta sai como `tipo = 'rotina_conversa'`, para que a resposta
      volte à condução.
- [ ] Evento persistido em `eventos_app` com `kind = artefato_faltou_dado`.

---

## Passo 7 — descarte

A conta é descartável e **deve ser descartada** ao fim da bateria, ou marcada
de forma que nunca entre em métrica de produto.

Dado de teste marcado **não é** dado de teste isolado: enquanto existir, a
família aparece em contagens, em varreduras de cron e nas escolhas da Ayla.

- [ ] Rotinas e artefatos da bateria apagados.
- [ ] Se a conta for mantida entre baterias, conferir que ela está fora dos
      dashboards e dos crons de proativa (`ayla_preferences.desativada = true`
      **entre** baterias, e `false` durante).
