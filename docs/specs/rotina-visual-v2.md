# SPEC TÉCNICA · ROTINA VISUAL V2

**Status:** contrato técnico atual, derivado do Documento de Produto V2.
**Autoridade:** em conflito de comportamento, o **Documento de Produto V2**
prevalece — [`docs/documentos-ayla/cartoes-visuais-v2.md`](../documentos-ayla/cartoes-visuais-v2.md).
**Histórico:** [`docs/specs/rotina-visual.md`](rotina-visual.md) é preservada
como genealogia das decisões até 08/08/2026. Não apagar D-R1 a D-R5.

---

## 1. Fonte de verdade

- Canônico de produto: `docs/documentos-ayla/cartoes-visuais-v2.md`.
- Contrato técnico: este arquivo.
- `docs/specs/rotina-visual.md`: **superada como fonte de requisitos de
  produto**, preservada como histórico técnico.

## 2. Não construir segundo sistema

Reutilizar obrigatoriamente a infraestrutura existente comprovadamente adequada:
`rotina-guiada` · `prontidao-rotina` · serviço de Rotina · gerador existente ·
persistência existente · cartões/imagens · editor existente · assinatura/link
existente · impressão existente.

**Antes de substituir qualquer componente, provar por que não atende à V2.**

## 3. Máquina de estado conversacional

A Rotina Visual precisa ter propriedade explícita da conversa durante sua
construção. Estados conceituais mínimos:

```
identificando_crianca
entendendo_situacao
aguardando_ponto_critico        (quando necessário)
proposta_de_etapas
aguardando_confirmacao          (somente quando Ayla alterou/inferiu)
aguardando_tema
autorizada_para_gerar
gerando
pronta
erro
```

Não é obrigatório criar tabela nova se metadata/estado existente puder
representar isso de forma segura. **Mas o estado precisa sobreviver entre
turnos.**

## 4. Metadata

Preservar simultaneamente metadata funcional e metadata de entrega. A correção
de composição de metadata (`94e2e6d`) é **dependência do rollout**.

Provar coexistência de `pedido + entrega`, `proposta + entrega`,
`plano_id + entrega` e demais âncoras necessárias.

**Nenhum registro de envio pode apagar estado conversacional.**

## 5. Decisão das etapas

Implementar uma função/decisão com responsabilidade clara:

```
situação + fatos atuais + Perfil pertinente + histórico pertinente
    → proposta funcional de etapas
```

Ela deve determinar: objetivo · existência ou não de ponto crítico · início ·
etapas · fechamento · necessidade de pergunta · necessidade de confirmação.

**Não usar memória histórica como acontecimento atual.**

## 6. Pergunta de alto valor

Se faltar informação, perguntar somente quando a resposta puder mudar
materialmente: início da sequência · etapas · fechamento · representação/
compreensão · segurança.

Preferir **uma** pergunta. **Não exigir ponto crítico** para simples
organização/previsibilidade.

## 7. Família fornece sequência

Quando a família fornecer sequência clara ≤ 10: preservar fatos · normalizar
redação quando necessário · **não pedir seleção de números** · não reconfirmar se
a Ayla não alterou conteúdo materialmente · seguir para consideração + tema no
mesmo turno.

## 8. Ayla infere sequência

Se a Ayla acrescentar/remover/agrupar/reordenar conteúdo relevante: persistir
proposta · apresentar · aguardar confirmação/correção · resposta curta compatível
retoma a proposta.

## 9. Tema

Gerar **duas** sugestões (contexto atual; interesse atual conhecido, quando
houver). Permitir: `tema 1` · `tema 2` · `outro` · `sem tema`.

Tema histórico só pode ser oferecido quando adequadamente identificado como
histórico, **nunca presumido como atual**.

## 10. Comandos de execução

Reconhecer semanticamente `pode gerar` · `gera` · `faz` · `quero` · `pode fazer`
e equivalentes, considerando o estado pendente.

Quando suficiente: **comando → geração real.** Não passar pelo modelo
conversacional comum para produzir falsa incapacidade.

## 11. Exclusividade enquanto a ação está pendente

Uma resposta pertencente à Rotina pendente não pode simultaneamente: abrir Plano
· ser interpretada como nova conversa · criar segunda rotina indevida · perder
criança · perder etapas · perder tema.

Preservar o mecanismo existente de dono da rajada (`aguardarTurnoDaMae`); **não
criar concorrência paralela sem prova de necessidade** — ver PEND-170.

## 12. Artefato

A geração deve persistir: `family_id` · `membro_id` · título · etapas · ordem ·
tema quando existente · estado · timestamps. **Máximo 10 cards.**

## 13. Estados reais

`aguardando` não é pronto. `gerando` não é pronto. `erro` não é pronto.

Somente estado comprovado autoriza a linguagem correspondente. Falha precisa
permanecer recuperável/diagnosticável.

## 14. Link

O link precisa: apontar para a rotina específica · respeitar isolamento ·
autenticar corretamente · abrir o artefato persistido · sobreviver a reabertura ·
exibir estado verdadeiro · **usar imagens assinadas quando o storage for
privado**.

Nunca usar URL pública bruta como prova quando o bucket for privado — ver
`docs/bancada/rotina-visual-nivel2-2026-09-07.md`, §5.

## 15. Página

Homologar: etapas corretas · imagens corretas · concluída visualmente distinta ·
próxima etapa evidente · edição · reordenação · impressão em todos os modos
suportados · estado `gerando` · estado `erro` · feedback leve quando
implementado.

## 16. Regressões obrigatórias

| Caso | O que prende |
|---|---|
| **Atibaia 08/09** | sequência completa → Ayla organiza → "Ok pode gerar" → **não** pode responder incapacidade; avança para tema ou geração conforme o estado |
| **Manu 07/09** | clarificação de criança **preserva o pedido** |
| **Barco** | memória histórica de passeio de barco não entra numa rotina atual sem a família trazê-la |
| **Mario** | pedido de imagens → continuidade em "Sim"/"Pode ser" → **geração única** |
| **Anti-Matheo** | "Ok" após entrega de Plano **não cria novo Plano** |
| **Controles** | `sim`/`pode`/`ok`/`isso` sem ação pendente **não abrem** Rotina |

## 17. Bancada conversacional

Testar: sequência completa · sequência incompleta · ponto crítico conhecido ·
ponto crítico desconhecido · evento único · dia completo · mais de 10 etapas ·
uma criança · duas crianças · correção · tema contextual · interesse conhecido ·
interesse histórico · sem tema · aceite curto · comando explícito · mudança
depois da proposta · falha de geração.

**Medir turnos até a geração.** Meta: quando a família fornece criança/contexto +
≤ 10 etapas, **no máximo 1 turno adicional** para tema, salvo inconsistência
real. Se o tema já vier no pedido: **zero pergunta adicional**.

## 18. Teste ponta a ponta

Não considerar homologado por teste unitário. Provar: WhatsApp real QA → decisão
→ persistência → geração → imagens → link → página → interação.

Provar **exatamente uma rotina** e **exatamente uma geração**. Provar ausência de
Plano indevido. Provar isolamento entre famílias/crianças. Provar erro sem falso
"pronto".

## 19. Rollout — ordem obrigatória

1. salvar V2 no git;
2. marcar spec antiga como histórica;
3. auditar código atual × V2;
4. incorporar correção de metadata;
5. implementar somente gaps comprovados;
6. testes completos;
7. bancada;
8. QA ponta a ponta;
9. ativar documento V2 necessário à Ayla;
10. merge em `main`;
11. deploy;
12. health check;
13. provar SHA servido em produção;
14. teste comportamental controlado em produção.

**Parar imediatamente** se houver risco de enviar mensagem para família real
durante QA. **Não tocar** no artefato real preservado da Manu (`ec61feee`,
PEND-171) usado como evidência.

## 20. Critério de conclusão

Só dar baixa quando houver evidência conjunta de: documento canônico + código
aderente + metadata preservada + testes + bancada + QA E2E + merge + deploy +
health + SHA de produção + comportamento real correto.
