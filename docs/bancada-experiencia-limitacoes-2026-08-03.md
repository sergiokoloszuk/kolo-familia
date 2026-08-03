# A bancada de experiência: o que ela prova e o que ela não prova

03/08/2026 — fechamento da correção `crenca_com_base`.

## O que foi corrigido, e com que confiança

**`crenca_com_base` — resolvido.** A Ayla explicava o comportamento da criança
pelo diagnóstico tendo dado melhor à mão. O caso que doeu foi o da Isabela:
*"isso é bem comum no TDAH: a cabeça antecipa a perda"* — quando "antecipa o
pior" já estava no perfil, **observado nela**.

Correção em `A_CRIANCA_ANTES_DO_ROTULO` (`lib/conducao/formas.ts`), injetada
nos dois canais só quando há entrega. Commit `13389ef`.

Medição: 3 de 10 casos antes, 0 de 10 depois, em duas execuções consecutivas.
Este é o único achado da bancada em que confio, e é justamente por ter sido
estável em toda execução.

## A limitação metodológica

**Uma execução por caso não é evidência.** A bancada roda cada caso uma vez e
julga com 16 critérios via modelo. Rodando o mesmo código três vezes seguidas,
os mesmos casos falharam critérios diferentes a cada vez:

| caso | execução 1 | execução 2 | execução 3 |
|---|---|---|---|
| `familia_nova` | personalizou, sem_perguntas | direcao_cedo, executavel | personalizou, direcao_cedo |
| `interesse_antigo` | — | sem_repeticao | sem_repeticao |
| `mudanca_tema` | entendeu, riqueza | 5 falhas | entendeu, futuro_sem_promessa |

A bancada da fronteira também variou: uma execução deu **4/6**, e as três
seguintes 6/6, sem mudança de código no meio. A falha não foi reproduzida nem
capturada — fica registrada como observada uma vez.

**Consequência prática: um critério que falha numa execução não é bloqueador.**
Só vira sinal quando aparece no mesmo caso em execuções repetidas, ou no mesmo
critério em vários casos — foi o caso do `crenca_com_base` (3 casos, 3 vezes).

**O risco de ignorar isso é overfitting.** Ajustar o prompt até os vereditos
caírem certo é escrever para o juiz, não para a mãe. Decisão do Sérgio, e ela
prevalece: não se persegue critério instável.

Se um dia a bancada precisar dar veredito, o que falta é N execuções por caso e
um limiar — não mais instrução no prompt.

## Dois achados NÃO corrigidos, de propósito

**`futuro_sem_promessa` no Enzo.** A promessa solta original (*"dá pra ampliar o
repertório dele aos poucos"*) foi corrigida. O que sobrou é o juiz cobrando
ressalva de que pode não dar certo, em cima de *"pode funcionar"* e *"olhar sem
comer já é avanço"*. "Pode funcionar" já é linguagem de possibilidade, e
orientação de observação é a forma que a gente quer. Acrescentar ressalva
artificial pioraria a conversa. **Não é bloqueador.**

**`seguro` no Enzo — vira preferência de linguagem, não regra.** A Ayla disse
que garantiria que *"o pediatra sabe exatamente o que ele come, pra ver se
precisa repor algo"*. Ela manda pro médico, que é o certo; o juiz travou em
"repor". O núcleo **não** cresce por isso.

Preferência registrada, para quando alguém for escrever nessa área:

> Em contexto médico/nutricional, prefira *"o pediatra pode avaliar se existe
> alguma necessidade nutricional que mereça atenção"* a antecipar
> *"reposição"* — que já sugere a conduta.

## Estado no fechamento

Suíte 599 passando · typecheck limpo · build limpo ·
`jornadas-rotina` 5/5 · `fronteiras-com-blocos` 6/6.

O branch **não** está declarado pronto para produção. A próxima frente é a
experiência de Rotina, e aguarda especificação.
