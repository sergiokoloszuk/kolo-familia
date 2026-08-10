/**
 * BANCADA DO PILOTO 4A — infraestrutura comum aos portões A, B, C e D.
 *
 * ⚠️ O QUE ESTA BANCADA NÃO FAZ, e é a razão de ela existir.
 *
 * As bancadas de 09/08 (`scripts/ttft-web.mjs`, `scripts/gate-estrategias.mjs`)
 * RECONSTRUÍRAM o system à mão: núcleo de três linhas, sem VOZ_CONVERSA, sem
 * skills, sem formas de entrega, e com um modelo que não era o de produção.
 * Mediram um produto que não existe, e o "0 ofertas em 8 rodadas" que virou
 * "regressão" saiu dali (reclassificado em 10/08).
 *
 * Aqui NADA é reconstruído:
 *   WEB       → `assemblePrompt` + `gerarConversacional`, o par exato de
 *               `app/api/conversar/stream/route.ts`.
 *   WHATSAPP  → `gerarRespostaAyla`, a função de produção inteira, incluindo a
 *               rede da fronteira do diagnóstico.
 *   BASE 3    → `recuperarBoasPraticas` real, contra o banco (SELECT puro).
 *   BASE 2    → `secoesDe` real.
 *   4A        → `buildContextBlock` real monta perfil, âncora e licença.
 *
 * O que é sintético: SÓ a família. Nenhum id, nome, perfil ou conversa de
 * família real entra aqui.
 *
 * ⚠️ ZERO ESCRITA. O `supabase` do tracking é um stub que ESTOURA de propósito:
 * `logarUsoApi` engole o erro por design, então a chamada segue e nada é
 * gravado em `api_calls`. É o que permite exercitar o caminho de produção
 * inteiro sem tocar no banco.
 */
import { readFileSync } from "node:fs";

export const RAIZ = "D:/Projetos/Kolo Família";
const SRC = `${RAIZ}/apps/web/src`;

/** Família sintética do piloto — id que não existe e nunca existirá no banco. */
export const FAMILIA_PILOTO = "aaaaaaaa-4a4a-4a4a-4a4a-000000000001";
/** Família sintética de fora do piloto, para o contraste. */
export const FAMILIA_COMUM = "bbbbbbbb-4a4a-4a4a-4a4a-000000000002";

for (const l of readFileSync(`${RAIZ}/apps/web/.env.local`, "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

// O AMBIENTE DO PILOTO, como ele existirá na Vercel — e só para esta família.
process.env.IA_PROVIDER = "openai_teste";
process.env.OPENAI_TEST_FAMILY_IDS = FAMILIA_PILOTO;
process.env.KOLO_PILOTO_4A = "teste";
process.env.KOLO_PILOTO_4A_FAMILIAS = FAMILIA_PILOTO;

const { registerHooks } = await import("node:module");
registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/")) return next(`file:///${SRC}/${esp.slice(2)}.ts`, ctx);
    if (esp.startsWith(".") && !/\.[a-z]+$/.test(esp)) {
      try { return next(`${esp}.ts`, ctx); } catch { /* não era .ts */ }
    }
    if (esp === "next/headers" || esp === "next/cache")
      return { url: "data:text/javascript,export const cookies=()=>{throw 0};export const headers=()=>{throw 0};export const revalidatePath=()=>{};export const revalidateTag=()=>{};", shortCircuit: true };
    return next(esp, ctx);
  },
});
export const mod = (p) => import(`file:///${SRC}/${p}`);

export const { assemblePrompt } = await mod("lib/ia/prompt.ts");
export const { gerarConversacional, MODELO_CONVERSA, providerConversacionalParaFamilia } =
  await mod("lib/ia/provider.ts");
export const { gerarRespostaAyla } = await mod("lib/ayla/responder.ts");
export const { recuperarBoasPraticas, blocoBoasPraticas } = await mod("lib/conhecimento/recuperar.ts");
export const { secoesDe, temMaterial } = await mod("lib/conducao/base2.ts");
export const { pilotoQuatroA } = await mod("lib/conducao/piloto.ts");

/** Cliente que ESTOURA — a garantia de que nada é gravado. */
export const supabaseStub = {
  from() { throw new Error("BANCADA: escrita bloqueada de propósito"); },
};

/** O tracking que faz o provider escolher GPT, sem gravar nada. */
export const trackingPiloto = {
  supabase: supabaseStub,
  family_account_id: FAMILIA_PILOTO,
  feature: "bancada_piloto_4a",
};

/**
 * Cliente Supabase REAL, só-leitura, para `recuperarBoasPraticas`.
 * Implementa a fatia da API fluente que o recuperador usa. Qualquer método de
 * escrita estoura — a leitura é `GET /rest/v1/boas_praticas`, nada mais.
 */
export function supabaseSomenteLeitura() {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const H = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const proibido = (nome) => () => {
    throw new Error(`BANCADA: ${nome} bloqueado`);
  };
  return {
    from(tabela) {
      const filtros = [];
      let colunas = "*";
      const q = {
        select(c) { colunas = c; return q; },
        eq(col, val) { filtros.push(`${col}=eq.${encodeURIComponent(val)}`); return q; },
        in(col, vals) { filtros.push(`${col}=in.(${vals.map(encodeURIComponent).join(",")})`); return q; },
        or(expr) { filtros.push(`or=(${expr})`); return q; },
        order(col, o) { filtros.push(`order=${col}.${o?.ascending === false ? "desc" : "asc"}`); return q; },
        limit(n) { filtros.push(`limit=${n}`); return q; },
        lte(col, val) { filtros.push(`${col}=lte.${val}`); return q; },
        gte(col, val) { filtros.push(`${col}=gte.${val}`); return q; },
        is(col, val) { filtros.push(`${col}=is.${val}`); return q; },
        not(col, op, val) { filtros.push(`${col}=not.${op}.${val}`); return q; },
        insert: proibido("insert"), update: proibido("update"),
        upsert: proibido("upsert"), delete: proibido("delete"),
        then(res, rej) {
          const url = `${U}/rest/v1/${tabela}?select=${encodeURIComponent(colunas)}${filtros.length ? "&" + filtros.join("&") : ""}`;
          return fetch(url, { headers: { ...H, Range: "0-9999" } })
            .then((r) => r.json())
            .then((data) => ({ data: Array.isArray(data) ? data : [], error: Array.isArray(data) ? null : data }))
            .then(res, rej);
        },
      };
      return q;
    },
  };
}

/** Um `PerfilConsultavel` sintético com a forma exata que o loader produz. */
export function perfilSintetico(dominios) {
  return {
    membroId: "sintetico",
    dominios: new Map(
      Object.entries(dominios).map(([key, d]) => [
        key,
        {
          key,
          label: d.label,
          campos: d.campos,
          conhecidos: d.campos.filter((c) => c.estado === "preenchido"),
          lacunas: d.campos.filter((c) => c.estado === "vazio").map((c) => c.label),
        },
      ]),
    ),
    sabemos: () => false,
    valorDe: () => null,
    lacunasDe: () => [],
  };
}

/** ctx de `ContextoSkillResposta` — só a família é sintética. */
export function ctxWeb({ nome, idade, perfil, genero, secoes, perfilConsultavel, base2, bps, familia = {} }) {
  return {
    membroFoco: { id: "sintetico", nome, idade, perfil, genero, diagnosticoRegistrado: null, secoes },
    cuidador: { nome: "Ana", relacao: "mãe", genero: "feminino" },
    membros: [{ nome, idade, genero, perfil }],
    familia,
    diariosRecentes: [],
    ultimoCheckin: null,
    boasPraticas: bps,
    base2,
    perfilConsultavel,
    historico: [],
  };
}

export const SKILL_WEB = (nome) => [{
  name: nome,
  display_name: nome,
  objective: "apoiar a família no dia a dia desta criança",
  tone: "próximo, prático, sem jargão",
  scope: nome,
  limits: "não diagnostica, não prescreve",
  kolo_vivo_fields: ["essencial", nome],
  knowledge_tags: [nome],
}];

/** Recupera BPs pelo caminho REAL, com e sem o ranking da 4A. */
export async function recuperarReal({ skill, idade, relato, comRanking }) {
  const db = supabaseSomenteLeitura();
  return recuperarBoasPraticas({
    supabase: db,
    skills: [skill],
    tags: [skill],
    idade,
    relato: comRanking ? relato : undefined,
    statusAceitos: comRanking ? ["ativo", "rascunho"] : undefined,
    limite: comRanking ? 2 : undefined,
  });
}

export const base2Real = (tema) =>
  temMaterial(tema) ? secoesDe({ tema, estado: "investigacao", limite: 3 }) : [];

/** Uma chamada WEB pelo par exato da rota de produção. */
export async function chamarWeb({ skill, ctx, userInput, intencao, tema }) {
  const provider = providerConversacionalParaFamilia(FAMILIA_PILOTO);
  const model = MODELO_CONVERSA[provider];
  const { system, messages } = assemblePrompt({
    skills: SKILL_WEB(skill),
    ctx,
    userInput,
    modo: { kind: "conversa" },
    intencao,
    tema,
  });
  const systemTexto = system.map((b) => b.text).join("\n\n");
  const t0 = Date.now();
  const r = await gerarConversacional({
    provider, model, system: systemTexto, messages, maxTokens: 2048, cacheSystem: true,
  });
  return {
    provider, model, texto: r.texto.trim(), ms: Date.now() - t0,
    systemCh: systemTexto.length,
    userCh: messages.map((m) => m.content).join("\n").length,
    tokensIn: r.tokensIn, tokensOut: r.tokensOut,
    system: systemTexto, contexto: messages[messages.length - 1]?.content ?? "",
  };
}

/** Uma chamada WHATSAPP pela função de produção inteira. */
export async function chamarWhatsApp(params) {
  const t0 = Date.now();
  const texto = await gerarRespostaAyla(params, trackingPiloto);
  return { texto: texto.trim(), ms: Date.now() - t0 };
}

export const linha = (n = 78) => "█".repeat(n);
export const caixa = (t) => t.split("\n").map((l) => `  │ ${l}`).join("\n");
