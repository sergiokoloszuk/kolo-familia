# Fronteira do diagnóstico — o que foi fechado e o que ficou

**Data:** 01/08/2026
**Estado:** construído e no branch `bia/ciclo-tecnico` — commits `0b542d7` (fronteira) e `9dafc17` (rede). **Não deployado.**
**Origem:** conversa real de produção (mãe da Thayla).

---

## O que aconteceu

Uma mãe perguntou "pelo que eu te falei, dá pra saber o que ela tem?". A Ayla
respondeu *"dá pra ter uma ideia bastante clara"*, *"características muito
consistentes com autismo"*, *"tudo que você me contou aponta com força pro
autismo"* e, sobre a suspeita de TDAH junto, *"isso não muda quase nada no que
ajuda a Thayla no dia a dia"*.

A regra que existia (`PISO`: *"você não dá diagnóstico"*) **foi obedecida** — a
Ayla disse que quem diagnostica é o médico e concluiu na frase seguinte. Ela
proíbe o ato formal, não a inferência. Detalhe da causa raiz em `0b542d7`.

## O que foi construído

| | onde |
|---|---|
| `FRONTEIRA_DIAGNOSTICO` no núcleo compartilhado | `lib/conducao/diretrizes.ts` |
| Detector da forma da conclusão (não do vocabulário) | `lib/conducao/deteccao-diagnostico.ts` |
| Regeneração + piso, WhatsApp e web | `lib/conducao/recuperacao-diagnostico.ts`, `lib/ayla/responder.ts`, `lib/ia/engine.ts` |
| Distinção confirmado × hipótese chegando à conversa | `lib/onboarding/diagnostico.ts` |
| Bancada adversarial (12 cenários × 2 canais) | `scripts/bancada/fronteira-diagnostico.mjs` |

**Medição final (56 turnos, modelo real, dois canais):** 2 vazaram só com o
prompt → 2 recuperados por regeneração, 0 no piso. Segurança 56/56, utilidade
56/56, personalização 56/56, zero burocráticas.

**Classe considerada FECHADA como regra de comportamento**, com a ressalva
probabilística abaixo.

---

## Riscos residuais — registrados, NÃO resolvidos

Nenhum destes deve ser atacado sem decisão explícita. Estão aqui para não serem
redescobertos do zero.

### 1. O detector é regex, não semântico
`deteccao-diagnostico.ts` mede formas conhecidas de conclusão. Cada forma nova
escapa primeiro do regex e só depois é acrescentada — foi o que aconteceu com
`encaixe` (*"o que você me contou vai além da fala…"*), que nenhum padrão pegava
e o juiz da bancada encontrou. **A rede só protege quando o detector dispara.**
A proteção de verdade continua sendo o prompt; isto é a rede embaixo.

### 2. O conjunto adversarial é pequeno e sintético
12 cenários que eu mesmo escrevi, 56 turnos, duas rodadas. Isso é uma amostra,
não um conjunto de avaliação. A taxa de vazamento com o prompt sozinho (~2-4%)
é uma estimativa sobre casos que eu antecipei — por construção, não cobre o que
não me ocorreu. Não houve loop-until-dry.

### 3. Casos reais de produção precisam virar teste
Coerente com a decisão de que o conjunto de avaliação nasce do uso real, não de
conversas sintéticas. Toda conversa real que atravessar a fronteira deve virar
(a) um caso negativo em `fronteira-diagnostico.test.ts` e (b) um turno na
bancada. Os eventos `ayla_fronteira_diagnostico_regenerou` e
`ayla_fronteira_diagnostico_piso` já registram trecho e códigos justamente para
alimentar isso — **falta o hábito e o lugar de olhar, não o dado.**

### 4. BIA precisa ser reavaliada COM a fronteira antes de ser ligada
A flag `BIA_PROMPT_ENABLED` está desligada e a BIA não estava em jogo no
incidente. Mas os chunks têm `diagnosticos_relacionados`, e material clínico
entrando no prompt muda o que o modelo tem à mão numa pergunta de diagnóstico.
As instruções do bloco já dizem que o Core prevalece — isso não foi medido.
**Antes de ligar: rodar a bancada com `BIA_PROMPT_ENABLED=1` e comparar.**

### 5. Relatório/link no WhatsApp só para ≤12 anos
`orchestrator.ts` monta os magic links do Lúdico e o do relatório apenas quando
`ehCrianca` (idade ≤ 12). A fronteira agora manda a Ayla oferecer *"eu organizo
um resumo pra você levar na consulta"* — e para adolescente ou adulto
acompanhado ela não tem o link para mandar. Promessa que o canal não cumpre.

### 6. `validateAntiAlarme` pode conflitar com orientar busca profissional
Ele barra "grave", "sério", "urgente", "preocupante". A fronteira agora exige
reconhecer que uma preocupação **merece avaliação** — e perda de habilidade,
por exemplo, pede clareza. Não observei conflito nos 56 turnos, mas o veto é
por palavra e a exigência é por conteúdo. Vale medir antes de mexer.

### 7. Re-download de imagem na regeneração
Quando a mensagem tinha foto, a segunda passada baixa a imagem de novo
(`baixarImagemBase64`). Ineficiência técnica, não bug — a taxa de disparo é
baixa. Se a regeneração ficar mais frequente, cachear.

### 8. O juiz de personalização é instável
O mesmo cenário (`opiniao_da_escola`) pontuou 50% e depois 100% entre rodadas,
sem mudança de código. Serve para inspecionar um caso; **não serve como métrica
de acompanhamento**, e não deve virar número de dashboard.

---

## Fora do escopo desta rodada (decisão explícita)

Direitos/jurídico, recém-nascidos, urgências médicas, medicação, saúde e
sintomas, fontes externas e escopo do produto. Todas continuam abertas — ver o
mapa consolidado de classes de risco.
