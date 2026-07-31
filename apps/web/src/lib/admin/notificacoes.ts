import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarTexto } from "@/lib/ayla/whatsappSender";
import { familiasInternas } from "@/lib/analytics/internos";
import { idadeAnos } from "@/lib/idade";

/**
 * CANAL ADMINISTRATIVO - ADR 0001.
 *
 * Isto NAO e uma resposta da Ayla. E comunicacao operacional interna: alerta
 * tecnico, healthcheck, aviso de cadastro, acao manual do admin. Vai para o
 * WhatsApp da Karina, nao para o de uma familia.
 *
 * Diferencas que importam, e que sao a razao de existir separado de `publicar()`:
 *
 *   publicar()        -> conversa da familia. Tem conversationId, posse,
 *                        idempotencia por inbound, validacao de saida e
 *                        registro de entrega.
 *   notificarAdmin()  -> operacional. Nao tem conversa, nao disputa turno, nao
 *                        entra no historico da familia e nao pode ser chamado
 *                        por ferramenta nem pelo modelo.
 *
 * Misturar os dois foi parte do problema original: um alerta operacional
 * competindo com uma conversa real, e um envio administrativo contando como
 * "resposta enviada".
 */
export async function notificarAdmin(texto: string): Promise<void> {
  await notificarAdminBruto(ADMIN_WHATSAPP, texto);
}

/**
 * Variante com destino explicito - para os alertas que vao a um numero
 * configurado (monitor, plantao) e nao ao admin padrao.
 */
export async function notificarAdminBruto(phoneE164: string, texto: string): Promise<void> {
  await enviarTexto({ phoneE164, texto });
}

/**
 * Notificações operacionais pro WhatsApp do admin (Karina):
 *   - notificarNovoCadastro: em tempo real, quando alguém termina o onboarding.
 *   - resumoCadastros: números do dia/semana/mês pro monitor das 8h.
 *
 * Número em ADMIN_MONITOR_WHATSAPP (mesmo do healthcheck). Tudo best-effort —
 * nunca deve quebrar o fluxo de quem cadastrou.
 */

const ADMIN_WHATSAPP = process.env.ADMIN_MONITOR_WHATSAPP || "+5511994770067";

const ORIGEM_LABEL: Record<string, string> = {
  facebookads: "Meta Ads",
  facebook: "Meta Ads",
  fb: "Meta Ads",
  instagram: "Instagram",
  ig: "Instagram",
  googleads: "Google Ads",
  google: "Google",
};

function origemBonita(utmSource: string | null | undefined): string {
  if (!utmSource) return "Direto";
  return ORIGEM_LABEL[utmSource.toLowerCase()] ?? utmSource;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Data local (BRT) de um instante, como "YYYY-MM-DD" (ordena lexicograficamente). */
function dataBRT(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Aviso em tempo real: alguém acabou de terminar o cadastro (onboarding).
 * Traz nome de quem cuida + filho(s) + origem do anúncio. Contas internas
 * (admin/co-acesso) vêm marcadas, pra não confundir com lead real.
 */
export async function notificarNovoCadastro(
  admin: SupabaseClient,
  familyAccountId: string,
): Promise<void> {
  try {
    const [{ data: conta }, { data: profile }, { data: membros }, internas] =
      await Promise.all([
        admin
          .from("family_accounts")
          .select("utm_source")
          .eq("id", familyAccountId)
          .maybeSingle(),
        admin
          .from("family_profiles")
          .select("nome_mae, como_chamar")
          .eq("family_account_id", familyAccountId)
          .maybeSingle(),
        admin
          .from("membros_atipicos")
          .select("nome, data_nascimento")
          .eq("family_account_id", familyAccountId)
          .eq("ativo", true)
          .order("created_at", { ascending: true }),
        familiasInternas(admin),
      ]);

    const nome =
      (profile?.como_chamar as string | null)?.trim() ||
      (profile?.nome_mae as string | null)?.trim() ||
      "alguém";
    const filhos = (membros ?? [])
      .map((m) => {
        const i = idadeAnos((m.data_nascimento as string | null) ?? null);
        return `${m.nome}${i != null ? ` (${i})` : ""}`;
      })
      .join(" e ");
    const origem = origemBonita(conta?.utm_source as string | null);
    const quando = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const marca = internas.has(familyAccountId) ? "🧪 [teste interno]\n" : "";

    const texto =
      `${marca}🎉 Novo no teste de 7 dias\n` +
      `${nome}${filhos ? ` · ${filhos}` : ""}\n` +
      `Origem: ${origem} · ${quando}`;

    await enviarTexto({ phoneE164: ADMIN_WHATSAPP, texto });
  } catch (e) {
    console.warn(
      "[admin:notificarNovoCadastro] falhou (best-effort):",
      e instanceof Error ? e.message : e,
    );
  }
}

const FEEDBACK_LABEL: Record<string, string> = {
  elogio: "💛 Elogio",
  sugestao: "💡 Sugestão",
  reclamacao: "😟 Reclamação",
};

/**
 * Aviso no celular do admin quando chega um feedback que ele quer ver — elogio,
 * sugestão ou reclamação. Best-effort. Dúvida de uso NÃO passa por aqui (a IA
 * de ajuda resolve sozinha).
 */
export async function notificarFeedback(
  tipo: "elogio" | "sugestao" | "reclamacao",
  texto: string,
  quem: string,
  origem: string,
): Promise<void> {
  try {
    const label = FEEDBACK_LABEL[tipo] ?? "Feedback";
    const via = origem === "ayla" ? "Ayla" : "ajuda do app";
    const msg = `${label} — de ${quem} (via ${via}):\n"${texto.slice(0, 500)}"`;
    await enviarTexto({ phoneE164: ADMIN_WHATSAPP, texto: msg });
  } catch (e) {
    console.warn("[admin:notificarFeedback] falhou:", e instanceof Error ? e.message : e);
  }
}

/**
 * Aviso no celular do admin: um lead EM ABORDAGEM respondeu no WhatsApp. A Ayla
 * fica suprimida pra esse lead — a Karina responde pelo CRM. Best-effort.
 */
export async function notificarRespostaLead(
  admin: SupabaseClient,
  familyId: string,
  texto: string,
): Promise<void> {
  try {
    const { data: prof } = await admin
      .from("family_profiles")
      .select("nome_mae, como_chamar")
      .eq("family_account_id", familyId)
      .maybeSingle();
    const nome =
      (prof?.como_chamar as string | null)?.trim() ||
      (prof?.nome_mae as string | null)?.trim() ||
      "Um lead";
    const msg = `💬 ${nome} respondeu sua abordagem:\n"${texto.slice(0, 500)}"\n\nResponda pelo CRM quando puder.`;
    await enviarTexto({ phoneE164: ADMIN_WHATSAPP, texto: msg });
  } catch (e) {
    console.warn("[admin:notificarRespostaLead] falhou:", e instanceof Error ? e.message : e);
  }
}

/**
 * Contagem de novos cadastros (por created_at, fuso BRT) pro resumo das 8h:
 * ontem, semana atual (seg–dom) e mês vigente. Exclui contas internas
 * (admin/co-acesso), igual aos dashboards.
 */
export async function resumoCadastros(
  admin: SupabaseClient,
  agora: Date = new Date(),
): Promise<{ ontem: number; semana: number; mes: number }> {
  const hoje = dataBRT(agora);
  const ontem = dataBRT(new Date(agora.getTime() - 86_400_000));
  const [y, m, d] = hoje.split("-").map(Number);
  // Segunda-feira da semana corrente (via meio-dia UTC pra evitar slippage).
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = noonUTC.getUTCDay(); // 0=Dom..6=Sáb
  const diffToMon = (dow + 6) % 7;
  const monday = new Date(noonUTC.getTime() - diffToMon * 86_400_000);
  const inicioSemana = `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
  const inicioMes = `${y}-${pad(m)}-01`;
  // Busca desde o mais antigo dos dois cortes (a semana pode começar no mês anterior).
  const desde = inicioSemana < inicioMes ? inicioSemana : inicioMes;

  const [{ data }, internas] = await Promise.all([
    admin
      .from("family_accounts")
      .select("id, created_at")
      .gte("created_at", `${desde}T00:00:00-03:00`),
    familiasInternas(admin),
  ]);

  let ontemN = 0;
  let semana = 0;
  let mes = 0;
  for (const r of data ?? []) {
    if (internas.has(r.id as string)) continue;
    const dia = dataBRT(new Date(r.created_at as string));
    if (dia >= inicioMes) mes++;
    if (dia >= inicioSemana) semana++;
    if (dia === ontem) ontemN++;
  }
  return { ontem: ontemN, semana, mes };
}
