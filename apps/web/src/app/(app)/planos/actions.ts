"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { gerarSecoesPlanoMultiCall, PlanoIncompletoError } from "@/lib/ia/plano";
import { objetivoDaConversa, enquadrarObjetivo } from "@/lib/conducao/objetivo";
import { ofereceuPlano } from "@/lib/ia/marcadores";
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
      .select("id, conversa_id, membro_atipico_id, tema, titulo, secoes")
      .eq("id", planoId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!plano) return { ok: false, error: "Plano não encontrado." };

    // Guarda o plano ATUAL: se o ajuste falhar, ela recebe de volta o que já
    // tinha — pedir um ajuste não pode custar o plano que estava na mão.
    const anterior = {
      titulo: (plano.titulo as string | null) ?? "Plano",
      secoes: (plano.secoes ?? []) as unknown,
    };

    // Desafio original: mensagens da conversa que gerou o plano (se houver).
    let desafioBase = (plano.tema as string | null)?.trim() || "";
    if (plano.conversa_id) {
      const { data: msgs } = await supabase
        .from("mensagens_skill")
        .select("papel, conteudo")
        .eq("conversa_id", plano.conversa_id as string)
        .order("created_at", { ascending: true });
      // MESMA REGRA DA CRIAÇÃO (11/08/2026). Ajustar um plano tem que partir do
      // mesmo objetivo que o gerou — se aqui voltasse a concatenar as falas da
      // mãe, o ajuste reconstruiria o plano sobre um alvo diferente do original,
      // e a família veria o tema mudar sozinho ao pedir uma correção.
      const turnos = (msgs ?? [])
        .map((m) => ({
          de: (m.papel === "user" ? "familia" : "ayla") as "familia" | "ayla",
          texto: (m.conteudo as string) ?? "",
          ofereceuPlano: m.papel === "assistant" && ofereceuPlano(m.conteudo as string),
        }))
        .filter((t) => t.texto.trim());
      const alvo = objetivoDaConversa(turnos);
      if (alvo) desafioBase = enquadrarObjetivo(alvo);
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
        const temAnterior = Array.isArray(anterior.secoes) && anterior.secoes.length > 0;
        if (temAnterior) {
          // Devolve o plano original + um aviso no topo, em vez de deixar a
          // mãe sem nada. O ajuste ela pode pedir de novo.
          await admin
            .from("planos")
            .update({
              titulo: anterior.titulo,
              secoes: [
                {
                  tipo: "__erro__",
                  titulo: "",
                  conteudo_markdown:
                    e instanceof PlanoIncompletoError
                      ? "O ajuste não saiu completo desta vez, então mantive o seu plano como estava. Pode pedir o ajuste de novo."
                      : "Tive um problema ao ajustar este plano, então mantive ele como estava. Tente pedir o ajuste de novo em instantes.",
                },
                ...(anterior.secoes as unknown[]),
              ],
            })
            .eq("id", planoId);
          return;
        }
        await admin
          .from("planos")
          .update({
            titulo: "Não consegui ajustar o plano",
            secoes: [
              {
                tipo: "__erro__",
                titulo: "",
                conteudo_markdown:
                  e instanceof PlanoIncompletoError
                    ? "A parte prática do plano não veio nesta tentativa, e eu não quis te entregar pela metade. Peça o ajuste de novo: costuma sair completo na segunda vez."
                    : "Tive um problema ao ajustar este plano. Tente pedir o ajuste de novo em instantes.",
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
