/**
 * BANCADA A/B DA EXPERIÊNCIA CONVERSACIONAL — Claude × GPT-A × GPT-B.
 *
 * NÃO TOCA PRODUÇÃO. Lê os módulos de produção (pra medir o produto que existe,
 * não uma reconstrução dele), chama os modelos, e escreve três arquivos aqui do
 * lado. Nenhum arquivo do app importa isto.
 *
 * Os três braços recebem A MESMA ENTRADA — mesmo perfil, mesmo histórico, mesma
 * fala da mãe, mesmas notas funcionais do turno. A ÚNICA variável é o system:
 *
 *   claude — prompt de produção, modelo de produção (claude-sonnet-4-6)
 *   gpt_a  — prompt de produção, traduzido só tecnicamente, no GPT
 *   gpt_b  — prompt limpo (ver regras.mjs), no MESMO GPT
 *
 *   node scripts/bancada/ab-conversa/rodar.mjs
 *   node scripts/bancada/ab-conversa/rodar.mjs --caso 04_tres_problemas
 *   node scripts/bancada/ab-conversa/rodar.mjs --so-tabela
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const WEB = resolve(RAIZ, "apps/web");

// ── env ────────────────────────────────────────────────────────────────
const envPath = resolve(WEB, ".env.local");
if (existsSync(envPath)) {
  for (const linha of readFileSync(envPath, "utf8").split("\n")) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
for (const k of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
  if (!process.env[k]) {
    console.error(`${k} ausente em apps/web/.env.local`);
    process.exit(1);
  }
}

// ── hooks pra importar TS de produção ──────────────────────────────────
const { registerHooks } = await import("node:module");
registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/"))
      return next(new URL(`../../../apps/web/src/${esp.slice(2)}.ts`, import.meta.url).href, ctx);
    if (esp.startsWith(".") && !/\.[a-z]+$/.test(esp)) {
      try {
        return next(`${esp}.ts`, ctx);
      } catch {
        /* não era .ts */
      }
    }
    if (esp === "next/headers" || esp === "next/cache")
      return {
        url: "data:text/javascript,export const cookies=()=>{throw 0};export const headers=()=>{throw 0};export const revalidatePath=()=>{};export const revalidateTag=()=>{};",
        shortCircuit: true,
      };
    return next(esp, ctx);
  },
});
const mod = (p) => import(new URL(`../../../apps/web/src/${p}`, import.meta.url).href);

const DIR = await mod("lib/conducao/diretrizes.ts");
const { nucleoConducao } = DIR;
const { formasDeEntrega, INTERESSE_COMO_VEICULO, A_CRIANCA_ANTES_DO_ROTULO } =
  await mod("lib/conducao/formas.ts");
const { FORMATO_WHATSAPP, DIRETRIZ_IDIOMA } = await mod("lib/ayla/responder.ts");
const { buildSystemTextConversa } = await mod("lib/ia/prompt.ts");

const { CASOS } = await import(new URL("./casos.mjs", import.meta.url).href);
const { promptB, tabela, INVENTARIO } = await import(new URL("./regras.mjs", import.meta.url).href);

// ── modelos ────────────────────────────────────────────────────────────
const MODELO_CLAUDE = process.env.ANTHROPIC_MODEL_PRINCIPAL || "claude-sonnet-4-6";
/**
 * ESCOLHA DO MODELO OPENAI — registrada com a medição que a produziu.
 *
 * Disponíveis na chave da Kolo: 124 modelos, incluindo gpt-5.6-{luna,sol,terra},
 * gpt-5.5, gpt-5.4, gpt-5.2, gpt-4.1, o3/o4-mini.
 *
 * Sondados sob o prompt REAL da Kolo (13.058 tokens de entrada, caso "quatro
 * frentes de uma vez"), não sob um prompt de brinquedo:
 *
 *   gpt-5.6-luna    10.5s   933 out (512 raciocínio)   307 palavras   0 perguntas
 *   gpt-5.6-terra   13.2s   869 out (427 raciocínio)   314 palavras   1 pergunta
 *   gpt-5.6-sol     26.0s  1030 out (661 raciocínio)   261 palavras   0 perguntas
 *   gpt-5.5         29.3s  1106 out (512 raciocínio)   392 palavras   1 pergunta
 *
 * Escolhido gpt-5.6-luna: é a geração mais nova disponível, aguentou o prompt
 * inteiro sem se perder, e é 2,5× mais rápido que os outros da mesma família —
 * o que importa num produto de chat, onde a mãe espera olhando a tela. Os
 * quatro produziram o comportamento certo neste caso; a diferença foi latência.
 * Nenhum modelo antigo (4o, 4.1) foi considerado: seriam um teste injusto.
 */
const MODELO_GPT = "gpt-5.6-luna";

// ── clientes ───────────────────────────────────────────────────────────
async function chamarClaude({ system, messages, cache }) {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO_CLAUDE,
      max_tokens: 1400,
      // Espelha produção: o system é cacheado. Sem isto o custo medido do
      // Claude fica ~4x acima do real.
      system: [{ type: "text", text: system, ...(cache ? { cache_control: { type: "ephemeral" } } : {}) }],
      messages,
    }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`anthropic: ${j.error.message}`);
  return {
    texto: j.content.filter((b) => b.type === "text").map((b) => b.text).join(""),
    ms: Date.now() - t0,
    in: j.usage.input_tokens,
    out: j.usage.output_tokens,
    cache_read: j.usage.cache_read_input_tokens ?? 0,
    cache_write: j.usage.cache_creation_input_tokens ?? 0,
  };
}

async function chamarGPT({ system, messages }) {
  const t0 = Date.now();
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO_GPT,
      max_completion_tokens: 3000,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`openai: ${j.error.message}`);
  return {
    texto: j.choices[0].message.content ?? "",
    ms: Date.now() - t0,
    in: j.usage.prompt_tokens,
    out: j.usage.completion_tokens,
    raciocinio: j.usage.completion_tokens_details?.reasoning_tokens ?? 0,
    // O cache da OpenAI é automático — não se marca, mas se mede.
    cache_read: j.usage.prompt_tokens_details?.cached_tokens ?? 0,
    cache_write: 0,
  };
}

const comRetentativa = async (fn, quantas = 3) => {
  for (let i = 0; i < quantas; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === quantas - 1) throw e;
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
};

// ══════════════════════════════════════════════════════════════════════
// MONTAGEM — a entrada é UMA só; o system é o que varia
// ══════════════════════════════════════════════════════════════════════

/** System de produção do WhatsApp — cópia fiel de `gerarUmaVez` (responder.ts). */
function systemWhatsAppProd(caso) {
  const entrega = caso.entrega && !caso.querPlano;
  return [
    nucleoConducao(),
    FORMATO_WHATSAPP,
    ...(entrega
      ? [formasDeEntrega({ canal: "whatsapp", tema: caso.tema }), INTERESSE_COMO_VEICULO, A_CRIANCA_ANTES_DO_ROTULO]
      : []),
    DIRETRIZ_IDIOMA,
  ].join("\n\n");
}

/**
 * System de produção da web — a FUNÇÃO REAL, desde 06/08/2026.
 *
 * Antes esta bancada reconstruía o prompt da web à mão, e a reconstrução
 * ficou desatualizada no instante em que o teto de 120 palavras saiu.
 * Bancada que remonta o prompt mede um produto que não existe.
 */
function systemWebProd(caso) {
  const skills = [
    {
      display_name: "Desenvolvimento e comportamento",
      objective: "ajudar a família a compreender e apoiar a criança no dia a dia",
      tone: "próximo, prático, sem jargão",
      scope: "rotina, regulação, comunicação, aprendizagem, autonomia",
      limits: "não diagnostica, não prescreve",
    },
  ];
  return buildSystemTextConversa(skills, caso.intencao, caso.tema ?? null);
}

/**
 * AS MENSAGENS — idênticas nos três braços.
 *
 * As NOTAS FUNCIONAIS (o que ela aceitou, o pedido de plano) entram aqui e não
 * no system, porque são fato do turno e os três precisam delas. As notas de
 * ESTILO do responder ("REGRA DESTE TURNO") entram só nos braços que carregam
 * o prompt de produção — e isso está declarado na tabela do GPT-B.
 */
function montarMensagens(caso, { comNotasDeEstilo }) {
  const nome = caso.crianca;
  const linhas = [];

  if (caso.canal === "whatsapp") {
    linhas.push(`Você está falando com a mãe de ${nome}.`);
    linhas.push(`Em foco: ${nome}.`);
    linhas.push(`\n<o_que_ja_sabemos_da_crianca>\n${caso.perfil}\n</o_que_ja_sabemos_da_crianca>`);
    if (caso.historico?.length) {
      const h = caso.historico.map((t) => `${t.de === "mae" ? "Mãe" : "Ayla"}: ${t.texto}`).join("\n");
      linhas.push(`\n<conversa_recente>\n${h}\n</conversa_recente>`);
    }
    linhas.push(`\n<mensagem_de_agora>\n${caso.msg}\n</mensagem_de_agora>`);

    const notas = [];
    // FUNCIONAIS — vão nos três.
    if (caso.aceite)
      notas.push(
        `ELA ESTÁ ACEITANDO O QUE VOCÊ OFERECEU no seu último turno: ${caso.aceite}. FAÇA ISSO AGORA, neste turno. Não reabra o assunto geral da conversa, não peça pra ela repetir o pedido, não pergunte de novo o que você já sabe. Se for algo que ela faz no app, mande o link direto e diga o que ela vai encontrar lá; se for algo seu, entregue. Se faltar UM dado sem o qual não dá pra fazer, pergunte SÓ esse dado.
HISTÓRIA é um destes casos: quem monta é ela, no app, e é rápido — você manda o link de Histórias, diz que o tema já vai do jeito que vocês combinaram aqui, e conta que dá pra criar o avatar pra criança virar o personagem. Não descreva a história inteira no WhatsApp nem prometa gerar você mesma. (Link de Histórias: https://app.kolofamilia.com.br/historias/criar)`,
      );
    if (caso.querPlano)
      notas.push(
        `A pessoa está PEDINDO um plano. NÃO escreva o plano aqui no WhatsApp — quem entrega o plano é o SISTEMA, numa mensagem própria logo depois desta. Nesta mensagem não mande link nem anuncie o PDF.`,
      );
    // DE ESTILO — só nos braços de produção.
    if (comNotasDeEstilo) {
      notas.push(
        `ANCORE no que está sendo falado AGORA (a <mensagem_de_agora> + a <conversa_recente>), como alguém atenta à conversa. NÃO puxe por conta própria um assunto guardado no perfil que ninguém trouxe agora.`,
      );
      notas.push(
        `REGRA DESTE TURNO: a mãe tem que sair daqui com algo concreto. Se já existe uma primeira orientação SEGURA, ENTREGUE agora; a pergunta vem junto ou depois. No máximo UMA pergunta, e só se a resposta MUDAR o seu próximo passo. Se ela trouxe MAIS DE UMA dificuldade, organize, escolha UMA pra começar (dizendo por que aquela), dê a direção JÁ nesta resposta e deixe as outras explicitamente pra depois.`,
      );
      if (!caso.querPlano)
        notas.push(
          `QUANDO OFERECER UM PLANO — e quando NÃO. Primeiro tenha uma conversa rica. O plano só vale quando faz sentido trabalhar algo com estrutura, e só depois de já ter entendido o suficiente. Se o momento é de conversa que já vale por si, NÃO force um plano. Quando fizer sentido, ofereça UMA vez, de leve, no fim, e nunca como "um plano" seco: diga "um plano estratégico com atividades pro ${nome}".`,
        );
    }
    if (notas.length) linhas.push(`\n<notas_internas>\n${notas.join("\n")}\n</notas_internas>`);
    linhas.push(`\nResponda como a Ayla.`);
    return [{ role: "user", content: linhas.join("\n") }];
  }

  // WEB — buildContextBlock + histórico como turnos reais
  const contexto = `<cuidador>
Você está falando com a mãe de ${nome}.
</cuidador>

<membro_atipico>
${caso.perfil}
</membro_atipico>`;
  const msgs = [];
  for (const t of caso.historico ?? [])
    msgs.push({ role: t.de === "mae" ? "user" : "assistant", content: t.texto });
  msgs.push({ role: "user", content: `${contexto}\n\n<mensagem_da_mae>\n${caso.msg}\n</mensagem_da_mae>` });
  return msgs;
}

// ══════════════════════════════════════════════════════════════════════
// MÉTRICAS
// ══════════════════════════════════════════════════════════════════════

const palavras = (t) => t.trim().split(/\s+/).filter(Boolean).length;
/** Perguntas de verdade: "?" que fecha frase. Não conta "?" dentro de citação curta. */
const perguntas = (t) => (t.match(/\?/g) || []).length;

/**
 * ENTREGOU AJUDA CONCRETA NESTE TURNO? — a métrica que vira "turnos até ajuda".
 *
 * Pergunta BINÁRIA e estreita de propósito: juiz instável foi limitação
 * metodológica registrada nesta base (04/08). Binária e específica varia muito
 * menos que nota de 1 a 5. Dois juízes de FAMÍLIAS DIFERENTES, porque um juiz
 * Claude avaliando GPT (e vice-versa) tem viés óbvio; quando os dois concordam,
 * o viés não explica o resultado.
 */
const PERGUNTA_JUIZ = `Você recebe UMA resposta de uma assistente para uma mãe de criança neurodivergente.

Responda SÓ "sim" ou "nao".

sim = a resposta contém pelo menos UMA ação concreta que a mãe consegue executar hoje: algo para FAZER, uma FRASE pronta para dizer, algo específico para OBSERVAR, ou um teste combinado.
nao = a resposta só acolhe, só explica, só pergunta, ou só oferece fazer algo depois.

"Mantenha o limite", "seja previsível", "acolha a frustração" NÃO contam: são rótulos, não ações.`;

async function juizClaude(texto) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 5,
      system: PERGUNTA_JUIZ,
      messages: [{ role: "user", content: texto.slice(0, 6000) }],
    }),
  });
  const j = await r.json();
  const t = (j.content?.[0]?.text ?? "").toLowerCase();
  return t.includes("sim");
}

async function juizGPT(texto) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      max_completion_tokens: 10,
      messages: [
        { role: "system", content: PERGUNTA_JUIZ },
        { role: "user", content: texto.slice(0, 6000) },
      ],
    }),
  });
  const j = await r.json();
  return (j.choices?.[0]?.message?.content ?? "").toLowerCase().includes("sim");
}

/** Preço por milhão de tokens. Claude vem da PRICE_TABLE da Kolo. */
const PRECOS = {
  "claude-sonnet-4-6": { in: 3.0, out: 15.0, cache_read: 0.3, cache_write: 3.75 },
  // ⚠️ A Kolo não tem preço publicado deste modelo na sua PRICE_TABLE. Deixado
  // null de propósito: inventar um número aqui contaminaria a decisão de custo.
  // Os TOKENS são medidos e ficam no JSON — a conta é uma multiplicação.
  "gpt-5.6-luna": null,
};

function custo(modelo, u) {
  const p = PRECOS[modelo];
  if (!p) return null;
  const entradaNova = (u.in ?? 0) - (u.cache_read ?? 0) - (u.cache_write ?? 0);
  return (
    (Math.max(0, entradaNova) * p.in +
      (u.cache_read ?? 0) * p.cache_read +
      (u.cache_write ?? 0) * p.cache_write +
      (u.out ?? 0) * p.out) /
    1_000_000
  );
}

// ══════════════════════════════════════════════════════════════════════
// EXECUÇÃO
// ══════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const soUm = args.includes("--caso") ? args[args.indexOf("--caso") + 1] : null;
const soTabela = args.includes("--so-tabela");
const soClaude = args.includes("--so-claude");
// Repetição: a diferença entre duas execuções das MESMAS 20 entradas foi maior
// que a diferença entre dois braços. Uma rodada não é evidência.
const rodada = args.includes("--rodada") ? args[args.indexOf("--rodada") + 1] : null;
const arq = rodada ? `resultados-${rodada}.json` : "resultados.json";

/**
 * Embaralhamento DETERMINÍSTICO e BALANCEADO.
 *
 * Um hash por id parece mais "aleatório" e não é: na primeira versão o Claude
 * caiu em 1º lugar em 9 dos 20 casos e em último em 2. Quem pontua 60 respostas
 * seguidas tem viés de posição, então a posição não pode correlacionar com o
 * braço. Aqui as 6 permutações se revezam pelo índice do caso — cada braço
 * ocupa cada posição 6 ou 7 vezes.
 */
const PERMUTACOES = [
  ["claude", "gpt_a", "gpt_b"],
  ["gpt_a", "gpt_b", "claude"],
  ["gpt_b", "claude", "gpt_a"],
  ["claude", "gpt_b", "gpt_a"],
  ["gpt_b", "gpt_a", "claude"],
  ["gpt_a", "claude", "gpt_b"],
];
function ordemCega(_id, indice) {
  return PERMUTACOES[indice % PERMUTACOES.length];
}

async function rodarCaso(caso) {
  const systemProd = caso.canal === "whatsapp" ? systemWhatsAppProd(caso) : systemWebProd(caso);
  const systemB = promptB(DIR, { canal: caso.canal });
  const msgsProd = montarMensagens(caso, { comNotasDeEstilo: true });
  const msgsB = montarMensagens(caso, { comNotasDeEstilo: false });

  const [claude, gptA, gptB] = soClaude
    ? [await comRetentativa(() => chamarClaude({ system: systemProd, messages: msgsProd, cache: true })), null, null]
    : await Promise.all([
        comRetentativa(() => chamarClaude({ system: systemProd, messages: msgsProd, cache: true })),
        comRetentativa(() => chamarGPT({ system: systemProd, messages: msgsProd })),
        comRetentativa(() => chamarGPT({ system: systemB, messages: msgsB })),
      ]);

  const braços = soClaude ? { claude } : { claude, gpt_a: gptA, gpt_b: gptB };
  const saida = {};
  for (const [k, r] of Object.entries(braços)) {
    const [jc, jg] = await Promise.all([
      comRetentativa(() => juizClaude(r.texto)),
      comRetentativa(() => juizGPT(r.texto)),
    ]);
    saida[k] = {
      texto: r.texto,
      metricas: {
        palavras: palavras(r.texto),
        perguntas: perguntas(r.texto),
        ajuda_concreta_juiz_claude: jc,
        ajuda_concreta_juiz_gpt: jg,
        ajuda_concreta_consenso: jc === jg ? jc : null,
        latencia_ms: r.ms,
        tokens_in: r.in,
        tokens_out: r.out,
        tokens_raciocinio: r.raciocinio ?? 0,
        cache_read: r.cache_read ?? 0,
        cache_write: r.cache_write ?? 0,
        custo_usd: custo(k === "claude" ? MODELO_CLAUDE : MODELO_GPT, r),
      },
    };
  }
  return {
    id: caso.id,
    titulo: caso.titulo,
    canal: caso.canal,
    crianca: caso.crianca,
    perfil: caso.perfil,
    historico: caso.historico ?? [],
    msg: caso.msg,
    olhar: caso.olhar,
    ordem_cega: ordemCega(caso.id),
    tamanho_system: { producao: systemProd.length, limpo: systemB.length },
    respostas: saida,
  };
}

// ── tabela de regras (sempre escrita) ──────────────────────────────────
const linhasTabela = tabela();
const md = [
  "# GPT-B — o que foi mantido, reescrito e removido",
  "",
  "Gerado por `regras.mjs`. A tabela e o prompt saem do MESMO array — não há como divergirem.",
  "",
  `Prompt de produção: **${systemWhatsAppProd(CASOS[3]).length.toLocaleString("pt-BR")} caracteres** (~${Math.round(systemWhatsAppProd(CASOS[3]).length / 4).toLocaleString("pt-BR")} tokens).`,
  `Prompt do GPT-B: **${promptB(DIR, { canal: "whatsapp" }).length.toLocaleString("pt-BR")} caracteres** (~${Math.round(promptB(DIR, { canal: "whatsapp" }).length / 4).toLocaleString("pt-BR")} tokens).`,
  "",
  "| Regra | Por que existe | Classe | No GPT-B | Justificativa |",
  "|---|---|---|---|---|",
  ...linhasTabela.map(
    (l) =>
      `| ${l.regra.replace(/\|/g, "\\|")} | ${l.porque.replace(/\|/g, "\\|")} | ${l.classe} | **${l.noB}** | ${l.justificativa.replace(/\|/g, "\\|")} |`,
  ),
].join("\n");
writeFileSync(resolve(AQUI, "regras-gpt-b.md"), md, "utf8");
console.log(`✓ regras-gpt-b.md — ${linhasTabela.length} regras inventariadas`);
if (soTabela) process.exit(0);

// ── roda ───────────────────────────────────────────────────────────────
const lista = soUm ? CASOS.filter((c) => c.id === soUm) : CASOS;
console.log(`\nClaude: ${MODELO_CLAUDE}   |   GPT: ${MODELO_GPT}   |   ${lista.length} casos × 3 braços\n`);

const resultados = [];
for (const [i, caso] of lista.entries()) {
  process.stdout.write(`[${i + 1}/${lista.length}] ${caso.id} … `);
  try {
    const r = await rodarCaso(caso);
    resultados.push(r);
    const m = r.respostas;
    console.log(
      `ok  claude ${m.claude.metricas.palavras}p/${m.claude.metricas.perguntas}?  ` +
        (soClaude
          ? ""
          : `gptA ${m.gpt_a.metricas.palavras}p/${m.gpt_a.metricas.perguntas}?  ` +
            `gptB ${m.gpt_b.metricas.palavras}p/${m.gpt_b.metricas.perguntas}?`),
    );
  } catch (e) {
    console.log(`FALHOU: ${e.message}`);
  }
}

writeFileSync(
  resolve(AQUI, arq),
  JSON.stringify(
    { gerado_em: new Date().toISOString(), modelo_claude: MODELO_CLAUDE, modelo_gpt: MODELO_GPT, casos: resultados },
    null,
    2,
  ),
  "utf8",
);
console.log(`\n✓ resultados.json — ${resultados.length} casos`);

// ── agregado ───────────────────────────────────────────────────────────
const agg = (k, f) => {
  const vs = resultados.map((r) => f(r.respostas[k].metricas)).filter((v) => v != null);
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0;
};
console.log("\n" + "═".repeat(78));
console.log("MÉTRICAS AUTOMÁTICAS (média por resposta)");
console.log("═".repeat(78));
console.log(
  ["braço", "palavras", "perguntas", "ajuda?", "latência", "in", "out", "US$/1k"].map((s) => s.padEnd(10)).join(""),
);
for (const k of soClaude ? ["claude"] : ["claude", "gpt_a", "gpt_b"]) {
  const sim = resultados.filter((r) => r.respostas[k].metricas.ajuda_concreta_consenso === true).length;
  const disc = resultados.filter((r) => r.respostas[k].metricas.ajuda_concreta_consenso === null).length;
  const c = agg(k, (m) => m.custo_usd);
  console.log(
    [
      k,
      agg(k, (m) => m.palavras).toFixed(0),
      agg(k, (m) => m.perguntas).toFixed(1),
      `${sim}/${resultados.length}${disc ? `(${disc}?)` : ""}`,
      `${(agg(k, (m) => m.latencia_ms) / 1000).toFixed(1)}s`,
      agg(k, (m) => m.tokens_in).toFixed(0),
      agg(k, (m) => m.tokens_out).toFixed(0),
      c ? (c * 1000).toFixed(2) : "—",
    ]
      .map((s) => String(s).padEnd(10))
      .join(""),
  );
}
console.log("\n'ajuda?' = os DOIS juízes concordaram que há ação concreta. (n?) = discordaram.");
console.log("US$/1k = custo de mil respostas. '—' = a Kolo não tem preço publicado deste modelo.");

// ── tela de avaliação cega ─────────────────────────────────────────────
// Só faz sentido com os três braços: comparar às cegas exige o que comparar.
if (!soClaude) {
const { gerarHtml } = await import(new URL("./tela.mjs", import.meta.url).href);
writeFileSync(resolve(AQUI, "avaliacao-cega.html"), gerarHtml(resultados), "utf8");
console.log(`\n✓ avaliacao-cega.html — abra no navegador para pontuar`);
}
