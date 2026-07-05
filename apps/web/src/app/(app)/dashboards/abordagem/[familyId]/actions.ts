"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ehAdmin } from "@/lib/auth/require-admin";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { enviarTexto } from "@/lib/ayla/whatsappSender";
import { gerarMagicLink } from "@/lib/ayla/ponte";
import { carregarContextoLead } from "@/lib/crm/contexto";

const schema = z.object({
  familyId: z.string().uuid(),
  texto: z.string().trim().min(1, "Mensagem vazia").max(4000),
});

export type EnvioResult = { ok: true } | { ok: false; error: string };

/**
 * Envia a abordagem (definida pela Karina com o copiloto) pelo WhatsApp da Kolo
 * e registra no CRM. Só admin. Marca o lead como "em abordagem" — a Fase B vai
 * usar isso pra suprimir a Ayla e avisar quando o lead responder.
 */
export async function enviarAbordagem(input: {
  familyId: string;
  texto: string;
}): Promise<EnvioResult> {
  try {
    if (!(await ehAdmin())) return { ok: false, error: "Só admin pode enviar." };
    const { familyId, texto } = schema.parse(input);

    const admin = createServiceRoleClient();
    const ctx = await carregarContextoLead(admin, familyId);
    if (!ctx.whatsapp) {
      return { ok: false, error: "Esse lead não tem WhatsApp cadastrado." };
    }

    // Link de assinatura: se a mensagem tem o marcador [link], troca pelo link
    // MÁGICO real (abre já logado na /assinatura). É aqui que converte — por isso
    // gera fresco na hora do envio, sempre válido.
    let textoFinal = texto;
    if (/\[link\]/i.test(textoFinal)) {
      const link = await gerarMagicLink(admin, { familyId, next: "/assinatura" });
      const url = link ?? `${(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")}/assinatura`;
      textoFinal = textoFinal.replace(/\[link\]/gi, url);
    }

    // Quem está enviando (pra registrar o autor).
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Envia pelo número da Kolo (Z-API).
    try {
      await enviarTexto({ phoneE164: ctx.whatsapp, texto: textoFinal });
    } catch (e) {
      return {
        ok: false,
        error: `Não consegui enviar: ${e instanceof Error ? e.message : "falha na Z-API"}`,
      };
    }

    // 2. Registra a mensagem na thread do CRM (o texto real, com o link).
    await admin.from("crm_mensagens").insert({
      family_account_id: familyId,
      direcao: "enviada",
      texto: textoFinal,
      autor_user_id: user?.id ?? null,
    });

    // 3. Marca o lead como em abordagem (aguardando_resposta é setado quando o
    //    lead responder — Fase B).
    await admin.from("crm_leads").upsert(
      {
        family_account_id: familyId,
        em_abordagem: true,
        aguardando_resposta: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "family_account_id" },
    );

    revalidatePath(`/dashboards/abordagem/${familyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/**
 * Encerra a abordagem: a Ayla volta a responder esse lead normalmente. Só admin.
 */
export async function encerrarAbordagem(familyId: string): Promise<EnvioResult> {
  try {
    if (!(await ehAdmin())) return { ok: false, error: "Só admin." };
    z.string().uuid().parse(familyId);
    const admin = createServiceRoleClient();
    const { error } = await admin
      .from("crm_leads")
      .update({ em_abordagem: false, aguardando_resposta: false, updated_at: new Date().toISOString() })
      .eq("family_account_id", familyId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/dashboards/abordagem/${familyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
