"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  resolveDestinatarios,
  type SegmentacaoCampanha,
} from "@/lib/admin/campanha-target";
import {
  sendCampanha,
  type CampanhaCategoria,
} from "@/lib/ayla/orchestrator";
import { podeEnviarProativa } from "@/lib/ayla/rules";
import type { AylaTipoProativa } from "@/lib/ayla/types";

const categoriaEnum = z.enum([
  "informacional",
  "promocional",
  "avaliacao",
  "operacional",
]);

const segmentacaoSchema = z.object({
  // Segmentos semânticos. Os nomes de status antigos seguem aceitos só para não
  // quebrar rascunho de tela antiga — `normalizarSegmentos` os traduz, e a
  // tradução só estreita o público. Ver lib/admin/campanha-target.ts.
  assinatura: z
    .array(
      z.enum([
        "em_teste",
        "trial_vencido",
        "assinante",
        "pagamento_falhou",
        "pausada",
        "cancelada",
        "trialing",
        "active",
        "past_due",
        "paused",
        "canceled",
      ]),
    )
    .optional(),
  exigir_consentimento_ayla: z.boolean().optional(),
});

const campanhaSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(3).max(200),
  categoria: categoriaEnum,
  canais: z.array(z.enum(["whatsapp", "email"])).min(1).default(["whatsapp"]),
  segmentacao: segmentacaoSchema.default({}),
  conteudo_whatsapp: z.string().trim().max(4000).optional(),
  conteudo_email_assunto: z.string().trim().max(200).optional(),
  conteudo_email_corpo: z.string().trim().max(20000).optional(),
  janela_inicio: z.string().datetime().optional().nullable(),
  janela_fim: z.string().datetime().optional().nullable(),
});

export type SaveCampanhaInput = z.infer<typeof campanhaSchema>;

export async function saveCampanha(
  input: SaveCampanhaInput,
): Promise<{ id: string }> {
  const data = campanhaSchema.parse(input);
  const { user, supabase } = await requireAdmin();

  // Conteudo coerente com canais
  if (data.canais.includes("whatsapp") && !data.conteudo_whatsapp?.trim()) {
    throw new Error("Canal WhatsApp marcado, mas conteúdo está vazio.");
  }
  if (
    data.canais.includes("email") &&
    (!data.conteudo_email_assunto?.trim() || !data.conteudo_email_corpo?.trim())
  ) {
    throw new Error(
      "Canal Email marcado, mas assunto ou corpo do email estão vazios.",
    );
  }

  const payload = {
    titulo: data.titulo,
    categoria: data.categoria,
    canais: data.canais,
    segmentacao: data.segmentacao ?? {},
    conteudo_whatsapp: data.conteudo_whatsapp ?? null,
    conteudo_email_assunto: data.conteudo_email_assunto ?? null,
    conteudo_email_corpo: data.conteudo_email_corpo ?? null,
    janela_inicio: data.janela_inicio || null,
    janela_fim: data.janela_fim || null,
  };

  if (data.id) {
    // Só permite editar enquanto rascunho
    const { data: atual } = await supabase
      .from("campanhas")
      .select("status")
      .eq("id", data.id)
      .single();
    if (!atual || atual.status !== "rascunho") {
      throw new Error("Campanha já foi submetida — não pode mais ser editada.");
    }
    const { error } = await supabase
      .from("campanhas")
      .update(payload)
      .eq("id", data.id);
    if (error) throw new Error(`Falha ao salvar: ${error.message}`);
    revalidatePath("/admin/campanhas");
    revalidatePath(`/admin/campanhas/${data.id}`);
    return { id: data.id };
  }

  const { data: nova, error } = await supabase
    .from("campanhas")
    .insert({
      ...payload,
      status: "rascunho",
      autor_user_id: user.id,
    })
    .select("id")
    .single();
  if (error || !nova) throw new Error(`Falha ao criar: ${error?.message}`);
  revalidatePath("/admin/campanhas");
  return { id: nova.id as string };
}

export async function submeterParaAprovacao(id: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: c, error: errSel } = await supabase
    .from("campanhas")
    .select("status, conteudo_whatsapp, canais")
    .eq("id", id)
    .single();
  if (errSel || !c) throw new Error("Campanha não encontrada.");
  if (c.status !== "rascunho")
    throw new Error("Só rascunhos podem ser submetidos.");

  const { error } = await supabase
    .from("campanhas")
    .update({ status: "aguardando_aprovacao" })
    .eq("id", id);
  if (error) throw new Error(`Falha ao submeter: ${error.message}`);
  revalidatePath("/admin/campanhas");
  revalidatePath(`/admin/campanhas/${id}`);
}

export async function aprovarCampanha(id: string): Promise<void> {
  const { user, supabase } = await requireAdmin();
  const { data: c } = await supabase
    .from("campanhas")
    .select("status, autor_user_id")
    .eq("id", id)
    .single();
  if (!c) throw new Error("Campanha não encontrada.");
  if (c.status !== "aguardando_aprovacao") {
    throw new Error("Campanha não está aguardando aprovação.");
  }

  const { error } = await supabase
    .from("campanhas")
    .update({
      status: "aprovada",
      aprovador_user_id: user.id,
      aprovada_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`Falha ao aprovar: ${error.message}`);
  revalidatePath("/admin/campanhas");
  revalidatePath(`/admin/campanhas/${id}`);
}

export async function cancelarCampanha(id: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: c } = await supabase
    .from("campanhas")
    .select("status")
    .eq("id", id)
    .single();
  if (!c) throw new Error("Campanha não encontrada.");
  if (!["rascunho", "aguardando_aprovacao", "aprovada"].includes(c.status)) {
    throw new Error("Campanhas em envio ou enviadas não podem ser canceladas.");
  }

  const { error } = await supabase
    .from("campanhas")
    .update({ status: "cancelada" })
    .eq("id", id);
  if (error) throw new Error(`Falha ao cancelar: ${error.message}`);
  revalidatePath("/admin/campanhas");
  revalidatePath(`/admin/campanhas/${id}`);
}

// ============================================================
// Simulação — dry-run que conta alcance e bloqueios sem enviar
// ============================================================

export type SimulacaoCampanha = {
  alcance: number;
  bloqueados: number;
  bloqueios_por_motivo: Record<string, number>;
  total_publico: number;
};

export async function simularCampanha(id: string): Promise<SimulacaoCampanha> {
  const { supabase } = await requireAdmin();
  const { data: c } = await supabase
    .from("campanhas")
    .select("categoria, segmentacao")
    .eq("id", id)
    .single();
  if (!c) throw new Error("Campanha não encontrada.");

  // Service role pra simular sem RLS atrapalhar (mesmas queries do envio)
  const admin = createServiceRoleClient();
  const familias = await resolveDestinatarios(
    admin,
    c.segmentacao as SegmentacaoCampanha,
  );

  const agora = new Date();
  const tipo: AylaTipoProativa = (`campanha_${c.categoria as CampanhaCategoria}` as AylaTipoProativa);

  let alcance = 0;
  let bloqueados = 0;
  const bloqueios: Record<string, number> = {};

  for (const familyId of familias) {
    // Opt-out (operacional não tem opt-out)
    if (c.categoria !== "operacional") {
      const { data: optout } = await admin
        .from("categorias_optout")
        .select("id")
        .eq("family_account_id", familyId)
        .eq("categoria", c.categoria)
        .maybeSingle();
      if (optout) {
        bloqueados++;
        bloqueios.optout = (bloqueios.optout ?? 0) + 1;
        continue;
      }
    }

    const r = await podeEnviarProativa(
      admin,
      { family_account_id: familyId, agora },
      tipo,
    );
    if (r.permitido) {
      alcance++;
    } else {
      bloqueados++;
      const chave = motivoChave(r.motivo);
      bloqueios[chave] = (bloqueios[chave] ?? 0) + 1;
    }
  }

  return {
    alcance,
    bloqueados,
    bloqueios_por_motivo: bloqueios,
    total_publico: familias.length,
  };
}

function motivoChave(motivo: string): string {
  const m = motivo.toLowerCase();
  if (m.includes("consentimento")) return "sem_consentimento";
  if (m.includes("desativ")) return "desativada";
  if (m.includes("pausa")) return "pausa";
  if (m.includes("limite")) return "limite_2_por_dia";
  if (m.includes("48h") || m.includes("crise")) return "comercial_pos_crise";
  if (m.includes("silêncio") || m.includes("10 dias")) return "silencio_10d";
  if (m.includes("36h")) return "engajamento_recente";
  return "outro";
}

// ============================================================
// Disparo: cria destinatarios + envia em batch (até 200/request)
// ============================================================

export async function dispararCampanha(id: string): Promise<{
  enviadas: number;
  bloqueadas: number;
  pendentes_restantes: number;
}> {
  const { supabase } = await requireAdmin();
  const { data: c } = await supabase
    .from("campanhas")
    .select(
      "id, titulo, categoria, canais, segmentacao, conteudo_whatsapp, status",
    )
    .eq("id", id)
    .single();
  if (!c) throw new Error("Campanha não encontrada.");
  if (c.status !== "aprovada" && c.status !== "enviando") {
    throw new Error("Só campanhas aprovadas (ou em envio) podem ser disparadas.");
  }
  if (
    (c.canais as string[])?.includes("whatsapp") &&
    !c.conteudo_whatsapp?.trim()
  ) {
    throw new Error("Conteúdo WhatsApp vazio.");
  }

  const admin = createServiceRoleClient();

  // Primeira disparada: cria destinatarios. Reentrante: pula se já existirem.
  if (c.status === "aprovada") {
    const familias = await resolveDestinatarios(
      admin,
      c.segmentacao as SegmentacaoCampanha,
    );
    if (familias.length > 0) {
      // upsert defensivo — em caso de dupla submissão concorrente
      const rows = familias.map((fid) => ({
        campanha_id: id,
        family_account_id: fid,
        status: "pendente" as const,
      }));
      // Insere em chunks de 1000 pra não estourar payload
      for (let i = 0; i < rows.length; i += 1000) {
        const slice = rows.slice(i, i + 1000);
        await admin.from("campanhas_destinatarios").insert(slice);
      }
    }
    await supabase
      .from("campanhas")
      .update({ status: "enviando" })
      .eq("id", id);
  }

  // Processa até 200 pendentes neste request — o resto fica pro cron
  const BATCH = 200;
  const { data: pendentes } = await admin
    .from("campanhas_destinatarios")
    .select("id, family_account_id")
    .eq("campanha_id", id)
    .eq("status", "pendente")
    .limit(BATCH);

  let enviadas = 0;
  let bloqueadas = 0;

  for (const p of pendentes ?? []) {
    try {
      const r = await sendCampanha(
        admin,
        {
          family_account_id: p.family_account_id as string,
          campanha_id: id,
          categoria: c.categoria as CampanhaCategoria,
          conteudo_whatsapp: c.conteudo_whatsapp as string,
        },
      );
      if (r.enviada) {
        enviadas++;
        await admin
          .from("campanhas_destinatarios")
          .update({
            status: "enviada",
            enviada_em: new Date().toISOString(),
          })
          .eq("id", p.id);
      } else {
        bloqueadas++;
        await admin
          .from("campanhas_destinatarios")
          .update({
            status: "bloqueada",
            bloqueio_motivo: r.motivo,
          })
          .eq("id", p.id);
      }
    } catch (e) {
      bloqueadas++;
      await admin
        .from("campanhas_destinatarios")
        .update({
          status: "falha",
          bloqueio_motivo: e instanceof Error ? e.message : "erro",
        })
        .eq("id", p.id);
    }
  }

  // Quantos ainda restam
  const { count } = await admin
    .from("campanhas_destinatarios")
    .select("id", { count: "exact", head: true })
    .eq("campanha_id", id)
    .eq("status", "pendente");

  const pendentesRestantes = count ?? 0;

  // Encerra campanha quando não há mais pendentes
  if (pendentesRestantes === 0) {
    const [{ count: enviadasCount }, { count: bloqueadasCount }] = await Promise.all([
      admin
        .from("campanhas_destinatarios")
        .select("id", { count: "exact", head: true })
        .eq("campanha_id", id)
        .eq("status", "enviada"),
      admin
        .from("campanhas_destinatarios")
        .select("id", { count: "exact", head: true })
        .eq("campanha_id", id)
        .in("status", ["bloqueada", "falha"]),
    ]);
    await supabase
      .from("campanhas")
      .update({
        status: "enviada",
        total_alcance: enviadasCount ?? 0,
        total_bloqueados: bloqueadasCount ?? 0,
      })
      .eq("id", id);
  }

  revalidatePath("/admin/campanhas");
  revalidatePath(`/admin/campanhas/${id}`);
  return {
    enviadas,
    bloqueadas,
    pendentes_restantes: pendentesRestantes,
  };
}

export async function deleteCampanha(id: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: c } = await supabase
    .from("campanhas")
    .select("status")
    .eq("id", id)
    .single();
  if (!c) throw new Error("Campanha não encontrada.");
  if (c.status === "enviando" || c.status === "enviada") {
    throw new Error(
      "Campanhas já enviadas não podem ser apagadas — cancele se ainda não disparou.",
    );
  }
  const { error } = await supabase.from("campanhas").delete().eq("id", id);
  if (error) throw new Error(`Falha ao apagar: ${error.message}`);
  revalidatePath("/admin/campanhas");
  redirect("/admin/campanhas");
}
