/**
 * PORTÃO A — os 8 casos funcionais pelo pipeline REAL da web, com GPT.
 *
 *   node scripts/bancada/piloto-4a/portao-a.mjs
 */
import {
  mod, chamarWeb, ctxWeb, perfilSintetico, recuperarReal, base2Real,
  supabaseStub, FAMILIA_PILOTO, providerConversacionalParaFamilia, pilotoQuatroA,
  linha, caixa,
} from "./comum.mjs";
import { writeFileSync } from "node:fs";

const { classificarIntencao } = await mod("lib/ia/intencao.ts");

const out = [];
const w = (s) => { out.push(s); console.log(s); };

w(`FATIA 1 DEPOIS · 8 casos funcionais · pipeline REAL da web`);
w(`provider da família sintética: ${providerConversacionalParaFamilia(FAMILIA_PILOTO)} · 4A: ${pilotoQuatroA(FAMILIA_PILOTO)}`);
w(`assemblePrompt + gerarConversacional — o par exato de app/api/conversar/stream/route.ts\n`);

/** Perfis sintéticos reaproveitados entre casos. */
const TEO = {
  nome: "Téo", idade: 6, perfil: "TEA", genero: "masculino",
  secoes: {
    essencial: "Téo, 6 anos. INTERESSES: trens e metrô, sabe as estações da linha azul. NÃO gosta de dinossauros nem de futebol.",
    emocional: "Sinais antes de explodir: fica mais rápido, fala mais alto. O que ajuda: ficar perto sem falar muito.",
  },
  perfilConsultavel: perfilSintetico({
    emocional: { label: "Emocional", campos: [
      { key: "sinais", label: "sinais de desregulação", estado: "preenchido", valor: "fica mais rápido, fala mais alto" },
      { key: "ajuda", label: "o que ajuda", estado: "preenchido", valor: "ficar perto sem falar muito" },
      { key: "gatilhos", label: "gatilhos conhecidos", estado: "vazio" },
    ]},
    sensorial: { label: "Sensorial", campos: [
      { key: "som", label: "sensibilidade a som", estado: "negativo" },
      { key: "textura", label: "sensibilidade a textura", estado: "preenchido", valor: "não gosta de etiqueta na roupa" },
    ]},
    interesses: { label: "Interesses", campos: [
      { key: "fortes", label: "interesses fortes", estado: "preenchido", valor: "trens e metrô" },
      { key: "aversoes", label: "não gosta de", estado: "preenchido", valor: "dinossauros, futebol" },
    ]},
  }),
};

const CASOS = [
  { id: "1 · PERFIL CONTRADIZ BP", skill: "emocional", membro: TEO,
    relato: "Ele bate na irmã quando é contrariado e eu não sei como agir na hora.",
    esperado: "usa trens/metrô ou nada; NUNCA dinossauro ou futebol" },
  { id: "2 · RELATO AMBÍGUO", skill: "emocional", membro: TEO,
    relato: "Ele tem chorado muito ultimamente, não sei o que está acontecendo.",
    esperado: "compreende/diferencia antes de orientar; no máximo 1 pergunta de alto valor" },
  { id: "3 · MÚLTIPLOS TEMAS", skill: "emocional", membro: TEO,
    relato: "Ele não fala o que quer, não para quieto na lição, não se veste sozinho e não brinca com as outras crianças. É tudo ao mesmo tempo.",
    esperado: "organiza as frentes e pergunta por qual começar; não resolve tudo; não empurra Plano" },
  { id: "4 · PEDIDO SIMPLES", skill: "sono", membro: TEO,
    relato: "Ele pode dormir com a luz acesa?",
    esperado: "responde direto, curto, sem interrogatório" },
  { id: "5 · DADO JÁ CONHECIDO", skill: "emocional", membro: TEO,
    relato: "Hoje ele explodiu de novo no fim da tarde. O que eu faço?",
    esperado: "usa os sinais e o que ajuda que JÁ estão no perfil; não pergunta o que já sabemos" },
  { id: "6 · CRISE", skill: "emocional", membro: TEO,
    relato: "SOCORRO ele está se jogando no chão e gritando agora, não sei o que fazer",
    esperado: "curta, acolhe, 1-2 passos para atravessar; sem relatório e sem plano" },
  { id: "7 · OPORTUNIDADE REAL DE PLANO", skill: "emocional", membro: TEO,
    relato: "As explosões no fim da tarde acontecem todo dia há uns dois meses. Eu queria trabalhar isso ao longo das próximas semanas, de forma organizada, e ir acompanhando se melhora.",
    esperado: "OFERECE o plano (marcador), com o ganho daquele caso" },
  { id: "8 · NÃO É CASO DE PLANO", skill: "emocional", membro: TEO,
    relato: "Só queria te contar que hoje ele conseguiu esperar a vez dele sem chorar. Fiquei feliz.",
    esperado: "celebra junto; NÃO oferece plano" },
];

const { MARCADOR_PLANO } = await mod("lib/ia/marcadores.ts");
const resultados = [];

for (const c of CASOS) {
  w(`\n${linha()}\n${c.id}\n"${c.relato}"\nesperado: ${c.esperado}\n`);

  // 1. INTENÇÃO — classificador REAL (Haiku), o mesmo que a rota chama.
  const turno = await classificarIntencao({
    supabase: supabaseStub, familyId: FAMILIA_PILOTO, texto: c.relato,
    historico: [], temaAnterior: null,
  });
  w(`  intenção ....... ${turno.intencao}  ·  tema: ${turno.tema ?? "-"}`);

  // 2. BASE 2 e BPs — módulos REAIS.
  const b2 = base2Real(c.skill);
  const bpsCom = await recuperarReal({ skill: c.skill, idade: c.membro.idade, relato: c.relato, comRanking: true });
  const bpsSem = await recuperarReal({ skill: c.skill, idade: c.membro.idade, relato: c.relato, comRanking: false });
  w(`  BASE 2 ......... ${b2.length} seções: ${b2.map((s) => s.titulo.slice(0, 42)).join(" | ") || "(sem material)"}`);
  w(`  BPs candidatas . ${bpsSem.length} sem ranking: ${bpsSem.map((b) => b.titulo.slice(0, 40)).join(" | ")}`);
  w(`  BPs ENVIADAS ... ${bpsCom.length} com ranking: ${bpsCom.map((b) => b.titulo.slice(0, 40)).join(" | ")}`);
  const trocou = bpsCom.some((b) => !bpsSem.slice(0, 2).some((x) => x.titulo === b.titulo));
  w(`  ranking trocou o conjunto? ${trocou ? "SIM" : "não"}`);

  // 3. CONTEXTO + CHAMADA — pipeline real.
  const ctx = ctxWeb({ ...c.membro, base2: b2, bps: bpsCom });
  const r = await chamarWeb({
    skill: c.skill, ctx, userInput: c.relato,
    intencao: turno.intencao, tema: turno.tema,
  });

  const ofereceuPlano = r.texto.includes(MARCADOR_PLANO);
  const temPerfil = /trem|metrô|metro|fica mais rápido|fala mais alto|perto sem falar/i.test(r.texto);
  const temProibido = /dinossauro|futebol/i.test(r.texto);
  const perguntas = (r.texto.match(/\?/g) ?? []).length;

  w(`\n  provider ....... ${r.provider} / ${r.model}`);
  w(`  system ......... ${r.systemCh} ch · contexto ${r.userCh} ch · tokens in ${r.tokensIn ?? "?"} out ${r.tokensOut ?? "?"}`);
  w(`  resposta ....... ${r.texto.length} ch · ${r.ms} ms · ${perguntas} pergunta(s)`);
  w(`  usou perfil? ${temPerfil ? "SIM" : "não"} · citou aversão? ${temProibido ? "*** SIM ***" : "não"} · ofereceu Plano? ${ofereceuPlano ? "SIM" : "não"}`);
  w(`\n  ┌─ resposta\n${caixa(r.texto)}\n  └─\n`);

  resultados.push({
    id: c.id, intencao: turno.intencao, tema: turno.tema, b2: b2.length,
    bps: bpsCom.map((b) => b.titulo), trocou, ch: r.texto.length, ms: r.ms,
    perguntas, temPerfil, temProibido, ofereceuPlano,
    tokensIn: r.tokensIn, tokensOut: r.tokensOut,
  });
}

w(`\n\n${linha()}\nRESUMO\n`);
w("caso".padEnd(34) + "int".padEnd(10) + "B2".padEnd(4) + "rank".padEnd(6) + "ch".padEnd(6) + "?".padEnd(4) + "perfil".padEnd(8) + "plano");
for (const r of resultados) {
  w(r.id.padEnd(34) + String(r.intencao).padEnd(10) + String(r.b2).padEnd(4) +
    (r.trocou ? "trocou" : "igual ").padEnd(6) + String(r.ch).padEnd(6) +
    String(r.perguntas).padEnd(4) + (r.temPerfil ? "usou" : "-").padEnd(8) +
    (r.ofereceuPlano ? "OFERECEU" : "-"));
}
const tIn = resultados.reduce((a, r) => a + (r.tokensIn ?? 0), 0);
const tOut = resultados.reduce((a, r) => a + (r.tokensOut ?? 0), 0);
w(`\ntokens: ${tIn} in · ${tOut} out · latência mediana ${resultados.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(resultados.length / 2)]} ms`);
w(`citou aversão do perfil em algum caso? ${resultados.some((r) => r.temProibido) ? "*** SIM — FALHA ***" : "NÃO"}`);

writeFileSync(`${process.cwd()}/docs/bancada/piloto-4a-fatia1-depois-2026-08-10.txt`, out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/piloto-4a-fatia1-depois-2026-08-10.txt");
