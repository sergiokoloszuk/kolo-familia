/**
 * FASES 5 e 8 — personalização por interesses + golden cases humanos.
 *
 * 10 gerações pelo pipeline REAL da web + 2 chamadas de juízo EM LOTE (5
 * respostas cada), com 12 critérios explícitos. O juiz não sabe o caso nem o
 * que se espera dele — recebe o relato, o perfil e a resposta.
 *
 *   node scripts/bancada/piloto-4a/fases-5-8.mjs
 */
import {
  mod, chamarWeb, ctxWeb, perfilSintetico, recuperarReal, base2Real,
  supabaseStub, FAMILIA_PILOTO, linha, caixa,
} from "./comum.mjs";
import { writeFileSync } from "node:fs";

const { classificarIntencao } = await mod("lib/ia/intencao.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const out = [];
const w = (s) => { out.push(s); console.log(s); };

const pc = (d) => perfilSintetico(d);

// ── FASE 5 · mesmo desafio de FOCO/ENGAJAMENTO, interesses diferentes ─────
const DESAFIO_FOCO = "Ele não para numa atividade até o fim. Começa e larga, e eu não sei como sustentar.";
const DESAFIO_SOCIAL = "Ela quase não fala com outras pessoas fora de casa. Em casa fala bem.";

const CASOS = [
  { fase: 5, id: "5A · foco + DESENHO/ARTES", skill: "foco", relato: DESAFIO_FOCO,
    nome: "Ivo", idade: 8, perfil: "TDAH", genero: "masculino",
    secoes: { essencial: "Ivo, 8 anos. INTERESSES: desenhar, quadrinhos, pintura.", foco: "Larga a atividade no meio. Sustenta quando é desenho." },
    pcs: { interesses:{label:"Interesses",campos:[{key:"f",label:"interesses fortes",estado:"preenchido",valor:"desenho, quadrinhos"}]},
           comunicacao:{label:"Comunicação",campos:[{key:"v",label:"verbal",estado:"preenchido",valor:"fala bem, lê"}]} } },

  { fase: 5, id: "5B · comunicação social + BRINCAR DE MERCADO", skill: "comunicacao", relato: DESAFIO_SOCIAL,
    nome: "Manu", idade: 6, perfil: "TEA", genero: "feminino",
    secoes: { essencial: "Manu, 6 anos. INTERESSES: brincar de mercadinho, caixa registradora de brinquedo.", comunicacao: "Fala frases completas em casa. Fora de casa quase não fala." },
    pcs: { interesses:{label:"Interesses",campos:[{key:"f",label:"interesses fortes",estado:"preenchido",valor:"brincar de mercado"}]},
           comunicacao:{label:"Comunicação",campos:[{key:"c",label:"fala em casa",estado:"preenchido",valor:"frases completas"},{key:"f",label:"fala fora de casa",estado:"vazio"}]} } },

  { fase: 5, id: "5C · MÚSICA/DANÇA", skill: "foco", relato: DESAFIO_FOCO,
    nome: "Lis", idade: 5, perfil: "TEA", genero: "feminino",
    secoes: { essencial: "Lis, 5 anos. INTERESSES: música, dançar, instrumentos.", foco: "Presta atenção mais tempo quando há música." },
    pcs: { interesses:{label:"Interesses",campos:[{key:"f",label:"interesses fortes",estado:"preenchido",valor:"música e dança"}]},
           sensorial:{label:"Sensorial",campos:[{key:"s",label:"sensibilidade a som",estado:"negativo"}]} } },

  { fase: 5, id: "5D · ESPORTE/MOVIMENTO", skill: "foco", relato: DESAFIO_FOCO,
    nome: "Théo", idade: 9, perfil: "TDAH", genero: "masculino",
    secoes: { essencial: "Théo, 9 anos. INTERESSES: futebol, skate, correr.", foco: "Só para quieto depois de gastar energia." },
    pcs: { interesses:{label:"Interesses",campos:[{key:"f",label:"interesses fortes",estado:"preenchido",valor:"futebol, skate"}]},
           comunicacao:{label:"Comunicação",campos:[{key:"v",label:"verbal",estado:"preenchido",valor:"fala bem"}]} } },

  { fase: 5, id: "5E · POUCO REPERTÓRIO CONHECIDO", skill: "foco", relato: DESAFIO_FOCO,
    nome: "Nino", idade: 6, perfil: "TEA", genero: "masculino",
    secoes: { essencial: "Nino, 6 anos." },
    pcs: { interesses:{label:"Interesses",campos:[{key:"f",label:"interesses fortes",estado:"vazio"},{key:"a",label:"aversões",estado:"vazio"}]} } },

  // ── FASE 8 · golden cases dos testes humanos ──────────────────────────
  { fase: 8, id: "8A · COMUNICAÇÃO/TIMIDEZ — criança JÁ verbal", skill: "comunicacao",
    relato: "A Manu conversa bem com a gente e com a prima, mas com gente de fora ela trava. Queria ajudar nisso.",
    nome: "Manu", idade: 6, perfil: "TEA", genero: "feminino",
    secoes: { essencial: "Manu, 6 anos. INTERESSES: brincar de mercadinho.", comunicacao: "Fala frases completas em casa e com a prima. Com desconhecidos, trava." },
    pcs: { comunicacao:{label:"Comunicação",campos:[{key:"c",label:"fala frases completas em casa",estado:"preenchido",valor:"sim"},{key:"d",label:"fala com desconhecidos",estado:"vazio"},{key:"i",label:"usa figuras/apontar",estado:"negativo"}]},
           interesses:{label:"Interesses",campos:[{key:"f",label:"interesses fortes",estado:"preenchido",valor:"mercadinho"}]} } },

  { fase: 8, id: "8B · MERCADO — objetivo ativo é fala social", skill: "comunicacao",
    relato: "Vou ao mercado com ela daqui a pouco. Como eu aproveito pra ela falar mais com outras pessoas?",
    nome: "Manu", idade: 6, perfil: "TEA", genero: "feminino",
    secoes: { essencial: "Manu, 6 anos. INTERESSES: brincar de mercadinho.", comunicacao: "Fala frases completas em casa. Com desconhecidos, trava." },
    pcs: { comunicacao:{label:"Comunicação",campos:[{key:"c",label:"fala frases completas em casa",estado:"preenchido",valor:"sim"},{key:"i",label:"usa figuras/apontar",estado:"negativo"}]},
           interesses:{label:"Interesses",campos:[{key:"f",label:"interesses fortes",estado:"preenchido",valor:"mercadinho"}]} } },

  { fase: 8, id: "8C · FOCO/LIÇÃO — relato insuficiente", skill: "foco",
    relato: "Ele se distrai, não faz o que eu peço e não faz a lição.",
    nome: "Ivo", idade: 8, perfil: "TDAH", genero: "masculino",
    secoes: { essencial: "Ivo, 8 anos. INTERESSES: desenhar." },
    pcs: { foco:{label:"Foco",campos:[{key:"g",label:"foco em atividade preferida",estado:"vazio"},{key:"t",label:"foco em tarefa não preferida",estado:"vazio"}]},
           interesses:{label:"Interesses",campos:[{key:"f",label:"interesses fortes",estado:"preenchido",valor:"desenhar"}]} } },

  { fase: 8, id: "8D · ALIMENTAÇÃO — perfil rico", skill: "nutricional",
    relato: "A alimentação da Manu me preocupa. O que dá pra fazer?",
    nome: "Manu", idade: 6, perfil: "TEA", genero: "feminino",
    secoes: { essencial: "Manu, 6 anos.", nutricional: "ACEITA: arroz branco, frango desfiado, banana, iogurte natural, pão de forma sem casca. RECUSA: qualquer coisa misturada, folhas, feijão. Não aceita alimentos que se tocam no prato." },
    pcs: { nutricional:{label:"Alimentação",campos:[{key:"a",label:"alimentos aceitos",estado:"preenchido",valor:"arroz, frango desfiado, banana, iogurte, pão sem casca"},{key:"r",label:"recusas",estado:"preenchido",valor:"misturado, folhas, feijão"},{key:"t",label:"texturas que funcionam",estado:"vazio"},{key:"p",label:"purê/pastoso",estado:"vazio"}]} } },

  { fase: 8, id: "8E · MÃE NÃO SABE EXPLICAR", skill: "comunicacao",
    relato: "Ela não conversa direito.",
    nome: "Bela", idade: 7, perfil: "TEA", genero: "feminino",
    secoes: { essencial: "Bela, 7 anos. INTERESSES: gatos." },
    pcs: { comunicacao:{label:"Comunicação",campos:[{key:"a",label:"como se comunica",estado:"vazio"},{key:"b",label:"inicia conversa",estado:"vazio"}]} } },
];

const respostas = [];
for (const c of CASOS) {
  const turno = await classificarIntencao({ supabase: supabaseStub, familyId: FAMILIA_PILOTO, texto: c.relato, historico: [], temaAnterior: null });
  const b2 = base2Real(c.skill);
  const bps = await recuperarReal({ skill: c.skill, idade: c.idade, relato: c.relato, comRanking: true });
  const ctx = ctxWeb({ nome: c.nome, idade: c.idade, perfil: c.perfil, genero: c.genero, secoes: c.secoes, perfilConsultavel: pc(c.pcs), base2: b2, bps });
  const r = await chamarWeb({ skill: c.skill, ctx, userInput: c.relato, intencao: turno.intencao, tema: turno.tema });
  respostas.push({ ...c, turno, bps: bps.map((b) => b.titulo), texto: r.texto, ch: r.texto.length, ms: r.ms });
  w(`\n${linha()}\n${c.id}\n"${c.relato}"`);
  w(`  intenção ${turno.intencao} · tema ${turno.tema ?? "-"} · BASE 2 ${b2.length} · BPs: ${bps.map((b) => b.titulo.slice(0, 38)).join(" | ")}`);
  w(`  ${r.texto.length} ch · ${r.ms} ms\n`);
  w(caixa(r.texto));
}

// ── JULGAMENTO EM LOTE, 12 critérios ─────────────────────────────────────
const CRIT = [
  "mantém o objetivo que a família trouxe, sem trocá-lo por outro",
  "usa o NÍVEL REAL da criança descrito no perfil",
  "NÃO rebaixa a habilidade (ex.: propor apontar/figuras para quem já fala frases)",
  "demonstra saber o que já conhece da criança, sem repetir de volta",
  "identifica alguma lacuna relevante do perfil",
  "só pergunta quando a resposta mudaria o caminho (ou não pergunta)",
  "ajuda mesmo quando o relato da mãe é vago, em vez de responder genérico",
  "traz orientação prática executável",
  "traz brincadeira, atividade ou treino quando isso é pertinente ao caso",
  "conversa com naturalidade, sem soar relatório",
  "EVITA receita de bolo (blocos previsíveis tipo 'o que fazer / o que observar')",
  "diferencia FATO da criança de HIPÓTESE e de EXEMPLO genérico",
];

async function julgar(lote, rotulo) {
  const sys = `Você avalia respostas de uma assistente que apoia famílias de crianças neurodivergentes.

Para CADA resposta e CADA critério responda SIM ou NAO, com justificativa de até 12 palavras citando evidência.

Critérios:
${CRIT.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Formato EXATO, uma linha por critério, repetindo o cabeçalho por resposta:
### R1
1|SIM|...
(...)
12|NAO|...
### R2
(...)

Seja rigoroso. Na dúvida, responda NAO.`;
  const user = lote.map((r, i) => `### R${i + 1}
RELATO: "${r.relato}"
PERFIL: ${Object.values(r.secoes).join(" ")}
RESPOSTA:
"""
${r.texto}
"""`).join("\n\n");
  const res = await gerarConversacional({ provider: "openai", model: MODELO_CONVERSA.openai, system: sys, messages: [{ role: "user", content: user }], maxTokens: 3000, cacheSystem: true });
  w(`\n\n${linha()}\nJULGAMENTO — ${rotulo}\n`);
  w(caixa(res.texto.trim()));
  const blocos = res.texto.split(/###\s*R\d+/).slice(1);
  return blocos.map((b) => {
    const notas = [];
    for (const l of b.split("\n")) {
      const m = l.match(/^\s*(\d+)\s*\|\s*(SIM|NAO)/i);
      if (m) notas[Number(m[1]) - 1] = m[2].toUpperCase() === "SIM";
    }
    return notas;
  });
}

const n1 = await julgar(respostas.slice(0, 5), "FASE 5 (interesses)");
const n2 = await julgar(respostas.slice(5), "FASE 8 (golden cases)");
const notas = [...n1, ...n2];

w(`\n\n${linha()}\nPLACAR — 12 critérios\n`);
w("caso".padEnd(46) + "SIM/12   critérios NAO");
notas.forEach((n, i) => {
  const nao = n.map((v, j) => (v ? null : j + 1)).filter(Boolean);
  w((respostas[i]?.id ?? "?").padEnd(46) + `${n.filter(Boolean).length}/12`.padEnd(9) + (nao.join(", ") || "-"));
});
w(`\nPOR CRITÉRIO (de ${notas.length} respostas)`);
for (let i = 0; i < CRIT.length; i++) {
  const n = notas.filter((x) => x[i]).length;
  w(`  ${String(i + 1).padStart(2)}. ${CRIT[i].slice(0, 60).padEnd(62)}${n}/${notas.length}`);
}

writeFileSync(`${process.cwd()}/docs/bancada/piloto-4a-fases-5-8-2026-08-10.txt`, out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/piloto-4a-fases-5-8-2026-08-10.txt");
