# Pedido de brincadeira — baseline e gate

Data: 28/09/2026. Família da bancada sintética; Core, classificador, BP e
modelo reais. Banco somente leitura e nenhuma mensagem enviada. Reproduzir com
`scripts/bancada/brincadeira-pedido-ab.mjs` e Node 24 com
`--experimental-transform-types --use-system-ca` e env local do projeto.

## Baseline congelado antes da correção

| Pedido | Skills / BPs | Resposta A | Julgamento |
|---|---|---|---|
| Brincadeira para lidar com barulho no mercado, gestos | sensorial + comunicação / 2 | “Mercado dos dinossauros”; escolher alimento, acrescentar sons suaves, treinar pausa | É ensaio sensorial, não jogo compartilhado; reproduz queixa da prova real |
| Brincadeira para foco, começa e abandona | foco / 2 | “Bolo do dinossauro”, três etapas e observação | Executável, mas mais tarefa estruturada do que brincadeira |
| Brincadeira nova após restaurante de dinossauros | nenhuma / 0 | “Cozinha dos dinossauros”, mistura e serve | Repetição da mecânica anterior com novo nome |
| Como ajudar com barulho no mercado | sensorial / 2 | Horário vazio, observar e combinar saída | Correto para *manejo*; não deve ser forçado a virar jogo |

Produção, 28/09 09:45 BRT, SHA `151ff36f04e4192453a7a30a0a4b43e7cff152c7`:
pedido explícito de brincadeira para Manu → “mercadinho” com gestos e som →
tutorial do Lúdico. Metadado marcou `historia_whatsapp.origem=resposta_ao_tema`;
não havia pedido atual de história. A primeira bolha chegou ~14,6 s após o
início; duração total do turno ~26,6 s. O mecanismo de detecção leu histórico
familiar, mas o motivo exato da falsa origem ainda não é reconstituível pelos
eventos persistidos. Não inferir que o gerador recebeu uma BP de brincar:
classificação da prova real foi sensorial + comunicação.

## Aceite antes de publicar

1. Um pedido de brincadeira gera **três opções**, com mecânicas distintas,
   objetivo lúdico, começo, papéis reais e escolha da criança; cada uma
   funciona mesmo retirando o objetivo terapêutico. Participação por gesto
   vale, sem exigir fala ou olhar. Alternativas aparecem em bullets, não como
   passos numerados. Cada uma indica, em linguagem simples, uma capacidade
   efetivamente convidada pela ação; não promete ganho nem transforma jogo em
   exercício. O perfil e a idade calibram a complexidade, sem inferir atraso
   só pela idade.
2. Sensibilidade sensorial não vira exposição graduada automática. Há saída
   e ajuste quando a criança não quer continuar.
3. A atividade nova não reembala o jogo anterior; interesse é veículo, não
   o único enredo disponível.
4. Pedido de manejo continua recebendo manejo; pedido de história legítimo
   continua entregando história; pedido de brincadeira não dispara guia do
   Lúdico nem suprime botões de aprofundamento por história falsa.
5. BPs pertinentes continuam disponíveis; a resposta B muda uma decisão útil
   e não só a redação. Sem nova chamada LLM, sem latência relevante adicional.
6. A/B com mesmo Perfil e histórico, regressões, typecheck, build e prova
   interna no WhatsApp antes de qualquer ativação global.

## Candidata local — ainda não publicada

Uma instrução de comportamento limitada a pedidos explícitos de brincar foi
injetada no produtor, depois das BPs e sem modelo adicional. O detector de
história veta pedido atual explícito de brincadeira, mesmo diante de um aceite
ou pergunta anterior sobre história. O tutorial só segue quando a resposta
tem forma de história. Replay somente leitura: das quatro respostas de
produção marcadas como história, as três narrativas passam no verificador e
o “mercadinho” incorretamente marcado é recusado (3/4).

No A/B sintético, a primeira candidata ainda propôs sons suaves no mercado:
**reprovada e refinada**. Depois, três replays do caso de mercado não
introduziram som de propósito e passaram a trazer brincadeira compartilhada.
A preferência da usuária por três alternativas foi incorporada ao desenho:
os dois replays mais recentes geraram três bullets separados, com título e
participação por gesto. Uma amostra intermediária ainda reembalou uma busca em
três nomes, e outra colocou a primeira opção no preâmbulo; por isso o gate
agora exige mecânicas diferentes e três blocos visuais. O pedido-controle
“como ajudar no barulho” continuou recebendo manejo, não jogo.

Em 28/09 a usuária explicitou que prefere **três alternativas** e quer ver
o que cada uma contribui para aquela criança: foco, comunicação ou apenas
diversão e vínculo, quando corresponder à brincadeira. O primeiro replay com
esse enriquecimento trouxe três jogos no mercado, mas repetiu o recurso de
"erro de propósito" em mais de uma opção. Outro replay omitiu o benefício
da primeira opção. Ambos são falhas editoriais; o critério foi apertado e
precisa de novo replay, sem inferir aprovação desses exemplos.

A usuária também reprovou o nível de detalhe das três ideias: não dava para
saber o que o adulto fala nem como a filha participa. Gate acrescido: cada
brincadeira mostra cenário, fala pronta do adulto, resposta possível da criança
segundo seu modo de comunicação e reação seguinte do adulto. Para Manu, gesto
é resposta válida; não inventar uma fala obrigatória. Novo replay local do
mercado gerou três blocos com esses turnos explícitos e uma contribuição por
jogo, com 2 BPs injetadas e ~9,6 s de geração. Ainda há pontos editoriais a
avaliar (por exemplo movimento do carrinho no mercado); não é validação real.

Isto é evidência de direção, não prova de robustez geral nem do canal real.
O gerador ainda decide a redação; sem schema de três itens, o texto do prompt
sozinho não é garantia matemática de sempre haver três. Não declarar o
produto pronto até regressão, QA interna e auditoria de latência.
