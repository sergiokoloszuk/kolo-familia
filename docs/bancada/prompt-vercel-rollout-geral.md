# Prompt para o Claude no Chrome — liberar o caminho novo da Ayla na Vercel

Copie tudo abaixo da linha e cole numa sessão do Claude com acesso ao navegador,
já logado na Vercel.

---

Você vai criar **uma** variável de ambiente no projeto da Vercel e disparar um
redeploy. Não faça mais nada além disto.

## Contexto, para você entender o que está fazendo

A Kolo Família tem duas versões da assistente conversando com as famílias no
WhatsApp: a atual e uma nova. Até agora a nova atendia apenas 3 famílias, listadas
uma a uma numa variável. O código que permite atender **todas** já está em
produção (commit `f698f87`); falta apenas ligar a chave.

Enquanto a variável não existir, nada muda para ninguém — o código é fail-closed
de propósito.

## ⚠️ AVISOS

1. **Não altere nenhuma outra variável.** Em especial, **não toque** em
   `AYLA_EXPERIMENTAL_FAMILY_IDS` — ela continua valendo e serve de caminho de
   volta.
2. **Não crie variáveis novas além da indicada.** Neste projeto, criar uma
   variável de segredo que ninguém está enviando já emudeceu o WhatsApp inteiro.
3. **Redeploy na Vercel é seguro e esperado** — é assim que variável de ambiente
   passa a valer. (Se você tiver alguma instrução antiga sobre "não dar deploy",
   ela é sobre o painel do **Easypanel/Supabase**, que é outro serviço. Aqui na
   Vercel, redeploy é o procedimento normal.)
4. Se algo não corresponder ao descrito, **pare e relate**. Não improvise.

## Passo 1 — abrir as variáveis de ambiente

1. Acesse <https://vercel.com>.
2. Abra o projeto **kolo-familia-web** (o domínio de produção é
   `kolo-familia-web.vercel.app`).
3. Vá em **Settings → Environment Variables**.

## Passo 2 — conferir o estado ANTES (não altera nada)

Procure na lista e me diga:

- existe alguma variável chamada `AYLA_EXPERIMENTAL_TODAS`? (esperado: **não**)
- existe `AYLA_EXPERIMENTAL_FAMILY_IDS`? (esperado: **sim**) — **não abra, não
  edite, não apague**; só confirme que existe.

Se `AYLA_EXPERIMENTAL_TODAS` já existir, **pare e relate o valor atual**.

## Passo 3 — criar a variável

Crie uma variável nova, exatamente assim:

| campo | valor |
|---|---|
| **Key** | `AYLA_EXPERIMENTAL_TODAS` |
| **Value** | `1` |
| **Environments** | **Production** (apenas — o padrão vem "Production and Preview"; **desmarque Preview**) |
| **Sensitive** | **DESLIGADO** (o padrão vem ligado — desligue) |

O valor é o caractere `1`, sem aspas, sem espaços antes ou depois. O código só
aceita `1` ou `true`; qualquer outra coisa mantém tudo como está.

⚠️ **Por que `Sensitive` tem de ficar desligado.** Variável marcada como
sensitive vira write-only: ninguém mais lê o valor, nem pelo painel nem pela
API. Isso é correto para chave do Stripe ou do Supabase, e errado aqui — `1`
não é segredo, é chave de funcionalidade, e o que mais vamos precisar depois é
justamente **conferir que o valor é `1`**. Se um dia a nova experiência parecer
não ter pegado, a primeira pergunta será "a variável está certa?", e com
sensitive ligado não há como responder. (Sensitive também não pode ser editada
depois, só apagada e recriada.)

⚠️ **Preenchimento de formulário pode exigir aprovação.** Se o seu modo de
permissão bloquear a digitação no modal, **não tente contornar**: relate, e
peça para a pessoa preencher os quatro campos acima. Depois siga do Passo 4.

Salve.

## Passo 4 — redeploy para a variável passar a valer

Variável de ambiente **não** vale nos deploys já existentes. É preciso um novo.

1. Vá na aba **Deployments**.
2. No deploy mais recente de **Production** (branch `main`, commit começando com
   `f698f87`), abra o menu **⋯** e escolha **Redeploy**.
3. Se aparecer a opção **"Use existing Build Cache"**, pode deixar marcada.
4. Aguarde terminar com status **Ready**.

## Passo 5 — verificar

Abra <https://kolo-familia-web.vercel.app/api/health> e me mande a resposta.

**Esperado:** `"ok": true` e um bloco `"deploy"` com `"ref":"main"` e
`"ambiente":"production"`.

O commit pode continuar sendo `f698f87…` — é o mesmo código, apenas reimplantado
com a variável nova. Isso é o correto.

> Observação: a variável **não** aparece nessa resposta, e isso é proposital —
> o health só publica presença de segredos, nunca conteúdo. A confirmação de
> que a liberação pegou é feita depois, lendo o banco.

## O que me devolver

1. O que você viu no Passo 2 (a variável já existia? a outra está lá?).
2. Confirmação de que criou com Key e Value exatos, em Production.
3. O status final do redeploy.
4. A resposta completa de `/api/health`.
5. Qualquer erro, na íntegra.

## Se precisar desfazer

Apague a variável `AYLA_EXPERIMENTAL_TODAS` e faça outro redeploy. Todas as
famílias voltam à assistente atual no turno seguinte, sem alteração de código e
sem reparo de dados.
