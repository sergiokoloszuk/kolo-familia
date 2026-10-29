# Ayla — latência percebida no WhatsApp

**Data da investigação:** 26–27/10/2026

**Base de código:** `25e8891daf1e0d5bd881512e6f128742fdcd0184` (commit então publicado)

**Pendência:** PEND-038

**Escopo:** conversa reativa da Ayla; sem deploy e sem teste com família real

## Resultado

A demora é estrutural e ocorre antes do envio. A Z-API não é o gargalo. O turno
de texto espera uma janela deliberada contra mensagens fragmentadas e, dentro
dela e depois dela, encadeia leituras de banco, um decisor por modelo e o modelo
que escreve a resposta.

Na janela móvel de 72 horas encerrada em 26/10/2026:

| Canal/entrada | n | P50 até aceitação | P95 | Máximo |
|---|---:|---:|---:|---:|
| WhatsApp · texto tratado | 22 | 13,453 s | 15,733 s | 17,119 s |
| WhatsApp · áudio tratado | 4 | 18,906 s | 24,323 s | 24,323 s |

O recorte comparável de 08–11/10 tinha P50 13,189 s e P95 21,462 s para texto.
Não há sinal de regressão recente na mediana; há um caminho estruturalmente
lento.

## De onde vem o tempo

No texto comum, as medianas observadas por etapa foram:

| Etapa | P50 |
|---|---:|
| Preparação/debounce | 3,255 s |
| Pré-decisão | 1,619 s |
| Decisor | 2,380 s |
| Geração da resposta | 3,910 s |
| Envio | 1,011 s |

Dentro da geração, o modelo principal teve P50 2,617 s e a montagem de contexto
1,215 s. A aceitação pela Z-API teve P50 368 ms. Os percentis de etapas não
devem ser somados como se pertencessem ao mesmo turno, mas a ordem e a grandeza
identificam o gargalo: trabalho serial no servidor, não transporte do provedor.

O áudio acrescenta transcrição/pré-processamento antes desse mesmo caminho:
P50 2,538 s e P95 4,780 s no recorte.

## Restrição que não deve ser removida às cegas

`JANELA_SILENCIO_MS=10000` é a proteção contra responder ao primeiro balão
quando a família ainda está completando o pensamento. A preparação começa após
3 s e a computação ocupa parte da janela, mas a publicação só é confirmada aos
10 s. Reduzir esse número isoladamente reabre a fragmentação e pode nem reduzir
a mediana, porque decisão + geração já ultrapassam o tempo sobreposto.

## Mudança local escolhida

A correção não muda janela, modelos, prompts, portões, fallback ou texto. Ela
achata somente dependências de leitura que eram aguardadas em fila:

1. segurança aberta e retomada de clarificação;
2. desafios do onboarding e decisão de mostrar o menu;
3. escolha do menu, histórico/estado, últimas falas e catálogo de skills.

Os portões continuam avaliados na ordem anterior. Nenhuma escrita foi colocada
em `Promise.all`. O histórico permanece uma promessa local ao turno e com
filtro pela família.

O ganho exato não é afirmado sem publicação: a hipótese verificável é reduzir
`pre_decisao` aproximando a onda da operação mais lenta, em vez da soma das
operações. A PEND-038 só pode baixar depois de comparar P50/P95 pós-publicação.

## Validação local

- testes diretamente afetados: **120/120 passaram**;
- typecheck após `next typegen`: **passou**;
- suíte completa `src/lib/ayla`: **2.126/2.128 passaram**; as duas falhas são
  anteriores e sensíveis à data em `desafiosAtuais`, arquivo não alterado;
- build: **bloqueado pelo ambiente** no download de Google Fonts. Com a CA do
  sistema, o fetch deixou de falhar por certificado, mas o loader recebeu uma
  resposta incompatível do proxy e falhou em `next/font`.

Não houve disparo de WhatsApp, uso de família real, deploy ou alteração de
dados.

## Próxima prova

Após revisão e autorização de publicação:

1. publicar a alteração isolada;
2. aguardar amostra mínima comparável de texto tratado;
3. comparar `pre_decisao` e tempo até primeira aceitação contra este baseline;
4. reconstruir qualquer teste humano pelo `PROTOCOLO-TESTE-REAL.md`;
5. manter a mudança somente se a latência cair sem aumento de respostas
   fragmentadas, canceladas ou duplicadas.

## Veredito

**PASSOU COM RESSALVAS.** A alteração local preserva as garantias verificadas e
passa a regressão focada, mas ainda não tem prova de ganho em produção nem build
completo neste ambiente. A PEND-038 permanece aberta.
