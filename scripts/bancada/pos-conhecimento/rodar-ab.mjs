/**
 * A/B da incorporação cirúrgica da Pós, antes de escrever em produção.
 *
 * A = BPs reais atuais. B = mesma leitura, com quatro linhas editoriais
 * projetadas em memória sobre a resposta GET do PostgREST. Core, decisor,
 * produtor, catálogo, Perfil sintético, modelo e configuração são os mesmos.
 * Não há POST/PATCH/DELETE no Supabase nem envio de WhatsApp.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { conhecimentoProposto } from "./conhecimento-proposto.mjs";

const raiz = process.cwd();
const web = resolve(raiz, "apps/web");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(pathToFileURL(resolve(web, "src", `${specifier.slice(2)}.ts`)).href, context);
    }
    if (["next/headers", "next/cache", "server-only"].includes(specifier)) {
      return {
        url: "data:text/javascript,export const cookies=()=>{throw Error('sem request')};export const headers=cookies;export const revalidatePath=()=>{};export const revalidateTag=()=>{};",
        shortCircuit: true,
      };
    }
    if (
      specifier.startsWith(".") &&
      !/\.[a-z]+$/i.test(specifier) &&
      context.parentURL?.includes("/apps/web/src/")
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Variáveis do Supabase ausentes");

const supabaseOrigin = new URL(supabaseUrl).origin;
const fetchReal = globalThis.fetch;
let ramoAtual = "A";
let consultas = [];
let chamadasModelo = [];

const lista = (valor) => (Array.isArray(valor) ? valor.map(String) : []);
const filtrosDaQuery = (url) => {
  const texto = url.searchParams.get("or") ?? "";
  const skills = [...texto.matchAll(/skills_relacionadas\.cs\.\["([^"]+)"\]/g)].map((m) => m[1]);
  const tags = [...texto.matchAll(/tags\.cs\.\["([^"]+)"\]/g)].map((m) => m[1]);
  return { skills, tags };
};
const cabeNaQuery = (bp, url) => {
  const { skills, tags } = filtrosDaQuery(url);
  return (
    skills.some((s) => lista(bp.skills_relacionadas).includes(s)) ||
    tags.some((t) => lista(bp.tags).includes(t))
  );
};
const idsDaQuery = (url) => {
  const bruto = url.searchParams.get("id") ?? "";
  const miolo = bruto.match(/^in\.\((.*)\)$/)?.[1] ?? "";
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
    if (ranking && cabeNaQuery(proposta, url)) {
      porId.set(proposta.id, { ...(atual ?? {}), ...proposta });
    } else if (detalhe && ids.has(proposta.id)) {
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
  const leituraSupabase =
    url.origin === supabaseOrigin &&
    method === "GET" &&
    ["/rest/v1/ayla_documentos", "/rest/v1/boas_praticas", "/rest/v1/specialist_prompt_templates"].includes(
      url.pathname,
    );
  const chamadaProvider =
    url.origin === "https://api.openai.com" && url.pathname === "/v1/chat/completions" && method === "POST";
  if (!leituraSupabase && !chamadaProvider) {
    throw new Error(`I/O fora da bancada bloqueado: ${method} ${url.origin}${url.pathname}`);
  }
  if (chamadaProvider) {
    const corpo = JSON.parse(init.body ?? "{}");
    chamadasModelo.push({ modelo: corpo.model ?? null });
  }

  const resposta = await fetchReal(input, { ...init, signal: init.signal ?? AbortSignal.timeout(60_000) });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${method} ${url.pathname}`);
  if (!leituraSupabase) return resposta;

  const bruto = await resposta.json();
  const rows =
    url.pathname === "/rest/v1/boas_praticas" && Array.isArray(bruto)
      ? projetarBps(bruto, url)
      : bruto;
  consultas.push({
    ramo: ramoAtual,
    tabela: url.pathname.split("/").at(-1),
    select: url.searchParams.get("select"),
    url: `${url.pathname}${url.search}`,
    rows,
  });
  return new Response(JSON.stringify(rows), {
    status: resposta.status,
    statusText: resposta.statusText,
    headers: resposta.headers,
  });
};

const modulo = (arquivo) => import(pathToFileURL(resolve(web, "src", arquivo)).href);
const [
  { montarMundo },
  { responderExperimental },
  { decidirTurno },
  { carregarCatalogoSkills },
  { classificarNivelSeguranca },
  { recuperarBoasPraticas },
] = await Promise.all([
  modulo("lib/ayla/__harness/cenario.ts"),
  modulo("lib/ayla/experimental.ts"),
  modulo("lib/conducao/decisao-do-turno.ts"),
  modulo("lib/ayla/catalogo-skills.ts"),
  modulo("lib/ayla/estado-seguranca.ts"),
  modulo("lib/conhecimento/recuperar.ts"),
]);

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const catalogo = await carregarCatalogoSkills(supabase);
if (catalogo.estado !== "ok") throw new Error(`Catálogo indisponível: ${catalogo.motivo}`);

const todosOsCasos = [
  ["comunicacao", "Ele me puxa pela mão quando quer alguma coisa."],
  ["atividade", "Ela não quer fazer nenhuma atividade."],
  ["sensorial_foco", "No mercado ele corre e parece que nem me escuta."],
  ["socializacao", "Ela fica sozinha no recreio."],
  ["brincadeira", "Ele só gira a roda do carrinho e chora se eu tento brincar diferente."],
  ["mudanca_abrupta", "Ele começou a ficar muito irritado do nada essa semana."],
];
const filtroCasos = new Set(
  (process.env.CASOS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
);
const casos = filtroCasos.size
  ? todosOsCasos.filter(([id]) => filtroCasos.has(id))
  : todosOsCasos;

const arquivo = resolve(raiz, "docs/auditorias/pos-conhecimento-ab-2026-09-24.json");
const anterior =
  process.env.RESUME === "1" && existsSync(arquivo)
    ? JSON.parse(readFileSync(arquivo, "utf8"))
    : null;

const saida = {
  data: new Date().toISOString(),
  desenho: {
    variavel: "quatro BPs propostas projetadas em memória no ramo B",
    constantes: ["mensagem", "modelo", "instruções", "Core", "catálogo", "Perfil sintético", "configuração"],
    escritaSupabase: false,
    whatsapp: false,
    aceiteObrigatorio: [
      "Entendeu o problema atual?",
      "Usou o que já sabia da criança quando disponível?",
      "Ajudou antes de investigar?",
      "Fez no máximo uma pergunta realmente decisiva?",
      "A resposta ficou curta/conversacional?",
      "O conhecimento técnico ficou por trás?",
      "Houve uma ação concreta que a família consegue testar?",
      "A resposta abriu naturalmente o próximo passo?",
      "Evitou repetir algo já conhecido?",
      "A mudança da Pós alterou uma decisão útil, e não apenas a redação?",
    ],
  },
  casos: (anterior?.casos ?? []).filter(
    (caso) => !(process.env.REPLACE === "1" && casos.some(([id]) => id === caso.id)),
  ),
};

const decidirComRetentativa = async (args, rotulo) => {
  let ultima;
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    ultima = await decidirTurno(args);
    if (ultima.origem === "gpt") return ultima;
    if (tentativa < 3) await new Promise((ok) => setTimeout(ok, 1_000 * tentativa));
  }
  throw new Error(`Decisor não concluiu ${rotulo}: ${ultima?.origem ?? "sem retorno"}`);
};

for (const [id, mensagem] of casos) {
  if (
    process.env.RESUME === "1" &&
    process.env.REPLACE !== "1" &&
    saida.casos.some((caso) => caso.id === id)
  ) continue;
  const porRamo = {};
  // A sempre roda antes de B em cada caso, para que a comparação fique
  // legível e qualquer falha interrompa antes de simular o conhecimento novo.
  for (const ramo of ["A", "B"]) {
    ramoAtual = ramo;
    consultas = [];
    chamadasModelo = [];
    const mundo = montarMundo({
      nomeMae: "Ana",
      criancas: [{ nome: "Leo", nascimento: "2020-01-01", genero: "masculino" }],
    });
    const memoria = mundo.db.cliente();
    const cliente = {
      from(tabela) {
        return ["ayla_documentos", "boas_praticas"].includes(tabela)
          ? supabase.from(tabela)
          : memoria.from(tabela);
      },
    };
    const decisao = await decidirComRetentativa({
      texto: mensagem,
      blocoEstado: "<estado>Família sintética. Leo tem 6 anos. Sem outros fatos.</estado>",
      catalogoSkills: catalogo.skills,
      catalogoDisponivel: true,
    }, `${id}/${ramo}`);
    const nivelSeguranca = classificarNivelSeguranca(mensagem);
    const falhas = [];
    const resposta = await responderExperimental(cliente, {
      familyId: mundo.familyId,
      mensagem,
      origem: "simulador",
      turnosSimulados: [],
      turnoClassificado: decisao,
      nivelSeguranca,
      onFalha: (motivo, detalhe) => falhas.push({ motivo, detalhe }),
    });
    if (!resposta) throw new Error(`Produtor não concluiu ${id}/${ramo}: ${JSON.stringify(falhas)}`);
    const bps = await recuperarBoasPraticas({
      supabase,
      skills: decisao.skills,
      idade: 6,
      limite: 2,
      relato: mensagem,
    });
    porRamo[ramo] = {
      decisao,
      nivelSeguranca,
      repertorio: bps.map((bp) => ({ id: bp.id, titulo: bp.titulo })),
      resposta: resposta.texto,
      metrica: resposta.metrica,
      falhas,
      chamadasModelo: chamadasModelo.length,
      traceBps: consultas
        .filter((c) => c.tabela === "boas_praticas")
        .map((c) => ({ select: c.select, url: c.url, rows: c.rows?.length ?? 0 })),
    };
    console.log(
      JSON.stringify({
        id,
        ramo,
        skills: decisao.skills,
        repertorio: porRamo[ramo].repertorio.map((bp) => bp.titulo),
        resposta: resposta.texto,
      }),
    );
  }
  saida.casos.push({ id, mensagem, ...porRamo });
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo, `${JSON.stringify(saida, null, 2)}\n`);
}

mkdirSync(dirname(arquivo), { recursive: true });
writeFileSync(arquivo, `${JSON.stringify(saida, null, 2)}\n`);
console.log(`Resultado: ${arquivo}`);
