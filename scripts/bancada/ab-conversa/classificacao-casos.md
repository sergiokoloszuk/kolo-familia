# O que comparar entre modelos — e o que não

**Regra:** Claude × GPT só compete onde **trocar o modelo pode mudar o resultado**.
Testar o determinístico nos dois braços não mede nada e gasta o dobro de chamadas.

Os 12 casos de artefato que o Sérgio listou se separam assim:

| # | caso | camada | por quê |
|---|---|---|---|
| 1 | Plano para escrita do nome | **MISTO** | a prontidão é do Claude leve; a **condução** é do modelo |
| 2 | Organizar a tarde da Manu | **MISTO** | idem — e o 2º turno ("almoço, tarefa…") testa se entende que já basta |
| 3 | Rotina visual pro dentista | **MODELO** | distinguir sequência × agenda semanal é leitura de pedido |
| 4 | Oferta de história → "sim, vamos montar" | **MODELO** | referente do "sim" |
| 5 | Plano pronto → **uma** entrega | **ORQUESTRADOR** | dedup por tabela `planos`; o modelo não controla |
| 6 | Rotina pronta → membro/sequência corretos | **ORQUESTRADOR** | `resolverMembroAlvo` + gerador |
| 7 | Validação falha → não dizer "pronto" | **ORQUESTRADOR** | quem publica é o sistema, não o texto |
| 8 | Troca de criança antes de gerar | **MISTO** | resolução do membro é código; **não contaminar** é do modelo |
| 9 | Tema/interesse correto | **MODELO** | escolha editorial |
| 10 | Link específico correto | **ORQUESTRADOR** | URL montada em código |
| 11 | Sem promessa falsa | **MISTO** | a nota do turno proíbe; **obedecer** é do modelo |
| 12 | Sem comunicação duplicada | **ORQUESTRADOR** | uma bolha por entrega, controlada pelo envio |

## Consequência prática

**Vão para a bancada Claude × GPT (7):** 1, 2, 3, 4, 8, 9, 11.
**Ficam como regressão normal, um braço só (5):** 5, 6, 7, 10, 12.

Isso corta **~42% das chamadas de artefato** sem perder cobertura — os cinco
determinísticos continuam testados, só que uma vez, como sempre foram.

## O que medir nos 7, já que a decisão de gerar não é do modelo

Não adianta perguntar "gerou o artefato certo?" — quem decidiu foi o Claude leve
nos dois braços. O que muda com o modelo é o **texto ao redor da entrega**:

- entendeu o pedido sem virar entrevista;
- ajudou **enquanto** o artefato era processado, em vez de só anunciar;
- manteve o referente ("sim" → aquilo que foi oferecido);
- **não anunciou antes de existir** (o incidente de 03/08: anunciou o PDF e colou
  o link do Relatório);
- explicou de forma natural o que foi criado, e qual o próximo passo;
- não mandou a mãe procurar no app algo que já tinha sido entregue;
- não inventou capacidade que o produto não tem;
- na troca de criança: nenhum dado do primeiro filho vazou para o segundo.

## A distinção que precisa ir literal no relatório

> Esta bancada compara a qualidade de **condução e comunicação** de Claude e GPT.
> A decisão operacional de prontidão para Plano e Rotina permaneceu no **Claude
> leve nos dois braços**. Portanto, este teste **não responde** se o GPT decide
> melhor quando gerar, perguntar ou esperar.

## Nota sobre as jornadas multiturno

As 4 jornadas são **100% MODELO** — o orquestrador não participa da continuidade
entre turnos, ele só roteia cada turno isoladamente. São o teste mais limpo da
bancada, e provavelmente o mais informativo: a bancada de 05/08 mediu só turno
único, e continuidade foi justamente onde o Claude falhou 0/3 (caso
`17_referente_anterior`).

A jornada deve ser pontuada **como unidade**, não só resposta a resposta:
progrediu ou girou em círculos? repetiu explicação? fez a mãe responder o que já
tinha dito? ficou mais útil a cada turno? chegou a uma ação concreta?
