"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { gerarSecoesPlanoMultiCall, PlanoIncompletoError } from "@/lib/ia/plano";
import { logEvent } from "@/lib/log";
import { listarPlanosAmputados, type PlanoIncompleto } from "./deteccao";

/**
 * Refaz os planos que foram salvos amputados (sem as seções práticas) antes do
 * guard entrar no ar. Lotes pequenos e SEQUENCIAIS: cada plano já dispara
 * várias chamadas à IA por dentro, e foi justamente o excesso de paralelismo
 * que criou o problema. Idempotente — refazer um plano já bom é inofensivo,
 * mas a lista só traz os quebrados.
 */
const LOTE = 3;

type Resultado = {
  ok: boolean;
  refeitos: number;
  aindaQuebrados: number;
  restantes: number;
  error?: string;
};

/** O desafio original: as falas da mãe na conversa que gerou o plano; sem
 *  conversa, o tema salvo. Mesma lógica do "Pedir um ajuste". */
async function desafioDoPlano(
  admin: ReturnType<typeof createServiceRoleClient>,
  plano: PlanoIncompleto,
): Promise<string> {
  const tema = (plano.tema ?? "").trim();
  if (plano.conversa_id) {
    const { data: msgs } = await admin
      .from("mensagens_skill")
      .select("papel, conteudo")
      .eq("conversa_id", plano.conversa_id)
      .order("created_at", { ascending: true });
    const doUsuario = (msgs ?? [])
      .filter((m) => m.papel === "user")
      .map((m) => m.conteudo as string)
      .join("\n")
      .slice(0, 1800)
      .trim();
    if (doUsuario) return doUsuario;
  }
  return tema;
}

export async function refazerPlanosIncompletos(): Promise<Resultado> {
  try {
    await requireAdmin();
    const admin = createServiceRoleClient();

    const pendentes = await listarPlanosAmputados(admin);
    const lote = pendentes.slice(0, LOTE);

    let refeitos = 0;
    let aindaQuebrados = 0;

    for (const plano of lote) {
      const desafio = await desafioDoPlano(admin, plano);
      if (!desafio) {
        // Sem conversa e sem tema não dá pra refazer sem inventar o assunto.
        aindaQuebrados += 1;
        await logEvent({
          kind: "plano_refazer_sem_desafio",
          severity: "warn",
          family_account_id: plano.family_account_id,
          message: `plano ${plano.id} sem conversa nem tema`,
        });
        continue;
      }
      try {
        const { titulo, tema, secoes } = await gerarSecoesPlanoMultiCall({
          supabase: admin,
          familyId: plano.family_account_id,
          membroAtipicoId: plano.membro_atipico_id,
          desafio,
        });
        await admin.from("planos").update({ titulo, tema, secoes }).eq("id", plano.id);
        refeitos += 1;
      } catch (e) {
        // O guard novo recusa entregar meio plano — o antigo fica como está
        // (nada é sobrescrito por algo pior) e volta na lista pra tentar depois.
        aindaQuebrados += 1;
        await logEvent({
          kind: "plano_refazer_falhou",
          severity: "warn",
          family_account_id: plano.family_account_id,
          message: e instanceof Error ? e.message : "erro",
          payload: {
            plano_id: plano.id,
            incompleto: e instanceof PlanoIncompletoError,
            geradas: e instanceof PlanoIncompletoError ? e.geradas : undefined,
          },
        });
      }
    }

    const restantes = (await listarPlanosAmputados(admin)).length;
    return { ok: true, refeitos, aindaQuebrados, restantes };
  } catch (e) {
    return {
      ok: false,
      refeitos: 0,
      aindaQuebrados: 0,
      restantes: 0,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}
