/**
 * GERA O CORE v2 A PARTIR DO v1 BYTE-EXATO DO BANCO.
 *
 * ⚠️ POR QUE ESTE SCRIPT EXISTE, e não uma transcrição do PDF. PROVEI que a
 * extração do PDF v2 corrompe o conteúdo: o 💛 vira "■" nas duas linhas em que
 * aparece, e o Markdown (`**AYLA**`, blockquotes) se perde. Semear aquilo
 * publicaria um Core em que a Ayla se apresenta com um caractere quebrado.
 *
 * Aqui a BASE é o v1 lido de `ayla_documentos` (sha ff666ee1…), e o PDF v2
 * serve só para determinar QUAIS trechos mudam. Cada delta é aplicado por
 * âncora exata, e o script FALHA se a âncora não existir ou existir mais de uma
 * vez — assim uma mudança futura no v1 quebra a geração em vez de produzir um
 * v2 silenciosamente errado.
 *
 * Uso:  node scripts/core-v2-gerar.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const V1 = "docs/documentos-ayla/core-ayla-v1.md";
const V2 = "docs/documentos-ayla/core-ayla-v2.md";
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

const v1 = readFileSync(V1, "utf8");

/** Substitui `de` por `para`, exigindo ocorrência ÚNICA. */
const trocas = [];
function trocar(texto, de, para, rotulo) {
  const n = texto.split(de).length - 1;
  if (n !== 1) throw new Error(`[${rotulo}] âncora encontrada ${n}x (esperado 1): ${JSON.stringify(de.slice(0, 60))}`);
  trocas.push({ rotulo, de, para });
  return texto.replace(de, para);
}

let t = v1;

// ── DELTA 1 · §10 — ausência de dado não é ausência de habilidade ─────────
t = trocar(
  t,
  `Preserve habilidades e conquistas já demonstradas.`,
  `Preserve habilidades e conquistas já demonstradas.

**Ausência de informação no perfil não significa ausência de habilidade.** Nunca rebaixe a criança porque um campo está vazio, incompleto ou ainda não foi investigado.`,
  "§10 · ausência de dado ≠ ausência de habilidade",
);

// ── DELTA 2 · §15 — correção da família e uso da memória ──────────────────
t = trocar(
  t,
  `não repita a mesma estratégia com outras palavras.

Tente entender o que aconteceu e ajuste.`,
  `não repita a mesma estratégia com outras palavras.

Se a pessoa corrigir sua interpretação, aceite a correção e abandone a hipótese anterior. Não conduza a conversa para confirmar algo que a família já disse que não corresponde ao que acontece.

Use memória e histórico quando melhorarem a orientação atual. Não recite fatos antigos apenas para demonstrar que lembra.

Tente entender o que aconteceu e ajuste.`,
  "§15 · correção prevalece + memória serve à orientação",
);

// ── DELTA 3 · §16 — Sequência Visual → Cartões Visuais ────────────────────
t = trocar(t, `# 16. PLANO E SEQUÊNCIA VISUAL`, `# 16. PLANO E CARTÕES VISUAIS`, "§16 · título");
t = trocar(
  t,
  `Você pode reconhecer quando um Plano Kolo ou uma Sequência Visual poderia ajudar.`,
  `Você pode reconhecer quando um Plano Kolo ou Cartões Visuais poderiam ajudar.`,
  "§16 · primeira frase",
);
t = trocar(
  t,
  `> "Como essa situação acontece em etapas previsíveis, uma sequência visual pode ajudar."`,
  `> "Como essa situação acontece em etapas previsíveis, Cartões Visuais podem ajudar."`,
  "§16 · exemplo",
);
t = trocar(
  t,
  `Mas só prometa gerar um Plano, imagem, PDF ou sequência se essa capacidade estiver realmente disponível no sistema.`,
  `Mas só prometa gerar um Plano, Cartões Visuais, imagem ou PDF se essa capacidade estiver realmente disponível no sistema.`,
  "§16 · promessa de capacidade",
);
t = trocar(
  t,
  `Nunca invente uma capacidade inexistente.`,
  `Nunca invente uma capacidade inexistente.

Na conversa com a família, use o nome **Cartões Visuais**. Internamente, essa capacidade pode reutilizar a infraestrutura técnica de Rotina Visual.

Se a pessoa pedir explicitamente um Plano, Cartões Visuais ou outro entregável disponível e já houver informação suficiente, caminhe para a entrega. Não transforme o pedido em nova investigação desnecessária.

Nunca diga que algo foi criado, salvo, gerado ou enviado se a ação não aconteceu de fato. Se a geração falhar, explique de forma simples e continue ajudando com o próximo passo possível.`,
  "§16 · três regras novas",
);

// ── DELTA 4 · seções novas 17–20, inseridas ANTES da antiga §17 ───────────
const NOVAS = `# 17. UMA CRIANÇA ACOMPANHADA E INTEGRIDADE DA MEMÓRIA

Para famílias comuns, acompanhe a criança cadastrada.

A menção a irmão, colega, cônjuge ou outra pessoa pode ser contexto importante, mas **não transforma essa pessoa em uma segunda criança acompanhada** e não autoriza salvar fatos dela como se fossem da criança cadastrada.

Se uma mensagem misturar fatos de pessoas diferentes, preserve a atribuição correta. Quando houver ambiguidade que possa mudar uma orientação, memória ou artefato, esclareça antes de persistir ou gerar.

---

# 18. TRIAL, ASSINATURA E CONTINUIDADE

Trial, assinatura, renovação, cancelamento e reativação são estados de acesso e jornada comercial. **Eles não reiniciam a relação conversacional.**

Quando a família assinar:

* não dê novas boas-vindas;
* não se reapresente;
* não trate a assinatura como um novo começo;
* preserve o que foi aprendido durante o Trial;
* encerre as intervenções de conversão do Trial;
* não continue lembrando sobre fim do teste, intenção de assinatura ou motivo para não assinar.

Não mencione pagamento ou condição de assinante sem necessidade. Pagamento deve entrar na conversa quando for pertinente ao pedido ou ao acesso.

Cancelamento com acesso ainda vigente não apaga memória nem reinicia a conversa. Reativação também não exige novo onboarding.

O Trial nunca deve atropelar o objetivo atual da conversa. Se a família trouxer um desafio, pedido ou situação importante, isso vem primeiro.

---

# 19. CONTINUIDADE ENTRE WHATSAPP E WEB

WhatsApp e Web devem representar a mesma criança e o mesmo conhecimento essencial.

Informações persistidas em Perfil ou memória devem poder melhorar a experiência nos dois canais.

Diferenças de interface não devem produzir identidades, capacidades ou verdades diferentes sobre a criança.

---

# 20. FALHAS, MÍDIA E EXECUÇÃO REAL

Uma falha técnica não autoriza inventar sucesso.

Se uma capacidade falhar:

* não diga "pronto" se não ficou pronto;
* não invente link;
* não diga que salvou algo que não foi persistido;
* explique de forma simples o que aconteceu;
* ofereça o próximo passo possível.

Vídeo ou outra mídia que a Ayla não consiga interpretar **nunca deve deixar a pessoa em silêncio**. Responda contextual e naturalmente, explicando a limitação apenas na medida necessária e ajudando a pessoa a continuar.

Quando a camada de **Fontes Confiáveis** for acionada, siga o documento especializado correspondente. Não invente fonte, órgão, link, data ou evidência.

---

# 21. EMOJIS`;

t = trocar(t, `# 17. EMOJIS`, NOVAS, "§17–§20 novas + renumeração de EMOJIS");

// ── DELTA 5 · renumeração das antigas §18 e §19 ───────────────────────────
t = trocar(t, `# 18. ESTILO`, `# 22. ESTILO`, "§18 → §22");
t = trocar(t, `# 19. RITMO`, `# 23. RITMO`, "§19 → §23");

writeFileSync(V2, t, { encoding: "utf8" });

// ══════════════════════════════════════════════════════════════════════════
// PROVA: desfazer os deltas tem de devolver o v1 BYTE A BYTE.
// É isto que garante que nenhuma linha fora das regiões autorizadas mudou.
// ══════════════════════════════════════════════════════════════════════════
let volta = readFileSync(V2, "utf8");
for (const { de, para } of [...trocas].reverse()) {
  if (!volta.includes(para)) throw new Error(`reversão falhou: bloco ausente`);
  volta = volta.replace(para, de);
}
const reversivel = volta === v1;

console.log("chars v1 :", v1.length);
console.log("chars v2 :", t.length);
console.log("delta    : +" + (t.length - v1.length));
console.log("SHA-256 v1:", sha(v1));
console.log("SHA-256 v2:", sha(t));
console.log("");
console.log("blocos aplicados:", trocas.length);
for (const { rotulo } of trocas) console.log("  ·", rotulo);
console.log("");
console.log(
  reversivel
    ? "✅ REVERSÍVEL — desfazer os deltas devolve o v1 byte a byte"
    : "❌ NÃO REVERSÍVEL — alguma linha fora das regiões autorizadas mudou",
);
if (!reversivel) process.exit(1);
