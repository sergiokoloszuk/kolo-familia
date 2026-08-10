/**
 * ABLAÇÃO DIRIGIDA — fecha (ou não) os critérios 6 e 7 do portão do piloto.
 *
 * O caso é o GOLDEN CASE DE SONO da própria BASE 2: um relato construído para
 * comportar cinco bifurcações concorrentes. É o caso em que a camada de
 * compreensão, se serve para alguma coisa, TEM que aparecer.
 *
 * DOIS BRAÇOS, e nada mais muda entre eles:
 *   A · BASE 2 presente + ranking por aderência
 *   B · sem BASE 2 + recuperação antiga (3 BPs por peso)
 *
 * 3 execuções por braço. Julgamento por MODELO, com 10 critérios explícitos e
 * CEGO — o juiz não sabe de qual braço veio a resposta, e as respostas são
 * embaralhadas antes de julgar. Sem regex: regex mede sintaxe, e o que está em
 * questão é raciocínio.
 *
 *   node scripts/bancada/piloto-4a/ablacao-dirigida.mjs
 */
import {
  mod, chamarWeb, ctxWeb, perfilSintetico, recuperarReal, base2Real,
  supabaseStub, FAMILIA_PILOTO, linha, caixa,
} from "./comum.mjs";
import { writeFileSync } from "node:fs";

const { classificarIntencao } = await mod("lib/ia/intencao.ts");
const out = [];
const w = (s) => { out.push(s); console.log(s); };

/** O relato do golden case, verbatim de `docs/skills/sono.md`. */
const RELATO =
  "Ele demora para dormir, me chama várias vezes, às vezes diz que está com medo, pede água, quer ir ao banheiro; eu fico até ele dormir porque, se saio, ele levanta.";

const SKILL = "sono";

/** Perfil sintético IDÊNTICO nos dois braços. */
const CRIANCA = {
  nome: "Nina", idade: 6, perfil: "TEA", genero: "feminino",
  secoes: {
    essencial: "Nina, 6 anos. INTERESSES: gatos e histórias.",
    sono: "Dorme no quarto dela. A mãe fica ao lado até adormecer.",
  },
  perfilConsultavel: perfilSintetico({
    sono: { label: "Sono", campos: [
      { key: "onde", label: "onde dorme", estado: "preenchido", valor: "no quarto dela, mãe ao lado" },
      { key: "noite", label: "como é o resto da noite", estado: "vazio" },
      { key: "conteudo_medo", label: "conteúdo do medo", estado: "vazio" },
    ]},
    sensorial: { label: "Sensorial", campos: [
      { key: "som", label: "sensibilidade a som", estado: "negativo" },
    ]},
    interesses: { label: "Interesses", campos: [
      { key: "fortes", label: "interesses fortes", estado: "preenchido", valor: "gatos e histórias" },
    ]},
  }),
};

const turno = await classificarIntencao({
  supabase: supabaseStub, familyId: FAMILIA_PILOTO, texto: RELATO, historico: [], temaAnterior: null,
});

const b2 = base2Real(SKILL);
const bpsA = await recuperarReal({ skill: SKILL, idade: 6, relato: RELATO, comRanking: true });
const bpsB = await recuperarReal({ skill: SKILL, idade: 6, relato: RELATO, comRanking: false });

w(`ABLAÇÃO DIRIGIDA · golden case de SONO · critérios 6 e 7`);
w(`relato: "${RELATO}"`);
w(`intenção ${turno.intencao} · tema ${turno.tema ?? "-"}\n`);
w(`BRAÇO A · BASE 2: ${b2.length} seções (${b2.map((s) => s.titulo.slice(0, 38)).join(" | ")})`);
w(`BRAÇO A · BPs (ranking): ${bpsA.map((b) => b.titulo.slice(0, 60)).join("\n                         ")}`);
w(`\nBRAÇO B · BASE 2: nenhuma`);
w(`BRAÇO B · BPs (peso, antigo): ${bpsB.map((b) => b.titulo.slice(0, 60)).join("\n                              ")}`);
w(`\nBPs em comum entre os braços: ${bpsA.filter((a) => bpsB.some((b) => b.titulo === a.titulo)).length} de ${bpsA.length}\n`);

const BRACOS = [
  { arm: "A", base2: b2, bps: bpsA },
  { arm: "B", base2: [], bps: bpsB },
];

const execucoes = [];
for (const b of BRACOS) {
  for (let i = 1; i <= 3; i++) {
    const ctx = ctxWeb({ ...CRIANCA, base2: b.base2, bps: b.bps });
    const r = await chamarWeb({
      skill: SKILL, ctx, userInput: RELATO, intencao: turno.intencao, tema: turno.tema,
    });
    execucoes.push({ arm: b.arm, run: i, texto: r.texto, ch: r.texto.length, ms: r.ms, tokensIn: r.tokensIn, tokensOut: r.tokensOut });
    w(`\n${linha()}\nBRAÇO ${b.arm} · execução ${i} · ${r.texto.length} ch · ${r.ms} ms\n`);
    w(caixa(r.texto));
  }
}

// ── JULGAMENTO CEGO, por critério explícito ───────────────────────────────
const CRITERIOS = [
  "reconhece que o relato comporta HIPÓTESES CONCORRENTES (mais de uma explicação possível para o mesmo relato)",
  "EVITA escolher cedo demais uma única explicação",
  "identifica corretamente a BIFURCAÇÃO PRINCIPAL (o que separa os caminhos: conteúdo do medo × necessidade da presença × como é o resto da noite)",
  "faz UMA pergunta de alto valor, quando ela muda a conduta",
  "EVITA perguntas redundantes ou em excesso",
  "usa informação que já está no perfil (dorme no quarto dela, mãe fica ao lado, interesses)",
  "orienta com algo executável hoje, sem esperar ter todas as respostas",
  "as boas práticas usadas são aderentes a ESTE caso (início do sono com presença do adulto), não a sono em geral",
  "a orientação final é específica deste caso, não intercambiável com qualquer criança",
  "EVITA explicação genérica de higiene do sono (tela, horário fixo, ritual padrão) como resposta principal",
];

const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const MODELO_JUIZ = MODELO_CONVERSA.openai;

/** Embaralha com semente fixa — reprodutível e sem `Math.random`. */
const ordem = [0, 3, 1, 4, 2, 5];
const cegas = ordem.map((i, n) => ({ rotulo: `RESPOSTA_${n + 1}`, ...execucoes[i] }));

w(`\n\n${linha()}\nJULGAMENTO CEGO · ${MODELO_JUIZ} · 10 critérios · o juiz não sabe o braço\n`);

const notas = [];
for (const c of cegas) {
  const sys = `Você avalia respostas de uma assistente que apoia famílias de crianças neurodivergentes.

Avalie a resposta abaixo contra CADA critério, de forma independente. Para cada um responda SIM ou NAO, e uma justificativa de no máximo 12 palavras citando a evidência no texto.

Critérios:
${CRITERIOS.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Responda APENAS neste formato, uma linha por critério:
1|SIM|justificativa
2|NAO|justificativa
(...)
10|SIM|justificativa

Seja rigoroso. Na dúvida entre SIM e NAO, responda NAO.`;

  const user = `RELATO DA MÃE:\n"${RELATO}"\n\nO QUE JÁ SE SABE DA CRIANÇA:\nNina, 6 anos. Dorme no quarto dela, a mãe fica ao lado até adormecer. Interesses: gatos e histórias. NÃO se sabe: o conteúdo do medo, nem como é o resto da noite.\n\nRESPOSTA A AVALIAR:\n"""\n${c.texto}\n"""`;

  const r = await gerarConversacional({
    provider: "openai", model: MODELO_JUIZ, system: sys,
    messages: [{ role: "user", content: user }], maxTokens: 900, cacheSystem: true,
  });
  const linhas = r.texto.trim().split("\n").filter((l) => /^\d+\|/.test(l));
  const simNao = linhas.map((l) => l.split("|")[1]?.trim().toUpperCase().startsWith("S"));
  notas.push({ ...c, simNao, bruto: r.texto.trim() });
  w(`\n── ${c.rotulo} (braço oculto) · ${simNao.filter(Boolean).length}/10 SIM`);
  w(caixa(r.texto.trim()));
}

// ── ABERTURA DO CEGO ─────────────────────────────────────────────────────
w(`\n\n${linha()}\nABERTURA — qual rótulo era qual braço\n`);
w("rótulo".padEnd(14) + "braço".padEnd(8) + "exec".padEnd(6) + "SIM/10".padEnd(9) + "critérios NAO");
for (const n of notas) {
  const nao = n.simNao.map((v, i) => (v ? null : i + 1)).filter(Boolean);
  w(n.rotulo.padEnd(14) + n.arm.padEnd(8) + String(n.run).padEnd(6) +
    `${n.simNao.filter(Boolean).length}/10`.padEnd(9) + (nao.join(", ") || "-"));
}

const porBraco = (arm) => notas.filter((n) => n.arm === arm);
const media = (arm) => {
  const ns = porBraco(arm);
  return ns.reduce((a, n) => a + n.simNao.filter(Boolean).length, 0) / ns.length;
};
w(`\nMÉDIA DE CRITÉRIOS ATENDIDOS`);
w(`  BRAÇO A (4A completa) ....... ${media("A").toFixed(1)}/10`);
w(`  BRAÇO B (sem BASE 2, BP antiga) ${media("B").toFixed(1)}/10`);

w(`\nPOR CRITÉRIO (quantas das 3 execuções de cada braço atenderam)`);
w("critério".padEnd(6) + "A".padEnd(5) + "B".padEnd(5) + "descrição");
for (let i = 0; i < CRITERIOS.length; i++) {
  const a = porBraco("A").filter((n) => n.simNao[i]).length;
  const b = porBraco("B").filter((n) => n.simNao[i]).length;
  const marca = a > b ? "  ← A" : b > a ? "  ← B" : "";
  w(String(i + 1).padEnd(6) + `${a}/3`.padEnd(5) + `${b}/3`.padEnd(5) + CRITERIOS[i].slice(0, 62) + marca);
}

const c6 = [1, 2, 3, 4, 5]; // raciocínio diferencial → BASE 2
const c7 = [8, 9, 10];      // aderência das BPs e da orientação → ranking
const soma = (arm, idx) => idx.reduce((a, i) => a + porBraco(arm).filter((n) => n.simNao[i - 1]).length, 0);
w(`\nCRITÉRIO 6 · raciocínio diferencial (itens 1-5): A ${soma("A", c6)}/15 × B ${soma("B", c6)}/15`);
w(`CRITÉRIO 7 · aderência (itens 8-10): A ${soma("A", c7)}/9 × B ${soma("B", c7)}/9`);

writeFileSync(`${process.cwd()}/docs/bancada/piloto-4a-ablacao-dirigida-2026-08-10.txt`, out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/piloto-4a-ablacao-dirigida-2026-08-10.txt");
