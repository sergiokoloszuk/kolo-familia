/**
 * BANCADA MULTITURNO — Claude × GPT na camada conversacional.
 *
 * 4 jornadas × 2 canais × 2 braços × 3 rodadas.
 *
 * ⚠️ HISTÓRICO INDEPENDENTE POR BRAÇO. Claude responde ao que o Claude disse;
 * GPT ao que o GPT disse. Replicar as falas de um braço no outro mediria o
 * modelo respondendo a uma conversa que ele não conduziu.
 *
 * Persiste depois de CADA rodada: uma parada no meio não perde o que já rodou.
 *
 *   node scripts/bancada/multiturno/rodar.mjs            (3 rodadas)
 *   node scripts/bancada/multiturno/rodar.mjs --rodadas 1
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(AQUI, "../../../apps/web");

for (const l of readFileSync(resolve(WEB, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

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

// ── módulos REAIS de produção ──────────────────────────────────────────
const { nucleoConducao } = await mod("lib/conducao/diretrizes.ts");
const { formasDeEntrega, INTERESSE_COMO_VEICULO, A_CRIANCA_ANTES_DO_ROTULO } =
  await mod("lib/conducao/formas.ts");
const { FORMATO_WHATSAPP, DIRETRIZ_IDIOMA } = await mod("lib/ayla/responder.ts");
const { buildSystemTextConversa } = await mod("lib/ia/prompt.ts");
const { fronteiraAtravessada } = await mod("lib/conducao/fronteiras.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const { calcularCustoTokens } = await mod("lib/billing/prices.ts");
const { JORNADAS, CANAIS, SINAIS } = await import(
  new URL("./jornadas.mjs", import.meta.url).href
);

const SKILL = [
  {
    display_name: "Desenvolvimento e comportamento",
    objective: "ajudar a família a compreender e apoiar a criança no dia a dia",
    tone: "próximo, prático, sem jargão",
    scope: "rotina, regulação, comunicação, aprendizagem, autonomia",
    limits: "não diagnostica, não prescreve",
  },
];

/** System do canal — funções REAIS, sem cópia manual de prompt. */
function systemDoCanal(canal, j) {
  if (canal === "whatsapp") {
    return [
      nucleoConducao(),
      FORMATO_WHATSAPP,
      ...(j.entrega
        ? [
            formasDeEntrega({ canal: "whatsapp", tema: j.tema ?? null }),
            INTERESSE_COMO_VEICULO,
            A_CRIANCA_ANTES_DO_ROTULO,
          ]
        : []),
      DIRETRIZ_IDIOMA,
    ].join("\n\n");
  }
  return buildSystemTextConversa(SKILL, j.intencao, j.tema ?? null);
}

/**
 * As mensagens do turno. IDÊNTICAS entre os braços dado o mesmo histórico —
 * o que difere é o histórico, que cada braço construiu.
 */
function montarMensagens(canal, { crianca, perfil, historico, fala }) {
  if (canal === "whatsapp") {
    const linhas = [
      `Você está falando com a mãe de ${crianca}.`,
      `Em foco: ${crianca}.`,
      `\n<o_que_ja_sabemos_da_crianca>\n${perfil}\n</o_que_ja_sabemos_da_crianca>`,
    ];
    if (historico.length) {
      const h = historico
        .map((t) => `${t.de === "mae" ? "Mãe" : "Ayla"}: ${t.texto}`)
        .join("\n");
      linhas.push(`\n<conversa_recente>\n${h}\n</conversa_recente>`);
    }
    linhas.push(`\n<mensagem_de_agora>\n${fala}\n</mensagem_de_agora>`);
    linhas.push(`\nResponda como a Ayla.`);
    return [{ role: "user", content: linhas.join("\n") }];
  }
  const ctx = `<cuidador>\nVocê está falando com a mãe de ${crianca}.\n</cuidador>\n\n<membro_atipico>\n${perfil}\n</membro_atipico>`;
  const msgs = historico.map((t) => ({
    role: t.de === "mae" ? "user" : "assistant",
    content: t.texto,
  }));
  msgs.push({ role: "user", content: `${ctx}\n\n<mensagem_da_mae>\n${fala}\n</mensagem_da_mae>` });
  return msgs;
}

// ── sinais objetivos ───────────────────────────────────────────────────
const perguntas = (t) => (t.match(/\?/g) || []).length;
const palavras = (t) => t.trim().split(/\s+/).filter(Boolean).length;

/** Traços EXCLUSIVOS de cada criança da J3 — contaminação é objetiva. */
const TRACOS = {
  Yuri: [/\b6 anos\b/i, /dinossauro/i, /seletiv/i, /molho/i, /\bTEA\b|autis/i],
  "Renan Pietro": [/\b9 anos\b/i, /futebol/i, /minecraft/i, /\bTDAH\b/i],
};

/** Repetição quase literal: trecho de 8+ palavras que já apareceu antes. */
function repetiu(texto, anteriores) {
  const norm = (s) =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ");
  const alvo = norm(texto).split(" ");
  for (const a of anteriores) {
    const base = norm(a);
    for (let i = 0; i + 8 <= alvo.length; i++) {
      if (base.includes(alvo.slice(i, i + 8).join(" "))) return true;
    }
  }
  return false;
}

const comRetentativa = async (fn, quantas = 4) => {
  let ultimo;
  for (let i = 0; i < quantas; i++) {
    try {
      return { r: await fn(), falhas: i };
    } catch (e) {
      ultimo = e;
      await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
    }
  }
  throw ultimo;
};

// ══════════════════════════════════════════════════════════════════════
const args = process.argv.slice(2);
const RODADAS = args.includes("--rodadas") ? Number(args[args.indexOf("--rodadas") + 1]) : 3;
const BRACOS = [
  { id: "claude", provider: "anthropic", model: MODELO_CONVERSA.anthropic },
  { id: "gpt", provider: "openai", model: MODELO_CONVERSA.openai },
];

const turnosTotais = JORNADAS.reduce((a, j) => a + j.turnos.length, 0);
const ESPERADAS = turnosTotais * CANAIS.length * BRACOS.length * RODADAS;
console.log(
  `${turnosTotais} turnos × ${CANAIS.length} canais × ${BRACOS.length} braços × ${RODADAS} rodadas = ${ESPERADAS} respostas esperadas\n`,
);

const ARQ = resolve(AQUI, "resultados.json");
const acumulado = existsSync(ARQ) ? JSON.parse(readFileSync(ARQ, "utf8")) : { respostas: [], falhas: [] };

for (let rodada = 1; rodada <= RODADAS; rodada++) {
  if (acumulado.respostas.some((r) => r.rodada === rodada)) {
    console.log(`rodada ${rodada}: já existe, pulando`);
    continue;
  }
  for (const canal of CANAIS) {
    for (const braco of BRACOS) {
      for (const j of JORNADAS) {
        const historico = []; // ⚠️ por braço, por jornada, por canal
        const anteriores = [];
        let crianca = j.crianca;
        let perfil = j.perfil;
        for (const [i, fala] of j.turnos.entries()) {
          if (j.trocaNoTurno != null && i === j.trocaNoTurno) {
            crianca = j.criancaDepois;
            perfil = j.perfilDepois;
          }
          const messages = montarMensagens(canal, { crianca, perfil, historico, fala });
          let saida;
          try {
            const { r, falhas } = await comRetentativa(() =>
              gerarConversacional({
                provider: braco.provider,
                model: braco.model,
                system: systemDoCanal(canal, j),
                messages,
                maxTokens: 1600,
                cacheSystem: true,
              }),
            );
            saida = r;
            if (falhas) acumulado.falhas.push({ rodada, canal, braco: braco.id, jornada: j.id, turno: i + 1, retentativas: falhas });
          } catch (e) {
            acumulado.falhas.push({ rodada, canal, braco: braco.id, jornada: j.id, turno: i + 1, erro: String(e).slice(0, 200), abortou: true });
            console.log(`  ✗ ${canal}/${braco.id}/${j.id}/t${i + 1}: ${String(e).slice(0, 80)}`);
            continue;
          }

          historico.push({ de: "mae", texto: fala }, { de: "kolo", texto: saida.texto });

          const v = fronteiraAtravessada(saida.texto);
          const sinais = SINAIS.filter(([, re]) => re.test(saida.texto)).map(([k]) => k);
          if (repetiu(saida.texto, anteriores)) sinais.push("repeticao_literal");
          // contaminação: só depois da troca, e só traços do OUTRO filho
          let contaminacao = null;
          if (j.trocaNoTurno != null && i >= j.trocaNoTurno) {
            const outro = j.crianca;
            const achados = (TRACOS[outro] ?? []).filter((re) => re.test(saida.texto));
            if (achados.length) contaminacao = `${outro}: ${achados.length} traço(s)`;
          }
          anteriores.push(saida.texto);

          acumulado.respostas.push({
            rodada, canal, jornada: j.id, turno: i + 1, crianca,
            braco: braco.id, provider: saida.provider, model: saida.model,
            fala, texto: saida.texto,
            palavras: palavras(saida.texto), perguntas: perguntas(saida.texto),
            tokensIn: saida.tokensIn, tokensOut: saida.tokensOut,
            cacheRead: saida.cacheRead, cacheWrite: saida.cacheWrite,
            custo: calcularCustoTokens(saida.model, saida.tokensIn, saida.tokensOut),
            ms: saida.ms,
            sinais, contaminacao,
            fronteira: v ? `${v.fronteira.nome}/${v.achados.map((a) => a.codigo).join(",")}` : null,
            marco: j.marcos[i] ?? null,
          });
        }
      }
      console.log(`  r${rodada} ${canal}/${braco.id} ok (${acumulado.respostas.length} acumuladas)`);
    }
  }
  writeFileSync(ARQ, JSON.stringify(acumulado, null, 2));
  console.log(`rodada ${rodada} persistida\n`);
}

writeFileSync(ARQ, JSON.stringify(acumulado, null, 2));
console.log(`\nEXECUTADAS ${acumulado.respostas.length} / ESPERADAS ${ESPERADAS}  · falhas: ${acumulado.falhas.length}`);
