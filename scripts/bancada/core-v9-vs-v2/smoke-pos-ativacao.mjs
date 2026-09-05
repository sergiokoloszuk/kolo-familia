/**
 * SMOKE PÓS-ATIVAÇÃO — o caminho oficial resolvendo o Core do banco REAL.
 *
 * Sem `rascunhoCore`: é `resolverDocumento(supabase, "core", null)`, a mesma
 * chamada que `experimental.ts:759` faz em toda conversa de família.
 */
import { readFileSync } from "node:fs";
const RAIZ = "d:/Projetos/Kolo Família", SRC = `${RAIZ}/apps/web/src`;
for (const l of readFileSync(`${RAIZ}/apps/web/.env.local`, "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const { registerHooks } = await import("node:module");
registerHooks({ resolve(e, c, n) {
  if (e.startsWith("@/")) return n(new URL(`file:///${SRC}/${e.slice(2)}.ts`).href, c);
  if (e.startsWith(".") && !/\.[a-z]+$/.test(e)) { try { return n(e + ".ts", c); } catch {} }
  if (e === "next/headers" || e === "next/cache" || e === "server-only")
    return { url: new URL("./stub-next.mjs", import.meta.url).href, shortCircuit: true };
  return n(e, c);
}});
const { createClient } = await import("@supabase/supabase-js");
const { resolverDocumento } = await import(`file:///${SRC}/lib/ayla/documentos.ts`);
const { paraWhatsApp } = await import(`file:///${SRC}/lib/ayla/apresentacao.ts`);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1) o que o caminho oficial resolve HOJE, sem rascunho
const core = await resolverDocumento(sb, "core");
console.log("1. resolverDocumento(supabase, 'core') — a chamada de produção");
console.log(`   versao=${core.versao} · origem=${core.origem} · ${core.conteudo.length} ch`);
console.log(`   é a v10? ${core.versao === 10 ? "SIM" : "NÃO — " + core.versao}`);
console.log(`   traz o piso de utilidade? ${core.conteudo.includes("entregue alguma coisa útil no mesmo") ? "SIM" : "NÃO"}`);
console.log(`   traz o limite jurídico?   ${core.conteudo.includes("Jurídico, previdenciário e benefícios") ? "SIM" : "NÃO"}`);
console.log(`   traz anexo de revisão?    ${core.conteudo.includes("ANEXOS DE REVISÃO") ? "SIM (ERRO)" : "não (correto)"}`);

// 2) turno oficial completo, resolvendo o Core do banco real
process.env.AYLA_EXPERIMENTAL_TODAS = "true";
const { responderExperimental } = await import(`file:///${SRC}/lib/ayla/experimental.ts`);
const { montarMundo } = await import(`file:///${SRC}/lib/ayla/__harness/cenario.ts`);
const PERFIL = { nome: "Theo", nascimento: "2019-04-10", genero: "masculino",
  sabe: { como_e: "Adora dinossauros.", sensorial: "Incomoda com barulho alto." },
  extras: { desafios_onboarding: ["rotina","emocional"], preferencias: { temas: ["dinossauros"] } } };

console.log("\n2. turno oficial completo (conta de teste sintética, nenhuma família real)");
for (const msg of ["ele grita muito", "monta a rotina visual dele e salva no meu perfil"]) {
  const mundo = montarMundo({ nomeMae: "Ana", criancas: [PERFIL] });
  mundo.db.semear("ayla_documentos", []); // a família é do banco de memória
  const r = await responderExperimental(mundo.db, {
    familyId: mundo.familyId, mensagem: msg,
    rascunhoCore: { conteudo: core.conteudo, versao: core.versao }, // o Core VINDO DA PRODUÇÃO
    origem: "simulador", turnosSimulados: [],
  });
  const t = r?.texto ?? "";
  const enviado = paraWhatsApp(t);
  console.log(`\n   "${msg}"`);
  console.log(`   coreVersao=${r?.metrica?.coreVersao} · provider=${r?.metrica?.provider} · modelo=${r?.metrica?.modelo} · ${r?.metrica?.msTotal}ms`);
  console.log(`   ** na saída do modelo: ${(t.match(/\*\*/g)||[]).length} → após o funil: ${(enviado.match(/\*\*/g)||[]).length}`);
  console.log(`   >> ${enviado.slice(0, 260).replace(/\n/g, " ⏎ ")}`);
}
