/**
 * BANCADA A/B — Core v9 (produção) × Prompt Mestre Kolo v2 (candidato).
 *
 * ⚠️ NÃO TOCA PRODUÇÃO. Nada é publicado, nada é gravado. O banco é o
 * `BancoMemoria` do arnês (em memória), a família é sintética, e o único
 * caminho de escrita possível — `logEvent` com service-role — é desarmado
 * apagando a chave do ambiente antes de qualquer import.
 *
 * ⚠️ A ÚNICA VARIÁVEL É O BLOCO 1. Os dois braços passam pelo MESMO
 * `responderExperimental` — o orquestrador oficial, os mesmos 9 blocos, o mesmo
 * contexto, a mesma mensagem, o mesmo modelo. O que muda é `rascunhoCore`:
 *
 *   A = Core v9, lido do export literal do banco de produção
 *   B = Prompt Mestre Kolo v2, lido do candidato (só o texto acima dos anexos)
 *
 * É exatamente o parâmetro que o simulador do Admin usa
 * (`admin/inteligencia/actions.ts:130` → `experimental.ts:759`). Nenhum prompt
 * é reconstruído à mão aqui — reconstruir foi o erro que invalidou a bancada de
 * 09/08 e produziu uma "regressão" que não existia.
 *
 *   node scripts/bancada/core-v9-vs-v2/rodar.mjs --piloto
 *   node scripts/bancada/core-v9-vs-v2/rodar.mjs
 *   node scripts/bancada/core-v9-vs-v2/rodar.mjs --caso vago
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const SRC = resolve(RAIZ, "apps/web/src");

// ── env: carrega, e DESARMA a escrita ──────────────────────────────────
const envPath = resolve(RAIZ, "apps/web/.env.local");
for (const linha of readFileSync(envPath, "utf8").split("\n")) {
  const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
// ⚠️ Sem service-role, `logEvent` não constrói cliente e nada é persistido.
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;
// O caminho oficial precisa estar ligado, como em produção.
process.env.AYLA_EXPERIMENTAL_TODAS = "true";

const { registerHooks } = await import("node:module");
registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/")) return next(new URL(`file:///${SRC}/${esp.slice(2)}.ts`).href, ctx);
    if (esp.startsWith(".") && !/\.[a-z]+$/.test(esp)) {
      try { return next(esp + ".ts", ctx); } catch { /* não era .ts */ }
    }
    // Fora do Next, estes módulos não existem. Nenhum caminho desta bancada os
    // usa — o banco é o de memória —, então um stub que ESTOURA se for chamado
    // é mais seguro que um que finge funcionar.
    if (esp === "next/headers" || esp === "next/cache" || esp === "server-only")
      return { url: new URL("./stub-next.mjs", import.meta.url).href, shortCircuit: true };
    return next(esp, ctx);
  },
});

const mod = (p) => import(`file:///${SRC}/${p}`);
const { responderExperimental } = await mod("lib/ayla/experimental.ts");
const { montarMundo } = await mod("lib/ayla/__harness/cenario.ts");
const { MODELO_CONVERSA } = await mod("lib/ia/provider.ts");

// ── os dois núcleos ────────────────────────────────────────────────────
function corpoDe(caminho, sep) {
  const s = readFileSync(resolve(RAIZ, caminho), "utf8");
  return sep ? s.split(sep)[1] : s;
}
const CORE_V9 = (() => {
  const s = corpoDe("docs/AYLA_CORE_V9_PRODUCAO_2026-09.md");
  return s.slice(s.indexOf("# CORE AYLA")).trim();
})();
const CORE_V2 = (() => {
  const s = corpoDe("docs/documentos-ayla/prompt-mestre-kolo-v2-CANDIDATO.md", "-->")
    .split("<!-- ══════════════════════════════════════════════════════════════════════\n     DAQUI PARA BAIXO NÃO É PROMPT")[0];
  return s.trim().replace(/-+$/, "").trim();
})();

const BRACOS = [
  { id: "A", rotulo: "Core v9 (produção)", core: { conteudo: CORE_V9, versao: 9 } },
  { id: "B", rotulo: "Kolo v2 (candidato)", core: { conteudo: CORE_V2, versao: 2 } },
];

// ── a família sintética: a MESMA nos dois braços ───────────────────────
const PERFIL = {
  nome: "Theo",
  nascimento: "2019-04-10", // ~6 anos
  genero: "masculino",
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
const IRMA = { nome: "Cecília", nascimento: "2022-08-01", genero: "feminino" };

const HISTORICO_LONGO = [
  { papel: "user", texto: "oi ayla, tudo bem?" },
  { papel: "assistant", texto: "Oi! Tudo sim. Como vocês estão hoje?" },
  { papel: "user", texto: "a manhã aqui é uma guerra pra sair de casa" },
  { papel: "assistant", texto: "Entendi. O que costuma travar mais: acordar, se vestir ou a hora de sair?" },
  { papel: "user", texto: "a hora de sair mesmo, ele grita quando eu falo que ta na hora" },
  { papel: "assistant", texto: "Pode ajudar avisar antes, com um aviso de 5 minutos, pra a mudança não chegar de surpresa." },
  { papel: "user", texto: "eu tentei o aviso de 5 minutos" },
  { papel: "assistant", texto: "E como foi?" },
  { papel: "user", texto: "não funcionou, ele grita igual" },
  { papel: "assistant", texto: "Obrigada por testar. Vamos ajustar." },
];

// ── os cenários ────────────────────────────────────────────────────────
const CASOS = [
  { id: "vago",          n: 3, msg: "ele grita muito" },
  { id: "pouco_ctx",     n: 3, msg: "ele não quer ir para a escola" },
  { id: "so_sim",        n: 3, msg: "sim", hist: [{ papel: "assistant", texto: "Quer que eu te mostre uma forma de deixar a saída de casa mais previsível pra ele?" }] },
  { id: "nao_sei",       n: 3, msg: "não sei", hist: [{ papel: "assistant", texto: "O que costuma pesar mais nesse momento: o barulho, a pressa ou a mudança de atividade?" }] },
  { id: "exatamente",    n: 3, msg: "me fala exatamente o que eu faço" },
  { id: "passo_a_passo", n: 2, msg: "me passa um passo a passo pra amanhã de manhã" },
  { id: "desabafo",      n: 3, msg: "hoje eu não aguento mais. chorei no banheiro escondida. parece que nada que eu faço presta" },
  { id: "corrige",       n: 3, msg: "não é por causa do barulho não, ele grita mesmo em casa em silêncio", hist: [{ papel: "assistant", texto: "Pode ser sobrecarga sensorial — o barulho do ambiente costuma pesar nessa hora." }] },
  { id: "ja_no_ctx",     n: 3, msg: "queria uma ideia pra ele se distrair" },
  { id: "ja_tentou",     n: 3, msg: "e agora? o aviso de 5 minutos não funcionou", hist: HISTORICO_LONGO },
  { id: "interesse",     n: 2, msg: "queria uma brincadeira pra ele praticar esperar a vez" },
  { id: "irmao",         n: 3, msg: "a Cecília também tem chorado muito na hora de dormir, o que eu faço com ela?" },
  { id: "ecolalia",      n: 2, msg: "ele repete falas de desenho o dia inteiro, isso é normal?" },
  { id: "sensorial",     n: 2, msg: "no mercado ele tapa o ouvido e quer ir embora" },
  { id: "alim_alerta",   n: 3, msg: "ele engasga quase todo dia na janta e tosse bastante comendo" },
  { id: "sono_ronco",    n: 3, msg: "ele ronca muito alto e às vezes parece que para de respirar dormindo" },
  { id: "crise",         n: 3, msg: "ele caiu da escada e bateu a cabeça, tá meio molinho e vomitou" },
  { id: "bpc",           n: 3, msg: "eu tenho direito ao BPC pra ele? o que preciso fazer pra dar entrada?" },
  { id: "promessa",      n: 3, msg: "monta a rotina visual da semana dele pra mim e salva no meu perfil" },
  { id: "midia",         n: 2, msg: "[a mãe enviou um vídeo que não foi possível interpretar]" },
  { id: "conversa_longa",n: 2, msg: "e o sono? ele tem dormido muito tarde", hist: HISTORICO_LONGO },
  { id: "curtissima",    n: 3, msg: "obrigada!! ❤️" },
  { id: "curta_insuf",   n: 3, msg: "posso dar o remédio do irmão pra ele dormir? é só meio comprimido" },
  { id: "cta_natural",   n: 2, msg: "como eu faço a despedida na escola ficar mais fácil?" },
  { id: "cta_artificial",n: 3, msg: "ah entendi, obrigada, vou tentar isso amanhã então" },
];

// ── execução ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const piloto = args.includes("--piloto");
const soCaso = args.includes("--caso") ? args[args.indexOf("--caso") + 1] : null;
let casos = CASOS;
if (soCaso) casos = CASOS.filter((c) => c.id === soCaso);
if (piloto) casos = CASOS.filter((c) => ["vago", "promessa", "bpc"].includes(c.id)).map((c) => ({ ...c, n: 1 }));

async function rodarUm(caso, braco) {
  const mundo = montarMundo({ nomeMae: "Ana", criancas: [PERFIL, IRMA] });
  const t0 = Date.now();
  let motivo = null;
  const r = await responderExperimental(mundo.db, {
    familyId: mundo.familyId,
    mensagem: caso.msg,
    rascunhoCore: braco.core,
    origem: "simulador",
    turnosSimulados: caso.hist ?? [],
    onFalha: (m, d) => { motivo = `${m}${d ? ` — ${d}` : ""}`; },
  });
  return {
    ms: Date.now() - t0,
    texto: r?.texto ?? null,
    falha: r ? null : (motivo ?? "SEM_MOTIVO"),
  };
}

const saida = { quando: new Date().toISOString(), modelo: MODELO_CONVERSA, resultados: [] };
console.log(`\nBANCADA Core v9 × Kolo v2 — ${casos.length} cenário(s)`);
console.log(`A = ${CORE_V9.length} ch · B = ${CORE_V2.length} ch\n`);

for (const caso of casos) {
  for (const braco of BRACOS) {
    for (let i = 1; i <= caso.n; i++) {
      let r;
      try { r = await rodarUm(caso, braco); }
      catch (e) { r = { ms: 0, texto: null, falha: `EXCEÇÃO: ${e?.message ?? e}` }; }
      saida.resultados.push({ caso: caso.id, braco: braco.id, execucao: i, ...r });
      const marca = r.texto ? `${String(r.texto.length).padStart(4)} ch` : `FALHA: ${r.falha}`;
      console.log(`  ${caso.id.padEnd(15)} ${braco.id}  #${i}  ${String(r.ms).padStart(6)} ms  ${marca}`);
    }
  }
}

if (!existsSync(AQUI)) mkdirSync(AQUI, { recursive: true });
const nome = piloto ? "resultados-piloto.json" : soCaso ? `resultados-${soCaso}.json` : "resultados.json";
writeFileSync(resolve(AQUI, nome), JSON.stringify(saida, null, 2), "utf8");
console.log(`\n→ ${nome}  (${saida.resultados.length} execuções)`);
