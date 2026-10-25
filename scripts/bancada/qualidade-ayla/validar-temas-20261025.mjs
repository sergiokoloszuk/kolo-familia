/** Produtores reais, pessoas fictícias; sem gravação externa ou disparo. */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { referenciasBase44 } from "./casos-base44-referencia.mjs";
const web = resolve(process.cwd(), "apps/web");
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(pathToFileURL(resolve(web, "src", `${specifier.slice(2)}.ts`)).href, context);
  if (["next/headers", "next/cache", "server-only"].includes(specifier)) return { url: "data:text/javascript,export const cookies=()=>{throw Error('sem request')};export const headers=cookies;export const revalidatePath=()=>{};export const revalidateTag=()=>{};", shortCircuit: true };
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes("/apps/web/src/")) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });
const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const originalFetch = globalThis.fetch;
let ultimoSystem = "";
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init.method ?? input?.method ?? "GET").toUpperCase();
  const read = url.origin === origin && method === "GET" && /\/rest\/v1\/(ayla_documentos|boas_praticas|specialist_prompt_templates)$/.test(url.pathname);
  const model = url.origin === "https://api.openai.com" && url.pathname === "/v1/chat/completions" && method === "POST";
  const classificacaoWeb = url.origin === "https://api.anthropic.com" && url.pathname === "/v1/messages" && method === "POST";
  if (!read && !model && !classificacaoWeb) throw new Error(`I/O bloqueada: ${method} ${url.origin}${url.pathname}`);
  if (model) {
    const body = JSON.parse(init.body);
    ultimoSystem = body.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  }
  return originalFetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(90_000) });
};
const mod = (p) => import(pathToFileURL(resolve(web, "src", p)).href);
const [{ montarMundo }, { responderExperimental }, { buildContext }, { assemblePrompt }, { loadActiveSkills }, { gerarConversacional, MODELO_CONVERSA }, { apoioTematico }, { prepararRespostaStream }, { decidirTurno }] = await Promise.all([
  mod("lib/ayla/__harness/cenario.ts"), mod("lib/ayla/experimental.ts"), mod("lib/ia/context.ts"), mod("lib/ia/prompt.ts"), mod("lib/ia/router.ts"), mod("lib/ia/provider.ts"), mod("lib/conducao/temas-conversa.ts"),
  mod("lib/ia/engine.ts"), mod("lib/conducao/decisao-do-turno.ts"),
]);
const remote = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const skills = await loadActiveSkills(remote);
console.log(JSON.stringify({ skillsAtivas: skills.map((s) => s.name) }));
const nora = { nome: "Nora", nascimento: "2007-02-12", genero: "feminino", sabe: {
  como_e: { texto: "Gosta de cinema e música; quer começar a trabalhar." },
  sensorial: "Evita cheiros fortes e não gosta de abraço.",
}, extras: { comunicacao: "Conversa fluentemente e expressa suas escolhas.", nutricional: "Aceita arroz, frango e batata. Já experimentou poke montado por ela, mas não sabemos os ingredientes escolhidos." } };
const casos = [
  { id: "abertura_alimentacao_com_registros", tema: "nutricional", pessoa: nora, mensagem: "Quero explorar Alimentação Positiva." },
  { id: "alimentacao_medo_de_nao_aprender", tema: "nutricional", pessoa: nora, mensagem: "Ela come arroz, frango e batata. Se coloco feijão ou salada, manda tirar. Eu insisto porque tenho medo de ela nunca aprender a comer outras coisas." },
  { id: "abertura_sono_sem_registros", tema: "sono", pessoa: nora, mensagem: "Quero explorar Sono Tranquilo." },
  { id: "comunicacao_quatro_anos", tema: "comunicacao", pessoa: { nome: "Luna", nascimento: "2022-02-12", genero: "feminino", sabe: { como_e: { interesses: ["ônibus"] } }, extras: { comunicacao: "Aponta para pedir objetos e conduz o adulto até o que quer. Não usa fala oral nem prancha atualmente." } }, mensagem: "Como posso ajudar ela a entender mais o contexto, explicar o que quer e entender o que eu peço?" },
];
const comparativo = process.argv[2] === "referencias";
const continuidade = process.argv[2] === "continuidade";
const filtros = comparativo || continuidade ? [] : process.argv[2]?.split(",") ?? [];
const casosDaRodada = continuidade ? referenciasBase44.filter((c) => ["ref_alimentacao", "ref_introducao_foco"].includes(c.id)) : comparativo ? referenciasBase44 : casos;
const rotulo = process.env.AYLA_BANCADA_ROTULO ?? "";
if (rotulo && !/^[a-z0-9-]+$/.test(rotulo)) throw new Error("Rótulo inválido");
const arquivo = resolve(process.cwd(), `docs/auditorias/ayla-temas-modelo-2026-10-25${continuidade ? "-continuidade" : comparativo ? "-referencias-base44" : filtros.length ? "-reteste" : ""}${rotulo ? `-${rotulo}` : ""}.json`);
if (existsSync(arquivo)) throw new Error("Referência já existe; use AYLA_BANCADA_ROTULO novo para preservar o histórico.");
const saida = { data: new Date().toISOString(), escopo: "Pessoas fictícias, dados em memória; biblioteca e templates só GET; produtor OpenAI real; sem WhatsApp, mensagens externas, atualização de Perfil ou cobrança de família.", resultados: [] };
function salvar() { mkdirSync(dirname(arquivo), { recursive: true }); writeFileSync(arquivo, JSON.stringify(saida, null, 2) + "\n"); }
async function produzir(caso, canal, flag = "on", historico = []) {
  process.env.AYLA_QUALIDADE_RESPOSTA_V2 = flag;
  const mundo = montarMundo({ nomeMae: "Ana", criancas: [caso.pessoa] });
  const db = { from(t) { return ["ayla_documentos", "boas_praticas", "specialist_prompt_templates"].includes(t) ? remote.from(t) : mundo.db.from(t); } };
  if (canal === "whatsapp") {
    const falhas = [];
    const decisao = continuidade ? await decidirTurno({ texto: caso.mensagem, blocoEstado: "<estado>Conversa de QA sem rotina, artefato ou ação pendente.</estado>",
      ultimaAyla: historico.filter((h) => h.papel === "assistant").at(-1)?.conteudo,
      ultimaMae: historico.filter((h) => h.papel === "user").at(-1)?.conteudo, temaAnterior: caso.tema, catalogoSkills: skills,
    }) : { intencao: "outro", tema: caso.tema, aceite: null, skills: [caso.tema], skillsAvaliadas: true };
    const r = await responderExperimental(db, { familyId: mundo.familyId, membroPreferidoId: mundo.membros[caso.pessoa.nome], mensagem: caso.mensagem, origem: "simulador", turnosSimulados: historico.map((h) => ({ quem: h.papel === "assistant" ? "ayla" : "mae", texto: h.conteudo })), turnoClassificado: decisao, onFalha: (motivo) => falhas.push(motivo) });
    if (!r) throw new Error(`${caso.id}: ${falhas.join()}`);
    return { canal, flag, texto: r.texto, modelo: r.metrica.modelo, ms: r.metrica.msTotal, base2Ids: r.metrica.base2_ids, guias: r.metrica.guias_tema, ...(continuidade ? { decisao } : {}),
      regrasConcisao: ultimoSystem.split("\n").filter((l) => /700|uma (?:ideia|orientação)|curt[oa]|bolhas|uma frente|UMA UNIDADE/.test(l)).map((l) => l.slice(0, 1800)),
    };
  }
  if (continuidade) {
    const conversaId = "00000000-0000-4000-8000-000000000001";
    mundo.db.semear("mensagens_skill", historico.map((h, i) => ({ conversa_id: conversaId, ...h, created_at: new Date(Date.UTC(2026, 9, 25, 12, 0, i)).toISOString(), metadata: { tema: caso.tema } })));
    const prompt = await prepararRespostaStream({ supabase: db, telemetria: mundo.db.cliente(), familyId: mundo.familyId, membroAtipicoId: mundo.membros[caso.pessoa.nome], conversaId, userInput: caso.mensagem, temaEscolhido: caso.tema });
    const r = await gerarConversacional({ provider: "openai", model: MODELO_CONVERSA.openai, system: prompt.system.map((b) => b.text).join("\n\n"), messages: prompt.messages, maxTokens: 2300, cacheSystem: true });
    return { canal, flag, texto: r.texto, modelo: r.model, ms: r.ms, base2Ids: prompt.base2Ids, areaAtiva: prompt.areaAtiva, intencao: prompt.intencao };
  }
  const selecionadas = skills.filter((s) => s.name === caso.tema);
  if (!selecionadas.length) throw new Error(`Skill inexistente: ${caso.tema}`);
  const ctx = await buildContext(db, { familyId: mundo.familyId, membroAtipicoId: mundo.membros[caso.pessoa.nome], skills: selecionadas, conversaId: null, relato: caso.mensagem });
  const prompt = assemblePrompt({ skills: selecionadas, ctx, userInput: caso.mensagem, modo: { kind: "conversa" }, intencao: "desafio", tema: caso.tema });
  const r = await gerarConversacional({ provider: "openai", model: MODELO_CONVERSA.openai, system: prompt.system.map((b) => b.text).join("\n\n"), messages: prompt.messages, maxTokens: 2300, cacheSystem: true });
  return { canal, flag, texto: r.texto, modelo: r.model, ms: r.ms, base2Ids: flag === "on" ? apoioTematico([caso.tema], "web").secoes.map((s) => s.id) : [], fatosEntregues: { nome: ctx.membroFoco?.nome, idade: ctx.membroFoco?.idade, secoes: ctx.membroFoco?.secoes } };
}
for (const caso of casosDaRodada.filter((c) => !filtros.length || filtros.includes(c.id))) {
  for (const canal of ["web", "whatsapp"]) {
    const historico = [];
    const mensagens = continuidade ? [caso.mensagem, "Quero a primeira opção que você ofereceu no fim.", "Me dê ideias de outras coisas que posso te pedir sobre isso."] : [caso.mensagem];
    for (const [turno, mensagem] of mensagens.entries()) {
      const r = await produzir({ ...caso, mensagem }, canal, "on", historico);
      saida.resultados.push({ id: caso.id, turno, tema: caso.tema, mensagem, perfil: caso.pessoa, ...r });
      historico.push({ papel: "user", conteudo: mensagem }, { papel: "assistant", conteudo: r.texto });
      salvar(); console.log(JSON.stringify({ id: caso.id, turno, canal, chars: r.texto.length, ms: r.ms }));
    }
  }
}
// Baseline off no mesmo pedido alimentar, sem alterar o artefato histórico da PR.
for (const canal of (filtros.length || comparativo || continuidade ? [] : ["web", "whatsapp"])) {
  const r = await produzir(casos[1], canal, "off");
  saida.resultados.push({ id: casos[1].id, tema: casos[1].tema, mensagem: casos[1].mensagem, perfil: casos[1].pessoa, ...r }); salvar();
}
console.log(JSON.stringify({ arquivo, total: saida.resultados.length }));
