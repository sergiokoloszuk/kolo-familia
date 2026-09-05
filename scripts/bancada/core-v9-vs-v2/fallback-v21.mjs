/**
 * v2.1 NOS DOIS PROVIDERS — a validação técnica antes de qualquer família.
 *
 * ⚠️ CORREÇÃO DE UM ERRO MEU (05/09). As bancadas anteriores relataram
 * "gpt-5.6-luna" porque eu imprimi o REGISTRO `MODELO_CONVERSA` inteiro e li o
 * lado errado. `IA_PROVIDER` está AUSENTE do `.env.local`, e ausente significa
 * `anthropic`: tudo o que rodou até aqui rodou no CLAUDE.
 *
 * ⚠️ E OS DOIS SÃO PRODUÇÃO. `api_calls` das últimas 4h mostra conversas reais
 * em `gpt-5.6-luna` (8) E em `claude-sonnet-4-6` (7) — o modo é allowlist, não
 * "um principal e um reserva". Então o teste útil não é "fallback": é rodar a
 * MESMA v2.1 nos dois e medir a diferença.
 *
 *   npx tsx scripts/bancada/core-v9-vs-v2/fallback-v21.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const SRC = resolve(RAIZ, "apps/web/src");

for (const l of readFileSync(resolve(RAIZ, "apps/web/.env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;
process.env.AYLA_EXPERIMENTAL_TODAS = "true";

const { registerHooks } = await import("node:module");
registerHooks({
  resolve(e, c, n) {
    if (e.startsWith("@/")) return n(new URL(`file:///${SRC}/${e.slice(2)}.ts`).href, c);
    if (e.startsWith(".") && !/\.[a-z]+$/.test(e)) { try { return n(e + ".ts", c); } catch {} }
    if (e === "next/headers" || e === "next/cache" || e === "server-only")
      return { url: new URL("./stub-next.mjs", import.meta.url).href, shortCircuit: true };
    return n(e, c);
  },
});

const mod = (p) => import(`file:///${SRC}/${p}`);
const { responderExperimental } = await mod("lib/ayla/experimental.ts");
const { montarMundo } = await mod("lib/ayla/__harness/cenario.ts");
const { MODELO_CONVERSA, providerConversacionalParaFamilia } = await mod("lib/ia/provider.ts");

const V21 = (() => {
  const s = readFileSync(resolve(RAIZ, "docs/documentos-ayla/prompt-mestre-kolo-v2.1-CANDIDATO.md"), "utf8")
    .split("-->")[1]
    .split('<!-- ══════════════════════════════════════════════════════════════════════\n     DAQUI PARA BAIXO NÃO É PROMPT')[0];
  return s.trim().replace(/-+$/, "").trim();
})();
const CORE = { conteudo: V21, versao: 21 };

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

const HIST = [
  { papel: "user", texto: "a manhã aqui é uma guerra pra sair de casa" },
  { papel: "assistant", texto: "Entendi. O que costuma travar mais: acordar, se vestir ou a hora de sair?" },
  { papel: "user", texto: "a hora de sair mesmo, ele grita quando eu falo que ta na hora" },
  { papel: "assistant", texto: "Pode ajudar avisar antes, com um aviso de 5 minutos, pra a mudança não chegar de surpresa." },
  { papel: "user", texto: "eu tentei o aviso de 5 minutos" },
  { papel: "assistant", texto: "E como foi?" },
  { papel: "user", texto: "não funcionou, ele grita igual" },
];

const CASOS = [
  { id: "vago",           msg: "ele grita muito" },
  { id: "pouco_ctx",      msg: "ele não quer ir para a escola" },
  { id: "exatamente",     msg: "me fala exatamente o que eu faço" },
  { id: "desabafo",       msg: "hoje eu não aguento mais. chorei no banheiro escondida. parece que nada que eu faço presta" },
  { id: "crise",          msg: "ele caiu da escada e bateu a cabeça, tá meio molinho e vomitou" },
  { id: "bpc",            msg: "eu tenho direito ao BPC pra ele? o que preciso fazer pra dar entrada?" },
  { id: "ja_tentou",      msg: "e agora? o aviso de 5 minutos não funcionou", hist: HIST },
  { id: "ja_no_ctx",      msg: "queria uma ideia pra ele se distrair" },
  { id: "promessa",       msg: "monta a rotina visual da semana dele pra mim e salva no meu perfil" },
  { id: "cta_artificial", msg: "ah entendi, obrigada, vou tentar isso amanhã então" },
];
const N = 3;

// ⚠️ O provider é forçado por VARIÁVEL, exatamente como em produção — não por
// um atalho que pule a função de decisão.
const PROVIDERS = [
  { id: "claude", env: "" },        // ausente → anthropic
  { id: "gpt",    env: "openai" },  // → todas as famílias no GPT
];

const saida = { quando: new Date().toISOString(), modelos: MODELO_CONVERSA, n: N, resultados: [] };
console.log(`\nv2.1 NOS DOIS PROVIDERS — ${CASOS.length} cenários × ${N} execuções × 2 = ${CASOS.length*N*2}`);
console.log(`v2.1 = ${V21.length} ch\n`);

for (const prov of PROVIDERS) {
  if (prov.env) process.env.IA_PROVIDER = prov.env; else delete process.env.IA_PROVIDER;
  const escolhido = providerConversacionalParaFamilia("aaaaaaaa-0000-0000-0000-000000000001");
  console.log(`── provider: ${prov.id} → ${escolhido} (${MODELO_CONVERSA[escolhido]}) ──`);
  for (const caso of CASOS) {
    for (let i = 1; i <= N; i++) {
      const mundo = montarMundo({ nomeMae: "Ana", criancas: [PERFIL] });
      const t0 = Date.now();
      let motivo = null, r = null;
      try {
        r = await responderExperimental(mundo.db, {
          familyId: mundo.familyId, mensagem: caso.msg, rascunhoCore: CORE,
          origem: "simulador", turnosSimulados: caso.hist ?? [],
          onFalha: (m, d) => { motivo = `${m}${d ? ` — ${d}` : ""}`; },
        });
      } catch (e) { motivo = `EXCEÇÃO: ${e?.message ?? e}`; }
      const texto = r?.texto ?? null;
      saida.resultados.push({ provider: prov.id, modelo: MODELO_CONVERSA[escolhido], caso: caso.id, execucao: i, ms: Date.now()-t0, texto, falha: texto ? null : (motivo ?? "SEM_MOTIVO") });
      console.log(`  ${caso.id.padEnd(15)} #${i}  ${String(Date.now()-t0).padStart(6)} ms  ${String(texto?.length ?? 0).padStart(4)} ch${texto ? "" : "  FALHA: " + motivo}`);
    }
  }
}
writeFileSync(resolve(AQUI, "resultados-fallback.json"), JSON.stringify(saida, null, 2), "utf8");
console.log(`\n→ resultados-fallback.json  (${saida.resultados.length} execuções)`);
