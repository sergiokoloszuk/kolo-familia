/**
 * RETESTE DA v2.1 — só os três cenários que a bancada de 05/09 bloqueou.
 *
 * ⚠️ DUAS MUDANÇAS EM RELAÇÃO À BANCADA ANTERIOR, e as duas são de MÉTODO:
 *   1. FAMÍLIA DE UMA CRIANÇA SÓ. A bancada anterior tinha dois filhos, e isso
 *      fez toda mensagem sem nome virar ambígua — os dois braços gastavam o
 *      turno perguntando "é o Theo ou a Cecília?". Sete cenários ficaram
 *      inconclusivos por causa disso. Aqui a ambiguidade não existe.
 *   2. SEIS execuções por braço, não três. O bloqueio precisa ser medido com
 *      folga: 3 de 6 é achado, 1 de 6 é ruído.
 *
 * O resto é idêntico: mesmo `responderExperimental`, mesmos 9 blocos, mesmo
 * modelo, mesma mensagem. A única variável continua sendo `rascunhoCore`.
 *
 *   npx tsx scripts/bancada/core-v9-vs-v2/reteste-v21.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const SRC = resolve(RAIZ, "apps/web/src");

for (const linha of readFileSync(resolve(RAIZ, "apps/web/.env.local"), "utf8").split("\n")) {
  const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;
process.env.AYLA_EXPERIMENTAL_TODAS = "true";

const { registerHooks } = await import("node:module");
registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/")) return next(new URL(`file:///${SRC}/${esp.slice(2)}.ts`).href, ctx);
    if (esp.startsWith(".") && !/\.[a-z]+$/.test(esp)) {
      try { return next(esp + ".ts", ctx); } catch { /* não era .ts */ }
    }
    if (esp === "next/headers" || esp === "next/cache" || esp === "server-only")
      return { url: new URL("./stub-next.mjs", import.meta.url).href, shortCircuit: true };
    return next(esp, ctx);
  },
});

const mod = (p) => import(`file:///${SRC}/${p}`);
const { responderExperimental } = await mod("lib/ayla/experimental.ts");
const { montarMundo } = await mod("lib/ayla/__harness/cenario.ts");
const { MODELO_CONVERSA } = await mod("lib/ia/provider.ts");

const ler = (c) => readFileSync(resolve(RAIZ, c), "utf8");
const CORE_V9 = (() => { const s = ler("docs/AYLA_CORE_V9_PRODUCAO_2026-09.md"); return s.slice(s.indexOf("# CORE AYLA")).trim(); })();
const CORE_V21 = (() => {
  const s = ler("docs/documentos-ayla/prompt-mestre-kolo-v2.1-CANDIDATO.md").split("-->")[1]
    .split('<!-- ══════════════════════════════════════════════════════════════════════\n     DAQUI PARA BAIXO NÃO É PROMPT')[0];
  return s.trim().replace(/-+$/, "").trim();
})();

const BRACOS = [
  { id: "A", core: { conteudo: CORE_V9, versao: 9 } },
  { id: "B", core: { conteudo: CORE_V21, versao: 21 } },
];

// ⚠️ UMA CRIANÇA SÓ — é o que descontamina o reteste.
const PERFIL = {
  nome: "Theo", nascimento: "2019-04-10", genero: "masculino",
  sabe: {
    como_e: "Adora dinossauros — sabe o nome de todos. Fica horas montando fileira de bichos.",
    sensorial: "Incomoda muito com barulho alto; tapa o ouvido no mercado.",
    corpo_rotina: "Dorme tarde. A saída de casa de manhã é o pior momento do dia.",
  },
  extras: {
    desafios_onboarding: ["rotina", "emocional", "sono", "escola"],
    preferencias: { temas: ["dinossauros", "montar", "água"] },
    comunicacao: { texto: "Fala frases de 3 a 4 palavras. Repete falas de desenho quando fica ansioso." },
  },
};

const CASOS = [
  { id: "vago",       msg: "ele grita muito" },
  { id: "pouco_ctx",  msg: "ele não quer ir para a escola" },
  { id: "exatamente", msg: "me fala exatamente o que eu faço" },
];
const N = 6;

const saida = { quando: new Date().toISOString(), modelo: MODELO_CONVERSA, n: N, resultados: [] };
console.log(`\nRETESTE v2.1 — família de UMA criança · ${N} execuções por braço`);
console.log(`A = Core v9 (${CORE_V9.length} ch) · B = v2.1 (${CORE_V21.length} ch)\n`);

for (const caso of CASOS) {
  for (const braco of BRACOS) {
    for (let i = 1; i <= N; i++) {
      const mundo = montarMundo({ nomeMae: "Ana", criancas: [PERFIL] });
      const t0 = Date.now();
      let motivo = null, r = null;
      try {
        r = await responderExperimental(mundo.db, {
          familyId: mundo.familyId, mensagem: caso.msg,
          rascunhoCore: braco.core, origem: "simulador", turnosSimulados: [],
          onFalha: (m, d) => { motivo = `${m}${d ? ` — ${d}` : ""}`; },
        });
      } catch (e) { motivo = `EXCEÇÃO: ${e?.message ?? e}`; }
      const texto = r?.texto ?? null;
      saida.resultados.push({ caso: caso.id, braco: braco.id, execucao: i, ms: Date.now()-t0, texto, falha: texto ? null : (motivo ?? "SEM_MOTIVO") });
      console.log(`  ${caso.id.padEnd(11)} ${braco.id} #${i}  ${String(texto?.length ?? 0).padStart(4)} ch`);
    }
  }
}

writeFileSync(resolve(AQUI, "resultados-v21.json"), JSON.stringify(saida, null, 2), "utf8");
console.log(`\n→ resultados-v21.json  (${saida.resultados.length} execuções)`);
