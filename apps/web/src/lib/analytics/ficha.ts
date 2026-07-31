import type { SupabaseClient } from "@supabase/supabase-js";
import { idadeAnos } from "@/lib/idade";
import { lerSecoesMembro, PERFIL_MEMBRO_SELECT } from "@/lib/kolo-vivo/leitura";
import { MEMBRO_CAMPOS_TODOS, MEMBRO_CAMPO_LABEL } from "@/lib/kolo-vivo/campos";

/**
 * Ficha "o que já fez" de UMA família — pro drill-down do dashboard (Fase 2).
 * Junta Ayla, Kolo Vivo, Estratégias, Planos, Lúdico e a timeline (user_events).
 *
 * A página decide o que MOSTRAR conforme o papel (admin vê conteúdo; agência
 * co-acesso vê só os sinais/contagens). Como é server component, o que não é
 * renderizado não chega no navegador da agência.
 */

const EVENTO_LABEL: Record<string, string> = {
  conversa_mensagem: "Conversa (Estratégias)",
  ludico_gerado: "Gerou algo no Lúdico",
  plano_solicitado: "Pediu um plano",
  registro_dia: "Registro diário",
  rotina: "Rotina visual",
  relatorio_gerado: "Gerou relatório",
  tela_visitada: "Abriu tela",
  checkout_iniciado: "Clicou em assinar",
};

export type FichaFamilia = {
  nome: string;
  membros: { nome: string; perfil: string; idade: number | null }[];
  ayla: { mensagens: number; ultima: string | null };
  koloVivo: { campos: string[]; conteudo: { campo: string; texto: string }[] };
  estrategias: { total: number; titulos: string[]; ultima: string | null };
  planos: { total: number; temas: string[] };
  ludico: { total: number; porTipo: { tipo: string; n: number }[] };
  timeline: { evento: string; quando: string; detalhe: string | null }[];
};

export async function carregarFichaFamilia(
  admin: SupabaseClient,
  familyId: string,
): Promise<FichaFamilia> {
  const [
    { data: profile },
    { data: membros },
    { data: aylaMsgs },
    { data: conversas },
    { data: planos },
    { data: rotinas },
    { data: desenhos },
    { data: historias },
    { data: meditacoes },
    { data: events },
  ] = await Promise.all([
    admin.from("family_profiles").select("nome_mae, como_chamar").eq("family_account_id", familyId).maybeSingle(),
    admin
      .from("membros_atipicos")
      .select("id, nome, perfil, data_nascimento, idade")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    admin
      .from("ayla_messages")
      .select("direcao, created_at")
      .eq("family_account_id", familyId)
      .eq("direcao", "inbound"),
    admin.from("conversas").select("titulo, created_at").eq("family_account_id", familyId),
    admin.from("planos").select("tema, created_at").eq("family_account_id", familyId),
    admin.from("rotinas").select("id").eq("family_account_id", familyId),
    admin.from("desenhos").select("id").eq("family_account_id", familyId),
    admin.from("historias").select("id").eq("family_account_id", familyId),
    admin.from("meditacoes").select("id").eq("family_account_id", familyId),
    admin
      .from("user_events")
      .select("evento, detalhe, created_at")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const nome =
    (profile?.como_chamar as string | null)?.trim() ||
    (profile?.nome_mae as string | null)?.trim() ||
    "Sem nome";

  const membrosArr = (membros ?? []).map((m) => ({
    nome: m.nome as string,
    perfil: (m.perfil as string) ?? "—",
    idade: idadeAnos((m.data_nascimento as string | null) ?? null) ?? (m.idade as number | null) ?? null,
  }));

  // Ayla
  const msgs = aylaMsgs ?? [];
  const ultimaAyla = msgs.reduce<string | null>((acc, m) => {
    const t = m.created_at as string;
    return !acc || t > acc ? t : acc;
  }, null);

  // Kolo Vivo — quais campos têm conteúdo (por membro).
  const memberIds = (membros ?? []).map((m) => m.id as string);
  const campos = new Set<string>();
  const conteudo: { campo: string; texto: string }[] = [];
  if (memberIds.length) {
    // Até 31/07 esta consulta pedia só as 5 colunas dedicadas e tinha o seu
    // próprio mapa de rótulos: a ficha mostrava 5 dos 20 domínios, e nem sabia
    // que os outros 15 existiam. Agora usa a seleção e a leitura canônicas —
    // sem interpretação própria dos domínios.
    const { data: perfis } = await admin
      .from("perfil_vivo_membro")
      .select(PERFIL_MEMBRO_SELECT)
      .in("membro_atipico_id", memberIds);
    for (const p of perfis ?? []) {
      const secoes = lerSecoesMembro(p as Record<string, unknown>);
      for (const campo of MEMBRO_CAMPOS_TODOS) {
        const texto = secoes[campo];
        if (texto) {
          const label = MEMBRO_CAMPO_LABEL[campo] ?? campo;
          campos.add(label);
          conteudo.push({ campo: label, texto });
        }
      }
    }
  }

  // Estratégias
  const conv = conversas ?? [];
  const ultimaConv = conv.reduce<string | null>((acc, c) => {
    const t = c.created_at as string;
    return !acc || t > acc ? t : acc;
  }, null);

  // Lúdico por tipo
  const porTipo = [
    { tipo: "Rotinas", n: (rotinas ?? []).length },
    { tipo: "Desenhos", n: (desenhos ?? []).length },
    { tipo: "Histórias", n: (historias ?? []).length },
    { tipo: "Meditações", n: (meditacoes ?? []).length },
  ].filter((t) => t.n > 0);
  const ludicoTotal = porTipo.reduce((s, t) => s + t.n, 0);

  // Timeline
  const timeline = (events ?? []).map((e) => {
    const ev = e.evento as string;
    const det = e.detalhe as Record<string, unknown> | null;
    const rota = det && typeof det.rota === "string" ? (det.rota as string) : null;
    return {
      evento: EVENTO_LABEL[ev] ?? ev,
      quando: e.created_at as string,
      detalhe: ev === "tela_visitada" ? rota : null,
    };
  });

  return {
    nome,
    membros: membrosArr,
    ayla: { mensagens: msgs.length, ultima: ultimaAyla },
    koloVivo: { campos: [...campos], conteudo },
    estrategias: {
      total: conv.length,
      titulos: conv.map((c) => (c.titulo as string | null) ?? "").filter(Boolean),
      ultima: ultimaConv,
    },
    planos: { total: (planos ?? []).length, temas: (planos ?? []).map((p) => (p.tema as string | null) ?? "").filter(Boolean) },
    ludico: { total: ludicoTotal, porTipo },
    timeline,
  };
}
