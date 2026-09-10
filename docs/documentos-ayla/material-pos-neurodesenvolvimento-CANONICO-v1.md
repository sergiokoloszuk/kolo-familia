# Base da Pós em Neurodesenvolvimento — CANÔNICA v1

| | |
|---|---|
| **Versão** | v1 |
| **Data** | 2026-09-10 |
| **Status** | **CANÔNICO** — fonte oficial da base da pós |
| **Origem** | material da Karina (pós-graduação em neurodesenvolvimento) |
| **Arquivos comparados** | 5 caminhos · **2 documentos distintos** (ver §1) |
| **Escopo** | fonte de registro. **Nada aqui está conectado ao prompt, ao decisor de lacuna ou a `bia_chunks`.** |

> ⚠️ **A CANÔNICA É UM CORPUS DE DOIS ARQUIVOS, NÃO UM TERCEIRO ARQUIVO COM O
> TEXTO COLADO.** Concatenar criaria uma terceira cópia do mesmo conteúdo, que
> divergiria dos originais na primeira correção — o defeito que este repositório
> já pagou caro em `transicoes` ("um conceito, um dono"). Este documento é o
> **dono da decisão**; os dois arquivos abaixo são os donos do **conteúdo**, e
> permanecem byte a byte como foram entregues.

**O CORPUS CANÔNICO:**

1. [`material-pos-v1-ORIGINAL.md`](material-pos-v1-ORIGINAL.md) — 20.695 bytes ·
   *"Manual de Diretrizes Clínicas e Base de Conhecimento para a IA Ayla"* ·
   recebido de Karina em 2026-08-19 como `kolo-familia-ia-library(2).md`.
   Referido aqui como **A**.
2. [`material-pos-compendio-v1-ORIGINAL.md`](material-pos-compendio-v1-ORIGINAL.md)
   — 26.909 bytes · *"Compêndio de Neurodesenvolvimento: Guia Mestre de
   Pós-Graduação em TEA"* · versionado em 2026-09-10 a partir de
   `~/Downloads/resumo-geral-pos-neurodesenvolvimento.md`, **md5 conferido**
   (`e433ce04…`). Referido aqui como **B**.

---

## 1. As "cinco variantes" eram duas

O mapa de encaixe registrava *"quatro variantes em `~/Downloads` ainda não
comparadas"*. **A contagem era de nomes de arquivo, não de conteúdo.** Medido:

| caminho | bytes | md5 |
|---|---|---|
| `~/Downloads/resumo-geral-pos-neurodesenvolvimento.md` | 26.909 | `e433ce04…` |
| `~/Downloads/resumo-geral-pos-neurodesenvolvimento (1).md` | 26.909 | `e433ce04…` |
| `~/Downloads/resumo-geral-pos-neurodesenvolvimento (2).md` | 26.909 | `e433ce04…` |
| `~/Downloads/resumo-geral-pos-neurodesenvolvimento (2) (1).md` | 26.909 | `e433ce04…` |
| `docs/documentos-ayla/material-pos-v1-ORIGINAL.md` | 20.695 | `040832b2…` |

Os quatro de `~/Downloads` são **o mesmo arquivo**, baixado quatro vezes
(28/08, 02/09 ×2, 05/09). Restam **A** e **B**.

⚠️ **E A e B não são variantes um do outro.** Título, estrutura, propósito e
vocabulário são diferentes; nenhum é derivado do outro. São **duas obras
complementares**, e é por isso que a canônica não pode ser "a maior".

---

## 2. A comparação, seção a seção

| | **A** — Manual para a IA | **B** — Compêndio da pós |
|---|---|---|
| Propósito | ensinar a Ayla a **raciocinar e conduzir** | consolidar **o que a ciência diz**, com fonte |
| Estrutura | 10 seções | 3 partes (7 temas · 5 faixas etárias · referências) |
| Voz | dirigida à IA ("a Ayla deve…") | acadêmica, dirigida ao profissional |
| Rastreabilidade | **nenhuma citação numerada** | **citação numerada em quase toda frase** + Parte 3 de grounding |

### Só em A (não existe em B)

- **§1 · Filosofia de raciocínio** — 5 princípios ("o comportamento é
  comunicação", "a fala é o telhado", custo cognitivo, autonomia estruturada).
- **§3 · A escada pré-verbal A→D** com o que investigar em cada degrau — a base
  do `ESCADA_COMUNICACAO` do Gate B.
- **§7 · Matriz de decisão SE… ENTÃO** — 7 regras. O mapa de encaixe chama esta
  seção de *"o coração do encaixe"*, e duas dela já viraram código
  (`ORDEM_DA_POS` em `lacuna-decisiva.ts`).
- **§8 · Limites éticos** (4 recusas explícitas).
- **§9 · Referências culturais para as famílias** — "Mãos Quietas", Temple
  Grandin, Atypical, Farol das Orcas.
- **§10 · 20 princípios de ouro.**
- Série histórica de incidência (1975→2004 + "1 em 31" do CDC).

### Só em B (não existe em A)

- **Diretriz de segurança clínica transversal** — excluir causa orgânica antes
  de plano comportamental: apneia/ronco, disfagia/engasgo, constipação/encoprese,
  **dor silenciosa em crise súbita** (otite, dente, ITU).
- **Tema 2 · Perfil Funcional da Comunicação (Fernandes)** — atos por minuto,
  meios verbal/vocal/gestual, funções interativas × autocentradas. Métrica
  funcional que A não tem.
- **Tema 3 · Apraxia de Fala na Infância (AFI/CAS)** — tríade diferencial
  (inconsistência, distorção de vogais, prosódia).
- **Tema 4 · Limiares de Dunn** — hipersensibilidade × baixo registro × busca
  sensorial, com exemplos de cotidiano.
- **Tema 5 · Alimentação e desfralde** — seletividade por defensividade
  tátil-oral; atraso médio de 1,6 ano no controle urinário; postura
  proprioceptiva; exclusão obrigatória de constipação.
- **Tema 6 · Sociometria escolar** — "isolado negligenciado" × "isolado
  controverso"; mediação ativa de pares; mídia como ensaio de Teoria da Mente.
- **Tema 7 · Vida adulta** — fenótipo ampliado, *masking*, barreiras laborais.
- **Parte 2 · Cronograma por 5 faixas etárias** — marcos por mês/idade, foco de
  avaliação e instrumentos. **É o único material com granularidade etária**, e é
  exatamente o que `bia_chunks.faixa_etaria_min_meses/max_meses` espera.
- **Parte 3 · Grounding** — 7 blocos de fontes reais (Fernandes, Lopes-Herrera,
  Ayres/Dunn, Joseph & Tager-Flusberg, FGV/Basto & Cepellos, CARS-BR, M-CHAT).

### Sobreposição entre A e B

Só **§2 de A × Tema 1 de B** (DSM-5, CID-11, níveis de suporte, etiologia). B é
mais preciso e citado; A traz a nota neurofuncional de que os níveis migram com
neuroplasticidade, que B não tem.

---

## 3. Duplicação com o Core v11 — medida, não suposta

Conferido em 2026-09-10 contra o Core **ativo em produção** (`ayla_documentos`,
chave `core`, status `ativo`, v11, 27.994 chars):

| conteúdo | já no Core v11? |
|---|---|
| recusa de laudo/diagnóstico · medicamento | **sim** |
| ronco/apneia · engasgo/disfagia · constipação | **sim — e na voz da Ayla** |
| tríade da apraxia de fala | **sim** |
| atenção compartilhada · contato visual não exigido | **sim** |
| dieta restritiva · protocolo sensorial clínico (§8 de A) | não |
| "comportamento é comunicação" · "a fala é o telhado" · hiperfoco | não |
| neuroplasticidade/janela · seguir a liderança · Teoria da Mente · coerência central | não |
| limiares de Dunn · instrumentos (M-CHAT, CARS, ADI-R) · marcos por idade | não |

⚠️ **O CORE v11 JÁ FOI ALIMENTADO POR B.** A diretriz transversal e a apraxia
aparecem no Core reescritas na voz da Ayla — e B foi baixado em 28/08, o
candidato do Core v11 é de 05/09. Isto **não** invalida B como fonte: significa
que parte dela já foi promovida a piso, e que a re-ingestão precisa saber disso
para não duplicar no prompt o que já está no Core.

---

## 4. O que preservar como raciocínio, e o que é prosa

**PRESERVAR — muda conduta:** os 5 princípios e a escada de A · a matriz SE…
ENTÃO de A · a diretriz de causa orgânica de B · limiares de Dunn · tríade da
apraxia · PFC (atos por minuto, meios, funções) · seletividade por defensividade
tátil-oral · desfralde com exclusão de constipação · sociometria e mediação de
pares · hiperfoco como ponte · efeito espelho na crise · marcos por faixa etária
de B.

**NÃO PROMOVER A CONDUTA — prosa acadêmica ou fora do escopo da Ayla:**

- **Instrumentos de aplicação profissional** (M-CHAT-R, CARS-BR, ADI-R, CSBS DP,
  Griffiths, Bateria MAC, KSPT, VMPAC, Vineland, WHODAS, AQ-10, BAPQ). Podem
  informar **quando sugerir avaliação**; nunca virar aplicação pela Ayla —
  colidiria com o §8 de A e com a fronteira clínica de `diretrizes.ts`.
- **Protocolos de intervenção clínica** (Integração Sensorial de Ayres em sala
  equipada, extinção de fuga/DRA do ABA). §8 de A proíbe explicitamente.
- **Etiologia, genética, epidemiologia, marcadores acústicos (F0), história do
  DSM-IV→DSM-5.** Contextualizam; não mudam o que a família faz amanhã.
- **Série histórica de incidência de A** — sem fonte declarada e datada; usar só
  o dado atual do CDC, e com fonte.
- **Parte 3 de B (referências)** — vale como **procedência dos chunks**, não
  como texto para o prompt.
- **§9 de A (livros e filmes)** — útil para a família, mas é conteúdo de produto,
  não raciocínio clínico.

---

## 5. Riscos declarados

1. **Nenhuma perda de conteúdo**: os dois originais entram no git íntegros, com
   md5 conferido. Nada foi resumido, cortado ou reescrito para caber.
2. **B não tem regra de decisão** e **A não tem faixa etária nem fonte**. Uma
   ingestão que use só um dos dois nasce torta — foi o que aconteceu na bancada
   de 05/09 (`bancada/pos-neurodesenvolvimento`), que mediu **só B**, produziu
   14 chunks temáticos gigantes com `perguntas_investigativas`, `hipoteses`,
   `estrategias` e `muda_conduta` **vazios em 14 de 14**, e concluiu "sem ganho".
   **Aquela bancada não mediu a capacidade da BIA; mediu uma ingestão quebrada.**
3. **Sobreposição com o Core v11 é real e parcial.** A re-ingestão tem de tratar
   o Core como piso já existente, sob pena de repetir no prompt o que já está lá.
4. **A não tem citações.** Onde A e B afirmarem o mesmo, a procedência
   rastreável é a de B.

---

## 6. O que este documento NÃO autoriza

Nada foi importado para `bia_chunks` (tabela existe em produção, **0 linhas**).
`lib/bia` continua sem nenhum chamador de produção e a flag `BIA_PROMPT_ENABLED`
continua desligada. Nenhuma linha de `processInbound`, do decisor de lacuna ou do
prompt foi tocada. O re-chunking é a etapa seguinte, e não começou.

**Relacionado:** [ENCAIXE-POS-NEURODESENVOLVIMENTO.md](../ENCAIXE-POS-NEURODESENVOLVIMENTO.md)
(mapa de encaixe, que passa a apontar para esta canônica).
