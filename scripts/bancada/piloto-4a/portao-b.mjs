/**
 * PORTÃO B — os mesmos casos nos DOIS canais.
 *
 * WhatsApp pela função de produção inteira (`gerarRespostaAyla`), incluindo a
 * rede da fronteira do diagnóstico. Nada de system reconstruído.
 *
 *   node scripts/bancada/piloto-4a/portao-b.mjs
 */
import {
  mod, chamarWeb, chamarWhatsApp, ctxWeb, perfilSintetico, recuperarReal,
  base2Real, supabaseStub, FAMILIA_PILOTO, linha, caixa,
} from "./comum.mjs";
import { writeFileSync } from "node:fs";

const { classificarIntencao } = await mod("lib/ia/intencao.ts");
const { blocoBoasPraticas } = await mod("lib/conhecimento/recuperar.ts");

const out = [];
const w = (s) => { out.push(s); console.log(s); };

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
  { id: "1 · PERFIL × BP", skill: "emocional", desafio: true,
    relato: "Ele bate na irmã quando é contrariado e eu não sei como agir na hora." },
  { id: "3 · MÚLTIPLOS TEMAS", skill: "emocional", desafio: true,
    relato: "Ele não fala o que quer, não para quieto na lição, não se veste sozinho e não brinca com as outras crianças. É tudo ao mesmo tempo." },
  { id: "4 · PEDIDO SIMPLES", skill: "sono", desafio: false,
    relato: "Ele pode dormir com a luz acesa?" },
  { id: "5 · DADO JÁ CONHECIDO", skill: "emocional", desafio: true,
    relato: "Hoje ele explodiu de novo no fim da tarde. O que eu faço?" },
  { id: "6 · CRISE", skill: "emocional", desafio: false,
    relato: "SOCORRO ele está se jogando no chão e gritando agora, não sei o que fazer" },
];

w(`PORTÃO B · Web × WhatsApp · mesmos casos, mesmo perfil\n`);
const comp = [];

for (const c of CASOS) {
  w(`\n${linha()}\n${c.id}\n"${c.relato}"\n`);

  const turno = await classificarIntencao({
    supabase: supabaseStub, familyId: FAMILIA_PILOTO, texto: c.relato,
    historico: [], temaAnterior: null,
  });
  const b2 = base2Real(c.skill);
  const bps = await recuperarReal({ skill: c.skill, idade: 6, relato: c.relato, comRanking: true });
  w(`  COMPREENSÃO COMPARTILHADA (idêntica por construção — mesmos módulos):`);
  w(`    intenção ${turno.intencao} · tema ${turno.tema ?? "-"} · BASE 2 ${b2.length} seções`);
  w(`    BPs ranqueadas: ${bps.map((b) => b.titulo.slice(0, 46)).join(" | ")}`);

  // ── WEB ───────────────────────────────────────────────────────────────
  const ctx = ctxWeb({ ...TEO, base2: b2, bps });
  const web = await chamarWeb({
    skill: c.skill, ctx, userInput: c.relato, intencao: turno.intencao, tema: turno.tema,
  });

  // ── WHATSAPP ─────────────────────────────────────────────────────────
  const wpp = await chamarWhatsApp({
    nomeMae: "Ana",
    cuidador: { relacao: "mãe", genero: "feminino" },
    nomeMembro: TEO.nome, idadeMembro: TEO.idade, perfilMembro: TEO.perfil,
    generoMembro: TEO.genero,
    koloVivoResumo: `${TEO.secoes.essencial}\n${TEO.secoes.emocional}`,
    koloVivoLacunas: "",
    // FASE 4A — o que a integração desta missão acrescentou a este canal.
    piloto4A: true,
    perfilConsultavel: TEO.perfilConsultavel,
    base2: b2,
    repertorio: blocoBoasPraticas(bps),
    historico: [],
    mensagem: c.relato,
    temaAtivo: turno.tema,
    sinais: { desafio: c.desafio ? c.relato : null, conquista: null },
  });

  const m = (t) => ({
    ch: t.length,
    perguntas: (t.match(/\?/g) ?? []).length,
    perfil: /trem|metrô|metro|mais rápido|fala mais alto|perto sem falar/i.test(t),
    proibido: /dinossauro|futebol/i.test(t),
    titulosMd: (t.match(/^## /gm) ?? []).length,
    titulosWa: (t.match(/^\*[^*]+\*$/gm) ?? []).length,
  });
  const mw = m(web.texto), mp = m(wpp.texto);

  w(`\n  WEB ......... ${mw.ch} ch · ${web.ms} ms · ${mw.perguntas}? · ${mw.titulosMd} títulos '##' · perfil ${mw.perfil ? "SIM" : "não"} · aversão ${mw.proibido ? "SIM!" : "não"}`);
  w(`  WHATSAPP .... ${mp.ch} ch · ${wpp.ms} ms · ${mp.perguntas}? · ${mp.titulosWa} títulos '*..*' · perfil ${mp.perfil ? "SIM" : "não"} · aversão ${mp.proibido ? "SIM!" : "não"}`);
  w(`  razão WhatsApp/Web: ${(mp.ch / mw.ch).toFixed(2)}×  ${mp.ch < mw.ch ? "(menor — desejado)" : "*** MAIOR — investigar ***"}`);
  w(`  markdown vazando pro WhatsApp? ${/^## |\*\*/m.test(wpp.texto) ? "*** SIM ***" : "não"}`);
  w(`\n  ┌─ WEB\n${caixa(web.texto)}\n  └─`);
  w(`\n  ┌─ WHATSAPP\n${caixa(wpp.texto)}\n  └─\n`);

  comp.push({ id: c.id, web: mw, wpp: mp, msWeb: web.ms, msWpp: wpp.ms });
}

w(`\n${linha()}\nRESUMO — tamanho por canal\n`);
w("caso".padEnd(24) + "WEB ch".padEnd(9) + "WA ch".padEnd(9) + "razão".padEnd(8) + "WA markdown");
for (const c of comp) {
  w(c.id.padEnd(24) + String(c.web.ch).padEnd(9) + String(c.wpp.ch).padEnd(9) +
    `${(c.wpp.ch / c.web.ch).toFixed(2)}×`.padEnd(8) + (c.wpp.titulosMd > 0 ? "VAZOU" : "limpo"));
}
w(`\nWhatsApp menor que a web em ${comp.filter((c) => c.wpp.ch < c.web.ch).length}/${comp.length} casos`);
w(`aversão do perfil citada em algum canal: ${comp.some((c) => c.web.proibido || c.wpp.proibido) ? "*** SIM ***" : "NÃO"}`);

writeFileSync(`${process.cwd()}/docs/bancada/piloto-4a-portao-b-2026-08-10.txt`, out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/piloto-4a-portao-b-2026-08-10.txt");
