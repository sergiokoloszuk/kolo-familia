"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

type Admin = ReturnType<typeof createServiceRoleClient>;

const TRIAL_DIAS = 30;

/**
 * Recria a família do usuário do zero: apaga a linha de family_accounts
 * (o ON DELETE CASCADE leva TODOS os descendentes — membros, perfil vivo,
 * diários, conversas, mensagens da Ayla, relatórios, etc.) e recria o stub
 * espelhando o trigger handle_new_user (0004): family_accounts +
 * subscription_accesses (trial 30d) + ayla_preferences (desativada).
 *
 * O usuário de auth e o controle_acessos NÃO são tocados — só os dados da
 * família. Por isso é seguro pra resetar a própria conta de admin.
 */
async function recriarFamiliaStub(admin: Admin, userId: string): Promise<ActionResult> {
  const { data: fam, error: errFind } = await admin
    .from("family_accounts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (errFind) return { ok: false, error: `Falha ao localizar família: ${errFind.message}` };

  if (fam) {
    const { error: errDel } = await admin.from("family_accounts").delete().eq("id", fam.id);
    if (errDel) return { ok: false, error: `Falha ao apagar família: ${errDel.message}` };
  }

  const { data: nova, error: errNew } = await admin
    .from("family_accounts")
    .insert({ user_id: userId, whatsapp_e164: null, onboarding_step: 1, onboarding_completed: false })
    .select("id")
    .single();
  if (errNew || !nova) {
    return { ok: false, error: `Falha ao recriar família: ${errNew?.message ?? "sem retorno"}` };
  }

  const trialEnds = new Date(Date.now() + TRIAL_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { error: errSub } = await admin
    .from("subscription_accesses")
    .insert({ family_account_id: nova.id, status: "trialing", trial_ends_at: trialEnds });
  if (errSub) return { ok: false, error: `Falha ao recriar assinatura: ${errSub.message}` };

  const { error: errAyla } = await admin
    .from("ayla_preferences")
    .insert({ family_account_id: nova.id, desativada: true, consentimento_em: null });
  if (errAyla) return { ok: false, error: `Falha ao recriar preferências da Ayla: ${errAyla.message}` };

  return { ok: true };
}

async function findUserIdByEmail(admin: Admin, email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Falha ao buscar usuários: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Reseta a conta do próprio admin logado — volta pro onboarding do zero.
 */
export async function resetMinhaConta(): Promise<ActionResult> {
  try {
    const { user } = await requireAdmin();
    const admin = createServiceRoleClient();
    const res = await recriarFamiliaStub(admin, user.id);
    if (res.ok) {
      revalidatePath("/admin/teste");
      revalidatePath("/onboarding");
      revalidatePath("/painel");
    }
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

const emailSchema = z.string().trim().toLowerCase().email("Email inválido");

/**
 * Reseta a conta de uma conta de teste específica, pelo email.
 */
export async function resetContaPorEmail(emailRaw: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const email = emailSchema.parse(emailRaw);
    const admin = createServiceRoleClient();

    const userId = await findUserIdByEmail(admin, email);
    if (!userId) {
      return { ok: false, error: `Nenhum usuário com email '${email}'.` };
    }

    const res = await recriarFamiliaStub(admin, userId);
    if (res.ok) revalidatePath("/admin/teste");
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/**
 * Popula a família do admin logado com um caso realista, pra ver como o app
 * fica "cheio" sem precisar digitar tudo no onboarding. Idempotente: zera os
 * membros antes de recriar os dois de exemplo.
 */
export async function seedExemplo(): Promise<ActionResult> {
  try {
    const { user } = await requireAdmin();
    const admin = createServiceRoleClient();

    const { data: fam, error: errFam } = await admin
      .from("family_accounts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (errFam) return { ok: false, error: `Falha ao localizar família: ${errFam.message}` };
    if (!fam) return { ok: false, error: "Família não inicializada. Tente 'Resetar minha conta' primeiro." };

    const familyId = fam.id as string;

    // Slate limpo de membros (cascade limpa perfil_vivo_membro, diários, etc.).
    const { error: errDelMembros } = await admin
      .from("membros_atipicos")
      .delete()
      .eq("family_account_id", familyId);
    if (errDelMembros) return { ok: false, error: `Falha ao limpar membros: ${errDelMembros.message}` };

    const { error: errAcc } = await admin
      .from("family_accounts")
      .update({
        nome_familia: "Família Exemplo",
        whatsapp_e164: "+5511999990000",
        onboarding_step: 7,
        onboarding_completed: true,
      })
      .eq("id", familyId);
    if (errAcc) return { ok: false, error: `Falha ao atualizar conta: ${errAcc.message}` };

    const { error: errProfile } = await admin.from("family_profiles").upsert({
      family_account_id: familyId,
      nome_mae: "Ana Exemplo",
      data_nascimento_mae: "1990-03-15",
      como_chamar: "Ana",
      papel: "mae",
    });
    if (errProfile) return { ok: false, error: `Falha ao salvar perfil: ${errProfile.message}` };

    const { error: errFamVivo } = await admin.from("perfil_vivo_familia").upsert({
      family_account_id: familyId,
      composicao: { texto: "Ana (mãe), o companheiro e dois filhos. Avó materna ajuda nas tardes." },
      rotina: { texto: "Escola de manhã, terapias 2x na semana à tarde, noites mais difíceis no banho e no sono." },
      recursos: { texto: "Acompanhamento com fono e TO pela rede particular; escola regular com mediadora." },
      dinamica: { texto: "Casa movimentada; transições entre atividades costumam gerar crise." },
      completude_pct: 100,
    });
    if (errFamVivo) return { ok: false, error: `Falha ao salvar contexto: ${errFamVivo.message}` };

    const { data: membros, error: errMembros } = await admin
      .from("membros_atipicos")
      .insert([
        { family_account_id: familyId, nome: "Lucas", data_nascimento: "2018-06-10", perfil: "TEA" },
        { family_account_id: familyId, nome: "Sofia", data_nascimento: "2016-09-22", perfil: "TDAH" },
      ])
      .select("id, nome");
    if (errMembros || !membros) {
      return { ok: false, error: `Falha ao criar membros: ${errMembros?.message ?? "sem retorno"}` };
    }

    const vivoPorMembro: Record<string, { interesses: string[]; desafios: string[]; conquista: string }> = {
      Lucas: {
        interesses: ["trens e linhas de metrô", "desenhar mapas", "água e piscina"],
        desafios: ["transições sem aviso", "barulho alto e inesperado", "mudança de rotina"],
        conquista: "Conseguiu escovar os dentes sozinho a semana inteira.",
      },
      Sofia: {
        interesses: ["dança", "histórias de animais", "jogos de tabuleiro"],
        desafios: ["esperar a vez", "manter o foco na lição", "frustração ao perder"],
        conquista: "Terminou a tarefa de casa sem precisar de lembretes duas vezes.",
      },
    };

    for (const m of membros) {
      const v = vivoPorMembro[m.nome as string];
      if (!v) continue;
      const { error: errVivo } = await admin.from("perfil_vivo_membro").upsert(
        {
          membro_atipico_id: m.id,
          family_account_id: familyId,
          como_e: { interesses: v.interesses },
          desafios_regulacao: { desafios_iniciais: v.desafios },
          essencial: { conquista_inicial: v.conquista },
          completude_pct: 25,
        },
        { onConflict: "membro_atipico_id" },
      );
      if (errVivo) return { ok: false, error: `Falha ao salvar perfil vivo: ${errVivo.message}` };
    }

    const { error: errAyla } = await admin
      .from("ayla_preferences")
      .update({ desativada: false, consentimento_em: new Date().toISOString() })
      .eq("family_account_id", familyId);
    if (errAyla) return { ok: false, error: `Falha ao ativar Ayla: ${errAyla.message}` };

    revalidatePath("/admin/teste");
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
