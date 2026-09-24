/**
 * A/B com a família Karina/Manu explicitamente autorizada.
 *
 * Banco somente GET; provider somente gera respostas; sem persistência e sem
 * WhatsApp. A decisão de cada caso é calculada uma vez e reutilizada nos dois
 * ramos, de modo que a única variável seja o repertório proposto.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { conhecimentoProposto } from "./conhecimento-proposto.mjs";

const raiz = process.cwd();
const web = resolve(raiz, "apps/web");
const familiaId = "9c14b56b-32ca-4410-b830-09b16cc9a7a1";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(pathToFileURL(resolve(web, "src", `${specifier.slice(2)}.ts`)).href, context);
  }
  if (["next/headers", "next/cache", "server-only"].includes(specifier)) {
    return { url: "data:text/javascript,export const cookies=()=>{throw Error('sem request')};export const headers=cookies;export const revalidatePath=()=>{};export const revalidateTag=()=>{};", shortCircuit: true };
  }
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes("/apps/web/src/")) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Variáveis do Supabase ausentes");
const supabaseOrigin = new URL(supabaseUrl).origin;
const fetchReal = globalThis.fetch;
let ramoAtual = "A";
let chamadasModelo = 0;

const lista = (valor) => (Array.isArray(valor) ? valor.map(String) : []);
const filtrosDaQuery = (url) => {
  const texto = url.searchParams.get("or") ?? "";
  return {
    skills: [...texto.matchAll(/skills_relacionadas\.cs\.\["([^"]+)"\]/g)].map((m) => m[1]),
    tags: [...texto.matchAll(/tags\.cs\.\["([^"]+)"\]/g)].map((m) => m[1]),
  };
};
const cabeNaQuery = (bp, url) => {
  const { skills, tags } = filtrosDaQuery(url);
  return skills.some((s) => lista(bp.skills_relacionadas).includes(s)) || tags.some((t) => lista(bp.tags).includes(t));
};
const idsDaQuery = (url) => {
  const miolo = (url.searchParams.get("id") ?? "").match(/^in\.\((.*)\)$/)?.[1] ?? "";
  return new Set(miolo.split(",").map((x) => x.replace(/^"|"$/g, "")).filter(Boolean));
};
const projetarBps = (rows, url) => {
  if (ramoAtual !== "B") return rows;
  const porId = new Map(rows.map((row) => [String(row.id), { ...row }]));
  const ranking = url.searchParams.get("select")?.includes("peso_relevancia");
  const detalhe = url.searchParams.get("select")?.includes("atividades_praticas");
  const ids = idsDaQuery(url);
  for (const proposta of conhecimentoProposto) {
    const atual = porId.get(proposta.id);
    if ((ranking && cabeNaQuery(proposta, url)) || (detalhe && ids.has(proposta.id))) {
      porId.set(proposta.id, { ...(atual ?? {}), ...proposta });
    } else if (atual) {
      porId.set(proposta.id, { ...atual, ...proposta });
    }
  }
  const resultado = [...porId.values()];
  if (ranking) resultado.sort((a, b) => Number(b.peso_relevancia ?? 0) - Number(a.peso_relevancia ?? 0));
  return resultado;
};

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init.method ?? input?.method ?? "GET").toUpperCase();
  const banco = url.origin === supabaseOrigin;
  const modelo = url.origin === "https://api.openai.com" && url.pathname === "/v1/chat/completions" && method === "POST";
  if (banco && method !== "GET") throw new Error(`I/O de escrita bloqueado: ${method} ${url.pathname}`);
  if (!banco && !modelo) throw new Error(`I/O fora do escopo bloqueado: ${method} ${url.origin}${url.pathname}`);
  if (modelo) chamadasModelo += 1;
  const resposta = await fetchReal(input, { ...init, signal: init.signal ?? AbortSignal.timeout(60_000) });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${method} ${url.pathname}`);
  if (!(banco && url.pathname === "/rest/v1/boas_praticas")) return resposta;
  const bruto = await resposta.json();
  const rows = Array.isArray(bruto) ? projetarBps(bruto, url) : bruto;
  return new Response(JSON.stringify(rows), { status: resposta.status, statusText: resposta.statusText, headers: resposta.headers });
};

const modulo = (arquivo) => import(pathToFileURL(resolve(web, "src", arquivo)).href);
const [
  { responderExperimental },
  { decidirTurno },
  { carregarCatalogoSkills },
  { classificarNivelSeguranca },
  { recuperarBoasPraticas },
] = await Promise.all([
  modulo("lib/ayla/experimental.ts"),
  modulo("lib/conducao/decisao-do-turno.ts"),
  modulo("lib/ayla/catalogo-skills.ts"),
  modulo("lib/ayla/estado-seguranca.ts"),
  modulo("lib/conhecimento/recuperar.ts"),
]);

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const catalogo = await carregarCatalogoSkills(supabase);
if (catalogo.estado !== "ok") throw new Error("Catálogo indisponível");

const casosPerfil = [
  ["comunicacao", "A Manu me puxa pela mão quando quer alguma coisa."],
  ["atividade", "A Manu não quer fazer nenhuma atividade hoje."],
  ["sensorial_foco", "No mercado a Manu corre e parece que nem me escuta."],
  ["socializacao", "A Manu fica sozinha no recreio."],
];
const casosPend209 = [
  ["aprendizagem", "A Manu não aprende nada. Estou bem cansada."],
  ["regulacao", "A Manu está gritando e muito irritada."],
  ["choro", "A Manu está chorando e eu não entendo o motivo."],
  ["tablet", "Está difícil tirar a Manu do tablet."],
  ["atividade", "A Manu não quer fazer a atividade."],
  ["brincadeira", "Me sugira uma brincadeira para fazer com a Manu."],
  ["comunicacao", "A Manu tem dificuldade para pedir o que quer e se expressar."],
];
const regressaoPend209 = process.env.CASOS_PEND209 === "1";
const producaoReal = process.env.PRODUCAO_REAL === "1";
const conjuntoBase = regressaoPend209 ? casosPend209 : casosPerfil;
const filtroCasos = new Set((process.env.CASOS_FILTRO ?? "").split(",").map((x) => x.trim()).filter(Boolean));
const casos = filtroCasos.size ? conjuntoBase.filter(([id]) => filtroCasos.has(id)) : conjuntoBase;
const resultado = {
  data: new Date().toISOString(),
  familia: "Karina/Manu (autorizada)",
  conjunto: producaoReal
    ? regressaoPend209 ? "produção + regressão PEND-209" : "produção + Pós + Perfil"
    : regressaoPend209 ? "regressao PEND-209" : "Pós + Perfil",
  modo: "somente leitura; sem WhatsApp; sem persistência; sem contexto bruto no artefato",
  casos: [],
};

for (const [id, mensagem] of casos) {
  ramoAtual = "A";
  const decisao = await decidirTurno({ texto: mensagem, blocoEstado: "", catalogoSkills: catalogo.skills, catalogoDisponivel: true });
  if (decisao.origem !== "gpt") throw new Error(`Decisor não concluiu ${id}`);
  const porRamo = {};
  for (const ramo of producaoReal ? ["PRODUCAO"] : ["A", "B"]) {
    ramoAtual = ramo;
    chamadasModelo = 0;
    const falhas = [];
    const resposta = await responderExperimental(supabase, {
      familyId: familiaId,
      mensagem,
      origem: "simulador",
      turnosSimulados: [],
      turnoClassificado: decisao,
      nivelSeguranca: classificarNivelSeguranca(mensagem),
      onFalha: (motivo, detalhe) => falhas.push({ motivo, detalhe }),
    });
    if (!resposta) throw new Error(`Produtor não concluiu ${id}/${ramo}: ${JSON.stringify(falhas)}`);
    const bps = await recuperarBoasPraticas({ supabase, skills: decisao.skills, idade: 6, limite: 2, relato: mensagem });
    porRamo[ramo] = {
      repertorio: bps.map((bp) => ({ id: bp.id, titulo: bp.titulo })),
      resposta: resposta.texto,
      metrica: resposta.metrica,
      falhas,
      chamadasModelo,
    };
    console.log(JSON.stringify({ id, ramo, skills: decisao.skills, repertorio: porRamo[ramo].repertorio.map((bp) => bp.titulo), resposta: resposta.texto }));
  }
  resultado.casos.push({ id, mensagem, decisao, ...porRamo });
}

const arquivo = resolve(
  raiz,
  producaoReal
    ? regressaoPend209
      ? "docs/auditorias/pos-conhecimento-producao-regressao-pend209-2026-09-24.json"
      : "docs/auditorias/pos-conhecimento-producao-perfil-2026-09-24.json"
    : regressaoPend209
    ? "docs/auditorias/pos-conhecimento-regressao-pend209-2026-09-24.json"
    : filtroCasos.size
    ? "docs/auditorias/pos-conhecimento-perfil-comunicacao-final-2026-09-24.json"
    : "docs/auditorias/pos-conhecimento-perfil-ab-2026-09-24.json",
);
mkdirSync(dirname(arquivo), { recursive: true });
writeFileSync(arquivo, `${JSON.stringify(resultado, null, 2)}\n`);
console.log(`Resultado: ${arquivo}`);
