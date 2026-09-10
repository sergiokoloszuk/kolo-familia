/**
 * BANCADA DO CORPUS COMPLETO — 45 chunks, recuperação OFFLINE.
 *
 * ⚠️ NADA TOCA PRODUÇÃO. Os chunks vêm do JSON versionado; `retriever.ts` (I/O)
 * não é usado. Roda o julgamento real: `filtrarDuro`, `pontuar`, `selecionar`,
 * `aplicarCotas`, `aplicarOrcamento`.
 *
 * Além dos 5 casos da bancada piloto, roda ADVERSARIAIS — cuja função é provar
 * que 45 chunks não deterioraram a seleção que 15 já faziam bem.
 *
 *   cd apps/web && npx tsx ../../scripts/bancada/bia-pos/rodar-corpus.mts
 */
import { readFileSync } from "node:fs";
import { selecionar, filtrarDuro, type ChunkParaPontuar, type ContextoBia } from "@/lib/bia/pontuacao";
import { aplicarCotas, aplicarOrcamento, MAX_CHARS_POR_CHUNK } from "@/lib/bia/bloco";

const chunks = JSON.parse(
  readFileSync("../../data/bia/corpus-pos-v1.json", "utf8"),
) as Array<ChunkParaPontuar & { _pressupoe?: string; titulo: string }>;

type Caso = {
  nome: string;
  ctx: ContextoBia;
  espera: string;
  /** O que NÃO pode dominar a saída. Ids ou prefixos. */
  proibido?: string[];
  /** O que TEM de aparecer no bloco. */
  exigido?: string[];
};

const PRE_VERBAIS = chunks.filter((c) => c._pressupoe).map((c) => c.id);

const CASOS: Caso[] = [
  {
    nome: "1 · MARIO (real) — dois temas, criança de 9 anos que conversa bem",
    ctx: {
      idadeAnos: 9,
      perfil: "TEA",
      dominios: ["comunicacao", "emocional"],
      contexto: "casa",
      textoDaConversa:
        "Quero ajudar ele a se comunicar melhor quando fica frustrado. Ele conversa bem, mas na hora da crise trava e fica agressivo.",
    },
    espera: "regulação + comunicação; escada pré-verbal NÃO pode dominar",
  },
  {
    nome: "2 · PRÉ-VERBAL — criança de 6 anos que leva a mãe pela mão",
    ctx: {
      idadeAnos: 6,
      perfil: "TEA",
      dominio: "comunicacao",
      contexto: "casa",
      textoDaConversa:
        "Ela fala poucas palavras. Às vezes aponta, mas quase sempre pega na minha mão e me leva até o que quer.",
    },
    espera: "a escada e o significado do puxar a mão",
    exigido: ["pos-a-03-mao"],
  },
  {
    nome: "3 · CRISE SÚBITA — mudança abrupta de padrão",
    ctx: {
      idadeAnos: 5,
      perfil: "TEA",
      dominio: "emocional",
      contexto: "casa",
      textoDaConversa:
        "Essa semana ele começou do nada a ter crises muito fortes, chorando e se jogando no chão. Nunca foi assim.",
    },
    espera: "cautela orgânica no bloco",
    exigido: ["pos-b-seg-dor"],
  },
  {
    nome: "4 · SENSORIAL — dispersão no mercado e na escola",
    ctx: {
      idadeAnos: 7,
      perfil: "TEA",
      dominio: "foco",
      contexto: "mercado",
      textoDaConversa:
        "No mercado e nas festas ele fica muito disperso, corre, não escuta o que eu falo. Na escola a professora diz a mesma coisa.",
    },
    espera: "a regra do sensorial antes do foco",
    exigido: ["pos-a-07-sensorial-publico"],
  },
  {
    nome: "5 · SOCIALIZAÇÃO — rejeição de pares na escola",
    ctx: {
      idadeAnos: 9,
      perfil: "TEA",
      dominio: "socializacao",
      contexto: "escola",
      textoDaConversa: "Ele quer fazer amigos mas as crianças não brincam com ele, e ele fica sozinho no recreio.",
    },
    espera: "sociometria e mediação de pares",
    exigido: ["pos-b-t6-sociometria"],
  },
  // ---------- ADVERSARIAIS ----------
  {
    nome: "A1 · VERBAL ADULTO — adolescente de 15 anos, fala fluente",
    ctx: {
      idadeAnos: 15,
      perfil: "TEA",
      dominio: "comunicacao",
      contexto: "escola",
      textoDaConversa:
        "Ele fala muito bem e escreve redação sozinho, mas não consegue manter uma conversa com os colegas sem falar só do assunto dele.",
    },
    espera: "pragmática, NÃO escada pré-verbal",
    proibido: PRE_VERBAIS,
  },
  {
    nome: "A2 · FOCO SEM PISTA SENSORIAL — lição de casa em casa, ambiente calmo",
    ctx: {
      idadeAnos: 8,
      perfil: "TDAH",
      dominio: "foco",
      contexto: "licao_de_casa",
      textoDaConversa:
        "Na hora da lição ele levanta toda hora, mesmo com a casa em silêncio e sem ninguém por perto. Não termina nada.",
    },
    espera: "executivas/quebra de tarefa; o sensorial de lugar público não deve invadir",
    proibido: ["pos-a-07-sensorial-publico"],
  },
  {
    nome: "A3 · TRÊS DOMÍNIOS — a soma não pode virar relevância",
    ctx: {
      idadeAnos: 7,
      perfil: "TEA",
      dominios: ["comunicacao", "emocional", "sono"],
      contexto: "casa",
      textoDaConversa: "Ele não dorme direito e de dia fica irritado, e quase não fala o que sente.",
    },
    espera: "no máximo 5 chunks, sem inflação por número de domínios",
  },
  {
    nome: "A4 · PERGUNTA MUITO ESPECÍFICA — o genérico não pode expulsar o específico",
    ctx: {
      idadeAnos: 4,
      perfil: "TEA",
      dominio: "autonomia",
      contexto: "banheiro",
      textoDaConversa:
        "Ela já tem 4 anos e ainda não desfraldou. Senta no vaso e não faz, e depois faz na fralda.",
    },
    espera: "o chunk de desfralde",
    exigido: ["pos-b-t5-desfralde"],
  },
  {
    nome: "A5 · DESABAFO SEM PEDIDO — nada específico deve ser forçado",
    ctx: {
      idadeAnos: 6,
      perfil: "TEA",
      dominio: "emocional",
      contexto: "casa",
      textoDaConversa: "Hoje foi um dia muito difícil, estou exausta.",
    },
    espera: "seleção pobre é resultado legítimo aqui",
  },
];

let falhas = 0;

for (const caso of CASOS) {
  console.log("\n" + "=".repeat(78));
  console.log("CASO " + caso.nome);
  const dom = caso.ctx.dominios ? caso.ctx.dominios.join("+") : caso.ctx.dominio;
  console.log(`contexto: domínio=${dom} · idade=${caso.ctx.idadeAnos} · situação=${caso.ctx.contexto}`);
  console.log(`espera: ${caso.espera}`);

  const vivos = chunks.filter((c) => !filtrarDuro(c, caso.ctx));
  const resultados = selecionar(vivos, caso.ctx, { limite: 8 });
  const noPrompt = aplicarOrcamento(aplicarCotas(resultados));

  console.log(`\n  NO BLOCO (${noPrompt.length} de ${vivos.length} candidatos vivos):`);
  for (const r of noPrompt) {
    const pre = (r.chunk as { _pressupoe?: string })._pressupoe ? " ⚠pré-verbal" : "";
    console.log(`   ${String(r.score).padStart(4)}  ${r.chunk.id}${pre}  [${r.chunk.tipo_conhecimento}]  ${r.chunk.titulo}`);
  }
  const resto = resultados.filter((r) => !noPrompt.some((x) => x.chunk.id === r.chunk.id));
  if (resto.length) console.log(`  ficaram de fora: ${resto.map((r) => `${r.chunk.id}(${r.score})`).join(", ")}`);

  const ids = noPrompt.map((r) => r.chunk.id);
  const chars = noPrompt.reduce((s, r) => s + Math.min(r.chunk.texto_original.length, MAX_CHARS_POR_CHUNK), 0);
  console.log(`  orçamento: ${chars} chars · truncados: ${noPrompt.filter((r) => r.chunk.texto_original.length > MAX_CHARS_POR_CHUNK).length}`);

  // ---- veredito ----
  const preNoBloco = ids.filter((i) => PRE_VERBAIS.includes(i));
  const dominante = preNoBloco.length > ids.length / 2;
  if (caso.proibido) {
    const violou = ids.filter((i) => caso.proibido!.includes(i));
    if (violou.length) {
      console.log(`  ❌ PROIBIDO NO BLOCO: ${violou.join(", ")}`);
      falhas++;
    } else console.log("  ✅ nenhum proibido entrou");
  }
  if (caso.exigido) {
    const faltou = caso.exigido.filter((i) => !ids.includes(i));
    if (faltou.length) {
      console.log(`  ❌ EXIGIDO E AUSENTE: ${faltou.join(", ")}`);
      falhas++;
    } else console.log("  ✅ o exigido está no bloco");
  }
  if (ids.length > 5) {
    console.log(`  ❌ ${ids.length} chunks — o teto é 5`);
    falhas++;
  }
  if (preNoBloco.length) {
    console.log(`  ⚠️  pré-verbais no bloco: ${preNoBloco.length}/${ids.length}${dominante ? "  ← DOMINANTE" : ""}`);
  }
}

console.log("\n" + "=".repeat(78));
console.log(falhas === 0 ? "TODOS OS CRITÉRIOS DUROS PASSARAM" : `${falhas} CRITÉRIO(S) DURO(S) FALHARAM`);
