import type { SupabaseClient } from "@supabase/supabase-js";
import { AREAS_DIARIO } from "@/lib/ia/classificar-area";
import { familiasInternas } from "./internos";
import { emailsPorFamilia } from "./emails";
import { PERFIL_MEMBRO_SELECT } from "@/lib/kolo-vivo/leitura";

/**
 * Carrega e agrega os dados do dashboard de COMPORTAMENTO. Fonte única usada
 * por duas telas: /admin/comportamento (admin, com nomes/drill-down) e
 * /dashboards (analista de tráfego via co-acesso — renderiza só o agregado,
 * sem PII). Cruza histórico (Kolo Vivo, planos, lúdico, Ayla, diários) com os
 * eventos novos (user_events). Janela: 90 dias onde aplicável.
 */

export type Rank = { label: string; n: number };
export type FamRow = {
  id: string;
  nome: string | null;
  /** E-mail de login — fallback quando não há nome (cadastrou sem onboarding). */
  email: string | null;
  ayla: number;
  web: number;
  diarios: number;
  ludico: number;
  planos: number;
  ultima: number; // epoch ms (0 = sem atividade conhecida)
};

export type LeadTrial = {
  id: string;
  diaTrial: number; // 1..7
  diasRestantes: number | null;
  origem: string;
  ativado: boolean;
};

export type ComportamentoData = {
  totalFamilias: number;
  ativas7: number;
  ativas30: number;
  completudeMedia: number;
  checkoutFamilias: number;
  statusCount: Record<string, number>;
  aylaInbound: number;
  webConversas: number;
  domRank: Rank[];
  desafioRank: Rank[];
  planoRank: Rank[];
  ludico: { label: string; n: number; fam: number }[];
  telaRank: Rank[];
  featureRank: Rank[];
  topEngajadas: FamRow[];
  risco: FamRow[];
  // Funil de trial (pra agência/analista): ativação e ciclo dos leads em teste.
  ativacao: { trialTotal: number; ativados: number; taxa: number };
  leadsTrial: LeadTrial[];
};

// Domínios do Kolo Vivo (key → label, e onde mora). Espelha kolo-vivo/dominios.
const DOMINIOS: Array<{ key: string; toplevel: boolean; label: string }> = [
  { key: "sensorial", toplevel: true, label: "Sensorial" },
  { key: "essencial", toplevel: true, label: "O essencial" },
  { key: "como_e", toplevel: true, label: "Como é / interesses" },
  { key: "corpo_rotina", toplevel: true, label: "Corpo e rotina" },
  { key: "desafios_regulacao", toplevel: true, label: "Desafios (regulação)" },
  { key: "nutricional", toplevel: false, label: "Alimentação" },
  { key: "comunicacao", toplevel: false, label: "Comunicação" },
  { key: "emocional", toplevel: false, label: "Regulação emocional" },
  { key: "foco", toplevel: false, label: "Foco e atenção" },
  { key: "sono", toplevel: false, label: "Sono" },
  { key: "socializacao", toplevel: false, label: "Socialização" },
  { key: "motor", toplevel: false, label: "Motor" },
  { key: "rotina", toplevel: false, label: "Rotina" },
  { key: "autonomia", toplevel: false, label: "Autonomia" },
  { key: "aprendizado", toplevel: false, label: "Aprendizado" },
  { key: "imitacao", toplevel: false, label: "Imitação" },
  { key: "tela_midia", toplevel: false, label: "Tela e mídia" },
  { key: "escola", toplevel: false, label: "Escola" },
  { key: "saude_geral", toplevel: false, label: "Saúde geral" },
  { key: "gostos", toplevel: false, label: "Gostos" },
];

const MS_DIA = 24 * 60 * 60 * 1000;
const diasAtrasISO = (n: number) => new Date(Date.now() - n * MS_DIA).toISOString();

/** Tem algum conteúdo de verdade no jsonb do domínio? */
function temConteudo(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const s = JSON.stringify(v);
  return s.length > 2 && /[a-zA-ZÀ-ÿ0-9]/.test(s);
}

export async function carregarComportamento(
  admin: SupabaseClient,
): Promise<ComportamentoData> {
  const desde90 = diasAtrasISO(90);

  const internas = await familiasInternas(admin);
  const foraInterna = <T extends { family_account_id?: unknown; id?: unknown }>(
    rows: T[] | null,
    campo: "id" | "family_account_id",
  ): T[] => (rows ?? []).filter((r) => !internas.has(r[campo] as string));

  let [
    { data: familiasRows },
    { data: subs },
    { data: perfis },
    { data: diarios },
    { data: planos },
    { data: aylaMsgs },
    { data: conversas },
    { data: rotinas },
    { data: meditacoes },
    { data: desenhos },
    { data: historias },
    { data: events },
    { data: perfisFam },
    { data: afiliadosRows },
    { data: convUsos },
    { data: convites },
  ] = await Promise.all([
    admin
      .from("family_accounts")
      .select("id, created_at, afiliado_id, ref_codigo, utm_source, utm_campaign"),
    admin.from("subscription_accesses").select("family_account_id, status, trial_ends_at"),
    admin
      .from("perfil_vivo_membro")
      // Colunas do consumidor + a seleção canônica do perfil. As métricas de
      // completude seguem calculadas aqui como antes; só a lista de colunas
      // deixa de ser repetida.
      .select(`family_account_id, completude_pct, ${PERFIL_MEMBRO_SELECT}`),
    admin
      .from("diarios")
      .select("family_account_id, desafio_area, created_at")
      .gte("created_at", desde90),
    admin.from("planos").select("family_account_id, tema, created_at"),
    admin
      .from("ayla_messages")
      .select("family_account_id, direcao, created_at")
      .gte("created_at", desde90),
    admin.from("conversas").select("family_account_id, created_at").gte("created_at", desde90),
    admin.from("rotinas").select("family_account_id, created_at"),
    admin.from("meditacoes").select("family_account_id, created_at"),
    admin.from("desenhos").select("family_account_id, created_at"),
    admin.from("historias").select("family_account_id, created_at"),
    admin
      .from("user_events")
      .select("family_account_id, evento, detalhe, created_at")
      .gte("created_at", desde90),
    admin.from("family_profiles").select("family_account_id, nome_mae"),
    admin.from("afiliados").select("id, nome, codigo_unico"),
    admin.from("beta_invite_uses").select("family_account_id, invite_id"),
    admin.from("beta_invites").select("id, rotulo, codigo"),
  ]);

  // Tira admin + analista de tráfego (uso interno inflaria os números).
  if (internas.size > 0) {
    familiasRows = foraInterna(familiasRows, "id");
    subs = foraInterna(subs, "family_account_id");
    perfis = foraInterna(perfis, "family_account_id");
    diarios = foraInterna(diarios, "family_account_id");
    planos = foraInterna(planos, "family_account_id");
    aylaMsgs = foraInterna(aylaMsgs, "family_account_id");
    conversas = foraInterna(conversas, "family_account_id");
    rotinas = foraInterna(rotinas, "family_account_id");
    meditacoes = foraInterna(meditacoes, "family_account_id");
    desenhos = foraInterna(desenhos, "family_account_id");
    historias = foraInterna(historias, "family_account_id");
    events = foraInterna(events, "family_account_id");
    perfisFam = foraInterna(perfisFam, "family_account_id");
    convUsos = foraInterna(convUsos, "family_account_id");
  }

  const totalFamilias = (familiasRows ?? []).length;

  // Funil
  const statusCount: Record<string, number> = {};
  for (const s of subs ?? []) {
    const st = (s.status as string) ?? "—";
    statusCount[st] = (statusCount[st] ?? 0) + 1;
  }
  const checkoutFamilias = new Set(
    (events ?? []).filter((e) => e.evento === "checkout_iniciado").map((e) => e.family_account_id),
  ).size;

  // Kolo Vivo: domínios preenchidos + completude média
  const domPreenchido: Record<string, number> = {};
  let somaCompletude = 0;
  let nPerfis = 0;
  for (const p of perfis ?? []) {
    nPerfis += 1;
    somaCompletude += Number(p.completude_pct) || 0;
    const extras = (p.categorias_extras as Record<string, unknown> | null) ?? {};
    for (const d of DOMINIOS) {
      const val = d.toplevel ? (p as Record<string, unknown>)[d.key] : extras[d.key];
      if (temConteudo(val)) domPreenchido[d.key] = (domPreenchido[d.key] ?? 0) + 1;
    }
  }
  const completudeMedia = nPerfis ? Math.round(somaCompletude / nPerfis) : 0;
  const domRank = DOMINIOS.map((d) => ({ label: d.label, n: domPreenchido[d.key] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  // Desafios mais recorrentes
  const desafioCount: Record<string, number> = {};
  for (const d of diarios ?? []) {
    const a = d.desafio_area as string | null;
    if (a && AREAS_DIARIO[a]) desafioCount[a] = (desafioCount[a] ?? 0) + 1;
  }
  const desafioRank = Object.entries(desafioCount)
    .map(([k, n]) => ({ label: AREAS_DIARIO[k] ?? k, n }))
    .sort((a, b) => b.n - a.n);

  // Planos por tema
  const planoTema: Record<string, number> = {};
  for (const p of planos ?? []) {
    const t = ((p.tema as string | null) ?? "").trim() || "(sem tema)";
    planoTema[t] = (planoTema[t] ?? 0) + 1;
  }
  const planoRank = Object.entries(planoTema)
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);

  // Lúdico
  const distintas = (rows: { family_account_id: string | null }[] | null) =>
    new Set((rows ?? []).map((r) => r.family_account_id)).size;
  const ludico = [
    { label: "Rotinas", n: (rotinas ?? []).length, fam: distintas(rotinas) },
    { label: "Meditações", n: (meditacoes ?? []).length, fam: distintas(meditacoes) },
    { label: "Desenhos", n: (desenhos ?? []).length, fam: distintas(desenhos) },
    { label: "Histórias", n: (historias ?? []).length, fam: distintas(historias) },
  ].sort((a, b) => b.n - a.n);

  // Ayla × Web
  const aylaInbound = (aylaMsgs ?? []).filter((m) => m.direcao === "inbound").length;
  const webConversas = (conversas ?? []).length;

  // Telas + features (user_events)
  const telaCount: Record<string, number> = {};
  const featureCount: Record<string, number> = {};
  for (const e of events ?? []) {
    if (e.evento === "tela_visitada") {
      const tela = ((e.detalhe as Record<string, unknown>)?.tela as string) ?? "?";
      telaCount[tela] = (telaCount[tela] ?? 0) + 1;
    } else {
      featureCount[e.evento] = (featureCount[e.evento] ?? 0) + 1;
    }
  }
  const telaRank = Object.entries(telaCount).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  const featureRank = Object.entries(featureCount).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);

  // Por família: atividade combinada (recência + volumes)
  const nomePorFam = new Map(
    (perfisFam ?? []).map((p) => [p.family_account_id as string, (p.nome_mae as string | null) ?? null]),
  );
  const emailPorFam = await emailsPorFamilia(admin);
  const fam = new Map<string, FamRow>();
  const get = (id: string | null): FamRow | null => {
    if (!id) return null;
    let f = fam.get(id);
    if (!f) {
      f = {
        id,
        nome: nomePorFam.get(id) ?? null,
        email: emailPorFam.get(id) ?? null,
        ayla: 0,
        web: 0,
        diarios: 0,
        ludico: 0,
        planos: 0,
        ultima: 0,
      };
      fam.set(id, f);
    }
    return f;
  };
  const toca = (id: string | null, ts: string | null | undefined) => {
    const f = get(id);
    if (f && ts) f.ultima = Math.max(f.ultima, new Date(ts).getTime());
  };
  for (const m of aylaMsgs ?? []) {
    if (m.direcao === "inbound") {
      const f = get(m.family_account_id as string | null);
      if (f) f.ayla += 1;
    }
    toca(m.family_account_id as string | null, m.created_at as string);
  }
  for (const c of conversas ?? []) {
    const f = get(c.family_account_id as string | null);
    if (f) f.web += 1;
    toca(c.family_account_id as string | null, c.created_at as string);
  }
  for (const d of diarios ?? []) {
    const f = get(d.family_account_id as string | null);
    if (f) f.diarios += 1;
    toca(d.family_account_id as string | null, d.created_at as string);
  }
  for (const rows of [rotinas, meditacoes, desenhos, historias]) {
    for (const r of rows ?? []) {
      const f = get(r.family_account_id as string | null);
      if (f) f.ludico += 1;
      toca(r.family_account_id as string | null, r.created_at as string);
    }
  }
  for (const p of planos ?? []) {
    const f = get(p.family_account_id as string | null);
    if (f) f.planos += 1;
    toca(p.family_account_id as string | null, p.created_at as string);
  }
  for (const e of events ?? []) toca(e.family_account_id as string | null, e.created_at as string);

  const famArr = [...fam.values()];
  const agora = Date.now();
  const ativas7 = famArr.filter((f) => agora - f.ultima <= 7 * MS_DIA && f.ultima > 0).length;
  const ativas30 = famArr.filter((f) => agora - f.ultima <= 30 * MS_DIA && f.ultima > 0).length;
  const risco = famArr
    .filter((f) => f.ultima > 0 && agora - f.ultima > 7 * MS_DIA)
    .sort((a, b) => a.ultima - b.ultima)
    .slice(0, 20);
  const vol = (f: FamRow) => f.ayla + f.web + f.diarios + f.ludico + f.planos;
  const topEngajadas = [...famArr].sort((a, b) => vol(b) - vol(a)).slice(0, 20);

  // ── Leads em trial: dia do ciclo, origem e ativação (pra agência/analista) ──
  const afiliadoPorId = new Map(
    (afiliadosRows ?? []).map((a) => [a.id as string, (a.nome as string) ?? (a.codigo_unico as string)]),
  );
  const rotuloPorInvite = new Map(
    (convites ?? []).map((c) => [c.id as string, (c.rotulo as string | null) ?? (c.codigo as string)]),
  );
  const convitePorFam = new Map<string, string>();
  for (const u of convUsos ?? []) {
    const r = rotuloPorInvite.get(u.invite_id as string);
    if (r) convitePorFam.set(u.family_account_id as string, r);
  }
  const statusPorFam = new Map((subs ?? []).map((s) => [s.family_account_id as string, s]));
  const leadsTrial: LeadTrial[] = [];
  let ativadosTrial = 0;
  for (const fa of familiasRows ?? []) {
    const id = fa.id as string;
    const sub = statusPorFam.get(id);
    if ((sub?.status as string) !== "trialing") continue;
    const diaTrial = Math.min(
      7,
      Math.max(1, Math.floor((agora - new Date(fa.created_at as string).getTime()) / MS_DIA) + 1),
    );
    const trialEnds = (sub?.trial_ends_at as string | null) ?? null;
    const diasRestantes = trialEnds
      ? Math.ceil((new Date(trialEnds).getTime() - agora) / MS_DIA)
      : null;
    const ativado = fam.has(id); // teve qualquer atividade registrada
    if (ativado) ativadosTrial += 1;
    const afiliadoId = fa.afiliado_id as string | null;
    const refCodigo = fa.ref_codigo as string | null;
    const utmSource = fa.utm_source as string | null;
    const utmCampaign = fa.utm_campaign as string | null;
    const origem = afiliadoId
      ? `Afiliado: ${afiliadoPorId.get(afiliadoId) ?? afiliadoId}`
      : convitePorFam.get(id)
        ? `Convite: ${convitePorFam.get(id)}`
        : utmSource
          ? `${utmSource}${utmCampaign ? ` · ${utmCampaign}` : ""}`
          : refCodigo
            ? `Ref: ${refCodigo}`
            : "Direto";
    leadsTrial.push({ id, diaTrial, diasRestantes, origem, ativado });
  }
  leadsTrial.sort((a, b) => a.diaTrial - b.diaTrial);
  const trialTotal = leadsTrial.length;
  const ativacao = {
    trialTotal,
    ativados: ativadosTrial,
    taxa: trialTotal ? Math.round((ativadosTrial / trialTotal) * 100) : 0,
  };

  return {
    totalFamilias,
    ativas7,
    ativas30,
    completudeMedia,
    checkoutFamilias,
    statusCount,
    aylaInbound,
    webConversas,
    domRank,
    desafioRank,
    planoRank,
    ludico,
    telaRank,
    featureRank,
    topEngajadas,
    risco,
    ativacao,
    leadsTrial,
  };
}
