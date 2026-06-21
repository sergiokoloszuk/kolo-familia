"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { gerarSecoesPlanoMultiCall } from "@/lib/ia/plano";
import { resolveFamily } from "@/lib/auth/current-family";

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await resolveFamily(supabase);
  if (!family) throw new Error("Família não inicializada");
  return { supabase, family };
}

const schema = z.object({
  planoId: z.string().uuid(),
  resultado: z.enum(["funcionou", "parcial", "nao_funcionou", "nao_testou"]),
  nota: z.string().trim().max(800).optional().nullable(),
});

/**
 * A mãe diz como foi o plano (Fase 4). Guarda no próprio plano — os
 * próximos planos da criança leem isso pra priorizar o que funcionou.
 */
export async function registrarResultadoPlano(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { planoId, resultado, nota } = schema.parse(input);
    const { supabase, family } = await requireFamily();

    const { error } = await supabase
      .from("planos")
      .update({
        resultado,
        resultado_nota: nota?.trim() || null,
        resultado_em: new Date().toISOString(),
      })
      .eq("id", planoId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: `Não consegui salvar: ${error.message}` };

    revalidatePath(`/planos/${planoId}`);
    revalidatePath("/planos");
    revalidatePath("/evolucao");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/** Exclui um plano da família. */
export async function deletarPlano(
  input: { planoId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { planoId } = z.object({ planoId: z.string().uuid() }).parse(input);
    const { supabase, family } = await requireFamily();
    const { error } = await supabase
      .from("planos")
      .delete()
      .eq("id", planoId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: `Não consegui excluir: ${error.message}` };
    revalidatePath("/planos");
    revalidatePath("/evolucao");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const ajusteSchema = z.object({
  planoId: z.string().uuid(),
  instrucao: z.string().trim().min(3, "Diga o que ajustar").max(600),
});

/**
 * "Pedir um ajuste": regenera o plano levando em conta o pedido da mãe (ex.:
 * "deixa mais simples", "foca em X"). Volta o plano pro estado "montando…"
 * (secoes vazias) e refaz em segundo plano — a tela mostra o poller e
 * atualiza sozinha. Reusa o desafio original (da conversa) + a instrução.
 */
export async function ajustarPlano(
  input: z.infer<typeof ajusteSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { planoId, instrucao } = ajusteSchema.parse(input);
    const { supabase, family } = await requireFamily();
    await requireActiveWrite(family.id);

    const { data: plano } = await supabase
      .from("planos")
      .select("id, conversa_id, membro_atipico_id, tema")
      .eq("id", planoId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!plano) return { ok: false, error: "Plano não encontrado." };

    // Desafio original: mensagens da conversa que gerou o plano (se houver).
    let desafioBase = (plano.tema as string | null)?.trim() || "";
    if (plano.conversa_id) {
      const { data: msgs } = await supabase
        .from("mensagens_skill")
        .select("papel, conteudo")
        .eq("conversa_id", plano.conversa_id as string)
        .order("created_at", { ascending: true });
      const doUsuario = (msgs ?? [])
        .filter((m) => m.papel === "user")
        .map((m) => m.conteudo as string)
        .join("\n")
        .slice(0, 1800);
      if (doUsuario) desafioBase = doUsuario;
    }
    const desafio = `${desafioBase}\n\n<ajuste_pedido_pela_mae>\n${instrucao}\n</ajuste_pedido_pela_mae>\nRefaça o plano levando esse ajuste em conta.`;
    const membroAtipicoId = plano.membro_atipico_id as string | null;

    // Volta pro estado "montando…" (a tela mostra o poller).
    const { error: upErr } = await supabase
      .from("planos")
      .update({ titulo: "Ajustando o plano…", secoes: [] })
      .eq("id", planoId)
      .eq("family_account_id", family.id);
    if (upErr) return { ok: false, error: `Não consegui iniciar o ajuste: ${upErr.message}` };

    after(async () => {
      const admin = createServiceRoleClient();
      try {
        const { titulo, tema, secoes } = await gerarSecoesPlanoMultiCall({
          supabase: admin,
          familyId: family.id,
          membroAtipicoId,
          desafio,
        });
        await admin.from("planos").update({ titulo, tema, secoes }).eq("id", planoId);
      } catch (e) {
        console.error("[plano.ajuste.after]", e);
        await admin
          .from("planos")
          .update({
            titulo: "Não consegui ajustar o plano",
            secoes: [
              {
                tipo: "__erro__",
                titulo: "",
                conteudo_markdown:
                  "Tive um problema ao ajustar este plano. Tente pedir o ajuste de novo em instantes.",
              },
            ],
          })
          .eq("id", planoId);
      }
    });

    revalidatePath(`/planos/${planoId}`);
    revalidatePath("/planos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
