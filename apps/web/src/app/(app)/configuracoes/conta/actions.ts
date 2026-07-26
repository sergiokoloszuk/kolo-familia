"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, loadFamilyContext } from "@/lib/auth/require-user";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { chaveTelefoneBR } from "@/lib/telefone";
import { logEvent, logServerError } from "@/lib/log";

export type PerfilResult = { ok: true } | { ok: false; error: string };

const perfilSchema = z.object({
  nome_mae: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  como_chamar: z.string().trim().max(60, "Apelido muito longo").optional(),
});

/**
 * Atualiza nome e apelido (como_chamar) do responsável. É o `como_chamar`
 * que alimenta o "Oi, {nome}" do painel e o nome na sidebar — daí
 * revalidar painel e layout do app.
 */
export async function salvarPerfilAction(
  input: z.infer<typeof perfilSchema>,
): Promise<PerfilResult> {
  try {
    const data = perfilSchema.parse(input);
    const { supabase, family } = await loadFamilyContext();
    if (!family) return { ok: false, error: "Família não inicializada." };

    const { error } = await supabase
      .from("family_profiles")
      .upsert(
        {
          family_account_id: family.id,
          nome_mae: data.nome_mae,
          como_chamar: data.como_chamar?.trim() ? data.como_chamar.trim() : null,
        },
        { onConflict: "family_account_id" },
      );
    if (error) return { ok: false, error: `Não consegui salvar: ${error.message}` };

    revalidatePath("/configuracoes/conta");
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const whatsappSchema = z.object({
  whatsapp_e164: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s()\-.]/g, ""))
    .pipe(
      z
        .string()
        .regex(/^\+\d{8,15}$/, "Use o formato internacional, ex.: +55 11 91234-5678."),
    ),
});

/**
 * Atualiza o WhatsApp da família (por onde a Ayla fala). Valida o formato e
 * bloqueia se outro cadastro já usa o mesmo número — protege contra a Ayla
 * responder pra família errada (ver pendência de WhatsApp único).
 */
export async function atualizarWhatsappAction(
  input: z.infer<typeof whatsappSchema>,
): Promise<PerfilResult> {
  try {
    const { whatsapp_e164 } = whatsappSchema.parse(input);
    const { family } = await loadFamilyContext();
    if (!family) return { ok: false, error: "Família não inicializada." };

    const admin = createServiceRoleClient();
    // Compara pela chave NORMALIZADA (9º dígito/país) — igual ao onboarding e à
    // Ayla — pra pegar variações do mesmo número, não só o texto idêntico.
    const chaveNova = chaveTelefoneBR(whatsapp_e164);
    if (chaveNova) {
      const { data: outras } = await admin
        .from("family_accounts")
        .select("id, whatsapp_e164")
        .not("whatsapp_e164", "is", null)
        .neq("id", family.id);
      const conflito = (outras ?? []).some(
        (f) => chaveTelefoneBR(f.whatsapp_e164 as string) === chaveNova,
      );
      if (conflito) {
        return { ok: false, error: "Esse WhatsApp já está em uso por outra conta." };
      }
    }

    const { error } = await admin
      .from("family_accounts")
      .update({ whatsapp_e164 })
      .eq("id", family.id);
    if (error) {
      // 23505 = unique_violation (índice family_accounts_whatsapp_unico).
      if (error.code === "23505") {
        return { ok: false, error: "Esse WhatsApp já está em uso por outra conta." };
      }
      return { ok: false, error: `Não consegui salvar: ${error.message}` };
    }

    revalidatePath("/configuracoes/conta");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const idiomaSchema = z.object({
  idioma: z.enum(["pt", "es", "en"]),
});

/**
 * Troca o idioma da família (pt/es/en). Define a língua da plataforma e das
 * mensagens que a Ayla ENVIA (proativas). A resposta reativa da Ayla já
 * espelha o idioma de quem escreve, independente disto.
 */
export async function salvarIdiomaAction(
  input: z.infer<typeof idiomaSchema>,
): Promise<PerfilResult> {
  try {
    const { idioma } = idiomaSchema.parse(input);
    const { family } = await loadFamilyContext();
    if (!family) return { ok: false, error: "Família não inicializada." };

    const admin = createServiceRoleClient();
    const { error } = await admin
      .from("family_accounts")
      .update({ idioma })
      .eq("id", family.id);
    if (error) return { ok: false, error: `Não consegui salvar: ${error.message}` };

    revalidatePath("/configuracoes/conta");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
});

/**
 * Troca o e-mail de login. O Supabase manda um link de confirmação pro NOVO
 * e-mail; a troca só vale quando a pessoa confirma. Não muda nada na hora.
 */
export async function atualizarEmailAction(
  input: z.infer<typeof emailSchema>,
): Promise<PerfilResult> {
  try {
    const { email } = emailSchema.parse(input);
    const { supabase, user } = await loadFamilyContext();
    if (email === (user.email ?? "").toLowerCase()) {
      return { ok: false, error: "Esse já é o seu e-mail atual." };
    }
    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      return { ok: false, error: `Não consegui trocar agora: ${error.message}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const senhaSchema = z.object({
  senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
});

/**
 * Define a senha de quem JÁ ESTÁ LOGADA — sem e-mail no meio.
 *
 * Quem entrou pelo link da Ayla não tem senha nenhuma (ou não lembra), e o
 * caminho por e-mail é frágil pra esse público: o endereço pode ter typo, ela
 * pode não abrir a caixa, e o token do e-mail divide o MESMO slot do link da
 * Ayla no Supabase — um mata o outro. Logada, nada disso é necessário.
 */
export async function definirSenhaAction(
  input: z.infer<typeof senhaSchema>,
): Promise<PerfilResult> {
  try {
    const { senha } = senhaSchema.parse(input);
    const { supabase } = await loadFamilyContext();
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      return { ok: false, error: `Não consegui salvar agora: ${error.message}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const schema = z.object({
  confirmacao: z
    .string()
    .trim()
    .refine((s) => s === "EXCLUIR", {
      message: "Digite EXCLUIR (em maiúsculas) pra confirmar.",
    }),
});

/**
 * Exclui a conta da usuária — direito LGPD §18, V (eliminação).
 *
 * Ordem:
 *   1. Cancela subscription no Stripe se existir (best-effort — falha
 *      aqui não impede a deleção; evento fica em eventos_app).
 *   2. Deleta auth.users → cascateia para family_accounts e dependentes
 *      via ON DELETE CASCADE definido em 0001_init.sql.
 *   3. Loga evento.
 *
 * O fluxo é idempotente: chamar duas vezes não quebra (a segunda só
 * dispara unauthorized porque a sessão já caiu).
 */
export async function excluirContaAction(input: {
  confirmacao: string;
}): Promise<void> {
  const parsed = schema.parse(input);
  void parsed; // só pra validar

  const { user, supabase } = await requireUser();
  const { family } = await loadFamilyContext();
  const familyId = family?.id ?? null;

  // 1. Cancela subscription Stripe
  if (familyId) {
    const { data: sub } = await supabase
      .from("subscription_accesses")
      .select("stripe_subscription_id")
      .eq("family_account_id", familyId)
      .maybeSingle();
    const subId = sub?.stripe_subscription_id as string | null;
    if (subId) {
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.cancel(subId);
      } catch (e) {
        await logServerError("excluir_conta_stripe", e, {
          family_account_id: familyId,
          user_id: user.id,
        });
      }
    }
  }

  // 2. Antes de apagar: registra que este e-mail/número JÁ USOU o teste.
  //    Só o hash (sha256) vai pra tabela — a exclusão continua sendo exclusão
  //    de verdade, e ninguém ganha outros 7 dias grátis recadastrando. O hash
  //    é calculado no banco (fonte única), não aqui, pra não haver divergência
  //    de normalização.
  const admin = createServiceRoleClient();
  {
    const { data: conta } = familyId
      ? await admin
          .from("family_accounts")
          .select("whatsapp_e164")
          .eq("id", familyId)
          .maybeSingle()
      : { data: null };
    const { error: errReg } = await admin.rpc("registrar_teste_usado", {
      p_email: user.email ?? null,
      p_whatsapp: (conta?.whatsapp_e164 as string | null) ?? null,
      p_origem: "exclusao",
    });
    // Falhar aqui NÃO pode impedir a exclusão (direito da pessoa vem primeiro),
    // mas tem que ficar visível — senão a brecha volta em silêncio.
    if (errReg) {
      await logServerError("registrar_teste_usado_falhou", errReg, {
        user_id: user.id,
        family_account_id: familyId,
      });
    }
  }

  const { error: errDel } = await admin.auth.admin.deleteUser(user.id);
  if (errDel) {
    await logServerError("excluir_conta_delete_user", errDel, {
      user_id: user.id,
      family_account_id: familyId,
    });
    throw new Error(`Não consegui excluir agora: ${errDel.message}`);
  }

  await logEvent({
    kind: "conta_excluida",
    severity: "warn",
    user_id: user.id,
    family_account_id: familyId,
    message: "Usuária acionou exclusão de conta (LGPD).",
  });

  // 3. Encerra sessão e leva pra home
  await supabase.auth.signOut();
  redirect("/login?conta_excluida=1");
}
