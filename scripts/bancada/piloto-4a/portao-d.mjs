/**
 * PORTÃO D — ablação de 4 braços. O que CADA camada acrescenta?
 *
 * Mesmo caso, mesma criança, quatro contextos:
 *   A · 4A completa
 *   B · sem perfil consultável (e portanto sem âncora — ela é colada nele)
 *   C · sem BASE 2
 *   D · recuperação ANTIGA de BPs (3 por peso, sem ranking)
 *
 *   node scripts/bancada/piloto-4a/portao-d.mjs
 */
import {
  mod, chamarWeb, ctxWeb, perfilSintetico, recuperarReal, base2Real,
  supabaseStub, FAMILIA_PILOTO, linha, caixa,
} from "./comum.mjs";
import { writeFileSync } from "node:fs";

const { classificarIntencao } = await mod("lib/ia/intencao.ts");
const out = [];
const w = (s) => { out.push(s); console.log(s); };

const RELATO = "Ele trava para começar a lição e às vezes chora antes de tentar. Não sei se exijo ou se deixo pra lá.";
const SKILL = "foco";

const BIA = {
  nome: "Bia", idade: 7, perfil: "TEA", genero: "feminino",
  secoes: {
    essencial: "Bia, 7 anos. INTERESSES: animais. NÃO gosta de futebol nem de carrinhos.",
    comunicacao: "Usa fala combinada com apoio visual (figuras).",
    sensorial: "Sensibilidade tátil — reage a toque inesperado.",
  },
  perfilConsultavel: perfilSintetico({
    comunicacao: { label: "Comunicação", campos: [
      { key: "expressao", label: "fala com apoio visual", estado: "preenchido", valor: "fala + figuras" },
      { key: "leitura", label: "lê", estado: "vazio" },
    ]},
    sensorial: { label: "Sensorial", campos: [
      { key: "tato", label: "sensibilidade tátil", estado: "preenchido", valor: "toque inesperado" },
      { key: "som", label: "sensibilidade a som", estado: "negativo" },
    ]},
    interesses: { label: "Interesses", campos: [
      { key: "fortes", label: "interesses fortes", estado: "preenchido", valor: "animais" },
      { key: "aversoes", label: "não gosta de", estado: "preenchido", valor: "futebol, carrinhos" },
    ]},
  }),
};

const turno = await classificarIntencao({
  supabase: supabaseStub, familyId: FAMILIA_PILOTO, texto: RELATO, historico: [], temaAnterior: null,
});
const b2 = base2Real(SKILL);
const bpsNovo = await recuperarReal({ skill: SKILL, idade: 7, relato: RELATO, comRanking: true });
const bpsAntigo = await recuperarReal({ skill: SKILL, idade: 7, relato: RELATO, comRanking: false });

w(`PORTÃO D · ablação · "${RELATO}"`);
w(`intenção ${turno.intencao} · tema ${turno.tema ?? "-"}\n`);
w(`BPs 4A (ranking) ..: ${bpsNovo.map((b) => b.titulo.slice(0, 55)).join(" | ")}`);
w(`BPs antigas (peso) : ${bpsAntigo.map((b) => b.titulo.slice(0, 55)).join(" | ")}\n`);

const BRACOS = [
  { id: "A · 4A COMPLETA", perfilConsultavel: BIA.perfilConsultavel, base2: b2, bps: bpsNovo },
  { id: "B · SEM PERFIL CONSULTÁVEL (e sem âncora)", perfilConsultavel: null, base2: b2, bps: bpsNovo },
  { id: "C · SEM BASE 2", perfilConsultavel: BIA.perfilConsultavel, base2: [], bps: bpsNovo },
  { id: "D · RECUPERAÇÃO ANTIGA DE BPs", perfilConsultavel: BIA.perfilConsultavel, base2: b2, bps: bpsAntigo },
];

const res = [];
for (const b of BRACOS) {
  const ctx = ctxWeb({ ...BIA, base2: b.base2, bps: b.bps, perfilConsultavel: b.perfilConsultavel });
  const r = await chamarWeb({ skill: SKILL, ctx, userInput: RELATO, intencao: turno.intencao, tema: turno.tema });
  const t = r.texto;
  const s = {
    ch: t.length,
    perguntas: (t.match(/\?/g) ?? []).length,
    visual: /figura|imagem|cartão|cartao|visual/i.test(t),
    animal: /animal|animais|bicho/i.test(t),
    aversao: /futebol|carrinh/i.test(t),
    diferencia: /pode ser que|talvez|se for|depende de|repare se|observe se|qual dele/i.test(t),
    invencao: /\bela lê\b|sabe ler|o cérebro (dela|está) (diz|dizendo|quer|pede)/i.test(t),
    generico: /rotina|previsib|passo a passo|dividir/i.test(t),
  };
  w(`\n${linha()}\n${b.id}\n`);
  w(`  ${s.ch} ch · ${s.perguntas}? · visual ${s.visual ? "SIM" : "não"} · animais ${s.animal ? "SIM" : "não"} · aversão ${s.aversao ? "*** SIM ***" : "não"} · diferencia ${s.diferencia ? "SIM" : "não"} · invenção ${s.invencao ? "*** SIM ***" : "não"}`);
  w(`\n  ┌─\n${caixa(t)}\n  └─\n`);
  res.push({ id: b.id, ...s, texto: t });
}

w(`\n${linha()}\nO QUE CADA CAMADA ACRESCENTA\n`);
w("braço".padEnd(42) + "ch".padEnd(7) + "?".padEnd(4) + "visual".padEnd(8) + "animais".padEnd(9) + "difere".padEnd(8) + "aversão");
for (const r of res) {
  w(r.id.padEnd(42) + String(r.ch).padEnd(7) + String(r.perguntas).padEnd(4) +
    (r.visual ? "SIM" : "-").padEnd(8) + (r.animal ? "SIM" : "-").padEnd(9) +
    (r.diferencia ? "SIM" : "-").padEnd(8) + (r.aversao ? "VAZOU" : "-"));
}
const A = res[0];
w(`\nLEITURA:`);
w(`  perfil consultável (A×B): apoio visual ${A.visual ? "presente" : "ausente"} em A, ${res[1].visual ? "presente" : "ausente"} em B`);
w(`  BASE 2 (A×C): diferenciação ${A.diferencia ? "presente" : "ausente"} em A, ${res[2].diferencia ? "presente" : "ausente"} em C`);
w(`  ranking (A×D): as BPs enviadas foram ${JSON.stringify(bpsNovo.map((b) => b.titulo.slice(0, 30)))} × ${JSON.stringify(bpsAntigo.map((b) => b.titulo.slice(0, 30)))}`);

writeFileSync(`${process.cwd()}/docs/bancada/piloto-4a-portao-d-2026-08-10.txt`, out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/piloto-4a-portao-d-2026-08-10.txt");
