/**
 * BANCADA DO RE-CHUNKING DA PÓS — recuperação OFFLINE, sem banco e sem rede.
 *
 * ⚠️ NADA AQUI TOCA PRODUÇÃO. Os chunks vêm de um JSON local; o retriever de
 * I/O (`retriever.ts`) NÃO é usado, justamente porque ele iria ao Postgres. O
 * que roda é o julgamento — `pontuar`, `selecionar`, `aplicarCotas`,
 * `aplicarOrcamento` —, que é puro e é onde mora a decisão.
 *
 * Objetivo: responder, antes de importar qualquer coisa, se estes chunks são
 * recuperados pelos casos certos e se acrescentam algo ao que a Ayla já tem.
 *
 *   npx tsx scripts/bancada/bia-pos/rodar.mts
 */
import { readFileSync } from "node:fs";
import { pontuar, selecionar, filtrarDuro, type ChunkParaPontuar, type ContextoBia } from "@/lib/bia/pontuacao";
import { aplicarCotas, aplicarOrcamento, MAX_CHARS_POR_CHUNK } from "@/lib/bia/bloco";

const chunks = JSON.parse(
  readFileSync("../../scripts/bancada/bia-pos/chunks-piloto.json", "utf8"),
) as Array<ChunkParaPontuar & Record<string, unknown>>;

/** Os casos, tirados de conversas REAIS já auditadas neste repositório. */
const CASOS: Array<{ nome: string; ctx: ContextoBia; oQueFaltou: string }> = [
  {
    nome: "MARIO — conversa bem, mas trava na frustração (turno real 10/09 12:27)",
    ctx: {
      idadeAnos: 9,
      perfil: "TEA",
      dominio: "comunicacao",
      contexto: "casa",
      dificuldade: "fica muito frustrado quando quer algo e não consegue dizer o que é",
      textoDaConversa:
        "Quero ajudar ele a se comunicar melhor quando fica frustrado. O que posso fazer? Ele conversa bem, mas na hora da crise trava e fica agressivo.",
    },
    oQueFaltou: "o Core orientou bem; o Gate B sugeriu contato visual (degrau pré-verbal) para uma criança que conversa",
  },
  {
    nome: "PRÉ-VERBAL — criança que leva a mãe pela mão (caso Manu, 10/09 00:15)",
    ctx: {
      idadeAnos: 6,
      perfil: "TEA",
      dominio: "comunicacao",
      contexto: "casa",
      dificuldade: "às vezes ela aponta, mas muitas vezes pega na minha mão e me leva até o que quer",
      textoDaConversa:
        "Ela fala poucas palavras. Às vezes aponta, mas quase sempre pega na minha mão e me leva até o que quer. Como ajudo ela a se comunicar?",
    },
    oQueFaltou: "o que significa puxar a mão, e qual é o degrau seguinte",
  },
  {
    nome: "SENSORIAL — dispersão no mercado e na escola",
    ctx: {
      idadeAnos: 7,
      perfil: "TEA",
      dominio: "foco",
      contexto: "mercado",
      dificuldade: "não para quieto no mercado e na festa, parece que não escuta",
      textoDaConversa:
        "No mercado e nas festas ele fica muito disperso, corre, não escuta o que eu falo. Na escola a professora diz a mesma coisa.",
    },
    oQueFaltou: "investigar carga sensorial ANTES de trabalhar atenção",
  },
  {
    nome: "CRISE SÚBITA — mudança abrupta de padrão",
    ctx: {
      idadeAnos: 5,
      perfil: "TEA",
      dominio: "emocional",
      contexto: "casa",
      dificuldade: "do nada começou a ter crises fortes essa semana, nunca foi assim",
      textoDaConversa:
        "Essa semana ele começou do nada a ter crises muito fortes, chorando e se jogando no chão. Nunca foi assim. Não mudou nada na rotina.",
    },
    oQueFaltou: "levantar dor física silenciosa como hipótese antes de plano comportamental",
  },
];

// ⚠️ A VARIANTE QUE O TURNO REAL PEDIA. `decidirTurno` devolveu
// tema: ["comunicacao","emocional"] — e `ContextoBia.dominio` aceita UM só.
// Rodar os dois mostra o quanto a escolha do domínio decide o resultado.
CASOS.splice(1, 0, {
  nome: "MARIO (variante) — mesmo turno, domínio = emocional",
  ctx: { ...CASOS[0].ctx, dominio: "emocional" },
  oQueFaltou: "o mesmo turno, lido pelo outro tema que o decisor devolveu",
});

const LIMITE = 6;

for (const caso of CASOS) {
  console.log("\n" + "=".repeat(78));
  console.log("CASO: " + caso.nome);
  console.log("contexto: dominio=" + caso.ctx.dominio + " · idade=" + caso.ctx.idadeAnos + " · situação=" + caso.ctx.contexto);
  console.log('relato: "' + String(caso.ctx.textoDaConversa).slice(0, 110) + '…"');
  console.log("o que faltou no turno real: " + caso.oQueFaltou);

  const vivos = chunks.filter((c) => !filtrarDuro(c, caso.ctx));
  const excluidos = chunks.filter((c) => filtrarDuro(c, caso.ctx));

  const resultados = selecionar(vivos, caso.ctx, { limite: LIMITE });
  const comCota = aplicarCotas(resultados);
  const noPrompt = aplicarOrcamento(comCota);

  console.log("\n  RANKING (top " + LIMITE + " de " + vivos.length + " candidatos):");
  for (const r of resultados) {
    const dentro = noPrompt.some((x) => x.chunk.id === r.chunk.id);
    console.log(
      `   ${dentro ? "✓" : "·"} ${String(r.score).padStart(4)}  ${r.chunk.id}  [${r.chunk.tipo_conhecimento}]  ${r.chunk.titulo}`,
    );
    console.log(`          por quê: ${r.motivos.map((m) => `${m.descricao} (${m.peso > 0 ? "+" : ""}${m.peso})`).join(" · ")}`);
  }

  const fora = resultados.filter((r) => !noPrompt.some((x) => x.chunk.id === r.chunk.id));
  if (fora.length) {
    console.log("\n  DESCARTADOS pela cota/orçamento: " + fora.map((r) => r.chunk.id).join(", "));
  }
  if (excluidos.length) {
    console.log("  EXCLUÍDOS no filtro duro: " + excluidos.map((c) => c.id).join(", "));
  }

  const chars = noPrompt.reduce((s, r) => s + Math.min(r.chunk.texto_original.length, MAX_CHARS_POR_CHUNK), 0);
  const truncados = noPrompt.filter((r) => r.chunk.texto_original.length > MAX_CHARS_POR_CHUNK);
  console.log(`\n  AO PROMPT: ${noPrompt.length} chunk(s), ${chars} chars, truncados: ${truncados.length}`);
}

console.log("\n" + "=".repeat(78));
const porTipo: Record<string, number> = {};
let maior = 0;
for (const c of chunks) {
  porTipo[c.tipo_conhecimento] = (porTipo[c.tipo_conhecimento] ?? 0) + 1;
  maior = Math.max(maior, c.texto_original.length);
}
console.log("CORPUS PILOTO: " + chunks.length + " chunks · maior texto: " + maior + " chars (teto do bloco: " + MAX_CHARS_POR_CHUNK + ")");
console.log("por tipo: " + JSON.stringify(porTipo));
