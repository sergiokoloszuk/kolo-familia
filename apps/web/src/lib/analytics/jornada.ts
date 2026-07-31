import type { SupabaseClient } from "@supabase/supabase-js";
import { familiasInternas } from "./internos";
import { emailsPorFamilia } from "./emails";
import {
  classificarFase,
  estaAtivado,
  estaEngajado,
  FASE_INFO as FASES,
  type Fase,
  type SinaisDaFamilia,
} from "./fases";

/**
 * "Jornada do Trial" — mapeia cada família numa FASE da jornada de trial
 * (baseado no playbook comercial da agência) usando dados reais: status da
 * assinatura, atividade (user_events) e a dor (diarios.desafio_area). Tudo
 * agregado e anônimo. Serve à aba homônima do dashboard da equipe de tráfego.
 */

/** Alias histórico. A régua única vive em ./fases — não redeclarar aqui. */
export type FaseTrial = Fase;

/** Reexporta a regua unica — a definicao de cada fase vive em ./fases. */
export const FASE_INFO = FASES;

const CANAL_LABEL: Record<string, string> = {
  trafego_pago: "Tráfego pago",
  afiliado: "Afiliado",
  convite: "Convite",
  direto: "Direto",
};

/** utm_source cru → rótulo amigável. Fallback: o próprio valor. */
const SOURCE_LABEL: Record<string, string> = {
  facebookads: "Meta Ads",
  facebook: "Meta Ads",
  fb: "Meta Ads",
  instagram: "Meta Ads",
  ig: "Meta Ads",
  meta: "Meta Ads",
  google: "Google Ads",
  googleads: "Google Ads",
  google_ads: "Google Ads",
  adwords: "Google Ads",
  tiktok: "TikTok Ads",
};
const labelSource = (s: string) => SOURCE_LABEL[s.toLowerCase()] ?? s;

/** Separa a origem em canal amigável + campanha + criativo (pra tabela). */
function origemDetalhe(
  f: { afiliado_id: string | null; utm_source: string | null; utm_campaign: string | null; utm_content: string | null; ref_codigo: string | null },
  afiliadoNome: Map<string, string>,
): { canal: string; campanha: string | null; criativo: string | null } {
  if (f.afiliado_id)
    return { canal: `Afiliado: ${afiliadoNome.get(f.afiliado_id) ?? f.afiliado_id}`, campanha: null, criativo: null };
  if (f.utm_source)
    return {
      canal: labelSource(f.utm_source),
      campanha: f.utm_campaign?.trim() || null,
      criativo: f.utm_content?.trim() || null,
    };
  if (f.ref_codigo) return { canal: "Convite", campanha: f.ref_codigo, criativo: null };
  return { canal: "Direto", campanha: null, criativo: null };
}

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

/**
 * Sub-funil do ONBOARDING — decompõe o "Cadastrou". `family_accounts.onboarding_step`
 * (1→7) já grava até onde cada pessoa chegou (cada tela dá bumpStep). Zero rastreio
 * novo, zero mudança no fluxo. Cada etapa é cumulativa (quem chegou até aqui); a
 * QUEDA pra próxima é o abandono naquela tela.
 */
const ONBOARDING_ETAPAS: { atingiu: number; label: string; desc: string }[] = [
  { atingiu: 1, label: "Criou a conta", desc: "Cadastrou — total de contas." },
  { atingiu: 2, label: "Cadastrou a pessoa", desc: "Preencheu quem é a pessoa cuidada." },
  { atingiu: 3, label: "Deu o WhatsApp", desc: "Informou o número." },
  { atingiu: 4, label: "Aceitou os termos", desc: "Consentiu (a Ayla pode escrever)." },
  { atingiu: 7, label: "Concluiu o onboarding", desc: "Terminou e entrou no app." },
];

/**
 * O sub-funil do onboarding só considera cadastros a partir daqui — a coorte que
 * interessa (antes disso os passos não eram medidos do mesmo jeito). Fuso de SP.
 */
const ONBOARDING_DESDE = new Date("2026-07-06T00:00:00-03:00").getTime();
const ONBOARDING_DESDE_LABEL = "06/07/2026";

/** A tela em que a pessoa está PARADA agora (onboarding_step = próxima a preencher). */
const TELA_ATUAL: Record<number, string> = {
  1: "Preenchendo a pessoa",
  2: "No WhatsApp",
  3: "Nos termos",
  4: "Nos seus dados",
  7: "Concluiu",
};

/**
 * A PERGUNTA exata onde parou, do rascunho (0067). O `onboarding_step` sozinho
 * é grosso demais: as 7 primeiras perguntas do fluxo conversacional caem todas
 * em "Preenchendo a pessoa", que é onde 2 em cada 3 abandonos acontecem. Com o
 * rascunho dá pra saber se ela desistiu no nome da criança ou no laudo — coisas
 * bem diferentes. Cai no rótulo antigo quando não há rascunho.
 */
const PASSO_LABEL: Record<string, string> = {
  membro_nome: "No nome da criança",
  membro_genero: "No gênero da criança",
  membro_nascimento: "Na data de nascimento",
  membro_laudo: "No laudo",
  membro_investigacao: "No que está em investigação",
  desafios: "Nos desafios do dia a dia",
  membro_interesses: "Nos interesses da criança",
  whatsapp: "No WhatsApp",
  aceites: "Nos termos",
  voce_nome: "No seu nome",
  voce_relacao: "Na sua relação com a criança",
  voce_faixa: "Na sua faixa de idade",
  voce_horario: "No horário de contato",
};

export type FiltroJornada = { periodo?: string; origem?: string };

/** Janela de datas (por created_at) a partir do filtro de período. */
function janelaPeriodo(periodo: string, agora: number): { desde: number; ate: number } {
  const d = new Date(agora);
  const inicioMes = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const amanha = agora + MS_DIA;
  switch (periodo) {
    case "7d":
      return { desde: agora - 7 * MS_DIA, ate: amanha };
    case "30d":
      return { desde: agora - 30 * MS_DIA, ate: amanha };
    case "mes":
      return { desde: inicioMes, ate: amanha };
    case "mes_passado":
      return { desde: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), ate: inicioMes };
    default: // "tudo" = 90 dias
      return { desde: agora - 90 * MS_DIA, ate: amanha };
  }
}

/** A família passa no filtro de origem/canal? */
function passaOrigem(
  f: { utm_source: string | null; afiliado_id: string | null; ref_codigo: string | null },
  origem: string,
): boolean {
  if (!origem || origem === "todas") return true;
  const src = f.utm_source?.toLowerCase() ?? null;
  switch (origem) {
    case "trafego_pago":
      return !!f.utm_source;
    case "meta":
      return src != null && ["facebookads", "facebook", "fb", "instagram", "ig", "meta"].includes(src);
    case "google":
      return src != null && ["google", "googleads", "google_ads", "adwords"].includes(src);
    case "afiliado":
      return !!f.afiliado_id;
    case "direto":
      return !f.utm_source && !f.afiliado_id && !f.ref_codigo;
    default:
      return true;
  }
}

type Rank = { label: string; n: number };

type FamRow = {
  id: string;
  created_at: string;
  onboarding_completed: boolean | null;
  onboarding_step: number | null;
  afiliado_id: string | null;
  ref_codigo: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  whatsapp_e164: string | null;
};

type FunilOrigem = { cadastrou: number; ativado: number; converteu: number };

export type JornadaLead = {
  id: string;
  nomeMae: string;
  /** E-mail de login — fallback quando ainda não há nome (cadastrou sem onboarding). */
  email: string | null;
  diaTrial: number;
  criadoEm: string;
  canal: string;
  canalLabel: string;
  origem: string;
  origemCanal: string;
  campanha: string | null;
  criativo: string | null;
  fase: FaseTrial;
  /** Tela onde parou (ou "Concluiu") — decompõe o "Cadastrou" direto na lista. */
  onboardingLabel: string;
  /** Tem WhatsApp capturado (Tela 1)? Se sim, a Ayla consegue conversar/resgatar. */
  temWhatsapp: boolean;
  /** A PESSOA já escreveu pra Ayla (mensagem inbound)? Não vale só a Ayla ter falado. */
  falouComAyla: boolean;
  /** É conta de admin/agência (co-acesso)? Aparece na lista, marcada, mas fora das contagens. */
  interno: boolean;
};

/** Família para o drill-down: clicar numa fase/chip do funil lista quem está ali. */
export type FamiliaSegmento = {
  id: string;
  nomeMae: string;
  email: string | null;
  diaTrial: number;
  criadoEm: string;
  origemCanal: string;
  campanha: string | null;
  criativo: string | null;
  /** Último uso (ISO) ou null se nunca usou. */
  ultimoUso: string | null;
  whatsapp: string | null;
  fase: FaseTrial;
  /** Marcos cumulativos (o funil é cumulativo; a fase é o estado exclusivo). */
  ativou: boolean;
  ativado: boolean;
  engajado: boolean;
  /** Passo do onboarding (1-7) e a tela onde está parada — pra decompor "Cadastrou". */
  onboardingStep: number;
  onboardingLabel: string;
  /** Clicou em assinar (evento checkout_iniciado): quantas vezes e a última. */
  cliquesAssinar: number;
  ultimoCliqueAssinar: string | null;
  /** Assinatura: status cru, quando virou pagante e quando renova. */
  assinaturaStatus: string | null;
  assinouEm: string | null;
  renovaEm: string | null;
  cancelaNoFim: boolean;
};

export type JornadaData = {
  funil: { key: string; label: string; desc: string; n: number }[];
  /** Sub-funil do onboarding (cumulativo) — decompõe "Cadastrou" por onde a pessoa parou. */
  onboardingFunil: { label: string; desc: string; n: number }[];
  /** Data-corte do sub-funil do onboarding (só conta cadastros a partir daqui). */
  onboardingDesde: string;
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
  /** Todas as famílias reais com marcos + fase — pro drill-down por segmento. */
  todasFamilias: FamiliaSegmento[];
  fases: Record<FaseTrial, { label: string; definicao: string }>;
};

export async function carregarJornadaTrial(admin: SupabaseClient): Promise<JornadaData> {
  const agora = Date.now();
  const desde90 = new Date(agora - 90 * MS_DIA).toISOString();

  const [
    { data: famsRaw },
    { data: subs },
    { data: events },
    { data: afiliadosRows },
    { data: diarios },
    { data: perfis },
    { data: aylaInbound },
    { data: planos },
    { data: rascunhos },
  ] = await Promise.all([
    admin
      .from("family_accounts")
      .select(
        "id, created_at, onboarding_completed, onboarding_step, afiliado_id, ref_codigo, utm_source, utm_campaign, utm_content, whatsapp_e164",
      ),
    admin
      .from("subscription_accesses")
      .select(
        "family_account_id, status, trial_ends_at, current_period_end, cancel_at_period_end, updated_at",
      ),
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
    // Quem a PESSOA escreveu pra Ayla (inbound) — não vale só a Ayla ter falado.
    admin.from("ayla_messages").select("family_account_id").eq("direcao", "inbound"),
    // Quem já RECEBEU um plano (in-app OU pela Ayla) — o momento de valor = ativação.
    admin.from("planos").select("family_account_id"),
    // Rascunho do onboarding (0067) — query PRÓPRIA de propósito: se a coluna
    // ainda não existir, o erro morre aqui em vez de derrubar o dashboard todo.
    admin.from("family_accounts").select("id, onboarding_rascunho"),
  ]);

  const falouComAyla = new Set(
    (aylaInbound ?? []).map((m) => m.family_account_id as string).filter(Boolean),
  );
  const temPlano = new Set(
    (planos ?? []).map((p) => p.family_account_id as string).filter(Boolean),
  );
  // Rascunho por família: passo onde parou + nome que a pessoa já digitou.
  const rascunhoByFam = new Map<string, { passoId: string | null; voceNome: string }>();
  for (const r of rascunhos ?? []) {
    const raw = r.onboarding_rascunho as
      | { passoId?: string | null; answers?: Record<string, unknown> }
      | null;
    if (!raw) continue;
    const nome = typeof raw.answers?.voce_nome === "string" ? raw.answers.voce_nome.trim() : "";
    rascunhoByFam.set(r.id as string, { passoId: raw.passoId ?? null, voceNome: nome });
  }

  const internas = await familiasInternas(admin);
  const emailPorFam = await emailsPorFamilia(admin);
  const fams = (famsRaw ?? []) as FamRow[];

  // Nomes (co-acesso agora vê nome — Karina confia na agência). Só o nome da
  // mãe (identifica o lead p/ abordagem); nome de criança/dor fica de fora.
  const nomeMaeByFam = new Map(
    (perfis ?? []).map((p) => [
      p.family_account_id as string,
      ((p.como_chamar as string | null)?.trim() || (p.nome_mae as string | null)?.trim() || "") as string,
    ]),
  );

  const subByFam = new Map<
    string,
    {
      status: string | null;
      trialEnds: string | null;
      periodoFim: string | null;
      cancelaNoFim: boolean;
      atualizadoEm: string | null;
    }
  >();
  for (const s of subs ?? [])
    subByFam.set(s.family_account_id as string, {
      status: (s.status as string) ?? null,
      trialEnds: (s.trial_ends_at as string | null) ?? null,
      periodoFim: (s.current_period_end as string | null) ?? null,
      cancelaNoFim: Boolean(s.cancel_at_period_end),
      atualizadoEm: (s.updated_at as string | null) ?? null,
    });

  // Quem clicou em ASSINAR (checkout_iniciado): quantas vezes e quando foi a
  // última. É intenção de compra declarada — quem clicou e NÃO pagou é a lista
  // mais quente que existe pra abordar.
  const checkoutByFam = new Map<string, { n: number; ultimo: number }>();
  for (const e of events ?? []) {
    if (e.evento !== "checkout_iniciado") continue;
    const fid = e.family_account_id as string | null;
    if (!fid) continue;
    const cur = checkoutByFam.get(fid) ?? { n: 0, ultimo: 0 };
    cur.n += 1;
    const t = new Date(e.created_at as string).getTime();
    if (t > cur.ultimo) cur.ultimo = t;
    checkoutByFam.set(fid, cur);
  }

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
  // Contagem cumulativa por etapa do onboarding (índice = ONBOARDING_ETAPAS).
  const onbCount = ONBOARDING_ETAPAS.map(() => 0);
  const leads: JornadaLead[] = [];
  const todasFamilias: FamiliaSegmento[] = [];

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
    const trialEnds = sub?.trialEnds ? new Date(sub.trialEnds).getTime() : null;

    // COLETAR os sinais é trabalho daqui; DECIDIR a fase é de ./fases.
    // Era aqui que a régua divergia da do drill-down sem ninguém ter escolhido.
    const sinais: SinaisDaFamilia = {
      concluiuOnboarding: Boolean(f.onboarding_completed),
      usosUltimos90d: usos,
      temAtividade,
      temPlano: temPlano.has(f.id),
      falouComAyla: falouComAyla.has(f.id),
      horasSemAtividade: at.ultima > 0 ? (agora - at.ultima) / 3600_000 : null,
      statusAssinatura: status,
      trialVencido: status === "trialing" && trialEnds != null && trialEnds <= agora,
      diaDoTrial: diaTrial,
    };
    const ativadoBool = estaAtivado(sinais);
    const engajadoBool = estaEngajado(sinais);

    const step = Math.min(7, Math.max(1, f.onboarding_step ?? 1));
    const concluiuOnb = Boolean(f.onboarding_completed) || step >= 7;

    // Onde parou: a pergunta exata (rascunho) e, faltando ela, a tela grossa.
    const rasc = rascunhoByFam.get(f.id);
    const paradoEm = concluiuOnb
      ? "Concluiu"
      : (rasc?.passoId ? PASSO_LABEL[rasc.passoId] : null) ?? TELA_ATUAL[step] ?? `Passo ${step}`;
    // Nome: o perfil salvo vence; senão o que ela digitou antes de sumir.
    const nomeLead = nomeMaeByFam.get(f.id) || rasc?.voceNome || "";

    // Funil cumulativo — só usuários REAIS (o interno fica de fora das contagens).
    if (!interno) {
      cadastrou += 1;
      if (temAtividade) ativouTeste += 1;
      if (ativadoBool) ativadoN += 1;
      if (engajadoBool) engajadoN += 1;
      if (status === "active") converteuN += 1;
      // Sub-funil do onboarding (cumulativo) — só a coorte a partir de ONBOARDING_DESDE.
      if (criado >= ONBOARDING_DESDE) {
        for (let i = 0; i < ONBOARDING_ETAPAS.length; i++) {
          const passou = ONBOARDING_ETAPAS[i].atingiu >= 7 ? concluiuOnb : step >= ONBOARDING_ETAPAS[i].atingiu;
          if (passou) onbCount[i] += 1;
        }
      }
    }

    const fase = classificarFase(sinais);

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

    const det = origemDetalhe(f, afiliadoNome);
    const ultimoUso = at.ultima > 0 ? new Date(at.ultima).toISOString() : null;
    const checkout = checkoutByFam.get(f.id);

    // Drill-down por segmento: todas as famílias REAIS (sem interno, pra bater
    // com as contagens do funil), com marcos + fase.
    if (!interno) {
      todasFamilias.push({
        id: f.id,
        nomeMae: nomeLead,
        email: emailPorFam.get(f.id) ?? null,
        diaTrial,
        criadoEm: f.created_at,
        origemCanal: det.canal,
        campanha: det.campanha,
        criativo: det.criativo,
        ultimoUso,
        whatsapp: f.whatsapp_e164 ?? null,
        fase,
        ativou: temAtividade,
        ativado: ativadoBool,
        engajado: engajadoBool,
        onboardingStep: step,
        onboardingLabel: paradoEm,
        cliquesAssinar: checkout?.n ?? 0,
        ultimoCliqueAssinar: checkout ? new Date(checkout.ultimo).toISOString() : null,
        assinaturaStatus: status,
        // "Assinou em": não há carimbo próprio, mas em quem está `active` o
        // updated_at da assinatura é o momento em que o webhook do pagamento
        // virou a chave. Aproximação honesta — só mostramos pra active.
        assinouEm: status === "active" ? sub?.atualizadoEm ?? null : null,
        renovaEm: sub?.periodoFim ?? null,
        cancelaNoFim: Boolean(sub?.cancelaNoFim),
      });
    }

    // Lista TODOS (inclusive interno, marcado) — pra validar/testar sem esconder.
    if (status === "trialing" && !sinais.trialVencido) {
      leads.push({
        id: f.id,
        nomeMae: nomeLead,
        email: emailPorFam.get(f.id) ?? null,
        diaTrial,
        criadoEm: f.created_at,
        canal,
        canalLabel: CANAL_LABEL[canal] ?? canal,
        origem: origemDe(f),
        origemCanal: det.canal,
        campanha: det.campanha,
        criativo: det.criativo,
        fase,
        onboardingLabel: paradoEm,
        temWhatsapp: !!f.whatsapp_e164,
        falouComAyla: falouComAyla.has(f.id),
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
    { key: "cadastrou", label: FASE_INFO.cadastrou.label, desc: FASE_INFO.cadastrou.definicao, n: cadastrou },
    { key: "ativou_teste", label: FASE_INFO.ativou_teste.label, desc: FASE_INFO.ativou_teste.definicao, n: ativouTeste },
    { key: "ativado", label: FASE_INFO.ativado.label, desc: FASE_INFO.ativado.definicao, n: ativadoN },
    { key: "engajado", label: FASE_INFO.engajado.label, desc: FASE_INFO.engajado.definicao, n: engajadoN },
    { key: "convertido", label: FASE_INFO.convertido.label, desc: FASE_INFO.convertido.definicao, n: converteuN },
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

  const onboardingFunil = ONBOARDING_ETAPAS.map((et, i) => ({
    label: et.label,
    desc: et.desc,
    n: onbCount[i],
  }));

  return {
    funil,
    onboardingFunil,
    onboardingDesde: ONBOARDING_DESDE_LABEL,
    emRisco,
    expirados,
    porOrigem: porOrigemArr,
    porCampanha: mapToArr(porCampanha),
    porCriativo: mapToArr(porCriativo),
    conversao,
    dorRank,
    leads,
    todasFamilias,
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
  criadoEm: string;
  origem: string;
  origemCanal: string;
  campanha: string | null;
  criativo: string | null;
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
    { data: aylaInboundAdmin },
    { data: planosAdmin },
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
    // Os MESMOS sinais do funil. Sem estes dois, `classificarFase` receberia
    // false e a divergência voltaria — agora por falta de dado em vez de por
    // régua diferente, que é ainda mais difícil de enxergar.
    admin.from("ayla_messages").select("family_account_id").eq("direcao", "inbound"),
    admin.from("planos").select("family_account_id"),
  ]);

  const falouComAyla = new Set(
    (aylaInboundAdmin ?? []).map((m) => m.family_account_id as string).filter(Boolean),
  );
  const temPlano = new Set(
    (planosAdmin ?? []).map((p) => p.family_account_id as string).filter(Boolean),
  );

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
    const trialEnds = sub?.trialEnds ? new Date(sub.trialEnds).getTime() : null;

    // Mesma régua do funil. Antes esta cópia exigia uso no APP e ignorava
    // plano e conversa com a Ayla — subestimava justamente o canal principal.
    const fase = classificarFase({
      concluiuOnboarding: Boolean(f.onboarding_completed),
      usosUltimos90d: usos,
      temAtividade: at.total > 0,
      temPlano: temPlano.has(f.id),
      falouComAyla: falouComAyla.has(f.id),
      horasSemAtividade: at.ultima > 0 ? (agora - at.ultima) / 3600_000 : null,
      statusAssinatura: status,
      trialVencido: status === "trialing" && trialEnds != null && trialEnds <= agora,
      diaDoTrial: diaTrial,
    });

    if (!interno) cont[fase] = (cont[fase] ?? 0) + 1; // contagem só de real

    const det = origemDetalhe(f, afiliadoNome);
    porFase[fase].push({
      id: f.id,
      nomeMae: nomeMaeByFam.get(f.id) ?? "—",
      nomeCrianca: criancaByFam.get(f.id) ?? null,
      whatsapp: f.whatsapp_e164 ?? null,
      diaTrial,
      criadoEm: f.created_at,
      origem: origemDe(f),
      origemCanal: det.canal,
      campanha: det.campanha,
      criativo: det.criativo,
      ultimoUsoDias: at.ultima > 0 ? Math.floor((agora - at.ultima) / MS_DIA) : null,
      dor: dorByFam.get(f.id) ?? null,
      fase,
      interno,
    });
  }

  const funil: { key: FaseTrial; label: string; desc: string; n: number }[] = (
    ["cadastrou", "ativou_teste", "ativado", "engajado", "em_risco", "oportunidade", "convertido", "expirado"] as FaseTrial[]
  ).map((k) => ({ key: k, label: FASE_INFO[k].label, desc: FASE_INFO[k].definicao, n: cont[k] ?? 0 }));

  return { funil, porFase };
}
