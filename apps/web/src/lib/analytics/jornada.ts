import type { SupabaseClient } from "@supabase/supabase-js";
import { familiasInternas } from "./internos";

/**
 * "Jornada do Trial" — mapeia cada família numa FASE da jornada de trial
 * (baseado no playbook comercial da agência) usando dados reais: status da
 * assinatura, atividade (user_events) e a dor (diarios.desafio_area). Tudo
 * agregado e anônimo. Serve à aba homônima do dashboard da equipe de tráfego.
 */

export type FaseTrial =
  | "cadastrou"
  | "ativou_teste"
  | "ativado"
  | "engajado"
  | "em_risco"
  | "oportunidade"
  | "convertido"
  | "expirado";

/** Rótulo + explicação de cada fase — mostrados no próprio painel. */
export const FASE_INFO: Record<FaseTrial, { label: string; desc: string }> = {
  cadastrou: { label: "Cadastrou", desc: "Criou a conta — ainda sem uso." },
  ativou_teste: { label: "Ativou o teste", desc: "Entrou no app, mas não gerou nada ainda." },
  ativado: { label: "Ativado", desc: "Preencheu a criança e gerou a 1ª orientação." },
  engajado: { label: "Engajado", desc: "Usou 2 vezes ou mais — pegou o hábito." },
  em_risco: { label: "Em risco", desc: "Parou — sem atividade há mais de 24h." },
  oportunidade: { label: "Oportunidade", desc: "Reta final (dia 6-7), já usou, ainda não assinou." },
  convertido: { label: "Converteu", desc: "Assinou. 🎉" },
  expirado: { label: "Expirou sem assinar", desc: "O teste acabou sem virar assinatura." },
};

const CANAL_LABEL: Record<string, string> = {
  trafego_pago: "Tráfego pago",
  afiliado: "Afiliado",
  convite: "Convite",
  direto: "Direto",
};

/** desafio_area → rótulo amigável (dor principal). Fallback: o próprio valor. */
const AREA_LABEL: Record<string, string> = {
  sono: "Sono",
  nutricional: "Alimentação",
  alimentacao: "Alimentação",
  comunicacao: "Comunicação",
  emocional: "Regulação emocional",
  desafios_regulacao: "Regulação",
  regulacao: "Regulação",
  foco: "Foco e atenção",
  socializacao: "Socialização",
  motor: "Motor",
  rotina: "Rotina",
  autonomia: "Autonomia",
  escola: "Escola",
  sensorial: "Sensorial",
  aprendizado: "Aprendizado",
};

const MS_DIA = 24 * 60 * 60 * 1000;
/** Eventos que NÃO contam como "uso/orientação" (pageview e intenção). */
const NAO_USO = new Set(["tela_visitada", "checkout_iniciado", "form_submit"]);

type Rank = { label: string; n: number };

type FamRow = {
  id: string;
  created_at: string;
  onboarding_completed: boolean | null;
  afiliado_id: string | null;
  ref_codigo: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

type FunilOrigem = { cadastrou: number; ativado: number; converteu: number };

export type JornadaLead = {
  id: string;
  diaTrial: number;
  canal: string;
  canalLabel: string;
  origem: string;
  fase: FaseTrial;
  /** É conta de admin/agência (co-acesso)? Aparece na lista, marcada, mas fora das contagens. */
  interno: boolean;
};

export type JornadaData = {
  funil: { key: string; label: string; desc: string; n: number }[];
  emRisco: number;
  expirados: number;
  porOrigem: {
    canal: string;
    label: string;
    cadastrou: number;
    ativado: number;
    converteu: number;
  }[];
  /** Tráfego pago quebrado por campanha (utm_campaign). */
  porCampanha: { label: string; cadastrou: number; ativado: number; converteu: number }[];
  /** Tráfego pago quebrado por criativo (utm_content). */
  porCriativo: { label: string; cadastrou: number; ativado: number; converteu: number }[];
  /** Taxa de conversão trial→pago (assinantes / cadastros). */
  conversao: { taxa: number; assinantes: number; cadastros: number };
  dorRank: Rank[];
  leads: JornadaLead[];
  fases: Record<FaseTrial, { label: string; desc: string }>;
};

export async function carregarJornadaTrial(admin: SupabaseClient): Promise<JornadaData> {
  const agora = Date.now();
  const desde90 = new Date(agora - 90 * MS_DIA).toISOString();

  const [{ data: famsRaw }, { data: subs }, { data: events }, { data: afiliadosRows }, { data: diarios }] =
    await Promise.all([
      admin
        .from("family_accounts")
        .select(
          "id, created_at, onboarding_completed, afiliado_id, ref_codigo, utm_source, utm_campaign, utm_content",
        ),
      admin.from("subscription_accesses").select("family_account_id, status, trial_ends_at"),
      admin
        .from("user_events")
        .select("family_account_id, evento, created_at")
        .gte("created_at", desde90),
      admin.from("afiliados").select("id, nome, codigo_unico"),
      admin
        .from("diarios")
        .select("family_account_id, desafio_area")
        .not("desafio_area", "is", null)
        .gte("created_at", desde90),
    ]);

  const internas = await familiasInternas(admin);
  const fams = (famsRaw ?? []) as FamRow[];

  const subByFam = new Map<string, { status: string | null; trialEnds: string | null }>();
  for (const s of subs ?? [])
    subByFam.set(s.family_account_id as string, {
      status: (s.status as string) ?? null,
      trialEnds: (s.trial_ends_at as string | null) ?? null,
    });

  const afiliadoNome = new Map(
    (afiliadosRows ?? []).map((a) => [a.id as string, (a.nome as string) ?? (a.codigo_unico as string)]),
  );

  // Atividade por família (total = qualquer evento; usos = eventos de feature).
  const atividade = new Map<string, { total: number; usos: number; ultima: number }>();
  for (const e of events ?? []) {
    const fid = e.family_account_id as string | null;
    if (!fid) continue;
    const cur = atividade.get(fid) ?? { total: 0, usos: 0, ultima: 0 };
    cur.total += 1;
    if (!NAO_USO.has(e.evento as string)) cur.usos += 1;
    const t = new Date(e.created_at as string).getTime();
    if (t > cur.ultima) cur.ultima = t;
    atividade.set(fid, cur);
  }

  const canalDe = (f: FamRow): string => {
    if (f.afiliado_id) return "afiliado";
    if (f.utm_source) return "trafego_pago";
    if (f.ref_codigo) return "convite";
    return "direto";
  };
  const origemDe = (f: FamRow): string => {
    if (f.afiliado_id) return `Afiliado: ${afiliadoNome.get(f.afiliado_id) ?? f.afiliado_id}`;
    if (f.utm_source) return `${f.utm_source}${f.utm_campaign ? ` · ${f.utm_campaign}` : ""}`;
    if (f.ref_codigo) return `Convite: ${f.ref_codigo}`;
    return "Direto";
  };

  let cadastrou = 0,
    ativouTeste = 0,
    ativadoN = 0,
    engajadoN = 0,
    converteuN = 0,
    emRisco = 0,
    expirados = 0;
  const porOrigem = new Map<string, FunilOrigem>();
  const porCampanha = new Map<string, FunilOrigem>();
  const porCriativo = new Map<string, FunilOrigem>();
  const leads: JornadaLead[] = [];

  const bump = (m: Map<string, FunilOrigem>, key: string, ativado: boolean, pago: boolean) => {
    const cur = m.get(key) ?? { cadastrou: 0, ativado: 0, converteu: 0 };
    cur.cadastrou += 1;
    if (ativado) cur.ativado += 1;
    if (pago) cur.converteu += 1;
    m.set(key, cur);
  };

  for (const f of fams) {
    const interno = internas.has(f.id);
    const sub = subByFam.get(f.id);
    const status = sub?.status ?? null;
    const at = atividade.get(f.id) ?? { total: 0, usos: 0, ultima: 0 };
    const criado = new Date(f.created_at).getTime();
    const diaTrial = Math.min(7, Math.max(1, Math.floor((agora - criado) / MS_DIA) + 1));
    const usos = at.usos;
    const temAtividade = at.total > 0;
    const ativadoBool = Boolean(f.onboarding_completed) && usos >= 1;
    const engajadoBool = usos >= 2;
    const inativo = temAtividade && at.ultima > 0 && agora - at.ultima > MS_DIA;
    const trialEnds = sub?.trialEnds ? new Date(sub.trialEnds).getTime() : null;
    const trialVencido = status === "trialing" && trialEnds != null && trialEnds <= agora;

    // Funil cumulativo — só usuários REAIS (o interno fica de fora das contagens).
    if (!interno) {
      cadastrou += 1;
      if (temAtividade) ativouTeste += 1;
      if (ativadoBool) ativadoN += 1;
      if (engajadoBool) engajadoN += 1;
      if (status === "active") converteuN += 1;
    }

    // Fase atual (estado único, por prioridade).
    let fase: FaseTrial;
    if (status === "active") fase = "convertido";
    else if (trialVencido || status === "canceled" || status === "paused") fase = "expirado";
    else if (status === "trialing") {
      if (diaTrial >= 6 && usos >= 1) fase = "oportunidade";
      else if (inativo && usos >= 1) fase = "em_risco";
      else if (engajadoBool) fase = "engajado";
      else if (ativadoBool) fase = "ativado";
      else if (temAtividade) fase = "ativou_teste";
      else fase = "cadastrou";
    } else fase = "cadastrou";

    const canal = canalDe(f);
    // Contagens (fases + origem/campanha) só de usuários reais.
    if (!interno) {
      if (fase === "em_risco") emRisco += 1;
      if (fase === "expirado") expirados += 1;
      const converteu = status === "active";
      bump(porOrigem, canal, ativadoBool, converteu);
      if (f.utm_source) {
        bump(
          porCampanha,
          `${f.utm_source} · ${f.utm_campaign?.trim() || "(sem campanha)"}`,
          ativadoBool,
          converteu,
        );
        bump(porCriativo, f.utm_content?.trim() || "(sem criativo)", ativadoBool, converteu);
      }
    }

    // Lista TODOS (inclusive interno, marcado) — pra validar/testar sem esconder.
    if (status === "trialing" && !trialVencido) {
      leads.push({
        id: f.id,
        diaTrial,
        canal,
        canalLabel: CANAL_LABEL[canal] ?? canal,
        origem: origemDe(f),
        fase,
        interno,
      });
    }
  }

  const dorMap = new Map<string, number>();
  for (const d of diarios ?? []) {
    if (internas.has(d.family_account_id as string)) continue;
    const area = (d.desafio_area as string | null)?.trim();
    if (!area) continue;
    const label = AREA_LABEL[area] ?? area;
    dorMap.set(label, (dorMap.get(label) ?? 0) + 1);
  }
  const dorRank = [...dorMap.entries()]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  const funil = [
    { key: "cadastrou", label: "Cadastrou", desc: FASE_INFO.cadastrou.desc, n: cadastrou },
    { key: "ativou_teste", label: "Ativou o teste", desc: FASE_INFO.ativou_teste.desc, n: ativouTeste },
    { key: "ativado", label: "Ativado", desc: FASE_INFO.ativado.desc, n: ativadoN },
    { key: "engajado", label: "Engajado", desc: FASE_INFO.engajado.desc, n: engajadoN },
    { key: "convertido", label: "Converteu", desc: FASE_INFO.convertido.desc, n: converteuN },
  ];

  const porOrigemArr = ["trafego_pago", "afiliado", "convite", "direto"]
    .map((c) => ({
      canal: c,
      label: CANAL_LABEL[c],
      ...(porOrigem.get(c) ?? { cadastrou: 0, ativado: 0, converteu: 0 }),
    }))
    .filter((o) => o.cadastrou > 0);

  const mapToArr = (m: Map<string, FunilOrigem>) =>
    [...m.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.cadastrou - a.cadastrou)
      .slice(0, 12);

  const conversao = {
    assinantes: converteuN,
    cadastros: cadastrou,
    taxa: cadastrou > 0 ? Math.round((converteuN / cadastrou) * 100) : 0,
  };

  leads.sort((a, b) => b.diaTrial - a.diaTrial);

  return {
    funil,
    emRisco,
    expirados,
    porOrigem: porOrigemArr,
    porCampanha: mapToArr(porCampanha),
    porCriativo: mapToArr(porCriativo),
    conversao,
    dorRank,
    leads,
    fases: FASE_INFO,
  };
}

// ============================================================
// Versão ADMIN (com NOMES + contato) — /admin/jornada. Mesmas fases da versão
// anônima, mas nominal, pra o admin agir (mensagem custom por WhatsApp).
// ============================================================

export type JornadaAdminFamilia = {
  id: string;
  nomeMae: string;
  nomeCrianca: string | null;
  whatsapp: string | null;
  diaTrial: number;
  origem: string;
  ultimoUsoDias: number | null;
  dor: string | null;
  fase: FaseTrial;
  interno: boolean;
};

export type JornadaAdminData = {
  funil: { key: FaseTrial; label: string; desc: string; n: number }[];
  porFase: Record<FaseTrial, JornadaAdminFamilia[]>;
};

type FamAdminRow = FamRow & { whatsapp_e164: string | null };

export async function carregarJornadaAdmin(admin: SupabaseClient): Promise<JornadaAdminData> {
  const agora = Date.now();
  const desde90 = new Date(agora - 90 * MS_DIA).toISOString();

  const [
    { data: famsRaw },
    { data: subs },
    { data: events },
    { data: afiliadosRows },
    { data: diarios },
    { data: perfis },
    { data: membros },
  ] = await Promise.all([
    admin
      .from("family_accounts")
      .select(
        "id, created_at, onboarding_completed, whatsapp_e164, afiliado_id, ref_codigo, utm_source, utm_campaign, utm_content",
      ),
    admin.from("subscription_accesses").select("family_account_id, status, trial_ends_at"),
    admin
      .from("user_events")
      .select("family_account_id, evento, created_at")
      .gte("created_at", desde90),
    admin.from("afiliados").select("id, nome, codigo_unico"),
    admin
      .from("diarios")
      .select("family_account_id, desafio_area")
      .not("desafio_area", "is", null)
      .gte("created_at", desde90),
    admin.from("family_profiles").select("family_account_id, nome_mae, como_chamar"),
    admin
      .from("membros_atipicos")
      .select("family_account_id, nome, created_at")
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
  ]);

  const internas = await familiasInternas(admin);
  const fams = (famsRaw ?? []) as FamAdminRow[];

  const subByFam = new Map<string, { status: string | null; trialEnds: string | null }>();
  for (const s of subs ?? [])
    subByFam.set(s.family_account_id as string, {
      status: (s.status as string) ?? null,
      trialEnds: (s.trial_ends_at as string | null) ?? null,
    });

  const afiliadoNome = new Map(
    (afiliadosRows ?? []).map((a) => [a.id as string, (a.nome as string) ?? (a.codigo_unico as string)]),
  );

  const atividade = new Map<string, { total: number; usos: number; ultima: number }>();
  for (const e of events ?? []) {
    const fid = e.family_account_id as string | null;
    if (!fid) continue;
    const cur = atividade.get(fid) ?? { total: 0, usos: 0, ultima: 0 };
    cur.total += 1;
    if (!NAO_USO.has(e.evento as string)) cur.usos += 1;
    const t = new Date(e.created_at as string).getTime();
    if (t > cur.ultima) cur.ultima = t;
    atividade.set(fid, cur);
  }

  const nomeMaeByFam = new Map(
    (perfis ?? []).map((p) => [
      p.family_account_id as string,
      ((p.como_chamar as string | null)?.trim() || (p.nome_mae as string | null)?.trim() || "—") as string,
    ]),
  );
  const criancaByFam = new Map<string, string>();
  for (const m of membros ?? []) {
    const fid = m.family_account_id as string;
    if (!criancaByFam.has(fid)) criancaByFam.set(fid, m.nome as string);
  }

  // Dor por família: desafio_area mais frequente.
  const dorCont = new Map<string, Map<string, number>>();
  for (const d of diarios ?? []) {
    const fid = d.family_account_id as string;
    if (internas.has(fid)) continue;
    const area = (d.desafio_area as string | null)?.trim();
    if (!fid || !area) continue;
    const m = dorCont.get(fid) ?? new Map<string, number>();
    m.set(area, (m.get(area) ?? 0) + 1);
    dorCont.set(fid, m);
  }
  const dorByFam = new Map<string, string>();
  for (const [fid, m] of dorCont) {
    let melhor = "";
    let max = 0;
    for (const [area, n] of m) if (n > max) { max = n; melhor = area; }
    if (melhor) dorByFam.set(fid, AREA_LABEL[melhor] ?? melhor);
  }

  const canalDe = (f: FamAdminRow): string => {
    if (f.afiliado_id) return "afiliado";
    if (f.utm_source) return "trafego_pago";
    if (f.ref_codigo) return "convite";
    return "direto";
  };
  const origemDe = (f: FamAdminRow): string => {
    if (f.afiliado_id) return `Afiliado: ${afiliadoNome.get(f.afiliado_id) ?? f.afiliado_id}`;
    if (f.utm_source) return `${f.utm_source}${f.utm_campaign ? ` · ${f.utm_campaign}` : ""}`;
    if (f.ref_codigo) return `Convite: ${f.ref_codigo}`;
    return "Direto";
  };

  const vazio = (): Record<FaseTrial, JornadaAdminFamilia[]> => ({
    cadastrou: [], ativou_teste: [], ativado: [], engajado: [],
    em_risco: [], oportunidade: [], convertido: [], expirado: [],
  });
  const porFase = vazio();
  const cont: Record<string, number> = {};

  for (const f of fams) {
    const interno = internas.has(f.id);
    const sub = subByFam.get(f.id);
    const status = sub?.status ?? null;
    const at = atividade.get(f.id) ?? { total: 0, usos: 0, ultima: 0 };
    const criado = new Date(f.created_at).getTime();
    const diaTrial = Math.min(7, Math.max(1, Math.floor((agora - criado) / MS_DIA) + 1));
    const usos = at.usos;
    const temAtividade = at.total > 0;
    const ativadoBool = Boolean(f.onboarding_completed) && usos >= 1;
    const engajadoBool = usos >= 2;
    const inativo = temAtividade && at.ultima > 0 && agora - at.ultima > MS_DIA;
    const trialEnds = sub?.trialEnds ? new Date(sub.trialEnds).getTime() : null;
    const trialVencido = status === "trialing" && trialEnds != null && trialEnds <= agora;

    let fase: FaseTrial;
    if (status === "active") fase = "convertido";
    else if (trialVencido || status === "canceled" || status === "paused") fase = "expirado";
    else if (status === "trialing") {
      if (diaTrial >= 6 && usos >= 1) fase = "oportunidade";
      else if (inativo && usos >= 1) fase = "em_risco";
      else if (engajadoBool) fase = "engajado";
      else if (ativadoBool) fase = "ativado";
      else if (temAtividade) fase = "ativou_teste";
      else fase = "cadastrou";
    } else fase = "cadastrou";

    if (!interno) cont[fase] = (cont[fase] ?? 0) + 1; // contagem só de real

    porFase[fase].push({
      id: f.id,
      nomeMae: nomeMaeByFam.get(f.id) ?? "—",
      nomeCrianca: criancaByFam.get(f.id) ?? null,
      whatsapp: f.whatsapp_e164 ?? null,
      diaTrial,
      origem: origemDe(f),
      ultimoUsoDias: at.ultima > 0 ? Math.floor((agora - at.ultima) / MS_DIA) : null,
      dor: dorByFam.get(f.id) ?? null,
      fase,
      interno,
    });
  }

  const funil: { key: FaseTrial; label: string; desc: string; n: number }[] = (
    ["cadastrou", "ativou_teste", "ativado", "engajado", "em_risco", "oportunidade", "convertido", "expirado"] as FaseTrial[]
  ).map((k) => ({ key: k, label: FASE_INFO[k].label, desc: FASE_INFO[k].desc, n: cont[k] ?? 0 }));

  return { funil, porFase };
}
