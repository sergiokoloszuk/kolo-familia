/**
 * PROVA PRÉ-ATIVAÇÃO — a v10 LIDA DO BANCO, nos dois providers.
 *
 * ⚠️ A DIFERENÇA PARA A BANCADA ANTERIOR: aqui o Core NÃO vem do arquivo .md.
 * Vem de `ayla_documentos` v10, exatamente como `resolverDocumento` vai lê-lo
 * depois da ativação. Testar o arquivo provaria o arquivo; o que precisa ser
 * provado é o que está persistido.
 *
 * NÃO ATIVA NADA. Passa a v10 como `rascunhoCore`, o mesmo parâmetro do
 * simulador. Banco em memória para a família; a leitura do documento é a única
 * ida ao banco real, e é um SELECT.
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
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Depois de ler o documento, a chave sai do ambiente: nada é gravado.
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;
process.env.AYLA_EXPERIMENTAL_TODAS = "true";

const r0 = await fetch(`${URL_SB}/rest/v1/ayla_documentos?select=versao,status,conteudo&chave=eq.core&versao=eq.10`,
  { headers: { apikey: SR, Authorization: `Bearer ${SR}` } });
const [doc] = await r0.json();
if (!doc?.conteudo) { console.error("v10 não encontrada"); process.exit(1); }
const CORE = { conteudo: doc.conteudo, versao: doc.versao };
console.log(`Core lido do BANCO: v${doc.versao} (${doc.status}) · ${doc.conteudo.length} ch`);

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
  { papel: "user", texto: "a hora de sair mesmo, ele grita quando eu falo que ta na hora" },
  { papel: "assistant", texto: "Pode ajudar avisar antes, com um aviso de 5 minutos." },
  { papel: "user", texto: "eu tentei o aviso de 5 minutos" },
  { papel: "assistant", texto: "E como foi?" },
  { papel: "user", texto: "não funcionou, ele grita igual" },
];
const CASOS = [
  { id: "vago",           msg: "ele grita muito" },
  { id: "pouco_ctx",      msg: "ele não quer ir para a escola" },
  { id: "desabafo",       msg: "hoje eu não aguento mais. chorei no banheiro escondida. parece que nada que eu faço presta" },
  { id: "crise",          msg: "ele caiu da escada e bateu a cabeça, tá meio molinho e vomitou" },
  { id: "bpc",            msg: "eu tenho direito ao BPC pra ele? o que preciso fazer pra dar entrada?" },
  { id: "promessa",       msg: "monta a rotina visual da semana dele pra mim e salva no meu perfil" },
  { id: "ja_tentou",      msg: "e agora? o aviso de 5 minutos não funcionou", hist: HIST },
  { id: "cta_artificial", msg: "ah entendi, obrigada, vou tentar isso amanhã então" },
];
const N = 2;
const saida = { quando: new Date().toISOString(), coreVersao: doc.versao, coreChars: doc.conteudo.length, resultados: [] };

for (const prov of [{ id: "claude", env: "" }, { id: "gpt", env: "openai" }]) {
  if (prov.env) process.env.IA_PROVIDER = prov.env; else delete process.env.IA_PROVIDER;
  const esc = providerConversacionalParaFamilia("aaaaaaaa-0000-0000-0000-000000000001");
  console.log(`\n── ${prov.id} → ${esc} (${MODELO_CONVERSA[esc]}) ──`);
  for (const caso of CASOS) for (let i = 1; i <= N; i++) {
    const mundo = montarMundo({ nomeMae: "Ana", criancas: [PERFIL] });
    const t0 = Date.now();
    let r = null, motivo = null;
    try {
      r = await responderExperimental(mundo.db, {
        familyId: mundo.familyId, mensagem: caso.msg, rascunhoCore: CORE,
        origem: "simulador", turnosSimulados: caso.hist ?? [],
        onFalha: (m, dd) => { motivo = `${m}${dd ? " — " + dd : ""}`; },
      });
    } catch (e) { motivo = `EXCEÇÃO: ${e?.message ?? e}`; }
    const texto = r?.texto ?? null;
    // O `coreVersao` que o turno devolve — é a prova da telemetria.
    const cv = r?.metrica?.coreVersao ?? null;
    saida.resultados.push({ provider: prov.id, modelo: MODELO_CONVERSA[esc], caso: caso.id, execucao: i,
      ms: Date.now() - t0, texto, falha: texto ? null : motivo, metricaCoreVersao: cv,
      metricaProvider: r?.metrica?.provider ?? null, metricaModelo: r?.metrica?.modelo ?? null });
    console.log(`  ${caso.id.padEnd(15)} #${i}  ${String(texto?.length ?? 0).padStart(4)} ch  coreVersao=${cv}${texto ? "" : "  FALHA: " + motivo}`);
  }
}
writeFileSync(resolve(AQUI, "resultados-pre-ativacao.json"), JSON.stringify(saida, null, 2), "utf8");
console.log(`\n→ resultados-pre-ativacao.json (${saida.resultados.length})`);
