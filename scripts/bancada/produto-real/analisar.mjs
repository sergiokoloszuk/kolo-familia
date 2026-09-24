/**
 * Análise observacional do produto real — somente leitura.
 *
 * Produz apenas agregações e trechos anonimizados. Bloqueia qualquer método
 * diferente de GET no Supabase e não chama modelo, WhatsApp ou terceiros.
 *
 * node --env-file=apps/web/.env.local --use-system-ca \
 *   scripts/bancada/produto-real/analisar.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const INICIO = "2026-09-06T00:00:00.000Z";
const AGORA = new Date();
const JANELA_MS = 72 * 60 * 60 * 1000;
const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !K) throw new Error("Variáveis do Supabase ausentes");

const origem = new URL(U).origin;
const fetchReal = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init.method ?? input?.method ?? "GET").toUpperCase();
  if (url.origin !== origem || method !== "GET") {
    throw new Error(`I/O fora da análise bloqueado: ${method} ${url.origin}${url.pathname}`);
  }
  return fetchReal(input, { ...init, signal: init.signal ?? AbortSignal.timeout(60_000) });
};

const sb = createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });

async function lerTudo(tabela, colunas, configurar = (q) => q) {
  const saida = [];
  const lote = 1000;
  for (let inicio = 0; ; inicio += lote) {
    let q = sb.from(tabela).select(colunas).range(inicio, inicio + lote - 1);
    q = configurar(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabela}: ${error.message}`);
    saida.push(...(data ?? []));
    if ((data ?? []).length < lote) break;
  }
  return saida;
}

const [
  familias,
  acessos,
  staff,
  mensagens,
  chamadas,
  feedbacks,
  avaliacoes,
  planos,
  rotinas,
  relatorios,
  mensagensWeb,
  membros,
  perfisFamilia,
  perfisMembro,
  documentos,
] = await Promise.all([
  lerTudo("family_accounts", "id,user_id,created_at,onboarding_completed"),
  lerTudo(
    "subscription_accesses",
    "family_account_id,status,trial_ends_at,current_period_end,cortesia,cortesia_ate,pagamento_falhou_em,created_at,updated_at",
  ),
  lerTudo("controle_acessos", "user_id,ativo"),
  lerTudo(
    "ayla_messages",
    "family_account_id,direcao,category,tipo,texto,metadata,created_at,enviada_em,recebida_em,respondeu",
    (q) => q.gte("created_at", INICIO).order("created_at", { ascending: true }),
  ),
  lerTudo(
    "api_calls",
    "family_account_id,provider,model,feature,input_tokens,output_tokens,custo_usd,meta,created_at",
    (q) => q.gte("created_at", INICIO).order("created_at", { ascending: true }),
  ),
  lerTudo("feedbacks", "family_account_id,origem,tipo,texto,status,created_at"),
  lerTudo("avaliacao_maes", "family_account_id,nps,comentario,permite_publicar,created_at"),
  lerTudo(
    "planos",
    "family_account_id,origem,resultado,resultado_em,resultado_nota,created_at",
    (q) => q.gte("created_at", INICIO),
  ),
  lerTudo(
    "rotinas",
    "family_account_id,cards_status,modo_exibicao,resultado,resultado_em,resultado_nota,created_at",
    (q) => q.gte("created_at", INICIO),
  ),
  lerTudo(
    "relatorios_gerados",
    "family_account_id,destinatario,created_at",
    (q) => q.gte("created_at", INICIO),
  ),
  lerTudo(
    "mensagens_skill",
    "family_account_id,papel,conteudo,skills_acionadas,output_type,metadata,created_at",
    (q) => q.gte("created_at", INICIO).order("created_at", { ascending: true }),
  ),
  lerTudo("membros_atipicos", "family_account_id,nome"),
  lerTudo("family_profiles", "family_account_id,nome_mae,como_chamar"),
  lerTudo(
    "perfil_vivo_membro",
    "family_account_id,completude_pct,essencial,como_e,corpo_rotina,desafios_regulacao,sensorial,categorias_extras,updated_at",
  ),
  lerTudo(
    "ayla_documentos",
    "chave,versao,status,publicado_em,updated_at",
    (q) => q.eq("status", "ativo"),
  ),
]);

const usersStaff = new Set(staff.filter((x) => x.ativo).map((x) => x.user_id));
const familiasStaff = new Set(familias.filter((x) => usersStaff.has(x.user_id)).map((x) => x.id));
const familiaReal = (id) => Boolean(id) && !familiasStaff.has(id);
const msgs = mensagens.filter((x) => familiaReal(x.family_account_id));
const calls = chamadas.filter((x) => !x.family_account_id || familiaReal(x.family_account_id));
const web = mensagensWeb.filter((x) => familiaReal(x.family_account_id));

const nomes = new Map();
function guardarNome(fid, valor) {
  if (!fid || !valor || String(valor).trim().length < 2) return;
  if (!nomes.has(fid)) nomes.set(fid, new Set());
  nomes.get(fid).add(String(valor).trim());
}
for (const x of membros) guardarNome(x.family_account_id, x.nome);
for (const x of perfisFamilia) {
  guardarNome(x.family_account_id, x.nome_mae);
  guardarNome(x.family_account_id, x.como_chamar);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function anonimizar(texto, fid) {
  let t = String(texto ?? "");
  for (const nome of nomes.get(fid) ?? []) {
    t = t.replace(new RegExp(`\\b${esc(nome)}\\b`, "giu"), "[nome]");
  }
  return t
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, "[e-mail]")
    .replace(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/g, "[telefone]")
    .replace(/https?:\/\/\S+/giu, "[link]")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[documento]")
    .slice(0, 900);
}
function anonId(fid) {
  return `F-${createHash("sha256").update(`produto-2026-09-24:${fid}`).digest("hex").slice(0, 8)}`;
}

const porFamilia = new Map();
for (const m of msgs) {
  if (!porFamilia.has(m.family_account_id)) porFamilia.set(m.family_account_id, []);
  porFamilia.get(m.family_account_id).push(m);
}
for (const xs of porFamilia.values()) xs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

const atribuicoes = [];
for (const [fid, xs] of porFamilia) {
  let pendentes = [];
  for (const m of xs) {
    if (m.direcao === "outbound") {
      pendentes.push(m);
      continue;
    }
    if (m.direcao === "inbound" && pendentes.length) {
      const saida = pendentes.at(-1);
      const demoraMs = new Date(m.created_at) - new Date(saida.created_at);
      atribuicoes.push({ fid, saida, entrada: m, demoraMs });
      pendentes = [];
    }
  }
}
const porSaida = new Map(atribuicoes.map((x) => [x.saida, x]));

const mediana = (valores) => {
  const xs = valores.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const i = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[i] : Math.round((xs[i - 1] + xs[i]) / 2);
};
const percent = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);
const contagem = (xs, chave) => Object.fromEntries(
  [...xs.reduce((m, x) => m.set(chave(x) ?? "(nulo)", (m.get(chave(x) ?? "(nulo)") ?? 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1]),
);
const diaBR = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

const RE = {
  como: /\b(como|me mostra|me ensina|passo a passo|o que eu faço)\b/iu,
  resultado: /\b(funcionou|deu certo|tentei|testei|fiz|melhorou|piorou|ficou igual|não mudou|nao mudou)\b/iu,
  cta: /\b(se quiser|quer que eu|posso te|me conta|você consegue|voce consegue)\b/iu,
  acao: /\b(tente|faça|faca|diga|combine|ofereça|ofereca|mostre|reduza|observe|comece|peça|peca|use|espere)\b/iu,
  tecnico: /\b(neuro|sensorial|regulação|regulacao|executiv|pragmát|pragmat|hipótese|hipotese|reforço|reforco|propriocep|vestibular)\w*/iu,
  lista: /(^|\n)\s*(?:[-•]|\d+[.)]|[1-9]️⃣)/u,
  frasePronta: /[“”"](.{3,80})[“”"]/u,
};

function caracteristicas(saidas) {
  const dados = saidas.map((m) => String(m.texto ?? ""));
  return {
    n: saidas.length,
    chars_mediana: mediana(dados.map((x) => x.length)),
    acima_700_pct: percent(dados.filter((x) => x.length > 700).length, dados.length),
    com_pergunta_pct: percent(dados.filter((x) => x.includes("?")).length, dados.length),
    mais_de_uma_pergunta_pct: percent(dados.filter((x) => (x.match(/\?/g) ?? []).length > 1).length, dados.length),
    com_cta_pct: percent(dados.filter((x) => RE.cta.test(x)).length, dados.length),
    com_acao_pct: percent(dados.filter((x) => RE.acao.test(x)).length, dados.length),
    com_frase_pronta_pct: percent(dados.filter((x) => RE.frasePronta.test(x)).length, dados.length),
    com_lista_pct: percent(dados.filter((x) => RE.lista.test(x)).length, dados.length),
    com_termo_tecnico_pct: percent(dados.filter((x) => RE.tecnico.test(x)).length, dados.length),
  };
}

const outbounds = msgs.filter((x) => x.direcao === "outbound");
const inbounds = msgs.filter((x) => x.direcao === "inbound");
const maduras = outbounds.filter((x) => AGORA - new Date(x.created_at) >= JANELA_MS);
const respondeu24 = maduras.filter((x) => (porSaida.get(x)?.demoraMs ?? Infinity) <= 24 * 60 * 60 * 1000);
const respondeu72 = maduras.filter((x) => (porSaida.get(x)?.demoraMs ?? Infinity) <= JANELA_MS);
const semResposta72 = maduras.filter((x) => !porSaida.has(x) || porSaida.get(x).demoraMs > JANELA_MS);

function respostaPorRecorte(saidas) {
  const madurasDoRecorte = saidas.filter((x) => AGORA - new Date(x.created_at) >= JANELA_MS);
  const sim24 = madurasDoRecorte.filter((x) => (porSaida.get(x)?.demoraMs ?? Infinity) <= 24 * 60 * 60 * 1000);
  const nao72 = madurasDoRecorte.filter((x) => !porSaida.has(x) || porSaida.get(x).demoraMs > JANELA_MS);
  return {
    maduras: madurasDoRecorte.length,
    respondeu_24h: sim24.length,
    respondeu_24h_pct: percent(sim24.length, madurasDoRecorte.length),
    com_resposta_24h: caracteristicas(sim24),
    sem_resposta_72h: caracteristicas(nao72),
  };
}

const respostaPorTipo = {};
for (const [tipo] of Object.entries(contagem(outbounds, (x) => x.tipo))) {
  respostaPorTipo[tipo] = respostaPorRecorte(outbounds.filter((x) => (x.tipo ?? "(nulo)") === tipo));
}

const familiasComInbound = [...porFamilia.entries()].filter(([, xs]) => xs.some((x) => x.direcao === "inbound"));
const atividadeFamilias = familiasComInbound.map(([fid, xs]) => {
  const entradas = xs.filter((x) => x.direcao === "inbound");
  const dias = [...new Set(entradas.map((x) => diaBR(x.created_at)))].sort();
  return { fid, entradas: entradas.length, dias, primeiro: entradas[0]?.created_at, ultimo: entradas.at(-1)?.created_at };
});

const porFeature = contagem(calls, (x) => x.feature);
const porModelo = contagem(calls, (x) => `${x.provider}/${x.model}`);
const metaKeys = contagem(
  outbounds.flatMap((x) => Object.keys(x.metadata && typeof x.metadata === "object" ? x.metadata : {})),
  (x) => x,
);

const acessoPorFamilia = new Map(acessos.map((x) => [x.family_account_id, x]));
const familiasPosCore = familias.filter((x) => familiaReal(x.id) && new Date(x.created_at) >= new Date(INICIO));
const trialCohort = familiasPosCore.map((f) => {
  const a = acessoPorFamilia.get(f.id);
  const entradas = (porFamilia.get(f.id) ?? []).filter((x) => x.direcao === "inbound");
  const dias = [...new Set(entradas.map((x) => diaBR(x.created_at)))].sort();
  const primeiroDia = dias[0];
  const d1 = primeiroDia
    ? diaBR(new Date(new Date(`${primeiroDia}T12:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000))
    : null;
  return {
    fid: f.id,
    criadoEm: f.created_at,
    status: a?.status ?? "sem_linha",
    trialEnds: a?.trial_ends_at ?? null,
    entradas: entradas.length,
    diasAtivos: dias.length,
    voltouD1: Boolean(d1 && dias.includes(d1)),
    voltouOutroDia: dias.length >= 2,
    onboarding: Boolean(f.onboarding_completed),
  };
});

const trialD1Observavel = trialCohort.filter(
  (x) => x.onboarding && AGORA - new Date(x.criadoEm) >= 48 * 60 * 60 * 1000,
);
const trialMaturado = trialCohort.filter(
  (x) => x.onboarding && AGORA - new Date(x.criadoEm) >= 8 * 24 * 60 * 60 * 1000,
);

const resultados = (xs) => ({
  criados: xs.length,
  familias: new Set(xs.filter((x) => familiaReal(x.family_account_id)).map((x) => x.family_account_id)).size,
  com_resultado: xs.filter((x) => x.resultado || x.resultado_em).length,
  notas: contagem(xs.filter((x) => x.resultado_nota != null), (x) => String(x.resultado_nota)),
});

function trecho(m) {
  return {
    direcao: m.direcao,
    tipo: m.tipo,
    categoria: m.category,
    em: m.created_at,
    texto: anonimizar(m.texto, m.family_account_id),
  };
}

const candidatos = [];
for (const [fid, xs] of porFamilia) {
  for (let i = 0; i < xs.length; i++) {
    const atual = xs[i];
    if (atual.direcao !== "outbound") continue;
    const prox = xs.slice(i + 1).find((x) => x.direcao === "inbound");
    const ant = [...xs.slice(0, i)].reverse().find((x) => x.direcao === "inbound");
    const indiceProx = prox ? xs.indexOf(prox) : -1;
    const respostaAoProx = indiceProx >= 0
      ? xs.slice(indiceProx + 1).find((x) => x.direcao === "outbound")
      : null;
    const demora = prox ? new Date(prox.created_at) - new Date(atual.created_at) : Infinity;
    const tipo = prox && RE.resultado.test(prox.texto ?? "")
      ? "retorno_de_teste"
      : prox && RE.como.test(prox.texto ?? "")
        ? "pedido_de_como"
        : atual.category === "proativa" && demora <= JANELA_MS
          ? "resposta_a_iniciativa"
          : prox && diaBR(prox.created_at) !== diaBR(atual.created_at) && demora <= 7 * 24 * 60 * 60 * 1000
            ? "retorno_em_outro_dia"
            : !prox || demora > JANELA_MS
              ? "sem_resposta_72h"
              : "continuidade_curta";
    candidatos.push({
      tipo,
      familia: anonId(fid),
      demora_horas: Number.isFinite(demora) ? Math.round((demora / 3_600_000) * 10) / 10 : null,
      conversa: [ant, atual, prox, respostaAoProx].filter(Boolean).map(trecho),
      chars_resposta: String(atual.texto ?? "").length,
    });
  }
}

const amostras = [];
for (const tipo of [
  "retorno_de_teste",
  "pedido_de_como",
  "resposta_a_iniciativa",
  "retorno_em_outro_dia",
  "sem_resposta_72h",
]) {
  const opcoes = candidatos.filter((x) => x.tipo === tipo && x.conversa.length >= 2);
  if (tipo === "sem_resposta_72h") opcoes.sort((a, b) => b.chars_resposta - a.chars_resposta);
  else opcoes.sort((a, b) => (a.demora_horas ?? Infinity) - (b.demora_horas ?? Infinity));
  const escolhido = opcoes.find((x) => !amostras.some((a) => a.familia === x.familia));
  if (escolhido) amostras.push(escolhido);
}

const candidatosParaRevisao = {};
for (const tipo of [...new Set(candidatos.map((x) => x.tipo))]) {
  candidatosParaRevisao[tipo] = candidatos
    .filter((x) => x.tipo === tipo && x.conversa.length >= 2)
    .sort((a, b) => {
      if (tipo === "sem_resposta_72h") return b.chars_resposta - a.chars_resposta;
      return (a.demora_horas ?? Infinity) - (b.demora_horas ?? Infinity);
    })
    .slice(0, 10);
}

const relatorio = {
  gerado_em: AGORA.toISOString(),
  periodo: { inicio: INICIO, fim: AGORA.toISOString(), motivo: "janela pós-ativação do Core v11" },
  privacidade: "contas internas excluídas; IDs pseudonimizados; nomes, contatos, documentos e links redigidos",
  fontes: {
    mensagens_whatsapp: msgs.length,
    chamadas_api: calls.length,
    mensagens_web: web.length,
    familias_total: familias.length,
    familias_internas_excluidas: familiasStaff.size,
    feedbacks: feedbacks.filter((x) => familiaReal(x.family_account_id)).length,
    avaliacoes: avaliacoes.filter((x) => familiaReal(x.family_account_id)).length,
  },
  producao: { documentos_ativos: documentos },
  trafego: {
    inbound: inbounds.length,
    outbound: outbounds.length,
    familias_com_inbound: familiasComInbound.length,
    tipos_outbound: contagem(outbounds, (x) => x.tipo),
    categorias_outbound: contagem(outbounds, (x) => x.category),
    features_api: porFeature,
    modelos_api: porModelo,
    metadata_keys_outbound: metaKeys,
  },
  continuidade: {
    familias_um_dia: atividadeFamilias.filter((x) => x.dias.length === 1).length,
    familias_dois_ou_mais_dias: atividadeFamilias.filter((x) => x.dias.length >= 2).length,
    familias_cinco_ou_mais_dias: atividadeFamilias.filter((x) => x.dias.length >= 5).length,
    outbound_maduro_72h: maduras.length,
    respondeu_24h: respondeu24.length,
    respondeu_24h_pct: percent(respondeu24.length, maduras.length),
    respondeu_72h: respondeu72.length,
    respondeu_72h_pct: percent(respondeu72.length, maduras.length),
    comparacao_associativa: {
      com_resposta_24h: caracteristicas(respondeu24),
      sem_resposta_72h: caracteristicas(semResposta72),
      ressalva: "associação observacional; não prova que a forma da mensagem causou resposta ou silêncio",
    },
    por_categoria: {
      reativa: respostaPorRecorte(outbounds.filter((x) => x.category === "reativa")),
      proativa: respostaPorRecorte(outbounds.filter((x) => x.category === "proativa")),
    },
    por_tipo: respostaPorTipo,
    entradas_pedindo_como: inbounds.filter((x) => RE.como.test(x.texto ?? "")).length,
    entradas_relato_de_resultado: inbounds.filter((x) => RE.resultado.test(x.texto ?? "")).length,
  },
  trial: {
    familias_novas: trialCohort.length,
    onboarding_concluido: trialCohort.filter((x) => x.onboarding).length,
    com_qualquer_inbound: trialCohort.filter((x) => x.entradas > 0).length,
    voltou_d1: trialCohort.filter((x) => x.voltouD1).length,
    voltou_outro_dia: trialCohort.filter((x) => x.voltouOutroDia).length,
    voltou_outro_dia_pct_dos_que_conversaram: percent(
      trialCohort.filter((x) => x.voltouOutroDia).length,
      trialCohort.filter((x) => x.entradas > 0).length,
    ),
    d1_observavel: trialD1Observavel.length,
    voltou_d1_pct_observavel: percent(trialD1Observavel.filter((x) => x.voltouD1).length, trialD1Observavel.length),
    coorte_maturada_8_dias: trialMaturado.length,
    convertidos_na_coorte_maturada: trialMaturado.filter((x) => x.status === "active").length,
    conversao_maturada_pct: percent(trialMaturado.filter((x) => x.status === "active").length, trialMaturado.length),
    trial_valido_agora: trialCohort.filter(
      (x) => x.status === "trialing" && x.trialEnds && new Date(x.trialEnds) > AGORA,
    ).length,
    trial_expirado_agora: trialCohort.filter(
      (x) => x.status === "trialing" && x.trialEnds && new Date(x.trialEnds) <= AGORA,
    ).length,
    status_atual: contagem(trialCohort, (x) => x.status),
    observacao: "status atual não prova conversão atribuível à conversa; famílias recentes ainda têm janela incompleta",
  },
  recursos: {
    planos: resultados(planos.filter((x) => familiaReal(x.family_account_id))),
    rotinas: resultados(rotinas.filter((x) => familiaReal(x.family_account_id))),
    relatorios: {
      criados: relatorios.filter((x) => familiaReal(x.family_account_id)).length,
      familias: new Set(relatorios.filter((x) => familiaReal(x.family_account_id)).map((x) => x.family_account_id)).size,
    },
    web: {
      mensagens: web.length,
      familias: new Set(web.map((x) => x.family_account_id)).size,
      papeis: contagem(web, (x) => x.papel),
      outputs: contagem(web, (x) => x.output_type),
    },
    perfil_vivo: {
      familias_com_perfil: new Set(perfisMembro.filter((x) => familiaReal(x.family_account_id)).map((x) => x.family_account_id)).size,
      completude_mediana: mediana(perfisMembro.filter((x) => familiaReal(x.family_account_id)).map((x) => Number(x.completude_pct))),
    },
  },
  conversas_representativas_candidatas: amostras,
  candidatos_anonimizados_para_revisao: candidatosParaRevisao,
};

const saida = resolve("docs/auditorias/produto-real-2026-09-24.json");
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, `${JSON.stringify(relatorio, null, 2)}\n`);
console.log(JSON.stringify({ saida, fontes: relatorio.fontes, trafego: relatorio.trafego, continuidade: relatorio.continuidade, trial: relatorio.trial, recursos: relatorio.recursos }, null, 2));
