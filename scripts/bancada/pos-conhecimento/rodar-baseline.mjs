/**
 * Baseline da incorporação cirúrgica de conhecimento da Pós.
 *
 * Usa decisão, produtor, Core, catálogo, BPs e provider reais. A família é
 * sintética e todas as tabelas familiares ficam no banco em memória do
 * harness. Na rede, somente GET no Supabase e POST no provider são aceitos.
 * Não persiste conversa e não envia WhatsApp.
 *
 * node --env-file=apps/web/.env.local --use-system-ca \
 *   --experimental-transform-types scripts/bancada/pos-conhecimento/rodar-baseline.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import { createClient } from "@supabase/supabase-js";

const raiz = process.cwd();
const web = resolve(raiz, "apps/web");
const fase = process.env.FASE ?? "ANTES";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(
        pathToFileURL(resolve(web, "src", `${specifier.slice(2)}.ts`)).href,
        context,
      );
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
let consultas = [];
let chamadasModelo = [];

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
  );
  const method = (init.method ?? input?.method ?? "GET").toUpperCase();
  const leituraSupabase =
    url.origin === supabaseOrigin &&
    method === "GET" &&
    [
      "/rest/v1/ayla_documentos",
      "/rest/v1/boas_praticas",
      "/rest/v1/specialist_prompt_templates",
    ].includes(url.pathname);
  const chamadaProvider =
    url.origin === "https://api.openai.com" &&
    url.pathname === "/v1/chat/completions" &&
    method === "POST";

  if (!leituraSupabase && !chamadaProvider) {
    throw new Error(`I/O fora da bancada bloqueado: ${method} ${url.origin}${url.pathname}`);
  }

  if (chamadaProvider) {
    const corpo = JSON.parse(init.body ?? "{}");
    chamadasModelo.push({
      modelo: corpo.model ?? null,
      mensagens: corpo.messages ?? [],
    });
  }

  const resposta = await fetchReal(input, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(60_000),
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${method} ${url.pathname}`);

  if (leituraSupabase) {
    consultas.push({
      tabela: url.pathname.split("/").at(-1),
      select: url.searchParams.get("select"),
      url: `${url.pathname}${url.search}`,
      rows: await resposta.clone().json(),
    });
  }
  return resposta;
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

const casos = [
  ["comunicacao", "Ele me puxa pela mão quando quer alguma coisa."],
  ["atividade", "Ela não quer fazer nenhuma atividade."],
  ["sensorial_foco", "No mercado ele corre e parece que nem me escuta."],
  ["socializacao", "Ela fica sozinha no recreio."],
  ["brincadeira", "Ele só gira a roda do carrinho e chora se eu tento brincar diferente."],
  ["mudanca_abrupta", "Ele começou a ficar muito irritado do nada essa semana."],
];

const resultado = {
  data: new Date().toISOString(),
  fase,
  criterioNorte: {
    fonte: "AYLA_KOLO_FAMILIA_PROMPT_MESTRE.pdf (transcrição fiel versionada em docs/documentos-ayla/prompt-mestre-agencia-v1.md)",
    regraFinal:
      "A Ayla da Kolo Família entendeu o que está acontecendo e me mostrou algo que eu consigo fazer.",
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
  ambiente: {
    familia: "sintética",
    idade: 6,
    persistencia: false,
    whatsapp: false,
    banco: "somente leitura para Core, catálogo e BPs",
    provider: "real",
  },
  casos: [],
};

for (const [id, mensagem] of casos) {
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
  const decisao = await decidirTurno({
    texto: mensagem,
    blocoEstado: "<estado>Família sintética. Leo tem 6 anos. Sem outros fatos.</estado>",
    catalogoSkills: catalogo.skills,
    catalogoDisponivel: true,
  });
  if (decisao.origem !== "gpt") throw new Error(`Decisor não concluiu ${id}: ${decisao.origem}`);

  const falhas = [];
  const nivelSeguranca = classificarNivelSeguranca(mensagem);
  const resposta = await responderExperimental(cliente, {
    familyId: mundo.familyId,
    mensagem,
    origem: "simulador",
    turnosSimulados: [],
    turnoClassificado: decisao,
    nivelSeguranca,
    onFalha: (motivo, detalhe) => falhas.push({ motivo, detalhe }),
  });
  if (!resposta) throw new Error(`Produtor não concluiu ${id}: ${JSON.stringify(falhas)}`);

  // Prova independente dos ids que o recuperador real escolhe. O produtor
  // expõe apenas a contagem na métrica; repetir a leitura, sem nova chamada de
  // modelo e sem persistência, torna o baseline auditável por título e id.
  const bpsEscolhidas = await recuperarBoasPraticas({
    supabase,
    skills: decisao.skills,
    idade: 6,
    limite: 2,
    relato: mensagem,
  });

  const detalhes = bpsEscolhidas.map((bp) => ({ id: bp.id, titulo: bp.titulo }));
  resultado.casos.push({
    id,
    mensagem,
    nivelSeguranca,
    decisao,
    repertorio: detalhes,
    resposta: resposta.texto,
    metrica: resposta.metrica,
    falhas,
    chamadasModelo: chamadasModelo.length,
    traceBps: consultas
      .filter((c) => c.tabela === "boas_praticas")
      .map((c) => ({ select: c.select, url: c.url, rows: c.rows?.length ?? 0 })),
  });
  console.log(
    JSON.stringify({
      id,
      skills: decisao.skills,
      nivelSeguranca,
      repertorio: detalhes.map((bp) => bp.titulo),
      resposta: resposta.texto,
    }),
  );
}

const saida = resolve(
  raiz,
  fase === "PRODUCAO"
    ? "docs/auditorias/pos-conhecimento-producao-seis-casos-2026-09-24.json"
    : "docs/auditorias/pos-conhecimento-antes-2026-09-24.json",
);
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, `${JSON.stringify(resultado, null, 2)}\n`);
console.log(`Resultado: ${saida}`);
