"use server";

/**
 * Server actions do painel de padrões — revisão humana da Karina.
 *
 * Cada ação:
 *   1. Verifica que o usuário é admin (controle_acessos.ativo)
 *   2. Atualiza o padrão com revisão (estado + revisado_em + revisado_por)
 *   3. Revalida o path
 *
 * Retornam Promise<void> pra serem usadas diretamente em <form action={...}>.
 * Erros são logados (não chegam ao caller). Se for necessário UI de erro
 * mais rica no futuro, expor `*Result()` paralelas que retornam ActionResult.
 *
 * INVARIANTES:
 *   - Nenhuma ação modifica `perfil_vivo_membro` diretamente. Caso a
 *     Karina aprove um padrão, ele fica em estado `confirmado_mae` —
 *     mas a alteração do perfil ainda passa por `sugestao_perfil_vivos`
 *     (futuro).
 *   - Nenhuma ação aciona Ayla v1. Padrões são leitura SÓ admin.
 */

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

function logErro(action: string, erro: string): void {
  console.error(`[admin/padroes] ${action} falhou: ${erro}`);
}

export async function aprovarPadrao(padraoId: string): Promise<void> {
  const { user, supabase } = await requireAdmin();
  const agora = new Date().toISOString();

  const { error } = await supabase
    .from("ayla_padroes")
    .update({
      estado: "confirmado_mae",
      revisado_em: agora,
      revisado_por: user.id,
    })
    .eq("id", padraoId);

  if (error) {
    logErro("aprovarPadrao", error.message);
    return;
  }
  revalidatePath("/admin/padroes");
}

export async function rejeitarPadrao(padraoId: string): Promise<void> {
  const { user, supabase } = await requireAdmin();
  const agora = new Date().toISOString();

  const { error } = await supabase
    .from("ayla_padroes")
    .update({
      estado: "descartado",
      revisado_em: agora,
      revisado_por: user.id,
    })
    .eq("id", padraoId);

  if (error) {
    logErro("rejeitarPadrao", error.message);
    return;
  }
  revalidatePath("/admin/padroes");
}

export async function marcarIrrelevante(padraoId: string): Promise<void> {
  const { user, supabase } = await requireAdmin();
  const agora = new Date().toISOString();

  const { error } = await supabase
    .from("ayla_padroes")
    .update({
      relevancia_karina: -1,
      revisado_em: agora,
      revisado_por: user.id,
    })
    .eq("id", padraoId);

  if (error) {
    logErro("marcarIrrelevante", error.message);
    return;
  }
  revalidatePath("/admin/padroes");
}

export async function ajustarRelevanciaFromForm(
  padraoId: string,
  formData: FormData,
): Promise<void> {
  const raw = formData.get("relevancia");
  const valor = Number(raw);
  if (!Number.isInteger(valor) || valor < -1 || valor > 5) {
    logErro("ajustarRelevancia", `valor inválido: ${raw}`);
    return;
  }

  const { user, supabase } = await requireAdmin();
  const agora = new Date().toISOString();

  const { error } = await supabase
    .from("ayla_padroes")
    .update({
      relevancia_karina: valor,
      revisado_em: agora,
      revisado_por: user.id,
    })
    .eq("id", padraoId);

  if (error) {
    logErro("ajustarRelevancia", error.message);
    return;
  }
  revalidatePath("/admin/padroes");
}

/**
 * Reabre um padrão (volta pra hipotese, limpa revisão). Útil se a Karina
 * mudar de ideia depois de aprovar/rejeitar.
 */
export async function reabrirPadrao(padraoId: string): Promise<void> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("ayla_padroes")
    .update({
      estado: "hipotese",
      revisado_em: null,
      revisado_por: null,
    })
    .eq("id", padraoId);

  if (error) {
    logErro("reabrirPadrao", error.message);
    return;
  }
  revalidatePath("/admin/padroes");
}
