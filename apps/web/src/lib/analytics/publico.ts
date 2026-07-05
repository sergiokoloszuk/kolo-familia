import type { SupabaseClient } from "@supabase/supabase-js";
import { familiasInternas } from "./internos";
import { idadeAnos } from "@/lib/idade";
import { localizacaoWhatsapp } from "@/lib/geo/telefone-uf";

/**
 * Dashboard 3 — Público. "Quem estamos atingindo?": perfil dos filhos, laudo,
 * idade, gênero, nº de filhos, dados do responsável, localização (aprox. pelo
 * WhatsApp) e cruzamentos úteis pro tráfego. Tudo AGREGADO e anônimo — exclui
 * contas internas (admin/co-acesso), igual aos outros dashboards.
 */

const MS_DIA = 86_400_000;

export type Rank = { label: string; n: number };

export type PublicoData = {
  totalFamilias: number;
  totalFilhos: number;
  perfilFilho: Rank[];
  comSemLaudo: { com: number; sem: number };
  idadeFilho: Rank[];
  generoFilho: Rank[];
  filhosPorFamilia: Rank[];
  generoResponsavel: Rank[];
  lacoResponsavel: Rank[];
  idadeMediaResponsavel: { media: number | null; n: number };
  localizacao: Rank[];
  // Bônus
  dorRank: Rank[];
  origemXPerfil: { origem: string; perfil: string; n: number }[];
  faixaXConversao: { faixa: string; cadastrou: number; assinou: number }[];
};

const PERFIL_LABEL: Record<string, string> = {
  TEA: "TEA (autismo)",
  TDAH: "TDAH",
  Dislexia: "Dislexia",
  AHSD: "Altas habilidades",
  Outro: "Outro",
  EmInvestigacao: "Em investigação",
};

const ORIGEM_LABEL: Record<string, string> = {
  facebookads: "Meta Ads",
  facebook: "Meta Ads",
  instagram: "Instagram",
  googleads: "Google Ads",
  google: "Google",
};

function faixaIdade(a: number | null): string {
  if (a == null) return "Não informado";
  if (a <= 3) return "0–3 anos";
  if (a <= 6) return "4–6 anos";
  if (a <= 12) return "7–12 anos";
  if (a <= 17) return "13–17 anos";
  return "18+ anos";
}

function rank(c: Map<string, number>): Rank[] {
  return [...c.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
}
function bump(c: Map<string, number>, k: string, by = 1) {
  c.set(k, (c.get(k) ?? 0) + by);
}

export async function carregarPublico(admin: SupabaseClient): Promise<PublicoData> {
  const desde90 = new Date(Date.now() - 90 * MS_DIA).toISOString();

  const [
    { data: accounts },
    { data: membros },
    { data: profiles },
    { data: subs },
    { data: diarios },
    internas,
  ] = await Promise.all([
    admin.from("family_accounts").select("id, whatsapp_e164, utm_source"),
    admin
      .from("membros_atipicos")
      .select("family_account_id, perfil, genero, data_nascimento, idade, diagnosticos_formais")
      .eq("ativo", true),
    admin
      .from("family_profiles")
      .select("family_account_id, genero_responsavel, papel, data_nascimento_mae"),
    admin.from("subscription_accesses").select("family_account_id, status"),
    admin
      .from("diarios")
      .select("family_account_id, desafio_area")
      .not("desafio_area", "is", null)
      .gte("created_at", desde90),
    familiasInternas(admin),
  ]);

  const real = (fid: string | null | undefined): fid is string => !!fid && !internas.has(fid);

  const fams = (accounts ?? []).filter((a) => real(a.id as string));
  const origemDe = (utm: string | null | undefined): string => {
    if (!utm) return "Direto";
    return ORIGEM_LABEL[utm.toLowerCase()] ?? utm;
  };
  const origemPorFam = new Map<string, string>();
  const statusPorFam = new Map<string, string>();
  for (const a of fams) origemPorFam.set(a.id as string, origemDe(a.utm_source as string | null));
  for (const s of subs ?? []) if (real(s.family_account_id as string)) statusPorFam.set(s.family_account_id as string, (s.status as string) ?? "");

  // ── Filhos ─────────────────────────────────────────────
  const perfilC = new Map<string, number>();
  const idadeC = new Map<string, number>();
  const generoC = new Map<string, number>();
  const filhosPorFam = new Map<string, number>();
  const origemPerfilC = new Map<string, number>();
  let comLaudo = 0;
  let semLaudo = 0;
  let totalFilhos = 0;

  const membrosReais = (membros ?? []).filter((m) => real(m.family_account_id as string));
  for (const m of membrosReais) {
    totalFilhos++;
    const fid = m.family_account_id as string;
    bump(filhosPorFam, fid);

    const perfil = (m.perfil as string) ?? "Outro";
    bump(perfilC, PERFIL_LABEL[perfil] ?? perfil);

    const diag = m.diagnosticos_formais;
    const temLaudo = Array.isArray(diag) && diag.length > 0;
    if (temLaudo) comLaudo++;
    else semLaudo++;

    const idade = idadeAnos((m.data_nascimento as string | null) ?? null) ?? (m.idade as number | null) ?? null;
    bump(idadeC, faixaIdade(idade));

    const g = m.genero as string | null;
    bump(generoC, g === "masculino" ? "Menino" : g === "feminino" ? "Menina" : "Não informado");

    const origem = origemPorFam.get(fid) ?? "Direto";
    bump(origemPerfilC, `${origem}||${PERFIL_LABEL[perfil] ?? perfil}`);
  }

  const filhosBucket = new Map<string, number>();
  for (const n of filhosPorFam.values()) bump(filhosBucket, n >= 3 ? "3+ filhos" : n === 2 ? "2 filhos" : "1 filho");

  // ── Responsável ────────────────────────────────────────
  const generoRespC = new Map<string, number>();
  const lacoC = new Map<string, number>();
  const idadesMae: number[] = [];
  const LACO: Record<string, string> = { mae: "Mãe", pai: "Pai", avo: "Avó", avoh: "Avô", outro: "Outro" };
  for (const p of profiles ?? []) {
    if (!real(p.family_account_id as string)) continue;
    const papel = (p.papel as string | null) ?? null;
    // Gênero do responsável: o campo genero_responsavel quase nunca é
    // preenchido — mas o LAÇO é. Derivamos do laço (mãe/avó→mulher,
    // pai/avô→homem) e só caímos no campo quando o laço não define (ex.: outro).
    let gen: "feminino" | "masculino" | null = null;
    if (papel === "mae" || papel === "avo") gen = "feminino";
    else if (papel === "pai" || papel === "avoh") gen = "masculino";
    else {
      const g = p.genero_responsavel as string | null;
      gen = g === "feminino" ? "feminino" : g === "masculino" ? "masculino" : null;
    }
    bump(generoRespC, gen === "feminino" ? "Mulher" : gen === "masculino" ? "Homem" : "Não informado");
    bump(lacoC, papel ? (LACO[papel] ?? "Outro") : "Não informado");
    const im = idadeAnos((p.data_nascimento_mae as string | null) ?? null);
    if (im != null) idadesMae.push(im);
  }
  const idadeMediaResponsavel = {
    media: idadesMae.length ? Math.round(idadesMae.reduce((a, b) => a + b, 0) / idadesMae.length) : null,
    n: idadesMae.length,
  };

  // ── Localização (aprox. pelo WhatsApp) ─────────────────
  const localC = new Map<string, number>();
  for (const a of fams) {
    const loc = localizacaoWhatsapp(a.whatsapp_e164 as string | null);
    if (loc) bump(localC, loc.br ? loc.label : `🌎 ${loc.label}`);
  }

  // ── Dores (90d) ────────────────────────────────────────
  const dorC = new Map<string, number>();
  for (const d of diarios ?? []) {
    if (!real(d.family_account_id as string)) continue;
    bump(dorC, (d.desafio_area as string) ?? "outro");
  }

  // ── Faixa etária (1º filho) × conversão ────────────────
  const faixaConv = new Map<string, { cadastrou: number; assinou: number }>();
  const jaContou = new Set<string>();
  for (const m of membrosReais) {
    const fid = m.family_account_id as string;
    if (jaContou.has(fid)) continue;
    jaContou.add(fid);
    const idade = idadeAnos((m.data_nascimento as string | null) ?? null) ?? (m.idade as number | null) ?? null;
    const faixa = faixaIdade(idade);
    const cur = faixaConv.get(faixa) ?? { cadastrou: 0, assinou: 0 };
    cur.cadastrou++;
    if (statusPorFam.get(fid) === "active") cur.assinou++;
    faixaConv.set(faixa, cur);
  }

  const ORDEM_FAIXA = ["0–3 anos", "4–6 anos", "7–12 anos", "13–17 anos", "18+ anos", "Não informado"];

  return {
    totalFamilias: fams.length,
    totalFilhos,
    perfilFilho: rank(perfilC),
    comSemLaudo: { com: comLaudo, sem: semLaudo },
    idadeFilho: rank(idadeC).sort((a, b) => ORDEM_FAIXA.indexOf(a.label) - ORDEM_FAIXA.indexOf(b.label)),
    generoFilho: rank(generoC),
    filhosPorFamilia: rank(filhosBucket),
    generoResponsavel: rank(generoRespC),
    lacoResponsavel: rank(lacoC),
    idadeMediaResponsavel,
    localizacao: rank(localC),
    dorRank: rank(dorC).slice(0, 10),
    origemXPerfil: rank(origemPerfilC)
      .slice(0, 12)
      .map((r) => {
        const [origem, perfil] = r.label.split("||");
        return { origem, perfil, n: r.n };
      }),
    faixaXConversao: ORDEM_FAIXA.filter((f) => faixaConv.has(f)).map((faixa) => ({
      faixa,
      ...faixaConv.get(faixa)!,
    })),
  };
}
