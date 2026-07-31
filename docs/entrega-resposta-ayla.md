# Como entregar uma resposta da Ayla

Guia curto da camada implementada pelo [ADR 0001](adr/0001-pipeline-resposta-whatsapp.md).
A regra que resume tudo: **só a Publicação fala com o WhatsApp.**

## Produzir uma `RespostaFinal`

Nunca monte uma à mão. Use a Montagem — é ela que valida, checa coerência entre
texto e anexo e devolve `null` quando não há nada publicável.

```ts
const entrega = montarEntrega({
  conversationId: familyId,
  sourceMessageId: execucao.sourceMessageId,
  executionId: execucao.executionId,
  phoneE164: telefone,
  textoDoModelo,          // texto cru; a Validação roda dentro
  ferramentas,            // o que plano/ponte/rotina devolveram
  responseType: "resposta",
});
if (!entrega.resposta) return;   // nada a dizer: NÃO invente mensagem

await publicar(supabase, entrega.resposta, { posse: execucao });
```

Passar `posse` é o que ativa a reconferência antes do envio. Só omita em
publicação operacional que não disputa turno (o balão de espera).

## Ferramenta devolvendo resultado

Ferramenta não publica. Devolve:

```ts
const r: ResultadoFerramenta = {
  tipo: "plano",
  textoSugerido: "Montei um plano...",   // ainda passa pela Validação
  anexos: [{ tipo: "documento", url, nomeArquivo: "plano.pdf" }],
};
// deu errado? erroInterno — que é objeto tipado, não string, justamente para
// não conseguir grudar no texto por acidente.
const falhou: ResultadoFerramenta = { tipo: "plano", erroInterno: erroInterno("timeout") };
```

Para fluxos sem turno (rotina guiada, proativas), use
`publicarAnexoDeFerramenta` / `publicarOperacional` — passam por `publicar()`.

## Automação criando uma `IntencaoDeMensagem`

```ts
const decisao = await avaliarAutomacao(supabase, {
  familyId,
  tipo: "reengajamento",
  perdeSentidoComInteracao: true,  // "faz 3 dias que não falamos" só vale no silêncio
});
if (decisao.acao !== "publicar") return;   // adiada ou descartada, já registrado
```

Adiar é a preferência. Descartar é para o que só fazia sentido no silêncio.

## `notificarAdmin()` — quando usar

Comunicação **operacional interna**: alerta técnico, healthcheck, aviso de
cadastro, ação manual do admin. Vai ao WhatsApp da Karina.

| | `publicar()` | `notificarAdmin()` |
| --- | --- | --- |
| destinatário | a família | a Karina |
| tem conversa | sim | não |
| valida saída | sim | não (texto nosso) |
| disputa turno | sim | não |
| entra no histórico | sim | não |

Ferramenta e modelo **não** podem chamar `notificarAdmin()`.

## `observe` e `enforce`

`AYLA_VALIDACAO_MODO=enforce` liga o bloqueio. Ausente ou qualquer outro valor
= `observe`, que é o padrão e o estado inicial de implantação: o detector
registra o que barraria, sem barrar.

As camadas estrutural (log, tag, JSON, rótulo de papel) e de origem (texto de
ferramenta) **bloqueiam sempre**, em qualquer modo — não há leitura em que um
cabeçalho de log seja resposta legítima.

Antes de virar `enforce`, olhe `ayla_entrega_ajustada` e meça quantas respostas
boas seriam barradas.

## Investigar uma resposta DESCARTADA

Procure `ayla_publicacao_descartada`. O `motivo` diz o que aconteceu:

| motivo | o que foi |
| --- | --- |
| `inbound_mais_recente` | a mãe escreveu de novo durante a geração; quem chegou depois respondeu |
| `ja_publicado` | outra execução já respondeu a esta inbound |
| `execucao_expirada` | estourou o teto de 240 s |
| `posse_perdida` | perdeu a corrida do turno |
| `sem_conteudo` | não havia texto nem anexo publicável |

**Descarte não vira fallback.** Fallback é para resposta barrada pela Validação;
descarte é corrida perdida, e mandar "tô aqui com você" nesse caso seria ruído
gerado pela nossa infraestrutura.

## Publicação parcial

`status: "parcial"` significa que parte das bolhas saiu e o resto falhou. **A
Z-API não tem transação** — não há como desfazer o que já chegou. O que fazemos
é registrar `partesConfirmadas`, para que um retry passe
`partesJaConfirmadas` e continue de onde parou em vez de repetir.

Não afirme atomicidade em lugar nenhum: ela não existe neste provedor.
