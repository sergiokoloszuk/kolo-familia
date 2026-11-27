# Demonstração da Ayla na landing — contrato para a integração

PEND-259 · 27/11/2026 · código em `apps/web/src/lib/demo/` e `apps/web/src/app/api/demo/`

## O que a pessoa vive

1. Na landing, a seção de teste avisa que a demonstração precisa de **cerca de 20 minutos de atenção**.
2. Ela informa **nome, e-mail e WhatsApp** e aceita os termos.
3. Recebe no WhatsApp um **código de 6 dígitos** e o digita na página.
4. Conversa com a Ayla **na própria página**, por até **20 minutos** (no máximo 30 mensagens).
5. Ao encerrar, ou quando o tempo acaba, recebe no WhatsApp o **resumo da conversa** com o link para criar a conta e escolher o plano. Não há dias grátis.
6. O mesmo WhatsApp **não faz outra demonstração**. O número é comparado sem o país e sem o 9º dígito, então `+55 11 98888-7777` e `11 8888-7777` são o mesmo número.

## Ligar e desligar

| Variável na Vercel | Efeito |
|---|---|
| `DEMO_AYLA_HABILITADA=1` | Liga as rotas. Sem ela, todas respondem `503 {"motivo":"desligada"}` |
| `DEMO_ORIGENS_PERMITIDAS` | Domínios da landing, separados por vírgula (ex.: `https://www.kolofamilia.com.br`). O app já é aceito por padrão |

Pré-requisitos:
- migração `0101_demonstracao_ayla.sql` aplicada;
- documento **"Demonstração (landing)"** ativo em `/admin/documentos`. Sem ele, a conversa responde `indisponivel`.

## Rotas

Todas são `POST` com JSON e respondem JSON com `ok`. Quando `ok` é `false`, vem um `motivo`.

### 1. `POST /api/demo/codigo`

```json
{ "nome": "Marina Souza", "email": "marina@exemplo.com", "whatsapp": "(11) 98888-7777", "aceite": true }
```

| Resposta | HTTP | O que a landing mostra |
|---|---|---|
| `{ "ok": true, "demoId": "uuid" }` | 200 | Campo para digitar o código |
| `motivo: "dados_invalidos", campo: "nome" \| "email" \| "whatsapp" \| "aceite"` | 400 | Erro no campo indicado (o WhatsApp precisa ser celular) |
| `motivo: "ja_usou"` | 409 | "Este WhatsApp já fez a demonstração" + botão para criar conta |
| `motivo: "cooldown", segundosRestantes` | 429 | "Aguarde N s para pedir outro código" |
| `motivo: "max_reenvios"` / `"limite_global"` | 429 | "Tente mais tarde" |
| `motivo: "envio_falhou"` | 503 | "Não conseguimos enviar o código agora" |

Pedir de novo depois de 60 s gera um código novo e invalida o anterior (máximo de 3 reenvios).

### 2. `POST /api/demo/confirmar`

```json
{ "demoId": "uuid", "codigo": "123456" }
```

| Resposta | HTTP | O que a landing faz |
|---|---|---|
| `{ "ok": true, "token": "...", "segundosRestantes": 1200 }` | 200 | Guarda o `token` só na memória da página (não em cookie) e abre o chat com o cronômetro |
| `motivo: "codigo_errado"` | 400 | "Código incorreto" |
| `motivo: "max_tentativas"` | 429 | "Muitas tentativas — peça outro código" |
| `motivo: "expirado"` / `"sem_pedido"` | 410 | "Código vencido — peça outro" |
| `motivo: "ja_usou"` | 409 | Igual à rota 1 |

### 3. `POST /api/demo/mensagem`

```json
{ "token": "...", "texto": "Meu filho não quer dormir" }
```

| Resposta | HTTP | O que a landing faz |
|---|---|---|
| `{ "ok": true, "resposta": "...", "segundosRestantes": 980, "estado": "ativa" }` | 200 | Mostra a resposta. Se `estado` não for `ativa`, chama a rota 4 |
| `motivo: "tempo_esgotado"` / `"turnos_esgotados"` / `"encerrada"` | 409 | Chama a rota 4 e mostra o fechamento |
| `motivo: "concorrente"` | 409 | Outra mensagem ainda está sendo respondida; espere e tente de novo |
| `motivo: "mensagem_invalida"` | 400 | Mensagem vazia ou com mais de 1500 caracteres |
| `motivo: "indisponivel"` | 503 | "A Ayla não respondeu agora — tente de novo" |
| `motivo: "token_invalido"` | 401 | Recomeçar |

Uma mensagem de cada vez: a landing deve travar o botão de envio enquanto espera a resposta, que pode levar alguns segundos.

### 4. `POST /api/demo/encerrar`

```json
{ "token": "..." }
```

`{ "ok": true, "resumoEnviado": true, "linkCadastro": "https://app.kolofamilia.com.br/signup?de=demonstracao" }`

Pode ser chamada mais de uma vez: o resumo sai **uma** vez. A landing mostra o fechamento ("Enviei o resumo no seu WhatsApp") e o botão **Criar minha conta** apontando para `linkCadastro`.

Se vier `motivo: "envio_falhou"` (503), a landing pode chamar de novo depois de alguns segundos.

## Ajustar a Ayla da demonstração

- **Condução** (tom, caminho, perguntas): documento "Demonstração (landing)" em `/admin/documentos`. Salvar como rascunho, testar em `/admin/demonstracao` e então ativar. Voltar a uma versão anterior é ativar a versão antiga, como no Core.
- **Jeito de pensar** (Core): é o mesmo Core da Ayla das famílias. Ajustar o Core muda as duas.
- **Fronteiras fixas** (no código, `REGRAS_FIXAS_DEMONSTRACAO`): não promete dias grátis, não diz que conhece a criança, não pede documentos e orienta CVV 188, SAMU 192 ou 190 em caso de risco.

## Dados pessoais

Nome, e-mail, telefone e conversa ficam em `demonstracoes_ayla` e `demonstracao_mensagens`. Só o servidor acessa essas tabelas (RLS sem políticas). O código e o token ficam guardados apenas como hash. O prazo de retenção e a exclusão ainda precisam ser decididos (PEND-259).
