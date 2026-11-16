# SPEC — Continuidade da geração de imagens do Lúdico

**Estado:** IMPLEMENTADA, com validação humana pendente para os cartões da
Rotina Visual. Esta especificação vale para **avatar, galeria/desenhos,
histórias e cartões da rotina**. Pendência relacionada: **PEND-004**.

## Contrato operacional

Toda imagem do Lúdico passa por `src/lib/imagem/generate.ts`. Nenhuma feature
escolhe modelo, chama `/v1/images/generations` ou `/v1/images/edits`, calcula
custo ou decide failover por conta própria.

A cadeia padrão é:

```
gpt-image-2.5-sunburst → gpt-image-2.5-flare → gpt-image-2
```

O próximo modelo só é tentado quando o anterior foi removido/indisponibilizado,
respondeu `429` ou `5xx`. Bloqueio de moderação e erro de contrato não fazem
failover, para que continuidade nunca vire contorno de segurança.

## Portões de entrega e incidente

1. **Inventário e dono:** procurar todos os consumidores e todas as chamadas
   diretas ao provider. O gerador central é o dono; uma chamada paralela bloqueia
   a entrega.
2. **Capacidade real:** confirmar em documentação oficial a disponibilidade,
   data de desligamento e compatibilidade de `generations` e `edits` de cada
   modelo. Modelo anunciado não conta como modelo provado.
3. **Contrato local:** testar ordem, deduplicação, rejeição de modelo desligado,
   reconstrução do `FormData` por tentativa, custo, Storage e proibição de
   failover em moderação.
4. **Falha injetada:** provar remoção de modelo, `429` e `5xx`, além do caso em
   que todos falham. O resultado nunca pode ser marcado como pronto sem bytes
   persistidos e relidos.
5. **Canário sintético:** antes do merge, executar uma geração e uma edição
   reais com imagem do repositório, sem dado de família. Conferir status, bytes,
   formato e uso; apagar artefato temporário.
6. **Regressão dos quatro consumidores:** avatar, galeria/desenhos, histórias e
   rotina precisam passar pelo mesmo gateway. Rodar testes afetados, regressão,
   typecheck, lint e build.
7. **Observabilidade:** registrar feature, endpoint, status, código, request ID,
   modelo usado e modelos tentados. Não registrar prompt, imagem nem dado pessoal.
   O estado do artefato precisa distinguir `gerando`, `pronto` e `erro`.
8. **Produção:** provar SHA de `main`, ambiente e saúde; depois executar o
   canário sintético no deployment publicado. Build verde não substitui essa
   prova.
9. **Corte de versões antigas:** em correção crítica de provider, definir o
   **Skew Protection Threshold** no primeiro deployment corrigido. Validar que
   uma requisição apontada ao deployment problemático recebe o SHA atual. Sem
   esse corte, uma página aberta antes do deploy continua executando o servidor
   antigo por desenho da Vercel.
10. **Prova humana:** usar conta descartável e conferir geração, persistência,
    reabertura e recuperação de erro. Conta real pode fornecer evidência
    somente leitura, mas nunca ser usada pelo agente para disparar geração.

## Resposta quando um modelo for desligado

O failover acontece dentro da mesma operação; a família não precisa conhecer
o modelo nem reenviar o pedido. Se toda a cadeia falhar, o artefato fica em
`erro`, o pedido original permanece salvo e a interface oferece retry. Uma
correção emergencial só está em produção depois do portão 9, porque clientes
abertos antes do deploy também precisam sair do código defeituoso.

## Evidência inaugural — 16/11/2026

O incidente da rotina da Manu provou o risco de versão antiga. Duas tentativas
de 20h15–20h16 foram atendidas pelo deployment `b357d7f`, que ainda chamava
`gpt-image-1`, embora `0ae4a8d` e `8a7110d` já estivessem em produção. O
threshold foi definido em `0ae4a8d`; em seguida, uma chamada com o identificador
do deployment antigo retornou o health do SHA atual `8a7110d`, em `main`,
ambiente `production`, com banco saudável.
