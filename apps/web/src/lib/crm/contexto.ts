import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarFichaFamilia } from "@/lib/analytics/ficha";
import { idadeAnos } from "@/lib/idade";

const MS_DIA = 86_400_000;

const ORIGEM_LABEL: Record<string, string> = {
  facebookads: "Meta Ads",
  facebook: "Meta Ads",
  instagram: "Instagram",
  googleads: "Google Ads",
  google: "Google",
};

export type ContextoLead = {
  nome: string;
  whatsapp: string | null;
  /** Resumo em texto pro copiloto entender o lead. */
  resumo: string;
};

/**
 * Monta o contexto de UM lead pro copiloto comercial: quem é, dia do teste,
 * o que já fez/não fez, dor e origem. Reaproveita a ficha "o que já fez".
 */
export async function carregarContextoLead(
  admin: SupabaseClient,
  familyId: string,
): Promise<ContextoLead> {
  const [ficha, { data: conta }, { data: sub }, { data: diarios }, { data: telas }] = await Promise.all([
    carregarFichaFamilia(admin, familyId),
    admin
      .from("family_accounts")
      .select("created_at, whatsapp_e164, utm_source, utm_campaign")
      .eq("id", familyId)
      .maybeSingle(),
    admin
      .from("subscription_accesses")
      .select("status, trial_ends_at")
      .eq("family_account_id", familyId)
      .maybeSingle(),
    admin
      .from("diarios")
      .select("desafio_area")
      .eq("family_account_id", familyId)
      .not("desafio_area", "is", null)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("user_events")
      .select("detalhe")
      .eq("family_account_id", familyId)
      .eq("evento", "tela_visitada")
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  const criado = conta?.created_at ? new Date(conta.created_at as string).getTime() : null;
  const diaTrial = criado
    ? Math.min(7, Math.max(1, Math.floor((Date.now() - criado) / MS_DIA) + 1))
    : null;
  const status = (sub?.status as string | null) ?? "desconhecido";
  const origem = conta?.utm_source
    ? ORIGEM_LABEL[(conta.utm_source as string).toLowerCase()] ?? (conta.utm_source as string)
    : "Direto";

  const dores = [...new Set((diarios ?? []).map((d) => d.desafio_area as string))].slice(0, 3);

  const membros = ficha.membros
    .map((m) => `${m.nome} (${m.perfil}${m.idade != null ? `, ${m.idade} anos` : ""})`)
    .join(", ");

  // SÓ SINAIS — nada do conteúdo da conversa. (Não listar temas de plano: eles
  // costumam ser trechos do que a mãe falou = história privada.)
  const usos: string[] = [];
  usos.push(ficha.ayla.mensagens > 0 ? `falou com a Ayla (${ficha.ayla.mensagens} msgs)` : "NÃO falou com a Ayla");
  usos.push(
    ficha.koloVivo.campos.length > 0
      ? `preencheu ${ficha.koloVivo.campos.length} campo(s) do Perfil`
      : "NÃO preencheu o Perfil",
  );
  usos.push(ficha.estrategias.total > 0 ? `usou Estratégias (${ficha.estrategias.total})` : "NÃO usou Estratégias");
  usos.push(ficha.planos.total > 0 ? `recebeu ${ficha.planos.total} plano(s)` : "NÃO recebeu plano");
  usos.push(ficha.ludico.total > 0 ? `usou o Lúdico (${ficha.ludico.porTipo.map((t) => t.tipo).join(", ")})` : "NÃO usou o Lúdico");

  // Telas que a pessoa ABRIU (navegou) — diferente de "usou". Ajuda o copiloto a
  // ver ex.: abriu Planos mas não gerou plano; nunca abriu Estratégias; etc.
  const ROTA_LABEL: Record<string, string> = {
    "/painel": "Início",
    "/kolo-vivo": "Perfil",
    "/estrategias": "Estratégias",
    "/planos": "Meus Planos",
    "/evolucao": "Evolução",
    "/ludico": "Lúdico",
    "/registrar/diario": "Registro Diário",
    "/assinatura": "Assinatura",
    "/configuracoes": "Configurações",
  };
  const telaCount = new Map<string, number>();
  for (const t of telas ?? []) {
    const det = t.detalhe as Record<string, unknown> | null;
    const rota = det && typeof det.rota === "string" ? (det.rota as string) : null;
    if (!rota) continue;
    const label = ROTA_LABEL[rota] ?? rota;
    telaCount.set(label, (telaCount.get(label) ?? 0) + 1);
  }
  const telasTop = [...telaCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([l, n]) => `${l} (${n})`)
    .join(", ");

  const resumo = [
    `Lead: ${ficha.nome}`,
    membros ? `Filho(s): ${membros}` : "Filho: (não cadastrou ainda)",
    `Dia do teste: ${diaTrial ?? "?"}/7 · Status: ${status}`,
    `Origem: ${origem}${conta?.utm_campaign ? ` · Campanha: ${conta.utm_campaign}` : ""}`,
    dores.length ? `Dores registradas: ${dores.join(", ")}` : "Dor principal: (nenhuma registrada ainda)",
    `O que já USOU: ${usos.join("; ")}.`,
    telasTop ? `Telas que ABRIU (navegou): ${telasTop}` : "Ainda não navegou pelo app.",
    ficha.ayla.ultima ? `Última interação: ${new Date(ficha.ayla.ultima).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    nome: ficha.nome,
    whatsapp: (conta?.whatsapp_e164 as string | null) ?? null,
    resumo,
  };
}
