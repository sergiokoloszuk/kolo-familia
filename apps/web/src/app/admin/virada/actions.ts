"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logEvent } from "@/lib/log";
import { CHAVE_VIRADA_COMERCIAL, instanteDeBrasilia } from "@/lib/billing/virada-comercial";
import { BLACK_FRIDAY_2026 } from "@/lib/billing/black-friday-2026";

/**
 * Programa, muda ou cancela a virada comercial. Não manda mensagem, não cobra
 * e não mexe em nenhuma família: só grava a data em `configuracao_geral`.
 * Quem já tem teste, cortesia, oferta ou assinatura não é afetado em nenhum
 * caso — ver `lib/billing/virada-comercial`.
 */

const PAGINAS = ["/admin/virada", "/precos", "/termos", "/onboarding", "/assinatura"];

function revalidar() {
  for (const p of PAGINAS) revalidatePath(p);
}

export async function programarVirada(formData: FormData): Promise<void> {
  const quando = instanteDeBrasilia(String(formData.get("quando") ?? ""));
  if (!quando) throw new Error("Informe data e hora válidas (horário de Brasília).");
  // ⚠️ Antes do fim da Black Friday, a campanha ainda oferece "Ativar meus 15
  // dias" a quem não tem teste — e o gatilho da 0096 transforma isso em teste.
  // As duas jornadas não podem valer ao mesmo tempo.
  if (Date.parse(quando) < Date.parse(BLACK_FRIDAY_2026.fimPublicoExclusivo)) {
    throw new Error("A virada não pode começar antes do fim da Black Friday (01/12/2026, 00h de Brasília).");
  }
  if (formData.get("confirmo") !== "sim") {
    throw new Error("Marque a confirmação: a partir da data, novas contas não terão dias grátis.");
  }

  const { supabase, user } = await requireAdmin();
  const { error } = await supabase.from("configuracao_geral").upsert(
    {
      chave: CHAVE_VIRADA_COMERCIAL,
      valor: quando,
      descricao: "Início da jornada sem teste grátis para novas contas (virada comercial)",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chave" },
  );
  if (error) throw new Error(`A data não foi gravada: ${error.message}`);

  await logEvent({
    kind: "virada_comercial_programada",
    severity: "info",
    persistir: true,
    message: `virada programada para ${quando}`,
    payload: { quando, por: user.id },
  });
  revalidar();
}

export async function cancelarVirada(): Promise<void> {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase
    .from("configuracao_geral")
    .delete()
    .eq("chave", CHAVE_VIRADA_COMERCIAL);
  if (error) throw new Error(`A virada não foi cancelada: ${error.message}`);

  await logEvent({
    kind: "virada_comercial_cancelada",
    severity: "info",
    persistir: true,
    message: "virada cancelada — volta a jornada com teste de 7 dias",
    payload: { por: user.id },
  });
  revalidar();
}
