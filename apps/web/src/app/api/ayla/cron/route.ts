import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logServerError, logEvent } from "@/lib/log";
import { horaLocalHHMM, hojeLocalISO } from "@/lib/idade";
import { gerarSnapshotMensal } from "@/lib/evolucao/snapshot";
import {
  sendRotinaDiaria,
  sendEngajamento,
  sendTrial,
  sendVideoGuia,
  sendEmocionalStreak,
  sendProximoInsight,
  sendRepertorioSugestao,
  sendPlanoSeguimento,
  sendRecuperacaoPlano,
  sendRecuperacaoRotina,
  sendOfertaFimDeSemana,
  sendCampanha,
  type CampanhaCategoria,
} from "@/lib/ayla/orchestrator";
import { detectAndPersist } from "@/lib/ayla/insightEngine";
import { runRegrasParaFamilia } from "@/lib/regras/engine";
import { enviarTexto, verificarStatusZapi } from "@/lib/ayla/whatsappSender";
import {
  reconciliarDivergencias,
  alertaOperacionalRecente,
  KIND_ALERTA_OPERACIONAL,
} from "@/lib/stripe/reconciliacao";
import { assinaturaLiberada } from "@/lib/auth/assinatura";
import { familiasDeStaff } from "@/lib/auth/acesso";

/**
 * Cron da Ayla — chamado por scheduler externo (n8n, Vercel Cron, etc.).
 *
 * Tipos suportados via query param `?tipo=`:
 *   - rotina       — manda pergunta diária (PRD §12.9.1)
 *   - inatividade  — detecta 2 e 5 dias sem responder (PRD §12.9.2)
 *   - comercial    — trial D-3 e D-0 (PRD §12.9.3)
 *   - emocional    — streak 7 dias (PRD §12.9.3)
 *   - insights     — detecta padrões + envia próximo pendente (PRD §12.9.4)
 *
 * Protegido por CRON_SECRET no header `Authorization: Bearer <secret>`.
 * Sem o env, qualquer um pode disparar — só no dev.
 *
 * O Vercel Cron chama via GET (e já injeta o header Authorization com o
 * CRON_SECRET); n8n/manual chamam via POST. Os dois caem no mesmo handler.
 */
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "rotina";

  const supabase = createServiceRoleClient();

  try {
    if (tipo === "rotina") return await runRotina(supabase);
    if (tipo === "inatividade") return await runInatividade(supabase);
    if (tipo === "comercial") return await runComercial(supabase);
    if (tipo === "emocional") return await runEmocional(supabase);
    if (tipo === "insights") return await runInsights(supabase);
    if (tipo === "repertorio") return await runRepertorio(supabase);
    if (tipo === "seguimento") return await runSeguimento(supabase);
    if (tipo === "recuperacao_plano") return await runRecuperacaoPlano(supabase);
    if (tipo === "recuperacao_plano_3min") return await runRecuperacaoPlano(supabase, "3min");
    if (tipo === "alerta_assinatura") return await runAlertaAssinatura(supabase);
    if (tipo === "video_guia") return await runVideoGuia(supabase);
    if (tipo === "fim_de_semana") return await runFimDeSemana(supabase);
    if (tipo === "campanhas") return await runCampanhas(supabase);
    if (tipo === "regras") return await runRegras(supabase);
    if (tipo === "cleanup") return await runCleanup(supabase);
    if (tipo === "snapshots") return await runSnapshots(supabase);
    if (tipo === "healthcheck") return await runHealthcheck();

    return NextResponse.json({ error: `tipo inválido: ${tipo}` }, { status: 400 });
  } catch (err) {
    await logServerError("ayla_cron", err, { payload: { tipo } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "erro" },
      { status: 500 },
    );
  }
}

/**
 * Monitor diário (8h): checa o Z-API e manda "no ar" pro WhatsApp do admin. Se
 * a mensagem NÃO chegar, é sinal de que algo caiu (servidor/cron/Z-API).
 * Número configurável por ADMIN_MONITOR_WHATSAPP (default: o da Karina).
 */
async function runHealthcheck() {
  const numero = process.env.ADMIN_MONITOR_WHATSAPP || "+5511994770067";
  const st = await verificarStatusZapi();
  const quando = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Resumo de cadastros (ontem/semana/mês) — best-effort, não derruba o monitor.
  let resumoLinha = "";
  try {
    const admin = createServiceRoleClient();
    const { resumoCadastros } = await import("@/lib/admin/notificacoes");
    const r = await resumoCadastros(admin);
    resumoLinha = `\n📊 Cadastros: ontem ${r.ontem} · semana ${r.semana} · mês ${r.mes}`;
  } catch (e) {
    await logServerError("healthcheck_resumo", e, {});
  }

  /**
   * O PREÇO PASSA PELOS OLHOS DE UM HUMANO TODO DIA — 20/08/2026.
   *
   * Sincroniza o espelho `configuracao_precos` com o Stripe (o dono) e coloca
   * o valor vigente na mensagem diária. Reusa este monitor em vez de criar um
   * cron novo: ele já roda todo dia e já fala com uma pessoa.
   *
   * Por que o valor aparece mesmo quando está tudo certo: o defeito do plano
   * anual (R$ 603,90 cobrados por MÊS) sobreviveu meses porque ninguém olhava.
   * Um número visível todo dia é a defesa mais barata que existe contra texto
   * comercial que defasa — a mesma lição do prazo defasado do `trial_d3`.
   *
   * Best-effort: falhar aqui não pode derrubar o monitor do Z-API, que é o
   * motivo original deste cron existir.
   */
  let planosLinha = "";
  try {
    const admin = createServiceRoleClient();
    const { sincronizarPlanos, lerPlanosParaExibir, formatarBRL } = await import(
      "@/lib/billing/planos"
    );
    const r = await sincronizarPlanos(admin);
    const planos = await lerPlanosParaExibir(admin);
    const m = formatarBRL(planos.mensal.centavos) ?? "?";
    const a = formatarBRL(planos.anual.centavos) ?? "?";
    planosLinha = `\n💳 Planos: ${m}/mês · ${a}/ano`;
    if (r.problemas.length > 0) {
      planosLinha += `\n🚨 PREÇO COM PROBLEMA: ${r.problemas.join(" | ")}`;
      await logEvent({
        kind: "planos_divergentes",
        severity: "error",
        message: r.problemas.join(" | "),
      });
    }
  } catch (e) {
    await logServerError("healthcheck_planos", e, {});
  }

  const statusLinha = st.connected
    ? `✅ Kolo no ar — Z-API conectado, a Ayla está respondendo. (${quando})`
    : `⚠️ ATENÇÃO: o Z-API parece DESCONECTADO — a Ayla pode não estar respondendo. Confira o painel do Z-API. (${quando})`;
  const texto = statusLinha + resumoLinha + planosLinha;
  let enviada = true;
  try {
    await enviarTexto({ phoneE164: numero, texto });
  } catch (e) {
    enviada = false;
    await logServerError("healthcheck_send", e, {});
  }
  return NextResponse.json({ ok: true, connected: st.connected, enviada });
}

type AdminClient = ReturnType<typeof createServiceRoleClient>;

/**
 * RECONCILIAÇÃO POR DIVERGÊNCIA + ALERTA. Roda de hora em hora e pergunta uma
 * coisa só: existe família que DEVERIA ter acesso segundo o Stripe e a Kolo não
 * está concedendo? Antes a pergunta era "quem está em past_due?" — reagia a um
 * estado específico e não enxergava a classe do incidente Rochelle, que era
 * `trialing` vencida.
 *
 * A regra está em `lib/stripe/reconciliacao.ts`; aqui ficam só os avisos.
 * Bloqueio correto (o Stripe confirma que não há direito) NÃO gera alerta.
 */
async function runAlertaAssinatura(supabase: AdminClient) {
  const r = await reconciliarDivergencias(supabase);

  const alerta =
    process.env.ALERTA_WHATSAPP || process.env.ADMIN_MONITOR_WHATSAPP || "+5511994770067";

  if (r.corrigidas.length > 0) {
    const emails = await emailsDeFamilias(supabase, r.corrigidas.map((c) => c.familyId));
    const linhas = r.corrigidas
      .map((c) => `• ${emails[c.familyId] ?? c.familyId}: ${c.antes ?? "—"} → ${c.depois} (Stripe: ${c.stripe})`)
      .join("\n");
    const msg = `⚠️ Kolo: ${r.corrigidas.length} assinatura(s) estava(m) travada(s) — pagou no Stripe mas o app não tinha liberado. JÁ CORRIGI automaticamente, a(s) pessoa(s) tem acesso agora:\n${linhas}`;
    try {
      await enviarTexto({ phoneE164: alerta, texto: msg });
    } catch (e) {
      await logServerError("alerta_assinatura_send", e, {});
    }
  }

  // Alerta OPERACIONAL: divergência que o reconciliador não conseguiu resolver.
  // Antes isso sumia num `catch {}` vazio — família com vínculo e sem acesso,
  // e ninguém sabendo. Com trava de 12h: o problema PERSISTE entre execuções, e
  // sem ela uma família travada mandaria 24 mensagens por dia.
  let alertaOperacionalEnviado = false;
  if (r.naoCorrigidas.length > 0 && !(await alertaOperacionalRecente(supabase))) {
    const emails = await emailsDeFamilias(supabase, r.naoCorrigidas.map((c) => c.familyId));
    const linhas = r.naoCorrigidas
      .map((c) => `• ${emails[c.familyId] ?? c.familyId} (${c.statusAnterior ?? "—"}): ${c.motivo}`)
      .join("\n");
    const msg = `🚨 Kolo: ${r.naoCorrigidas.length} família(s) com vínculo no Stripe e SEM acesso que eu NÃO consegui resolver sozinho. Precisa de olho humano:\n${linhas}`;
    try {
      await enviarTexto({ phoneE164: alerta, texto: msg });
      alertaOperacionalEnviado = true;
      // O registro é a própria trava das próximas 12h.
      await logEvent({
        kind: KIND_ALERTA_OPERACIONAL,
        severity: "warn",
        message: `alerta operacional enviado: ${r.naoCorrigidas.length} família(s) não reconciliada(s)`,
        payload: { nao_corrigidas: r.naoCorrigidas.length },
      });
    } catch (e) {
      await logServerError("alerta_assinatura_send", e, {});
    }
  }

  return NextResponse.json({
    com_vinculo: r.comVinculo,
    candidatas: r.candidatas,
    corrigidas: r.corrigidas.length,
    verificadas_sem_acesso: r.verificadasSemAcesso,
    nao_corrigidas: r.naoCorrigidas.length,
    chamadas_stripe: r.chamadasStripe,
    alerta_operacional_enviado: alertaOperacionalEnviado,
    detalhes: r.corrigidas,
    pendentes: r.naoCorrigidas,
  });
}

/** E-mails de um conjunto de famílias — pra o alerta ficar legível. */
async function emailsDeFamilias(
  admin: AdminClient,
  familyIds: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (familyIds.length === 0) return out;
  const { data: fams } = await admin
    .from("family_accounts")
    .select("id, user_id")
    .in("id", familyIds);
  for (const f of fams ?? []) {
    const uid = f.user_id as string | null;
    if (!uid) continue;
    try {
      const { data } = await admin.auth.admin.getUserById(uid);
      const email = data?.user?.email;
      if (email) out[f.id as string] = email;
    } catch {
      /* segue sem o e-mail dessa */
    }
  }
  return out;
}

/**
 * Snapshots mensais da Evolução — roda no início do mês e tira a FOTO do mês
 * ANTERIOR pra cada membro ativo (só os que ainda não têm). Idempotente.
 * Ideal: cron 1×/dia nos primeiros dias do mês (ou 1×/mês no dia 1).
 */
async function runSnapshots(supabase: AdminClient) {
  const hoje = hojeLocalISO(); // 'YYYY-MM-DD' (America/Sao_Paulo)
  const [y, m] = hoje.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const periodo = `${py}-${String(pm).padStart(2, "0")}-01`;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, family_account_id")
    .eq("ativo", true);

  let gerados = 0;
  let pulados = 0;
  for (const mem of membros ?? []) {
    try {
      const r = await gerarSnapshotMensal(supabase, {
        membroId: mem.id as string,
        familyId: (mem.family_account_id as string | null) ?? null,
        periodo,
        geradoPor: "cron",
      });
      if (r.status === "gerado" || r.status === "atualizado") gerados += 1;
      else pulados += 1;
    } catch {
      pulados += 1;
    }
  }

  return NextResponse.json({ ok: true, tipo: "snapshots", periodo, gerados, pulados });
}

/**
 * CAMPANHA ÚNICA DO VÍDEO INSTITUCIONAL — 06/08/2026.
 *
 * Reusa a MESMA seleção por janela da rotina diária, de propósito: o cron já
 * roda às 11, 15, 18 e 22 UTC, que em Brasília é 08h, 12h, 15h e 19h — as
 * quatro janelas que as famílias escolhem. Assim cada uma recebe dentro da
 * janela DELA, sem cron novo e sem horário fixo.
 *
 * Isso resolve a contradição do pedido: "amanhã cedo" valeria para 5 das 17
 * famílias elegíveis; as outras 12 escolheram 12h, 15h ou 19h. A janela ganha.
 *
 * A dedup NÃO mora aqui — mora em `sendVideoGuia`, verificada imediatamente
 * antes do envio. Este runner pode rodar quantas vezes quiser.
 */
async function runVideoGuia(supabase: AdminClient) {
  const agora = new Date();
  const horaAtualLocal = horaLocalHHMM(agora);

  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select(
      "family_account_id, horario_preferido_inicio, horario_preferido_fim, desativada, pausada_ate, consentimento_em",
    )
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  const naJanela: string[] = [];
  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;
    const inicio = (p.horario_preferido_inicio as string)?.slice(0, 5);
    const fim = (p.horario_preferido_fim as string)?.slice(0, 5);
    if (inicio && fim && horaAtualLocal >= inicio && horaAtualLocal <= fim) {
      naJanela.push(p.family_account_id);
    }
  }

  // Só TRIAL ATIVO. `filtrarComAcesso` deixaria passar assinante e past_due —
  // esta campanha é de ativação de quem está testando, e a coorte real é bem
  // menor que o `status` sugere: 114 famílias estão como `trialing` com o
  // trial já vencido (pendência separada, registrada, não tratada aqui).
  const { data: acessos } = await supabase
    .from("subscription_accesses")
    .select("family_account_id, status, trial_ends_at")
    .eq("status", "trialing")
    .in("family_account_id", naJanela);

  const elegiveis = (acessos ?? [])
    .filter((a) => !a.trial_ends_at || new Date(a.trial_ends_at as string) >= agora)
    .map((a) => a.family_account_id as string);

  const resultados: Array<{ familyId: string; enviada: boolean; motivo?: string }> = [];
  for (const familyId of elegiveis) {
    try {
      const r = await sendVideoGuia(supabase, familyId, agora);
      resultados.push({ familyId, enviada: r.enviada, motivo: r.enviada ? undefined : r.motivo });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    tipo: "video_guia",
    hora_local: horaAtualLocal,
    na_janela: naJanela.length,
    elegiveis: elegiveis.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    resultados,
  });
}

/**
 * Roda rotina diária para todas as famílias ativas onde:
 *   - subscription_access.status in (trialing, active, past_due)
 *   - ayla_preferences.consentimento_em existe + não desativada + não pausada
 *   - hora atual (fuso BR) cai dentro de horario_preferido_inicio..fim
 *
 * Ideal: cron rodar a cada 30min. Cada chamada despacha as famílias
 * cujo horário casa naquele momento.
 */
async function runRotina(supabase: AdminClient) {
  const agora = new Date();
  // Janela comparada no fuso de Brasília (horário preferido é local), não UTC.
  const horaAtualLocal = horaLocalHHMM(agora); // "HH:MM"

  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select(
      "family_account_id, horario_preferido_inicio, horario_preferido_fim, desativada, pausada_ate, consentimento_em",
    )
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  const elegiveis: string[] = [];
  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;
    const inicio = (p.horario_preferido_inicio as string)?.slice(0, 5);
    const fim = (p.horario_preferido_fim as string)?.slice(0, 5);
    if (inicio && fim && horaAtualLocal >= inicio && horaAtualLocal <= fim) {
      elegiveis.push(p.family_account_id);
    }
  }

  // Só quem tem ACESSO LIBERADO (trial vencido não recebe engajamento proativo).
  {
    const comAcesso = await filtrarComAcesso(supabase, elegiveis);
    elegiveis.splice(0, elegiveis.length, ...comAcesso);
  }

  const resultados: Array<{
    familyId: string;
    enviada: boolean;
    motivo?: string;
  }> = [];

  for (const familyId of elegiveis) {
    try {
      const r = await sendRotinaDiaria(supabase, familyId, agora);
      resultados.push({
        familyId,
        enviada: r.enviada,
        motivo: r.enviada ? undefined : r.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Detecta famílias que pararam de responder e envia engajamento.
 * Roda 1x/dia (geralmente 09:00 timezone família — simplificado pra UTC).
 */
async function runInatividade(supabase: AdminClient) {
  const agora = new Date();
  const dois = new Date(agora.getTime() - 2 * 24 * 60 * 60 * 1000);
  const cinco = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000);
  const dez = new Date(agora.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Famílias com consentimento + não desativadas + não pausadas
  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select("family_account_id, pausada_ate")
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  const resultados: Array<{ familyId: string; enviada: boolean; motivo?: string; dias: number }> = [];

  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;

    const familyId = p.family_account_id as string;

    // Última resposta da mãe
    const { data: ultima } = await supabase
      .from("ayla_messages")
      .select("created_at")
      .eq("family_account_id", familyId)
      .eq("direcao", "inbound")
      .order("created_at", { ascending: false })
      .limit(1);

    const ref = ultima?.[0]?.created_at;
    if (!ref) continue;
    const refDate = new Date(ref);

    let diasInativos = 0;
    if (refDate <= dez) {
      // Silêncio total — não envia (regra §12.5)
      continue;
    } else if (refDate <= cinco) {
      diasInativos = 5;
    } else if (refDate <= dois) {
      diasInativos = 2;
    } else {
      continue;
    }

    try {
      const r = await sendEngajamento(supabase, familyId, diasInativos, agora);
      resultados.push({
        familyId,
        enviada: r.enviada,
        motivo: r.enviada ? undefined : r.motivo,
        dias: diasInativos,
      });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
        dias: diasInativos,
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Comercial: trial D-3 e D-0. Roda 1×/dia.
 */
async function runComercial(supabase: AdminClient) {
  const agora = new Date();
  const hoje = startOfDay(agora);
  const em3 = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000);
  const em3Fim = new Date(em3.getTime() + 24 * 60 * 60 * 1000);
  const hojeFim = new Date(hoje.getTime() + 24 * 60 * 60 * 1000);

  const [{ data: d3 }, { data: d0 }] = await Promise.all([
    supabase
      .from("subscription_accesses")
      .select("family_account_id, trial_ends_at")
      .eq("status", "trialing")
      .gte("trial_ends_at", em3.toISOString())
      .lt("trial_ends_at", em3Fim.toISOString()),
    supabase
      .from("subscription_accesses")
      .select("family_account_id, trial_ends_at")
      .eq("status", "trialing")
      .gte("trial_ends_at", hoje.toISOString())
      .lt("trial_ends_at", hojeFim.toISOString()),
  ]);

  const resultados: Array<{ familyId: string; tipo: string; enviada: boolean; motivo?: string }> = [];

  for (const r of d3 ?? []) {
    try {
      const res = await sendTrial(supabase, r.family_account_id as string, 3, agora);
      resultados.push({
        familyId: r.family_account_id as string,
        tipo: "trial_d3",
        enviada: res.enviada,
        motivo: res.enviada ? undefined : res.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId: r.family_account_id as string,
        tipo: "trial_d3",
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  for (const r of d0 ?? []) {
    try {
      const res = await sendTrial(supabase, r.family_account_id as string, 0, agora);
      resultados.push({
        familyId: r.family_account_id as string,
        tipo: "trial_d0",
        enviada: res.enviada,
        motivo: res.enviada ? undefined : res.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId: r.family_account_id as string,
        tipo: "trial_d0",
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Emocional: detecta famílias com 7 dias seguidos de respostas e celebra.
 * Idempotência: só envia 1× a cada 30 dias por família.
 */
async function runEmocional(supabase: AdminClient) {
  const agora = new Date();
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data: respostas } = await supabase
    .from("ayla_daily_checkins")
    .select("family_account_id, date")
    .eq("respondeu", true)
    .gte("date", seteDiasAtras.toISOString().slice(0, 10));

  const porFamilia = new Map<string, Set<string>>();
  for (const r of respostas ?? []) {
    const set = porFamilia.get(r.family_account_id as string) ?? new Set<string>();
    set.add(r.date as string);
    porFamilia.set(r.family_account_id as string, set);
  }
  const candidatas = Array.from(porFamilia.entries())
    .filter(([, datas]) => datas.size >= 7)
    .map(([id]) => id);

  const { data: jaCelebradas } = candidatas.length
    ? await supabase
        .from("ayla_messages")
        .select("family_account_id")
        .in("family_account_id", candidatas)
        .eq("tipo", "emocional_streak")
        .gte("created_at", trintaDiasAtras.toISOString())
    : { data: [] };

  const jaSet = new Set((jaCelebradas ?? []).map((m) => m.family_account_id as string));
  const elegiveis = candidatas.filter((id) => !jaSet.has(id));

  const resultados: Array<{ familyId: string; enviada: boolean; motivo?: string }> = [];
  for (const familyId of elegiveis) {
    try {
      const r = await sendEmocionalStreak(supabase, familyId, agora);
      resultados.push({
        familyId,
        enviada: r.enviada,
        motivo: r.enviada ? undefined : r.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Insights: detecta padrões em todas as famílias ativas e envia o
 * próximo pendente (1 por família, máx). Roda 1×/semana (PRD §12.9.4).
 */
async function runInsights(supabase: AdminClient) {
  const agora = new Date();
  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select("family_account_id, pausada_ate")
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  const resultados: Array<{
    familyId: string;
    detectados: number;
    enviada?: boolean;
    motivo?: string;
  }> = [];

  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;
    const familyId = p.family_account_id as string;

    try {
      const det = await detectAndPersist(supabase, familyId, agora);
      const env = await sendProximoInsight(supabase, familyId, agora);
      resultados.push({
        familyId,
        detectados: det.persistidos,
        enviada: env.enviada,
        motivo: env.enviada ? undefined : env.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId,
        detectados: 0,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Repertório: 1×/semana, sugere uma experiência nova adjacente aos
 * interesses da criança (Fatia 3.3b). Elegíveis: consentimento + não
 * desativada + não pausada + assinatura ativa. A cadência semanal e o
 * "não repetir o recusado" ficam dentro de sendRepertorioSugestao.
 */
async function runRepertorio(supabase: AdminClient) {
  const agora = new Date();
  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select("family_account_id, pausada_ate")
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  let ids: string[] = [];
  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;
    ids.push(p.family_account_id as string);
  }

  // Só quem tem ACESSO LIBERADO (trial vencido não recebe engajamento proativo).
  ids = await filtrarComAcesso(supabase, ids);

  const resultados: Array<{ familyId: string; enviada: boolean; motivo?: string }> = [];
  for (const familyId of ids) {
    try {
      const r = await sendRepertorioSugestao(supabase, familyId, agora);
      resultados.push({
        familyId,
        enviada: r.enviada,
        motivo: r.enviada ? undefined : r.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Follow-up de plano (Fase 4): alguns dias depois de um plano sem resultado,
 * a Ayla pergunta como foi (com link pro plano). Roda 1×/dia. Pega o plano
 * mais antigo de cada família na janela de 3–14 dias, ainda sem resultado e
 * sem follow-up enviado. As regras de proativa (janela/cap/consentimento) e
 * a idempotência por plano são garantidas dentro de sendPlanoSeguimento.
 */
/**
 * Filtra family_account_ids mantendo só quem tem ACESSO LIBERADO de verdade
 * (fonte única `assinaturaLiberada` — checa trial_ends_at, cortesia e graça de
 * past_due, não só o status cru). O filtro antigo `.in("status", ["trialing",
 * "active", "past_due"])` deixava passar TRIAL VENCIDO (status ainda "trialing",
 * só a data passou) — era por isso que a Ayla mandava "Sexta chegou / como tá?"
 * pra quem já tinha perdido o acesso. Engajamento proativo usa isto; o COMERCIAL
 * (assine) NÃO, porque ele é justamente o convite pra voltar.
 */
async function filtrarComAcesso(
  supabase: AdminClient,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  // ⚠️ STAFF ENTRA AQUI DESDE 10/08/2026, e a ausência disto era um bug.
  //
  // Este filtro decide quem a Ayla PROCURA. Os portões que decidem quem ela
  // ATENDE (painel, escrita na web, conversa no WhatsApp) já isentavam staff;
  // este não, e nem `rules.ts`. Uma operadora com trial vencido era atendida
  // sempre e procurada nunca — parou de receber a mensagem diária no dia exato
  // do vencimento, e nada acusou. Ver `lib/auth/acesso.ts`.
  //
  // Em LOTE de propósito: uma consulta por família seria N idas ao banco a cada
  // ciclo do cron.
  const staff = await familiasDeStaff(supabase, ids);
  const { data: subs } = await supabase
    .from("subscription_accesses")
    .select(
      "family_account_id, status, trial_ends_at, cortesia, cortesia_ate, pagamento_falhou_em",
    )
    .in("family_account_id", ids);
  const liberadas = new Set(
    (subs ?? [])
      .filter((s) => assinaturaLiberada(s))
      .map((s) => s.family_account_id as string),
  );
  return ids.filter((id) => staff.has(id) || liberadas.has(id));
}

async function runSeguimento(supabase: AdminClient) {
  const agora = new Date();
  const dia = 24 * 60 * 60 * 1000;
  const tresDiasAtras = new Date(agora.getTime() - 3 * dia);
  const quatorzeDiasAtras = new Date(agora.getTime() - 14 * dia);

  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select("family_account_id, pausada_ate")
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  let ids: string[] = [];
  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;
    ids.push(p.family_account_id as string);
  }

  // Só quem tem ACESSO LIBERADO (trial vencido não recebe engajamento proativo).
  ids = await filtrarComAcesso(supabase, ids);

  const resultados: Array<{ familyId: string; enviada: boolean; motivo?: string }> = [];
  for (const familyId of ids) {
    try {
      const { data: planos } = await supabase
        .from("planos")
        .select("id, tema, membro_atipico_id")
        .eq("family_account_id", familyId)
        .is("resultado", null)
        .is("seguimento_enviado_em", null)
        .lte("created_at", tresDiasAtras.toISOString())
        .gte("created_at", quatorzeDiasAtras.toISOString())
        .order("created_at", { ascending: true })
        .limit(1);
      const plano = planos?.[0];
      if (!plano) continue;

      const r = await sendPlanoSeguimento(
        supabase,
        familyId,
        {
          id: plano.id as string,
          tema: (plano.tema as string | null) ?? null,
          membro_atipico_id: (plano.membro_atipico_id as string | null) ?? null,
        },
        agora,
      );
      resultados.push({
        familyId,
        enviada: r.enviada,
        motivo: r.enviada ? undefined : r.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Recuperação pós-plano (disparo one-off / manual): pega planos criados HOJE cuja
 * conversa MORREU (a família não respondeu depois) e reabre com sendRecuperacaoPlano
 * — pergunta se foi útil, oferece continuar o tema, e traz o link se o PDF falhou.
 * Um por família (o plano mais recente). Travas de proativa + idempotência 24h ficam
 * dentro de sendRecuperacaoPlano. Aciona via ?tipo=recuperacao_plano.
 */
async function runRecuperacaoPlano(supabase: AdminClient, janela: "hoje" | "3min" = "hoje") {
  const agora = new Date();

  // "hoje" = disparo one-off pro backlog do dia. "3min" = toque automático ~3 min
  // após a entrega (cron a cada poucos min pega a janela 3–30 min atrás; a
  // idempotência de 24h em sendRecuperacaoPlano evita duplicar).
  const desde =
    janela === "3min"
      ? new Date(agora.getTime() - 30 * 60 * 1000).toISOString()
      : startOfDay(agora).toISOString();
  const ate = janela === "3min" ? new Date(agora.getTime() - 3 * 60 * 1000).toISOString() : null;

  let query = supabase
    .from("planos")
    .select("id, family_account_id, membro_atipico_id, tema, created_at")
    .gte("created_at", desde);
  if (ate) query = query.lt("created_at", ate);
  const { data: planos } = await query.order("created_at", { ascending: false });

  // Dedupe por família — o plano mais recente de hoje.
  const porFamilia = new Map<
    string,
    { id: string; membro_atipico_id: string | null; tema: string | null; created_at: string }
  >();
  for (const p of planos ?? []) {
    const fid = p.family_account_id as string;
    if (!porFamilia.has(fid)) {
      porFamilia.set(fid, {
        id: p.id as string,
        membro_atipico_id: (p.membro_atipico_id as string | null) ?? null,
        tema: (p.tema as string | null) ?? null,
        created_at: p.created_at as string,
      });
    }
  }

  const resultados: Array<{ familyId: string; enviada: boolean; motivo?: string }> = [];
  for (const [familyId, plano] of porFamilia) {
    try {
      // Conversa morreu? Só recupera quem NÃO respondeu depois do plano.
      const { data: inboundDepois } = await supabase
        .from("ayla_messages")
        .select("id")
        .eq("family_account_id", familyId)
        .eq("direcao", "inbound")
        .gte("created_at", plano.created_at)
        .limit(1);
      if ((inboundDepois?.length ?? 0) > 0) {
        resultados.push({ familyId, enviada: false, motivo: "Já respondeu após o plano." });
        continue;
      }
      const r = await sendRecuperacaoPlano(
        supabase,
        familyId,
        { id: plano.id, tema: plano.tema, membro_atipico_id: plano.membro_atipico_id },
        agora,
      );
      resultados.push({ familyId, enviada: r.enviada, motivo: r.enviada ? undefined : r.motivo });
    } catch (e) {
      resultados.push({ familyId, enviada: false, motivo: e instanceof Error ? e.message : "erro" });
    }
  }

  // A rotina visual é o outro material que encanta — mesma lógica, mesma
  // janela. A idempotência dentro de sendRecuperacaoRotina impede que a mesma
  // família receba os dois pedidos de feedback no mesmo dia.
  const rotinas = await recuperarRotinas(supabase, desde, ate, agora);

  return NextResponse.json({
    processadas: resultados.length + rotinas.length,
    enviadas:
      resultados.filter((r) => r.enviada).length + rotinas.filter((r) => r.enviada).length,
    detalhes: [...resultados, ...rotinas],
  });
}

/**
 * Rotinas visuais entregues e não comentadas: reabre pra a mãe ver os cartões
 * (que ficam prontos DEPOIS, quando ela já saiu do WhatsApp) e dizer o que
 * achou. Só quem NÃO respondeu depois da entrega. Um por família.
 */
async function recuperarRotinas(
  supabase: AdminClient,
  desde: string,
  ate: string | null,
  agora: Date,
): Promise<Array<{ familyId: string; enviada: boolean; motivo?: string }>> {
  let query = supabase
    .from("rotinas")
    .select("id, family_account_id, membro_atipico_id, nome, created_at, cards_status")
    .gte("created_at", desde);
  if (ate) query = query.lt("created_at", ate);
  const { data: linhas } = await query.order("created_at", { ascending: false });

  const porFamilia = new Map<
    string,
    { id: string; membro_atipico_id: string | null; nome: string | null; created_at: string }
  >();
  for (const r of linhas ?? []) {
    const fid = r.family_account_id as string;
    if (!fid || porFamilia.has(fid)) continue;
    // Cartões ainda sendo ilustrados: não adianta chamar ela pra ver agora.
    // A janela do cron (3–30 min) pega essa rotina numa passada seguinte.
    // "aguardando" pelo mesmo motivo, e por um pior: ali os cartões nem foram
    // encomendados (falta a família escolher o tema). Chamar pra ver seria
    // anunciar como pronta uma rotina que ainda não tem arte nenhuma.
    if (r.cards_status === "gerando" || r.cards_status === "aguardando") continue;
    porFamilia.set(fid, {
      id: r.id as string,
      membro_atipico_id: (r.membro_atipico_id as string | null) ?? null,
      nome: (r.nome as string | null) ?? null,
      created_at: r.created_at as string,
    });
  }

  const out: Array<{ familyId: string; enviada: boolean; motivo?: string }> = [];
  for (const [familyId, rotina] of porFamilia) {
    try {
      const { data: inboundDepois } = await supabase
        .from("ayla_messages")
        .select("id")
        .eq("family_account_id", familyId)
        .eq("direcao", "inbound")
        .gte("created_at", rotina.created_at)
        .limit(1);
      if ((inboundDepois?.length ?? 0) > 0) {
        out.push({ familyId, enviada: false, motivo: "Já respondeu após a rotina." });
        continue;
      }
      const r = await sendRecuperacaoRotina(
        supabase,
        familyId,
        { id: rotina.id, nome: rotina.nome, membro_atipico_id: rotina.membro_atipico_id },
        agora,
      );
      out.push({ familyId, enviada: r.enviada, motivo: r.enviada ? undefined : r.motivo });
    } catch (e) {
      out.push({ familyId, enviada: false, motivo: e instanceof Error ? e.message : "erro" });
    }
  }
  return out;
}

/**
 * Fim de semana (Fase 5): às sextas, oferece um roteiro leve de fim de
 * semana. Mesma elegibilidade da rotina (janela de horário + assinatura);
 * a geração do plano acontece quando a mãe responde (no processInbound).
 * Trava de sexta-feira no fuso BR — no-op em qualquer outro dia.
 */
async function runFimDeSemana(supabase: AdminClient) {
  const agora = new Date();

  const diaSemanaBR = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  }).format(agora);
  if (diaSemanaBR !== "Fri") {
    return NextResponse.json({ pulado: "não é sexta-feira no fuso BR", dia: diaSemanaBR });
  }

  const horaAtualLocal = horaLocalHHMM(agora);

  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select(
      "family_account_id, horario_preferido_inicio, horario_preferido_fim, desativada, pausada_ate, consentimento_em",
    )
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  let elegiveis: string[] = [];
  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;
    const inicio = (p.horario_preferido_inicio as string)?.slice(0, 5);
    const fim = (p.horario_preferido_fim as string)?.slice(0, 5);
    if (inicio && fim && horaAtualLocal >= inicio && horaAtualLocal <= fim) {
      elegiveis.push(p.family_account_id as string);
    }
  }

  // Só quem tem ACESSO LIBERADO (trial vencido não recebe engajamento proativo).
  elegiveis = await filtrarComAcesso(supabase, elegiveis);

  const resultados: Array<{ familyId: string; enviada: boolean; motivo?: string }> = [];
  for (const familyId of elegiveis) {
    try {
      const r = await sendOfertaFimDeSemana(supabase, familyId, agora);
      resultados.push({
        familyId,
        enviada: r.enviada,
        motivo: r.enviada ? undefined : r.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Cleanup: purga linhas antigas das tabelas operacionais. Roda 1×/dia.
 *
 *   - eventos_app: info/debug com >30 dias; warn/error/fatal com >180d
 *   - links_vivos: revogados ou expirados há >90 dias
 *   - beta_invites: expirados ou esgotados há >180 dias
 *   - campanhas_destinatarios: status final em campanhas enviadas há >365d
 *
 * Bounded por DEL_LIMIT por tabela pra não travar o DB.
 */
async function runCleanup(supabase: AdminClient) {
  const agora = new Date();
  const dia = 24 * 60 * 60 * 1000;
  const limites = {
    eventos_info: new Date(agora.getTime() - 30 * dia).toISOString(),
    eventos_grave: new Date(agora.getTime() - 180 * dia).toISOString(),
    links_vivos: new Date(agora.getTime() - 90 * dia).toISOString(),
    beta_invites: new Date(agora.getTime() - 180 * dia).toISOString(),
    campanhas_old: new Date(agora.getTime() - 365 * dia).toISOString(),
  };

  const resultados: Record<string, number | string> = {};

  // eventos_app info/debug
  {
    const { count, error } = await supabase
      .from("eventos_app")
      .delete({ count: "exact" })
      .in("severity", ["debug", "info"])
      .lt("created_at", limites.eventos_info);
    resultados.eventos_info = error ? `erro: ${error.message}` : (count ?? 0);
  }
  // eventos_app warn/error/fatal
  {
    const { count, error } = await supabase
      .from("eventos_app")
      .delete({ count: "exact" })
      .in("severity", ["warn", "error", "fatal"])
      .lt("created_at", limites.eventos_grave);
    resultados.eventos_grave = error ? `erro: ${error.message}` : (count ?? 0);
  }
  // links_vivos revogados ou expirados
  {
    const { count, error } = await supabase
      .from("links_vivos")
      .delete({ count: "exact" })
      .or(
        `revogado.eq.true,expira_em.lt.${limites.links_vivos}`,
      );
    resultados.links_vivos = error ? `erro: ${error.message}` : (count ?? 0);
  }
  // beta_invites expirados/revogados antigos
  {
    const { count, error } = await supabase
      .from("beta_invites")
      .delete({ count: "exact" })
      .or(`revogado.eq.true,expira_em.lt.${limites.beta_invites}`);
    resultados.beta_invites = error ? `erro: ${error.message}` : (count ?? 0);
  }
  // campanhas_destinatarios de campanhas enviadas há muito tempo
  {
    const { data: campanhasAntigas } = await supabase
      .from("campanhas")
      .select("id")
      .eq("status", "enviada")
      .lt("updated_at", limites.campanhas_old);
    const ids = (campanhasAntigas ?? []).map((c) => c.id as string);
    if (ids.length > 0) {
      const { count, error } = await supabase
        .from("campanhas_destinatarios")
        .delete({ count: "exact" })
        .in("campanha_id", ids);
      resultados.campanhas_destinatarios = error
        ? `erro: ${error.message}`
        : (count ?? 0);
    } else {
      resultados.campanhas_destinatarios = 0;
    }
  }

  return NextResponse.json({ ok: true, agora: agora.toISOString(), purgado: resultados });
}

/**
 * Regras: avalia o engine para todas as famílias com assinatura ativa.
 * Roda 1×/dia. Cada família é isolada (catch local) — falha em uma não
 * derruba as outras.
 */
async function runRegras(supabase: AdminClient) {
  const { data: ativas } = await supabase
    .from("subscription_accesses")
    .select("family_account_id, status")
    .in("status", ["trialing", "active", "past_due"]);

  const agora = new Date();
  const resultados: Array<{
    familyId: string;
    fired: number;
    resolved: number;
    error?: string;
  }> = [];

  for (const a of ativas ?? []) {
    const familyId = a.family_account_id as string;
    try {
      const r = await runRegrasParaFamilia(supabase, familyId, agora);
      resultados.push({
        familyId,
        fired: r.filter((x) => x.status === "fired_new").length,
        resolved: r.filter((x) => x.status === "resolved").length,
      });
    } catch (e) {
      resultados.push({
        familyId,
        fired: 0,
        resolved: 0,
        error: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    novos_alertas: resultados.reduce((acc, r) => acc + r.fired, 0),
    resolvidos: resultados.reduce((acc, r) => acc + r.resolved, 0),
    detalhes: resultados,
  });
}

/**
 * Campanhas: processa destinatarios pendentes de qualquer campanha em
 * status='enviando'. Roda 1x/hora (PRD §7.13). Bounded por BATCH_GLOBAL.
 */
async function runCampanhas(supabase: AdminClient) {
  const BATCH_GLOBAL = 500;

  const { data: ativas } = await supabase
    .from("campanhas")
    .select("id, categoria, conteudo_whatsapp")
    .eq("status", "enviando");

  const resultados: Array<{
    campanhaId: string;
    enviadas: number;
    bloqueadas: number;
    pendentes: number;
  }> = [];

  let restanteGlobal = BATCH_GLOBAL;

  for (const camp of ativas ?? []) {
    if (restanteGlobal <= 0) break;
    if (!camp.conteudo_whatsapp) continue;

    const { data: pendentes } = await supabase
      .from("campanhas_destinatarios")
      .select("id, family_account_id")
      .eq("campanha_id", camp.id)
      .eq("status", "pendente")
      .limit(restanteGlobal);

    let enviadas = 0;
    let bloqueadas = 0;

    for (const p of pendentes ?? []) {
      try {
        const r = await sendCampanha(supabase, {
          family_account_id: p.family_account_id as string,
          campanha_id: camp.id as string,
          categoria: camp.categoria as CampanhaCategoria,
          conteudo_whatsapp: camp.conteudo_whatsapp as string,
        });
        if (r.enviada) {
          enviadas++;
          await supabase
            .from("campanhas_destinatarios")
            .update({
              status: "enviada",
              enviada_em: new Date().toISOString(),
            })
            .eq("id", p.id);
        } else {
          bloqueadas++;
          await supabase
            .from("campanhas_destinatarios")
            .update({ status: "bloqueada", bloqueio_motivo: r.motivo })
            .eq("id", p.id);
        }
      } catch (e) {
        bloqueadas++;
        await supabase
          .from("campanhas_destinatarios")
          .update({
            status: "falha",
            bloqueio_motivo: e instanceof Error ? e.message : "erro",
          })
          .eq("id", p.id);
      }
      restanteGlobal--;
    }

    // Encerra campanha quando esvaziar
    const { count: pendCount } = await supabase
      .from("campanhas_destinatarios")
      .select("id", { count: "exact", head: true })
      .eq("campanha_id", camp.id)
      .eq("status", "pendente");
    const restantes = pendCount ?? 0;

    if (restantes === 0) {
      const [{ count: enviadasCount }, { count: bloqueadasCount }] =
        await Promise.all([
          supabase
            .from("campanhas_destinatarios")
            .select("id", { count: "exact", head: true })
            .eq("campanha_id", camp.id)
            .eq("status", "enviada"),
          supabase
            .from("campanhas_destinatarios")
            .select("id", { count: "exact", head: true })
            .eq("campanha_id", camp.id)
            .in("status", ["bloqueada", "falha"]),
        ]);
      await supabase
        .from("campanhas")
        .update({
          status: "enviada",
          total_alcance: enviadasCount ?? 0,
          total_bloqueados: bloqueadasCount ?? 0,
        })
        .eq("id", camp.id);
    }

    resultados.push({
      campanhaId: camp.id as string,
      enviadas,
      bloqueadas,
      pendentes: restantes,
    });
  }

  return NextResponse.json({
    campanhas: resultados.length,
    detalhes: resultados,
    batch_global_restante: restanteGlobal,
  });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
